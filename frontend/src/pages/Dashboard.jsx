import { useState, useEffect } from 'react'
import api from '../api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts'

const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']
const CARD = 'bg-white rounded-xl border border-slate-200 shadow-sm p-6'

const fmt = (v) =>
  Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtNum = (v) =>
  Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })

function MetricCard({ label, value, icon, accent = 'text-indigo-600', bg = 'bg-indigo-50' }) {
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${bg}`}>
          <span className={`text-lg ${accent}`}>{icon}</span>
        </span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className={CARD}>
      <h3 className="text-base font-semibold text-slate-900 mb-4">{title}</h3>
      {children}
    </div>
  )
}

const currencyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/dashboard').then((res) => setData(res.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-slate-500">
        Failed to load dashboard data.
      </div>
    )
  }

  const payrollByMonth = (data.payroll_by_month || []).map((d) => ({
    ...d,
    label: d.label,
    total: Number(d.total || 0),
    fiat: Number(d.fiat || 0),
    crypto: Number(d.crypto || 0),
  }))

  const cryptoVsFiat = []
  const cvf = data.crypto_vs_fiat || {}
  if (cvf.crypto || cvf.fiat) {
    cryptoVsFiat.push({ name: 'Crypto', value: Number(cvf.crypto || 0) })
    cryptoVsFiat.push({ name: 'Fiat', value: Number(cvf.fiat || 0) })
  }

  const byDepartment = (data.payroll_by_department || []).map((d) => ({
    department: d.department,
    total: Number(d.total || 0),
  }))

  const avgByJobTitle = (data.avg_salary_by_job_title || []).map((d) => ({
    job_title: d.job_title,
    avg: Number(d.avg_salary || 0),
    currency: d.currency || 'EUR',
  }))

  const topDepartments = (data.top_departments || []).slice(0, 8).map((d) => ({
    department: d.department,
    total: Number(d.total || 0),
  }))

  const payrollGrowth = (data.payroll_growth || []).map((d) => ({
    label: d.label,
    growth: d.growth_pct != null ? Number(d.growth_pct) : null,
    total: Number(d.total || 0),
  }))

  const avgSalaryOverall = avgByJobTitle.length
    ? avgByJobTitle.reduce((s, d) => s + d.avg, 0) / avgByJobTitle.length
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Payroll overview and analytics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total payroll this month (USDC)"
          value={fmt(data.total_payroll_usdc ?? data.total_payroll_this_month)}
          icon="💰"
          accent="text-indigo-600"
          bg="bg-indigo-50"
        />
        <MetricCard
          label="Active Employees"
          value={fmtNum(data.active_employees)}
          icon="👥"
          accent="text-blue-600"
          bg="bg-blue-50"
        />
        <MetricCard
          label="Pending Payments"
          value={
            <span className={Number(data.pending_payments) > 0 ? 'text-amber-600' : ''}>
              {fmtNum(data.pending_payments)}
            </span>
          }
          icon="⏳"
          accent="text-amber-600"
          bg="bg-amber-50"
        />
        <MetricCard
          label="Inactive Employees"
          value={fmtNum(data.inactive_employees)}
          icon="🚫"
          accent="text-slate-600"
          bg="bg-slate-100"
        />
        <MetricCard
          label="Total Crypto Payouts"
          value={fmt(data.total_crypto_payouts)}
          icon="₿"
          accent="text-emerald-600"
          bg="bg-emerald-50"
        />
        <MetricCard
          label="Total Fiat Payouts"
          value={fmt(data.total_fiat_payouts)}
          icon="🏦"
          accent="text-blue-600"
          bg="bg-blue-50"
        />
        <MetricCard
          label="Average Salary"
          value={fmt(avgSalaryOverall)}
          icon="📊"
          accent="text-violet-600"
          bg="bg-violet-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Payroll by Month">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={payrollByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={fmtNum} />
              <Tooltip content={currencyTooltip} />
              <Bar dataKey="total" name="Total" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Crypto vs Fiat Distribution">
          {cryptoVsFiat.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={cryptoVsFiat}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={4}
                >
                  {cryptoVsFiat.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">
              No payroll data yet. Create a payroll period first.
            </div>
          )}
        </ChartCard>

        <ChartCard title="Payroll by Department">
          {byDepartment.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byDepartment} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={fmtNum} />
                <YAxis type="category" dataKey="department" tick={{ fontSize: 12, fill: '#64748b' }} width={120} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="total" name="Total" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">No data</div>
          )}
        </ChartCard>

        <ChartCard title="Avg Salary by Job Title">
          {avgByJobTitle.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={avgByJobTitle} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={fmtNum} />
                <YAxis type="category" dataKey="job_title" tick={{ fontSize: 12, fill: '#64748b' }} width={140} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-sm">
                      <p className="font-medium text-slate-700 mb-1">{label}</p>
                      <p style={{ color: payload[0]?.color }}>
                        Avg: {fmt(payload[0]?.value)} {d?.currency || 'EUR'}
                      </p>
                    </div>
                  )
                }} />
                <Bar dataKey="avg" name="Avg Salary" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">No data</div>
          )}
        </ChartCard>

        <ChartCard title="Top Departments by Cost">
          {topDepartments.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topDepartments}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="department" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={fmtNum} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="total" name="Cost" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">No data</div>
          )}
        </ChartCard>

        <ChartCard title="Payroll Growth (Month-to-Month)">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={payrollGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={fmtNum} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Line type="monotone" dataKey="total" name="Total" stroke="#4f46e5" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
