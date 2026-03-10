import { Toaster } from 'react-hot-toast'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import EmployeeForm from './pages/EmployeeForm'
import EmployeeDetail from './pages/EmployeeDetail'
import Payroll from './pages/Payroll'
import PayrollDetail from './pages/PayrollDetail'
import Payments from './pages/Payments'
import Invoices from './pages/Invoices'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Requests from './pages/Requests'
import EmployeePortal from './pages/EmployeePortal'

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
  if (!user) return <Navigate to="/login" />
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" />
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  const isEmployee = user?.role === 'employee'

  if (isEmployee) {
    return (
      <Routes>
        <Route path="/portal" element={<ProtectedRoute><Layout><EmployeePortal /></Layout></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/portal" />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/employees" element={<ProtectedRoute><Layout><Employees /></Layout></ProtectedRoute>} />
      <Route path="/employees/new" element={<ProtectedRoute><Layout><EmployeeForm /></Layout></ProtectedRoute>} />
      <Route path="/employees/:id/edit" element={<ProtectedRoute><Layout><EmployeeForm /></Layout></ProtectedRoute>} />
      <Route path="/employees/:id" element={<ProtectedRoute><Layout><EmployeeDetail /></Layout></ProtectedRoute>} />
      <Route path="/payroll" element={<ProtectedRoute><Layout><Payroll /></Layout></ProtectedRoute>} />
      <Route path="/payroll/:id" element={<ProtectedRoute><Layout><PayrollDetail /></Layout></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><Layout><Payments /></Layout></ProtectedRoute>} />
      <Route path="/invoices" element={<ProtectedRoute><Layout><Invoices /></Layout></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Layout><Reports /></Layout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
      <Route path="/requests" element={<ProtectedRoute><Layout><Requests /></Layout></ProtectedRoute>} />
      <Route path="/portal" element={<ProtectedRoute><Layout><EmployeePortal /></Layout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      </AuthProvider>
    </BrowserRouter>
  )
}
