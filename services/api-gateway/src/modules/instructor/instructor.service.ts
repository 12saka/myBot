import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InstructorService {
  constructor(private prisma: PrismaService) {}

  // 1. Instructor Dashboard Metrics & Analytics
  async getInstructorStats(userId: string, userRole: string) {
    const isMasterAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    const courseWhere = isMasterAdmin ? {} : { instructorId: userId };
    const assignmentWhere = isMasterAdmin ? {} : { instructorId: userId };
    const webinarWhere = isMasterAdmin ? {} : { instructorId: userId };

    const totalCourses = await this.prisma.course.count({ where: courseWhere });
    
    const pendingGradingCount = await this.prisma.assignmentSubmission.count({
      where: {
        status: 'SUBMITTED',
        ...(isMasterAdmin ? {} : { assignment: { instructorId: userId } }),
      },
    });

    const totalGradedCount = await this.prisma.assignmentSubmission.count({
      where: {
        status: 'GRADED',
        ...(isMasterAdmin ? {} : { assignment: { instructorId: userId } }),
      },
    });

    const upcomingWebinarsCount = await this.prisma.liveSession.count({
      where: {
        ...webinarWhere,
        isActive: true,
        startTime: { gte: new Date() },
      },
    });

    const totalQuizAttempts = await this.prisma.quizAttempt.count();
    const passedAttempts = await this.prisma.quizAttempt.count({ where: { passed: true } });
    const avgPassRate = totalQuizAttempts > 0 ? Math.round((passedAttempts / totalQuizAttempts) * 100) : 85;

    const totalEnrolledStudents = await this.prisma.user.count({
      where: { role: { in: ['TRADER', 'USER', 'INVESTOR'] } },
    });

    const recentSubmissions = await this.prisma.assignmentSubmission.findMany({
      where: isMasterAdmin ? {} : { assignment: { instructorId: userId } },
      take: 5,
      orderBy: { submittedAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        assignment: { select: { id: true, title: true, maxScore: true, course: { select: { title: true } } } },
      },
    });

    return {
      totalCourses,
      totalEnrolledStudents,
      pendingGradingCount,
      totalGradedCount,
      upcomingWebinarsCount,
      avgPassRate,
      recentSubmissions,
    };
  }

  // 2. Course Management
  async getCourses(userId: string, userRole: string) {
    const isMasterAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    return this.prisma.course.findMany({
      where: isMasterAdmin ? {} : { OR: [{ instructorId: userId }, { instructorId: null }] },
      orderBy: { createdAt: 'desc' },
      include: {
        lessons: { orderBy: { orderIndex: 'asc' } },
        quizzes: true,
        assignments: true,
        instructor: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
      },
    });
  }

  async createCourse(userId: string, body: any) {
    return this.prisma.course.create({
      data: {
        title: body.title,
        description: body.description || '',
        difficulty: body.difficulty || 'BEGINNER',
        category: body.category || 'CRYPTO',
        imageUrl: body.imageUrl,
        isPublished: body.isPublished ?? true,
        instructorId: userId,
      },
    });
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
    return this.prisma.assignment.findMany({
      where: isMasterAdmin ? {} : { instructorId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        course: { select: { id: true, title: true } },
        lesson: { select: { id: true, title: true } },
        instructor: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
        _count: { select: { submissions: true } },
      },
    });
  }

  async createAssignment(userId: string, body: any) {
    if (!body.title || !body.courseId || !body.instructions) {
      throw new BadRequestException('Title, courseId, and instructions are required.');
    }

    return this.prisma.assignment.create({
      data: {
        title: body.title.trim(),
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
      },
    });
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
        assignment: { select: { title: true, xpReward: true, courseId: true } },
        user: { select: { id: true, email: true } },
      },
    });

    // Create Notification for Student
    try {
      await this.prisma.notification.create({
        data: {
          userId: sub.userId,
          title: `Assignment Graded: ${sub.assignment.title}`,
          message: `Your score: ${score}/${sub.assignment.maxScore}. Feedback: "${feedback}"`,
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
    return this.prisma.liveSession.findMany({
      where: isMasterAdmin ? {} : { OR: [{ instructorId: userId }, { instructorId: null }] },
      orderBy: { startTime: 'desc' },
      include: {
        instructorUser: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
        _count: { select: { registrations: true } },
      },
    });
  }

  async createWebinar(userId: string, body: any) {
    if (!body.title || !body.startTime) {
      throw new BadRequestException('Webinar title and start time are required.');
    }

    const meetingId = body.zoomMeetingId || `${Math.floor(100000000 + Math.random() * 900000000)}`;
    const passcode = body.passcode || `${Math.floor(100000 + Math.random() * 900000)}`;
    const joinUrl = body.joinUrl || `https://zoom.us/j/${meetingId}?pwd=${passcode}`;
    const startUrl = body.startUrl || `https://zoom.us/s/${meetingId}?pwd=${passcode}`;

    return this.prisma.liveSession.create({
      data: {
        title: body.title.trim(),
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
    return questions.map((q) => {
      const opts = (q.options as any) || {};
      const choices = Array.isArray(opts) ? opts : Array.isArray(opts.choices) ? opts.choices : [];
      const correctOptionIndex = opts.correctOptionIndex ?? 0;
      return { ...q, options: choices, correctOptionIndex };
    });
  }

  async createQuestion(userId: string, payload: any) {
    const choices = Array.isArray(payload.options) ? payload.options : [];
    const correctOptionIndex = payload.correctOptionIndex ?? 0;
    const question = await this.prisma.questionBank.create({
      data: {
        question: payload.question || payload.text || '',
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
    return this.prisma.quiz.findMany({
      include: {
        course: { select: { title: true } },
        lesson: { select: { title: true } },
        quizQuestions: { include: { question: true } },
        attempts: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createQuiz(userId: string, payload: any) {
    const quiz = await this.prisma.quiz.create({
      data: {
        title: payload.title,
        description: payload.description || null,
        courseId: payload.courseId || null,
        lessonId: payload.lessonId || null,
        difficulty: payload.difficulty || 'INTERMEDIATE',
        timeLimitMinutes: Number(payload.timeLimitMinutes ?? payload.timeLimit ?? 15),
        passMarkPct: Number(payload.passMarkPct ?? payload.passMark ?? 70),
        xpReward: Number(payload.xpReward ?? 100),
        status: payload.isPublished === false ? 'DRAFT' : 'PUBLISHED',
      },
    });

    if (Array.isArray(payload.questionIds) && payload.questionIds.length > 0) {
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
}
