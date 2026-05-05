# Phase T AI 호출 Agent Research

## 1. 개요

Phase T는 Phase S에서 생성한 prompt를 AI Provider에 전달하고 커밋 메시지 후보 문자열을 받아오는 단계입니다. 구현 대상은 `src/core/ai.js`의 `generateCommitMessage(prompt, config)`입니다.

1차 MVP에서는 실제 외부 AI API 호출보다 Mock Provider를 우선합니다. 기본 Provider가 없거나 아직 설정되지 않은 경우에도 API Key 없이 Git/commit workflow를 검증할 수 있어야 합니다.

## 2. 작업 목표

- `src/core/ai.js`에 `generateCommitMessage(prompt, config): Promise<string>` 구현
- Provider routing 구조 정의
- `src/providers/mock.js`에 Mock Provider 구현
- Mock Provider 기본 반환값을 `chore: update project files`로 유지
- `config.provider`가 `null`인 경우 mock provider를 기본 사용
- prompt가 provider 함수까지 전달되는지 확인 가능한 구조 유지
- 1차 MVP 단위 테스트에서 외부 네트워크 호출이 발생하지 않도록 보장
- 외부 AI API로 diff를 보내기 전 사용자 확인이 필요하다는 보안 조건을 문서와 구현 흐름에 반영

## 3. Provider Routing 기준

권장 구조:

```javascript
generateCommitMessage(prompt, config)
  -> provider 선택
  -> selectedProvider.generate(prompt, config)
  -> string 반환
```

1차 MVP provider 선택 기준:

- `config.provider === null`: mock provider 사용
- `config.provider === "mock"`: mock provider 사용
- 그 외 provider: 1차 MVP에서는 명확한 unsupported provider Error 발생

실제 `gemini`, `localLLM`, `claude`, `github-copilot`, OpenAI-compatible provider는 이후 단계 확장 대상으로 분리합니다. 1차 MVP에서 해당 provider 값이 들어오면 mock으로 조용히 fallback하지 않고, 네트워크 호출 없이 즉시 unsupported provider Error를 발생시켜 잘못된 설정을 숨기지 않습니다.

## 4. Mock Provider 기준

Mock Provider는 외부 API 없이 commit flow를 검증하기 위한 Provider입니다.

권장 파일:

```text
src/providers/mock.js
```

권장 동작:

```javascript
export async function generate(prompt, config) {
  return "chore: update project files";
}
```

prompt와 config를 반드시 사용해야 하는 것은 아니지만, 테스트에서 prompt가 provider까지 전달되는지 확인할 수 있도록 함수 인자를 유지합니다.

## 5. 외부 API 전송 보안 기준

- 1차 MVP 기본 동작은 mock provider이므로 네트워크 호출을 하지 않습니다.
- 외부 AI Provider가 추가되더라도 diff 전송 전 사용자 확인이 필요합니다.
- 1차 MVP에서는 non-mock provider가 설정되어도 사용자 확인 없이 외부 API를 호출하지 않고 unsupported provider Error로 차단합니다.
- `.env`, credentials, private key, secret pattern이 포함된 diff는 외부로 보내면 안 됩니다.
- `generateCommitMessage`는 prompt 원문이나 diff 원문을 로그에 출력하지 않습니다.
- API Key, OAuth Token, endpoint credential을 console/logger에 출력하지 않습니다.

## 6. 에러 처리 기준

- `prompt`가 문자열이 아니거나 비어 있으면 `TypeError` 또는 명확한 Error를 던집니다.
- provider가 알 수 없는 값이면 unsupported provider Error를 발생시킵니다.
- unknown provider를 mock으로 fallback하지 않습니다. fallback은 잘못된 provider 설정과 외부 전송 정책 누락을 숨길 수 있기 때문입니다.
- provider가 빈 문자열을 반환하면 Phase U의 `cleanAIResponse`에서 에러 처리할 수 있도록 그대로 전달하거나, T 단계에서 provider response error로 중단합니다.

## 7. 테스트 관점

- provider가 `null`일 때 mock provider 사용
- provider가 `"mock"`일 때 mock provider 사용
- 기본 반환값이 `chore: update project files`인지 확인
- prompt 인자가 provider까지 전달되는지 확인
- 외부 네트워크 호출이 발생하지 않는지 확인
- unknown provider에 대한 정책이 명확한지 확인
- prompt 원문이 console/logger로 출력되지 않는지 확인

## 8. 다음 단계 연결

Phase T의 반환값은 Phase U의 `cleanAIResponse(response)`로 전달되어 `git commit -m`에 넣기 좋은 깨끗한 문자열로 정리됩니다. 이후 V/W commit workflow에서 사용자 confirm을 거친 뒤 `addAll`/`addFile`과 `commit`이 호출됩니다.
