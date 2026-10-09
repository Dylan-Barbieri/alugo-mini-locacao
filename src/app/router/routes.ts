import type { LucideIcon } from 'lucide-react';
import { Bike, FileText, LayoutDashboard, ReceiptText, Users } from 'lucide-react';

export type AppRoute = {
  path: string;
  label: string;
  icon: LucideIcon;
};

export const appRoutes: AppRoute[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/clientes', label: 'Clientes', icon: Users },
  { path: '/veiculos', label: 'Veículos', icon: Bike },
  { path: '/contratos', label: 'Contratos', icon: FileText },
  { path: '/financeiro', label: 'Financeiro', icon: ReceiptText },
];
