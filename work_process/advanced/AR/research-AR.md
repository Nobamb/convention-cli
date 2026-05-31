# AR. CI Security Agent 구현 계획

## 작업 범위

AR 단계는 CI 환경에서 token, API Key, OAuth 정보, credentials 내용이 로그나 output으로 노출되지 않도록 방어하는 작업이다.

핵심 목표는 logger redaction, auth 계층 masking, 환경변수 기반 API Key 사용 검토, GitHub Actions secret masking 안내를 CI flow에 반영하는 것이다. 필요 시 구현과 문서화를 함께 진행한다.

## 선행 조건

- AN 단계의 CI mode 감지가 존재한다.
- AO 단계의 non-interactive mode가 존재한다.
- AP 단계의 GitHub Actions output 유틸리티가 존재한다.
- 기존 credentials 저장 구조와 logger가 존재한다.
- 외부 provider 호출 전 diff 보안 scan 정책이 유지된다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `src/utils/logger.js`
- `src/auth/apiKey.js`
- `src/config/store.js`
- `src/core/ai.js`
- `src/utils/githubActions.js`
- `docs/github-actions.md`
- `tests/ci-security.test.js`
- `tests/logger-redaction.test.js`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 구현 계획만 정리한다.

## Logger redaction 계획

logger 계층에 공통 redaction 함수를 둔다.

권장 함수:

```js
export function redactSecrets(value)
```

기본 탐지 후보:

- `API_KEY=`
- `SECRET=`
- `TOKEN=`
- `PASSWORD=`
- `PRIVATE_KEY`
- `DATABASE_URL`
- `AWS_ACCESS_KEY_ID`
- `-----BEGIN PRIVATE KEY-----`
- GitHub token 패턴 후보

logger의 `info()`, `warn()`, `error()`, `success()`는 출력 전 redaction을 적용한다.

## Auth 계층 masking 계획

API Key와 OAuth token은 다음 원칙을 따른다.

1. 원문 값을 logger로 넘기지 않는다.
2. 성공 메시지에도 secret 원문을 포함하지 않는다.
3. 표시가 필요하면 `[REDACTED]` 또는 앞뒤 일부만 masked 형태로 표시한다.
4. credentials 파일 전체 내용을 출력하지 않는다.
5. CI에서는 credentials 파일보다 환경변수 기반 secret 주입을 우선 검토한다.

환경변수 후보:

- `CONVENTION_API_KEY`
- `CONVENTION_GEMINI_API_KEY`
- `CONVENTION_OPENAI_API_KEY`
- provider별 명확한 이름

환경변수 이름은 출력 가능하지만 값은 출력하지 않는다.

## GitHub Actions masking 계획

GitHub Actions에서는 필요할 경우 다음 명령 형식을 사용할 수 있다.

```text
::add-mask::secret-value
```

단, 이 명령 자체를 사용할 때도 secret 값이 커맨드 기록으로 노출되지 않도록 호출 위치와 logger 사용을 분리해야 한다. 문서에는 GitHub Secrets 사용과 fork PR secret 제한을 안내한다.

## CI output 보안

AP 단계의 output 기록 전 redaction을 적용한다.

기록 금지 또는 masking 대상:

- API Key
- OAuth token
- private key
- credentials JSON 원문
- `.env` 내용
- diff 원문 전체
- provider raw response 전체

PR body와 commit message에도 secret 의심 패턴이 있으면 기록 전 masking하거나 생성을 중단한다.

## PR from fork 주의

문서와 구현에서 다음 사항을 반영한다.

- fork PR에서는 repository secret이 제공되지 않을 수 있다.
- 외부 provider 호출이 필요한 workflow는 fork PR에서 실패하거나 print-only로 동작할 수 있다.
- `pull_request_target`은 위험하므로 기본 예시로 권장하지 않는다.
- checkout 대상 코드와 secret 권한이 섞이지 않도록 주의한다.

## 실패 처리 기준

CI security check에서 secret 노출 가능성이 감지되면 다음 정책 중 하나를 사용한다.

- output 기록 거부
- provider 호출 중단
- PR body 생성 중단
- `[REDACTED]` 마스킹 후 계속 진행

초기 구현 권장:

- 로그와 output은 redaction 후 계속 진행
- 외부 전송 전 secret이 감지되면 기존 보안 gate 정책에 따라 확인 또는 중단
- raw error와 stack trace는 사용자 출력에 그대로 노출하지 않음

## 보안 기준

- CI 로그에 token/API Key 원문 출력 금지
- credentials 파일 내용 출력 금지
- environment 전체 dump 금지
- diff 원문 출력 금지
- provider raw response 전체 출력 금지
- GitHub Actions output에도 secret 원문 기록 금지
- PR 생성 전 body에 secret이 포함되지 않는지 확인

## 완료 기준

- logger 출력에 secret redaction이 적용된다.
- auth 계층이 API Key와 OAuth token 원문을 출력하지 않는다.
- CI output 기록 전 secret masking이 적용된다.
- 환경변수 기반 API Key 사용 정책이 정리된다.
- GitHub Actions 문서에 secret, fork PR, permissions 주의사항이 반영된다.
