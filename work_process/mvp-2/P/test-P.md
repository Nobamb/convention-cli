# Phase P --model 전체 대화형 설정 Agent Test

`research-P.md` 기준으로 `convention --model`만 실행했을 때 전체 대화형 설정이 완료되는지 검증한다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| P-V-1 | 전체 대화형 함수 존재 | `src/commands/model.js` 확인 | `setupModelInteractively()`가 export 또는 내부 라우팅 함수로 존재한다. |
| P-V-2 | UI 함수 연결 | import 확인 | `selectProvider`, `selectAuthType`, `selectModelVersion`이 command 흐름에서 사용된다. |
| P-V-3 | 설정 저장 연결 | 저장 호출 확인 | 최종 config가 `saveConfig()`로 저장된다. |

## 2. 기능 테스트 항목

### P-T-1: `convention --model` 전체 설정 성공

- **준비:** UI 선택 함수를 mock하여 provider `localLLM`, authType `none`, modelVersion `qwen2.5:7b`를 반환
- **실행:** `runModelSetup(undefined, undefined, undefined)`
- **예상 결과:** config에 `provider: "localLLM"`, `authType: "none"`, `modelVersion: "qwen2.5:7b"`가 저장된다.

### P-T-2: Provider 선택 단계 실행 확인

- **준비:** `selectProvider` mock spy 구성
- **실행:** 인자 없이 `runModelSetup()` 호출
- **예상 결과:** Provider 선택 UI가 호출된다.

### P-T-3: 모델 선택 단계 실행 확인

- **준비:** Provider 모델 목록을 mock으로 반환
- **실행:** 전체 대화형 설정 흐름 실행
- **예상 결과:** 반환된 모델 목록이 `selectModelVersion`에 choices로 전달된다.

### P-T-4: 설정 명령 후 commit flow 미실행

- **준비:** commit command 함수를 mock spy로 구성
- **실행:** `node bin/convention.js --model`
- **예상 결과:** 설정 저장 후 commit 관련 함수가 호출되지 않는다.

## 3. 검증 결과 요약

- **모든 항목 통과 시:** `convention --model`만으로 Provider/Auth/Model 설정이 완료된다.
- **실패 항목 존재 시:** `runModelSetup`의 provider 없음 분기와 UI mock 반환값 연결을 우선 점검한다.
