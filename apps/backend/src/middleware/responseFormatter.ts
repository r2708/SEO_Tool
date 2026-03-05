import { Request, Response, NextFunction } from 'express';

/**
 * Extended Response interface with success method
 */
export interface FormattedResponse extends Response {
  success: (data: any, statusCode?: number) => void;
}

/**
 * Response Formatting Middleware
 * 
 * Wraps successful responses in {success: true, data: {...}}.
 * Sets Content-Type to application/json.
 * Ensures consistent format across all endpoints.
 * 
 * Note: Error responses are handled by the error handler middleware,
 * which formats them as {success: false, error: "message"}.
 * 
 * Validates: Requirements 19.1, 19.2, 19.5
 */
export function responseFormatter(
  req: Request,
  res: FormattedResponse,
  next: NextFunction
): void {
  // Add success method to response object
  res.success = function (data: any, statusCode: number = 200): void {
    // Set Content-Type header
    this.setHeader('Content-Type', 'application/json');
    
    // Send formatted response
    this.status(statusCode).json({
      success: true,
      data,
    });
  };

  next();
}
