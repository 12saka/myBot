import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/overview')
  @ApiOperation({ summary: 'Get Superadmin executive overview stats & health' })
  async getOverview() {
    return this.adminService.getDashboardOverview();
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
  async updateUserRoleAndStatus(@Req() req: any, @Param('id') id: string, @Body() body: { role?: string; isSuspended?: boolean }) {
    return this.adminService.updateUserRoleAndStatus(req.user.userId, id, body);
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

  @Post('academy/courses/:id/lessons')
  @ApiOperation({ summary: 'Add a new lesson with video/image media to a course' })
  async addLessonToCourse(@Req() req: any, @Param('id') courseId: string, @Body() body: { title: string; content: string; videoUrl?: string; orderIndex?: number }) {
    return this.adminService.addLessonToCourse(req.user.userId, courseId, body);
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
