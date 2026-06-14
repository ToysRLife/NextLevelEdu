import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSubjectDetails, updateSubject } from '@/lib/subjects';
import { SubjectForm } from '@/components/subjects/SubjectForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default async function EditSubjectPage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (session.user?.role !== 'ADMIN') return <p>Unauthorized</p>;
  const subject = await getSubjectDetails(params.subjectId);
  if (!subject) {
    notFound();
  }

  async function updateSubjectAction(formData) {
    'use server';
    const subjectId = String(formData.get('subjectId') || '');
    const name = String(formData.get('name') || '');
    const grade = Number(formData.get('grade') || 1);
    const description = String(formData.get('description') || '');
    const order = Number(formData.get('order') || 0);

    await updateSubject({ subjectId, name, grade, description, order });
    redirect(`/subjects/${subjectId}`);
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-10">
      <section className="mx-auto max-w-3xl space-y-6">
        <Card className="space-y-6">
          <CardHeader>
            <CardTitle>Edit subject</CardTitle>
            <CardDescription>Update fields for this subject and save changes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3">
              <Button variant="secondary" asChild>
                <Link href={`/subjects/${params.subjectId}`}>Back to subject</Link>
              </Button>
            </div>
            <SubjectForm
              action={updateSubjectAction}
              submitLabel="Save changes"
              initialData={subject}
            />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
