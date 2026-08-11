export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  toJSON() {
    return { error: { code: this.code, message: this.message, fields: this.fields } };
  }
}

export const notFound = (entity: string) => new ApiError(404, "NOT_FOUND", `${entity} not found`);
export const forbidden = (message = "You do not have permission to perform this action") =>
  new ApiError(403, "FORBIDDEN", message);
export const unauthorized = (message = "Authentication required") =>
  new ApiError(401, "UNAUTHORIZED", message);
export const conflict = (message: string, fields?: Record<string, string>) =>
  new ApiError(409, "CONFLICT", message, fields);
export const badRequest = (message: string, fields?: Record<string, string>) =>
  new ApiError(400, "BAD_REQUEST", message, fields);
