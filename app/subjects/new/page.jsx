import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSubject } from '@/lib/subjects';
import { SubjectForm } from '@/components/subjects/SubjectForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default async function NewSubjectPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (session.user?.role !== 'ADMIN') return <p>Unauthorized</p>;
  async function createSubjectAction(formData) {
    'use server';
    const name = String(formData.get('name') || '');
    const grade = Number(formData.get('grade') || 1);
    const description = String(formData.get('description') || '');
    const order = Number(formData.get('order') || 0);

    await createSubject({ name, grade, description, order });
    redirect('/subjects');
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-10">
      <section className="mx-auto max-w-3xl space-y-6">
        <Card className="space-y-6">
          <CardHeader>
            <CardTitle>Create subject</CardTitle>
            <CardDescription>Add a new subject for your curriculum.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3">
              <Button variant="secondary" asChild>
                <Link href="/subjects">Back</Link>
              </Button>
            </div>
            <SubjectForm action={createSubjectAction} submitLabel="Create subject" />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
