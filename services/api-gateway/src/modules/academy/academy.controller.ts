import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AcademyService } from './academy.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('academy')
@UseGuards(JwtAuthGuard)
export class AcademyController {
  constructor(private readonly academyService: AcademyService) {}

  @Get('courses')
  async getCourses(@Request() req: any) {
    return this.academyService.getCourses(req.user.userId || req.user.id);
  }

  @Get('progress')
  async getUserProgress(@Request() req: any) {
    return this.academyService.getUserProgress(req.user.userId || req.user.id);
  }

  @Get('quizzes')
  async getAvailableQuizzes(@Request() req: any) {
    return this.academyService.getAvailableQuizzes(req.user.userId || req.user.id);
  }

  @Get('quizzes/stats')
  async getUserQuizStats(@Request() req: any) {
    return this.academyService.getUserQuizStats(req.user.userId || req.user.id);
  }

  @Get('quizzes/:id')
  async getQuizById(@Request() req: any, @Param('id') quizId: string) {
    return this.academyService.getQuizById(req.user.userId || req.user.id, quizId);
  }

  @Post('quizzes/:id/submit')
  async submitQuiz(@Request() req: any, @Param('id') quizId: string, @Body() body: any) {
    return this.academyService.submitQuiz(req.user.userId || req.user.id, quizId, body);
  }

  @Get('live-sessions')
  async getLiveSessions() {
    return this.academyService.getLiveSessions();
  }

  @Get('courses/:id')
  async getCourseById(@Request() req: any, @Param('id') courseId: string) {
    return this.academyService.getCourseById(req.user.userId || req.user.id, courseId);
  }

  @Get('lessons/:id')
  async getLessonById(@Request() req: any, @Param('id') lessonId: string) {
    return this.academyService.getLessonById(req.user.userId || req.user.id, lessonId);
  }

  @Post('lessons/:id/complete')
  async completeLessonQuiz(@Request() req: any, @Param('id') lessonId: string, @Body() body: any) {
    return this.academyService.completeLessonQuiz(req.user.userId || req.user.id, lessonId, body);
  }

  @Post('live-sessions/:id/register')
  async registerLiveSession(@Request() req: any, @Param('id') sessionId: string) {
    return this.academyService.registerLiveSession(req.user.userId || req.user.id, sessionId);
  }

  @Post('assignments/:id/submit')
  async submitAssignment(@Request() req: any, @Param('id') assignmentId: string, @Body() body: any) {
    return this.academyService.submitAssignment(req.user.userId || req.user.id, assignmentId, body);
  }

  @Get('assignments/:id/submission')
  async getAssignmentSubmission(@Request() req: any, @Param('id') assignmentId: string) {
    return this.academyService.getAssignmentSubmission(req.user.userId || req.user.id, assignmentId);
  }
}
