// 타입 수준 검사 도우미.

/**
 * A와 B가 같은 유니온이면 true, 다르면 컴파일 에러.
 * 도메인 타입이 Prisma enum과 어긋나지 않았는지 확인하는 데 쓴다.
 */
export type AssertSameUnion<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : ["다음 값이 도메인 타입에 없습니다:", Exclude<B, A>]
  : ["다음 값이 Prisma enum에 없습니다:", Exclude<A, B>];

/** T가 true가 아니면 이 타입을 쓰는 자리에서 컴파일 에러가 난다. */
export type Expect<T extends true> = T;
