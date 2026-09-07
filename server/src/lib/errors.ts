import { NextFunction, Request, Response } from "express";

export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, message: string, code = "APP_ERROR") {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: Error & { statusCode?: number; code?: string },
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("Error:", err);

  if (err.code === "EBADCSRFTOKEN" || err.name === "ForbiddenError") {
    return res.status(403).json({
      error: true,
      message: "CSRF 토큰이 유효하지 않습니다.",
      code: "EBADCSRFTOKEN",
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: true,
      message: err.message,
      code: err.code,
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: true,
      message: "입력값 검증 오류",
      details: (err as any).errors,
    });
  }

  if (err.name === "MulterError") {
    return res.status(400).json({
      error: true,
      message: `파일 업로드 오류: ${err.message}`,
    });
  }

  return res.status(500).json({
    error: true,
    message: "서버 내부 오류",
  });
}
