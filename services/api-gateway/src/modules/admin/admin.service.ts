import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // Master privilege elevation
  async claimSuperAdmin(userId: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: 'SUPER_ADMIN' },
      select: { id: true, email: true, role: true },
    });
    return { success: true, message: 'Master privileges granted to SUPER_ADMIN', user: updated };
  }

  // 1. Dashboard Overview Stats & System Health
  async getDashboardOverview() {
    const [totalUsers, totalKycPending, totalActiveSignals, totalCourses, recentAuditLogs] = await Promise.all([
      this.prisma.user.count().catch(() => 0),
      this.prisma.kycRecord.count({ where: { status: 'PENDING' } }).catch(() => 0),
      this.prisma.signal.count({ where: { expiresAt: { gt: new Date() } } }).catch(() => 0),
      this.prisma.course.count().catch(() => 0),
      this.prisma.auditLog.findMany({
        take: 8,
        orderBy: { timestamp: 'desc' },
        include: { user: { select: { email: true, role: true } } },
      }).catch(() => []),
    ]);

    let activeBrokers = 0;
    try {
      if ((this.prisma as any).userBrokerProfile) {
        activeBrokers = await (this.prisma as any).userBrokerProfile.count({ where: { status: 'connected' } });
      }
    } catch (e) {}

    return {
      totalUsers,
      totalKycPending,
      totalActiveSignals,
      totalCourses,
      activeBrokers,
      recentAuditLogs,
      systemHealth: 'OPERATIONAL',
    };
  }

  // 2. User Management
  async getUsers(query?: { search?: string; role?: string; page?: number; limit?: number }) {
    const page = Number(query?.page || 1);
    const limit = Number(query?.limit || 50);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query?.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { profile: { firstName: { contains: query.search, mode: 'insensitive' } } },
        { profile: { lastName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    if (query?.role) {
      where.role = query.role;
    }

    try {
      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            role: true,
            isTwoFactorEnabled: true,
            createdAt: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                country: true,
                avatarUrl: true,
                brokerType: true,
              },
            },
            wallet: {
              select: {
                balance: true,
              },
            },
            kyc: {
              select: {
                status: true,
                documentType: true,
                documentUrl: true,
              },
            },
          },
        }),
        this.prisma.user.count({ where }),
      ]);

      let brokerProfiles: any[] = [];
      try {
        if ((this.prisma as any).userBrokerProfile) {
          brokerProfiles = await (this.prisma as any).userBrokerProfile.findMany({
            select: {
              userId: true,
              status: true,
              brokerType: true,
              balance: true,
            },
          });
        }
      } catch (e) {}

      const brokerByUserId = new Map(brokerProfiles.map((broker: any) => [broker.userId, broker]));

      return {
        data: users.map((user) => ({
          ...user,
          brokerProfile: brokerByUserId.get(user.id) || null,
        })),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (err: any) {
      console.error('[AdminService] getUsers error:', err);
      return {
        data: [],
        meta: { total: 0, page: 1, limit, totalPages: 0 },
      };
    }
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        wallet: true,
        kyc: true,
        subscription: true,
        automationRules: true,
        transactions: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!user) throw new NotFoundException(`User with ID ${userId} not found.`);

    let brokerProfile = null;
    try {
      if ((this.prisma as any).userBrokerProfile) {
        brokerProfile = await (this.prisma as any).userBrokerProfile.findUnique({ where: { userId } });
      }
    } catch (e) {}

    return { ...user, brokerProfile };
  }

  async updateUserRoleAndStatus(adminUserId: string, targetUserId: string, payload: { role?: string; isSuspended?: boolean; balance?: number; firstName?: string; lastName?: string; telegramUrl?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId }, include: { wallet: true, profile: true } });
    if (!user) throw new NotFoundException('User not found.');

    const updateData: any = {};
    if (payload.role) updateData.role = payload.role;

    const updatedUser = await this.prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
      select: { id: true, email: true, role: true },
    });

    if (typeof payload.balance === 'number' && !isNaN(payload.balance)) {
      if (user.wallet) {
        await this.prisma.wallet.update({
          where: { userId: targetUserId },
          data: { balance: payload.balance },
        });
      } else {
        await this.prisma.wallet.create({
          data: { userId: targetUserId, balance: payload.balance, currency: 'USD' },
        });
      }
    }

    if (payload.firstName || payload.lastName || payload.telegramUrl) {
      const profileData: any = {};
      if (payload.firstName) profileData.firstName = payload.firstName;
      if (payload.lastName) profileData.lastName = payload.lastName;
      if (payload.telegramUrl) profileData.website = payload.telegramUrl;

      if (user.profile) {
        await this.prisma.profile.update({
          where: { userId: targetUserId },
          data: profileData,
        });
      } else {
        await this.prisma.profile.create({
          data: { userId: targetUserId, ...profileData },
        });
      }
    }

    // Create Audit Log
    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'ADMIN_USER_UPDATED',
        details: { targetUserId, changes: payload },
      },
    });

    return updatedUser;
  }

  async deleteUser(adminUserId: string, targetUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found.');

    await this.prisma.user.delete({ where: { id: targetUserId } });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'ADMIN_USER_DELETED',
        details: { targetUserId, email: user.email },
      },
    });

    return { success: true, message: `User ${user.email} deleted successfully.` };
  }

  // 3. KYC Queue Management
  async getKycQueue(status?: string) {
    const where: any = {};
    if (status) where.status = status;

    return this.prisma.kycRecord.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                country: true,
                nationalId: true,
              },
            },
          },
        },
      },
    });
  }

  async approveKyc(adminUserId: string, kycId: string) {
    const record = await this.prisma.kycRecord.findUnique({ where: { id: kycId } });
    if (!record) throw new NotFoundException('KYC Record not found');

    const updated = await this.prisma.kycRecord.update({
      where: { id: kycId },
      data: { status: 'APPROVED', faceVerified: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'KYC_APPROVED',
        details: { kycId, targetUserId: record.userId },
      },
    });

    return updated;
  }

  async rejectKyc(adminUserId: string, kycId: string, reason: string) {
    const record = await this.prisma.kycRecord.findUnique({ where: { id: kycId } });
    if (!record) throw new NotFoundException('KYC Record not found');

    const updated = await this.prisma.kycRecord.update({
      where: { id: kycId },
      data: { status: 'REJECTED' },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'KYC_REJECTED',
        details: { kycId, targetUserId: record.userId, reason },
      },
    });

    return updated;
  }

  // 4. Academy Content Management
  async getAdminCourses() {
    return this.prisma.course.findMany({
      orderBy: { title: 'asc' },
      include: {
        lessons: {
          orderBy: { orderIndex: 'asc' },
          select: { id: true, title: true, content: true, orderIndex: true }
        },
      },
    });
  }

  async createCourse(adminUserId: string, payload: { title: string; description: string; category: string; level: string; imageUrl?: string; isPublished?: boolean }) {
    const course = await this.prisma.course.create({
      data: {
        title: payload.title,
        description: payload.description,
        difficulty: payload.level || 'Beginner',
        category: payload.category || 'CRYPTO',
        imageUrl: payload.imageUrl || null,
        isPublished: payload.isPublished ?? true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'COURSE_CREATED',
        details: { courseId: course.id, title: course.title },
      },
    });

    return course;
  }

  async updateCourse(adminUserId: string, courseId: string, payload: { title?: string; description?: string; category?: string; level?: string; imageUrl?: string; isPublished?: boolean }) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');

    const updateData: any = {};
    if (payload.title) updateData.title = payload.title;
    if (payload.description) updateData.description = payload.description;
    if (payload.level) updateData.difficulty = payload.level;
    if (payload.category) updateData.category = payload.category;
    if (payload.imageUrl !== undefined) updateData.imageUrl = payload.imageUrl;
    if (payload.isPublished !== undefined) updateData.isPublished = payload.isPublished;

    const updated = await this.prisma.course.update({
      where: { id: courseId },
      data: updateData,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'COURSE_UPDATED',
        details: { courseId, changes: payload },
      },
    });

    return updated;
  }

  async addLessonToCourse(adminUserId: string, courseId: string, payload: { title: string; content: string; videoUrl?: string; orderIndex?: number }) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');

    const existingLessonsCount = await this.prisma.lesson.count({ where: { courseId } });
    const orderIndex = payload.orderIndex ?? existingLessonsCount + 1;

    // Attach video URL to content if provided
    let finalContent = payload.content;
    if (payload.videoUrl) {
      finalContent = `[VIDEO_URL:${payload.videoUrl.trim()}]\n\n${payload.content}`;
    }

    const lesson = await this.prisma.lesson.create({
      data: {
        courseId,
        title: payload.title,
        content: finalContent,
        orderIndex,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'LESSON_CREATED',
        details: { courseId, lessonId: lesson.id, title: lesson.title },
      },
    });

    return lesson;
  }

  async updateLesson(adminUserId: string, lessonId: string, payload: { title?: string; content?: string; videoUrl?: string; orderIndex?: number }) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const updateData: any = {};
    if (payload.title) updateData.title = payload.title;
    if (typeof payload.orderIndex === 'number') updateData.orderIndex = payload.orderIndex;

    let finalContent = payload.content !== undefined ? payload.content : lesson.content.replace(/\[VIDEO_URL:.*?\]/, '').trim();
    if (payload.videoUrl) {
      finalContent = `[VIDEO_URL:${payload.videoUrl.trim()}]\n\n${finalContent}`;
    } else if (payload.videoUrl === '') {
      finalContent = finalContent.replace(/\[VIDEO_URL:.*?\]/, '').trim();
    }
    updateData.content = finalContent;

    const updated = await this.prisma.lesson.update({
      where: { id: lessonId },
      data: updateData,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'LESSON_UPDATED',
        details: { lessonId, changes: payload },
      },
    });

    return updated;
  }

  async deleteLesson(adminUserId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    await this.prisma.lesson.delete({ where: { id: lessonId } });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'LESSON_DELETED',
        details: { lessonId, title: lesson.title },
      },
    });

    return { success: true };
  }

  async deleteCourse(adminUserId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');

    await this.prisma.course.delete({ where: { id: courseId } });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'COURSE_DELETED',
        details: { courseId, title: course.title },
      },
    });

    return { success: true };
  }

  // 5. Signals Monitoring & Override
  async getAdminSignals() {
    return this.prisma.signal.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async expireSignal(adminUserId: string, signalId: string) {
    const signal = await this.prisma.signal.findUnique({ where: { id: signalId } });
    if (!signal) throw new NotFoundException('Signal not found');

    const updated = await this.prisma.signal.update({
      where: { id: signalId },
      data: { expiresAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'SIGNAL_EXPIRED_MANUALLY',
        details: { signalId, symbol: signal.symbol },
      },
    });

    return updated;
  }

  // 6. Audit Trail Logs
  async getAuditLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          user: { select: { email: true, role: true } },
        },
      }),
      this.prisma.auditLog.count(),
    ]);

    return {
      data: logs,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  // 7. User 360° Profile Hub
  async getUser360Details(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        wallet: true,
        kyc: true,
        subscription: true,
        devices: true,
        sessions: { orderBy: { createdAt: 'desc' }, take: 10 },
        quizAttempts: {
          orderBy: { completedAt: 'desc' },
          take: 20,
          include: { quiz: { select: { title: true, difficulty: true } } }
        },
        certificates: { include: { course: true } },
        auditLogs: { orderBy: { timestamp: 'desc' }, take: 15 },
        notifications: { orderBy: { createdAt: 'desc' }, take: 15 },
      }
    });

    if (!user) throw new NotFoundException('User profile not found');

    const totalQuizzes = user.quizAttempts.length;
    const passedQuizzes = user.quizAttempts.filter(q => q.passed).length;
    const avgScore = totalQuizzes > 0 ? Math.round(user.quizAttempts.reduce((acc, q) => acc + q.percentage, 0) / totalQuizzes) : 0;
    const xp = passedQuizzes * 100 + user.certificates.length * 500;

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
      },
      profile: user.profile,
      wallet: user.wallet,
      kyc: user.kyc,
      subscription: user.subscription,
      devices: user.devices,
      sessions: user.sessions,
      academy: {
        totalAttempts: totalQuizzes,
        passedAttempts: passedQuizzes,
        avgScore,
        xp,
        certificates: user.certificates,
        attempts: user.quizAttempts,
      },
      notifications: user.notifications,
      auditLogs: user.auditLogs,
    };
  }

  // 8. Question Bank & Quiz CMS
  async getQuestionBank() {
    return this.prisma.questionBank.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createQuestion(adminUserId: string, payload: { question: string; type?: string; options: any; explanation?: string; assetTag?: string; skillTag?: string; difficulty?: string }) {
    const question = await this.prisma.questionBank.create({
      data: {
        question: payload.question,
        type: payload.type || 'MULTIPLE_CHOICE',
        options: payload.options,
        explanation: payload.explanation || null,
        assetTag: payload.assetTag || null,
        skillTag: payload.skillTag || 'Technical Analysis',
        difficulty: payload.difficulty || 'INTERMEDIATE',
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'QUESTION_CREATED',
        details: { questionId: question.id, skillTag: question.skillTag },
      }
    });

    return question;
  }

  async getAdminQuizzes() {
    return this.prisma.quiz.findMany({
      include: {
        course: { select: { title: true } },
        lesson: { select: { title: true } },
        quizQuestions: { include: { question: true } },
        attempts: true,
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createQuiz(adminUserId: string, payload: any) {
    const passMarkPct = Number(payload.passMarkPct ?? payload.passMark ?? 70);
    const timeLimitMinutes = Number(payload.timeLimitMinutes ?? payload.timeLimit ?? 15);
    const xpReward = Number(payload.xpReward ?? 100);

    const quiz = await this.prisma.quiz.create({
      data: {
        title: payload.title,
        description: payload.description || null,
        courseId: payload.courseId || null,
        lessonId: payload.lessonId || null,
        difficulty: payload.difficulty || 'INTERMEDIATE',
        timeLimitMinutes,
        passMarkPct,
        xpReward,
        status: payload.isPublished === false ? 'DRAFT' : 'PUBLISHED',
      }
    });

    if (Array.isArray(payload.questionIds) && payload.questionIds.length > 0) {
      for (let i = 0; i < payload.questionIds.length; i++) {
        await this.prisma.quizQuestion.create({
          data: {
            quizId: quiz.id,
            questionId: payload.questionIds[i],
            orderIndex: i + 1,
          }
        });
      }
    }

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'QUIZ_CREATED',
        details: { quizId: quiz.id, title: quiz.title, questionCount: payload.questionIds?.length || 0 },
      }
    });

    return quiz;
  }

  async updateQuiz(adminUserId: string, quizId: string, payload: any) {
    const existing = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!existing) throw new NotFoundException('Quiz not found.');

    const passMarkPct = payload.passMarkPct !== undefined ? Number(payload.passMarkPct) : (payload.passMark !== undefined ? Number(payload.passMark) : existing.passMarkPct);
    const timeLimitMinutes = payload.timeLimitMinutes !== undefined ? Number(payload.timeLimitMinutes) : (payload.timeLimit !== undefined ? Number(payload.timeLimit) : existing.timeLimitMinutes);
    const xpReward = payload.xpReward !== undefined ? Number(payload.xpReward) : existing.xpReward;

    const quiz = await this.prisma.quiz.update({
      where: { id: quizId },
      data: {
        title: payload.title !== undefined ? payload.title : existing.title,
        description: payload.description !== undefined ? payload.description : existing.description,
        courseId: payload.courseId !== undefined ? payload.courseId : existing.courseId,
        lessonId: payload.lessonId !== undefined ? payload.lessonId : existing.lessonId,
        difficulty: payload.difficulty !== undefined ? payload.difficulty : existing.difficulty,
        timeLimitMinutes,
        passMarkPct,
        xpReward,
        status: payload.status !== undefined ? payload.status : (payload.isPublished !== undefined ? (payload.isPublished ? 'PUBLISHED' : 'DRAFT') : existing.status),
      }
    });

    if (Array.isArray(payload.questionIds)) {
      await this.prisma.quizQuestion.deleteMany({ where: { quizId } });
      for (let i = 0; i < payload.questionIds.length; i++) {
        await this.prisma.quizQuestion.create({
          data: {
            quizId: quiz.id,
            questionId: payload.questionIds[i],
            orderIndex: i + 1,
          }
        });
      }
    }

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'QUIZ_UPDATED',
        details: { quizId: quiz.id, title: quiz.title },
      }
    });

    return quiz;
  }

  async deleteQuiz(adminUserId: string, quizId: string) {
    const existing = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!existing) throw new NotFoundException('Quiz not found.');

    await this.prisma.quiz.delete({ where: { id: quizId } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'QUIZ_DELETED',
        details: { quizId, title: existing.title },
      }
    });

    return { success: true, message: 'Quiz deleted successfully.' };
  }

  async updateQuestion(adminUserId: string, questionId: string, payload: any) {
    const existing = await this.prisma.questionBank.findUnique({ where: { id: questionId } });
    if (!existing) throw new NotFoundException('Question item not found.');

    const question = await this.prisma.questionBank.update({
      where: { id: questionId },
      data: {
        question: payload.text || payload.question || existing.question,
        skillTag: payload.skillTag || existing.skillTag,
        assetTag: payload.assetTag || existing.assetTag,
        difficulty: payload.difficulty || existing.difficulty,
        options: payload.options || existing.options,
        explanation: payload.explanation || existing.explanation,
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'QUESTION_UPDATED',
        details: { questionId: question.id },
      }
    });

    return question;
  }

  async deleteQuestion(adminUserId: string, questionId: string) {
    const existing = await this.prisma.questionBank.findUnique({ where: { id: questionId } });
    if (!existing) throw new NotFoundException('Question item not found.');

    await this.prisma.questionBank.delete({ where: { id: questionId } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'QUESTION_DELETED',
        details: { questionId },
      }
    });

    return { success: true, message: 'Question deleted successfully.' };
  }

  async getAcademyAnalytics() {
    const [totalQuizzes, totalAttempts, passedAttempts, totalCourses, questionAttempts] = await Promise.all([
      this.prisma.quiz.count(),
      this.prisma.quizAttempt.count(),
      this.prisma.quizAttempt.count({ where: { passed: true } }),
      this.prisma.course.count(),
      this.prisma.questionAttempt.findMany({
        take: 100,
        include: { question: { select: { question: true, skillTag: true } } }
      })
    ]);

    const passRate = totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : 0;

    // Aggregate most missed questions
    const questionStats: Record<string, { title: string; skill: string; total: number; correct: number }> = {};
    for (const qa of questionAttempts) {
      const qId = qa.questionId;
      if (!questionStats[qId]) {
        questionStats[qId] = {
          title: qa.question.question,
          skill: qa.question.skillTag,
          total: 0,
          correct: 0,
        };
      }
      questionStats[qId].total += 1;
      if (qa.isCorrect) questionStats[qId].correct += 1;
    }

    const mostMissedQuestions = Object.values(questionStats)
      .map(q => ({
        question: q.title,
        skill: q.skill,
        correctPct: q.total > 0 ? Math.round((q.correct / q.total) * 100) : 0,
        totalAttempts: q.total,
      }))
      .sort((a, b) => a.correctPct - b.correctPct)
      .slice(0, 10);

    return {
      totalCourses,
      totalQuizzes,
      totalAttempts,
      passRate,
      mostMissedQuestions,
    };
  }
}
