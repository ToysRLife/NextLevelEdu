import { cn } from '@/lib/utils';

export function Progress({ value, max = 100, className, ...props }) {
  return (
    <div className={cn('h-3 overflow-hidden rounded-full bg-slate-800', className)} {...props}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-500"
        style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
      />
    </div>
  );
}
