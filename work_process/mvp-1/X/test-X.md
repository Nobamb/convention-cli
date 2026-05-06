# Phase X Default Convention Execution Agent Test

`research-X.md` 기준으로 옵션 없는 `convention` 실행이 저장된 mode 설정에 따라 올바른 commit flow로 라우팅되는지 검증하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| V-1 | 함수 export 확인 | `src/commands/commit.js` 확인 | `runDefaultCommit`을 import할 수 있다. |
| V-2 | config 로드 확인 | 코드 구조 확인 | `runDefaultCommit()`이 `loadConfig()`를 호출한다. |
| V-3 | step mode 라우팅 | 코드 구조 확인 | mode가 `step`이면 `runStepCommit()`을 호출한다. |
| V-4 | batch mode 라우팅 | 코드 구조 확인 | mode가 `batch`이면 `runBatchCommit()`을 호출한다. |
| V-5 | invalid mode fallback | 코드 구조 확인 | 유효하지 않은 mode는 `step`으로 fallback한다. |
| V-6 | CLI 기본 실행 연결 | `bin/convention.js` 확인 | 옵션이 없으면 `runDefaultCommit()`을 호출한다. |
| V-7 | async 에러 처리 | 코드 구조 확인 | Promise rejection이 처리되고 실패 exit code가 설정된다. |

## 2. 기능 테스트 항목

### T-1: config.mode step
- **준비:** `loadConfig()` test double이 `{ mode: 'step' }`을 반환하도록 구성한다.
- **실행:** `runDefaultCommit()`
- **예상 결과:** `runStepCommit()`이 호출되고 `runBatchCommit()`은 호출되지 않는다.

### T-2: config.mode batch
- **준비:** `loadConfig()` test double이 `{ mode: 'batch' }`를 반환하도록 구성한다.
- **실행:** `runDefaultCommit()`
- **예상 결과:** `runBatchCommit()`이 호출되고 `runStepCommit()`은 호출되지 않는다.

### T-3: config 파일 없음
- **준비:** 격리된 HOME 또는 USERPROFILE에 config 파일이 없는 상태를 만든다.
- **실행:** 옵션 없이 `convention` 또는 `runDefaultCommit()`
- **예상 결과:** 기본값 `step`으로 처리되어 `runStepCommit()` 흐름이 선택된다.

### T-4: 유효하지 않은 mode
- **준비:** `loadConfig()`가 `{ mode: 'fast' }` 또는 `{ mode: null }`을 반환하도록 구성한다.
- **실행:** `runDefaultCommit()`
- **예상 결과:** 안전하게 `runStepCommit()`으로 fallback한다.

### T-5: CLI 옵션 없음
- **준비:** child process 또는 commander entrypoint test로 `node bin/convention.js`를 실행한다.
- **실행:** 추가 옵션 없이 실행한다.
- **예상 결과:** `runDefaultCommit()` 경로가 선택된다.

### T-6: 명시 옵션 우선순위
- **준비:** config.mode가 `batch`인 상태를 만든다.
- **실행:** `convention --step`
- **예상 결과:** 저장된 mode와 무관하게 `runStepCommit()` 직접 경로가 선택된다.

### T-7: 설정 명령은 commit flow 미실행
- **준비:** `runDefaultCommit`, `runStepCommit`, `runBatchCommit` spy를 구성한다.
- **실행:** `convention --set-mode batch`, `convention --language en`
- **예상 결과:** 설정 저장 함수만 호출되고 commit flow 함수는 호출되지 않는다.

### T-8: async 실패 exit 처리
- **준비:** `runDefaultCommit()` 또는 하위 flow가 reject되도록 구성한다.
- **실행:** CLI entrypoint를 실행한다.
- **예상 결과:** 에러가 조용히 무시되지 않고 process exit code가 실패로 설정된다.

## 3. 테스트 절차

1. `runDefaultCommit()` 단위 테스트에서는 `loadConfig`, `runStepCommit`, `runBatchCommit`을 mock 처리한다.
2. CLI entrypoint 테스트에서는 실제 Git commit이 발생하지 않도록 command 함수를 mock하거나 임시 저장소를 사용한다.
3. config 파일 테스트는 격리된 HOME/USERPROFILE을 사용해 실제 사용자 설정을 건드리지 않는다.
4. mode validation은 `SUPPORTED_MODES` 또는 `isValidMode()` 기준과 일치하는지 확인한다.
5. async 에러 처리 테스트는 stderr 내용보다 exit code와 rejection 처리 여부를 우선 확인한다.

## 4. 검증 결과 요약

- **모든 항목 통과 시:** 1차 MVP 기본 실행 라우팅 완료
- **실패 항목 존재 시:** config fallback, CLI 옵션 우선순위, Promise rejection 처리를 우선 점검한다.
