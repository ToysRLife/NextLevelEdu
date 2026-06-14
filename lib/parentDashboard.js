import { getServerSession } from 'next-auth/next';
import authOptions from './auth';
import prisma from './prisma';

function roundValue(value) {
  return value === null || value === undefined ? 0 : Math.round(value * 100) / 100;
}

export async function getParentChildren(parentId) {
  const links = await prisma.parentStudent.findMany({
    where: { parentId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          grade: true,
        },
      },
    },
  });

  const childIds = links.map((link) => link.student.id);
  if (!childIds.length) {
    return { children: [], totalTimeSpent: 0, quizAverage: 0, totalQuizAttempts: 0, weakAreas: [] };
  }

  const [overview, statusGroups, subjectScores] = await Promise.all([
    prisma.progress.groupBy({
      by: ['studentId'],
      where: { studentId: { in: childIds } },
      _count: { id: true },
      _avg: { score: true },
      _sum: { durationSec: true },
    }),
    prisma.progress.groupBy({
      by: ['studentId', 'status'],
      where: { studentId: { in: childIds } },
      _count: { id: true },
    }),
    prisma.progress.groupBy({
      by: ['subjectId'],
      where: {
        studentId: { in: childIds },
        subjectId: { not: null },
        score: { not: null },
      },
      _avg: { score: true },
      _count: { id: true },
    }),
  ]);

  const totalProgressRecords = await prisma.progress.count({
    where: { studentId: { in: childIds } },
  });
  const totalDuration = await prisma.progress.aggregate({
    _sum: { durationSec: true },
    where: { studentId: { in: childIds } },
  });
  const scoredAttempts = await prisma.progress.count({
    where: { studentId: { in: childIds }, score: { not: null } },
  });
  const averageQuizScore = await prisma.progress.aggregate({
    _avg: { score: true },
    where: { studentId: { in: childIds }, score: { not: null } },
  });

  const subjectIds = subjectScores.map((item) => item.subjectId).filter(Boolean);
  const subjects = await prisma.subject.findMany({
    where: { id: { in: subjectIds } },
    select: { id: true, name: true },
  });

  const subjectMap = subjects.reduce((map, subject) => {
    map[subject.id] = subject.name;
    return map;
  }, {});

  const weakAreas = subjectScores
    .map((item) => ({
      subjectId: item.subjectId,
      subjectName: subjectMap[item.subjectId] ?? 'Unknown subject',
      averageScore: roundValue(item._avg.score),
      attempts: item._count.id,
    }))
    .sort((a, b) => a.averageScore - b.averageScore)
    .slice(0, 5);

  const statusMap = statusGroups.reduce((memo, entry) => {
    const studentId = entry.studentId;
    memo[studentId] ??= { total: 0, completed: 0, inProgress: 0, failed: 0 };
    memo[studentId].total += entry._count.id;

    if (entry.status === 'COMPLETED') memo[studentId].completed = entry._count.id;
    if (entry.status === 'IN_PROGRESS') memo[studentId].inProgress = entry._count.id;
    if (entry.status === 'FAILED') memo[studentId].failed = entry._count.id;

    return memo;
  }, {});

  const children = links.map((link) => {
    const student = link.student;
    const record = overview.find((item) => item.studentId === student.id);
    const statusRecord = statusMap[student.id] ?? {
      total: 0,
      completed: 0,
      inProgress: 0,
      failed: 0,
    };
    const progressPercent = record?._count.id
      ? Math.round((statusRecord.completed / record._count.id) * 100)
      : 0;

    return {
      id: student.id,
      name: `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim() || 'Child learner',
      grade: student.grade ?? null,
      progressPercent,
      averageScore: roundValue(record?._avg.score),
      timeSpent: record?._sum.durationSec ?? 0,
      progressCount: record?._count.id ?? 0,
      completedLessons: statusRecord.completed,
      inProgressLessons: statusRecord.inProgress,
      failedLessons: statusRecord.failed,
    };
  });

  return {
    children,
    totalChildren: children.length,
    totalTimeSpent: totalDuration._sum.durationSec ?? 0,
    quizAverage: roundValue(averageQuizScore._avg.score),
    totalQuizAttempts: scoredAttempts,
    weakAreas,
    totalProgressRecords,
  };
}

export async function getParentDashboardData(parentId) {
  return getParentChildren(parentId);
}

export async function requireParentSession(request) {
  const session = await getServerSession(authOptions, request);
  if (!session || session.user?.role !== 'PARENT') {
    return null;
  }
  return session;
}
