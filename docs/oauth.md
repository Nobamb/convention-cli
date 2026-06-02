# OAuth 인증 가이드

이 문서는 OAuth 기반 provider 인증 흐름과 보안 기준을 정리합니다.

## 동작 개요

OAuth provider를 선택하면 CLI는 로컬 callback server를 열고 브라우저 인증을 진행합니다.

기본 흐름:

1. provider OAuth 설정 확인
2. state 생성
3. PKCE verifier/challenge 생성
4. 로컬 callback server 시작
5. 브라우저에서 provider 로그인
6. callback의 code/state 검증
7. token endpoint 교환
8. credentials 저장소에 token 저장

## 명령 예시

```bash
convention --model github-copilot oauth
```

OAuth endpoint가 공식 검증되지 않은 provider는 명확한 오류로 중단합니다.

## State와 PKCE

OAuth state는 callback 요청이 현재 CLI 실행에서 시작된 인증인지 확인하는 값입니다.

PKCE는 authorization code가 탈취되더라도 token 교환을 막기 위한 보안 장치입니다.

검증 기준:

- callback state가 저장된 state와 다르면 인증을 중단합니다.
- PKCE를 지원하는 provider는 code verifier와 S256 challenge를 사용합니다.
- callback timeout이 발생하면 token을 저장하지 않습니다.

## Token 저장 위치

OAuth token은 `~/.config/convention/credentials.json`의 `oauth.<provider>` namespace에 저장합니다.

예상 구조:

```json
{
  "oauth": {
    "github-copilot": {
      "accessToken": "[REDACTED]",
      "refreshToken": "[REDACTED]",
      "expiresAt": "2026-06-02T00:00:00.000Z",
      "tokenType": "Bearer"
    }
  }
}
```

위 예시는 구조 설명용이며 실제 token 값을 문서나 로그에 출력하지 않습니다.

## 비대화형 환경

OAuth 로그인은 브라우저와 로컬 callback이 필요하므로 CI 또는 non-interactive terminal에서는 기본적으로 실행하지 않습니다.

CI에서는 이미 저장된 credentials나 환경변수 기반 인증을 사용하거나, print-only 흐름을 선택합니다.

## 오류 처리

OAuth 오류 메시지는 provider가 반환한 raw body를 그대로 출력하지 않습니다.

마스킹 대상:

- access token
- refresh token
- client secret
- authorization code
- bearer token

## 보안 주의사항

- authorization URL에는 access token은 없지만 state와 PKCE challenge가 들어가므로 기본적으로 출력하지 않습니다.
- URL 출력은 명시적으로 허용한 경우에만 수행합니다.
- token 원문은 logger, GitHub Actions output, 오류 메시지에 포함하지 않습니다.
- credentials 파일 권한은 가능한 경우 사용자 읽기/쓰기 수준으로 제한합니다.
