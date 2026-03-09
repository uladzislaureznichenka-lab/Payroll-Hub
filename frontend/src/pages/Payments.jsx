import { useState, useEffect } from 'react'
import api from '../api'

const STATUS_BADGE = { Pending: 'badge-yellow', Paid: 'badge-green', Failed: 'badge-red' }
const TYPE_BADGE = { Fiat: 'badge-blue', Crypto: 'badge-yellow' }

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const fmt = (v) =>
  Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const truncate = (str, start = 6, end = 4) => {
  if (!str) return '–'
  if (str.length <= start + end + 2) return str
  return `${str.slice(0, start)}…${str.slice(-end)}`
}

export default function Payments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)

  const now = new Date()
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    payment_type: '',
    currency: '',
    month: '',
    year: '',
  })

  const update = (key, value) => setFilters((f) => ({ ...f, [key]: value }))

  const fetchPayments = () => {
    setLoading(true)
    const params = {}
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v })
    api.get('/payments', { params }).then((res) => setPayments(res.data)).finally(() => setLoading(false))
  }

  useEffect(() => { fetchPayments() }, [filters])

  const handleExport = async (format) => {
    const params = {}
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v })
    const res = await api.get(`/payments/export-${format}`, { params, responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `payments.${format === 'excel' ? 'xlsx' : 'csv'}`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const openEdit = (payment) => {
    setEditModal(payment)
    setEditForm({
      status: payment.status,
      tx_hash: payment.tx_hash || '',
      payment_date: payment.payment_date || '',
      comment: '',
    })
  }

  const saveEdit = async () => {
    setSavingEdit(true)
    try {
      await api.put(`/payments/${editModal.id}`, editForm)
      setEditModal(null)
      fetchPayments()
    } finally {
      setSavingEdit(false)
    }
  }

  const markAsPaid = async (payment) => {
    await api.put(`/payments/${payment.id}`, { status: 'Paid' })
    fetchPayments()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('csv')} className="btn-secondary">Export CSV</button>
          <button onClick={() => handleExport('excel')} className="btn-secondary">Export Excel</button>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search employee…"
            value={filters.search}
            onChange={(e) => update('search', e.target.value)}
            className="input-field max-w-xs"
          />
          <select value={filters.status} onChange={(e) => update('status', e.target.value)} className="select-field w-36">
            <option value="">All Statuses</option>
            {['Pending', 'Paid', 'Failed'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.payment_type} onChange={(e) => update('payment_type', e.target.value)} className="select-field w-36">
            <option value="">All Types</option>
            {['Fiat', 'Crypto'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            type="text"
            placeholder="Currency"
            value={filters.currency}
            onChange={(e) => update('currency', e.target.value)}
            className="input-field w-28"
          />
          <select value={filters.month} onChange={(e) => update('month', e.target.value)} className="select-field w-36">
            <option value="">All Months</option>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={filters.year} onChange={(e) => update('year', e.target.value)} className="select-field w-28">
            <option value="">Year</option>
            {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16 text-slate-500">No payments found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Employee', 'Amount', 'Currency', 'Type', 'Status', 'Date', 'Reference', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{p.employee_name}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-900">{fmt(p.amount)}</td>
                    <td className="px-4 py-3 text-slate-600">{p.currency}</td>
                    <td className="px-4 py-3">
                      <span className={TYPE_BADGE[p.payment_type] || 'badge-gray'}>{p.payment_type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={STATUS_BADGE[p.status] || 'badge-gray'}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '–'}
                    </td>
                    <td className="px-4 py-3">
                      {p.payment_type === 'Crypto' ? (
                        <div className="space-y-0.5">
                          <div className="text-xs text-slate-500">
                            {p.network} · {p.coin}
                          </div>
                          <div className="text-xs text-slate-500" title={p.wallet_address}>
                            {truncate(p.wallet_address)}
                          </div>
                          {p.tx_hash && (
                            <a
                              href={p.explorer_url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-600 hover:text-indigo-800"
                              title={p.tx_hash}
                            >
                              {truncate(p.tx_hash)}
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="text-xs text-slate-500">{p.bank_name}</div>
                          <div className="text-xs text-slate-500" title={p.iban}>
                            {truncate(p.iban, 4, 4)}
                          </div>
                          <div className="text-xs text-slate-500">{p.account_holder}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(p)} className="btn-secondary text-xs !px-2 !py-1">
                          Edit
                        </button>
                        {p.status === 'Pending' && (
                          <button onClick={() => markAsPaid(p)} className="btn-success text-xs !px-2 !py-1">
                            Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Edit Payment</h2>
            <p className="text-sm text-slate-500 mb-5">
              {editModal.employee_name} · {fmt(editModal.amount)} {editModal.currency}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                  className="select-field"
                >
                  {['Pending', 'Paid', 'Failed'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {editModal.payment_type === 'Crypto' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">TX Hash</label>
                  <input
                    type="text"
                    value={editForm.tx_hash}
                    onChange={(e) => setEditForm((f) => ({ ...f, tx_hash: e.target.value }))}
                    className="input-field"
                    placeholder="0x…"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={editForm.payment_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, payment_date: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Comment</label>
                <textarea
                  value={editForm.comment}
                  onChange={(e) => setEditForm((f) => ({ ...f, comment: e.target.value }))}
                  className="input-field"
                  rows={3}
                  placeholder="Optional note…"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={saveEdit} disabled={savingEdit} className="btn-primary">
                {savingEdit ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
