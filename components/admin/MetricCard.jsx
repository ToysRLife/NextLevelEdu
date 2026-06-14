import { Card } from '@/components/ui/card';

export function MetricCard({ title, value, icon, description }) {
  return (
    <Card className="rounded-[2rem] border-slate-800/70 bg-slate-950/90 p-6 text-slate-100">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{title}</p>
          <p className="mt-3 text-4xl font-semibold text-white">{value}</p>
        </div>
        <div className="flex size-14 items-center justify-center rounded-3xl bg-sky-500/10 text-sky-300">
          {icon}
        </div>
      </div>
      {description ? <p className="mt-4 text-sm text-slate-500">{description}</p> : null}
    </Card>
  );
}
