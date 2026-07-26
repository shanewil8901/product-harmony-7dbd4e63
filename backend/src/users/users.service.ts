import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
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
