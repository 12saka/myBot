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
      this.prisma.user.count(),
      this.prisma.kycRecord.count({ where: { status: 'PENDING' } }),
      this.prisma.signal.count({ where: { expiresAt: { gt: new Date() } } }),
      this.prisma.course.count(),
      this.prisma.auditLog.findMany({
        take: 8,
        orderBy: { timestamp: 'desc' },
        include: { user: { select: { email: true, role: true } } },
      }),
    ]);

    const activeBrokers = await (this.prisma as any).userBrokerProfile.count({ where: { status: 'connected' } });

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
    const limit = Number(query?.limit || 20);
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

    const [users, total, brokerProfiles] = await Promise.all([
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
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
      (this.prisma as any).userBrokerProfile.findMany({
        select: {
          userId: true,
          status: true,
          brokerType: true,
          balance: true,
        },
      }),
    ]);
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
    const brokerProfile = await (this.prisma as any).userBrokerProfile.findUnique({ where: { userId } });
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
        difficulty: payload.level || payload.category || 'Beginner',
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
    if (payload.level || payload.category) updateData.difficulty = payload.level || payload.category;

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
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
