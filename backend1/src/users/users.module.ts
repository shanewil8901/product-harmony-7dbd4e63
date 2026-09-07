import { Module, OnModuleInit } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { Role } from '../master-data/role.entity';
import { MasterDataModule } from '../master-data/master-data.module';
import { BOOTSTRAP_ADMIN_EMAIL } from './bootstrap';


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
    try {
      await this.bootstrapAdmin();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'ER_NO_SUCH_TABLE') {
        // eslint-disable-next-line no-console
        console.warn(
          '[seed] users/roles tables are missing — skipping bootstrap admin. ' +
            'Set DB_SYNC=true (or run migrations) so the schema is created.',
        );
        return;
      }
      throw err;
    }
  }

  private async bootstrapAdmin() {
    const adminRole = await this.roleRepo.findOne({ where: { code: 'admin' } });
    if (!adminRole) return; // roles get seeded by MasterDataModule; skip if not ready

    // A real admin exists → the temporary account must not survive (or return).
    const realAdmin = await this.userRepo
      .createQueryBuilder('u')
      .where('u.role_id = :roleId', { roleId: adminRole.id })
      .andWhere('u.email != :email', { email: BOOTSTRAP_ADMIN_EMAIL })
      .getOne();
    if (realAdmin) {
      await this.userRepo.delete({ email: BOOTSTRAP_ADMIN_EMAIL });
      return;
    }

    // Brand-new database: seed the temporary admin used only to create the
    // first real admin from the Employees screen.
    const count = await this.userRepo.count();
    if (count === 0) {
      const password = await bcrypt.hash('admin123', 10);
      await this.userRepo.save(
        this.userRepo.create({
          email: BOOTSTRAP_ADMIN_EMAIL,
          name: 'Temporary Administrator',
          password,
          role_id: adminRole.id,
        }),
      );
      // eslint-disable-next-line no-console
      console.log(`[seed] Created temporary admin: ${BOOTSTRAP_ADMIN_EMAIL} / admin123`);
    }
  }
}

