import { Link } from 'react-router-dom';
import { StateMessage } from '@/components/shared/StateMessage';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-sand-50 p-6">
      <div className="mx-auto max-w-3xl">
        <StateMessage
          variant="error"
          title="Página não encontrada"
          description="A rota solicitada não existe no painel Alu.GO Mini-Locação."
        />
        <div className="mt-6 text-center">
          <Link
            className="rounded-full bg-ink-900 px-5 py-3 text-sm font-semibold text-white"
            to="/"
          >
            Voltar ao Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
