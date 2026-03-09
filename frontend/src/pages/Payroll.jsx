import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const STATUS_BADGE = { Draft: 'badge-gray', Finalized: 'badge-blue', Paid: 'badge-green' }

const fmt = (v) =>
  Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Payroll() {
  const navigate = useNavigate()
  const [payrolls, setPayrolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const fetchPayrolls = () => {
    setLoading(true)
    api.get('/payroll/').then((res) => setPayrolls(res.data)).finally(() => setLoading(false))
  }

  useEffect(() => { fetchPayrolls() }, [])

  const handleCreate = async () => {
    setCreating(true)
    try {
      await api.post('/payroll', { month, year })
      setShowModal(false)
      fetchPayrolls()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Payroll</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary">Create Payroll</button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : payrolls.length === 0 ? (
          <div className="text-center py-16 text-slate-500">No payroll periods found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Period', 'Status', 'Employees', 'Total Payout', 'Total Fiat', 'Total Crypto', 'Created'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payrolls.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/payroll/${p.id}`)}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {MONTHS[p.month - 1]} {p.year}
                    </td>
                    <td className="px-4 py-3">
                      <span className={STATUS_BADGE[p.status] || 'badge-gray'}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 tabular-nums">{p.employee_count}</td>
                    <td className="px-4 py-3 text-slate-900 tabular-nums">{fmt(p.total_payout)}</td>
                    <td className="px-4 py-3 text-slate-600 tabular-nums">{fmt(p.total_fiat)}</td>
                    <td className="px-4 py-3 text-slate-600 tabular-nums">{fmt(p.total_crypto)}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Create Payroll Period</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Month</label>
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="select-field">
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
                <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="select-field">
                  {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleCreate} disabled={creating} className="btn-primary">
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
