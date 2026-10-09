import { cn } from '@/utils/cn';

type StatusBadgeProps = {
  children: string;
  tone?: 'success' | 'warning' | 'neutral' | 'danger';
};

const toneClass = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  warning: 'bg-amber-50 text-amber-700 ring-amber-100',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  danger: 'bg-red-50 text-red-700 ring-red-100',
};

export function StatusBadge({ children, tone = 'neutral' }: StatusBadgeProps) {
  return (
    <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold ring-1', toneClass[tone])}>
      {children}
    </span>
  );
}
