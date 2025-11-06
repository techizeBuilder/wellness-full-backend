import { Response } from 'express';
import { HTTP_STATUS } from '../constants/httpStatus';

export default class ApiResponse {
  static success(res: Response, data: any = null, message: string = 'Operation successful', statusCode: number = HTTP_STATUS.OK): Response {
    return res.status(statusCode).json({
      success: true,
      message,
      ...(data && { data })
    });
  }

  static error(res: Response, message: string = 'An error occurred', statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR, errors: any = null): Response {
    const response: any = {
      success: false,
      message
    };

    if (errors) {
      response.errors = Array.isArray(errors) ? errors : [errors];
    }

    return res.status(statusCode).json(response);
  }

  static created(res: Response, data: any = null, message: string = 'Resource created successfully'): Response {
    return this.success(res, data, message, HTTP_STATUS.CREATED);
  }

  static notFound(res: Response, message: string = 'Resource not found'): Response {
    return this.error(res, message, HTTP_STATUS.NOT_FOUND);
  }

  static badRequest(res: Response, message: string = 'Bad request', errors: any = null): Response {
    return this.error(res, message, HTTP_STATUS.BAD_REQUEST, errors);
  }

  static unauthorized(res: Response, message: string = 'Unauthorized access'): Response {
    return this.error(res, message, HTTP_STATUS.UNAUTHORIZED);
  }

  static forbidden(res: Response, message: string = 'Access forbidden'): Response {
    return this.error(res, message, HTTP_STATUS.FORBIDDEN);
  }

  static conflict(res: Response, message: string = 'Resource conflict'): Response {
    return this.error(res, message, HTTP_STATUS.CONFLICT);
  }

  static unprocessableEntity(res: Response, message: string = 'Unprocessable entity', errors: any = null): Response {
    return this.error(res, message, HTTP_STATUS.UNPROCESSABLE_ENTITY, errors);
  }

  static serverError(res: Response, message: string = 'Internal server error'): Response {
    return this.error(res, message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

