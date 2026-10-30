import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InstructorCommunityService {
  constructor(private prisma: PrismaService) {}

  // 1. Community Discussions Q&A Hub
  async getDiscussions(isSolvedFilter?: boolean) {
    return this.prisma.academyDiscussion.findMany({
      where: isSolvedFilter !== undefined ? { isSolved: isSolvedFilter } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        responses: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, email: true, role: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
          },
        },
        _count: { select: { responses: true } },
      },
    });
  }

  private async broadcastToStudents(title: string, message: string, linkUrl: string = '/academy', excludeUserId?: string) {
    try {
      const students = await this.prisma.user.findMany({
        where: excludeUserId ? { id: { not: excludeUserId } } : {},
        select: { id: true },
      });
      if (students.length === 0) return;

      const userIds = students.map((s) => s.id);
      await this.prisma.notification.deleteMany({
        where: {
          userId: { in: userIds },
          title,
          isRead: false,
        },
      });

      await this.prisma.notification.createMany({
        data: students.map((s) => ({
          userId: s.id,
          title,
          message,
          type: 'ACADEMY',
          linkUrl,
          isRead: false,
        })),
      });
    } catch (e) {}
  }

  private async notifyInstructors(title: string, message: string, linkUrl: string = '/instructor/discussions', excludeUserId?: string) {
    try {
      const instructors = await this.prisma.user.findMany({
        where: {
          role: { in: ['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'] },
          ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
        },
        select: { id: true },
      });
      if (instructors.length === 0) return;

      const userIds = instructors.map((inst) => inst.id);
      await this.prisma.notification.deleteMany({
        where: {
          userId: { in: userIds },
          title,
          isRead: false,
        },
      });

      await this.prisma.notification.createMany({
        data: instructors.map((inst) => ({
          userId: inst.id,
          title,
          message,
          type: 'ACADEMY',
          linkUrl,
          isRead: false,
        })),
      });
    } catch (e) {}
  }

  async createDiscussion(userId: string, body: any) {
    if (!body.title || !body.content) {
      throw new BadRequestException('Discussion title and content are required.');
    }

    const cleanTitle = body.title.trim();
    const existing = await this.prisma.academyDiscussion.findFirst({
      where: {
        userId,
        title: { equals: cleanTitle, mode: 'insensitive' },
      },
      include: {
        user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (existing) return existing;

    const disc = await this.prisma.academyDiscussion.create({
      data: {
        userId,
        title: cleanTitle,
        content: body.content.trim(),
        courseId: body.courseId || null,
        lessonId: body.lessonId || null,
      },
      include: {
        user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
      },
    });

    const studentName = disc.user?.profile
      ? `${disc.user.profile.firstName || ''} ${disc.user.profile.lastName || ''}`.trim() || disc.user.email
      : disc.user?.email || 'A student';

    await this.notifyInstructors(
      `💬 New Student Question: ${disc.title}`,
      `${studentName} asked: "${disc.content.slice(0, 110)}${disc.content.length > 110 ? '...' : ''}"`,
      '/instructor/discussions',
      userId,
    );

    return disc;
  }

  async replyToDiscussion(userId: string, userRole: string, discussionId: string, body: any) {
    const disc = await this.prisma.academyDiscussion.findUnique({ where: { id: discussionId } });
    if (!disc) throw new NotFoundException('Discussion thread not found');

    const isInstructor = userRole === 'INSTRUCTOR' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

    const response = await this.prisma.discussionResponse.create({
      data: {
        discussionId,
        userId,
        content: body.content.trim(),
        isInstructorReply: isInstructor,
        isPinned: body.isPinned ?? isInstructor,
      },
      include: {
        user: { select: { id: true, email: true, role: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
      },
    });

    if (body.markSolved || isInstructor) {
      await this.prisma.academyDiscussion.update({
        where: { id: discussionId },
        data: {
          isSolved: true,
          pinnedResponseId: response.id,
        },
      });
    }

    // Notify thread author when someone replies
    if (disc.userId !== userId) {
      await this.prisma.notification.create({
        data: {
          userId: disc.userId,
          title: isInstructor
            ? `✅ Official Instructor Answer: ${disc.title}`
            : `💬 New Reply on Thread: ${disc.title}`,
          message: `"${body.content.trim().slice(0, 120)}${body.content.trim().length > 120 ? '...' : ''}"`,
          type: 'ACADEMY',
          linkUrl: '/academy/community',
          isRead: false,
        },
      }).catch(() => {});
    }

    return response;
  }

  async toggleSolveDiscussion(discussionId: string, isSolved: boolean) {
    return this.prisma.academyDiscussion.update({
      where: { id: discussionId },
      data: { isSolved },
    });
  }

  // 2. Daily Trading Tip & Announcement Engine
  async getDailyActivities() {
    const raw = await this.prisma.dailyActivity.findMany({
      orderBy: { publishedAt: 'desc' },
      take: 40,
      include: {
        instructor: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
      },
    });

    const seen = new Set<string>();
    return raw.filter((act) => {
      const key = `${act.type || 'STUDY_NOTE'}::${(act.title || '').trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 30);
  }

  async createDailyActivity(userId: string, body: any) {
    if (!body.title || !body.content) {
      throw new BadRequestException('Activity title and content are required.');
    }

    const cleanTitle = body.title.trim();
    const existing = await this.prisma.dailyActivity.findFirst({
      where: {
        title: { equals: cleanTitle, mode: 'insensitive' },
        type: body.type || 'STUDY_NOTE',
      },
    });

    const activity = existing
      ? await this.prisma.dailyActivity.update({
          where: { id: existing.id },
          data: {
            content: body.content.trim(),
            chartUrl: body.chartUrl || existing.chartUrl,
            publishedAt: new Date(),
          },
        })
      : await this.prisma.dailyActivity.create({
          data: {
            instructorId: userId,
            type: body.type || 'STUDY_NOTE',
            title: cleanTitle,
            content: body.content.trim(),
            chartUrl: body.chartUrl || null,
            publishedAt: new Date(),
          },
        });

    const typeLabel =
      activity.type === 'CHART_BREAKDOWN'
        ? 'Market Chart Breakdown'
        : activity.type === 'STUDY_NOTE'
        ? 'Study Note'
        : activity.type === 'SESSION_RECAP'
        ? 'Session Recap'
        : 'Trading Tip';

    if (!existing) {
      await this.broadcastToStudents(
        `📝 New Instructor ${typeLabel}: ${activity.title}`,
        `${activity.content.slice(0, 120)}${activity.content.length > 120 ? '...' : ''}`,
        '/academy',
        userId,
      );
    }

    return activity;
  }

  // 3. Question of the Day Engine
  async getTodayQotd() {
    const todayStr = new Date().toISOString().slice(0, 10);
    let qotd = await this.prisma.questionOfTheDay.findFirst({
      where: { date: todayStr },
      include: {
        instructor: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
        _count: { select: { responses: true } },
      },
    });

    // Fallback to latest QOTD if none published for today
    if (!qotd) {
      qotd = await this.prisma.questionOfTheDay.findFirst({
        orderBy: { createdAt: 'desc' },
        include: {
          instructor: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
          _count: { select: { responses: true } },
        },
      });
    }

    return qotd;
  }

  async createQotd(userId: string, body: any) {
    const todayStr = body.date || new Date().toISOString().slice(0, 10);

    if (!body.questionText || !body.options || !Array.isArray(body.options)) {
      throw new BadRequestException('Question text and options array are required.');
    }

    const qotd = await this.prisma.questionOfTheDay.upsert({
      where: { date: todayStr },
      update: {
        title: body.title?.trim() || "Today's Trading Challenge 🧠",
        questionText: body.questionText.trim(),
        chartUrl: body.chartUrl || null,
        options: body.options,
        correctOptionIndex: Number(body.correctOptionIndex || 0),
        explanation: body.explanation?.trim() || 'Institutional price action breakdown.',
      },
      create: {
        instructorId: userId,
        date: todayStr,
        title: body.title?.trim() || "Today's Trading Challenge 🧠",
        questionText: body.questionText.trim(),
        chartUrl: body.chartUrl || null,
        options: body.options,
        correctOptionIndex: Number(body.correctOptionIndex || 0),
        explanation: body.explanation?.trim() || 'Institutional price action breakdown.',
      },
    });

    await this.broadcastToStudents(
      `🔥 Daily Challenge Published: ${qotd.title}`,
      `${qotd.questionText.slice(0, 110)}${qotd.questionText.length > 110 ? '...' : ''} (+50 XP Reward)`,
      '/academy/qotd',
      userId,
    );

    return qotd;
  }

  async answerQotd(userId: string, qotdId: string, selectedOptionIndex: number) {
    const qotd = await this.prisma.questionOfTheDay.findUnique({ where: { id: qotdId } });
    if (!qotd) throw new NotFoundException('Question of the Day not found.');

    const isCorrect = selectedOptionIndex === qotd.correctOptionIndex;

    const response = await this.prisma.qotdResponse.upsert({
      where: { qotdId_userId: { qotdId, userId } },
      update: {
        selectedOptionIndex,
        isCorrect,
      },
      create: {
        qotdId,
        userId,
        selectedOptionIndex,
        isCorrect,
      },
    });

    // Award XP
    const xpPoints = isCorrect ? 50 : 15;
    await this.prisma.userGamification.upsert({
      where: { userId },
      update: { xpPoints: { increment: xpPoints } },
      create: { userId, xpPoints },
    });

    return {
      response,
      isCorrect,
      correctOptionIndex: qotd.correctOptionIndex,
      explanation: qotd.explanation,
      xpEarned: xpPoints,
    };
  }

  // 4. Gamification Leaderboard
  async getWeeklyLeaderboard() {
    const gamifications = await this.prisma.userGamification.findMany({
      take: 20,
      orderBy: { xpPoints: 'desc' },
      include: {
        user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
      },
    });

    return gamifications.map((g, idx) => ({
      rank: idx + 1,
      userId: g.userId,
      name: g.user?.profile ? `${g.user.profile.firstName || ''} ${g.user.profile.lastName || ''}`.trim() || 'Trader' : 'Trader',
      avatarUrl: g.user?.profile?.avatarUrl,
      xpPoints: g.xpPoints,
      streakDays: g.currentStreakDays,
    }));
  }
}
