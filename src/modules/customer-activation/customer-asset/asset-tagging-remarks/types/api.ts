export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = { success: false; message: string; errors?: Record<string, string[]> };
export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;
