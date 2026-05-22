# AC. OAuth Provider Integration Agent 구현 계획

## 작업 범위

AC 단계는 OAuth 인증 정보를 실제 AI Provider 호출에 연결하는 작업만 담당한다.

핵심 목표는 `authType`이 `oauth`인 provider 요청에서 저장된 OAuth token을 로드하고, 만료 시 refresh를 수행한 뒤, `Authorization` header를 구성해 provider routing에 전달하는 것이다.

이 단계는 OAuth login, callback, PKCE/state 생성, token 저장 구조 자체를 새로 구현하지 않는다. W, X, Y, Z, AA, AB 단계의 결과를 사용해 provider 호출 경로와 연결한다.

## 선행 조건

이 단계는 Phase 5의 선행 작업 결과를 전제로 한다.

- W: OAuth 공통 구조와 `src/auth/oauth.js`
- X: provider별 OAuth 설정과 지원 provider 목록
- Y: localhost callback 처리
- Z: PKCE/state 검증
- AA: access token, refresh token, expiresAt 저장 구조
- AB: token 만료 확인 및 refresh 처리

AC 단계는 위 기능을 provider request 직전의 인증 계층으로 연결한다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `src/providers/index.js`
- `src/providers/antigravity.js`
- `src/providers/github-copilot.js`
- `src/auth/oauth.js`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 구현 계획만 정리한다.

## Provider Routing 통합 계획

`src/providers/index.js`는 provider 호출 전에 `config.authType`을 확인한다.

권장 흐름은 다음과 같다.

1. `generateWithProvider({ prompt, config })` 또는 provider routing 진입점에서 provider를 검증한다.
2. `authType === "oauth"`이면 OAuth 인증 준비 함수를 호출한다.
3. 저장된 token을 provider 이름 기준으로 로드한다.
4. token이 없으면 재로그인 필요 오류로 중단한다.
5. access token이 만료되었으면 refresh 함수를 호출한다.
6. refresh 성공 시 새 access token으로 요청 header를 만든다.
7. refresh 실패 시 token 원문 없이 재로그인 안내 오류를 반환한다.
8. provider 구현에는 `headers` 또는 `auth` context를 명시적으로 전달한다.

예상 helper 형태는 다음과 같다.

```js
async function resolveProviderAuth(config) {
  if (config.authType === "oauth") {
    return resolveOAuthAuth(config);
  }

  if (config.authType === "api") {
    return resolveApiKeyAuth(config);
  }

  return {};
}
```

OAuth 인증 정보는 mock fallback으로 대체하지 않는다. 지원하지 않는 provider 또는 OAuth 미지원 provider에서 `authType: "oauth"`가 설정되면 명확한 오류로 중단한다.

## OAuth Token 로드 계획

OAuth token은 `config.json`이 아니라 `credentials.json`에서 provider별로 로드한다.

권장 token 구조는 AA 단계의 저장 계약을 따른다.

```json
{
  "oauth": {
    "antigravity": {
      "accessToken": "[REDACTED]",
      "refreshToken": "[REDACTED]",
      "expiresAt": "2026-05-19T12:00:00.000Z"
    }
  }
}
```

로드 규칙은 다음과 같다.

- provider 이름은 `config.provider`를 기준으로 한다.
- `authType !== "oauth"`이면 OAuth token을 읽지 않는다.
- access token이 없으면 provider 호출을 시도하지 않는다.
- refresh token이 필요하지만 없으면 재로그인 안내로 종료한다.
- token 로드 실패 메시지에는 token 값, credentials 파일 원문, 전체 credentials JSON을 포함하지 않는다.

## Authorization Header 구성 계획

OAuth 방식의 provider 요청은 access token으로 `Authorization` header를 구성한다.

기본 형태는 다음과 같다.

```js
{
  Authorization: `Bearer ${accessToken}`
}
```

provider별로 추가 header가 필요하면 provider 구현 내부가 아니라 provider config 또는 auth resolver에서 명시적으로 확장한다.

규칙은 다음과 같다.

- header 객체를 로그에 그대로 출력하지 않는다.
- 에러 메시지에 `Authorization`, `Bearer`, token 원문이 포함되지 않도록 redaction을 적용한다.
- API Key 방식 header와 OAuth header를 동시에 구성하지 않는다.
- provider 함수에는 필요한 인증 header만 전달한다.

## 만료 및 Refresh 연결 계획

token 만료 확인은 AB 단계의 helper를 사용한다.

권장 흐름은 다음과 같다.

1. OAuth token 로드
2. `expiresAt` 기준 만료 여부 확인
3. 만료 전이면 현재 access token 사용
4. 만료되었으면 `refreshAccessToken(provider, config)` 호출
5. refresh 성공 시 새 token 저장 후 새 access token 사용
6. refresh 실패 시 provider 호출을 중단하고 재로그인 안내

refresh 실패는 인증 실패로 분류하되, 네트워크 오류나 provider 장애와 구분한다. 사용자가 해야 할 조치는 "OAuth 로그인을 다시 실행"하는 방향으로 안내한다.

## 인증 실패 처리 계획

provider 응답이 401 또는 403이면 인증 실패로 처리한다.

처리 기준은 다음과 같다.

- token 원문을 출력하지 않는다.
- `credentials.json` 내용을 출력하지 않는다.
- OAuth 방식이면 API Key 재입력을 요구하지 않는다.
- API Key 방식이면 OAuth 재로그인을 요구하지 않는다.
- refresh 후에도 401/403이 발생하면 재로그인 안내 후 중단한다.
- 인증 실패를 mock provider fallback으로 숨기지 않는다.

provider별 fetch 오류 처리에서는 response body를 그대로 출력하지 않는다. body에 token이나 인증 세부 정보가 포함될 수 있으므로 상태 코드와 안전한 요약만 표시한다.

## API Key와 OAuth 설정 분리 규칙

API Key 방식과 OAuth 방식은 서로 설정을 오염시키면 안 된다.

분리 기준은 다음과 같다.

- `config.authType === "api"`이면 API Key credential만 사용한다.
- `config.authType === "oauth"`이면 OAuth token credential만 사용한다.
- `config.json`에는 secret 값을 저장하지 않는다.
- API Key 저장 위치와 OAuth token 저장 위치는 `credentials.json` 내부에서도 provider별 namespace를 분리한다.
- OAuth 설정 저장 시 기존 API Key를 삭제하거나 덮어쓰지 않는다.
- API Key 설정 저장 시 기존 OAuth token을 삭제하거나 덮어쓰지 않는다.
- provider 변경 시 이전 provider의 credential을 새 provider 요청에 재사용하지 않는다.

권장 credentials 구조는 다음과 같다.

```json
{
  "apiKeys": {
    "antigravity": "[REDACTED]"
  },
  "oauth": {
    "antigravity": {
      "accessToken": "[REDACTED]",
      "refreshToken": "[REDACTED]",
      "expiresAt": "2026-05-19T12:00:00.000Z"
    }
  }
}
```

## Provider 구현 연결 계획

provider 구현은 인증 방식 판단을 직접 많이 알지 않도록 한다.

권장 역할 분리는 다음과 같다.

- `src/providers/index.js`: provider 선택, 지원 여부 검증, auth resolver 호출
- `src/auth/oauth.js`: OAuth token 로드, 만료 확인, refresh 호출
- `src/providers/antigravity.js`: 전달받은 header로 API 요청
- `src/providers/github-copilot.js`: 전달받은 header로 API 요청

provider 함수 signature 확장 후보는 다음과 같다.

```js
generateCommitMessage({ prompt, config, headers })
listModels(config, { headers })
```

기존 provider contract를 크게 깨지 않기 위해 두 번째 인자를 추가하거나 `config.authHeaders`처럼 임시 값을 섞는 방식은 피한다. secret이 config 객체에 오래 남지 않도록 요청 직전 context로만 전달한다.

## 지원하지 않는 Provider 처리

OAuth를 지원하지 않는 provider에 `authType: "oauth"`가 설정되면 명확한 오류를 출력한다.

예상 케이스는 다음과 같다.

- `mock` + `oauth`: OAuth 인증 불필요 또는 미지원 오류
- `localLLM` + `oauth`: OAuth 미지원 오류
- 알 수 없는 provider + `oauth`: provider 미지원 오류
- provider 설정 누락 + `oauth`: provider 설정 필요 오류

어떤 경우에도 조용히 mock provider로 fallback하지 않는다.

## 보안 기준

AC 단계는 실제 외부 provider 호출과 연결되므로 보안 기준을 엄격히 적용한다.

- access token, refresh token, API Key를 로그에 출력하지 않는다.
- `Authorization` header 전체를 출력하지 않는다.
- credentials 파일 원문을 출력하지 않는다.
- provider 오류 body를 그대로 출력하지 않는다.
- diff 원문과 token이 같은 로그 메시지에 섞이지 않도록 한다.
- 외부 AI API로 diff를 보내기 전 기존 보안 gate를 유지한다.
- 인증 방식 오류가 발생해도 자동 commit, push, reset을 실행하지 않는다.

## 완료 기준

- `authType: "oauth"`인 provider 호출에서 저장된 access token을 로드한다.
- 만료되지 않은 token은 `Authorization: Bearer ...` header로 provider 요청에 사용된다.
- 만료된 token은 refresh 후 새 token으로 provider 요청에 사용된다.
- refresh 실패 또는 401/403 인증 실패 시 token 원문 없이 재로그인을 안내한다.
- API Key 방식과 OAuth 방식의 credential이 서로 섞이지 않는다.
- OAuth 미지원 provider는 mock fallback 없이 명확한 오류로 중단한다.
- 로그에 API Key, OAuth token, Authorization header 원문이 노출되지 않는다.
