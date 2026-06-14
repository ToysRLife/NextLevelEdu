import { getServerSession } from 'next-auth/next';
import authOptions from '../../lib/auth';
import { LogoutButton } from '@/components/LogoutButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

const subjectCards = [
  { title: 'Mathematics', grade: 'Class 5', progress: 76, topics: 12 },
  { title: 'Science', grade: 'Class 5', progress: 64, topics: 8 },
  { title: 'English', grade: 'Class 5', progress: 89, topics: 10 },
];

const recentActivity = [
  { title: 'Completed 4 questions in Multiplication', time: '2 hours ago' },
  { title: 'Unlocked "Science Star" achievement', time: 'Yesterday' },
  { title: 'Finished Chapter 3: Living Things', time: '2 days ago' },
];

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return <p>Redirecting to login...</p>;
  if (session.user?.role !== 'STUDENT') return <p>Unauthorized</p>;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <Card className="space-y-6">
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-sky-300">Welcome back</p>
                  <CardTitle>Hello, {session.user?.name}</CardTitle>
                  <CardDescription>Track your learning progress and continue your adventures.</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Button>View assignments</Button>
                  <LogoutButton />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl bg-slate-900/80 p-4 text-slate-100">
                  <p className="text-sm text-slate-400">Subjects completed</p>
                  <p className="mt-2 text-3xl font-semibold">3</p>
                </div>
                <div className="rounded-3xl bg-slate-900/80 p-4 text-slate-100">
                  <p className="text-sm text-slate-400">Quiz streak</p>
                  <p className="mt-2 text-3xl font-semibold">5 days</p>
                </div>
                <div className="rounded-3xl bg-slate-900/80 p-4 text-slate-100">
                  <p className="text-sm text-slate-400">Total points</p>
                  <p className="mt-2 text-3xl font-semibold">1,280</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="space-y-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Progress summary</CardTitle>
                <Badge variant="accent">On track</Badge>
              </div>
              <CardDescription>Keep practicing to advance through your subjects.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>Mathematics</span>
                    <span>76%</span>
                  </div>
                  <Progress value={76} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>Science</span>
                    <span>64%</span>
                  </div>
                  <Progress value={64} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>English</span>
                    <span>89%</span>
                  </div>
                  <Progress value={89} />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <Card className="space-y-6">
            <CardHeader>
              <CardTitle>Subjects</CardTitle>
              <CardDescription>Choose a subject to continue your learning path.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {subjectCards.map((subject) => (
                  <Card key={subject.title} className="border-slate-800/70 bg-slate-900/90 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm uppercase tracking-[0.18em] text-slate-500">{subject.grade}</p>
                        <h3 className="mt-3 text-xl font-semibold text-slate-100">{subject.title}</h3>
                      </div>
                      <Badge>{subject.topics} topics</Badge>
                    </div>
                    <div className="mt-5 space-y-3">
                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <span>Progress</span>
                        <span>{subject.progress}%</span>
                      </div>
                      <Progress value={subject.progress} />
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="space-y-6">
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Latest learning actions from your dashboard.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.title} className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-4">
                    <p className="font-medium text-slate-100">{activity.title}</p>
                    <p className="mt-2 text-sm text-slate-500">{activity.time}</p>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter>View more activity in the student progress center.</CardFooter>
          </Card>
        </section>
      </div>
    </main>
  );
}
