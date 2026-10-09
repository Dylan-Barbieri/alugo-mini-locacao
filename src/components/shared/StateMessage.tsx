import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Inbox } from 'lucide-react';

type StateMessageProps = {
  title: string;
  description: string;
  variant?: 'empty' | 'error' | 'loading';
  icon?: LucideIcon;
};

export function StateMessage({
  title,
  description,
  variant = 'empty',
  icon: Icon,
}: StateMessageProps) {
  const FallbackIcon = variant === 'error' ? AlertTriangle : Inbox;
  const DisplayIcon = Icon ?? FallbackIcon;

  return (
    <div className="rounded-card border border-dashed border-sand-100 bg-white p-8 text-center">
      <DisplayIcon className="mx-auto h-9 w-9 text-brand-600" aria-hidden="true" />
      <h2 className="mt-4 text-lg font-bold text-ink-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-ink-700">{description}</p>
    </div>
  );
}
