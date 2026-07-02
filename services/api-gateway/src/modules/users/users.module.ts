import { Module, Controller, Get, Patch, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  @Get('me') getMe() { return { message: 'Authenticated user profile' }; }
  @Patch('me') updateMe(@Body() body: any) { return { message: 'Profile updated', data: body }; }
  @Get('me/kyc') getKyc() { return { message: 'KYC verification status' }; }
}

@Module({ controllers: [UsersController] })
export class UsersModule {}
