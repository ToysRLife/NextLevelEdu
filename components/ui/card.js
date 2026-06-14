import { cn } from '@/lib/utils';

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-slate-800/60 bg-slate-950/70 p-6 shadow-xl shadow-slate-950/20 backdrop-blur-xl',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('mb-6 space-y-2', className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h2 className={cn('text-lg font-semibold text-slate-100', className)} {...props} />;
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('text-sm text-slate-400', className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn('space-y-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return <div className={cn('pt-4 text-sm text-slate-400', className)} {...props} />;
}
