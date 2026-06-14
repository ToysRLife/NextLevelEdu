import { cn } from '@/lib/utils';

export function Badge({ className, variant = 'default', ...props }) {
  const variants = {
    default:
      'inline-flex items-center rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200',
    accent:
      'inline-flex items-center rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-slate-950',
  };

  return <span className={cn(variants[variant], className)} {...props} />;
}
