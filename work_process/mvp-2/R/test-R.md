# Phase R --model provider authType 부분 지정 Agent Test

`research-R.md` 기준으로 provider와 authType이 지정된 `--model` 명령이 모델 선택 중심으로 동작하는지 검증한다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| R-V-1 | provider/authType 부분 지정 함수 존재 | `src/commands/model.js` 확인 | `setupModelWithProviderAndAuth(provider, authType)`가 존재한다. |
| R-V-2 | authType 검증 | 구현 확인 | `isValidAuthType(authType)` 또는 동등한 검증이 수행된다. |
| R-V-3 | 인증 정보 분리 | 저장 흐름 확인 | API Key는 config가 아니라 credentials 저장 흐름으로 연결된다. |

## 2. 기능 테스트 항목

### R-T-1: `convention --model gemini api` 흐름

- **준비:** API Key 입력 함수와 모델 선택 UI를 mock 처리
- **실행:** `runModelSetup("gemini", "api", undefined)`
- **예상 결과:** Provider/Auth 선택 UI는 생략되고 API Key 확인 후 모델 선택이 진행된다.

### R-T-2: `convention --model localLLM none` 흐름

- **준비:** localLLM 모델 목록 mock 반환
- **실행:** `runModelSetup("localLLM", "none", undefined)`
- **예상 결과:** API Key 입력 없이 모델 선택으로 진행된다.

### R-T-3: Provider/Auth 불일치 거부

- **준비:** localLLM에 `api` authType 지정
- **실행:** `runModelSetup("localLLM", "api", undefined)`
- **예상 결과:** 명확한 오류가 발생하고 config가 저장되지 않는다.

### R-T-4: API Key 원문 미출력

- **준비:** secret 값 `test-secret-key` 입력 mock
- **실행:** gemini api 설정 흐름 실행
- **예상 결과:** stdout/stderr/log에 secret 원문이 포함되지 않는다.

## 3. 검증 결과 요약

- **모든 항목 통과 시:** provider/authType 부분 지정 흐름이 의도대로 동작한다.
- **실패 항목 존재 시:** Provider/Auth 조합 검증과 credentials 저장 경계를 우선 점검한다.
