# Phase D Provider 목록 정의 Agent Test

`research-D.md` 기준으로 2차 MVP에서 지원하는 Provider 목록이 정상적으로 정의되고, `isValidProvider` 함수가 이를 올바르게 검증하는지 확인하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| D-V-1 | `isValidProvider` 존재 | `src/utils/validator.js` 확인 | 함수가 존재하고 export 되고 있다. |
| D-V-2 | 지원 목록 상수 정의 | 코드 내부 확인 | `mock`, `localLLM`, `gemini`, `openaiCompatible` 등의 목록이 정의되어 있다. |

## 2. 기능 테스트 항목

### D-T-1: 유효한 Provider 입력
- **준비:** 지원 목록에 있는 값(`'mock'`, `'localLLM'`, `'gemini'`, `'openaiCompatible'`)을 준비한다.
- **실행:** `isValidProvider(provider)` 호출
- **예상 결과:** 모두 `true`를 반환한다.

### D-T-2: 대소문자 검증 처리
- **준비:** `'LocalLLM'`, `'GEMINI'` 등 대소문자가 섞인 유효한 값을 준비한다.
- **실행:** `isValidProvider(provider)` 호출
- **예상 결과:** 대소문자 구분을 허용하도록 기획했다면 `true`, 아니라면 정책에 맞게 동작한다 (일반적으로는 소문자/정해진 케이스로 정규화 후 `true` 반환 권장).

### D-T-3: 유효하지 않은 Provider 입력
- **준비:** 지원하지 않는 값(`'unknown'`, `'chatgpt'`, `'claude'` - 현재 미구현인 경우), 빈 문자열, `null`, `undefined`를 준비한다.
- **실행:** `isValidProvider(provider)` 호출
- **예상 결과:** 모두 `false`를 반환한다.

### D-T-4: 설정 로드 시 검증 작동
- **준비:** config.json 파일에 `provider: "invalid_provider"`를 삽입하고 설정을 로드하는 과정 모의
- **실행:** 설정 로드 후 유효성 검사 수행
- **예상 결과:** 잘못된 Provider임이 감지되어 에러를 뿜거나 fallback 동작(예: `mock`으로 변경)을 수행해야 한다. (이 단계의 테스트는 `isValidProvider`가 활용되는지 확인하는 용도)

## 3. 테스트 절차

1. 단위 테스트 환경에서 `isValidProvider` 함수에 다양한 긍정/부정 케이스를 던져 반환값을 검증한다.
2. `null`이나 숫자 등 문자열이 아닌 타입이 들어갔을 때 에러 없이 `false`를 반환하는지 확인한다.

## 4. 검증 결과 요약

- **모든 항목 통과 시:** Provider 목록 정의 및 유효성 검증 함수 구현 완료.
- **실패 항목 존재 시:** 허용 목록(Whitelist) 로직과 예외 상황(null, 빈 문자열) 처리 부분을 보완한다.
