// 닉네임과 공룡 이름의 공통 규칙: 2~12자, 한글·영문·숫자.
// 서버(라우트 검증)와 화면(입력 중 검사)이 같은 규칙을 쓴다.

export const NAME_PATTERN = /^[가-힣a-zA-Z0-9]{2,12}$/;

export function isValidName(value: string): boolean {
  return NAME_PATTERN.test(value);
}
