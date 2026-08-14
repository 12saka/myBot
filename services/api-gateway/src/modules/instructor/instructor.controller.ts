import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InstructorService } from './instructor.service';
import { InstructorCommunityService } from './instructor-community.service';

@ApiTags('Instructor Portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN')
@Controller('instructor')
export class InstructorController {
  constructor(
    private readonly instructorService: InstructorService,
    private readonly communityService: InstructorCommunityService,
  ) {}

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get instructor metrics, KPIs, and recent student submissions' })
  async getInstructorStats(@Req() req: any) {
    return this.instructorService.getInstructorStats(req.user.userId, req.user.role);
  }

  @Get('courses')
  @ApiOperation({ summary: 'Get instructor assigned courses & curriculum' })
  async getCourses(@Req() req: any) {
    return this.instructorService.getCourses(req.user.userId, req.user.role);
  }

  @Post('courses')
  @ApiOperation({ summary: 'Create new course as instructor' })
  async createCourse(@Req() req: any, @Body() body: any) {
    return this.instructorService.createCourse(req.user.userId, body);
  }

  @Patch('courses/:id')
  @ApiOperation({ summary: 'Update instructor course & curriculum' })
  async updateCourse(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.instructorService.updateCourse(req.user.userId, req.user.role, id, body);
  }

  @Delete('courses/:id')
  @ApiOperation({ summary: 'Delete instructor course' })
  async deleteCourse(@Req() req: any, @Param('id') id: string) {
    return this.instructorService.deleteCourse(req.user.userId, req.user.role, id);
  }

  @Get('assignments')
  @ApiOperation({ summary: 'Get instructor homework assignments & submission counts' })
  async getAssignments(@Req() req: any) {
    return this.instructorService.getAssignments(req.user.userId, req.user.role);
  }

  @Post('assignments')
  @ApiOperation({ summary: 'Publish new homework assignment' })
  async createAssignment(@Req() req: any, @Body() body: any) {
    return this.instructorService.createAssignment(req.user.userId, body);
  }

  @Patch('assignments/:id')
  @ApiOperation({ summary: 'Update homework assignment details' })
  async updateAssignment(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.instructorService.updateAssignment(req.user.userId, req.user.role, id, body);
  }

  @Delete('assignments/:id')
  @ApiOperation({ summary: 'Delete homework assignment' })
  async deleteAssignment(@Req() req: any, @Param('id') id: string) {
    return this.instructorService.deleteAssignment(req.user.userId, req.user.role, id);
  }

  @Get('assignments/submissions')
  @ApiOperation({ summary: 'Get student homework submissions queue for grading' })
  async getSubmissions(@Req() req: any, @Query('status') status?: string) {
    return this.instructorService.getSubmissions(req.user.userId, req.user.role, status);
  }

  @Post('assignments/submissions/:id/grade')
  @ApiOperation({ summary: 'Grade student assignment with score & written feedback' })
  async gradeSubmission(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.instructorService.gradeSubmission(req.user.userId, req.user.role, id, body);
  }

  @Get('webinars')
  @ApiOperation({ summary: 'Get scheduled & past Zoom webinars / live classes' })
  async getWebinars(@Req() req: any) {
    return this.instructorService.getWebinars(req.user.userId, req.user.role);
  }

  @Post('webinars')
  @ApiOperation({ summary: 'Schedule & publish new Zoom meeting webinar' })
  async createWebinar(@Req() req: any, @Body() body: any) {
    return this.instructorService.createWebinar(req.user.userId, body);
  }

  @Patch('webinars/:id')
  @ApiOperation({ summary: 'Update Zoom webinar details or status' })
  async updateWebinar(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.instructorService.updateWebinar(req.user.userId, req.user.role, id, body);
  }

  @Delete('webinars/:id')
  @ApiOperation({ summary: 'Cancel & delete Zoom webinar' })
  async deleteWebinar(@Req() req: any, @Param('id') id: string) {
    return this.instructorService.deleteWebinar(req.user.userId, req.user.role, id);
  }

  @Get('students')
  @ApiOperation({ summary: 'Get enrolled student roster & academic progress analytics' })
  async getStudents() {
    return this.instructorService.getStudents();
  }

  // Community Discussions
  @Get('discussions')
  async getDiscussions(@Query('isSolved') isSolved?: string) {
    const isSolvedBool = isSolved === 'true' ? true : isSolved === 'false' ? false : undefined;
    return this.communityService.getDiscussions(isSolvedBool);
  }

  @Post('discussions')
  async createDiscussion(@Req() req: any, @Body() body: any) {
    return this.communityService.createDiscussion(req.user.userId, body);
  }

  @Post('discussions/:id/reply')
  async replyToDiscussion(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.communityService.replyToDiscussion(req.user.userId, req.user.role, id, body);
  }

  @Patch('discussions/:id/solve')
  async toggleSolveDiscussion(@Param('id') id: string, @Body() body: any) {
    return this.communityService.toggleSolveDiscussion(id, body.isSolved);
  }

  // Daily Updates & Question of the Day
  @Get('daily-activities')
  async getDailyActivities() {
    return this.communityService.getDailyActivities();
  }

  @Post('daily-activities')
  async createDailyActivity(@Req() req: any, @Body() body: any) {
    return this.communityService.createDailyActivity(req.user.userId, body);
  }

  @Get('qotd')
  async getTodayQotd() {
    return this.communityService.getTodayQotd();
  }

  @Post('qotd')
  async createQotd(@Req() req: any, @Body() body: any) {
    return this.communityService.createQotd(req.user.userId, body);
  }

  @Post('qotd/:id/answer')
  async answerQotd(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.communityService.answerQotd(req.user.userId, id, Number(body.selectedOptionIndex));
  }

  @Get('leaderboard')
  async getWeeklyLeaderboard() {
    return this.communityService.getWeeklyLeaderboard();
  }
}
