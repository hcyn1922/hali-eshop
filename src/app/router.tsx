import React from 'react';
import { Navigate, Outlet, createBrowserRouter, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { AppShell } from './AppShell';
import { can } from './permissions';
import type { StaffRole } from '../types';
import { Spinner, EmptyState } from '../ui';
import { ShieldOff } from 'lucide-react';
import { LoginPage } from '../features/auth/LoginPage';
import { RequestAccessPage } from '../features/auth/RequestAccessPage';
import { ForgotPasswordPage, SetNewPasswordPage } from '../features/auth/RecoveryPages';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { OrdersPage } from '../features/orders/OrdersPage';
import { NewOrderPage } from '../features/orders/NewOrderPage';
import { BuyersPage } from '../features/buyers/BuyersPage';
import { ProductsPage } from '../features/products/ProductsPage';
import { ProductDetailPage } from '../features/products/ProductDetailPage';
import { StockLedgerPage } from '../features/products/StockLedgerPage';
import { SuppliersPage } from '../features/suppliers/SuppliersPage';
import { SocialPage } from '../features/social/SocialPage';
import { ShopsPage } from '../features/shops/ShopsPage';
import { PricingPage } from '../features/pricing/PricingPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { StaffPage } from '../features/staff/StaffPage';
import { SettingsPage } from '../features/settings/SettingsPage';

function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-page">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

/** Signed-in area. */
function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'recovery') return <SetNewPasswordPage />;
  if (status !== 'signed-in') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <AppShell />;
}

/** Signed-out pages bounce signed-in staff to the dashboard. */
function PublicOnly() {
  const { status } = useAuth();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'recovery') return <SetNewPasswordPage />;
  if (status === 'signed-in') return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Role gate for a screen; the server enforces the same rule on every request. */
function Allow({ when, children }: { when: (role: StaffRole) => boolean; children: React.ReactNode }) {
  const { role } = useAuth();
  if (!when(role)) {
    return (
      <EmptyState
        icon={<ShieldOff className="h-6 w-6" />}
        title="You don't have access to this page"
        description="Ask the shop owner if you need it for your work."
      />
    );
  }
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    element: <PublicOnly />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/request-access', element: <RequestAccessPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/orders', element: <Allow when={can.viewOrders}><OrdersPage /></Allow> },
      { path: '/orders/new', element: <Allow when={can.createOrders}><NewOrderPage /></Allow> },
      { path: '/orders/:orderId', element: <Allow when={can.viewOrders}><OrdersPage /></Allow> },
      { path: '/buyers', element: <Allow when={can.viewBuyers}><BuyersPage /></Allow> },
      { path: '/products', element: <ProductsPage /> },
      { path: '/products/:productId', element: <ProductDetailPage /> },
      { path: '/stock', element: <StockLedgerPage /> },
      { path: '/suppliers', element: <Allow when={r => can.viewSuppliers(r) || can.manageCatalog(r) || can.manageCouriers(r)}><SuppliersPage /></Allow> },
      { path: '/shops', element: <Allow when={can.manageCatalog}><ShopsPage /></Allow> },
      { path: '/social', element: <Allow when={can.planPosts}><SocialPage /></Allow> },
      { path: '/pricing', element: <Allow when={can.viewPricing}><PricingPage /></Allow> },
      { path: '/reports', element: <Allow when={can.viewReports}><ReportsPage /></Allow> },
      { path: '/staff', element: <Allow when={can.manageStaff}><StaffPage /></Allow> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
