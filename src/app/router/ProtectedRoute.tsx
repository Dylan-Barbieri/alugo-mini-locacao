import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { StateMessage } from '@/components/shared/StateMessage';
import { useAuth } from '@/app/providers/AuthProvider';

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.isLoading) {
    return (
      <div className="min-h-screen bg-sand-50 p-6">
        <StateMessage
          title="Carregando sessão"
          description="Validando acesso administrativo..."
          variant="loading"
        />
      </div>
    );
  }

  if (!auth.session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!auth.isAdmin) {
    return (
      <div className="min-h-screen bg-sand-50 p-6">
        <StateMessage
          title="Acesso administrativo necessário"
          description="Sua sessão está ativa, mas o usuário não está cadastrado como administrador em public.app_admins."
          variant="error"
        />
      </div>
    );
  }

  return <Outlet />;
}
