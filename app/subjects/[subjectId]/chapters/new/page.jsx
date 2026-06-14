import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createChapter } from '@/lib/chapters';
import { getSubjectDetails } from '@/lib/subjects';
import { ChapterForm } from '@/components/chapters/ChapterForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default async function NewChapterPage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (session.user?.role !== 'ADMIN') return <p>Unauthorized</p>;

  const subject = await getSubjectDetails(params.subjectId);

  if (!subject) {
    return <p>Subject not found.</p>;
  }

  async function createChapterAction(formData) {
    'use server';
    const title = String(formData.get('title') || '');
    const description = String(formData.get('description') || '');
    const order = Number(formData.get('order') || 0);

    await createChapter({
      subjectId: params.subjectId,
      title,
      description,
      order,
    });

    redirect(`/subjects/${params.subjectId}`);
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-10">
      <section className="mx-auto max-w-3xl space-y-6">
        <Card className="space-y-6">
          <CardHeader>
            <CardTitle>Create chapter</CardTitle>
            <CardDescription>Add a new chapter for {subject.name}.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3">
              <Button variant="secondary" asChild>
                <Link href={`/subjects/${params.subjectId}`}>Back to subject</Link>
              </Button>
            </div>
            <ChapterForm action={createChapterAction} submitLabel="Create chapter" />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
