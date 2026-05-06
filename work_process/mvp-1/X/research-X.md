# Phase X Default Convention Execution Agent Research

## 1. 개요

Phase X는 사용자가 옵션 없이 `convention` 명령을 실행했을 때 저장된 설정의 `mode` 값에 따라 step 또는 batch commit flow로 라우팅하는 단계입니다. 구현 대상은 `src/commands/commit.js`의 `runDefaultCommit()`과 `bin/convention.js`의 기본 실행 연결입니다.

현재 `runDefaultCommit()`은 안내 로그만 출력하는 placeholder 상태입니다. Phase X에서는 `loadConfig()`로 설정을 읽고, `mode` 값이 `step`이면 `runStepCommit()`, `batch`이면 `runBatchCommit()`을 호출해야 합니다.

## 2. 작업 목표

- `runDefaultCommit(): Promise<void>`에 기본 실행 라우팅 구현
- `loadConfig()`로 설정 로드
- `config.mode === 'step'`이면 `runStepCommit()` 호출
- `config.mode === 'batch'`이면 `runBatchCommit()` 호출
- config가 없거나 mode가 없으면 `DEFAULT_CONFIG.mode` 또는 `step` 기본값 사용
- mode가 유효하지 않으면 안전하게 `step`으로 fallback
- `bin/convention.js`에서 옵션이 없을 때 `runDefaultCommit()` 실행 유지
- 비동기 command 함수의 rejection이 삼켜지지 않도록 처리

## 3. 기본 라우팅 기준

권장 분기:

```javascript
export async function runDefaultCommit() {
  const config = loadConfig();
  const mode = isValidMode(config.mode) ? config.mode : DEFAULT_CONFIG.mode;

  if (mode === 'batch') {
    return runBatchCommit();
  }

  return runStepCommit();
}
```

`DEFAULT_CONFIG.mode`는 1차 MVP 계약상 `step`입니다. 따라서 config 파일이 없거나 깨진 경우에도 `loadConfig()`의 기본값 복구 흐름을 활용해 step mode가 기본 실행되어야 합니다.

## 4. CLI 연결 기준

- `convention --step`은 `runStepCommit()`을 직접 호출한다.
- `convention --batch`는 `runBatchCommit()`을 직접 호출한다.
- `convention --set-mode <mode>`는 commit flow를 실행하지 않고 설정만 저장한다.
- `convention --language <lang>`은 commit flow를 실행하지 않고 설정만 저장한다.
- 옵션이 없는 `convention`은 `runDefaultCommit()`을 호출한다.
- command 함수가 Promise를 반환하므로 top-level에서 `await` 또는 `.catch()` 처리로 실패 exit code를 명확히 해야 한다.

## 5. 에러 처리 기준

- 설정 파일이 없으면 기본 설정으로 step mode를 사용한다.
- 설정 파일이 깨져 있으면 `loadConfig()`의 정책을 따른다. 1차 MVP에서는 기본 설정 반환 또는 명확한 오류가 허용되지만 commit flow가 잘못된 mode로 진행되면 안 된다.
- 유효하지 않은 mode 값은 batch로 해석하지 않고 step으로 fallback한다.
- 라우팅 단계에서는 Git add/commit을 직접 호출하지 않는다. 실제 commit 작업은 V/W 단계 함수에 위임한다.

## 6. 보안 기준

- 기본 실행 라우팅에서는 diff를 읽거나 로그로 출력하지 않는다.
- 사용자 confirm, 민감 파일 제외, Git 히스토리 보호는 `runStepCommit()` 또는 `runBatchCommit()` 내부 gate를 그대로 사용한다.
- `runDefaultCommit()`은 mode 라우팅만 담당해 책임 범위를 좁게 유지한다.

## 7. 다음 단계 연결

Phase X까지 완료되면 1차 MVP의 주요 실행 명령인 `convention`, `convention --step`, `convention --batch`, `convention --set-mode`, `convention --language`가 하나의 CLI entrypoint에서 연결됩니다.
