import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../master-data/role.entity';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
  ) {}

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

  @Post()
  @Roles('admin', 'manager')
  async create(@Body() dto: CreateUserDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');
    const role = await this.roleRepo.findOne({ where: { code: dto.role } });
    if (!role) throw new BadRequestException('Invalid role');
    const hash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create({
      email: dto.email,
      name: dto.name,
      password: hash,
      role_id: role.id,
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: { id: role.id, code: role.code, name: role.name },
    };
  }
}
