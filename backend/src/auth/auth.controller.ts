import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

interface AuthedRequest {
  user: { id: string; email: string; name: string };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  /**
   * Returns the *current* account straight from the database (not the token
   * snapshot) so the role object — and any role change — is always accurate
   * after a page refresh.
   */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: AuthedRequest) {
    return this.auth.profile(req.user.id);
  }

  /**
   * Slides the session forward while the user is actively working.
   * Requires a still-valid token; expired tokens must sign in again.
   */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('refresh')
  refresh(@Req() req: AuthedRequest) {
    return this.auth.refresh(req.user.id);
  }
}
