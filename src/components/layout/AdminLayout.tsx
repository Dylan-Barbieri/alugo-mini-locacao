import { LogOut, Menu } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { appRoutes } from '@/app/router/routes';
import { useAuth } from '@/app/providers/AuthProvider';
import { cn } from '@/utils/cn';

export function AdminLayout() {
  const [isOpen, setIsOpen] = useState(false);
  const auth = useAuth();
  const location = useLocation();
  const currentRoute = useMemo(
    () => appRoutes.find((route) => route.path === location.pathname) ?? appRoutes[0],
    [location.pathname],
  );

  return (
    <div className="min-h-screen bg-sand-50 text-ink-900">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-72 border-r border-sand-100 bg-ink-900 px-5 py-6 text-white shadow-xl transition-transform duration-200 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Link to="/" className="flex items-center gap-3" onClick={() => setIsOpen(false)}>
          <img src="/assets/brand/alugo-logo-placeholder.svg" alt="Alu.GO" className="h-11 w-11" />
          <div>
            <strong className="block text-lg tracking-tight">Alu.GO</strong>
            <span className="text-xs text-white/60">Mini-Locação</span>
          </div>
        </Link>

        <nav className="mt-10 space-y-2" aria-label="Menu principal">
          {appRoutes.map((route) => {
            const Icon = route.icon;
            return (
              <NavLink
                key={route.path}
                to={route.path}
                end={route.path === '/'}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition',
                    isActive
                      ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                      : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {route.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {isOpen ? (
        <button
          className="fixed inset-0 z-30 bg-ink-900/50 lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setIsOpen(false)}
        />
      ) : null}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-sand-100 bg-white/90 px-4 py-4 backdrop-blur md:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                className="rounded-xl border border-sand-100 p-2 text-ink-800 lg:hidden"
                onClick={() => setIsOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
                  Alu.GO Admin
                </p>
                <h1 className="text-xl font-bold md:text-2xl">{currentRoute.label}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 sm:inline-flex">
                Ambiente demonstrativo
              </span>
              <button
                className="inline-flex items-center gap-2 rounded-full border border-sand-100 px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-sand-50"
                onClick={() => void auth.signOut()}
                type="button"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
