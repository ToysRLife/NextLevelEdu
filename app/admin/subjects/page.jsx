import Link from 'next/link';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { getSubjects } from '@/lib/subjects';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default async function AdminSubjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return <p>Redirecting to login...</p>;
  if (session.user?.role !== 'ADMIN') return <p>Unauthorized</p>;

  const { subjects, total } = await getSubjects({ page: 1, pageSize: 50 });

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-10">
      <section className="mx-auto max-w-6xl space-y-6">
        <Card className="space-y-6">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-sky-300">Admin subjects</p>
                <CardTitle>Subject management</CardTitle>
                <CardDescription>
                  Review and manage the curriculum subjects available on the platform.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge>{total} subjects</Badge>
                <Button asChild>
                  <Link href="/subjects/new">Create subject</Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {subjects.length ? (
              <div className="grid gap-4">
                {subjects.map((subject) => (
                  <article
                    key={subject.id}
                    className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
                          Grade {subject.grade}
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold text-slate-100">
                          {subject.name}
                        </h2>
                        <p className="mt-2 text-slate-400">
                          {subject.description ?? 'No description provided.'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge>Order {subject.order}</Badge>
                        <Button variant="secondary" asChild>
                          <Link href={`/subjects/${subject.id}`}>View</Link>
                        </Button>
                        <Button variant="secondary" asChild>
                          <Link href={`/subjects/${subject.id}/edit`}>Edit</Link>
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-slate-400">No subjects have been created yet.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
