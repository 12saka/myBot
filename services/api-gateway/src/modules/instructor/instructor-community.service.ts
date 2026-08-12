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

  async createDiscussion(userId: string, body: any) {
    if (!body.title || !body.content) {
      throw new BadRequestException('Discussion title and content are required.');
    }

    return this.prisma.academyDiscussion.create({
      data: {
        userId,
        title: body.title.trim(),
        content: body.content.trim(),
        courseId: body.courseId || null,
        lessonId: body.lessonId || null,
      },
      include: {
        user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
      },
    });
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
    return this.prisma.dailyActivity.findMany({
      orderBy: { publishedAt: 'desc' },
      take: 10,
      include: {
        instructor: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
      },
    });
  }

  async createDailyActivity(userId: string, body: any) {
    if (!body.title || !body.content) {
      throw new BadRequestException('Activity title and content are required.');
    }

    return this.prisma.dailyActivity.create({
      data: {
        instructorId: userId,
        type: body.type || 'TIP',
        title: body.title.trim(),
        content: body.content.trim(),
        chartUrl: body.chartUrl || null,
        publishedAt: new Date(),
      },
    });
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

    return this.prisma.questionOfTheDay.upsert({
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
