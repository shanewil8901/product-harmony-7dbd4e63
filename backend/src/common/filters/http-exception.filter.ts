import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Structured error envelope:
 * {
 *   success: false,
 *   statusCode: number,
 *   path, timestamp,
 *   error: { code, message, details? }
 * }
 *
 * Validation errors (class-validator arrays) surface as 422 with `details`
 * being an array of `{ field, message }` so the client can render them inline.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const url: string = req.url ?? '';
    const isBrowserProbe =
      status === 404 &&
      (url.startsWith('/.well-known/') ||
        url === '/favicon.ico' ||
        url === '/robots.txt');

    if (isBrowserProbe) {
      res.status(204).end();
      return;
    }

    const raw =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    let message: string;
    let details: Array<{ field?: string; message: string }> | undefined;
    let code: string;

    if (typeof raw === 'string') {
      message = raw;
    } else {
      const obj = raw as { message?: string | string[]; error?: string };
      if (Array.isArray(obj.message)) {
        // class-validator style array — treat as unprocessable entity (422).
        status = HttpStatus.UNPROCESSABLE_ENTITY;
        message = 'Validation failed';
        details = obj.message.map((m) => {
          const match = /^([a-zA-Z0-9_]+)\s+(.+)$/.exec(m);
          return match ? { field: match[1], message: m } : { message: m };
        });
      } else {
        message = obj.message ?? obj.error ?? 'Error';
      }
    }

    // Canonical error codes.
    if (exception instanceof UnauthorizedException) code = 'UNAUTHORIZED';
    else if (exception instanceof ForbiddenException) code = 'FORBIDDEN';
    else if (status === 404) code = 'NOT_FOUND';
    else if (status === 409) code = 'CONFLICT';
    else if (status === 422) code = 'VALIDATION_ERROR';
    else if (status >= 500) code = 'INTERNAL_ERROR';
    else if (status === 400) code = 'BAD_REQUEST';
    else code = `HTTP_${status}`;

    this.logger.error(
      `${req.method} ${req.url} → ${status} ${code}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    res.status(status).json({
      success: false,
      statusCode: status,
      path: req.url,
      timestamp: new Date().toISOString(),
      error: { code, message, ...(details ? { details } : {}) },
    });
  }
}
