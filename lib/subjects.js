import prisma from './prisma';

const DEFAULT_PAGE_SIZE = 10;

export async function getSubjects({ search = '', page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const currentPage = Math.max(1, Number(page) || 1);
  const currentPageSize = Math.max(1, Math.min(Number(pageSize) || DEFAULT_PAGE_SIZE, 50));
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }
    : undefined;

  const [subjects, total] = await Promise.all([
    prisma.subject.findMany({
      where,
      orderBy: { order: 'asc' },
      skip: (currentPage - 1) * currentPageSize,
      take: currentPageSize,
      select: {
        id: true,
        name: true,
        grade: true,
        description: true,
        order: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.subject.count({ where }),
  ]);

  return {
    subjects,
    total,
    page: currentPage,
    pageSize: currentPageSize,
    totalPages: Math.max(1, Math.ceil(total / currentPageSize)),
  };
}

export async function getSubjectDetails(subjectId) {
  return prisma.subject.findUnique({
    where: { id: subjectId },
    select: {
      id: true,
      name: true,
      grade: true,
      description: true,
      order: true,
      createdAt: true,
      updatedAt: true,
      chapters: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          order: true,
        },
      },
      games: {
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          gameType: true,
          grade: true,
        },
      },
    },
  });
}

export async function createSubject({ name, grade, description, order }) {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    throw new Error('Subject name is required.');
  }

  return prisma.subject.create({
    data: {
      name: trimmedName,
      description: description ? String(description).trim() : null,
      grade: Number(grade) || 1,
      order: Number(order) || 0,
    },
  });
}

export async function updateSubject({ subjectId, name, grade, description, order }) {
  const trimmedName = String(name || '').trim();
  if (!subjectId || !trimmedName) {
    throw new Error('Subject ID and name are required.');
  }

  return prisma.subject.update({
    where: { id: subjectId },
    data: {
      name: trimmedName,
      description: description ? String(description).trim() : null,
      grade: Number(grade) || 1,
      order: Number(order) || 0,
    },
  });
}

export async function deleteSubject(subjectId) {
  if (!subjectId) {
    throw new Error('Subject ID is required.');
  }

  return prisma.subject.delete({ where: { id: subjectId } });
}
