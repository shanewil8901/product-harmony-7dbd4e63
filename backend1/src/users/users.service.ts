import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { User } from './user.entity';
import { BOOTSTRAP_ADMIN_EMAIL } from './bootstrap';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  /** True when a real (non-temporary) admin account exists. */
  async hasRealAdmin() {
    const admin = await this.repo.findOne({
      where: { email: Not(BOOTSTRAP_ADMIN_EMAIL), role: { code: 'admin' } },
      relations: ['role'],
    });
    return !!admin;
  }

  /** Removes the temporary admin once a real admin has been created. */
  async removeBootstrapAdmin() {
    if (!(await this.hasRealAdmin())) return false;
    const res = await this.repo.delete({ email: BOOTSTRAP_ADMIN_EMAIL });
    return (res.affected ?? 0) > 0;
  }

  count() {
    return this.repo.count();
  }


  list() {
    return this.repo.find({ order: { created_at: 'DESC' } });
  }

  create(data: Pick<User, 'email' | 'name' | 'password'> & { role_id?: string | null }) {
    return this.repo.save(this.repo.create(data));
  }

  findAnyWithoutRole() {
    return this.repo.findOne({ where: { role_id: IsNull() } });
  }

  async setRole(userId: string, roleId: string) {
    await this.repo.update({ id: userId }, { role_id: roleId });
  }
}
