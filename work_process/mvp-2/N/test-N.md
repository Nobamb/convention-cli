# Phase N Provider 라우터 Agent Test

`research-N.md` 기준으로 정의된 라우터가 입력된 `provider` 설정에 맞게 정확한 모듈을 반환하고 호출하는지 검증하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| N-V-1 | 지원 Provider 포함 | `index.js` 분기 확인 | `mock`, `localLLM`, `gemini`, `openaiCompatible` 등이 모두 분기에 포함되어 있다. |
| N-V-2 | 순수 분배 역할 | 라우터 내부 로직 점검 | HTTP 요청 등의 실질적 로직이 라우터 안에 섞여 있지 않다. |

## 2. 기능 테스트 항목

### N-T-1: 정확한 Provider 매핑 확인

- **준비:** `mock`, `gemini`, `openaiCompatible` 설정 문자열 준비
- **실행:** 각각에 대해 `getProvider(name)` 호출
- **예상 결과:** 해당하는 각각의 모듈(또는 객체)이 정확히 반환되며, 해당 모듈은 `generateCommitMessage` 함수를 갖고 있다.

### N-T-2: core/ai.js 연동 추상화 테스트

- **준비:** `core/ai.js` 모의 환경 구성
- **실행:** config를 `gemini`로 설정한 상태에서 AI 호출 트리거
- **예상 결과:** `core/ai.js` 측에서는 `provider.generateCommitMessage`만 호출하고, 실제 처리는 `gemini.js` 모듈에서 수행되는 것이 확인된다.

### N-T-3: 미지원 Provider 접근 차단

- **준비:** 존재하지 않는 `unsupported_provider` 설정
- **실행:** 라우터 호출
- **예상 결과:** 지원하지 않는 Provider라는 명확한 에러가 발생한다.

## 3. 검증 결과 요약

- **모든 항목 통과 시:** AI Provider 교체가 유연하게 이루어지는 라우팅 아키텍처 완성.
- **실패 항목 존재 시:** 오타 또는 모듈 import 경로 누락을 점검한다.
