import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const STATUS_BADGE = { Draft: 'badge-gray', Finalized: 'badge-blue', Paid: 'badge-green' }

const fmt = (v) =>
  Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const COMMENT_FIELDS = [
  ['bonus', 'bonus_comment'],
  ['penalties', 'penalties_comment'],
  ['adjustments', 'adjustments_comment'],
]

const toNum = (v) => Number(v || 0)

export default function PayrollDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [payroll, setPayroll] = useState(null)
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [edits, setEdits] = useState({})
  const [saving, setSaving] = useState({})
  const [simulation, setSimulation] = useState(null)
  const [simulating, setSimulating] = useState(false)

  const fetchData = useCallback(() => {
    setLoading(true)
    api.get(`/payroll/${id}`)
      .then((res) => {
        setPayroll(res.data)
        setLines(res.data.lines || [])
        setEdits({})
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const isDraft = payroll?.status === 'Draft'

  const getEdit = (lineId) => edits[lineId] || {}

  const updateEdit = (lineId, field, value) => {
    setEdits((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId], [field]: value },
    }))
  }

  const getVal = (line, field) => {
    const edit = edits[line.id]
    return edit?.[field] !== undefined ? edit[field] : line[field]
  }

  const lineWithEdits = (line) => ({ ...line, ...(edits[line.id] || {}) })

  const preview = lines.reduce((acc, line) => {
    const l = lineWithEdits(line)
    const base = toNum(l.prorated_salary || l.base_salary)
    const bonus = toNum(l.bonus)
    const penalties = toNum(l.penalties)
    const adjustments = toNum(l.adjustments)
    const reimbursements = toNum(l.reimbursements)
    const overtime = toNum(l.overtime_hours) * toNum(l.overtime_rate)

    let taxReimbursement = 0
    if ((l.tax_reimbursement_type || '') === 'percent') {
      taxReimbursement = base * (toNum(l.tax_reimbursement_percent) / 100)
    } else if ((l.tax_reimbursement_type || '') === 'fixed') {
      taxReimbursement = toNum(l.tax_reimbursement_fixed)
    } else {
      taxReimbursement = toNum(l.tax_reimbursement_amount)
    }

    const total = base + bonus - penalties + adjustments + reimbursements + overtime + taxReimbursement
    acc.employees += 1
    acc.basePayroll += base
    acc.bonuses += bonus
    acc.taxReimbursements += taxReimbursement
    acc.totalPayout += total
    if (l.payment_method === 'Crypto') {
      acc.crypto += total
    } else if (l.payment_method === 'Split') {
      const fiat = toNum(l.fiat_amount)
      acc.bank += fiat
      acc.crypto += Math.max(total - fiat, 0)
    } else {
      acc.bank += total
    }
    const cur = l.currency || 'EUR'
    acc.currency[cur] = (acc.currency[cur] || 0) + total
    return acc
  }, { employees: 0, basePayroll: 0, bonuses: 0, taxReimbursements: 0, totalPayout: 0, bank: 0, crypto: 0, currency: {} })

  const hasChanges = (line) => {
    const edit = edits[line.id]
    if (!edit) return false
    return Object.keys(edit).some((k) => String(edit[k] ?? '') !== String(line[k] ?? ''))
  }

  const missingComment = (line) => {
    const edit = edits[line.id]
    if (!edit) return false
    return COMMENT_FIELDS.some(
      ([field, commentField]) =>
        edit[field] !== undefined &&
        String(edit[field]) !== String(line[field] ?? '') &&
        !edit[commentField]
    )
  }

  const saveLine = async (line) => {
    setSaving((prev) => ({ ...prev, [line.id]: true }))
    try {
      const payload = { ...line, ...edits[line.id] }
      const toSend = {}
      for (const f of ['bonus', 'bonus_comment', 'penalties', 'penalties_comment', 'adjustments', 'adjustments_comment', 'overtime_hours', 'hourly_hours', 'reimbursements', 'tax_reimbursement_type', 'tax_reimbursement_percent', 'tax_reimbursement_fixed', 'tax_reimbursement_comment']) {
        if (payload[f] !== undefined) toSend[f] = payload[f]
      }
      await api.put(`/payroll/${id}/lines/${line.id}`, toSend)
      fetchData()
    } finally {
      setSaving((prev) => ({ ...prev, [line.id]: false }))
    }
  }

  const handleFinalize = async () => {
    await api.post(`/payroll/${id}/finalize`)
    fetchData()
  }

  const handleGeneratePayments = async () => {
    await api.post(`/payroll/${id}/generate-payments`)
    fetchData()
  }

  const handleExport = async () => {
    const res = await api.get(`/payroll/${id}/export`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `payroll-${id}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const runSimulation = async () => {
    const line_overrides = {}
    Object.entries(edits).forEach(([lineId, data]) => {
      line_overrides[lineId] = data
    })
    setSimulating(true)
    try {
      const res = await api.post(`/payroll/${id}/simulate`, { line_overrides })
      setSimulation(res.data)
    } finally {
      setSimulating(false)
    }
  }

  const renderEditable = (line, field, commentField) => {
    if (!isDraft) {
      return (
        <div className="flex items-center gap-1 tabular-nums">
          {fmt(line[field])}
          {line[commentField] && (
            <span className="text-slate-400 cursor-help text-xs" title={line[commentField]}>ⓘ</span>
          )}
        </div>
      )
    }
    const val = getVal(line, field)
    const commentVal = getVal(line, commentField)
    const changed = String(val ?? '') !== String(line[field] ?? '')
    const hasComment = changed || (commentVal && String(commentVal).trim())
    return (
      <div className="space-y-1">
        <input
          type="number"
          step="0.01"
          className="input-field w-24"
          value={val ?? ''}
          onChange={(e) => updateEdit(line.id, field, e.target.value)}
        />
        {hasComment && commentField && (
          <input
            type="text"
            placeholder="Comment…"
            className="input-field w-24 text-xs"
            value={commentVal ?? ''}
            onChange={(e) => updateEdit(line.id, commentField, e.target.value)}
          />
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (!payroll) {
    return <div className="text-center py-20 text-slate-500">Payroll period not found.</div>
  }

  const hasHourly = lines.some((l) => l.salary_type === 'Hourly')

  const headers = [
    'Employee', 'Department', 'Base Salary', 'Bonus', 'Penalties',
    'Adjustments', 'Tax Reimb.', 'OT Hours', 'OT Payout', 'Reimburse.',
    ...(hasHourly ? ['Hourly Hrs'] : []),
    'Fiat', 'Crypto', 'Total',
    ...(isDraft ? [''] : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/payroll')}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-slate-900">
            {MONTHS[payroll.month - 1]} {payroll.year}
          </h1>
          <span className={STATUS_BADGE[payroll.status] || 'badge-gray'}>{payroll.status}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runSimulation} className="btn-secondary" disabled={simulating}>
            {simulating ? 'Simulating…' : 'Simulate Payroll'}
          </button>
          {isDraft && (
            <>
              <button
                onClick={async () => {
                  const line_overrides = {}
                  Object.entries(edits).forEach(([k, v]) => { line_overrides[k] = v })
                  const res = await api.post(`/payroll/${id}/simulate/export?format=csv`, { line_overrides }, { responseType: 'blob' })
                  const url = window.URL.createObjectURL(new Blob([res.data]))
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `payroll_simulation_${payroll.year}_${String(payroll.month).padStart(2, '0')}.csv`
                  a.click()
                  window.URL.revokeObjectURL(url)
                }}
                className="btn-secondary"
              >
                Export Sim. CSV
              </button>
              <button
                onClick={async () => {
                  const line_overrides = {}
                  Object.entries(edits).forEach(([k, v]) => { line_overrides[k] = v })
                  const res = await api.post(`/payroll/${id}/simulate/export?format=pdf`, { line_overrides }, { responseType: 'blob' })
                  const url = window.URL.createObjectURL(new Blob([res.data]))
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `payroll_simulation_${payroll.year}_${String(payroll.month).padStart(2, '0')}.pdf`
                  a.click()
                  window.URL.revokeObjectURL(url)
                }}
                className="btn-secondary"
              >
                Export Sim. PDF
              </button>
            </>
          )}
          {isDraft && (
            <button onClick={handleFinalize} className="btn-primary">Finalize</button>
          )}
          {payroll.status === 'Finalized' && (
            <button onClick={handleGeneratePayments} className="btn-success">Generate Payments</button>
          )}
          <button onClick={handleExport} className="btn-secondary">Export CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Payout', value: fmt(payroll.total_payout) },
          { label: 'Total Fiat', value: fmt(payroll.total_fiat) },
          { label: 'Total Crypto', value: fmt(payroll.total_crypto) },
          { label: 'Employees', value: payroll.employee_count },
        ].map((c) => (
          <div key={c.label} className="card p-5">
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">Payroll Preview Panel</h2>
          <span className="text-xs text-slate-500">Real-time (not persisted)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
          <div><p className="text-slate-500">Employees</p><p className="font-semibold">{preview.employees}</p></div>
          <div><p className="text-slate-500">Base payroll</p><p className="font-semibold">{fmt(preview.basePayroll)}</p></div>
          <div><p className="text-slate-500">Bonuses</p><p className="font-semibold">{fmt(preview.bonuses)}</p></div>
          <div><p className="text-slate-500">Tax reimbursements</p><p className="font-semibold">{fmt(preview.taxReimbursements)}</p></div>
          <div><p className="text-slate-500">Bank payouts</p><p className="font-semibold">{fmt(preview.bank)}</p></div>
          <div><p className="text-slate-500">Crypto payouts</p><p className="font-semibold">{fmt(preview.crypto)}</p></div>
        </div>
        <div className="mt-3 text-sm">
          <p className="text-slate-500">Total payout</p>
          <p className="text-xl font-bold text-slate-900">{fmt(preview.totalPayout)}</p>
        </div>
        {Object.keys(preview.currency).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(preview.currency).map(([cur, amt]) => (
              <span key={cur} className="badge-gray">{cur}: {fmt(amt)}</span>
            ))}
          </div>
        )}
        {simulation && (
          <div className="mt-4 pt-4 border-t border-slate-200 text-sm">
            <p className="font-semibold text-slate-800 mb-1">Simulation Snapshot</p>
            <p className="text-slate-600">
              Employees: {simulation.employees} | Base payroll: {fmt(simulation.base_payroll)} | Bonuses: {fmt(simulation.bonuses)} | Tax reimbursements: {fmt(simulation.tax_reimbursements)} | Total payout: {fmt(simulation.total_payout)}
            </p>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {headers.map((h, i) => (
                  <th key={i} className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 whitespace-nowrap">{line.employee_name}</div>
                    <div className="text-xs text-slate-500">{line.employee_eid || line.employee_id}</div>
                    {line.pending_requests?.map((req, i) => (
                      <span key={i} className="badge-yellow text-[10px] mt-1 mr-1 inline-block">
                        pending – {req.request_type}{req.amount ? ` (${req.amount})` : ''}
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{line.department}</td>
                  <td className="px-4 py-3 tabular-nums">{fmt(line.base_salary)}</td>
                  <td className="px-4 py-3">{renderEditable(line, 'bonus', 'bonus_comment')}</td>
                  <td className="px-4 py-3">{renderEditable(line, 'penalties', 'penalties_comment')}</td>
                  <td className="px-4 py-3">{renderEditable(line, 'adjustments', 'adjustments_comment')}</td>
                  <td className="px-4 py-3">
                    {isDraft ? (
                      <div className="space-y-1">
                        <select
                          className="select-field w-24 !py-1 !text-xs"
                          value={getVal(line, 'tax_reimbursement_type') || ''}
                          onChange={(e) => updateEdit(line.id, 'tax_reimbursement_type', e.target.value || null)}
                        >
                          <option value="">None</option>
                          <option value="percent">%</option>
                          <option value="fixed">Fixed</option>
                        </select>
                        {(getVal(line, 'tax_reimbursement_type') || '') === 'percent' && (
                          <input
                            type="number"
                            step="0.01"
                            className="input-field w-24"
                            placeholder="%"
                            value={getVal(line, 'tax_reimbursement_percent') ?? ''}
                            onChange={(e) => updateEdit(line.id, 'tax_reimbursement_percent', e.target.value)}
                          />
                        )}
                        {(getVal(line, 'tax_reimbursement_type') || '') === 'fixed' && (
                          <input
                            type="number"
                            step="0.01"
                            className="input-field w-24"
                            placeholder="Amount"
                            value={getVal(line, 'tax_reimbursement_fixed') ?? ''}
                            onChange={(e) => updateEdit(line.id, 'tax_reimbursement_fixed', e.target.value)}
                          />
                        )}
                      </div>
                    ) : (
                      <span className="tabular-nums">{fmt(line.tax_reimbursement_amount)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isDraft ? (
                      <input
                        type="number"
                        step="0.5"
                        className="input-field w-20"
                        value={getVal(line, 'overtime_hours') ?? ''}
                        onChange={(e) => updateEdit(line.id, 'overtime_hours', e.target.value)}
                      />
                    ) : (
                      <span className="tabular-nums">{line.overtime_hours ?? 0}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{fmt(line.overtime_payout)}</td>
                  <td className="px-4 py-3 tabular-nums">{fmt(line.reimbursements)}</td>
                  {hasHourly && (
                    <td className="px-4 py-3">
                      {line.salary_type === 'Hourly' ? (
                        isDraft ? (
                          <input
                            type="number"
                            step="0.5"
                            className="input-field w-20"
                            value={getVal(line, 'hourly_hours') ?? ''}
                            onChange={(e) => updateEdit(line.id, 'hourly_hours', e.target.value)}
                          />
                        ) : (
                          <span className="tabular-nums">{line.hourly_hours ?? 0}</span>
                        )
                      ) : (
                        <span className="text-slate-300">–</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 tabular-nums">{fmt(line.fiat_amount)}</td>
                  <td className="px-4 py-3 tabular-nums">{fmt(line.crypto_amount)}</td>
                  <td className="px-4 py-3 font-medium tabular-nums">{fmt(line.total_payout)}</td>
                  {isDraft && (
                    <td className="px-4 py-3">
                      {hasChanges(line) && (
                        <button
                          onClick={() => saveLine(line)}
                          disabled={saving[line.id] || missingComment(line)}
                          className="btn-primary text-xs !px-2 !py-1"
                        >
                          {saving[line.id] ? 'Saving…' : 'Save'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
