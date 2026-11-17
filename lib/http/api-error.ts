// API 에러 응답 형식: { error: { code, message, details? } }
//
// - code: 클라이언트가 분기에 쓰는 식별자 (예: "NICKNAME_TAKEN")
// - message: 사용자에게 그대로 보여줄 수 있는 문장
// - details: 선택. 검증 오류면 { 필드명: [메시지, ...] }

import { NextResponse } from "next/server";

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiError;
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: { code, message, ...(details !== undefined && { details }) },
    },
    { status },
  );
}
