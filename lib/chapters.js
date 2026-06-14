import prisma from './prisma';

export async function getChaptersForSubject(subjectId, studentId) {
  const chapters = await prisma.chapter.findMany({
    where: { subjectId },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      title: true,
      description: true,
      order: true,
      progress: {
        where: {
          studentId,
          status: 'COMPLETED',
        },
        select: {
          completedAt: true,
        },
      },
    },
  });

  return chapters.map((chapter) => ({
    ...chapter,
    completed: chapter.progress.length > 0,
    completedAt: chapter.progress[0]?.completedAt ?? null,
  }));
}

export async function getChapterDetails(subjectId, chapterId, studentId) {
  const chapter = await prisma.chapter.findFirst({
    where: {
      id: chapterId,
      subjectId,
    },
    select: {
      id: true,
      subjectId: true,
      title: true,
      description: true,
      order: true,
      grade: true,
      subject: {
        select: {
          name: true,
          grade: true,
        },
      },
      progress: {
        where: {
          studentId,
          status: 'COMPLETED',
        },
        select: {
          completedAt: true,
        },
      },
    },
  });

  if (!chapter) return null;

  return {
    ...chapter,
    completed: chapter.progress.length > 0,
    completedAt: chapter.progress[0]?.completedAt ?? null,
    subjectName: chapter.subject?.name ?? '',
  };
}

export async function completeChapter(chapterId, studentId) {
  const existingProgress = await prisma.progress.findFirst({
    where: {
      studentId,
      chapterId,
    },
  });

  if (existingProgress) {
    return prisma.progress.update({
      where: { id: existingProgress.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }

  return prisma.progress.create({
    data: {
      studentId,
      chapterId,
      status: 'COMPLETED',
      completedAt: new Date(),
      attempts: 1,
    },
  });
}

export async function createChapter({ subjectId, title, description, order }) {
  const trimmedTitle = String(title || '').trim();
  if (!subjectId) throw new Error('Subject ID is required.');
  if (!trimmedTitle) throw new Error('Chapter title is required.');

  return prisma.chapter.create({
    data: {
      subjectId,
      title: trimmedTitle,
      description: description ? String(description).trim() : null,
      order: Number(order) || 0,
      grade: 1,
    },
  });
}
