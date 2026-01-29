/**
 * Structured errors for booking operations so controllers can set HTTP status from statusCode.
 */
export class BookingServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'BookingServiceError';
    Object.setPrototypeOf(this, BookingServiceError.prototype);
  }
}

export class BookingValidationError extends BookingServiceError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'BookingValidationError';
    Object.setPrototypeOf(this, BookingValidationError.prototype);
  }
}

export class BookingConflictError extends BookingServiceError {
  constructor(message: string) {
    super(message, 409);
    this.name = 'BookingConflictError';
    Object.setPrototypeOf(this, BookingConflictError.prototype);
  }
}

export class BookingNotFoundError extends BookingServiceError {
  constructor(message: string = 'Booking not found') {
    super(message, 404);
    this.name = 'BookingNotFoundError';
    Object.setPrototypeOf(this, BookingNotFoundError.prototype);
  }
}
