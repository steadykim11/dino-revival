import z from "zod";
import { fetchExternal, ExternalApiError } from "./http";
import { XMLParser } from "fast-xml-parser";
import { externalEnv } from "@/lib/env";
import { parseKpxDateTime } from "../time/kst";

const RawItemSchema = z.object({
  // "20260506112500" 형식 (YYYYMMDDhhmmss)
  baseDatetime: z.string(),
  // 공급 능력 MW
  suppAbility: z.coerce.number(),
  // 현재 수요 MW
  currPwrTot: z.coerce.number(),
  // 최대 예측 수요 MW
  forecastLoad: z.coerce.number(),
  // 공급 예비력 MW
  suppReservePwr: z.coerce.number(),
  // 공급 예비율 %
  suppReserveRate: z.coerce.number(),
  // 운영 예비력 MW
  operReservePwr: z.coerce.number(),
  // 운영 예비율 %
  operReserveRate: z.coerce.number(),
});

const ResponseSchema = z.object({
  response: z.object({
    header: z.object({
      resultCode: z.string(),
      resultMsg: z.string(),
    }),
    body: z.object({
      items: z
        .object({
          item: RawItemSchema.or(z.array(RawItemSchema)),
        })
        .or(z.literal("")), // 데이터 없을 때 빈 문자열로 오는 경우
    }),
  }),
});

export type KpxD1Result = {
  ts: Date;
  currentLoad: number; // MW
  supplyCapacity: number; // MW
  supplyReserveRate: number; // % (공급예비율 사용)
  operReserveRate: number; // % (운영예비율, 던전 트리거에 활용 가능)
};

const ENDPOINT =
  "https://openapi.kpx.or.kr/openapi/sukub5mMaxDatetime/getSukub5mMaxDatetime";

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false, // 숫자 변환은 zod의 coerce가 담당
});

export async function fetchKpxD1(): Promise<KpxD1Result> {
  const url =
    `${ENDPOINT}?serviceKey=${externalEnv.KPX_API_KEY}` + `&pageNo=1&numOfRows=1`;

  const raw = await fetchExternal(url, {
    source: "KPX_D1",
    timeoutMs: 20000,
    retry: false,
  });

  let xml: unknown;
  try {
    xml = xmlParser.parse(raw);
  } catch (err) {
    throw new ExternalApiError(
      "KPX_D1",
      "parse",
      undefined,
      raw.slice(0, 500),
      err,
    );
  }

  const parsed = ResponseSchema.safeParse(xml);
  if (!parsed.success) {
    throw new ExternalApiError(
      "KPX_D1",
      "parse",
      undefined,
      `Schema mismatch: ${parsed.error.message}\nRaw: ${raw.slice(0, 500)}`,
    );
  }

  const { header, body } = parsed.data.response;
  if (header.resultCode !== "00") {
    throw new ExternalApiError(
      "KPX_D1",
      "http",
      undefined,
      `KPX error: ${header.resultCode} ${header.resultMsg}`,
    );
  }

  if (body.items === "") {
    throw new ExternalApiError("KPX_D1", "parse", undefined, "Empty items");
  }

  const item = Array.isArray(body.items.item)
    ? body.items.item[0]
    : body.items.item;
  if (!item) {
    throw new ExternalApiError(
      "KPX_D1",
      "parse",
      undefined,
      "No item in response",
    );
  }

  return {
    ts: parseKpxDateTime(item.baseDatetime),
    currentLoad: item.currPwrTot,
    supplyCapacity: item.suppAbility,
    supplyReserveRate: item.suppReserveRate,
    operReserveRate: item.operReserveRate,
  };
}
