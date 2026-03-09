import { useState, useEffect, useCallback } from 'react'
import api from '../api'

const TABS = ['General', 'Departments', 'Legal Entities', 'Users', 'Custom Fields']

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  )
}

function SectionCard({ title, children, action }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function GeneralTab() {
  const [employmentTypes, setEmploymentTypes] = useState([])
  const [currencies, setCurrencies] = useState([])
  const [cryptoNetworks, setCryptoNetworks] = useState([])
  const [loading, setLoading] = useState(true)
  const [currencyCode, setCurrencyCode] = useState('')
  const [currencyEditId, setCurrencyEditId] = useState(null)
  const [currencyEditCode, setCurrencyEditCode] = useState('')
  const [cryptoName, setCryptoName] = useState('')
  const [cryptoEditId, setCryptoEditId] = useState(null)
  const [cryptoEditName, setCryptoEditName] = useState('')

  const fetch = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get('/settings/employment-types'),
      api.get('/settings/currencies'),
      api.get('/settings/crypto-networks'),
    ])
      .then(([et, cur, cn]) => {
        setEmploymentTypes(et.data)
        setCurrencies(cur.data)
        setCryptoNetworks(cn.data)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const addCurrency = async () => {
    if (!currencyCode.trim()) return
    await api.post('/settings/currencies', { code: currencyCode.trim().toUpperCase(), name: currencyCode.trim().toUpperCase() })
    setCurrencyCode('')
    fetch()
  }

  const saveCurrency = async () => {
    if (!currencyEditCode.trim()) return
    await api.put(`/settings/currencies/${currencyEditId}`, { code: currencyEditCode.trim().toUpperCase(), name: currencyEditCode.trim().toUpperCase() })
    setCurrencyEditId(null)
    fetch()
  }

  const removeCurrency = async (id) => {
    if (!confirm('Delete this currency?')) return
    await api.delete(`/settings/currencies/${id}`)
    fetch()
  }

  const addCrypto = async () => {
    if (!cryptoName.trim()) return
    await api.post('/settings/crypto-networks', { name: cryptoName.trim() })
    setCryptoName('')
    fetch()
  }

  const saveCrypto = async () => {
    if (!cryptoEditName.trim()) return
    await api.put(`/settings/crypto-networks/${cryptoEditId}`, { name: cryptoEditName.trim() })
    setCryptoEditId(null)
    fetch()
  }

  const removeCrypto = async (id) => {
    if (!confirm('Delete this crypto network?')) return
    await api.delete(`/settings/crypto-networks/${id}`)
    fetch()
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      <SectionCard title="Employment Types">
        <div className="flex flex-wrap gap-2">
          {employmentTypes.map((t) => (
            <span key={t.id || t.name} className="badge-gray">{t.name}</span>
          ))}
          {employmentTypes.length === 0 && <p className="text-sm text-slate-500">No employment types configured.</p>}
        </div>
      </SectionCard>
      <SectionCard
        title="Supported Currencies"
        action={
          <div className="flex items-center gap-2">
            <input
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCurrency()}
              placeholder="e.g. EUR"
              className="input-field w-24"
            />
            <button onClick={addCurrency} className="btn-primary">Add</button>
          </div>
        }
      >
        {currencies.length === 0 ? (
          <p className="text-sm text-slate-500">No currencies yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {currencies.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-3">
                {currencyEditId === c.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      value={currencyEditCode}
                      onChange={(e) => setCurrencyEditCode(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveCurrency()}
                      className="input-field w-24"
                      autoFocus
                    />
                    <button onClick={saveCurrency} className="btn-primary text-xs">Save</button>
                    <button onClick={() => setCurrencyEditId(null)} className="btn-secondary text-xs">Cancel</button>
                  </div>
                ) : (
                  <>
                    <span className="badge-blue">{c.code || c.name}</span>
                    <div className="flex gap-1">
                      <button onClick={() => { setCurrencyEditId(c.id); setCurrencyEditCode(c.code || c.name) }} className="btn-secondary text-xs !px-2 !py-1">Edit</button>
                      <button onClick={() => removeCurrency(c.id)} className="btn-danger text-xs !px-2 !py-1">Delete</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <SectionCard
        title="Crypto Networks"
        action={
          <div className="flex items-center gap-2">
            <input
              value={cryptoName}
              onChange={(e) => setCryptoName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCrypto()}
              placeholder="e.g. TRON"
              className="input-field w-28"
            />
            <button onClick={addCrypto} className="btn-primary">Add</button>
          </div>
        }
      >
        {cryptoNetworks.length === 0 ? (
          <p className="text-sm text-slate-500">No crypto networks yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {cryptoNetworks.map((n) => (
              <li key={n.id} className="flex items-center justify-between py-3">
                {cryptoEditId === n.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      value={cryptoEditName}
                      onChange={(e) => setCryptoEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveCrypto()}
                      className="input-field w-28"
                      autoFocus
                    />
                    <button onClick={saveCrypto} className="btn-primary text-xs">Save</button>
                    <button onClick={() => setCryptoEditId(null)} className="btn-secondary text-xs">Cancel</button>
                  </div>
                ) : (
                  <>
                    <span className="badge-yellow">{n.name}</span>
                    <div className="flex gap-1">
                      <button onClick={() => { setCryptoEditId(n.id); setCryptoEditName(n.name) }} className="btn-secondary text-xs !px-2 !py-1">Edit</button>
                      <button onClick={() => removeCrypto(n.id)} className="btn-danger text-xs !px-2 !py-1">Delete</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}

function DepartmentsTab() {
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')

  const fetch = useCallback(() => {
    setLoading(true)
    api.get('/settings/departments').then((r) => setDepartments(r.data)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const add = async () => {
    if (!name.trim()) return
    await api.post('/settings/departments', { name: name.trim() })
    setName('')
    fetch()
  }

  const save = async () => {
    if (!editName.trim()) return
    await api.put(`/settings/departments/${editId}`, { name: editName.trim() })
    setEditId(null)
    fetch()
  }

  const remove = async (id) => {
    if (!confirm('Delete this department?')) return
    await api.delete(`/settings/departments/${id}`)
    fetch()
  }

  if (loading) return <Spinner />

  return (
    <SectionCard
      title="Departments"
      action={
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="New department"
            className="input-field w-48"
          />
          <button onClick={add} className="btn-primary">Add</button>
        </div>
      }
    >
      {departments.length === 0 ? (
        <p className="text-sm text-slate-500">No departments yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {departments.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-3">
              {editId === d.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && save()}
                    className="input-field flex-1"
                    autoFocus
                  />
                  <button onClick={save} className="btn-primary text-xs">Save</button>
                  <button onClick={() => setEditId(null)} className="btn-secondary text-xs">Cancel</button>
                </div>
              ) : (
                <>
                  <span className="text-sm text-slate-800">{d.name}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditId(d.id); setEditName(d.name) }} className="btn-secondary text-xs">Edit</button>
                    <button onClick={() => remove(d.id)} className="text-xs text-red-600 hover:text-red-800 px-2 py-1">Delete</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

function LegalEntitiesTab() {
  const [entities, setEntities] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name: '', address: '', registration_number: '' })

  const fetchEntities = useCallback(() => {
    setLoading(true)
    api.get('/settings/legal-entities').then((r) => setEntities(r.data)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchEntities() }, [fetchEntities])

  const openAdd = () => {
    setForm({ name: '', address: '', registration_number: '' })
    setModal('add')
  }

  const openEdit = (e) => {
    setForm({ name: e.name, address: e.address || '', registration_number: e.registration_number || '' })
    setModal(e.id)
  }

  const save = async () => {
    if (!form.name.trim()) return
    if (modal === 'add') {
      await api.post('/settings/legal-entities', form)
    } else {
      await api.put(`/settings/legal-entities/${modal}`, form)
    }
    setModal(null)
    fetchEntities()
  }

  const remove = async (id) => {
    if (!confirm('Delete this legal entity?')) return
    await api.delete(`/settings/legal-entities/${id}`)
    fetchEntities()
  }

  if (loading) return <Spinner />

  return (
    <>
      <SectionCard
        title="Legal Entities"
        action={<button onClick={openAdd} className="btn-primary">Add Entity</button>}
      >
        {entities.length === 0 ? (
          <p className="text-sm text-slate-500">No legal entities yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Name', 'Address', 'Registration #', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entities.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{e.name}</td>
                    <td className="px-4 py-3 text-slate-600">{e.address || '–'}</td>
                    <td className="px-4 py-3 text-slate-600">{e.registration_number || '–'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(e)} className="btn-secondary text-xs">Edit</button>
                        <button onClick={() => remove(e.id)} className="text-xs text-red-600 hover:text-red-800 px-2 py-1">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-5">
              {modal === 'add' ? 'Add Legal Entity' : 'Edit Legal Entity'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="input-field"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Registration Number</label>
                <input
                  value={form.registration_number}
                  onChange={(e) => setForm((f) => ({ ...f, registration_number: e.target.value }))}
                  className="input-field"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={save} className="btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ email: '', name: '', role: 'employee' })
  const [saving, setSaving] = useState(false)

  const fetchUsers = useCallback(() => {
    setLoading(true)
    api.get('/auth/users').then((r) => setUsers(r.data)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const openInvite = () => {
    setForm({ email: '', name: '', role: 'employee' })
    setModal('invite')
  }

  const openEdit = (u) => {
    setForm({ email: u.email, name: u.name || '', role: u.role || 'employee' })
    setModal(u.id)
  }

  const save = async () => {
    setSaving(true)
    try {
      if (modal === 'invite') {
        await api.post('/auth/invite', form)
      } else {
        await api.put(`/auth/users/${modal}`, form)
      }
      setModal(null)
      fetchUsers()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (!confirm('Delete this user?')) return
    await api.delete(`/auth/users/${id}`)
    fetchUsers()
  }

  if (loading) return <Spinner />

  const roleBadge = (role) => {
    if (role === 'admin') return 'badge-blue'
    return 'badge-gray'
  }

  return (
    <>
      <SectionCard
        title="Users"
        action={<button onClick={openInvite} className="btn-primary">Invite User</button>}
      >
        {users.length === 0 ? (
          <p className="text-sm text-slate-500">No users yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Name', 'Email', 'Role', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{u.name || '–'}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3"><span className={roleBadge(u.role)}>{u.role}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(u)} className="btn-secondary text-xs">Edit</button>
                        <button onClick={() => remove(u.id)} className="text-xs text-red-600 hover:text-red-800 px-2 py-1">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-5">
              {modal === 'invite' ? 'Invite User' : 'Edit User'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="input-field"
                  disabled={modal !== 'invite'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="select-field"
                >
                  <option value="admin">Admin</option>
                  <option value="employee">Employee</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : modal === 'invite' ? 'Send Invite' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function CustomFieldsTab() {
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', field_type: 'text', required: false })
  const [editId, setEditId] = useState(null)

  const fetchFields = useCallback(() => {
    setLoading(true)
    api.get('/settings/custom-fields').then((r) => setFields(r.data)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchFields() }, [fetchFields])

  const add = async () => {
    if (!form.name.trim()) return
    await api.post('/settings/custom-fields', form)
    setForm({ name: '', field_type: 'text', required: false })
    fetchFields()
  }

  const startEdit = (f) => {
    setEditId(f.id)
    setForm({ name: f.name, field_type: f.field_type, required: f.required })
  }

  const saveEdit = async () => {
    if (!form.name.trim()) return
    await api.put(`/settings/custom-fields/${editId}`, form)
    setEditId(null)
    setForm({ name: '', field_type: 'text', required: false })
    fetchFields()
  }

  const remove = async (id) => {
    if (!confirm('Delete this custom field?')) return
    await api.delete(`/settings/custom-fields/${id}`)
    fetchFields()
  }

  if (loading) return <Spinner />

  const typeBadge = (type) => {
    const map = { text: 'badge-blue', number: 'badge-green', date: 'badge-yellow', select: 'badge-gray' }
    return map[type] || 'badge-gray'
  }

  return (
    <SectionCard title="Custom Fields">
      <div className="flex flex-wrap items-end gap-3 mb-6 pb-6 border-b border-slate-100">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="input-field w-48"
            placeholder="Field name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
          <select
            value={form.field_type}
            onChange={(e) => setForm((f) => ({ ...f, field_type: e.target.value }))}
            className="select-field w-32"
          >
            {['text', 'number', 'date', 'select'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 pb-2">
          <input
            type="checkbox"
            checked={form.required}
            onChange={(e) => setForm((f) => ({ ...f, required: e.target.checked }))}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Required
        </label>
        {editId ? (
          <div className="flex items-center gap-2 pb-0.5">
            <button onClick={saveEdit} className="btn-primary">Save</button>
            <button onClick={() => { setEditId(null); setForm({ name: '', field_type: 'text', required: false }) }} className="btn-secondary">Cancel</button>
          </div>
        ) : (
          <button onClick={add} className="btn-primary pb-0.5">Add Field</button>
        )}
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-slate-500">No custom fields yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {fields.map((f) => (
            <li key={f.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-900">{f.name}</span>
                <span className={typeBadge(f.field_type)}>{f.field_type}</span>
                {f.required && <span className="badge-red">required</span>}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => startEdit(f)} className="btn-secondary text-xs">Edit</button>
                <button onClick={() => remove(f.id)} className="text-xs text-red-600 hover:text-red-800 px-2 py-1">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

export default function Settings() {
  const [tab, setTab] = useState('General')

  const tabContent = {
    General: <GeneralTab />,
    Departments: <DepartmentsTab />,
    'Legal Entities': <LegalEntitiesTab />,
    Users: <UsersTab />,
    'Custom Fields': <CustomFieldsTab />,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your organization settings</p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex gap-6 -mb-px">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {tabContent[tab]}
    </div>
  )
}
