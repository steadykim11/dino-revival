// 최신 world_snapshot 5개 행 표시
// - 클라이언트 상호작용 없음 (Server Component 그대로 가능하나
//   page.tsx 데이터 패치 구조 일관성을 위해 props 받는 컴포넌트로)
// - "use client" 없음 — 서버에서 렌더링

interface Snapshot {
  ts: string;
  carbonIntensity: number;
  supplyReserveRate: number;
  currentLoad: number;
  isFallback: boolean;
}

interface Props {
  snapshots: Snapshot[];
}

export function SnapshotsMonitor({ snapshots }: Props) {
  if (snapshots.length === 0) {
    return <p className="text-xs text-stone-500">snapshot이 아직 없습니다.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead className="bg-stone-50 text-stone-500">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium">시각 (KST)</th>
            <th className="px-2 py-1.5 text-right font-medium">탄소</th>
            <th className="px-2 py-1.5 text-right font-medium">예비율</th>
            <th className="px-2 py-1.5 text-right font-medium">부하</th>
          </tr>
        </thead>
        <tbody>
          {snapshots.map((s) => (
            <tr
              key={s.ts}
              className={`border-t border-stone-100 ${
                s.isFallback ? "text-amber-600" : ""
              }`}
            >
              <td className="px-2 py-1.5">
                {new Date(s.ts).toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {s.isFallback && <span className="ml-1 text-[9px]">(fb)</span>}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {s.carbonIntensity.toFixed(0)}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {s.supplyReserveRate.toFixed(1)}%
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {s.currentLoad.toLocaleString()}MW
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
