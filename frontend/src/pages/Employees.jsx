import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api'

const EMPLOYMENT_TYPES = ['Contractor', 'Contractor via agency', 'Employee via agency']
const STATUSES = ['Active', 'Inactive']

const PAYMENT_BADGE = {
  Fiat: 'badge-blue',
  Crypto: 'badge-yellow',
  Split: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700',
}

export default function Employees() {
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [legalEntities, setLegalEntities] = useState([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)

  const [filters, setFilters] = useState({
    search: '',
    department_id: '',
    legal_entity_id: '',
    employment_type: '',
    status: '',
  })

  useEffect(() => {
    Promise.all([
      api.get('/settings/departments'),
      api.get('/settings/legal-entities'),
    ]).then(([dRes, leRes]) => {
      setDepartments(dRes.data)
      setLegalEntities(leRes.data)
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = {}
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v })
    api.get('/employees', { params })
      .then((res) => setEmployees(res.data))
      .finally(() => setLoading(false))
  }, [filters])

  const update = (key, value) => setFilters((f) => ({ ...f, [key]: value }))

  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      await api.post('/employees/import-csv', formData)
      const params = {}
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v })
      const res = await api.get('/employees', { params })
      setEmployees(res.data)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleExportCSV = async () => {
    const res = await api.get('/employees/export-csv', { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = 'employees.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
          {!loading && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
              {employees.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="btn-secondary">Export CSV</button>
          <button onClick={() => fileRef.current?.click()} className="btn-secondary" disabled={importing}>
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          <Link to="/employees/new" className="btn-primary">Add Employee</Link>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search by name, ID, or email…"
            value={filters.search}
            onChange={(e) => update('search', e.target.value)}
            className="input-field max-w-xs"
          />
          <select value={filters.department_id} onChange={(e) => update('department_id', e.target.value)} className="select-field w-44">
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <select value={filters.legal_entity_id} onChange={(e) => update('legal_entity_id', e.target.value)} className="select-field w-44">
            <option value="">All Legal Entities</option>
            {legalEntities.map((le) => (
              <option key={le.id} value={le.id}>{le.name}</option>
            ))}
          </select>
          <select value={filters.employment_type} onChange={(e) => update('employment_type', e.target.value)} className="select-field w-52">
            <option value="">All Employment Types</option>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select value={filters.status} onChange={(e) => update('status', e.target.value)} className="select-field w-36">
            <option value="">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-16 text-slate-500">No employees found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Employee ID', 'Name', 'Department', 'Country', 'Employment Type', 'Legal Entity', 'Salary', 'Currency', 'Payment Method', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr
                    key={emp.id}
                    onClick={() => navigate(`/employees/${emp.id}`)}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{emp.employee_id}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{emp.first_name} {emp.last_name}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.department || '–'}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.country}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.employment_type}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.legal_entity || '–'}</td>
                    <td className="px-4 py-3 text-slate-900 tabular-nums">{Number(emp.base_salary).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.currency}</td>
                    <td className="px-4 py-3">
                      <span className={PAYMENT_BADGE[emp.payment_method] || 'badge-gray'}>{emp.payment_method}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={emp.status === 'Active' ? 'badge-green' : 'badge-red'}>{emp.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
