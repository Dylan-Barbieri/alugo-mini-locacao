import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Bike } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';

export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';

  if (auth.session && auth.isAdmin) return <Navigate to={from} replace />;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await auth.signIn(email, password);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Não foi possível entrar.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-900 p-4">
      <div className="w-full max-w-md rounded-card bg-white p-8 shadow-2xl">
        <div className="mb-8 flex items-center gap-3">
          <img src="/assets/brand/alugo-logo-placeholder.svg" alt="Alu.GO" className="h-12 w-12" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
              Alu.GO
            </p>
            <h1 className="text-2xl font-bold text-ink-900">Acesso administrativo</h1>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-ink-800">
            E-mail
            <input
              className="mt-1 w-full rounded-2xl border border-sand-100 px-4 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm font-semibold text-ink-800">
            Senha
            <input
              className="mt-1 w-full rounded-2xl border border-sand-100 px-4 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {auth.error || error ? (
            <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error ?? auth.error}</p>
          ) : null}

          <button
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            <Bike className="h-4 w-4" />
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
