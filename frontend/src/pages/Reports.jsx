import { useState, useEffect } from 'react'
import api from '../api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts'

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#0ea5e9', '#f43f5e', '#8b5cf6']
const CARD = 'bg-white rounded-xl border border-slate-200 shadow-sm p-6'

const fmt = (v) =>
  Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtNum = (v) =>
  Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })

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

function ChartCard({ title, children }) {
  return (
    <div className={CARD}>
      <h3 className="text-base font-semibold text-slate-900 mb-4">{title}</h3>
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">
      No data available
    </div>
  )
}

export default function Reports() {
  const [payrollByMonth, setPayrollByMonth] = useState([])
  const [payrollByDept, setPayrollByDept] = useState([])
  const [payrollByEntity, setPayrollByEntity] = useState([])
  const [cryptoVsFiat, setCryptoVsFiat] = useState([])
  const [salaryDist, setSalaryDist] = useState([])
  const [trends, setTrends] = useState([])
  const [topDepts, setTopDepts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/reports/payroll-by-month'),
      api.get('/reports/payroll-by-department'),
      api.get('/reports/payroll-by-legal-entity'),
      api.get('/reports/crypto-vs-fiat'),
      api.get('/reports/salary-distribution'),
      api.get('/reports/payroll-trends'),
      api.get('/reports/top-departments'),
    ])
      .then(([month, dept, entity, crypto, salary, trend, top]) => {
        setPayrollByMonth(month.data.map((d) => ({
          ...d,
          label: d.period_label,
          total: Number(d.total || 0),
          fiat: Number(d.fiat_total || 0),
          crypto: Number(d.crypto_total || 0),
        })))

        setPayrollByDept(dept.data.map((d) => ({
          department: d.department,
          total: Number(d.total || 0),
          count: d.employee_count || 0,
        })))

        setPayrollByEntity(entity.data.map((d) => ({
          legal_entity: d.legal_entity,
          total: Number(d.total || 0),
          count: d.employee_count || 0,
        })))

        const cv = crypto.data
        const cvfArray = []
        if (cv.crypto_total || cv.fiat_total) {
          cvfArray.push({ name: 'Crypto', value: Number(cv.crypto_total || 0) })
          cvfArray.push({ name: 'Fiat', value: Number(cv.fiat_total || 0) })
        }
        setCryptoVsFiat(cvfArray)

        setSalaryDist(salary.data.map((d) => ({ ...d, count: Number(d.count || 0) })))

        setTrends(trend.data.map((d) => ({
          label: d.period_label,
          total: Number(d.total || 0),
          growth_pct: d.growth_pct,
        })))

        setTopDepts(top.data.map((d) => ({
          department: d.department,
          total: Number(d.total || 0),
        })))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-slate-500 text-sm mt-1">Payroll analytics and breakdowns</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Payroll by Month">
          {payrollByMonth.some((d) => d.total > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={payrollByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={fmtNum} />
                <Tooltip content={currencyTooltip} />
                <Bar dataKey="total" name="Total" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Payroll by Department">
          {payrollByDept.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={payrollByDept} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={fmtNum} />
                <YAxis type="category" dataKey="department" tick={{ fontSize: 12, fill: '#64748b' }} width={120} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="total" name="Total" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Payroll by Legal Entity">
          {payrollByEntity.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={payrollByEntity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="legal_entity" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={fmtNum} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="total" name="Total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Crypto vs Fiat Payments">
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
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Salary Distribution">
          {salaryDist.some((d) => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salaryDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="range" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Employees" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Payroll Trends (Month-over-Month)">
          {trends.some((d) => d.total > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={fmtNum} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Line type="monotone" dataKey="total" name="Total" stroke="#f43f5e" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Top Departments by Payroll Cost">
          {topDepts.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topDepts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="department" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={fmtNum} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="total" name="Cost" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>
      </div>
    </div>
  )
}
