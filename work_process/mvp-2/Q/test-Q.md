# Phase Q --model provider 부분 지정 Agent Test

`research-Q.md` 기준으로 provider만 지정된 `--model` 명령이 Provider 선택 UI 없이 나머지 설정만 진행하는지 검증한다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| Q-V-1 | provider 부분 지정 함수 존재 | `src/commands/model.js` 확인 | `setupModelWithProvider(provider)`가 존재한다. |
| Q-V-2 | provider 검증 | 구현 확인 | `isValidProvider(provider)` 또는 동등한 검증이 수행된다. |
| Q-V-3 | Provider 선택 UI 생략 | 호출 흐름 확인 | provider가 있을 때 `selectProvider()`는 호출되지 않는다. |

## 2. 기능 테스트 항목

### Q-T-1: `convention --model gemini` 흐름

- **준비:** `selectAuthType`과 `selectModelVersion`을 mock 처리
- **실행:** `runModelSetup("gemini", undefined, undefined)`
- **예상 결과:** Provider 선택 없이 authType 선택과 modelVersion 선택이 진행된다.

### Q-T-2: `convention --model localLLM` 흐름

- **준비:** localLLM 모델 목록 조회 mock 반환
- **실행:** `runModelSetup("localLLM", undefined, undefined)`
- **예상 결과:** `authType: "none"` 또는 none 선택 후 localLLM 모델 선택으로 진행된다.

### Q-T-3: 미지원 provider 거부

- **준비:** provider `unknownProvider` 사용
- **실행:** `runModelSetup("unknownProvider", undefined, undefined)`
- **예상 결과:** 명확한 오류가 발생하고 config가 저장되지 않는다.

### Q-T-4: mock fallback 금지

- **준비:** 잘못된 provider 사용
- **실행:** 설정 흐름 실행
- **예상 결과:** provider가 `mock`으로 자동 변경되지 않는다.

## 3. 검증 결과 요약

- **모든 항목 통과 시:** provider 부분 지정 흐름이 안전하게 동작한다.
- **실패 항목 존재 시:** provider 유효성 검증과 `runModelSetup` 인자 개수 분기를 우선 점검한다.
