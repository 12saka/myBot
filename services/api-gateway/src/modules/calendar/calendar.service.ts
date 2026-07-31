import { Injectable, Logger } from '@nestjs/common';

export interface EconomicEvent {
  id: string;
  country: string;
  currency: string;
  eventName: string;
  impact: 1 | 2 | 3 | 4 | 5;
  previous: string;
  forecast: string;
  actual: string | null;
  releaseTime: string;
  status: 'UPCOMING' | 'BLACKOUT_ACTIVE' | 'RELEASED';
}

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);



  private liveEvents: EconomicEvent[] = [];
  private lastFetched = 0;

  async getUpcomingEvents(): Promise<EconomicEvent[]> {
    const now = Date.now();
    // Cache live calendar fetch for 5 minutes
    if (this.liveEvents.length > 0 && (now - this.lastFetched) < 5 * 60 * 1000) {
      return this.updateEventStatuses(this.liveEvents);
    }

    try {
      const response = await fetch('https://n8n.wookweb.com/webhook/economic-calendar', {
        headers: { 'User-Agent': 'TradeMind-Gateway/2.0' }
      });
      if (response.ok) {
        const raw = await response.json();
        if (Array.isArray(raw)) {
          this.liveEvents = raw.map((item: any, idx: number) => ({
            id: `evt-${idx}-${Date.now()}`,
            country: item.country || 'United States',
            currency: item.currency || 'USD',
            eventName: item.title || item.event || 'Macro Event',
            impact: (item.impact === 'High' ? 5 : item.impact === 'Medium' ? 3 : 2) as any,
            previous: item.previous || '2.8%',
            forecast: item.forecast || '2.7%',
            actual: item.actual || null,
            releaseTime: item.date || new Date(Date.now() + (idx + 1) * 3600 * 1000).toISOString(),
            status: 'UPCOMING'
          }));
          this.lastFetched = now;
          return this.updateEventStatuses(this.liveEvents);
        }
      }
    } catch (err) {}

    // Fallback: Return empty list if external calendar provider unavailable
    return [];
  }

  private updateEventStatuses(events: EconomicEvent[]): EconomicEvent[] {
    const now = Date.now();
    return events.map((evt) => {
      const timeDiffMs = new Date(evt.releaseTime).getTime() - now;
      let status: 'UPCOMING' | 'BLACKOUT_ACTIVE' | 'RELEASED' = 'UPCOMING';

      if (timeDiffMs <= 5 * 60 * 1000 && timeDiffMs >= -15 * 60 * 1000) {
        status = 'BLACKOUT_ACTIVE';
      } else if (timeDiffMs < -15 * 60 * 1000) {
        status = 'RELEASED';
      }

      return { ...evt, status };
    });
  }

  async getBlackoutStatus(): Promise<{
    isBlackoutActive: boolean;
    activeEvent: EconomicEvent | null;
    penaltyPoints: number;
  }> {
    const events = await this.getUpcomingEvents();
    const blackoutEvent = events.find((e) => e.status === 'BLACKOUT_ACTIVE' && e.impact >= 4);

    if (blackoutEvent) {
      return {
        isBlackoutActive: true,
        activeEvent: blackoutEvent,
        penaltyPoints: 10.0,
      };
    }

    return {
      isBlackoutActive: false,
      activeEvent: null,
      penaltyPoints: 0.0,
    };
  }
}
