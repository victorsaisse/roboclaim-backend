import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Role } from 'src/decorators/roles.decorator';
import { File } from 'src/entities/file.entity';
import { User } from 'src/entities/user.entity';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { UserService } from 'src/services/user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(): Promise<User[]> {
    return this.userService.findAll();
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Role('admin')
  update(
    @Param('id') id: string,
    @Body() user: User,
  ): Promise<User | undefined> {
    return this.userService.update(id, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Role('admin')
  delete(@Param('id') id: string): Promise<void> {
    return this.userService.delete(id);
  }

  @Get(':id/files')
  @UseGuards(JwtAuthGuard)
  getUserFiles(@Param('id') id: string): Promise<File[]> {
    return this.userService.getUserFiles(id);
  }

  @Get(':id/stats')
  @UseGuards(JwtAuthGuard)
  getUserStats(@Param('id') id: string): Promise<
    {
      processingTime: number;
      errorLog: string;
    }[]
  > {
    return this.userService.getUserStats(id);
  }
}
