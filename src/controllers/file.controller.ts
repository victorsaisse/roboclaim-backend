import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileObject } from '@supabase/storage-js';
import { Role } from 'src/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { FileService } from 'src/services/file.service';
import { v4 as uuidv4 } from 'uuid';
interface FileUploadResponse {
  success: boolean;
  url?: string;
  path?: string;
  message?: string;
}

@Controller('files')
export class FileController {
  constructor(private fileService: FileService) {}

  @Post('/upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<FileUploadResponse> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    try {
      const fileName = uuidv4();
      const result = await this.fileService.uploadFile(file, fileName);

      if (!result) {
        return {
          success: false,
          message: 'File upload failed',
        };
      }

      return {
        success: true,
        url: result.url,
        path: result.path,
      };
    } catch (error) {
      console.error('File upload error:', error);
      return {
        success: false,
        message: `File upload failed: ${error}`,
      };
    }
  }

  @Delete(':path')
  @UseGuards(JwtAuthGuard)
  async deleteFile(
    @Param('path') path: string,
  ): Promise<{ success: boolean; message: string }> {
    const success = await this.fileService.deleteFile(path);

    return {
      success,
      message: success ? 'File deleted successfully' : 'Failed to delete file',
    };
  }

  @Get()
  @UseGuards(RolesGuard)
  @Role('admin')
  async getFiles(): Promise<FileObject[]> {
    return this.fileService.getFiles();
  }
}
