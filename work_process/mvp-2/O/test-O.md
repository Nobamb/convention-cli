# Phase O --model CLI 라우팅 Agent Test

`research-O.md` 기준으로 `--model` 옵션이 올바르게 command 계층으로 라우팅되는지 검증하기 위한 테스트 항목이다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| O-V-1 | `--model` 옵션 등록 | `bin/convention.js` 확인 | commander에 `--model [values...]` 옵션이 등록되어 있다. |
| O-V-2 | command 계층 위임 | import 및 호출부 확인 | `runModelSetup`이 import되고 `--model` 분기에서 호출된다. |
| O-V-3 | commit flow 차단 | `main()` 분기 순서 확인 | `--model` 처리 후 `return`하여 commit flow가 실행되지 않는다. |

## 2. 기능 테스트 항목

### O-T-1: 인자 없는 `--model` 라우팅

- **준비:** `runModelSetup` 호출을 관찰할 수 있도록 mock 처리
- **실행:** `node bin/convention.js --model`
- **예상 결과:** `runModelSetup(undefined, undefined, undefined)` 형태로 전달되고 commit flow는 호출되지 않는다.

### O-T-2: provider만 지정한 라우팅

- **준비:** provider 값 `gemini` 사용
- **실행:** `node bin/convention.js --model gemini`
- **예상 결과:** `runModelSetup("gemini", undefined, undefined)`가 호출된다.

### O-T-3: provider와 authType 지정 라우팅

- **준비:** provider `gemini`, authType `api` 사용
- **실행:** `node bin/convention.js --model gemini api`
- **예상 결과:** `runModelSetup("gemini", "api", undefined)`가 호출된다.

### O-T-4: 모든 인자 지정 라우팅

- **준비:** modelVersion `gemini-2.5-pro` 사용
- **실행:** `node bin/convention.js --model gemini api gemini-2.5-pro`
- **예상 결과:** `runModelSetup("gemini", "api", "gemini-2.5-pro")`가 호출된다.

## 3. 검증 결과 요약

- **모든 항목 통과 시:** `--model` 명령의 CLI 진입점 연결이 완료된 상태다.
- **실패 항목 존재 시:** commander option 정의, `options.model` parsing, `main()` 분기 순서를 우선 점검한다.
