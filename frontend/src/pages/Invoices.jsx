import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import api from '../api'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const fmt = (v) =>
  Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const EMPTY_INVOICE = {
  employee_id: '',
  legal_entity_id: '',
  period_month: '',
  period_year: '',
  amount: '',
  currency: 'EUR',
  description: '',
}

const EMPTY_TEMPLATE = {
  name: '',
  header: '',
  company_name: '',
  company_details: '',
  payment_instructions: '',
}

export default function Invoices() {
  const fileRefs = useRef({})
  const [invoices, setInvoices] = useState([])
  const [employees, setEmployees] = useState([])
  const [payrolls, setPayrolls] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)

  const [legalEntities, setLegalEntities] = useState([])
  const [showGenerate, setShowGenerate] = useState(false)
  const [generatePayrollId, setGeneratePayrollId] = useState('')
  const [generating, setGenerating] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_INVOICE)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [showTemplates, setShowTemplates] = useState(false)
  const [templateForm, setTemplateForm] = useState(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)

  const now = new Date()
  const [filters, setFilters] = useState({ search: '', legal_entity: '', period: '', employee_id: '' })
  const update = (key, value) => setFilters((f) => ({ ...f, [key]: value }))

  const fetchInvoices = () => {
    setLoading(true)
    const params = {}
    if (filters.legal_entity) params.legal_entity_id = filters.legal_entity
    if (filters.period) {
      const [y, m] = filters.period.split('-')
      if (y) params.period_year = y
      if (m) params.period_month = m
    }
    if (filters.employee_id) params.employee_id = filters.employee_id
    api.get('/invoices', { params }).then((res) => setInvoices(res.data)).catch(() => setInvoices([])).finally(() => setLoading(false))
  }

  useEffect(() => {
    Promise.all([
      api.get('/employees'),
      api.get('/payroll'),
      api.get('/invoices/templates'),
      api.get('/settings/legal-entities'),
    ]).then(([eRes, pRes, tRes, leRes]) => {
      setEmployees(eRes.data)
      setPayrolls(pRes.data)
      setTemplates(tRes.data)
      setLegalEntities(leRes.data)
    })
  }, [])

  useEffect(() => { fetchInvoices() }, [filters])

  const handleGenerate = async () => {
    if (!generatePayrollId) return
    setGenerating(true)
    try {
      await api.post('/invoices/generate-from-payroll', { payroll_period_id: Number(generatePayrollId) })
      toast.success('Invoices generated')
      setShowGenerate(false)
      fetchInvoices()
    } finally {
      setGenerating(false)
    }
  }

  const handleCreate = async () => {
    setCreateError('')
    if (!createForm.employee_id) {
      setCreateError('Please select an employee')
      return
    }
    if (!createForm.period_month || !createForm.period_year) {
      setCreateError('Please select period month and year')
      return
    }
    if (!createForm.amount || Number(createForm.amount) < 0) {
      setCreateError('Please enter a valid amount')
      return
    }
    setCreating(true)
    try {
      const payload = {
        employee_id: Number(createForm.employee_id),
        legal_entity_id: createForm.legal_entity_id ? Number(createForm.legal_entity_id) : null,
        period_month: Number(createForm.period_month),
        period_year: Number(createForm.period_year),
        amount: Number(createForm.amount),
        currency: createForm.currency || 'EUR',
        description: createForm.description || null,
      }
      await api.post('/invoices', payload)
      toast.success('Invoice created')
      setShowCreate(false)
      setCreateForm(EMPTY_INVOICE)
      fetchInvoices()
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create invoice')
    } finally {
      setCreating(false)
    }
  }

  const downloadPdf = async (inv) => {
    const res = await api.get(`/invoices/${inv.id}/download-pdf`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `${inv.invoice_number}.pdf`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const previewInvoice = async (inv) => {
    const r = await api.get(`/invoices/${inv.id}/preview-html`, { responseType: 'text' })
    const w = window.open('', '_blank')
    w.document.write(r.data)
    w.document.close()
  }

  const generatePdf = async (inv) => {
    try {
      await api.post('/invoices/generate', { invoice_id: inv.id })
      toast.success('PDF generated')
      fetchInvoices()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to generate PDF')
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === invoices.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(invoices.map((i) => i.id)))
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    try {
      const r = await api.post('/invoices/batch-delete', { ids: [...selectedIds] })
      toast.success(`Deleted ${r.data.deleted} invoice(s)`)
      setSelectedIds(new Set())
      setShowDeleteConfirm(null)
      fetchInvoices()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to delete')
    }
  }

  const handleDeleteAll = async () => {
    try {
      const r = await api.post('/invoices/delete-all')
      toast.success(`Deleted ${r.data.deleted} invoice(s)`)
      setSelectedIds(new Set())
      setShowDeleteConfirm(null)
      fetchInvoices()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to delete')
    }
  }

  const downloadUploadedPdf = async (inv) => {
    const res = await api.get(`/invoices/${inv.id}/download-uploaded`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `${inv.invoice_number}_uploaded.pdf`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const uploadPdf = async (inv, file) => {
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    await api.post(`/invoices/${inv.id}/upload-pdf`, formData)
    fetchInvoices()
  }

  const handleExportCSV = async () => {
    const params = {}
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v })
    const res = await api.get('/invoices/export', { params, responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = 'invoices.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const templatePdfRefs = useRef({})
  const fetchTemplates = () => {
    api.get('/invoices/templates').then((res) => setTemplates(res.data))
  }

  const uploadTemplatePdf = async (templateId, file) => {
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    await api.post(`/invoices/templates/${templateId}/upload-pdf`, formData)
    fetchTemplates()
  }

  const saveTemplate = async () => {
    setSavingTemplate(true)
    try {
      if (templateForm.id) {
        await api.put(`/invoices/templates/${templateForm.id}`, templateForm)
      } else {
        await api.post('/invoices/templates', templateForm)
      }
      setTemplateForm(null)
      fetchTemplates()
    } finally {
      setSavingTemplate(false)
    }
  }

  const cField = (key, value) => setCreateForm((f) => ({ ...f, [key]: value }))
  const tField = (key, value) => setTemplateForm((f) => ({ ...f, [key]: value }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleExportCSV} className="btn-secondary">Export CSV</button>
          <button onClick={() => { setGeneratePayrollId(payrolls[0]?.id || ''); setShowGenerate(true) }} className="btn-secondary">
            Generate from Payroll
          </button>
          {selectedIds.size > 0 && (
            <button onClick={() => setShowDeleteConfirm('selected')} className="btn-danger">
              Delete selected ({selectedIds.size})
            </button>
          )}
          {invoices.length > 0 && (
            <button onClick={() => setShowDeleteConfirm('all')} className="btn-secondary text-red-600 hover:bg-red-50">
              Delete all
            </button>
          )}
          <button onClick={() => setShowCreate(true)} className="btn-primary">Create Invoice</button>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select value={filters.employee_id} onChange={(e) => update('employee_id', e.target.value)} className="select-field w-48">
            <option value="">All Employees</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
            ))}
          </select>
          <select value={filters.legal_entity} onChange={(e) => update('legal_entity', e.target.value)} className="select-field w-44">
            <option value="">All Legal Entities</option>
            {legalEntities.map((le) => (
              <option key={le.id} value={le.id}>{le.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Period (e.g. 2026-03)"
            value={filters.period}
            onChange={(e) => update('period', e.target.value)}
            className="input-field w-40"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 text-slate-500">No invoices found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={invoices.length > 0 && selectedIds.size === invoices.length} onChange={toggleSelectAll} className="rounded" />
                  </th>
                  {['Invoice #', 'Date', 'Employee', 'Legal Entity', 'Period', 'Amount', 'Currency', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.has(inv.id)} onChange={() => toggleSelect(inv.id)} className="rounded" />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(inv.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{inv.employee_name}</td>
                    <td className="px-4 py-3 text-slate-600">{inv.legal_entity}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {inv.period_month && inv.period_year
                        ? `${MONTHS[inv.period_month - 1]} ${inv.period_year}`
                        : '–'}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-900">{fmt(inv.amount)}</td>
                    <td className="px-4 py-3 text-slate-600">{inv.currency}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        <button onClick={() => previewInvoice(inv)} className="btn-secondary text-xs !px-2 !py-1">
                          Preview
                        </button>
                        <button onClick={() => downloadPdf(inv)} className="btn-secondary text-xs !px-2 !py-1">
                          PDF
                        </button>
                        <button onClick={() => generatePdf(inv)} className="btn-secondary text-xs !px-2 !py-1">
                          Generate
                        </button>
                        <button
                          onClick={() => fileRefs.current[inv.id]?.click()}
                          className="btn-secondary text-xs !px-2 !py-1"
                        >
                          Upload
                        </button>
                        <input
                          ref={(el) => { fileRefs.current[inv.id] = el }}
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={(e) => uploadPdf(inv, e.target.files?.[0])}
                        />
                        {inv.has_uploaded_pdf && (
                          <button
                            onClick={() => downloadUploadedPdf(inv)}
                            className="btn-secondary text-xs !px-2 !py-1"
                          >
                            ↓ Uploaded
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

      <div className="card">
        <button
          onClick={() => setShowTemplates((v) => !v)}
          className="w-full flex items-center justify-between p-5 text-left"
        >
          <h2 className="text-base font-semibold text-slate-900">Invoice Templates</h2>
          <span className="text-slate-400 text-lg">{showTemplates ? '−' : '+'}</span>
        </button>
        {showTemplates && (
          <div className="border-t border-slate-200 p-5 space-y-4">
            {templates.length === 0 && !templateForm && (
              <p className="text-sm text-slate-500">No templates yet.</p>
            )}
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="font-medium text-slate-900 text-sm">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.company_name}</p>
                  {t.has_template_pdf && <span className="text-xs text-green-600">PDF template uploaded</span>}
                </div>
                <div className="flex items-center gap-1">
                  <input
                    ref={(el) => { templatePdfRefs.current[t.id] = el }}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => uploadTemplatePdf(t.id, e.target.files?.[0])}
                  />
                  <button onClick={() => templatePdfRefs.current[t.id]?.click()} className="btn-secondary text-xs !px-2 !py-1">
                    {t.has_template_pdf ? 'Replace PDF' : 'Upload PDF'}
                  </button>
                  <button onClick={() => setTemplateForm({ ...t })} className="btn-secondary text-xs !px-2 !py-1">
                    Edit
                  </button>
                </div>
              </div>
            ))}
            {templateForm ? (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                    <input value={templateForm.name} onChange={(e) => tField('name', e.target.value)} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                    <input value={templateForm.company_name} onChange={(e) => tField('company_name', e.target.value)} className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Header</label>
                  <input value={templateForm.header} onChange={(e) => tField('header', e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company Details</label>
                  <textarea value={templateForm.company_details} onChange={(e) => tField('company_details', e.target.value)} className="input-field" rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Instructions</label>
                  <textarea value={templateForm.payment_instructions} onChange={(e) => tField('payment_instructions', e.target.value)} className="input-field" rows={2} />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveTemplate} disabled={savingTemplate} className="btn-primary text-sm">
                    {savingTemplate ? 'Saving…' : templateForm.id ? 'Update' : 'Create'}
                  </button>
                  <button onClick={() => setTemplateForm(null)} className="btn-secondary text-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setTemplateForm({ ...EMPTY_TEMPLATE })} className="btn-secondary text-sm">
                New Template
              </button>
            )}
          </div>
        )}
      </div>

      {showGenerate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Generate Invoices from Payroll</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payroll Period</label>
              <select
                value={generatePayrollId}
                onChange={(e) => setGeneratePayrollId(e.target.value)}
                className="select-field"
              >
                <option value="">Select period…</option>
                {payrolls.map((p) => (
                  <option key={p.id} value={p.id}>
                    {MONTHS[p.month - 1]} {p.year} ({p.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowGenerate(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleGenerate} disabled={generating || !generatePayrollId} className="btn-primary">
                {generating ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Confirm Delete</h2>
            <p className="text-slate-600 mb-6">
              {showDeleteConfirm === 'all'
                ? 'Are you sure you want to delete ALL invoices? This cannot be undone.'
                : 'Are you sure you want to delete selected invoices?'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(null)} className="btn-secondary">Cancel</button>
              <button
                onClick={showDeleteConfirm === 'all' ? handleDeleteAll : handleDeleteSelected}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Create Invoice</h2>
            {createError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{createError}</div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Employee</label>
                <select value={createForm.employee_id} onChange={(e) => cField('employee_id', e.target.value)} className="select-field">
                  <option value="">Select employee…</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Legal Entity</label>
                <select value={createForm.legal_entity_id} onChange={(e) => cField('legal_entity_id', e.target.value)} className="select-field">
                  <option value="">Select legal entity…</option>
                  {legalEntities.map((le) => (
                    <option key={le.id} value={le.id}>{le.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Month</label>
                  <select value={createForm.period_month} onChange={(e) => cField('period_month', e.target.value)} className="select-field">
                    <option value="">Month</option>
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
                  <select value={createForm.period_year} onChange={(e) => cField('period_year', e.target.value)} className="select-field">
                    <option value="">Year</option>
                    {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                  <input type="number" step="0.01" value={createForm.amount} onChange={(e) => cField('amount', e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                  <input value={createForm.currency} onChange={(e) => cField('currency', e.target.value)} className="input-field" placeholder="EUR" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea value={createForm.description} onChange={(e) => cField('description', e.target.value)} className="input-field" rows={3} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setShowCreate(false); setCreateForm(EMPTY_INVOICE); setCreateError('') }} className="btn-secondary">Cancel</button>
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
