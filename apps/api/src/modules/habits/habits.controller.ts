import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateHabitDto } from './dto/habit.dto';
import { HabitsService } from './habits.service';

@ApiBearerAuth()
@ApiTags('habits')
@Controller('habits')
export class HabitsController {
  constructor(private readonly habitsService: HabitsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.habitsService.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateHabitDto) {
    return this.habitsService.create(user.id, dto);
  }

  /** 打卡/取消打卡，不传 date 默认今天（用户时区） */
  @Post(':id/check-ins')
  toggleCheckIn(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('date') date?: string,
  ) {
    return this.habitsService.toggleCheckIn(user.id, id, date);
  }

  @Get(':id/history')
  history(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.habitsService.history(user.id, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.habitsService.remove(user.id, id);
  }
}
