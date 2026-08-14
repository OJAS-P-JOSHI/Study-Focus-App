import {
  ArgumentsHost,
  BadRequestException,
  CallHandler,
  Catch,
  createParamDecorator,
  ExecutionContext,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

import { Observable, map } from 'rxjs';

import type { Request, Response } from 'express';

export interface AuthUser {
  id: string;

  email: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    return context.switchToHttp().getRequest<Request & { user: AuthUser }>()
      .user;
  },
);

@Injectable()
export class SuccessEnvelopeInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,

    next: CallHandler,
  ): Observable<{ success: true; data: unknown }> {
    return next.handle().pipe(map((data) => ({ success: true, data })));
  }
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    const request = host.switchToHttp().getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;

    let code = 'INTERNAL_ERROR';

    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();

      const body = exception.getResponse();

      if (typeof body === 'string') message = body;
      else {
        const payload = body as { message?: string | string[]; error?: string };

        message = payload.message ?? exception.message;

        code = payload.error?.toUpperCase().replaceAll(' ', '_') ?? code;
      }
    } else if (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      (exception as { code?: number }).code === 11000
    ) {
      status = HttpStatus.CONFLICT;

      code = 'CONFLICT';

      message = 'A record with these values already exists';
    }

    response.status(status).json({
      success: false,

      error: { code, message },

      path: request.url,

      timestamp: new Date().toISOString(),
    });
  }
}

export function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;

  const date = new Date(value);

  if (Number.isNaN(date.getTime()))
    throw new BadRequestException('Invalid date');

  return date;
}

export function serialize<T extends { toJSON: () => Record<string, unknown> }>(
  doc: T | null,
): Record<string, unknown> | null {
  return doc ? doc.toJSON() : null;
}

export function serializeMany<
  T extends { toJSON: () => Record<string, unknown> },
>(docs: T[]): Record<string, unknown>[] {
  return docs.map((doc) => doc.toJSON());
}
