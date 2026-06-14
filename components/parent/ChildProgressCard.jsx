import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export function ChildProgressCard({ child }) {
  return (
    <Card className="space-y-4">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{child.name}</CardTitle>
            <CardDescription>Grade {child.grade ?? 'N/A'}</CardDescription>
          </div>
          <Badge>{child.progressPercent}% complete</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-400">Quiz average</p>
            <p className="mt-2 text-2xl font-semibold text-slate-100">{child.averageScore ?? 0}%</p>
          </div>

          <div>
            <p className="text-sm text-slate-400">Time spent</p>
            <p className="mt-2 text-lg font-semibold text-slate-100">{child.timeSpent} sec</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>Progress</span>
              <span>{child.progressPercent}%</span>
            </div>
            <Progress value={child.progressPercent} />
          </div>

          <div className="grid gap-3 text-sm text-slate-400 sm:grid-cols-3">
            <div className="rounded-3xl bg-slate-900/80 p-3">
              <p className="text-slate-500">Completed</p>
              <p className="mt-2 text-lg font-semibold text-slate-100">{child.completedLessons}</p>
            </div>
            <div className="rounded-3xl bg-slate-900/80 p-3">
              <p className="text-slate-500">In progress</p>
              <p className="mt-2 text-lg font-semibold text-slate-100">{child.inProgressLessons}</p>
            </div>
            <div className="rounded-3xl bg-slate-900/80 p-3">
              <p className="text-slate-500">Failed</p>
              <p className="mt-2 text-lg font-semibold text-slate-100">{child.failedLessons}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
