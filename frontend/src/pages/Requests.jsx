import { useState, useEffect, useCallback } from 'react'
import api from '../api'

const STATUS_OPTIONS = ['Open', 'Approved', 'Rejected', 'Completed']
const TYPE_OPTIONS = ['Bonus', 'Salary Adjustment', 'Penalty', 'Reimbursement', 'Other']
const STATUS_BADGE = { Open: 'badge-yellow', Approved: 'badge-green', Rejected: 'badge-red', Completed: 'badge-blue' }
const TYPE_BADGE = { Bonus: 'badge-green', 'Salary Adjustment': 'badge-blue', Penalty: 'badge-red', Reimbursement: 'badge-yellow', Other: 'badge-gray' }

const fmt = (v) =>
  Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Requests() {
  const [requests, setRequests] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: '', request_type: '', employee_id: '' })
  const [showCreate, setShowCreate] = useState(false)
  const [detail, setDetail] = useState(null)
  const [saving, setSaving] = useState(false)

  const blankForm = { title: '', employee_id: '', description: '', request_type: '', amount: '', currency: 'EUR', comment: '' }
  const [form, setForm] = useState(blankForm)
  const [file, setFile] = useState(null)

  const update = (key, value) => setFilters((f) => ({ ...f, [key]: value }))

  const fetchRequests = useCallback(() => {
    setLoading(true)
    const params = {}
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v })
    api.get('/requests', { params }).then((r) => setRequests(r.data)).finally(() => setLoading(false))
  }, [filters])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  useEffect(() => {
    api.get('/employees', { params: { status: 'Active' } }).then((r) => setEmployees(r.data))
  }, [])

  const create = async () => {
    if (!form.title || !form.employee_id || !form.request_type) return
    setSaving(true)
    try {
      const payload = { ...form, amount: form.amount ? Number(form.amount) : null }
      const res = await api.post('/requests', payload)
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        await api.post(`/requests/${res.data.id}/upload-attachment`, fd)
      }
      setShowCreate(false)
      setForm(blankForm)
      setFile(null)
      fetchRequests()
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (id, status) => {
    const endpoint = status === 'Approved' ? `/requests/${id}/approve`
      : status === 'Rejected' ? `/requests/${id}/reject`
      : status === 'Completed' ? `/requests/${id}/complete`
      : `/requests/${id}`
    if (endpoint.endsWith(`/${id}`)) {
      await api.put(endpoint, { status })
    } else {
      await api.put(endpoint)
    }
    setDetail((d) => d && { ...d, status })
    fetchRequests()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Requests</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary">New Request</button>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select value={filters.status} onChange={(e) => update('status', e.target.value)} className="select-field w-40">
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.request_type} onChange={(e) => update('request_type', e.target.value)} className="select-field w-48">
            <option value="">All Types</option>
            {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filters.employee_id} onChange={(e) => update('employee_id', e.target.value)} className="select-field w-48">
            <option value="">All Employees</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 text-slate-500">No requests found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Title', 'Employee', 'Type', 'Status', 'Amount', 'Currency', 'Requested By', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setDetail(r)}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{r.title}</td>
                    <td className="px-4 py-3 text-slate-600">{r.employee_name}</td>
                    <td className="px-4 py-3"><span className={TYPE_BADGE[r.request_type] || 'badge-gray'}>{r.request_type}</span></td>
                    <td className="px-4 py-3"><span className={STATUS_BADGE[r.status] || 'badge-gray'}>{r.status}</span></td>
                    <td className="px-4 py-3 tabular-nums text-slate-900">{r.amount != null ? fmt(r.amount) : '–'}</td>
                    <td className="px-4 py-3 text-slate-600">{r.currency || '–'}</td>
                    <td className="px-4 py-3 text-slate-600">{r.requested_by || '–'}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {r.date_created ? new Date(r.date_created).toLocaleDateString() : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-5">New Request</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Employee</label>
                <select
                  value={form.employee_id}
                  onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
                  className="select-field"
                >
                  <option value="">Select employee</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Request Type</label>
                <select
                  value={form.request_type}
                  onChange={(e) => setForm((f) => ({ ...f, request_type: e.target.value }))}
                  className="select-field"
                >
                  <option value="">Select type</option>
                  {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
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
              <button onClick={() => { setShowCreate(false); setForm(blankForm); setFile(null) }} className="btn-secondary">Cancel</button>
              <button onClick={create} disabled={saving} className="btn-primary">
                {saving ? 'Creating…' : 'Create Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{detail.title}</h2>
                <span className={`mt-1 inline-block ${STATUS_BADGE[detail.status] || 'badge-gray'}`}>{detail.status}</span>
              </div>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mb-6">
              <div>
                <dt className="text-slate-500">Employee</dt>
                <dd className="font-medium text-slate-900">{detail.employee_name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Type</dt>
                <dd><span className={TYPE_BADGE[detail.request_type] || 'badge-gray'}>{detail.request_type}</span></dd>
              </div>
              <div>
                <dt className="text-slate-500">Amount</dt>
                <dd className="font-medium text-slate-900">{detail.amount != null ? `${fmt(detail.amount)} ${detail.currency || ''}` : '–'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Requested By</dt>
                <dd className="font-medium text-slate-900">{detail.requested_by || '–'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Created</dt>
                <dd className="font-medium text-slate-900">{detail.date_created ? new Date(detail.date_created).toLocaleDateString() : '–'}</dd>
              </div>
            </dl>

            {detail.description && (
              <div className="mb-4">
                <p className="text-sm text-slate-500 mb-1">Description</p>
                <p className="text-sm text-slate-800 bg-slate-50 rounded-lg p-3">{detail.description}</p>
              </div>
            )}

            {detail.comment && (
              <div className="mb-4">
                <p className="text-sm text-slate-500 mb-1">Comment</p>
                <p className="text-sm text-slate-800 bg-slate-50 rounded-lg p-3">{detail.comment}</p>
              </div>
            )}

            {detail.has_attachment && (
              <div className="mb-6">
                <a
                  href={`/api/requests/${detail.id}/download-attachment`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Attachment
                </a>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              {detail.status === 'Open' && (
                <>
                  <button onClick={() => updateStatus(detail.id, 'Approved')} className="btn-primary bg-emerald-600 hover:bg-emerald-700">Approve</button>
                  <button onClick={() => updateStatus(detail.id, 'Rejected')} className="btn-primary bg-red-600 hover:bg-red-700">Reject</button>
                </>
              )}
              {detail.status === 'Approved' && (
                <button onClick={() => updateStatus(detail.id, 'Completed')} className="btn-primary">Complete</button>
              )}
              <button onClick={() => setDetail(null)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
