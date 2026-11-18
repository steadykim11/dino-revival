import { describe, expect, it } from "vitest";
import { isValidName } from "./name-rule";

describe("isValidName", () => {
  it.each(["디노", "abc123", "티라노12", "ab", "가나다라마바사아자차카타"])(
    "허용: %s",
    (name) => {
      expect(isValidName(name)).toBe(true);
    },
  );

  it.each([
    ["한 글자", "가"],
    ["13자", "가나다라마바사아자차카타파"],
    ["빈 문자열", ""],
    ["공백 포함", "디 노"],
    ["앞뒤 공백", " 디노 "],
    ["특수문자", "디노!"],
    ["밑줄", "di_no"],
    ["이모지", "디노🦖"],
    ["자음만", "ㄱㄴㄷ"],
  ])("거부: %s", (_label, name) => {
    expect(isValidName(name)).toBe(false);
  });
});
