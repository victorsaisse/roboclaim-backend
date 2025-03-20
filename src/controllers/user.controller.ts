import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Public } from 'src/decorators/public.decorator';
import { Role } from 'src/decorators/roles.decorator';
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

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Role('admin')
  delete(@Param('id') id: string): Promise<void> {
    return this.userService.delete(id);
  }

  @Public()
  @Get('wait')
  async wait(
    @Query('seconds') seconds: number,
    @Query('name') name: string,
  ): Promise<string> {
    let elapsedSeconds = 0;
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        elapsedSeconds++;
        console.log(`Waited ${elapsedSeconds} seconds for ${name}`);
        if (elapsedSeconds >= seconds) {
          clearInterval(interval);
          resolve(null);
        }
      }, 1000);
    });
    return `Waited ${seconds} seconds`;
  }
}
