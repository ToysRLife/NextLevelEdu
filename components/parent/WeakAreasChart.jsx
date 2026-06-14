import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

function getBarWidth(score) {
  return `${Math.min(Math.max(score, 0), 100)}%`;
}

export function WeakAreasChart({ weakAreas }) {
  return (
    <Card className="space-y-4">
      <CardHeader>
        <CardTitle>Weak areas</CardTitle>
        <CardDescription>
          Subjects with the lowest average scores across your children.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {weakAreas.length ? (
          <div className="space-y-4">
            {weakAreas.map((area) => (
              <div key={area.subjectId} className="space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>{area.subjectName}</span>
                  <span>{area.averageScore}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-rose-500"
                    style={{ width: getBarWidth(area.averageScore) }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No weak areas identified yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
