import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { FuelMixSchema } from "@/lib/types/fuel-mix";
import { normalizeTo5Min } from "@/lib/time/kst";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PayloadSchema = z.object({
  ts: z.string().datetime(),
  carbonIntensity: z.number(),
  supplyReserveRate: z.number(),
  supplyCapacity: z.number(),
  currentLoad: z.number(),
  temperature: z.number().nullable(),
  fuelMix: FuelMixSchema,
});

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: z.infer<typeof PayloadSchema>;
  try {
    const body = await req.json();
    payload = PayloadSchema.parse(body);
  } catch (err) {
    return NextResponse.json(
      { error: "invalid payload", detail: String(err) },
      { status: 400 },
    );
  }

  const ts = normalizeTo5Min(new Date(payload.ts));

  const upsertData = {
    carbonIntensity: new Prisma.Decimal(payload.carbonIntensity),
    supplyReserveRate: new Prisma.Decimal(payload.supplyReserveRate),
    supplyCapacity: payload.supplyCapacity,
    currentLoad: payload.currentLoad,
    temperature:
      payload.temperature !== null
        ? new Prisma.Decimal(payload.temperature)
        : null,
    fuelMix: payload.fuelMix as unknown as Prisma.InputJsonValue,
    isFallback: false,
  };

  await prisma.worldSnapshot.upsert({
    where: { ts },
    create: { ts, ...upsertData },
    update: upsertData,
  });

  console.log("[ingest] saved", {
    ts: ts.toISOString(),
    carbonIntensity: payload.carbonIntensity,
  });

  return NextResponse.json({ ok: true, ts: ts.toISOString() });
}
