import { getServerSession } from 'next-auth/next';
import authOptions from '../../lib/auth';
import { getParentDashboardData } from '@/lib/parentDashboard';
import { LogoutButton } from '@/components/LogoutButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChildProgressCard } from '@/components/parent/ChildProgressCard';
import { WeakAreasChart } from '@/components/parent/WeakAreasChart';

export default async function ParentPage() {
  const session = await getServerSession(authOptions);
  if (!session) return <p>Redirecting to login...</p>;
  if (session.user?.role !== 'PARENT') return <p>Unauthorized</p>;

  const dashboard = await getParentDashboardData(session.user.id);

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-10">
      <section className="mx-auto max-w-7xl space-y-8">
        <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/80 p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-sky-300">Parent dashboard</p>
              <h1 className="mt-3 text-4xl font-semibold text-white">
                Welcome back, {session.user?.name}
              </h1>
              <p className="mt-2 text-slate-400">
                Monitor your children’s progress, quiz performance, and learning gaps.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary">Invite another child</Button>
              <LogoutButton />
            </div>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="space-y-4">
            <CardHeader>
              <CardTitle>Children tracked</CardTitle>
              <CardDescription>Active learners on your account.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-white">{dashboard.totalChildren}</p>
            </CardContent>
          </Card>

          <Card className="space-y-4">
            <CardHeader>
              <CardTitle>Total time spent</CardTitle>
              <CardDescription>Combined time across all children.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-white">{dashboard.totalTimeSpent} sec</p>
            </CardContent>
          </Card>

          <Card className="space-y-4">
            <CardHeader>
              <CardTitle>Quiz score average</CardTitle>
              <CardDescription>Average score across scored attempts.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-white">{dashboard.quizAverage}%</p>
              <p className="text-sm text-slate-400">
                {dashboard.totalQuizAttempts} total quiz attempts
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="space-y-4">
            <CardHeader>
              <CardTitle>Child performance</CardTitle>
              <CardDescription>Progress details for each linked learner.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {dashboard.children.length ? (
                dashboard.children.map((child) => (
                  <ChildProgressCard key={child.id} child={child} />
                ))
              ) : (
                <p className="text-slate-400">No linked children were found on your account.</p>
              )}
            </CardContent>
          </Card>

          <WeakAreasChart weakAreas={dashboard.weakAreas} />
        </section>
      </section>
    </main>
  );
}
