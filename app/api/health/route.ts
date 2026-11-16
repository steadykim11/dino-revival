import { NextResponse } from 'next/server';
import { pingDb } from '@/lib/health.server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // DB 연결 확인
    await pingDb();

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: process.env.VERCEL_ENV ?? 'local',
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
