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
}
