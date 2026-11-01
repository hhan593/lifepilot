import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import type { Response } from 'express';

/**
 * 统一返回 RFC 7807 problem+json：
 * { type, title, status, detail, errors?, instance }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ url?: string; method?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail: string | undefined;
    let errors: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      title = HttpStatus[status] ?? 'Error';
      const body = exception.getResponse();
      if (typeof body === 'string') {
        detail = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        detail = (b.detail ?? b.message) as string | undefined;
        if (Array.isArray(b.message)) {
          detail = '请求参数校验失败';
          errors = b.message;
        }
      }
    } else {
      detail = exception instanceof Error ? exception.message : String(exception);
    }

    if (status >= 500) {
      this.logger.error({ err: exception }, 'Unhandled exception');
    }

    response.status(status).type('application/problem+json').json({
      type: `https://lifepilot.app/errors/${status}`,
      title,
      status,
      detail,
      errors,
      instance: `${request.method ?? ''} ${request.url ?? ''}`,
    });
  }
}
