import {
  BadRequestException,
  Body,
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
    @Body('userId') userId: string,
  ): Promise<FileUploadResponse> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    try {
      const filePath = `${userId}/${uuidv4()}`;
      const result = await this.fileService.uploadFile(file, filePath, userId);

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

  @UseGuards(JwtAuthGuard)
  @Post('extract')
  extract(
    @Body('filePath') filePath: string,
    @Body('userId') userId: string,
  ): { success: boolean; message: string } {
    void this.backgroundProcess(filePath, userId);

    return {
      success: true,
      message: 'Extraction started',
    };
  }

  private async backgroundProcess(
    filePath: string,
    userId: string,
  ): Promise<void> {
    await this.fileService.extractData(filePath, userId);

    return;
  }
}
