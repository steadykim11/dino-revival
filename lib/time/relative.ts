export function relativeTimeKo(
  from: Date | string,
  now: Date = new Date(),
): string {
  const d = typeof from === "string" ? new Date(from) : from;
  const diffSec = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));

  if (diffSec < 60) return "방금 전";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}일 전`;
}
