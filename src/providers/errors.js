/**
 * Provider HTTP 오류를 안전하게 전달하기 위한 전용 Error입니다.
 *
 * 외부 AI 응답 본문에는 API Key, 사용량 정보, 내부 trace가 섞일 수 있으므로
 * 이 객체에는 CLI 복구 분기에 필요한 최소 정보(status/provider/action)만 담습니다.
 * UI와 테스트는 status 값만 보고 429 복구 흐름을 판단하며, 원문 응답 body는 읽거나 저장하지 않습니다.
 */
export class ProviderHTTPError extends Error {
  constructor({ provider, action, status }) {
    const statusText = Number.isInteger(status) ? ` with status ${status}` : "";
    super(`${provider} ${action} request failed${statusText}.`);
    this.name = "ProviderHTTPError";
    this.provider = provider;
    this.action = action;
    this.status = status;
  }
}

/**
 * Provider가 HTTP 실패를 반환했을 때 안전한 Error 객체를 생성합니다.
 *
 * response.text()/response.json()을 호출하지 않는 것이 핵심입니다. 실패 응답 본문은
 * provider별로 secret이나 raw prompt 일부를 포함할 수 있으므로 status code만 보존합니다.
 */
export function createProviderHTTPError({ provider, action, response }) {
  return new ProviderHTTPError({
    provider,
    action,
    status: Number.isInteger(response?.status) ? response.status : undefined,
  });
}

/**
 * 사용량 소진 또는 rate limit으로 보고 복구 UI를 띄워야 하는 오류인지 확인합니다.
 *
 * 현재 명시적으로 처리하는 신호는 HTTP 429입니다. Provider가 message에 raw body를 넣지 않고
 * status 속성을 보존하면 commit command가 이 함수만으로 안전하게 분기할 수 있습니다.
 */
export function isUsageExhaustedError(error) {
  return error?.status === 429;
}
