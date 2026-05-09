# Architecture Decisions

## D4: KPX ingest pipeline

### Context
KPX provides real-time grid data (D1 supply/demand, D2 fuel mix) via
public API at openapi.kpx.or.kr. We need 5-minute snapshots in DB.

### Discovery
- Vercel Edge/Lambda IPs (icn1 region included): blocked at TCP layer
  by KPX firewall. Confirmed via curl from inside Vercel function.
- GitHub Actions runners (Azure 20.x.x.x): same blocked.
- Same key works fine from residential ISP.

### Decision
Run ingest loop from local PC during dev/demo. Vercel exposes
/api/ingest/world-snapshot as receiver. Loop calls KPX directly,
posts payload to Vercel.

### Trade-offs
- Pros: Works reliably, no extra infrastructure cost
- Cons: Requires PC running during demo (acceptable for portfolio)
- Future: If a Korean cloud relay becomes available, switch back to
  Vercel cron (route is already in place, just disabled)

## D4: KPX D1/D2 sequential calls

### Context
fetchWorldSnapshot calls D1 (supply/demand) and D2 (fuel mix) endpoints.

### Discovery
Promise.all causes one of the two to return HTTP 500 with body
"허용되지 않는 요청을 하셨습니다". Tests confirmed timing-dependent
(serial calls separated by 300ms always succeed).

### Decision
Serial await + 300ms delay between D1 and D2.

### Trade-offs
- Adds ~300ms to each capture cycle (negligible at 5-minute interval)
- Implies KPX has per-key concurrency limit (undocumented)