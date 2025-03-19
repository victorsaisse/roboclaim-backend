import { User } from 'src/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class File {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  originalName: string;

  @Column({ unique: true })
  storedName: string;

  @Column({ type: 'enum', enum: ['pdf', 'csv', 'image', 'excel'] })
  fileType: string;

  @Column()
  fileSize: number;

  @Column({
    type: 'enum',
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  })
  status: string;

  @Column({ type: 'text', nullable: true })
  extractedData: string;

  @Column({ type: 'text', nullable: true })
  errorLog: string;

  @CreateDateColumn()
  uploadedAt: Date;

  @Column({ nullable: true })
  processedAt: Date;

  @ManyToOne(() => User, (user) => user.files)
  user: User;
}
