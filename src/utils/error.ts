export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, description: string, statusCode: number) {
    super(description);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}
