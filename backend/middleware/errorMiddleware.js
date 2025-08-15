// backend/middleware/errorMiddleware.js

export const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Server Error',
    // Show stack trace only in non-production mode
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};
