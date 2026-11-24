import { describe, expect, it } from "vitest";
import { hashInt, hashRangeOf, hashToUuid } from "./dummy-hash";

describe("dummy-hash", () => {
  it("같은 seed는 같은 값, 다른 seed는 다른 값", () => {
    expect(hashInt("a")).toBe(hashInt("a"));
    expect(hashInt("a")).not.toBe(hashInt("b"));
  });

  it("hashRangeOf는 [min, max] 안의 정수", () => {
    for (let i = 0; i < 200; i++) {
      const v = hashRangeOf(`seed-${i}`, 3, 7);
      expect(Number.isInteger(v) && v >= 3 && v <= 7).toBe(true);
    }
  });

  it("hashToUuid는 UUID v4 형식이고 시드 더미 ID와 같은 값을 낸다", () => {
    expect(hashToUuid("x")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(hashToUuid("dino-dummy-0")).toBe(hashToUuid("dino-dummy-0"));
  });
});
