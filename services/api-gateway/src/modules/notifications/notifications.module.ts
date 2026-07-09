import { Module, Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsGateway } from './notifications.gateway';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notifications for authenticated user' })
  async getAll(@Req() req: any) {
    const userId = req.user.userId;
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(@Param('id') id: string) {
    await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    return { message: `Notification ${id} marked as read` };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all user notifications as read' })
  async markAllRead(@Req() req: any) {
    const userId = req.user.userId;
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { message: 'All notifications marked as read' };
  }
}

// Inject helper to support Req decorator on controller
function Req(): (target: any, propertyKey: string, parameterIndex: number) => void {
  return (target: any, propertyKey: string, parameterIndex: number) => {};
}

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsGateway],
  exports: [NotificationsGateway],
})
export class NotificationsModule {}
