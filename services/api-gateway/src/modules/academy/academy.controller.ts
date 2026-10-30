import { Controller, Get, Post, Param, Body, UseGuards, Request, Query, Req } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Get scheduled live trading webinars' })
  async getLiveSessions() {
    return this.academyService.getLiveSessions();
  }

  @Get('webinars')
  @ApiOperation({ summary: 'Get scheduled live trading webinars (alias)' })
  async getWebinars() {
    return this.academyService.getLiveSessions();
  }

  @Get('notes')
  @ApiOperation({ summary: 'Get published instructor study notes, market chart breakdowns, and daily tips' })
  async getStudyNotes() {
    return this.academyService.getStudyNotes();
  }

  @Get('assignments')
  @ApiOperation({ summary: 'Get all published course assignments with student submission status' })
  async getAssignments(@Request() req: any) {
    return this.academyService.getAssignments(req.user.userId || req.user.id);
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

  @Get('community/discussions')
  @ApiOperation({ summary: 'Get community discussions for students' })
  async getCommunityDiscussions(@Query('isSolved') isSolved?: string) {
    const isSolvedBool = isSolved === 'true' ? true : isSolved === 'false' ? false : undefined;
    return this.academyService.getCommunityDiscussions(isSolvedBool);
  }

  @Get('discussions')
  @ApiOperation({ summary: 'Get community discussions for students (alias)' })
  async getDiscussionsAlias(@Query('isSolved') isSolved?: string) {
    const isSolvedBool = isSolved === 'true' ? true : isSolved === 'false' ? false : undefined;
    return this.academyService.getCommunityDiscussions(isSolvedBool);
  }

  @Post('community/discussions')
  @ApiOperation({ summary: 'Create discussion thread as student' })
  async createCommunityDiscussion(@Req() req: any, @Body() body: any) {
    return this.academyService.createCommunityDiscussion(req.user.userId || req.user.id, body);
  }

  @Post('discussions')
  @ApiOperation({ summary: 'Create discussion thread as student (alias)' })
  async createDiscussionAlias(@Req() req: any, @Body() body: any) {
    return this.academyService.createCommunityDiscussion(req.user.userId || req.user.id, body);
  }

  @Post('community/discussions/:id/reply')
  @ApiOperation({ summary: 'Reply to discussion thread' })
  async replyToCommunityDiscussion(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.academyService.replyToCommunityDiscussion(req.user.userId || req.user.id, req.user.role, id, body);
  }

  @Post('discussions/:id/reply')
  @ApiOperation({ summary: 'Reply to discussion thread (alias)' })
  async replyToDiscussionAlias(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.academyService.replyToCommunityDiscussion(req.user.userId || req.user.id, req.user.role, id, body);
  }

  @Get('qotd/today')
  @ApiOperation({ summary: 'Get today question of the day for students' })
  async getStudentQotd() {
    return this.academyService.getStudentQotd();
  }

  @Get('qotd')
  @ApiOperation({ summary: 'Get today question of the day for students (alias)' })
  async getStudentQotdAlias() {
    return this.academyService.getStudentQotd();
  }

  @Post('qotd/:id/answer')
  @ApiOperation({ summary: 'Submit QOTD answer as student' })
  async answerStudentQotd(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.academyService.answerStudentQotd(req.user.userId || req.user.id, id, Number(body.selectedOptionIndex));
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get XP leaderboard for students' })
  async getStudentLeaderboard() {
    return this.academyService.getStudentLeaderboard();
  }
}
