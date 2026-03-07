export type ApiSuccess<T> = {
  data: T;
  meta?: Record<string, unknown>;
  error: null;
};

export type ApiFailure = {
  data: null;
  meta?: Record<string, unknown>;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
};