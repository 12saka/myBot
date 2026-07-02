import { Module, Controller, Get, Patch, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  @Get() getAll() { return { message: 'All notifications for authenticated user' }; }
  @Patch(':id/read') markRead(@Param('id') id: string) { return { message: `Notification ${id} marked as read` }; }
  @Patch('read-all') markAllRead() { return { message: 'All notifications marked as read' }; }
}

@Module({ controllers: [NotificationsController] })
export class NotificationsModule {}
