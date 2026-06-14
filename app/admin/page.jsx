import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { getAdminDashboardCharts, getAdminDashboardMetrics } from '@/lib/adminDashboard';
import { MetricCard } from '@/components/admin/MetricCard';
import { ChartSummary } from '@/components/admin/ChartSummary';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LogoutButton } from '@/components/LogoutButton';

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return <p>Redirecting to login...</p>;
  if (session.user?.role !== 'ADMIN') return <p>Unauthorized</p>;

  const metrics = await getAdminDashboardMetrics();
  const charts = await getAdminDashboardCharts();

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="space-y-4 rounded-3xl border border-slate-800/70 bg-slate-950/80 p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-sky-300">Admin dashboard</p>
              <h1 className="mt-3 text-4xl font-semibold text-white">Overview</h1>
              <p className="mt-2 max-w-2xl text-slate-400">
                Review learner, content, and assessment totals along with chart-based trend
                summaries.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline">Admin only</Badge>
              <Button asChild>
                <a href="/dashboard">Student view</a>
              </Button>
              <Button asChild>
                <a href="/admin/subjects">Manage subjects</a>
              </Button>
              <LogoutButton />
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Total students"
            value={metrics.totalStudents}
            description="Registered learners on the platform"
            icon="👩‍🎓"
          />
          <MetricCard
            title="Total subjects"
            value={metrics.totalSubjects}
            description="Subjects available for assignments"
            icon="📚"
          />
          <MetricCard
            title="Total chapters"
            value={metrics.totalChapters}
            description="Chapters organized by subject"
            icon="🧭"
          />
          <MetricCard
            title="Total questions"
            value={metrics.totalQuestions}
            description="Questions available across all chapters"
            icon="📝"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_0.7fr]">
          <ChartSummary
            title="Questions by type"
            description="Distribution of questions across supported question types."
            data={charts.questionsByType}
            labelKey="type"
            valueKey="count"
          />
          <ChartSummary
            title="Chapters per subject"
            description="How chapters are distributed across your subjects."
            data={charts.chaptersBySubject}
            labelKey="subject"
            valueKey="chapters"
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-4">
            <CardHeader>
              <CardTitle>Admin insights</CardTitle>
              <CardDescription>
                Quick action and metric guidance for content planning.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-slate-400">
                <li>
                  Use these totals to identify gaps in the question bank and subject coverage.
                </li>
                <li>
                  High student counts with low chapter content may mean you should add more
                  subjects.
                </li>
                <li>Question type balance helps ensure assessments are varied and engaging.</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="space-y-4">
            <CardHeader>
              <CardTitle>Platform status</CardTitle>
              <CardDescription>Key admin KPIs for learner readiness.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-3xl bg-slate-900/80 p-4 text-sm text-slate-300">
                  <p className="font-semibold text-slate-100">Student expansion</p>
                  <p className="mt-2">
                    Monitor student population growth as new subjects and courses are published.
                  </p>
                </div>
                <div className="rounded-3xl bg-slate-900/80 p-4 text-sm text-slate-300">
                  <p className="font-semibold text-slate-100">Content refresh</p>
                  <p className="mt-2">
                    Ensure chapters and questions stay aligned with evolving curricula.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
