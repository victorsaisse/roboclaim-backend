import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileController } from 'src/controllers/file.controller';
import { FileService } from 'src/services/file.service';

@Module({
  imports: [ConfigModule],
  controllers: [FileController],
  providers: [FileService],
  exports: [FileService],
})
export class FileModule {}
