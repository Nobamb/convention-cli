import crypto from "crypto";

/**
 * OAuth 2.0 PKCE 스펙에 맞는 예측 불가능한 code_verifier를 생성합니다.
 * 32바이트의 암호학적 랜덤 바이트를 base64url 형식으로 인코딩하여 반환합니다.
 * 반환 문자열은 43자 이상 128자 이하의 범위를 충족하며, URL 안전 문자만 포함합니다.
 *
 * @returns {string} 생성된 code_verifier (기본 43글자)
 */
export function generateCodeVerifier() {
  // 32바이트의 랜덤 데이터를 생성합니다. (PKCE 권장 규격 충족)
  const buffer = crypto.randomBytes(32);
  
  // base64url 인코딩을 직접 구현합니다 (+ -> -, / -> _, = 패딩 제거).
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * 주어진 code_verifier로부터 SHA-256 해시를 수행하고 base64url 인코딩하여 code_challenge를 파생합니다.
 * 해시 연산 후 base64url 형식으로 포맷팅을 수행하며 padding 문자(=)는 제거합니다.
 *
 * @param {string} codeVerifier - PKCE용 오리지널 verifier 문자열
 * @returns {string} SHA-256 기반으로 생성된 code_challenge
 * @throws {Error} codeVerifier가 비어 있거나 문자열 타입이 아닐 경우
 */
export function generateCodeChallenge(codeVerifier) {
  if (typeof codeVerifier !== "string" || codeVerifier.trim().length === 0) {
    throw new Error("codeVerifier must be a non-empty string");
  }

  // SHA-256 방식으로 verifier를 해시 처리합니다.
  const hash = crypto.createHash("sha256").update(codeVerifier).digest();

  // 결과를 base64url 문자열로 정규화합니다.
  return hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * CSRF 공격 방지를 위한 충분한 엔트로피를 갖는 일회성 랜덤 state를 생성합니다.
 * 24바이트 랜덤 바이트를 base64url 형태로 인코딩하여 반환합니다.
 *
 * @returns {string} URL 안전 문자열로 인코딩된 state
 */
export function generateState() {
  const buffer = crypto.randomBytes(24);
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * OAuth flow 시작 시 저장했던 expected state와 callback에서 수신한 received state를 비교 검증합니다.
 * 타이밍 공격 방지를 위해 crypto.timingSafeEqual을 사용하여 비교를 수행합니다.
 *
 * @param {string} expectedState - 원래 저장해 두었던 state 기대값
 * @param {string} receivedState - callback에서 응답받은 state 수신값
 * @returns {boolean} 일치 여부
 */
export function verifyState(expectedState, receivedState) {
  if (!expectedState || !receivedState) {
    return false;
  }
  if (typeof expectedState !== "string" || typeof receivedState !== "string") {
    return false;
  }
  if (expectedState.length !== receivedState.length) {
    return false;
  }

  try {
    const bufferExpected = Buffer.from(expectedState);
    const bufferReceived = Buffer.from(receivedState);
    
    // 타이밍 공격을 막기 위해 timingSafeEqual로 안전하게 두 버퍼의 값을 비교합니다.
    return crypto.timingSafeEqual(bufferExpected, bufferReceived);
  } catch (error) {
    // 안전한 실패 처리
    return false;
  }
}
