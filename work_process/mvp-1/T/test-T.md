# Phase T AI 호출 Agent Test

`research-T.md`의 구현 기준을 바탕으로 `generateCommitMessage(prompt, config)`가 1차 MVP 요구사항을 충족하는지 확인하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| V-1 | 함수 export 확인 | `src/core/ai.js` 확인 | `generateCommitMessage`를 import할 수 있다. |
| V-2 | mock provider 파일 확인 | `src/providers/mock.js` 확인 | mock provider 파일이 존재하고 generate 함수를 export한다. |
| V-3 | provider routing 확인 | 코드 구조 확인 | `config.provider` 기준으로 provider를 선택한다. |
| V-4 | 기본 provider 정책 확인 | 코드 구조 확인 | provider가 `null`이면 mock provider를 사용한다. |
| V-5 | 네트워크 호출 없음 | `fetch`, http/https mock 검사 | 1차 MVP 기본 경로에서 외부 요청이 발생하지 않는다. |
| V-6 | raw prompt 로그 금지 | console/logger 검사 | prompt 원문을 출력하지 않는다. |

## 2. 기능 테스트 항목

### T-1: provider null 기본 응답
- **준비:** `config.provider`가 `null`인 config를 준비한다.
- **실행:** `generateCommitMessage("prompt", config)`
- **예상 결과:** `chore: update project files`를 반환한다.

### T-2: mock provider 명시
- **준비:** `config.provider`가 `"mock"`인 config를 준비한다.
- **실행:** `generateCommitMessage("prompt", config)`
- **예상 결과:** mock provider가 호출되고 `chore: update project files`를 반환한다.

### T-3: prompt 전달 확인
- **준비:** mock provider를 spy 또는 test double로 대체할 수 있는 구조를 만든다.
- **실행:** 고유 문자열이 포함된 prompt를 전달한다.
- **예상 결과:** provider 함수가 동일한 prompt를 인자로 받는다.

### T-4: config 전달 확인
- **준비:** language, provider 등 값이 포함된 config를 준비한다.
- **실행:** `generateCommitMessage(prompt, config)` 호출
- **예상 결과:** provider 함수가 동일한 config 객체 또는 동등한 값을 전달받는다.

### T-5: 외부 네트워크 호출 없음
- **준비:** `globalThis.fetch`, `http.request`, `https.request`를 spy 처리한다.
- **실행:** provider `null` 또는 `"mock"`으로 메시지를 생성한다.
- **예상 결과:** 네트워크 관련 함수가 호출되지 않는다.

### T-6: 빈 prompt 거부
- **준비:** `""`, `"   "`, `null` prompt를 준비한다.
- **실행:** `generateCommitMessage(value, config)` 호출
- **예상 결과:** TypeError 또는 명확한 Error가 발생한다.

### T-7: unknown provider 처리
- **준비:** `config.provider`를 `"gemini"` 또는 `"unknown"`으로 설정하되 실제 provider가 구현되지 않은 상태를 만든다.
- **실행:** `generateCommitMessage(prompt, config)` 호출
- **예상 결과:** unsupported provider Error가 발생하고 mock fallback은 동작하지 않는다.

### T-8: raw prompt 미출력
- **준비:** prompt에 `SECRET=should-not-log` 같은 테스트 문자열을 포함하고 console/logger를 spy 처리한다.
- **실행:** `generateCommitMessage(prompt, { provider: null })`
- **예상 결과:** 반환값은 mock 메시지이며, prompt 원문은 출력되지 않는다.

### T-9: 미구현 외부 provider 네트워크 차단
- **준비:** `config.provider`를 `"gemini"` 또는 `"localLLM"`로 설정하고 `globalThis.fetch`, `http.request`, `https.request`를 spy 처리한다.
- **실행:** `generateCommitMessage(prompt, config)` 호출
- **예상 결과:** 사용자 확인 없이 외부 네트워크 함수가 호출되지 않고 unsupported provider Error가 발생한다.

## 3. 테스트 절차

1. `src/core/ai.js`에서 `generateCommitMessage`를 import한다.
2. mock provider 기본 config와 명시 config를 준비한다.
3. 반환값이 `chore: update project files`인지 확인한다.
4. provider routing과 prompt/config 전달 여부를 확인한다.
5. 네트워크 호출 spy를 통해 mock 및 미구현 외부 provider 경로에서 외부 요청이 없는지 검증한다.
6. invalid prompt와 unknown provider 정책을 검증한다.
7. console/logger에 prompt 원문이나 secret test string이 출력되지 않는지 확인한다.

## 4. 테스트 환경 주의사항

- unit test에서 실제 외부 AI API를 호출하지 않는다.
- API Key, OAuth Token, `.env` 값을 읽거나 출력하지 않는다.
- mock provider 테스트는 Git 저장소 상태와 무관하게 실행 가능해야 한다.

## 5. 검증 결과 요약

- **모든 항목 통과 시:** Phase T 완료 및 Phase U AI 응답 정리 Agent 진입 가능
- **실패 항목 존재 시:** provider 선택 기준, mock 기본값, 네트워크 호출 여부, prompt 로그 출력 여부를 우선 점검한다.
