import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';
import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Extract token from handshake authorization header or query
      const authHeader = client.handshake.headers.authorization || client.handshake.query.token;
      if (!authHeader) {
        console.log(`[WS] Connection rejected: No authorization token provided.`);
        client.disconnect();
        return;
      }

      const token = (authHeader as string).replace('Bearer ', '');
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
      });

      // Validate session in Redis
      const sessionActive = await this.redis.getSession(payload.sid);
      if (!sessionActive) {
        console.log(`[WS] Connection rejected: Session is inactive in Redis.`);
        client.disconnect();
        return;
      }

      // Store payload details in the client socket data object
      client.data = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
        sessionId: payload.sid,
      };

      // Join a user-specific room for private notifications
      await client.join(`user:${payload.sub}`);
      console.log(`[WS] Client connected: User ${payload.sub} (Session: ${payload.sid})`);
    } catch (err: any) {
      console.log(`[WS] Handshake verification failed:`, err.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data && client.data.userId) {
      console.log(`[WS] Client disconnected: User ${client.data.userId}`);
    }
  }

  // --- Real-time Market Streams ---
  
  @SubscribeMessage('subscribe_market')
  async handleSubscribeMarket(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { symbol: string }
  ) {
    const symbol = data.symbol.toUpperCase();
    await client.join(`market:${symbol}`);
    console.log(`[WS] User ${client.data.userId} subscribed to market feed: ${symbol}`);
    return { status: 'SUBSCRIBED', symbol };
  }

  @SubscribeMessage('unsubscribe_market')
  async handleUnsubscribeMarket(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { symbol: string }
  ) {
    const symbol = data.symbol.toUpperCase();
    await client.leave(`market:${symbol}`);
    console.log(`[WS] User ${client.data.userId} unsubscribed from market feed: ${symbol}`);
    return { status: 'UNSUBSCRIBED', symbol };
  }

  // Cron interval that pushes price updates to room subscribers every 2 seconds
  @Interval(2000)
  async broadcastMarketTicks() {
    const adapter = this.server?.sockets?.adapter;
    if (!adapter) return;

    const symbols = [
      'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 
      'AAPL', 'TSLA', 'NVDA', 
      'EUR/USD', 'GBP/USD', 'USD/JPY'
    ];
    for (const symbol of symbols) {
      const roomName = `market:${symbol}`;
      const room = adapter.rooms.get(roomName);
      if (room && room.size > 0) {
        const dbMarket = await this.prisma.marketData.findUnique({ where: { symbol } });
        if (dbMarket) {
          this.server.to(roomName).emit('market_tick', {
            symbol,
            bidPrice: dbMarket.bidPrice,
            askPrice: dbMarket.askPrice,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }

  // --- Push Notifications Broadcaster ---

  async sendNotification(userId: string, title: string, message: string) {
    // Save notification record in PostgreSQL
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        isRead: false,
      },
    });

    // Broadcast to the user's socket room
    if (this.server) {
      this.server.to(`user:${userId}`).emit('notification', notification);
      console.log(`[WS] Dispatched push notification to user:${userId}: "${title}"`);
    }
  }
}
