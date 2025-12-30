import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  const message = err.message || 'Internal server error';

  // Enhanced error logging
  console.error('❌ Error occurred:');
  console.error('  Method:', req.method);
  console.error('  URL:', req.originalUrl);
  console.error('  Status:', statusCode);
  console.error('  Message:', message);
  if (err.stack) {
    console.error('  Stack:', err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

