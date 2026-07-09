import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CopilotService } from './copilot.service';
import { IsString, IsArray, IsOptional, IsObject } from 'class-validator';

class CopilotChatDto {
  @IsString()
  @IsOptional()
  message?: string;

  @IsArray()
  @IsOptional()
  history?: any[];

  @IsArray()
  @IsOptional()
  messages?: any[];

  @IsObject()
  @IsOptional()
  portfolioContext?: any;
}

@ApiTags('copilot')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('copilot')
export class CopilotController {
  constructor(private readonly copilotService: CopilotService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Chat with TradeMind AI Copilot' })
  async chat(@Request() req: any, @Body() dto: CopilotChatDto) {
    let message = dto.message;
    let history = dto.history || [];

    if (!message && dto.messages && dto.messages.length > 0) {
      const lastMsg = dto.messages[dto.messages.length - 1];
      message = lastMsg.content;
      history = dto.messages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'model' : m.role,
        content: m.content
      }));
    }

    return this.copilotService.chatWithCopilot(
      req.user.id,
      message || '',
      history,
    );
  }
}
