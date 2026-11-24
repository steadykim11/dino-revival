-- 오늘의 예상 피크 (ADR 42).
-- KPX D1 응답의 forecastLoad(당일 최대 예측 수요, MW)를 스냅샷마다 저장한다.
-- 컬럼 추가만 하므로 이전 코드도 그대로 동작한다. 기존 행은 NULL.
ALTER TABLE "world_snapshots" ADD COLUMN "forecastLoad" INTEGER;
