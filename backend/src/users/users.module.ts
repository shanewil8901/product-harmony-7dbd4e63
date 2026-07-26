import { Module, OnModuleInit } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { Role } from '../master-data/role.entity';
import { MasterDataModule } from '../master-data/master-data.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role]), MasterDataModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule implements OnModuleInit {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
  ) {}

  async onModuleInit() {
    // Seed a default admin so the system is usable after login-only signup is removed.
    const adminRole = await this.roleRepo.findOne({ where: { code: 'admin' } });
    if (!adminRole) return; // roles get seeded by MasterDataModule; skip if not ready
    const count = await this.userRepo.count();
    if (count === 0) {
      const password = await bcrypt.hash('admin123', 10);
      await this.userRepo.save(
        this.userRepo.create({
          email: 'admin@example.com',
          name: 'Administrator',
          password,
          role_id: adminRole.id,
        }),
      );
      // eslint-disable-next-line no-console
      console.log('[seed] Created default admin user: admin@example.com / admin123');
    }
  }
}
