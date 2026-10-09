import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { StateMessage } from '@/components/shared/StateMessage';
import { NotFoundPage } from '@/features/NotFoundPage';
import { ProtectedRoute } from '@/app/router/ProtectedRoute';

const LoginPage = lazy(() =>
  import('@/features/auth/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
);
const ClientesPage = lazy(() =>
  import('@/features/clientes/ClientesPage').then((module) => ({ default: module.ClientesPage })),
);
const VeiculosPage = lazy(() =>
  import('@/features/veiculos/VeiculosPage').then((module) => ({ default: module.VeiculosPage })),
);
const ContratosPage = lazy(() =>
  import('@/features/contratos/ContratosPage').then((module) => ({
    default: module.ContratosPage,
  })),
);
const FaturasPage = lazy(() =>
  import('@/features/faturas/FaturasPage').then((module) => ({ default: module.FaturasPage })),
);

function withSuspense(element: ReactNode) {
  return (
    <Suspense
      fallback={
        <StateMessage
          title="Carregando página"
          description="Preparando a interface administrativa..."
          variant="loading"
        />
      }
    >
      {element}
    </Suspense>
  );
}

const router = createBrowserRouter([
  { path: '/login', element: withSuspense(<LoginPage />) },
  {
    path: '/',
    element: <ProtectedRoute />,
    errorElement: <NotFoundPage />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: withSuspense(<DashboardPage />) },
          { path: 'clientes', element: withSuspense(<ClientesPage />) },
          { path: 'veiculos', element: withSuspense(<VeiculosPage />) },
          { path: 'contratos', element: withSuspense(<ContratosPage />) },
          { path: 'financeiro', element: withSuspense(<FaturasPage />) },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
