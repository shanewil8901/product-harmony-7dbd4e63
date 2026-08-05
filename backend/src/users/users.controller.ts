import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';

/**
 * Read-only directory of login accounts.
 *
 * Accounts are never created here: every login account is created together with
 * its HR profile through POST /employees, so the two can never drift apart.
 */
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles('admin', 'manager')
  async list() {
    const rows = await this.users.list();
    return rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role ? { id: u.role.id, code: u.role.code, name: u.role.name } : null,
      created_at: u.created_at,
    }));
  }
}
