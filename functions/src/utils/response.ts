import { Response } from "express";

export function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ ok: false, error: message });
}

export function sendSuccess<T>(res: Response, data: T): void {
  res.status(200).json({ ok: true, ...data });
}

