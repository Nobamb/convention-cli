# Phase S --model provider authType modelVersion 직접 지정 Agent Test

`research-S.md` 기준으로 모든 인자가 제공된 `--model` 명령이 대화형 UI 없이 설정을 저장하는지 검증한다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| S-V-1 | 직접 지정 함수 존재 | `src/commands/model.js` 확인 | `setupModelDirectly(provider, authType, modelVersion)`가 존재한다. |
| S-V-2 | 모델 버전 검증 | 구현 확인 | `isValidModelVersion(modelVersion)` 또는 동등한 검증이 수행된다. |
| S-V-3 | UI 생략 | 호출 흐름 확인 | 세 인자가 모두 있으면 `selectModelVersion()`이 호출되지 않는다. |

## 2. 기능 테스트 항목

### S-T-1: localLLM 직접 설정

- **준비:** 기존 config에 `mode: "step"`, `language: "ko"` 저장
- **실행:** `runModelSetup("localLLM", "none", "qwen2.5:7b")`
- **예상 결과:** config에 localLLM 설정과 modelVersion이 저장되고 기존 mode/language가 보존된다.

### S-T-2: gemini 직접 설정

- **준비:** credentials에 gemini API Key가 저장된 상태를 mock 처리
- **실행:** `runModelSetup("gemini", "api", "gemini-2.5-pro")`
- **예상 결과:** config에 provider/authType/modelVersion이 저장되고 API Key 원문은 config에 저장되지 않는다.

### S-T-3: 빈 modelVersion 거부

- **준비:** modelVersion을 빈 문자열로 전달
- **실행:** `runModelSetup("localLLM", "none", "")`
- **예상 결과:** 오류가 발생하고 config가 변경되지 않는다.

### S-T-4: 대화형 UI 미호출

- **준비:** `selectProvider`, `selectAuthType`, `selectModelVersion` mock spy 구성
- **실행:** 세 인자를 모두 전달해 설정
- **예상 결과:** 선택 UI 함수가 호출되지 않는다.

## 3. 검증 결과 요약

- **모든 항목 통과 시:** 비대화형 `--model` 설정이 자동화 가능한 상태다.
- **실패 항목 존재 시:** `runModelSetup` 분기 순서와 config 저장 전 검증 로직을 우선 점검한다.
