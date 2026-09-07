import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/ProductsPage';
import { UsersPage } from './pages/UsersPage';
import { StockPage } from './pages/StockPage';
import { InventoryPage } from './pages/InventoryPage';
import { HistoryPage } from './pages/HistoryPage';
import { VendorsPage } from './pages/VendorsPage';
import { SalesPage } from './pages/SalesPage';
import { CustomersPage } from './pages/CustomersPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { AttendancePage } from './pages/AttendancePage';
import { AttendanceReportPage } from './pages/AttendanceReportPage';
import { SelfAttendancePage } from './pages/SelfAttendancePage';
import { PayrollPage } from './pages/PayrollPage';
import { MyProfilePage } from './pages/MyProfilePage';
import { LeavePage } from './pages/LeavePage';
import { PayrollSettingsPage } from './pages/PayrollSettingsPage';
import { LeaveSettingsPage } from './pages/LeaveSettingsPage';
import { LeaveApprovalsPage } from './pages/LeaveApprovalsPage';
import { ResignationsPage } from './pages/ResignationsPage';
import { BackupPage } from './pages/BackupPage';

import { ProtectedRoute } from './components/ProtectedRoute';
import { HomeRoute, RoleRoute } from './components/RoleRoute';
import { IntroPage } from './pages/IntroPage';

export const router = createBrowserRouter([
  { path: '/intro', element: <IntroPage /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <HomeRoute>
            <DashboardPage />
          </HomeRoute>
        ),
      },
      {
        path: 'products',
        element: (
          <RoleRoute allow={['admin', 'manager', 'supervisor', 'warehouse', 'sales']}>
            <ProductsPage />
          </RoleRoute>
        ),
      },
      {
        path: 'stock',
        element: (
          <RoleRoute allow={['admin', 'manager', 'supervisor', 'warehouse', 'sales']}>
            <StockPage />
          </RoleRoute>
        ),
      },
      {
        path: 'inventory',
        element: (
          <RoleRoute allow={['admin', 'manager', 'supervisor', 'warehouse', 'sales']}>
            <InventoryPage />
          </RoleRoute>
        ),
      },
      {
        path: 'vendors',
        element: (
          <RoleRoute allow={['admin', 'manager', 'supervisor', 'warehouse']}>
            <VendorsPage />
          </RoleRoute>
        ),
      },
      {
        path: 'sales',
        element: (
          <RoleRoute allow={['admin', 'manager', 'supervisor', 'warehouse', 'sales']}>
            <SalesPage />
          </RoleRoute>
        ),
      },
      {
        path: 'customers',
        element: (
          <RoleRoute allow={['admin', 'manager', 'supervisor', 'sales']}>
            <CustomersPage />
          </RoleRoute>
        ),
      },
      {
        path: 'history',
        element: (
          <RoleRoute allow={['admin', 'manager', 'supervisor', 'warehouse', 'sales']}>
            <HistoryPage />
          </RoleRoute>
        ),
      },
      { path: 'my-attendance', element: <SelfAttendancePage /> },
      { path: 'my-profile', element: <MyProfilePage /> },
      { path: 'leave', element: <LeavePage /> },
      { path: 'resignations', element: <ResignationsPage /> },

      {
        path: 'leave/approvals',
        element: (
          <RoleRoute allow={['admin', 'manager', 'supervisor']}>
            <LeaveApprovalsPage />
          </RoleRoute>
        ),
      },
      {
        path: 'leave/settings',
        element: (
          <RoleRoute allow={['admin', 'manager', 'supervisor']}>
            <LeaveSettingsPage />
          </RoleRoute>
        ),
      },
      {
        path: 'backups',
        element: (
          <RoleRoute allow={['admin', 'manager']}>
            <BackupPage />
          </RoleRoute>
        ),
      },
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
        path: 'attendance/report',
        element: (
          <RoleRoute allow={['admin', 'manager', 'supervisor']}>
            <AttendanceReportPage />
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
        path: 'payroll/settings',
        element: (
          <RoleRoute allow={['admin', 'manager']}>
            <PayrollSettingsPage />
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
