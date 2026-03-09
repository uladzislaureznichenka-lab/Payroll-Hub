import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api'

const EMPLOYMENT_TYPES = ['Contractor', 'Contractor via agency', 'Employee via agency']
const CURRENCIES = ['EUR', 'PLN', 'BYN', 'RUB']
const SALARY_TYPES = ['Monthly', 'Hourly']
const PAYMENT_METHODS = ['Fiat', 'Crypto', 'Split']
const NETWORKS = ['TRON', 'ERC20']
const COINS = ['USDT', 'USDC']

function Tooltip({ text, children }) {
  return (
    <span className="relative group cursor-help">
      {children}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">{text}</span>
    </span>
  )
}

function Section({ title, children }) {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-5">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">{children}</div>
    </div>
  )
}

function Field({ label, children, span, tooltip }) {
  const cls = span === 2 ? 'md:col-span-2' : span === 3 ? 'md:col-span-2 lg:col-span-3' : ''
  return (
    <label className={`block ${cls}`}>
      <span className="block text-sm font-medium text-slate-700 mb-1">
        {tooltip ? <Tooltip text={tooltip}>{label} <span className="text-slate-400">ⓘ</span></Tooltip> : label}
      </span>
      {children}
    </label>
  )
}

function validateWallet(address, network) {
  if (!address) return null
  if (network === 'TRON') {
    if (!address.startsWith('T')) return 'TRON address must start with T'
    if (address.length !== 34) return 'TRON address must be 34 characters'
    if (!/^[A-Za-z0-9]+$/.test(address)) return 'TRON address must be alphanumeric'
  }
  if (network === 'ERC20') {
    if (!address.startsWith('0x')) return 'ERC20 address must start with 0x'
    if (address.length !== 42) return 'ERC20 address must be 42 characters'
    if (!/^0x[0-9a-fA-F]+$/.test(address)) return 'ERC20 address must be hex after 0x'
  }
  return null
}

const BLANK = {
  employee_id: '', first_name: '', last_name: '', email: '', country: '', telegram: '', slack: '', start_date: '',
  department_id: '', job_title: '', manager: '', employment_type: '', legal_entity_id: '', status: 'Active', notes: '', internal_notes: '',
  base_salary: '', post_probation_salary: '', probation_end_date: '', salary_type: 'Monthly', currency: 'EUR', payment_method: 'Fiat',
  bank_name: '', iban: '', account_holder: '',
  wallet_address: '', wallet_network: 'TRON', wallet_coin: 'USDT',
  fiat_salary_amount: '', crypto_salary_amount: '',
  overtime_rate: '',
}

export default function EmployeeForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState(BLANK)
  const [departments, setDepartments] = useState([])
  const [legalEntities, setLegalEntities] = useState([])
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)

  useEffect(() => {
    if (isEdit && (!id || id === 'new')) {
      setLoading(false)
      return
    }
    const promises = [
      api.get('/settings/departments'),
      api.get('/settings/legal-entities'),
    ]
    if (isEdit && id) {
      promises.push(api.get(`/employees/${id}`))
    }
    Promise.all(promises)
      .then((results) => {
        setDepartments(results[0].data)
        setLegalEntities(results[1].data)
        if (results[2]) {
          const data = results[2].data
          const merged = { ...BLANK }
          Object.keys(merged).forEach((k) => {
            if (data[k] !== null && data[k] !== undefined) merged[k] = data[k]
          })
          setForm(merged)
        }
      })
      .catch((err) => {
        if (err.response?.status === 404 && isEdit) {
          navigate('/employees')
        }
      })
      .finally(() => setLoading(false))
  }, [id, isEdit, navigate])

  const set = (key) => (e) => {
    const val = e.target.value
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n })
  }

  const showFiat = form.payment_method === 'Fiat' || form.payment_method === 'Split'
  const showCrypto = form.payment_method === 'Crypto' || form.payment_method === 'Split'
  const showSplit = form.payment_method === 'Split'

  const validate = () => {
    const errs = {}
    if (!form.first_name.trim()) errs.first_name = 'Required'
    if (!form.last_name.trim()) errs.last_name = 'Required'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email'
    if (!form.employment_type) errs.employment_type = 'Required'

    if (showCrypto && form.wallet_address) {
      const walletErr = validateWallet(form.wallet_address, form.wallet_network)
      if (walletErr) errs.wallet_address = walletErr
    }
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      if (isEdit) {
        await api.put(`/employees/${id}`, form)
      } else {
        await api.post('/employees', form)
      }
      navigate('/employees')
    } catch (err) {
      const data = err.response?.data
      if (data?.errors) {
        setErrors(data.errors)
      } else {
        setErrors({ _general: data?.message || 'Something went wrong' })
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{isEdit ? 'Edit Employee' : 'New Employee'}</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate('/employees')} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>

      {errors._general && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{errors._general}</div>
      )}

      <Section title="Personal Information">
        <Field label="Employee ID">
          <input value={form.employee_id} onChange={set('employee_id')} className="input-field" />
        </Field>
        <Field label="First Name">
          <input value={form.first_name} onChange={set('first_name')} className={`input-field ${errors.first_name ? 'border-red-400' : ''}`} />
          {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name}</p>}
        </Field>
        <Field label="Last Name">
          <input value={form.last_name} onChange={set('last_name')} className={`input-field ${errors.last_name ? 'border-red-400' : ''}`} />
          {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name}</p>}
        </Field>
        <Field label="Email">
          <input type="email" value={form.email} onChange={set('email')} className={`input-field ${errors.email ? 'border-red-400' : ''}`} />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </Field>
        <Field label="Country">
          <input value={form.country} onChange={set('country')} className="input-field" />
        </Field>
        <Field label="Telegram">
          <input value={form.telegram} onChange={set('telegram')} className="input-field" placeholder="@handle" />
        </Field>
        <Field label="Slack">
          <input value={form.slack} onChange={set('slack')} className="input-field" />
        </Field>
        <Field label="Start Date">
          <input type="date" value={form.start_date} onChange={set('start_date')} className="input-field" />
        </Field>
      </Section>

      <Section title="Employment">
        <Field label="Department">
          <select value={form.department_id} onChange={set('department_id')} className="select-field">
            <option value="">Select…</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Job Title">
          <input value={form.job_title} onChange={set('job_title')} className="input-field" />
        </Field>
        <Field label="Manager">
          <input value={form.manager} onChange={set('manager')} className="input-field" />
        </Field>
        <Field label="Employment Type">
          <select value={form.employment_type} onChange={set('employment_type')} className={`select-field ${errors.employment_type ? 'border-red-400' : ''}`}>
            <option value="">Select…</option>
            {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {errors.employment_type && <p className="text-red-500 text-xs mt-1">{errors.employment_type}</p>}
        </Field>
        <Field label="Legal Entity">
          <select value={form.legal_entity_id} onChange={set('legal_entity_id')} className="select-field">
            <option value="">Select…</option>
            {legalEntities.map((le) => <option key={le.id} value={le.id}>{le.name}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={set('status')} className="select-field">
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </Field>
        <Field label="Notes" span={3}>
          <textarea value={form.notes} onChange={set('notes')} rows={2} className="input-field" />
        </Field>
        <Field label="Internal Notes" span={3}>
          <textarea value={form.internal_notes} onChange={set('internal_notes')} rows={2} className="input-field" />
        </Field>
      </Section>

      <Section title="Salary">
        <Field label="Base Salary">
          <input type="number" step="0.01" value={form.base_salary} onChange={set('base_salary')} className="input-field" />
        </Field>
        <Field label="Post-Probation Salary">
          <input type="number" step="0.01" value={form.post_probation_salary} onChange={set('post_probation_salary')} className="input-field" />
        </Field>
        <Field label="Probation End Date">
          <input type="date" value={form.probation_end_date} onChange={set('probation_end_date')} className="input-field" />
        </Field>
        <Field label="Salary Type">
          <select value={form.salary_type} onChange={set('salary_type')} className="select-field">
            {SALARY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Currency">
          <select value={form.currency} onChange={set('currency')} className="select-field">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Payment Method">
          <select value={form.payment_method} onChange={set('payment_method')} className="select-field">
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Overtime Rate">
          <input type="number" step="0.01" value={form.overtime_rate} onChange={set('overtime_rate')} className="input-field" />
        </Field>
      </Section>

      {showFiat && (
        <Section title="Bank Details">
          <Field label="Bank Name" tooltip="The name of the bank where the employee holds their account">
            <input value={form.bank_name} onChange={set('bank_name')} className="input-field" />
          </Field>
          <Field label="IBAN" tooltip="International Bank Account Number used for cross-border payments">
            <input value={form.iban} onChange={set('iban')} className="input-field" />
          </Field>
          <Field label="SWIFT" tooltip="Bank Identifier Code (BIC/SWIFT)">
            <input value={form.swift || ''} onChange={set('swift')} className="input-field" />
          </Field>
          <Field label="Account Holder Name" tooltip="Full legal name as registered with the bank">
            <input value={form.account_holder} onChange={set('account_holder')} className="input-field" />
          </Field>
        </Section>
      )}

      {showCrypto && (
        <Section title="Crypto Details">
          <Field label="Wallet Address" tooltip="The blockchain address to receive crypto payments">
            <input value={form.wallet_address} onChange={set('wallet_address')} className={`input-field font-mono text-xs ${errors.wallet_address ? 'border-red-400' : ''}`} />
            {errors.wallet_address && <p className="text-red-500 text-xs mt-1">{errors.wallet_address}</p>}
          </Field>
          <Field label="Network" tooltip="TRON for TRC-20 tokens, ERC20 for Ethereum-based tokens">
            <select value={form.wallet_network} onChange={set('wallet_network')} className="select-field">
              {NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Coin" tooltip="The stablecoin to use for payment">
            <select value={form.wallet_coin} onChange={set('wallet_coin')} className="select-field">
              {COINS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </Section>
      )}

      {showSplit && (
        <Section title="Split Payment Amounts">
          <Field label="Fiat Amount">
            <input type="number" step="0.01" value={form.fiat_salary_amount} onChange={set('fiat_salary_amount')} className="input-field" />
          </Field>
          <Field label="Crypto Amount">
            <input type="number" step="0.01" value={form.crypto_salary_amount} onChange={set('crypto_salary_amount')} className="input-field" />
          </Field>
        </Section>
      )}
    </form>
  )
}
