import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createRoute } from "./create-route";

interface TestUser {
  id: string;
  email: string;
}

const USER: TestUser = { id: "user-1", email: "u@example.com" };
const ADMIN: TestUser = { id: "admin-1", email: "a@example.com" };

function setup(currentUser: TestUser | null) {
  return createRoute<TestUser>({
    getUser: async () => currentUser,
    isAdmin: (id) => id === ADMIN.id,
  });
}

function request(body?: unknown, init: { raw?: string } = {}) {
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    body: init.raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
}

const ok = async () => Response.json({ ok: true });

describe("인증", () => {
  it("public: 로그인하지 않아도 핸들러가 실행되고 user는 null", async () => {
    const route = setup(null);
    const handler = route({ auth: "public" }, async ({ user }) =>
      Response.json({ user }),
    );

    const res = await handler(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null });
  });

  it("user: 미인증이면 401 UNAUTHORIZED, 핸들러는 실행되지 않는다", async () => {
    const route = setup(null);
    const inner = vi.fn(ok);

    const res = await route({ auth: "user" }, inner)(request());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
    });
    expect(inner).not.toHaveBeenCalled();
  });

  it("user: 인증되면 ctx.user로 사용자를 넘긴다", async () => {
    const route = setup(USER);
    const res = await route({ auth: "user" }, async ({ user }) =>
      Response.json({ id: user.id, email: user.email }),
    )(request());

    expect(await res.json()).toEqual({ id: "user-1", email: "u@example.com" });
  });

  it("admin: 미인증이면 401", async () => {
    const res = await setup(null)({ auth: "admin" }, ok)(request());
    expect(res.status).toBe(401);
  });

  it("admin: 로그인했지만 관리자가 아니면 403 FORBIDDEN", async () => {
    const inner = vi.fn(ok);
    const res = await setup(USER)({ auth: "admin" }, inner)(request());

    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
    expect(inner).not.toHaveBeenCalled();
  });

  it("admin: 관리자면 통과", async () => {
    const res = await setup(ADMIN)({ auth: "admin" }, ok)(request());
    expect(res.status).toBe(200);
  });
});

describe("본문 검증", () => {
  const schema = z.object({
    name: z.string().min(2, "이름은 2자 이상이어야 합니다."),
    count: z.number().int(),
  });

  it("스키마를 통과한 값을 ctx.body로 넘긴다", async () => {
    const res = await setup(USER)(
      { auth: "user", body: schema },
      async ({ body }) => Response.json({ got: body }),
    )(request({ name: "디노", count: 3, extra: "무시됨" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ got: { name: "디노", count: 3 } });
  });

  it("JSON이 아니면 400 INVALID_JSON", async () => {
    const inner = vi.fn(ok);
    const res = await setup(USER)({ auth: "user", body: schema }, inner)(
      request(undefined, { raw: "{not json" }),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_JSON");
    expect(inner).not.toHaveBeenCalled();
  });

  it("본문이 비어 있어도 400 INVALID_JSON", async () => {
    const res = await setup(USER)({ auth: "user", body: schema }, ok)(
      request(),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_JSON");
  });

  it("스키마 불일치면 400 VALIDATION_ERROR와 필드별 메시지를 details로 준다", async () => {
    const inner = vi.fn(ok);
    const res = await setup(USER)({ auth: "user", body: schema }, inner)(
      request({ name: "a", count: "x" }),
    );

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("입력값이 올바르지 않습니다.");
    expect(error.details.name).toEqual(["이름은 2자 이상이어야 합니다."]);
    expect(error.details.count).toHaveLength(1);
    expect(inner).not.toHaveBeenCalled();
  });

  it("필드에 속하지 않는 오류(refine)는 message로 보여준다", async () => {
    const eitherSchema = z
      .object({ a: z.number().optional(), b: z.number().optional() })
      .refine((v) => v.a !== undefined || v.b !== undefined, {
        message: "a 또는 b 중 하나는 필요합니다.",
      });

    const res = await setup(USER)({ auth: "user", body: eitherSchema }, ok)(
      request({}),
    );

    const { error } = await res.json();
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("a 또는 b 중 하나는 필요합니다.");
  });

  it("스키마를 주지 않으면 본문을 읽지 않고 body는 undefined", async () => {
    const res = await setup(USER)({ auth: "user" }, async ({ body }) =>
      Response.json({ isUndefined: body === undefined }),
    )(request(undefined, { raw: "{not json" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ isUndefined: true });
  });

  it("인증을 본문보다 먼저 확인한다 — 미인증이면 본문이 잘못돼도 401", async () => {
    const res = await setup(null)({ auth: "user", body: schema }, ok)(
      request(undefined, { raw: "{not json" }),
    );
    expect(res.status).toBe(401);
  });
});

describe("예외 처리", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("핸들러가 던진 예외는 500 INTERNAL_ERROR — 내용은 응답에 넣지 않고 로그에만 남긴다", async () => {
    const res = await setup(USER)({ auth: "user" }, async () => {
      throw new Error("db password=hunter2 connection refused");
    })(request());

    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text).error.code).toBe("INTERNAL_ERROR");
    expect(text).not.toContain("hunter2");
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it("인증 확인 중의 예외도 500으로 처리한다", async () => {
    const route = createRoute<TestUser>({
      getUser: async () => {
        throw new Error("auth service down");
      },
      isAdmin: () => false,
    });

    const res = await route({ auth: "user" }, ok)(request());
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("INTERNAL_ERROR");
  });

  it("핸들러가 돌려준 에러 응답은 그대로 통과한다", async () => {
    const res = await setup(USER)({ auth: "user" }, async () =>
      Response.json({ error: { code: "NICKNAME_TAKEN" } }, { status: 409 }),
    )(request());

    expect(res.status).toBe(409);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
