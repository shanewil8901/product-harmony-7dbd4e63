import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Silence known browser/devtool probe noise (Chrome DevTools, favicon, etc.)
    const url: string = req.url ?? '';
    const isBrowserProbe =
      status === 404 &&
      (url.startsWith('/.well-known/') ||
        url === '/favicon.ico' ||
        url === '/robots.txt');

    const payload =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const message =
      typeof payload === 'string'
        ? payload
        : (payload as { message?: string | string[] }).message ?? 'Error';

    if (!isBrowserProbe) {
      this.logger.error(`${req.method} ${req.url} → ${status}`, exception as Error);
    }

    if (isBrowserProbe) {
      res.status(204).end();
      return;
    }

    res.status(status).json({
      success: false,
      statusCode: status,
      path: req.url,
      timestamp: new Date().toISOString(),
      error: message,
    });
  }
}
