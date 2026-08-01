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
import { QueryFailedError } from 'typeorm';


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

    // Database-level failures (unique / foreign-key / not-null violations) must
    // reach the user as a clear, actionable message — never an opaque 500.
    const dbError = describeDbError(exception);
    if (dbError) {
      status = dbError.status;
      this.logger.error(
        `${req.method} ${req.url} → ${status} ${dbError.code}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      res.status(status).json({
        success: false,
        statusCode: status,
        path: req.url,
        timestamp: new Date().toISOString(),
        error: { code: dbError.code, message: dbError.message },
      });
      return;
    }

    const raw =
      exception instanceof HttpException
        ? exception.getResponse()
        : {
            message:
              'Something went wrong on the server. Please try again — if it keeps happening, contact your administrator.',
          };


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

/**
 * Translate raw driver/ORM failures into user-facing messages.
 * Returns `undefined` when the exception is not a database error.
 */
function describeDbError(
  exception: unknown,
): { status: number; code: string; message: string } | undefined {
  if (!(exception instanceof QueryFailedError)) return undefined;
  const driver = exception as QueryFailedError & {
    code?: string;
    errno?: number;
    sqlMessage?: string;
  };
  const errno = driver.errno;
  const sqlMessage = driver.sqlMessage ?? exception.message ?? '';

  // MySQL: 1062 duplicate entry, 1451/1452 FK constraint, 1048 not-null, 1406 too long.
  if (errno === 1062 || driver.code === 'ER_DUP_ENTRY') {
    const value = /Duplicate entry '([^']*)'/.exec(sqlMessage)?.[1];
    return {
      status: HttpStatus.CONFLICT,
      code: 'CONFLICT',
      message: value
        ? `"${value}" already exists. Use a different value.`
        : 'This record already exists. Use a different value.',
    };
  }
  if (errno === 1452 || driver.code === 'ER_NO_REFERENCED_ROW_2') {
    return {
      status: HttpStatus.BAD_REQUEST,
      code: 'BAD_REQUEST',
      message:
        'One of the selected records no longer exists. Refresh the page and pick a valid option.',
    };
  }
  if (errno === 1451 || driver.code === 'ER_ROW_IS_REFERENCED_2') {
    return {
      status: HttpStatus.CONFLICT,
      code: 'CONFLICT',
      message:
        'This record is still used by other records (stock, documents or attachments) and cannot be deleted.',
    };
  }
  if (errno === 1048 || driver.code === 'ER_BAD_NULL_ERROR') {
    const field = /Column '([^']*)'/.exec(sqlMessage)?.[1];
    return {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      code: 'VALIDATION_ERROR',
      message: field ? `"${field}" is required and cannot be empty.` : 'A required field is empty.',
    };
  }
  if (errno === 1406 || driver.code === 'ER_DATA_TOO_LONG') {
    const field = /column '([^']*)'/i.exec(sqlMessage)?.[1];
    return {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      code: 'VALIDATION_ERROR',
      message: field ? `"${field}" is too long — shorten it.` : 'One of the values is too long.',
    };
  }
  if (errno === 1213 || driver.code === 'ER_LOCK_DEADLOCK') {
    return {
      status: HttpStatus.CONFLICT,
      code: 'CONFLICT',
      message: 'Another user was updating the same record. Please retry.',
    };
  }
  return {
    status: HttpStatus.BAD_REQUEST,
    code: 'BAD_REQUEST',
    message: 'The database rejected this request. Check the entered values and try again.',
  };
}

