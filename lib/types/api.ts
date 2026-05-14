// API 응답 형식

import { NextResponse } from "next/server";

export interface ApiError {
  code: string;
  message: string;
  datails?: unknown;
}

export interface ApiErrorResponse {
  error: ApiError;
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  datails?: unknown,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: { code, message, ...(datails !== undefined && { datails }) },
    },
    { status },
  );
}
