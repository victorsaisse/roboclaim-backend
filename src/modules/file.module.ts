import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileController } from 'src/controllers/file.controller';
import { File } from 'src/entities/file.entity';
import { FileService } from 'src/services/file.service';
import { UserModule } from './user.module';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([File]), UserModule],
  controllers: [FileController],
  providers: [FileService],
  exports: [FileService],
})
export class FileModule {}
