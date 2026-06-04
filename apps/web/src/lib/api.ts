import { NextResponse } from "next/server";
import type { ZodError } from "zod";

/**
 * API 応答の共通ヘルパー。
 * エラー応答に内部情報・スタック・PII を含めない（design §4 / requirements 非機能）。
 */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

/** Zod の検証失敗を、フィールドパスとメッセージだけに絞って返す（入力値は含めない）。 */
export function fromZodError(error: ZodError) {
  const issues = error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  return NextResponse.json({ error: "invalid request", issues }, { status: 400 });
}

export function badRequest(message = "invalid request") {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError() {
  // 詳細はサーバーログに留め、クライアントには汎用メッセージのみ返す。
  return NextResponse.json({ error: "internal server error" }, { status: 500 });
}
