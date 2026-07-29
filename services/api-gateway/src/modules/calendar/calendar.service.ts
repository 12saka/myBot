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

  private mockEvents: EconomicEvent[] = [
    {
      id: 'evt-cpi-01',
      country: 'United States',
      currency: 'USD',
      eventName: 'US Consumer Price Index (CPI YoY)',
      impact: 5,
      previous: '2.9%',
      forecast: '2.8%',
      actual: null,
      releaseTime: new Date(Date.now() + 18 * 60 * 1000).toISOString(),
      status: 'UPCOMING',
    },
    {
      id: 'evt-nfp-02',
      country: 'United States',
      currency: 'USD',
      eventName: 'US Non-Farm Payrolls (NFP)',
      impact: 5,
      previous: '185K',
      forecast: '175K',
      actual: null,
      releaseTime: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      status: 'UPCOMING',
    },
    {
      id: 'evt-ecb-03',
      country: 'Eurozone',
      currency: 'EUR',
      eventName: 'ECB Deposit Facility Rate Decision',
      impact: 5,
      previous: '3.75%',
      forecast: '3.50%',
      actual: null,
      releaseTime: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      status: 'UPCOMING',
    },
    {
      id: 'evt-boj-04',
      country: 'Japan',
      currency: 'JPY',
      eventName: 'Bank of Japan Monetary Policy Statement',
      impact: 5,
      previous: '0.25%',
      forecast: '0.25%',
      actual: null,
      releaseTime: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      status: 'UPCOMING',
    },
  ];

  async getUpcomingEvents(): Promise<EconomicEvent[]> {
    const now = Date.now();
    return this.mockEvents.map((evt) => {
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
