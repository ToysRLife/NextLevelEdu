import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSubjects, deleteSubject } from '@/lib/subjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

function buildQuery(search, page) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (page && page > 1) params.set('page', String(page));
  return params.toString() ? `?${params.toString()}` : '';
}

export default async function SubjectsPage({ searchParams }) {
  const search = String(searchParams.search || '');
  const page = Math.max(1, Number(searchParams.page || 1));
  const { subjects, total, pageSize, totalPages } = await getSubjects({
    search,
    page,
    pageSize: 10,
  });

  async function deleteSubjectAction(formData) {
    'use server';
    const subjectId = formData.get('subjectId');
    if (!subjectId) {
      throw new Error('Subject ID is required.');
    }
    await deleteSubject(String(subjectId));
    redirect(`/subjects${buildQuery(search, page)}`);
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-10">
      <section className="mx-auto max-w-7xl space-y-6">
        <Card className="space-y-6">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-sky-300">Subjects</p>
                <CardTitle>Manage learning topics</CardTitle>
                <CardDescription>
                  Browse available subjects and maintain the platform content with search and
                  pagination.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild>
                  <Link href="/subjects/new">Create subject</Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-[1.5fr_0.9fr]">
              <form
                action="/subjects"
                method="get"
                className="flex flex-col gap-3 sm:flex-row sm:items-center"
              >
                <Input name="search" defaultValue={search} placeholder="Search subjects…" />
                <Button type="submit">Search</Button>
              </form>
              <div className="flex items-center justify-end gap-3">
                <Badge>{total} total subjects</Badge>
                <Badge>
                  Page {page} of {totalPages}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {subjects.length ? (
            subjects.map((subject) => (
              <Card key={subject.id} className="space-y-4">
                <CardHeader>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
                        Grade {subject.grade}
                      </p>
                      <CardTitle>{subject.name}</CardTitle>
                      <CardDescription>
                        {subject.description ?? 'No description provided.'}
                      </CardDescription>
                    </div>
                    <Badge>Order {subject.order}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="secondary" asChild>
                      <Link href={`/subjects/${subject.id}`}>View</Link>
                    </Button>
                    <Button variant="secondary" asChild>
                      <Link href={`/subjects/${subject.id}/edit`}>Edit</Link>
                    </Button>
                    <form action={deleteSubjectAction} className="inline">
                      <input type="hidden" name="subjectId" value={subject.id} />
                      <Button variant="secondary" type="submit">
                        Delete
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="rounded-3xl border border-slate-800 bg-slate-950/80 p-8 text-slate-400">
              <p>No subjects match your search.</p>
            </Card>
          )}
        </div>

        {totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {Array.from({ length: totalPages }, (_, index) => {
              const pageNumber = index + 1;
              const href = `/subjects${buildQuery(search, pageNumber)}`;
              return (
                <Link
                  key={pageNumber}
                  href={href}
                  className={`rounded-full px-4 py-2 text-sm ${pageNumber === page ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  {pageNumber}
                </Link>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
}
