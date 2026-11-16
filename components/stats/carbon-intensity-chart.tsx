"use client";

// 최근 7일 탄소강도 라인차트 (recharts)
// - x축은 일자만 표기 (시간별 평균이라 점 168개)
// - y축은 자동 스케일
// - 모바일 420px 안에 들어가는 작은 차트

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { CarbonIntensityPoint } from "@/lib/stats/world-history.server";

interface Props {
  data: CarbonIntensityPoint[];
}

export function CarbonIntensityChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-stone-400">
        아직 데이터가 충분하지 않습니다.
      </p>
    );
  }

  // x축 라벨용 — 일자 단위 표시 (00시만)
  const chartData = data.map((p) => {
    const d = new Date(p.ts);
    return {
      ts: p.ts,
      label: d.toLocaleDateString("ko-KR", {
        month: "numeric",
        day: "numeric",
      }),
      hour: d.getUTCHours(),
      intensity: Math.round(p.carbonIntensity),
    };
  });

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 5, bottom: 5, left: -10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#78716c" }}
            interval={23}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#78716c" }}
            width={40}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              borderRadius: 8,
              border: "1px solid #e7e5e4",
            }}
            formatter={(v) => [`${v} gCO₂/kWh`, "탄소강도"]}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload as { ts: string } | undefined;
              if (!p) return "";
              return new Date(p.ts).toLocaleString("ko-KR", {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
              });
            }}
          />
          <Line
            type="monotone"
            dataKey="intensity"
            stroke="#d97706"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
