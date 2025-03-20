import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileObject } from '@supabase/storage-js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class FileService {
  private supabase: SupabaseClient;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseApiKey = this.configService.get<string>('SUPABASE_API_KEY');

    if (!supabaseUrl || !supabaseApiKey) {
      throw new Error('Supabase configuration is missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseApiKey);
    this.bucketName = this.configService.get<string>('SUPABASE_BUCKET')!;
  }

  async uploadFile(
    file: Express.Multer.File,
    filePath: string,
  ): Promise<{ url: string; path: string } | null> {
    try {
      const fileBody = new File([file.buffer], file.originalname, {
        type: file.mimetype,
      });

      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, fileBody);

      if (error || !data) {
        console.error('Error uploading file to Supabase:', error);
        return null;
      }

      const { data: urlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

      return {
        url: urlData.publicUrl,
        path: filePath,
      };
    } catch (error) {
      console.error('Error in file upload service:', error);
      return null;
    }
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        console.error('Error deleting file from Supabase:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in file delete service:', error);
      return false;
    }
  }

  async getFiles(): Promise<FileObject[]> {
    // get all files urls from supabase
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .list();

    if (error) {
      console.error('Error in file get service:', error);
      return [];
    }

    return data;
  }
}
