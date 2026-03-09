import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../api'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts'

function HoverTooltip({ text, children }) {
  return (
    <span className="relative group cursor-help">
      {children}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">{text}</span>
    </span>
  )
}

function InfoRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="py-2.5 flex justify-between border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900 text-right">{value}</span>
    </div>
  )
}

function CardSection({ title, children }) {
  return (
    <div className="card p-6">
      <h2 className="text-base font-semibold text-slate-900 mb-3">{title}</h2>
      <div>{children}</div>
    </div>
  )
}

function truncateAddress(addr) {
  if (!addr || addr.length <= 14) return addr
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`
}

function effectiveSalary(emp) {
  if (emp.post_probation_salary && emp.probation_end_date) {
    if (new Date(emp.probation_end_date) <= new Date()) {
      return { amount: emp.post_probation_salary, label: 'Post-Probation' }
    }
  }
  return { amount: emp.base_salary, label: 'Base' }
}

const PAYMENT_BADGE = {
  Fiat: 'badge-blue',
  Crypto: 'badge-yellow',
  Split: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700',
}

export default function EmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [employee, setEmployee] = useState(null)
  const [payments, setPayments] = useState([])
  const [compHistory, setCompHistory] = useState([])
  const [payoutHistory, setPayoutHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setEmployee(null)
    api.get(`/employees/${id}`)
      .then((empRes) => {
        setEmployee(empRes.data)
        return Promise.all([
          api.get('/payments', { params: { employee_id: id } }),
          api.get(`/employees/${id}/compensation-history`),
          api.get(`/employees/${id}/payout-history`),
        ])
      })
      .then(([payRes, compRes, payoutRes]) => {
        setPayments(payRes.data)
        setCompHistory(compRes.data || [])
        setPayoutHistory(payoutRes.data || [])
      })
      .catch((err) => {
        if (err.response?.status === 404 || err.response?.status === 403) {
          setEmployee(null)
        } else {
          setEmployee(null)
          console.error('Failed to load employee:', err)
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    if (!window.confirm('This will deactivate the employee. Continue?')) return
    setDeleting(true)
    try {
      await api.delete(`/employees/${id}`)
      navigate('/employees')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 mb-4">Employee not found.</p>
        <button onClick={() => navigate('/employees')} className="btn-secondary">Back to Employees</button>
      </div>
    )
  }

  const salary = effectiveSalary(employee)
  const showFiat = employee.payment_method === 'Fiat' || employee.payment_method === 'Split'
  const showCrypto = employee.payment_method === 'Crypto' || employee.payment_method === 'Split'

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{employee.first_name} {employee.last_name}</h1>
            <span className={employee.status === 'Active' ? 'badge-green' : 'badge-red'}>{employee.status}</span>
          </div>
          <p className="text-sm text-slate-500 mt-1 font-mono">{employee.employee_id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/employees/${id}/edit`} className="btn-secondary">Edit</Link>
          <button onClick={handleDelete} disabled={deleting} className="btn-danger">
            {deleting ? 'Deactivating…' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardSection title="Personal Information">
          <InfoRow label="Email" value={employee.email} />
          <InfoRow label="Country" value={employee.country} />
          <InfoRow label="Telegram" value={employee.telegram} />
          <InfoRow label="Slack" value={employee.slack} />
          <InfoRow label="Start Date" value={employee.start_date} />
        </CardSection>

        <CardSection title="Employment">
          <InfoRow label="Department" value={employee.department} />
          <InfoRow label="Job Title" value={employee.job_title} />
          <InfoRow label="Manager" value={employee.manager} />
          <InfoRow label="Employment Type" value={employee.employment_type} />
          <InfoRow label="Legal Entity" value={employee.legal_entity} />
          <InfoRow label="Notes" value={employee.notes} />
        </CardSection>

        <CardSection title="Salary">
          <InfoRow
            label="Effective Salary"
            value={
              <span>
                {Number(salary.amount).toLocaleString()} {employee.currency}
                <span className="ml-2 text-xs text-slate-400">({salary.label})</span>
              </span>
            }
          />
          <InfoRow label="Base Salary" value={`${Number(employee.base_salary).toLocaleString()} ${employee.currency}`} />
          {employee.post_probation_salary && (
            <InfoRow label="Post-Probation Salary" value={`${Number(employee.post_probation_salary).toLocaleString()} ${employee.currency}`} />
          )}
          {employee.probation_end_date && (
            <InfoRow label="Probation End Date" value={employee.probation_end_date} />
          )}
          <InfoRow label="Salary Type" value={employee.salary_type} />
          <InfoRow label="Overtime Rate" value={employee.overtime_rate ? Number(employee.overtime_rate).toLocaleString() : null} />
          <InfoRow
            label="Payment Method"
            value={<span className={PAYMENT_BADGE[employee.payment_method] || 'badge-gray'}>{employee.payment_method}</span>}
          />
          {employee.payment_method === 'Split' && (
            <>
              <InfoRow label="Fiat Amount" value={employee.fiat_salary_amount ? `${Number(employee.fiat_salary_amount).toLocaleString()} ${employee.currency}` : null} />
              <InfoRow label="Crypto Amount" value={employee.crypto_salary_amount ? Number(employee.crypto_salary_amount).toLocaleString() : null} />
            </>
          )}
        </CardSection>

        {showFiat && (
          <CardSection title="Bank Details">
            <InfoRow label="Bank Name" value={employee.bank_name} />
            <InfoRow label="IBAN" value={employee.iban} />
            <InfoRow label="Account Holder" value={employee.account_holder} />
          </CardSection>
        )}

        {showCrypto && (
          <CardSection title="Crypto Details">
            <InfoRow
              label="Wallet Address"
              value={
                employee.wallet_address ? (
                  <HoverTooltip text={employee.wallet_address}>
                    <span className="font-mono text-xs">{truncateAddress(employee.wallet_address)}</span>
                  </HoverTooltip>
                ) : null
              }
            />
            <InfoRow label="Network" value={employee.wallet_network} />
            <InfoRow label="Coin" value={employee.wallet_coin} />
          </CardSection>
        )}

        <CardSection title="Payout history">
          {payoutHistory.length === 0 ? (
            <p className="text-sm text-slate-500">No payout changes recorded yet.</p>
          ) : (
            <div className="space-y-3 pt-1">
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
        </CardSection>
      </div>

      {employee.custom_fields && employee.custom_fields.length > 0 && (
        <CardSection title="Custom Fields">
          {employee.custom_fields.map((cf) => (
            <InfoRow key={cf.id || cf.field_name} label={cf.field_name} value={String(cf.value || '')} />
          ))}
        </CardSection>
      )}

      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Payment History</h2>
        </div>
        {payments.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">No payments recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Date', 'Payroll', 'Type', 'Amount', 'Currency', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-slate-600">{p.payment_date || p.created_at?.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-slate-600">{p.payroll_line_id ? `#${p.payroll_line_id}` : '–'}</td>
                    <td className="px-4 py-3">
                      <span className={PAYMENT_BADGE[p.payment_type] || 'badge-gray'}>{p.payment_type}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-900 tabular-nums">{Number(p.amount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-600">{p.currency}</td>
                    <td className="px-4 py-3">
                      <span className={
                        p.status === 'Paid' ? 'badge-green' :
                        p.status === 'Pending' ? 'badge-yellow' :
                        p.status === 'Failed' ? 'badge-red' : 'badge-gray'
                      }>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Compensation History</h2>
        {compHistory.length === 0 ? (
          <p className="text-sm text-slate-500">No salary history yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto mb-4">
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
                  {compHistory.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100">
                      <td className="px-4 py-3">{c.effective_date}</td>
                      <td className="px-4 py-3">{Number(c.base_salary).toLocaleString()}</td>
                      <td className="px-4 py-3">{c.currency}</td>
                      <td className="px-4 py-3">{c.note || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={compHistory.map((x) => ({ label: x.effective_date, salary: Number(x.base_salary || 0) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                <RechartsTooltip formatter={(v) => Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                <Line type="monotone" dataKey="salary" stroke="#4f46e5" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </div>
  )
}
