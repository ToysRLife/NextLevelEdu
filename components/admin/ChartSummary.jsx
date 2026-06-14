import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

function normalizeValue(value, maxValue) {
  return maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
}

export function ChartSummary({ title, description, data, labelKey, valueKey }) {
  const maxValue = data.reduce((max, item) => Math.max(max, item[valueKey]), 0);

  return (
    <Card className="space-y-4">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item) => (
            <div key={item[labelKey]} className="space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>{item[labelKey]}</span>
                <span>{item[valueKey]}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-sky-400 transition-all duration-300"
                  style={{ width: `${normalizeValue(item[valueKey], maxValue)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
