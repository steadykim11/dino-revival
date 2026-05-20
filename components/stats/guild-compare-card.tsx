// 우리 동네 평균과 비교 — 본인 vs 길드원 평균
// 와이어프레임 SC-10 "이번 주 우리 동네 평균과 비교" 카드

interface Props {
  guildName: string;
  myCleanEnergy: number;
  guildAverage: number;
}

export function GuildCompareCard({
  guildName,
  myCleanEnergy,
  guildAverage,
}: Props) {
  const diff = myCleanEnergy - guildAverage;
  const ratio = guildAverage > 0 ? (myCleanEnergy / guildAverage) * 100 : 0;
  const isAbove = diff >= 0;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold">우리 동네 비교</h2>
      <p className="mt-0.5 text-xs text-stone-500">{guildName} 평균과 본인</p>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="flex-1">
          <p className="text-[10px] text-stone-500">본인</p>
          <p className="text-lg font-bold tabular-nums text-amber-700">
            {myCleanEnergy.toLocaleString()}
          </p>
        </div>
        <div className="text-stone-300">vs</div>
        <div className="flex-1 text-right">
          <p className="text-[10px] text-stone-500">동네 평균</p>
          <p className="text-lg font-bold tabular-nums text-stone-600">
            {Math.round(guildAverage).toLocaleString()}
          </p>
        </div>
      </div>

      <div
        className={`mt-3 rounded-lg px-3 py-2 text-xs ${
          isAbove
            ? "bg-emerald-50 text-emerald-700"
            : "bg-stone-50 text-stone-600"
        }`}
      >
        {guildAverage === 0
          ? "동네 평균 산정 중"
          : isAbove
            ? `평균보다 ${Math.abs(diff).toLocaleString()} 높음 (${ratio.toFixed(0)}%)`
            : `평균까지 ${Math.abs(diff).toLocaleString()} 남음 (${ratio.toFixed(0)}%)`}
      </div>
    </section>
  );
}
