import { useMemo, useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

const CARD = 'bg-white rounded-xl border border-slate-200 shadow-sm p-6'
const STATUS_BADGE = { Open: 'badge-yellow', Approved: 'badge-green', Rejected: 'badge-red', Completed: 'badge-blue', Pending: 'badge-yellow', Paid: 'badge-green', Failed: 'badge-red' }

const fmt = (v) =>
  Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const truncate = (str, start = 6, end = 4) => {
  if (!str) return '–'
  if (str.length <= start + end + 2) return str
  return `${str.slice(0, start)}…${str.slice(-end)}`
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value || '–'}</span>
    </div>
  )
}

export default function EmployeePortal() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const linkedEmployeeId = user?.employee_id
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null)
  const [employees, setEmployees] = useState([])
  const [employeesLoading, setEmployeesLoading] = useState(false)
  const employee_id = linkedEmployeeId || selectedEmployeeId

  const [employee, setEmployee] = useState(null)
  const [payments, setPayments] = useState([])
  const [invoices, setInvoices] = useState([])
  const [requests, setRequests] = useState([])
  const [compensationHistory, setCompensationHistory] = useState([])
  const [payoutHistory, setPayoutHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [tab, setTab] = useState('Dashboard')
  const [showReimbursement, setShowReimbursement] = useState(false)
  const [form, setForm] = useState({ description: '', amount: '', currency: 'EUR', comment: '' })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileForm, setProfileForm] = useState({
    email: '',
    country: '',
    telegram: '',
    slack: '',
    bank_name: '',
    account_holder: '',
    iban: '',
    swift: '',
    wallet_address: '',
    wallet_network: 'TRON',
    wallet_coin: 'USDT',
  })

  useEffect(() => {
    if (isAdmin) {
      setEmployeesLoading(true)
      api.get('/employees').then((r) => {
        setEmployees(r.data)
        if (r.data.length > 0 && !selectedEmployeeId) {
          setSelectedEmployeeId(r.data[0].id)
        }
      }).finally(() => setEmployeesLoading(false))
    }
  }, [isAdmin])

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7831/ingest/60e562ca-81b6-4eb3-b1be-07f4d1f0837b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'64ced1'},body:JSON.stringify({sessionId:'64ced1',location:'EmployeePortal.jsx:useEffect',message:'Portal load start',data:{employee_id,isAdmin,linkedEmployeeId:user?.employee_id,selectedEmployeeId},hypothesisId:'H1',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!employee_id) { setLoading(false); setEmployee(null); setLoadError(null); return }
    setLoading(true)
    setLoadError(null)

    const applyData = (empData, pay, inv, req, comp, payout) => {
      setEmployee(empData)
      setPayments(Array.isArray(pay) ? pay : [])
      setInvoices(Array.isArray(inv) ? inv : [])
      setRequests(Array.isArray(req) ? req : [])
      setCompensationHistory(Array.isArray(comp) ? comp : [])
      setPayoutHistory(Array.isArray(payout) ? payout : [])
      setProfileForm((f) => ({
        ...f,
        email: empData?.email || '',
        country: empData?.country || '',
        telegram: empData?.telegram || '',
        slack: empData?.slack || '',
        bank_name: empData?.bank_name || '',
        account_holder: empData?.account_holder || '',
        iban: empData?.iban || '',
        swift: empData?.swift || '',
        wallet_address: empData?.wallet_address || '',
        wallet_network: empData?.wallet_network || 'TRON',
        wallet_coin: empData?.wallet_coin || 'USDT',
      }))
    }

    const load = () => {
      const url = isAdmin ? `/employees/${employee_id}/portal-data` : '/employees/me/portal-data'
      // #region agent log
      fetch('http://127.0.0.1:7831/ingest/60e562ca-81b6-4eb3-b1be-07f4d1f0837b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'64ced1'},body:JSON.stringify({sessionId:'64ced1',location:'EmployeePortal.jsx:load',message:'Requesting portal-data',data:{url,fullUrl:`/api${url}`},hypothesisId:'H3',timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return api.get(url).then((r) => {
        const d = r.data
        if (d?.employee) {
          applyData(d.employee, d.payments, d.invoices, d.requests, d.compensation_history, d.payout_history)
        }
      })
    }

    const loadFallback = () => {
      const empPromise = isAdmin ? api.get(`/employees/${employee_id}`) : api.get('/employees/me/profile')
      const promises = [
        empPromise,
        api.get('/payments', { params: { employee_id } }),
        api.get('/invoices', { params: { employee_id } }),
        api.get('/requests', { params: { employee_id } }),
        api.get(`/employees/${employee_id}/compensation-history`),
        api.get(`/employees/${employee_id}/payout-history`),
      ]
      return Promise.allSettled(promises).then((results) => {
        const [empR, payR, invR, reqR, compR, payoutR] = results
        const emp = empR.status === 'fulfilled' ? empR.value : null
        if (!emp?.data) throw empR.reason || new Error('Employee fetch failed')
        const empData = emp.data
        const pay = payR.status === 'fulfilled' ? payR.value.data : []
        const inv = invR.status === 'fulfilled' ? invR.value.data : []
        const req = reqR.status === 'fulfilled' ? reqR.value.data : []
        const comp = compR.status === 'fulfilled' ? compR.value.data : []
        const payout = payoutR.status === 'fulfilled' ? payoutR.value.data : []
        applyData(empData, pay, inv, req, comp, payout)
      })
    }

    load()
      .catch((err) => {
        // #region agent log
        fetch('http://127.0.0.1:7831/ingest/60e562ca-81b6-4eb3-b1be-07f4d1f0837b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'64ced1'},body:JSON.stringify({sessionId:'64ced1',location:'EmployeePortal.jsx:load.catch',message:'portal-data failed',data:{status:err?.response?.status,url:err?.config?.url,errMsg:err?.message},hypothesisId:'H2',timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (err.response?.status === 404) {
          return loadFallback()
        }
        setEmployee(null)
        setLoadError(err.response?.data?.error || err.message || 'Failed to load employee data')
      })
      .catch((fallbackErr) => {
        // #region agent log
        fetch('http://127.0.0.1:7831/ingest/60e562ca-81b6-4eb3-b1be-07f4d1f0837b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'64ced1'},body:JSON.stringify({sessionId:'64ced1',location:'EmployeePortal.jsx:fallback.catch',message:'fallback failed',data:{status:fallbackErr?.response?.status,url:fallbackErr?.config?.url},hypothesisId:'H2',timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        setEmployee(null)
        setLoadError(fallbackErr.response?.data?.error || fallbackErr.message || 'Failed to load employee data')
      })
      .finally(() => setLoading(false))
  }, [employee_id, isAdmin])

  const compChart = useMemo(() => compensationHistory.map((x) => ({
    date: x.effective_date,
    salary: Number(x.base_salary || 0),
    label: x.effective_date,
  })), [compensationHistory])

  const submitReimbursement = async () => {
    if (!form.description || !form.amount) return
    setSaving(true)
    try {
      const payload = {
        title: form.description,
        employee_id,
        description: form.description,
        request_type: 'Reimbursement',
        amount: Number(form.amount),
        currency: form.currency,
        comment: form.comment,
      }
      const res = await api.post('/requests', payload)
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        await api.post(`/requests/${res.data.id}/upload-attachment`, fd)
      }
      setShowReimbursement(false)
      setForm({ description: '', amount: '', currency: 'EUR', comment: '' })
      setFile(null)
      const updated = await api.get('/requests', { params: { employee_id } })
      setRequests(updated.data)
    } finally {
      setSaving(false)
    }
  }

  const saveProfile = async () => {
    setProfileSaving(true)
    try {
      const res = isAdmin
        ? await api.put(`/employees/${employee_id}`, profileForm)
        : await api.put('/employees/me/profile', profileForm)
      setEmployee(res.data)
      const payoutRes = await api.get(`/employees/${employee_id}/payout-history`)
      setPayoutHistory(payoutRes.data || [])
    } finally {
      setProfileSaving(false)
    }
  }

  if (!isAdmin && !linkedEmployeeId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">No Employee Profile Linked</h2>
        <p className="text-sm text-slate-500">Contact your administrator to link your account to an employee profile.</p>
      </div>
    )
  }

  if (isAdmin && employeesLoading && employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4" />
        <p className="text-slate-500">Loading employees…</p>
      </div>
    )
  }

  if (isAdmin && !employeesLoading && employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-slate-500">No employees found.</p>
      </div>
    )
  }

  if (loading) return <Spinner />

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-red-600 mb-2">Error loading data</p>
        <p className="text-sm text-slate-500">{loadError}</p>
      </div>
    )
  }

  const tabs = ['Dashboard', 'Salary & Analytics', 'Compensation', 'Payment history', 'Settings']

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{isAdmin ? 'Employee Portal' : 'My Portal'}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {isAdmin ? 'View employee profiles and data' : 'Your employee self-service dashboard'}
          </p>
        </div>
        {isAdmin && employees.length > 0 && (
          <select
            value={selectedEmployeeId || ''}
            onChange={(e) => setSelectedEmployeeId(Number(e.target.value))}
            className="select-field w-64"
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name} {emp.employee_id ? `(${emp.employee_id})` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="border-b border-slate-200">
        <div className="flex gap-6 -mb-px">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 ${
                tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'Dashboard' && (
      <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={CARD}>
          <h3 className="text-base font-semibold text-slate-900 mb-4">My Profile</h3>
          <InfoRow label="Name" value={employee?.full_name || employee?.name} />
          <InfoRow label="Email" value={employee?.email} />
          <InfoRow label="Department" value={employee?.department} />
          <InfoRow label="Job Title" value={employee?.job_title} />
          <InfoRow label="Manager" value={employee?.manager} />
          <InfoRow label="Start Date" value={employee?.start_date ? new Date(employee.start_date).toLocaleDateString() : null} />
          <InfoRow label="Status" value={employee?.status && <span className={employee.status === 'Active' ? 'badge-green' : 'badge-gray'}>{employee.status}</span>} />
        </div>

        <div className="space-y-6">
          <div className={CARD}>
            <h3 className="text-base font-semibold text-slate-900 mb-4">Salary Information</h3>
            <InfoRow label="Base Salary" value={employee?.base_salary != null ? `${fmt(employee.base_salary)} ${employee.currency || ''}` : null} />
            <InfoRow label="Currency" value={employee?.currency} />
            <InfoRow label="Payment Method" value={employee?.payment_method} />
            <InfoRow label="Effective Salary" value={employee?.effective_salary != null ? `${fmt(employee.effective_salary)} ${employee.currency || ''}` : null} />
          </div>

          <div className={CARD}>
            <h3 className="text-base font-semibold text-slate-900 mb-3">Next Payment</h3>
            <p className="text-sm text-slate-600">Payment usually processed by the 10th of each month.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">Payment History</h3>
        </div>
        {payments.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">No payments yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Date', 'Amount', 'Currency', 'Type', 'Status', 'TX Hash'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '–'}</td>
                    <td className="px-4 py-3 tabular-nums font-medium text-slate-900">{fmt(p.amount)}</td>
                    <td className="px-4 py-3 text-slate-600">{p.currency}</td>
                    <td className="px-4 py-3 text-slate-600">{p.payment_type}</td>
                    <td className="px-4 py-3"><span className={STATUS_BADGE[p.status] || 'badge-gray'}>{p.status}</span></td>
                    <td className="px-4 py-3">
                      {p.tx_hash ? (
                        <a href={p.explorer_url || '#'} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800" title={p.tx_hash}>
                          {truncate(p.tx_hash)}
                        </a>
                      ) : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">My Invoices</h3>
        </div>
        {invoices.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">No invoices yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Invoice #', 'Date', 'Amount', 'Currency', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{inv.invoice_number || inv.id}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{inv.date ? new Date(inv.date).toLocaleDateString() : '–'}</td>
                    <td className="px-4 py-3 tabular-nums font-medium text-slate-900">{fmt(inv.amount)}</td>
                    <td className="px-4 py-3 text-slate-600">{inv.currency}</td>
                    <td className="px-4 py-3"><span className={STATUS_BADGE[inv.status] || 'badge-gray'}>{inv.status}</span></td>
                    <td className="px-4 py-3">
                      <button
                        onClick={async () => {
                          const res = await api.get(`/invoices/${inv.id}/download-pdf`, { responseType: 'blob' })
                          const url = window.URL.createObjectURL(new Blob([res.data]))
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `${inv.invoice_number || inv.id}.pdf`
                          a.click()
                          window.URL.revokeObjectURL(url)
                        }}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium hover:underline"
                      >
                        Download PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">My Reimbursement Requests</h3>
          <button onClick={() => setShowReimbursement(true)} className="btn-primary">New Reimbursement</button>
        </div>
        {requests.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">No requests yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Title', 'Type', 'Amount', 'Status', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{r.title}</td>
                    <td className="px-4 py-3 text-slate-600">{r.request_type}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-900">{r.amount != null ? `${fmt(r.amount)} ${r.currency || ''}` : '–'}</td>
                    <td className="px-4 py-3"><span className={STATUS_BADGE[r.status] || 'badge-gray'}>{r.status}</span></td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{r.date_created ? new Date(r.date_created).toLocaleDateString() : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={CARD}>
        <h3 className="text-base font-semibold text-slate-900 mb-4">Salary History</h3>
        {employee?.base_salary != null ? (
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-900">
                {fmt(employee.base_salary)} {employee.currency || ''}
              </p>
              <p className="text-xs text-slate-500">
                Current salary · Effective {employee.start_date ? new Date(employee.start_date).toLocaleDateString() : 'since start'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No salary information available.</p>
        )}
      </div>
      </>
      )}

      {tab === 'Salary & Analytics' && (
        <div className="space-y-6">
          <div className={CARD}>
            <h3 className="text-base font-semibold text-slate-900 mb-4">Salary Overview</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-slate-500">Current Base Salary</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{fmt(employee?.base_salary)} {employee?.currency || ''}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Effective Salary</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{fmt(employee?.effective_salary)} {employee?.currency || ''}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Payments (YTD)</p>
                <p className="text-xl font-bold text-slate-900 mt-1">
                  {fmt(payments.filter((p) => {
                    const d = p.payment_date || p.created_at
                    return d && new Date(d).getFullYear() === new Date().getFullYear()
                  }).reduce((s, p) => s + (p.amount || 0), 0))} {employee?.currency || ''}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Payment Method</p>
                <p className="text-lg font-medium text-slate-900 mt-1">{employee?.payment_method || 'Fiat'}</p>
              </div>
            </div>
          </div>
          <div className={CARD}>
            <h3 className="text-base font-semibold text-slate-900 mb-4">Compensation Timeline</h3>
            {compChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={compChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Line type="monotone" dataKey="salary" stroke="#4f46e5" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500">No compensation history yet.</p>
            )}
          </div>
          <div className={CARD}>
            <h3 className="text-base font-semibold text-slate-900 mb-4">Payments Over Time</h3>
            {payments.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={payments.slice().reverse().map((p) => ({
                  label: p.payment_date?.slice(0, 7) || p.created_at?.slice(0, 7) || '–',
                  amount: Number(p.amount || 0),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500">No payments yet.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'Compensation' && (
        <div className="space-y-6">
          <div className={CARD}>
            <h3 className="text-base font-semibold text-slate-900 mb-4">Compensation History</h3>
            {compensationHistory.length === 0 ? (
              <p className="text-sm text-slate-500">No compensation history yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Effective Date</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Base Salary</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Currency</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compensationHistory.map((c) => (
                      <tr key={c.id} className="border-b border-slate-100">
                        <td className="px-4 py-3">{c.effective_date}</td>
                        <td className="px-4 py-3">{fmt(c.base_salary)}</td>
                        <td className="px-4 py-3">{c.currency}</td>
                        <td className="px-4 py-3">{c.note || '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className={CARD}>
            <h3 className="text-base font-semibold text-slate-900 mb-4">Compensation Timeline</h3>
            {compChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={compChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Line type="monotone" dataKey="salary" stroke="#4f46e5" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500">No chart data.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'Payment history' && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Payment History</h3>
            </div>
            {payments.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">No payments yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {['Period', 'Base', 'Bonus', 'Tax Reimb.', 'Total', 'Method', 'Date', 'Status'].map((h) => (
                        <th key={h} className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b border-slate-100">
                        <td className="px-4 py-3">{p.payroll_period_label || '–'}</td>
                        <td className="px-4 py-3">{p.base_salary != null ? fmt(p.base_salary) : '–'}</td>
                        <td className="px-4 py-3">{p.bonus != null ? fmt(p.bonus) : '–'}</td>
                        <td className="px-4 py-3">{p.tax_reimbursement_amount != null ? fmt(p.tax_reimbursement_amount) : '–'}</td>
                        <td className="px-4 py-3 font-medium">{p.total_payout != null ? fmt(p.total_payout) : fmt(p.amount)}</td>
                        <td className="px-4 py-3">{p.payment_type === 'Crypto' ? 'Crypto' : 'Bank'}</td>
                        <td className="px-4 py-3">{p.payment_date || '–'}</td>
                        <td className="px-4 py-3"><span className={STATUS_BADGE[p.status] || 'badge-gray'}>{p.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'Settings' && (
        <div className="space-y-6">
        <div className={CARD}>
          <h3 className="text-base font-semibold text-slate-900 mb-4">Payout and Contact Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input className="input-field" value={profileForm.email} onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
              <input className="input-field" value={profileForm.country} onChange={(e) => setProfileForm((f) => ({ ...f, country: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telegram</label>
              <input className="input-field" value={profileForm.telegram} onChange={(e) => setProfileForm((f) => ({ ...f, telegram: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Slack</label>
              <input className="input-field" value={profileForm.slack} onChange={(e) => setProfileForm((f) => ({ ...f, slack: e.target.value }))} />
            </div>
          </div>
          <h4 className="text-sm font-semibold text-slate-800 mt-6 mb-3">Bank Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input className="input-field" placeholder="Bank name" value={profileForm.bank_name} onChange={(e) => setProfileForm((f) => ({ ...f, bank_name: e.target.value }))} />
            <input className="input-field" placeholder="Account holder" value={profileForm.account_holder} onChange={(e) => setProfileForm((f) => ({ ...f, account_holder: e.target.value }))} />
            <input className="input-field" placeholder="IBAN" value={profileForm.iban} onChange={(e) => setProfileForm((f) => ({ ...f, iban: e.target.value }))} />
            <input className="input-field" placeholder="SWIFT" value={profileForm.swift} onChange={(e) => setProfileForm((f) => ({ ...f, swift: e.target.value }))} />
          </div>
          <h4 className="text-sm font-semibold text-slate-800 mt-6 mb-3">Crypto Wallet</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input className="input-field md:col-span-2" placeholder="Wallet address" value={profileForm.wallet_address} onChange={(e) => setProfileForm((f) => ({ ...f, wallet_address: e.target.value }))} />
            <select className="select-field" value={profileForm.wallet_network} onChange={(e) => setProfileForm((f) => ({ ...f, wallet_network: e.target.value }))}>
              <option value="TRON">TRON</option>
              <option value="ERC20">ERC20</option>
            </select>
          </div>
          <div className="mt-4">
            <button className="btn-primary" onClick={saveProfile} disabled={profileSaving}>
              {profileSaving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>

        <div className={CARD}>
          <h3 className="text-base font-semibold text-slate-900 mb-4">Payout history</h3>
          {payoutHistory.length === 0 ? (
            <p className="text-sm text-slate-500">No payout changes recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {payoutHistory.map((log) => (
                <div key={log.id} className="text-sm py-2 border-b border-slate-100 last:border-0">
                  <p className="font-medium text-slate-800 capitalize">{log.field_changed.replace(/_/g, ' ')} changed</p>
                  <p className="text-slate-600">
                    Old: <span className="font-mono text-xs">{log.old_value ? (log.old_value.length > 20 ? `${log.old_value.slice(0, 10)}…` : log.old_value) : '–'}</span>
                    {' → '}
                    New: <span className="font-mono text-xs">{log.new_value ? (log.new_value.length > 20 ? `${log.new_value.slice(0, 10)}…` : log.new_value) : '–'}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Changed by: {log.changed_by} · {log.timestamp ? new Date(log.timestamp).toLocaleDateString() : ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      )}

      {showReimbursement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-5">New Reimbursement Request</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="input-field"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                  <input
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    className="input-field"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Comment</label>
                <textarea
                  value={form.comment}
                  onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                  className="input-field"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Attachment</label>
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setShowReimbursement(false); setForm({ description: '', amount: '', currency: 'EUR', comment: '' }); setFile(null) }} className="btn-secondary">Cancel</button>
              <button onClick={submitReimbursement} disabled={saving} className="btn-primary">
                {saving ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
