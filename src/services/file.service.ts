/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileObject } from '@supabase/storage-js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as Papa from 'papaparse';
import * as pdfParse from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import * as XLSX from 'xlsx';

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

        console.log('pdfData', pdfData.text);

        return pdfData.text;
      }

      if (data.type === 'image/jpeg' || data.type === 'image/png') {
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');

        const worker = await createWorker();

        try {
          const {
            data: { text },
          } = await worker.recognize(`data:${data.type};base64,${base64Image}`);

          await worker.terminate();

          console.log('OCR text:', text);

          return text;
        } catch (ocrError) {
          console.error('OCR Error:', ocrError);

          await worker.terminate();
          return 'OCR processing failed';
        }
      }

      if (
        data.type === 'text/csv' ||
        data.type === 'application/vnd.ms-excel' ||
        data.type ===
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ) {
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (data.type === 'text/csv') {
          const textData = buffer.toString('utf8');
          console.log('textData csv', textData);

          return this.parseCSV(textData);
        } else {
          const textData = this.parseExcel(buffer);
          console.log('textData xlsx', textData);

          return textData;
        }
      }

      return 'Unsupported file type';
    } catch (error) {
      console.error('File extraction error:', error);
      return 'Failed to extract file';
    }
  }

  private async parseCSV(csvData: string): Promise<string> {
    return new Promise((resolve, reject) => {
      Papa.parse(csvData, {
        complete: (results: { errors: string | any[]; data: any[] }) => {
          if (results.errors.length > 0) {
            console.error('CSV parsing errors:', results.errors);

            reject(new Error('CSV parsing errors occurred'));
            return;
          }

          const formatted = results.data

            .map((row: any) => row.join(','))
            .join('\n');

          resolve(formatted);
        },
        error: (error: Error) => {
          console.error('CSV parse error:', error);

          reject(new Error('Failed to parse CSV file'));
        },
      });
    });
  }

  private parseExcel(buffer: Buffer): string {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      return data.map((row: any) => row.join(',')).join('\n');
    } catch (error) {
      console.error('Excel parse error:', error);
      throw new Error('Failed to parse Excel file');
    }
  }
}
