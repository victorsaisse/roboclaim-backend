import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { File } from 'src/entities/file.entity';
import { User } from 'src/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(File)
    private fileRepository: Repository<File>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const user = await this.userRepository.findOne({ where: { email } });
    return user || undefined;
  }

  async findOne(id: string): Promise<User | undefined> {
    const user = await this.userRepository.findOne({ where: { id } });
    return user || undefined;
  }

  async create(user: User): Promise<User> {
    return this.userRepository.save(user);
  }

  async update(id: string, user: User): Promise<User | undefined> {
    await this.userRepository.update(id, user);
    return this.findOne(id);
  }

  async delete(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }

  async getUserFiles(id: string): Promise<File[]> {
    const userFiles = await this.userRepository.findOne({
      where: { id },
      relations: ['files'],
    });

    return userFiles?.files || [];
  }

  async getUserStats(id: string): Promise<
    {
      processingTime: number;
      errorLog: string;
    }[]
  > {
    const userStats = await this.fileRepository.find({
      where: { user: { id } },
      select: {
        processingTime: true,
        errorLog: true,
      },
    });

    return userStats.map((file) => ({
      processingTime: file.processingTime,
      errorLog: file.errorLog,
    }));
  }
}
