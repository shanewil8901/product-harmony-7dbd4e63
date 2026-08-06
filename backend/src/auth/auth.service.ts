import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import type { RoleCode } from '../master-data/role.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  /** Shared shape for /auth/login, /auth/me and /auth/refresh. */
  private publicUser(user: {
    id: string;
    email: string;
    name: string;
    role?: { id: string; code: RoleCode; name: string } | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role ? { id: user.role.id, code: user.role.code, name: user.role.name } : null,
    };
  }

  private sign(user: { id: string; email: string; name: string; role?: { code: RoleCode } | null }) {
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: (user.role?.code ?? null) as RoleCode | null,
    });
  }

  /** Current account state, read fresh so role changes apply immediately. */
  async profile(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Your account is no longer active');
    return this.publicUser(user);
  }

  /** Issues a new token for an active session (sliding expiry). */
  async refresh(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Your account is no longer active');
    return { access_token: this.sign(user), user: this.publicUser(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return { access_token: this.sign(user), user: this.publicUser(user) };
  }
}
