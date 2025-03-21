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
    await this.fileRepository.delete({ user: { id } });

    await this.userRepository.delete(id);
  }

  async getUserFiles(
    id: string,
    fileName?: string,
    fileType?: string,
    status?: string,
    sortBy?: string,
    sortOrder?: string,
    page: number = 1,
  ): Promise<{ files: File[]; total: number }> {
    const limit = 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.fileRepository
      .createQueryBuilder('file')
      .leftJoinAndSelect('file.user', 'user')
      .where('user.id = :userId', { userId: id });

    if (fileName) {
      queryBuilder.andWhere('LOWER(file.originalName) LIKE LOWER(:fileName)', {
        fileName: `%${fileName}%`,
      });
    }

    if (fileType) {
      if (fileType === 'pdf') {
        queryBuilder.andWhere('file.fileType = :fileType', {
          fileType: 'application/pdf',
        });
      } else if (fileType === 'image') {
        queryBuilder.andWhere('file.fileType = :fileType', {
          fileType: 'image/png',
        });
      } else if (fileType === 'sheet') {
        queryBuilder.andWhere('file.fileType NOT IN (:...excludedTypes)', {
          excludedTypes: ['application/pdf', 'image/png'],
        });
      }
    }

    if (status) {
      queryBuilder.andWhere('file.status = :status', { status });
    }

    let dbSortField = 'file.createdAt';
    if (sortBy) {
      switch (sortBy) {
        case 'name':
          dbSortField = 'file.originalName';
          break;
        case 'date':
          dbSortField = 'file.createdAt';
          break;
        case 'processingTime':
          dbSortField = 'file.processingTime';
          break;
      }
    }

    const order = sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    queryBuilder.orderBy(dbSortField, order);

    queryBuilder.take(limit).skip(skip);

    const [files, total] = await queryBuilder.getManyAndCount();

    return { files, total };
  }

  async getUserStats(id: string): Promise<{
    chartData: { fileType: string; totalFiles: number }[];
    userStats: {
      processingTime: number;
      errorLog: string;
    }[];
  }> {
    const userStats = await this.fileRepository.find({
      where: { user: { id } },
      select: {
        processingTime: true,
        errorLog: true,
        fileType: true,
      },
    });

    const totalPdfFiles = userStats.filter(
      (file) => file.fileType === 'application/pdf',
    ).length;

    const totalImageFiles = userStats.filter(
      (file) => file.fileType === 'image/png',
    ).length;

    const totalSheetFiles = userStats.filter(
      (file) =>
        file.fileType !== 'application/pdf' && file.fileType !== 'image/png',
    ).length;

    const chartData = [
      { fileType: 'PDFs', totalFiles: totalPdfFiles },
      { fileType: 'Images', totalFiles: totalImageFiles },
      { fileType: 'Spreadsheets', totalFiles: totalSheetFiles },
    ];

    return {
      userStats: userStats.map((file) => ({
        processingTime: file.processingTime,
        errorLog: file.errorLog,
      })),
      chartData,
    };
  }
}
