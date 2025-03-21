/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FileObject } from '@supabase/storage-js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import * as Papa from 'papaparse';
import * as pdfParse from 'pdf-parse';
import { File } from 'src/entities/file.entity';
import { createWorker } from 'tesseract.js';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { UserService } from './user.service';

@Injectable()
export class FileService {
  private supabase: SupabaseClient;
  private bucketName: string;
  private openai: OpenAI;
  constructor(
    private configService: ConfigService,
    @InjectRepository(File)
    private fileRepository: Repository<File>,
    private userService: UserService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseApiKey = this.configService.get<string>('SUPABASE_API_KEY');

    if (!supabaseUrl || !supabaseApiKey) {
      throw new Error('Supabase configuration is missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseApiKey);
    this.bucketName = this.configService.get<string>('SUPABASE_BUCKET')!;

    const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.warn('OpenAI API key is missing, summarization will not work');
    } else {
      this.openai = new OpenAI({
        apiKey: openaiApiKey,
      });
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    filePath: string,
    userId: string,
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

      const user = await this.userService.findOne(userId);

      if (!user) {
        throw new Error('User not found');
      }

      const fileToSave = this.fileRepository.create({
        originalName: file.originalname,
        url: urlData.publicUrl,
        fileType: file.mimetype,
        path: filePath,
        user,
      });

      await this.fileRepository.save(fileToSave);

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

  private sanitizeDataString(data: string): string {
    return data.replace(/'/g, ' ');
  }

  async extractData(filePath: string, userId: string): Promise<void> {
    console.log('extractData', filePath, userId);

    const startTime = Date.now();

    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .download(filePath);

      if (error || !data) {
        console.error('Error downloading file:', error);
        await this.updateFileWithError(
          filePath,
          'Failed to download file: ' + error?.message,
        );
        return;
      }

      if (data.type === 'application/pdf') {
        try {
          const arrayBuffer = await data.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const pdfData = await pdfParse(buffer);

          console.log('[EXTRACTED] PDF', pdfData.text);

          await this.updateFileExtractedData(filePath, pdfData.text);
          await this.generateSummary(filePath, startTime);
        } catch (pdfError) {
          console.error('PDF parsing error:', pdfError);
          await this.updateFileWithError(
            filePath,
            'PDF parsing error: ' + pdfError.message,
          );
        }
        return;
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

          console.log('[EXTRACTED] OCR', text);

          await this.updateFileExtractedData(filePath, text);
          await this.generateSummary(filePath, startTime);
        } catch (ocrError) {
          console.error('OCR Error:', ocrError);
          await this.updateFileWithError(
            filePath,
            'OCR processing error: ' + ocrError.message,
          );
          await worker.terminate();
        }
        return;
      }

      if (
        data.type === 'text/csv' ||
        data.type === 'application/vnd.ms-excel' ||
        data.type ===
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ) {
        try {
          const arrayBuffer = await data.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          if (data.type === 'text/csv') {
            const textData = buffer.toString('utf8');
            const parsedData = await this.parseCSV(textData);
            console.log('[EXTRACTED] CSV', parsedData);

            await this.updateFileExtractedData(filePath, parsedData);
            await this.generateSummary(filePath, startTime);
          } else {
            const parsedData = this.parseExcel(buffer);
            console.log('[EXTRACTED] XLSX', parsedData);

            await this.updateFileExtractedData(filePath, parsedData);
            await this.generateSummary(filePath, startTime);
          }
        } catch (spreadsheetError) {
          console.error('Spreadsheet parsing error:', spreadsheetError);
          await this.updateFileWithError(
            filePath,
            'Spreadsheet parsing error: ' + spreadsheetError.message,
          );
        }
        return;
      }

      await this.updateFileWithError(
        filePath,
        'Unsupported file type: ' + data.type,
      );
      return;
    } catch (error) {
      console.error('File extraction error:', error);
      await this.updateFileWithError(
        filePath,
        'File extraction error: ' + error.message,
      );
      return;
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

  private async updateFileExtractedData(
    filePath: string,
    data: string,
  ): Promise<void> {
    try {
      await this.fileRepository.update(
        { path: filePath },
        {
          extractedData: this.sanitizeDataString(data),
          status: 'completed',
        },
      );
    } catch (error) {
      console.error('Error updating file:', error);
    }
  }

  private async generateSummary(
    filePath: string,
    startTime: number,
  ): Promise<void> {
    try {
      if (!this.openai) {
        console.warn('OpenAI not initialized, skipping summary generation');
        return;
      }

      const file = await this.fileRepository.findOne({
        where: { path: filePath },
      });

      if (!file || !file.extractedData) {
        console.warn('No extracted data found for file', filePath);
        await this.updateFileWithError(
          filePath,
          'No extracted data found for file',
        );
        return;
      }

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a document summarization assistant. Please provide a concise summary of the following document content in 3-5 sentences.',
          },
          {
            role: 'user',
            content: file.extractedData,
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
        top_p: 1,
      });

      const summary = response.choices[0].message.content?.trim();

      if (!summary) {
        console.warn('No summary generated for file', filePath);
        return;
      }

      console.log('[SUMMARY]', summary);

      const processingTime = Date.now() - startTime;

      await this.fileRepository.update(
        { path: filePath },
        {
          summary,
          processingTime,
        },
      );
    } catch (error) {
      console.error('Error generating summary:', error);
    }
  }

  private async updateFileWithError(
    filePath: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      await this.fileRepository.update(
        { path: filePath },
        {
          status: 'failed',
          errorLog: errorMessage,
        },
      );
    } catch (updateError) {
      console.error('Error updating file error log:', updateError);
    }
  }
}
