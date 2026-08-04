import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/ProductsPage';
import { UsersPage } from './pages/UsersPage';
import { StockPage } from './pages/StockPage';
import { HistoryPage } from './pages/HistoryPage';
import { VendorsPage } from './pages/VendorsPage';
import { CustomersPage } from './pages/CustomersPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { AttendancePage } from './pages/AttendancePage';
import { SelfAttendancePage } from './pages/SelfAttendancePage';
import { PayrollPage } from './pages/PayrollPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleRoute } from './components/RoleRoute';


export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'stock', element: <StockPage /> },
      { path: 'vendors', element: <VendorsPage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'my-attendance', element: <SelfAttendancePage /> },
      {
        path: 'users',
        element: (
          <RoleRoute allow={['admin', 'manager']}>
            <UsersPage />
          </RoleRoute>
        ),
      },
      {
        path: 'employees',
        element: (
          <RoleRoute allow={['admin', 'manager']}>
            <EmployeesPage />
          </RoleRoute>
        ),
      },
      {
        path: 'attendance',
        element: (
          <RoleRoute allow={['admin', 'manager']}>
            <AttendancePage />
          </RoleRoute>
        ),
      },
      {
        path: 'payroll',
        element: (
          <RoleRoute allow={['admin', 'manager']}>
            <PayrollPage />
          </RoleRoute>
        ),
      },

    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
