export class ServiceError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = 'ServiceError';
    this.status = status;
    this.details = details;
  }
}

export function isServiceError(error) {
  return error instanceof ServiceError;
}
