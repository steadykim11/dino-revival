import { fetchWorldSnapshot } from "../lib/external/kpx";

async function main() {
  const url = process.env.VERCEL_INGEST_URL;
  const secret = process.env.CRON_SECRET;
  if (!url || !secret) {
    console.error("Missing VERCEL_INGEST_URL or CRON_SECRET");
    process.exit(1);
  }

  console.log("Fetching KPX snapshot...");
  const data = await fetchWorldSnapshot();
  console.log(`KPX OK: ${data.ts.toISOString()}, CI=${data.carbonIntensity}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      ts: data.ts.toISOString(),
      carbonIntensity: data.carbonIntensity,
      supplyReserveRate: data.supplyReserveRate,
      supplyCapacity: data.supplyCapacity,
      currentLoad: data.currentLoad,
      temperature: data.temperature,
      fuelMix: data.fuelMix,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Ingest failed: ${res.status} ${body}`);
    process.exit(1);
  }

  console.log("Ingest OK:", await res.json());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
