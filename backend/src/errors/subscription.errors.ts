/**
 * Structured errors for subscription operations so controllers can set HTTP status from statusCode.
 */
export class SubscriptionServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'SubscriptionServiceError';
    Object.setPrototypeOf(this, SubscriptionServiceError.prototype);
  }
}

export class MembershipNotFoundError extends SubscriptionServiceError {
  constructor(message: string = 'Membership not found') {
    super(message, 404);
    this.name = 'MembershipNotFoundError';
    Object.setPrototypeOf(this, MembershipNotFoundError.prototype);
  }
}

export class OnlyAdHocTerminableError extends SubscriptionServiceError {
  constructor(message: string = 'Only ad-hoc subscriptions can be terminated') {
    super(message, 400);
    this.name = 'OnlyAdHocTerminableError';
    Object.setPrototypeOf(this, OnlyAdHocTerminableError.prototype);
  }
}
