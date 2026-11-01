import { Body, Controller, Delete, Get, Param, ParseEnumPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateTodoDto, UpdateTodoDto } from './dto/todo.dto';
import { TodoView, TodosService } from './todos.service';

export const TODO_VIEWS = ['today', 'upcoming', 'done'] as const;

@ApiBearerAuth()
@ApiTags('todos')
@Controller('todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('view', new ParseEnumPipe(TODO_VIEWS)) view: TodoView,
  ) {
    return this.todosService.list(user.id, view);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTodoDto) {
    return this.todosService.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateTodoDto) {
    return this.todosService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.todosService.remove(user.id, id);
  }
}
