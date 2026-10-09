import type { PropsWithChildren } from 'react';
import { cn } from '@/utils/cn';

type CardProps = PropsWithChildren<{ className?: string }>;

export function Card({ children, className }: CardProps) {
  return (
    <section
      className={cn('rounded-card border border-sand-100 bg-white p-5 shadow-sm', className)}
    >
      {children}
    </section>
  );
}
