import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
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
}
