const { HTTP_STATUS } = require('../constants/httpStatus');

class ApiResponse {
  static success(res, data = null, message = 'Operation successful', statusCode = HTTP_STATUS.OK) {
    return res.status(statusCode).json({
      success: true,
      message,
      ...(data && { data })
    });
  }

  static error(res, message = 'An error occurred', statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, errors = null) {
    const response = {
      success: false,
      message
    };

    if (errors) {
      response.errors = Array.isArray(errors) ? errors : [errors];
    }

    return res.status(statusCode).json(response);
  }

  static created(res, data = null, message = 'Resource created successfully') {
    return this.success(res, data, message, HTTP_STATUS.CREATED);
  }

  static notFound(res, message = 'Resource not found') {
    return this.error(res, message, HTTP_STATUS.NOT_FOUND);
  }

  static badRequest(res, message = 'Bad request', errors = null) {
    return this.error(res, message, HTTP_STATUS.BAD_REQUEST, errors);
  }

  static unauthorized(res, message = 'Unauthorized access') {
    return this.error(res, message, HTTP_STATUS.UNAUTHORIZED);
  }

  static forbidden(res, message = 'Access forbidden') {
    return this.error(res, message, HTTP_STATUS.FORBIDDEN);
  }

  static conflict(res, message = 'Resource conflict') {
    return this.error(res, message, HTTP_STATUS.CONFLICT);
  }

  static unprocessableEntity(res, message = 'Unprocessable entity', errors = null) {
    return this.error(res, message, HTTP_STATUS.UNPROCESSABLE_ENTITY, errors);
  }

  static serverError(res, message = 'Internal server error') {
    return this.error(res, message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

module.exports = ApiResponse;

