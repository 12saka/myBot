import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InstructorService {
  constructor(private prisma: PrismaService) {}

  // 1. Instructor Dashboard Metrics & Analytics
  async getInstructorStats(userId: string, userRole: string) {
    const isMasterAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    const courseWhere = isMasterAdmin ? {} : { OR: [{ instructorId: userId }, { instructorId: null }] };
    const assignmentWhere = isMasterAdmin ? {} : { instructorId: userId };
    const webinarWhere = isMasterAdmin ? {} : { instructorId: userId };

    const [
      totalCourses,
      totalLessonsWithNotes,
      totalDailyNotes,
      totalAssignments,
      totalQuizzes,
      pendingGradingCount,
      totalGradedCount,
      upcomingWebinarsCount,
      totalQuizAttempts,
      passedAttempts,
      totalEnrolledStudents,
      unresolvedDiscussionsCount,
      recentSubmissions,
      rawDiscussions,
    ] = await Promise.all([
      this.prisma.course.count({ where: courseWhere }),
      this.prisma.lesson.count({ where: { course: { isPublished: true } } }),
      this.prisma.dailyActivity.count(),
      this.prisma.assignment.count({ where: assignmentWhere }),
      this.prisma.quiz.count(),
      this.prisma.assignmentSubmission.count({
        where: {
          status: 'SUBMITTED',
          ...(isMasterAdmin ? {} : { assignment: { instructorId: userId } }),
        },
      }),
      this.prisma.assignmentSubmission.count({
        where: {
          status: 'GRADED',
          ...(isMasterAdmin ? {} : { assignment: { instructorId: userId } }),
        },
      }),
      this.prisma.liveSession.count({
        where: {
          ...webinarWhere,
          isActive: true,
          startTime: { gte: new Date() },
        },
      }),
      this.prisma.quizAttempt.count(),
      this.prisma.quizAttempt.count({ where: { passed: true } }),
      this.prisma.user.count({
        where: { role: { in: ['TRADER', 'USER', 'INVESTOR'] } },
      }),
      this.prisma.academyDiscussion.count({
        where: { isSolved: false },
      }),
      this.prisma.assignmentSubmission.findMany({
        where: isMasterAdmin ? {} : { assignment: { instructorId: userId } },
        take: 6,
        orderBy: { submittedAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
          assignment: { select: { id: true, title: true, maxScore: true, course: { select: { title: true } } } },
        },
      }),
      this.prisma.academyDiscussion.findMany({
        take: 5,
        orderBy: [{ isSolved: 'asc' }, { createdAt: 'desc' }],
        include: {
          user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
          responses: {
            select: {
              id: true,
              user: { select: { role: true } },
            },
          },
        },
      }),
    ]);

    const recentDiscussions = rawDiscussions.map((d) => ({
      ...d,
      isResolved: d.isSolved,
      replies: (d.responses || []).map((r: { id: string; user?: { role?: string } | null }) => ({
        id: r.id,
        isInstructorReply:
          d.pinnedResponseId === r.id || ['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(r.user?.role || ''),
      })),
    }));

    const avgPassRate = totalQuizAttempts > 0 ? Math.round((passedAttempts / totalQuizAttempts) * 100) : 85;
    const totalStudyNotes = totalLessonsWithNotes + totalDailyNotes;

    return {
      totalCourses,
      totalStudyNotes,
      totalLessonsWithNotes,
      totalDailyNotes,
      totalAssignments,
      totalQuizzes,
      totalEnrolledStudents,
      pendingGradingCount,
      totalGradedCount,
      upcomingWebinarsCount,
      unresolvedDiscussionsCount,
      avgPassRate,
      recentSubmissions,
      recentDiscussions,
    };
  }

  // 2. Course Management
  async getCourses(userId: string, userRole: string) {
    const isMasterAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    const rawCourses = await this.prisma.course.findMany({
      where: isMasterAdmin ? {} : { OR: [{ instructorId: userId }, { instructorId: null }] },
      orderBy: { createdAt: 'desc' },
      include: {
        lessons: { orderBy: { orderIndex: 'asc' } },
        quizzes: true,
        assignments: true,
        instructor: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
      },
    });

    const seenCourseTitles = new Set<string>();
    return rawCourses
      .filter((c) => {
        const key = (c.title || '').trim().toLowerCase();
        if (seenCourseTitles.has(key)) return false;
        seenCourseTitles.add(key);
        return true;
      })
      .map((c) => {
        const seenLessons = new Set<string>();
        const uniqueLessons = (c.lessons || []).filter((l) => {
          const lKey = (l.title || '').trim().toLowerCase();
          if (seenLessons.has(lKey)) return false;
          seenLessons.add(lKey);
          return true;
        });
        return { ...c, lessons: uniqueLessons };
      });
  }

  private async broadcastAcademyNotificationToStudents(
    title: string,
    message: string,
    linkUrl: string = '/academy',
    excludeUserId?: string,
  ) {
    try {
      const students = await this.prisma.user.findMany({
        where: {
          ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
        },
        select: { id: true },
      });
      if (students.length === 0) return;

      const userIds = students.map((s) => s.id);
      // Remove any existing unread notification with the exact same title so students never receive duplicates
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
    } catch (e) {
      // Non-blocking notification dispatch
    }
  }

  async createCourse(userId: string, body: any) {
    const cleanTitle = (body.title || '').trim();
    const existing = await this.prisma.course.findFirst({
      where: {
        title: { equals: cleanTitle, mode: 'insensitive' },
      },
    });

    const course = existing
      ? await this.prisma.course.update({
          where: { id: existing.id },
          data: {
            description: body.description ?? existing.description,
            difficulty: body.difficulty || existing.difficulty,
            category: body.category || existing.category,
            imageUrl: body.imageUrl ?? existing.imageUrl,
            isPublished: body.isPublished ?? true,
          },
        })
      : await this.prisma.course.create({
          data: {
            title: cleanTitle,
            description: body.description || '',
            difficulty: body.difficulty || 'BEGINNER',
            category: body.category || 'CRYPTO',
            imageUrl: body.imageUrl,
            isPublished: body.isPublished ?? true,
            instructorId: userId,
          },
        });

    if (course.isPublished && !existing) {
      await this.broadcastAcademyNotificationToStudents(
        `📚 New Course Published: ${course.title}`,
        `A new ${course.difficulty} course in ${course.category || 'Trading'} is now live in the Academy: "${course.title}".`,
        `/academy/courses/${course.id}`,
        userId,
      );
    }

    return course;
  }

  async updateCourse(userId: string, userRole: string, courseId: string, body: any) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');

    const isMasterAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    if (!isMasterAdmin && course.instructorId && course.instructorId !== userId) {
      throw new ForbiddenException('Not authorized to modify this course');
    }

    return this.prisma.course.update({
      where: { id: courseId },
      data: {
        ...(body.title && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.difficulty && { difficulty: body.difficulty }),
        ...(body.category && { category: body.category }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
        ...(body.isPublished !== undefined && { isPublished: body.isPublished }),
        ...(body.instructorId !== undefined && { instructorId: body.instructorId }),
      },
    });
  }

  async deleteCourse(userId: string, userRole: string, courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');

    const isMasterAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    if (!isMasterAdmin && course.instructorId && course.instructorId !== userId) {
      throw new ForbiddenException('Not authorized to delete this course');
    }

    return this.prisma.course.delete({ where: { id: courseId } });
  }

  // 3. Assignment Management & Grading Queue
  async getAssignments(userId: string, userRole: string) {
    const isMasterAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    const raw = await this.prisma.assignment.findMany({
      where: isMasterAdmin ? {} : { instructorId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        course: { select: { id: true, title: true } },
        lesson: { select: { id: true, title: true } },
        instructor: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
        _count: { select: { submissions: true } },
      },
    });

    const seen = new Set<string>();
    return raw.filter((a) => {
      const key = `${a.courseId || ''}::${(a.title || '').trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async createAssignment(userId: string, body: any) {
    if (!body.title || !body.courseId || !body.instructions) {
      throw new BadRequestException('Title, courseId, and instructions are required.');
    }

    const cleanTitle = body.title.trim();
    const existing = await this.prisma.assignment.findFirst({
      where: {
        courseId: body.courseId,
        title: { equals: cleanTitle, mode: 'insensitive' },
      },
    });

    const assignment = existing
      ? await this.prisma.assignment.update({
          where: { id: existing.id },
          data: {
            description: body.description?.trim() || existing.description,
            instructions: body.instructions.trim(),
            lessonId: body.lessonId || null,
            attachmentUrl: body.attachmentUrl || existing.attachmentUrl,
            dueDate: body.dueDate ? new Date(body.dueDate) : existing.dueDate,
            maxScore: Number(body.maxScore || 100),
            xpReward: Number(body.xpReward || 150),
            isPublished: body.isPublished ?? true,
          },
          include: {
            course: { select: { id: true, title: true } },
            lesson: { select: { id: true, title: true } },
          },
        })
      : await this.prisma.assignment.create({
          data: {
            title: cleanTitle,
            description: body.description?.trim() || null,
            instructions: body.instructions.trim(),
            courseId: body.courseId,
            lessonId: body.lessonId || null,
            instructorId: userId,
            attachmentUrl: body.attachmentUrl || null,
            dueDate: body.dueDate ? new Date(body.dueDate) : null,
            maxScore: Number(body.maxScore || 100),
            xpReward: Number(body.xpReward || 150),
            isPublished: body.isPublished ?? true,
          },
          include: {
            course: { select: { id: true, title: true } },
            lesson: { select: { id: true, title: true } },
          },
        });

    if (assignment.isPublished && !existing) {
      const dueStr = assignment.dueDate ? ` • Due: ${new Date(assignment.dueDate).toLocaleDateString()}` : '';
      await this.broadcastAcademyNotificationToStudents(
        `📋 New Homework Assignment: ${assignment.title}`,
        `Course: ${assignment.course?.title || 'Academy'} • Reward: +${assignment.xpReward} XP${dueStr}. Submit your deliverable for instructor grading.`,
        `/academy/courses/${assignment.courseId}`,
        userId,
      );
    }

    return assignment;
  }

  async updateAssignment(userId: string, userRole: string, assignmentId: string, body: any) {
    const assignment = await this.prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const isMasterAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    if (!isMasterAdmin && assignment.instructorId !== userId) {
      throw new ForbiddenException('Not authorized to modify this assignment');
    }

    return this.prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        ...(body.title && { title: body.title.trim() }),
        ...(body.courseId && { courseId: body.courseId }),
        ...(body.lessonId !== undefined && { lessonId: body.lessonId || null }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.instructions && { instructions: body.instructions }),
        ...(body.attachmentUrl !== undefined && { attachmentUrl: body.attachmentUrl }),
        ...(body.dueDate !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
        ...(body.maxScore !== undefined && { maxScore: Number(body.maxScore) }),
        ...(body.xpReward !== undefined && { xpReward: Number(body.xpReward) }),
        ...(body.isPublished !== undefined && { isPublished: body.isPublished }),
      },
    });
  }

  async deleteAssignment(userId: string, userRole: string, assignmentId: string) {
    const assignment = await this.prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const isMasterAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    if (!isMasterAdmin && assignment.instructorId !== userId) {
      throw new ForbiddenException('Not authorized to delete this assignment');
    }

    return this.prisma.assignment.delete({ where: { id: assignmentId } });
  }

  async getSubmissions(userId: string, userRole: string, status?: string) {
    const isMasterAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    return this.prisma.assignmentSubmission.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(isMasterAdmin ? {} : { assignment: { instructorId: userId } }),
      },
      orderBy: { submittedAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        assignment: { select: { id: true, title: true, maxScore: true, xpReward: true, course: { select: { id: true, title: true } } } },
        gradedBy: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
      },
    });
  }

  async gradeSubmission(userId: string, userRole: string, submissionId: string, body: any) {
    const sub = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: { assignment: true },
    });
    if (!sub) throw new NotFoundException('Submission not found');

    const isMasterAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    if (!isMasterAdmin && sub.assignment.instructorId !== userId) {
      throw new ForbiddenException('Not authorized to grade this submission');
    }

    const score = Number(body.score);
    if (isNaN(score) || score < 0 || score > sub.assignment.maxScore) {
      throw new BadRequestException(`Score must be a number between 0 and ${sub.assignment.maxScore}`);
    }

    const feedback = body.feedback?.trim() || 'Well executed assignment.';
    const status = body.status || (score >= (sub.assignment.maxScore * 0.5) ? 'GRADED' : 'RESUBMIT_REQUIRED');
    const wasAlreadyGraded = sub.status === 'GRADED';

    const updated = await this.prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        score,
        feedback,
        status,
        gradedById: userId,
        gradedAt: new Date(),
      },
      include: {
        assignment: { select: { title: true, xpReward: true, courseId: true, maxScore: true } },
        user: { select: { id: true, email: true } },
      },
    });

    // Credit XP Reward to Student Gamification Profile when graded & passed
    const xpAwarded = status === 'GRADED' && !wasAlreadyGraded ? (sub.assignment.xpReward || 150) : 0;
    if (xpAwarded > 0) {
      await this.prisma.userGamification.upsert({
        where: { userId: sub.userId },
        update: { xpPoints: { increment: xpAwarded } },
        create: { userId: sub.userId, xpPoints: xpAwarded },
      }).catch(() => {});
    }

    // Create Notification for Student
    try {
      await this.prisma.notification.create({
        data: {
          userId: sub.userId,
          title: status === 'GRADED'
            ? `✅ Assignment Graded: ${sub.assignment.title} (${score}/${sub.assignment.maxScore})`
            : `🔄 Revision Requested: ${sub.assignment.title}`,
          message: `Score: ${score}/${sub.assignment.maxScore}${xpAwarded > 0 ? ` • +${xpAwarded} XP Awarded!` : ''}. Instructor Feedback: "${feedback}"`,
          type: 'ACADEMY',
          linkUrl: `/academy/courses/${sub.assignment.courseId}`,
        },
      });
    } catch (e) {}

    return updated;
  }

  // 4. Live Zoom Webinar & Live Class Studio
  async getWebinars(userId: string, userRole: string) {
    const isMasterAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    const raw = await this.prisma.liveSession.findMany({
      where: isMasterAdmin ? {} : { OR: [{ instructorId: userId }, { instructorId: null }] },
      orderBy: { startTime: 'desc' },
      include: {
        instructorUser: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
        _count: { select: { registrations: true } },
      },
    });

    const seen = new Set<string>();
    return raw.filter((w) => {
      const key = `${(w.title || '').trim().toLowerCase()}::${w.startTime ? new Date(w.startTime).toISOString().slice(0, 16) : ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async createWebinar(userId: string, body: any) {
    if (!body.title || !body.startTime) {
      throw new BadRequestException('Webinar title and start time are required.');
    }

    const cleanTitle = body.title.trim();
    const existing = await this.prisma.liveSession.findFirst({
      where: {
        title: { equals: cleanTitle, mode: 'insensitive' },
        isActive: true,
      },
    });

    const meetingId = body.zoomMeetingId || existing?.zoomMeetingId || `${Math.floor(100000000 + Math.random() * 900000000)}`;
    const passcode = body.passcode || existing?.passcode || `${Math.floor(100000 + Math.random() * 900000)}`;
    const joinUrl = body.joinUrl || existing?.joinUrl || `https://zoom.us/j/${meetingId}?pwd=${passcode}`;
    const startUrl = body.startUrl || existing?.startUrl || `https://zoom.us/s/${meetingId}?pwd=${passcode}`;

    const session = existing
      ? await this.prisma.liveSession.update({
          where: { id: existing.id },
          data: {
            description: body.description?.trim() || existing.description,
            instructor: body.instructorName?.trim() || existing.instructor,
            startTime: new Date(body.startTime),
            durationMinutes: Number(body.durationMinutes || 60),
            category: body.category || existing.category,
            meetingUrl: joinUrl,
            zoomMeetingId: meetingId,
            passcode,
            joinUrl,
            startUrl,
            recordingUrl: body.recordingUrl || existing.recordingUrl,
          },
        })
      : await this.prisma.liveSession.create({
          data: {
            title: cleanTitle,
            description: body.description?.trim() || null,
            instructor: body.instructorName?.trim() || 'Institutional Trader',
            instructorId: userId,
            startTime: new Date(body.startTime),
            durationMinutes: Number(body.durationMinutes || 60),
            category: body.category || 'WEBINAR',
            meetingUrl: joinUrl,
            zoomMeetingId: meetingId,
            passcode,
            joinUrl,
            startUrl,
            recordingUrl: body.recordingUrl || null,
            status: body.status || 'SCHEDULED',
            maxCapacity: Number(body.maxCapacity || 500),
            isActive: true,
          },
        });

    if (!existing) {
      await this.broadcastAcademyNotificationToStudents(
        `📹 Live Zoom Class Scheduled: ${session.title}`,
        `Join ${session.instructor} on ${new Date(session.startTime).toLocaleString()} (${session.durationMinutes} mins). Register in the Academy Hub!`,
        '/academy',
        userId,
      );
    }

    return session;
  }

  async updateWebinar(userId: string, userRole: string, webinarId: string, body: any) {
    const webinar = await this.prisma.liveSession.findUnique({ where: { id: webinarId } });
    if (!webinar) throw new NotFoundException('Webinar session not found');

    const isMasterAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    if (!isMasterAdmin && webinar.instructorId && webinar.instructorId !== userId) {
      throw new ForbiddenException('Not authorized to modify this webinar');
    }

    return this.prisma.liveSession.update({
      where: { id: webinarId },
      data: {
        ...(body.title && { title: body.title.trim() }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.instructorName && { instructor: body.instructorName.trim() }),
        ...(body.startTime && { startTime: new Date(body.startTime) }),
        ...(body.durationMinutes && { durationMinutes: Number(body.durationMinutes) }),
        ...(body.category && { category: body.category }),
        ...(body.zoomMeetingId && { zoomMeetingId: body.zoomMeetingId }),
        ...(body.passcode && { passcode: body.passcode }),
        ...(body.joinUrl && { joinUrl: body.joinUrl, meetingUrl: body.joinUrl }),
        ...(body.startUrl !== undefined && { startUrl: body.startUrl }),
        ...(body.recordingUrl !== undefined && { recordingUrl: body.recordingUrl }),
        ...(body.status && { status: body.status }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });
  }

  async deleteWebinar(userId: string, userRole: string, webinarId: string) {
    const webinar = await this.prisma.liveSession.findUnique({ where: { id: webinarId } });
    if (!webinar) throw new NotFoundException('Webinar session not found');

    const isMasterAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    if (!isMasterAdmin && webinar.instructorId && webinar.instructorId !== userId) {
      throw new ForbiddenException('Not authorized to delete this webinar');
    }

    return this.prisma.liveSession.delete({ where: { id: webinarId } });
  }

  // 5. Student Performance Roster
  async getStudents() {
    const students = await this.prisma.user.findMany({
      where: { role: { in: ['TRADER', 'USER', 'INVESTOR', 'INSTRUCTOR'] } },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        profile: { select: { firstName: true, lastName: true, avatarUrl: true, experience: true } },
        _count: { select: { quizAttempts: true, certificates: true, studentSubmissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return students.map((s) => ({
      id: s.id,
      email: s.email,
      name: s.profile ? `${s.profile.firstName || ''} ${s.profile.lastName || ''}`.trim() || 'Student' : 'Student',
      avatarUrl: s.profile?.avatarUrl,
      role: s.role,
      joinedAt: s.createdAt,
      totalQuizzes: s._count.quizAttempts,
      totalSubmissions: s._count.studentSubmissions,
      certificatesEarned: s._count.certificates,
    }));
  }

  // 6. Question Bank & Quizzes Management
  async getQuestionBank() {
    const questions = await this.prisma.questionBank.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const seen = new Set<string>();
    return questions
      .filter((q) => {
        const key = (q.question || '').trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((q) => {
        const opts = (q.options as any) || {};
        const choices = Array.isArray(opts) ? opts : Array.isArray(opts.choices) ? opts.choices : [];
        const correctOptionIndex = opts.correctOptionIndex ?? 0;
        return { ...q, options: choices, correctOptionIndex };
      });
  }

  async createQuestion(userId: string, payload: any) {
    const choices = Array.isArray(payload.options) ? payload.options : [];
    const correctOptionIndex = payload.correctOptionIndex ?? 0;
    const cleanQ = (payload.question || payload.text || '').trim();
    const existing = await this.prisma.questionBank.findFirst({
      where: { question: { equals: cleanQ, mode: 'insensitive' } },
    });

    const question = existing
      ? await this.prisma.questionBank.update({
          where: { id: existing.id },
          data: {
            options: { choices, correctOptionIndex },
            explanation: payload.explanation || existing.explanation,
            assetTag: payload.assetTag || existing.assetTag,
            skillTag: payload.skillTag || existing.skillTag,
            difficulty: payload.difficulty || existing.difficulty,
          },
        })
      : await this.prisma.questionBank.create({
          data: {
            question: cleanQ,
            type: payload.type || 'MULTIPLE_CHOICE',
            options: { choices, correctOptionIndex },
            explanation: payload.explanation || null,
            assetTag: payload.assetTag || null,
            skillTag: payload.skillTag || 'Technical Analysis',
            difficulty: payload.difficulty || 'INTERMEDIATE',
          },
        });
    return { ...question, options: choices, correctOptionIndex };
  }

  async updateQuestion(userId: string, id: string, payload: any) {
    const choices = Array.isArray(payload.options) ? payload.options : [];
    const correctOptionIndex = payload.correctOptionIndex ?? 0;
    const question = await this.prisma.questionBank.update({
      where: { id },
      data: {
        ...(payload.question || payload.text ? { question: payload.question || payload.text } : {}),
        ...(payload.options ? { options: { choices, correctOptionIndex } } : {}),
        ...(payload.explanation !== undefined ? { explanation: payload.explanation } : {}),
        ...(payload.assetTag !== undefined ? { assetTag: payload.assetTag } : {}),
        ...(payload.skillTag ? { skillTag: payload.skillTag } : {}),
        ...(payload.difficulty ? { difficulty: payload.difficulty } : {}),
      },
    });
    return { ...question, options: choices, correctOptionIndex };
  }

  async deleteQuestion(userId: string, id: string) {
    return this.prisma.questionBank.delete({ where: { id } });
  }

  async getQuizzes() {
    const raw = await this.prisma.quiz.findMany({
      include: {
        course: { select: { title: true } },
        lesson: { select: { title: true } },
        quizQuestions: { include: { question: true } },
        attempts: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const seen = new Set<string>();
    return raw.filter((q) => {
      const key = `${q.courseId || ''}::${q.lessonId || ''}::${(q.title || '').trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async createQuiz(userId: string, payload: any) {
    const cleanTitle = (payload.title || '').trim();
    const existing = await this.prisma.quiz.findFirst({
      where: {
        title: { equals: cleanTitle, mode: 'insensitive' },
        ...(payload.courseId ? { courseId: payload.courseId } : {}),
      },
    });

    const quiz = existing
      ? await this.prisma.quiz.update({
          where: { id: existing.id },
          data: {
            description: payload.description || existing.description,
            courseId: payload.courseId || existing.courseId,
            lessonId: payload.lessonId || existing.lessonId,
            difficulty: payload.difficulty || existing.difficulty,
            timeLimitMinutes: Number(payload.timeLimitMinutes ?? payload.timeLimit ?? 15),
            passMarkPct: Number(payload.passMarkPct ?? payload.passMark ?? 70),
            xpReward: Number(payload.xpReward ?? 100),
            status: payload.isPublished === false ? 'DRAFT' : 'PUBLISHED',
          },
          include: {
            course: { select: { id: true, title: true } },
          },
        })
      : await this.prisma.quiz.create({
          data: {
            title: cleanTitle,
            description: payload.description || null,
            courseId: payload.courseId || null,
            lessonId: payload.lessonId || null,
            difficulty: payload.difficulty || 'INTERMEDIATE',
            timeLimitMinutes: Number(payload.timeLimitMinutes ?? payload.timeLimit ?? 15),
            passMarkPct: Number(payload.passMarkPct ?? payload.passMark ?? 70),
            xpReward: Number(payload.xpReward ?? 100),
            status: payload.isPublished === false ? 'DRAFT' : 'PUBLISHED',
          },
          include: {
            course: { select: { id: true, title: true } },
          },
        });

    if (Array.isArray(payload.questionIds) && payload.questionIds.length > 0) {
      if (existing) {
        await this.prisma.quizQuestion.deleteMany({ where: { quizId: quiz.id } });
      }
      for (let i = 0; i < payload.questionIds.length; i++) {
        await this.prisma.quizQuestion.create({
          data: {
            quizId: quiz.id,
            questionId: payload.questionIds[i],
            orderIndex: i + 1,
          },
        }).catch(() => null);
      }
    }

    if (quiz.status === 'PUBLISHED' && !existing) {
      await this.broadcastAcademyNotificationToStudents(
        `🎯 New Assessment Published: ${quiz.title}`,
        `Pass mark: ${quiz.passMarkPct}% • Time limit: ${quiz.timeLimitMinutes} mins • Reward: +${quiz.xpReward} XP.`,
        quiz.courseId ? `/academy/courses/${quiz.courseId}` : '/academy',
        userId,
      );
    }

    return quiz;
  }

  async updateQuiz(userId: string, id: string, payload: any) {
    const updated = await this.prisma.quiz.update({
      where: { id },
      data: {
        ...(payload.title && { title: payload.title }),
        ...(payload.description !== undefined && { description: payload.description }),
        ...(payload.courseId !== undefined && { courseId: payload.courseId }),
        ...(payload.lessonId !== undefined && { lessonId: payload.lessonId }),
        ...(payload.difficulty && { difficulty: payload.difficulty }),
        ...(payload.timeLimitMinutes !== undefined && { timeLimitMinutes: Number(payload.timeLimitMinutes) }),
        ...(payload.passMarkPct !== undefined && { passMarkPct: Number(payload.passMarkPct) }),
        ...(payload.xpReward !== undefined && { xpReward: Number(payload.xpReward) }),
        ...(payload.status && { status: payload.status }),
      },
    });

    if (Array.isArray(payload.questionIds)) {
      await this.prisma.quizQuestion.deleteMany({ where: { quizId: id } });
      for (let i = 0; i < payload.questionIds.length; i++) {
        await this.prisma.quizQuestion.create({
          data: {
            quizId: id,
            questionId: payload.questionIds[i],
            orderIndex: i + 1,
          },
        }).catch(() => null);
      }
    }

    return updated;
  }

  async deleteQuiz(userId: string, id: string) {
    return this.prisma.quiz.delete({ where: { id } });
  }

  // Lesson Management for Instructor Courses
  async addLessonToCourse(userId: string, userRole: string, courseId: string, body: any) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');

    const isMasterAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    if (!isMasterAdmin && course.instructorId && course.instructorId !== userId) {
      throw new ForbiddenException('Not authorized to add lessons to this course');
    }

    const cleanTitle = (body.title || '').trim();
    const existingLesson = await this.prisma.lesson.findFirst({
      where: {
        courseId,
        title: { equals: cleanTitle, mode: 'insensitive' },
      },
    });

    const lessonCount = await this.prisma.lesson.count({ where: { courseId } });
    let content = body.content || '';
    if (body.videoUrl) {
      content = `[VIDEO_URL:${body.videoUrl}]\n\n${content}`;
    }

    const lesson = existingLesson
      ? await this.prisma.lesson.update({
          where: { id: existingLesson.id },
          data: {
            content,
            orderIndex: body.orderIndex ?? existingLesson.orderIndex,
          },
        })
      : await this.prisma.lesson.create({
          data: {
            courseId,
            title: cleanTitle,
            content,
            orderIndex: body.orderIndex ?? lessonCount + 1,
          },
        });

    if (course.isPublished && !existingLesson) {
      await this.broadcastAcademyNotificationToStudents(
        `📖 New Lesson & Study Notes Published: ${lesson.title}`,
        `Added to "${course.title}" (Lesson #${lesson.orderIndex}). Study the notes & complete the lesson assessment.`,
        `/academy/courses/${courseId}`,
        userId,
      );
    }

    return lesson;
  }

  async updateLesson(userId: string, userRole: string, lessonId: string, body: any) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: true },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const isMasterAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    if (!isMasterAdmin && lesson.course.instructorId && lesson.course.instructorId !== userId) {
      throw new ForbiddenException('Not authorized to modify this lesson');
    }

    let content = body.content !== undefined ? body.content : undefined;
    if (body.videoUrl !== undefined && content !== undefined) {
      content = content.replace(/\[VIDEO_URL:[^\]]+\]/gi, '').trim();
      if (body.videoUrl) {
        content = `[VIDEO_URL:${body.videoUrl}]\n\n${content}`;
      }
    }

    return this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        ...(body.title && { title: body.title }),
        ...(content !== undefined && { content }),
        ...(body.orderIndex !== undefined && { orderIndex: body.orderIndex }),
      },
    });
  }

  async deleteLesson(userId: string, userRole: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: true },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const isMasterAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    if (!isMasterAdmin && lesson.course.instructorId && lesson.course.instructorId !== userId) {
      throw new ForbiddenException('Not authorized to delete this lesson');
    }

    return this.prisma.lesson.delete({ where: { id: lessonId } });
  }
}
