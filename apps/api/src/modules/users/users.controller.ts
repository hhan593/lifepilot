import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto, UpdateSettingsDto } from './dto/update-settings.dto';

@ApiBearerAuth()
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.getMe(user.id);
  }

  @Patch('me/settings')
  @ApiOkResponse({ description: '更新个人设置；提供体重时自动重算饮水目标' })
  updateSettings(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) {
    return this.usersService.updateSettings(user.id, dto);
  }

  @Patch('me/profile')
  updateTimezone(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    if (dto.timezone) return this.usersService.updateTimezone(user.id, dto.timezone);
  }
}
