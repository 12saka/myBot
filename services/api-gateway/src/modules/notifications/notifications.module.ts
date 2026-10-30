import { Module, Controller, Get, Patch, Delete, Param, UseGuards, Req } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Get all notifications for authenticated user (auto-deduplicated)' })
  async getAll(@Req() req: any) {
    const userId = req.user.userId;
    const raw = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const seen = new Set<string>();
    const unique: typeof raw = [];
    const duplicateIds: string[] = [];

    for (const n of raw) {
      const sig = `${(n.type || '').trim()}::${(n.title || '').trim().toLowerCase()}::${(n.message || '').trim().toLowerCase()}`;
      if (seen.has(sig)) {
        duplicateIds.push(n.id);
      } else {
        seen.add(sig);
        unique.push(n);
      }
    }

    if (duplicateIds.length > 0) {
      this.prisma.notification
        .deleteMany({ where: { id: { in: duplicateIds }, userId } })
        .catch(() => {});
    }

    return unique;
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

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.userId;
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    return { message: `Notification ${id} marked as read` };
  }

  @Delete('clear-all')
  @ApiOperation({ summary: 'Delete all notifications for authenticated user' })
  async clearAll(@Req() req: any) {
    const userId = req.user.userId;
    await this.prisma.notification.deleteMany({
      where: { userId },
    });
    return { message: 'All notifications cleared' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a single notification for authenticated user' })
  async removeOne(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.userId;
    await this.prisma.notification.deleteMany({
      where: { id, userId },
    });
    return { message: `Notification ${id} deleted` };
  }
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
