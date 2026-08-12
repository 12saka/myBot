import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { AcademyAnalyticsService } from './academy-analytics.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly academyAnalyticsService: AcademyAnalyticsService,
  ) {}

  @Post('claim-superadmin')
  @ApiOperation({ summary: 'Grant current logged in user full SUPER_ADMIN master privileges in database' })
  async claimSuperAdmin(@Req() req: any) {
    return this.adminService.claimSuperAdmin(req.user.userId);
  }

  @Get('dashboard/overview')
  @ApiOperation({ summary: 'Get Superadmin executive overview stats & health' })
  async getOverview() {
    return this.adminService.getDashboardOverview();
  }

  @Get('academy/analytics')
  @ApiOperation({ summary: 'Get Superadmin Academy Learning Funnel & Student Health Indicators' })
  async getSuperadminAcademyAnalytics() {
    return this.academyAnalyticsService.getSuperadminAcademyOverview();
  }

  @Get('academy/retention')
  @ApiOperation({ summary: 'Get Content Quality & Lesson Drop-off Retention Curve Telemetry' })
  async getContentQualityMetrics() {
    return this.academyAnalyticsService.getContentQualityMetrics();
  }

  @Get('users')
  @ApiOperation({ summary: 'List and search users with filters' })
  async getUsers(@Query('search') search?: string, @Query('role') role?: string, @Query('page') page?: number) {
    return this.adminService.getUsers({ search, role, page });
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get single user detail profile' })
  async getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Update user role or suspension status' })
  async updateUserRoleAndStatus(@Req() req: any, @Param('id') id: string, @Body() body: { role?: string; isSuspended?: boolean; balance?: number; firstName?: string; lastName?: string; telegramUrl?: string }) {
    return this.adminService.updateUserRoleAndStatus(req.user.userId, id, body);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user details, balance, or profile' })
  async updateUser(@Req() req: any, @Param('id') id: string, @Body() body: { role?: string; balance?: number; firstName?: string; lastName?: string; telegramUrl?: string; isSuspended?: boolean }) {
    return this.adminService.updateUserRoleAndStatus(req.user.userId, id, body);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete user account' })
  async deleteUser(@Req() req: any, @Param('id') id: string) {
    return this.adminService.deleteUser(req.user.userId, id);
  }

  @Get('kyc')
  @ApiOperation({ summary: 'Get KYC verification queue' })
  async getKycQueue(@Query('status') status?: string) {
    return this.adminService.getKycQueue(status);
  }

  @Patch('kyc/:id/approve')
  @ApiOperation({ summary: 'Approve KYC document' })
  async approveKyc(@Req() req: any, @Param('id') id: string) {
    return this.adminService.approveKyc(req.user.userId, id);
  }

  @Patch('kyc/:id/reject')
  @ApiOperation({ summary: 'Reject KYC document with reason' })
  async rejectKyc(@Req() req: any, @Param('id') id: string, @Body('reason') reason: string) {
    return this.adminService.rejectKyc(req.user.userId, id, reason || 'Document verification failed.');
  }

  @Get('academy/courses')
  @ApiOperation({ summary: 'Get all courses for admin management' })
  async getAdminCourses() {
    return this.adminService.getAdminCourses();
  }

  @Post('academy/courses')
  @ApiOperation({ summary: 'Create new course in LMS' })
  async createCourse(@Req() req: any, @Body() body: { title: string; description: string; category: string; level: string; imageUrl?: string; isPublished?: boolean }) {
    return this.adminService.createCourse(req.user.userId, body);
  }

  @Patch('academy/courses/:id')
  @ApiOperation({ summary: 'Update existing course in LMS' })
  async updateCourse(@Req() req: any, @Param('id') id: string, @Body() body: { title?: string; description?: string; category?: string; level?: string; imageUrl?: string; isPublished?: boolean }) {
    return this.adminService.updateCourse(req.user.userId, id, body);
  }

  @Post('academy/courses/:id/lessons')
  @ApiOperation({ summary: 'Add a new lesson with video/image media to a course' })
  async addLessonToCourse(@Req() req: any, @Param('id') courseId: string, @Body() body: { title: string; content: string; videoUrl?: string; orderIndex?: number }) {
    return this.adminService.addLessonToCourse(req.user.userId, courseId, body);
  }

  @Patch('academy/lessons/:id')
  @ApiOperation({ summary: 'Update existing lesson in LMS' })
  async updateLesson(@Req() req: any, @Param('id') lessonId: string, @Body() body: { title?: string; content?: string; videoUrl?: string; orderIndex?: number }) {
    return this.adminService.updateLesson(req.user.userId, lessonId, body);
  }

  @Delete('academy/lessons/:id')
  @ApiOperation({ summary: 'Delete a lesson from LMS' })
  async deleteLesson(@Req() req: any, @Param('id') lessonId: string) {
    return this.adminService.deleteLesson(req.user.userId, lessonId);
  }

  @Delete('academy/courses/:id')
  @ApiOperation({ summary: 'Delete course from LMS' })
  async deleteCourse(@Req() req: any, @Param('id') id: string) {
    return this.adminService.deleteCourse(req.user.userId, id);
  }

  @Get('users/:id/360')
  @ApiOperation({ summary: 'Get 360-degree comprehensive user profile, audit trail, security & academy progress' })
  async getUser360Details(@Param('id') id: string) {
    return this.adminService.getUser360Details(id);
  }

  @Get('academy/questions')
  @ApiOperation({ summary: 'Get Question Bank items for Quiz creation' })
  async getQuestionBank() {
    return this.adminService.getQuestionBank();
  }

  @Post('academy/questions')
  @ApiOperation({ summary: 'Create new item in central Question Bank' })
  async createQuestion(@Req() req: any, @Body() body: any) {
    return this.adminService.createQuestion(req.user.userId, body);
  }

  @Patch('academy/questions/:id')
  @ApiOperation({ summary: 'Update item in central Question Bank' })
  async updateQuestion(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.adminService.updateQuestion(req.user.userId, id, body);
  }

  @Delete('academy/questions/:id')
  @ApiOperation({ summary: 'Delete item from central Question Bank' })
  async deleteQuestion(@Req() req: any, @Param('id') id: string) {
    return this.adminService.deleteQuestion(req.user.userId, id);
  }

  @Get('academy/quizzes')
  @ApiOperation({ summary: 'Get all Quizzes for LMS management' })
  async getAdminQuizzes() {
    return this.adminService.getAdminQuizzes();
  }

  @Post('academy/quizzes')
  @ApiOperation({ summary: 'Create new Quiz with Question Bank items' })
  async createQuiz(@Req() req: any, @Body() body: any) {
    return this.adminService.createQuiz(req.user.userId, body);
  }

  @Patch('academy/quizzes/:id')
  @ApiOperation({ summary: 'Update existing Quiz and questions' })
  async updateQuiz(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.adminService.updateQuiz(req.user.userId, id, body);
  }

  @Delete('academy/quizzes/:id')
  @ApiOperation({ summary: 'Delete Quiz from LMS' })
  async deleteQuiz(@Req() req: any, @Param('id') id: string) {
    return this.adminService.deleteQuiz(req.user.userId, id);
  }

  @Get('academy/analytics')
  @ApiOperation({ summary: 'Get Academy Master Analytics & Most-Missed Questions' })
  async getAcademyAnalytics() {
    return this.adminService.getAcademyAnalytics();
  }

  @Get('signals')
  @ApiOperation({ summary: 'Get all AI signals for admin audit' })
  async getAdminSignals() {
    return this.adminService.getAdminSignals();
  }

  @Patch('signals/:id/expire')
  @ApiOperation({ summary: 'Manually expire or override a signal' })
  async expireSignal(@Req() req: any, @Param('id') id: string) {
    return this.adminService.expireSignal(req.user.userId, id);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get system audit trail log events' })
  async getAuditLogs(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.getAuditLogs(Number(page || 1), Number(limit || 50));
  }
}
