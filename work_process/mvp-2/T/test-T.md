# Phase T Model Config 저장 Agent Test

`research-T.md` 기준으로 `--model` 결과가 config schema에 맞게 저장되고 이후 Provider routing에 반영되는지 검증한다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| T-V-1 | config schema 유지 | `DEFAULT_CONFIG`와 저장 객체 비교 | `mode`, `language`, `provider`, `authType`, `modelDisplayName`, `modelVersion`, `baseURL`, `confirmBeforeCommit` 필드가 유지된다. |
| T-V-2 | secret 분리 | 저장 로직 확인 | `apiKey`, `token`, `secret`, `password`가 config 저장 객체에 포함되지 않는다. |
| T-V-3 | Provider routing 연결 | `core/ai.js` 확인 | `loadConfig()` 결과의 provider가 `generateWithProvider`에 전달된다. |

## 2. 기능 테스트 항목

### T-T-1: localLLM config 저장

- **준비:** 격리된 HOME 또는 config path mock 사용
- **실행:** `runModelSetup("localLLM", "none", "qwen2.5:7b")`
- **예상 결과:** config에 `provider: "localLLM"`, `authType: "none"`, `modelVersion: "qwen2.5:7b"`, `baseURL: "http://localhost:11434/v1"`가 저장된다.

### T-T-2: 기존 mode/language 보존

- **준비:** 기존 config에 `mode: "batch"`, `language: "en"`, `confirmBeforeCommit: true` 저장
- **실행:** 모델 설정 저장
- **예상 결과:** Provider 관련 필드만 갱신되고 기존 mode/language/confirmBeforeCommit은 유지된다.

### T-T-3: API Key config 미저장

- **준비:** gemini API Key 저장 흐름 mock
- **실행:** `runModelSetup("gemini", "api", "gemini-2.5-pro")`
- **예상 결과:** config 파일에 API Key 원문과 secret 관련 필드가 포함되지 않는다.

### T-T-4: 저장된 Provider 사용

- **준비:** config에 provider `mock` 또는 `localLLM` 저장 후 Provider routing mock 구성
- **실행:** commit message 생성 흐름에서 config를 로드
- **예상 결과:** 저장된 provider가 `generateWithProvider({ prompt, config })`에 전달된다.

### T-T-5: config JSON 형식

- **준비:** 설정 저장 실행
- **실행:** 저장된 config 파일 읽기
- **예상 결과:** UTF-8 JSON이며 2 spaces pretty format으로 저장된다.

## 3. 검증 결과 요약

- **모든 항목 통과 시:** `--model` 설정 결과가 안정적으로 저장되고 이후 commit flow에서 사용된다.
- **실패 항목 존재 시:** config 병합 로직, secret 분리, Provider routing 연결을 우선 점검한다.
