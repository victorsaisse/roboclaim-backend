import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileObject } from '@supabase/storage-js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as pdfParse from 'pdf-parse';
import { createWorker } from 'tesseract.js';

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
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

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
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .list();

    if (error) {
      console.error('Error in file get service:', error);
      return [];
    }

    return data;
  }

  async extractData(filePath: string, userId: string): Promise<string> {
    console.log('extractData', filePath, userId);

    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .download(filePath);

      if (error || !data) {
        console.error('Error downloading file:', error);
        return 'File download failed';
      }

      if (data.type === 'application/pdf') {
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const pdfData = await pdfParse(buffer);

        console.log(pdfData.text);

        return pdfData.text;
      }

      if (data.type === 'image/jpeg' || data.type === 'image/png') {
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const worker = await createWorker();

        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const {
            data: { text },
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          } = await worker.recognize(`data:${data.type};base64,${base64Image}`);

          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          await worker.terminate();

          console.log('OCR text:', text);

          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return text;
        } catch (ocrError) {
          console.error('OCR Error:', ocrError);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          await worker.terminate();
          return 'OCR processing failed';
        }
      }

      return 'Unsupported file type';
    } catch (error) {
      console.error('File extraction error:', error);
      return 'Failed to extract file';
    }
  }
}
