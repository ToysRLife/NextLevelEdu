import prisma from './prisma';

export async function getAdminDashboardMetrics() {
  const [totalStudents, totalSubjects, totalChapters, totalQuestions] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.subject.count(),
    prisma.chapter.count(),
    prisma.question.count(),
  ]);

  return {
    totalStudents,
    totalSubjects,
    totalChapters,
    totalQuestions,
  };
}

export async function getAdminDashboardCharts() {
  const [questionsByType, chaptersBySubject] = await Promise.all([
    prisma.question.groupBy({
      by: ['type'],
      _count: { id: true },
    }),
    prisma.subject.findMany({
      select: {
        name: true,
        _count: {
          select: { chapters: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    questionsByType: questionsByType.map((entry) => ({
      type: entry.type,
      count: entry._count.id,
    })),
    chaptersBySubject: chaptersBySubject.map((subject) => ({
      subject: subject.name,
      chapters: subject._count.chapters,
    })),
  };
}
