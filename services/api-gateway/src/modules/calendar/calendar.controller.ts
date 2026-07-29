import { Controller, Get } from '@nestjs/common';
import { CalendarService } from './calendar.service';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('upcoming')
  async getUpcomingEvents() {
    return this.calendarService.getUpcomingEvents();
  }

  @Get('blackout-status')
  async getBlackoutStatus() {
    return this.calendarService.getBlackoutStatus();
  }
}
