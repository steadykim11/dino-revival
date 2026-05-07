import { z } from "zod";
import { XMLParser } from "fast-xml-parser";
import { fetchExternal, ExternalApiError } from "./http";
import { env } from "@/lib/env";
import { FuelMix, FuelMixSchema } from "@/lib/types/fuel-mix";

const RawItemSchema = z.object({
  baseDateTime: z.string(), // 대문자 T (D1과 다름)
  fuelPwr1: z.coerce.number(), // 수력
  fuelPwr2: z.coerce.number(), // 유류
  fuelPwr3: z.coerce.number(), // 유연탄
  fuelPwr4: z.coerce.number(), // 원자력
  fuelPwr5: z.coerce.number(), // 양수 (음수 가능)
  fuelPwr6: z.coerce.number(), // 가스
  fuelPwr7: z.coerce.number(), // 국내탄
  fuelPwr8: z.coerce.number(), // 태양광(시장)
  fuelPwr9: z.coerce.number(), // 풍력
  fuelPwr10: z.coerce.number(), // 신재생
  pEsmw: z.coerce.number(), // PPA 자가발전
  bEmsw: z.coerce.number(), // BTM 자가소비 태양광
  fuelPwrTot: z.coerce.number(), // 시장수요(현재) - 합계 아님!
});

const ResponseSchema = z.object({
  tbAllSumperfuel5mResponse: z.object({
    header: z.object({
      resultCode: z.string(),
      resultMsg: z.string(),
    }),
    body: z.object({
      items: z
        .object({
          item: RawItemSchema.or(z.array(RawItemSchema)),
        })
        .or(z.literal("")),
    }),
  }),
});

export type KpxD2Result = {
  ts: Date;
  fuelMix: FuelMix;
  marketDemand: number; // 참고용 (fuelPwrTot)
};

const ENDPOINT =
  "https://openapi.kpx.or.kr/openapi/sumperfuel5m/getSumperfuel5m";

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
});

export async function fetchKpxD2(): Promise<KpxD2Result> {
  const url =
    `${ENDPOINT}?serviceKey=${env.KPX_API_KEY}` + `&pageNo=1&numOfRows=1`;

  const raw = await fetchExternal(url, { source: "KPX_D2" });

  let xml: unknown;
  try {
    xml = xmlParser.parse(raw);
  } catch (err) {
    throw new ExternalApiError(
      "KPX_D2",
      "parse",
      undefined,
      raw.slice(0, 500),
      err,
    );
  }

  const parsed = ResponseSchema.safeParse(xml);
  if (!parsed.success) {
    throw new ExternalApiError(
      "KPX_D2",
      "parse",
      undefined,
      `Schema mismatch: ${parsed.error.message}\nRaw: ${raw.slice(0, 500)}`,
    );
  }

  const { header, body } = parsed.data.tbAllSumperfuel5mResponse;
  if (header.resultCode !== "00") {
    throw new ExternalApiError(
      "KPX_D2",
      "http",
      undefined,
      `KPX error: ${header.resultCode} ${header.resultMsg}`,
    );
  }

  if (body.items === "") {
    throw new ExternalApiError("KPX_D2", "parse", undefined, "Empty items");
  }

  const item = Array.isArray(body.items.item)
    ? body.items.item[0]
    : body.items.item;

  const fuelMix: FuelMix = {
    hydro: item.fuelPwr1,
    oil: item.fuelPwr2,
    coal: item.fuelPwr3,
    nuclear: item.fuelPwr4,
    pumped: item.fuelPwr5,
    gas: item.fuelPwr6,
    coalDomestic: item.fuelPwr7,
    solarMarket: item.fuelPwr8,
    wind: item.fuelPwr9,
    renewable: item.fuelPwr10,
    ppa: item.pEsmw,
    btm: item.bEmsw,
  };

  // 최종 검증
  const validated = FuelMixSchema.parse(fuelMix);

  return {
    ts: parseKpxDateTime(item.baseDateTime),
    fuelMix: validated,
    marketDemand: item.fuelPwrTot,
  };
}

function parseKpxDateTime(s: string): Date {
  if (!/^\d{14}$/.test(s)) {
    throw new ExternalApiError(
      "KPX_D2",
      "parse",
      undefined,
      `Invalid datetime: ${s}`,
    );
  }
  const utcMs =
    Date.UTC(
      +s.slice(0, 4),
      +s.slice(4, 6) - 1,
      +s.slice(6, 8),
      +s.slice(8, 10),
      +s.slice(10, 12),
      +s.slice(12, 14),
    ) -
    9 * 60 * 60 * 1000;
  return new Date(utcMs);
}
