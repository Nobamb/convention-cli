# Phase L Logger Agent Test

`research-L.md`의 구현 기준을 바탕으로, logger가 1차 MVP 요구사항을 충족하는지 확인하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| V-1 | `success(message)` export 확인 | `src/utils/logger.js` 코드 확인 | 다른 모듈에서 `success`를 import할 수 있다. |
| V-2 | `error(message)` export 확인 | `src/utils/logger.js` 코드 확인 | 다른 모듈에서 `error`를 import할 수 있다. |
| V-3 | `warn(message)` export 확인 | `src/utils/logger.js` 코드 확인 | 다른 모듈에서 `warn`을 import할 수 있다. |
| V-4 | `info(message)` export 확인 | `src/utils/logger.js` 코드 확인 | 다른 모듈에서 `info`를 import할 수 있다. |
| V-5 | prefix 통일 확인 | logger 함수 구현 확인 | 성공/실패/경고/안내 메시지가 정해진 prefix를 사용한다. |
| V-6 | stream 분리 확인 | logger 함수 구현 확인 | `success/info`는 `console.log`, `warn`은 `console.warn`, `error`는 `console.error`를 사용한다. |
| V-7 | config command 재사용 확인 | `src/commands/config.js` 코드 확인 | `setMode`, `setLanguage`가 성공/실패 메시지에 logger를 사용한다. |
| V-8 | commit command 전환 대상 확인 | `src/commands/commit.js` 코드 확인 | debug용 직접 `console.log`는 이후 `info()` 또는 실제 flow 메시지로 교체 가능하다. |
| V-9 | help 출력 예외 확인 | `src/commands/help.js` 코드 확인 | help 본문 전체 출력은 `console.log(helpText)` 예외로 허용할 수 있다. |

## 2. 기능 테스트 항목

### T-1: `success()` 호출
- **준비:** `console.log`를 spy 또는 mock 처리한다.
- **실행:** `success('설정이 저장되었습니다.')`를 호출한다.
- **예상 결과:** `✅ 설정이 저장되었습니다.`가 `console.log`로 출력된다.

### T-2: `error()` 호출
- **준비:** `console.error`를 spy 또는 mock 처리한다.
- **실행:** `error('지원하지 않는 옵션입니다.')`를 호출한다.
- **예상 결과:** `❌ 지원하지 않는 옵션입니다.`가 `console.error`로 출력된다.

### T-3: `warn()` 호출
- **준비:** `console.warn`을 spy 또는 mock 처리한다.
- **실행:** `warn('변경 사항이 없습니다.')`를 호출한다.
- **예상 결과:** `⚠️ 변경 사항이 없습니다.`가 `console.warn`으로 출력된다.

### T-4: `info()` 호출
- **준비:** `console.log`를 spy 또는 mock 처리한다.
- **실행:** `info('변경 파일을 확인하는 중입니다.')`를 호출한다.
- **예상 결과:** `ℹ️ 변경 파일을 확인하는 중입니다.`가 `console.log`로 출력된다.

### T-5: 반환값 의존성 없음
- **준비:** 각 logger 함수의 호출 결과를 확인할 수 있게 준비한다.
- **실행:** `success()`, `error()`, `warn()`, `info()`를 각각 호출한다.
- **예상 결과:** 호출자는 반환값에 의존하지 않으며, 함수는 메시지 출력만 담당한다.

### T-6: config command에서 logger 재사용
- **준비:** `src/commands/config.js`를 확인하거나 console 출력을 spy 처리한다.
- **실행:** `setMode('batch')`, `setLanguage('en')`, `setMode('fast')`, `setLanguage('de')`를 실행한다.
- **예상 결과:** 성공 케이스는 `success()` 스타일, 실패 케이스는 `error()` 스타일로 출력된다.

### T-7: commit command에서 직접 debug 출력 제거 가능성
- **준비:** `src/commands/commit.js`의 출력 방식을 확인한다.
- **실행:** `runDefaultCommit()`, `runStepCommit()`, `runBatchCommit()` 호출 시 출력 기준을 점검한다.
- **예상 결과:** Phase L 이후에는 직접 `[DEBUG]` `console.log` 대신 `info()` 또는 실제 사용자 메시지로 교체되어야 한다.

### T-8: help 출력 예외 확인
- **준비:** `src/commands/help.js`를 확인한다.
- **실행:** `printHelp()`를 호출한다.
- **예상 결과:** help 본문 전체 출력은 `console.log(helpText)` 예외로 허용할 수 있으며, 상태/성공/실패 메시지와 혼용하지 않는다.

### T-9: 민감정보 출력 금지
- **준비:** API key, token, diff 원문 같은 문자열을 logger 메시지로 넘기는 코드가 있는지 검색한다.
- **실행:** `rg "API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|DATABASE_URL|diff" src`로 출력 코드 주변을 확인한다.
- **예상 결과:** logger가 민감정보나 diff 원문을 출력하는 용도로 사용되지 않는다.

## 3. CLI 통합 확인 항목
- `node bin/convention.js --set-mode batch`
- `node bin/convention.js --language en`
- `node bin/convention.js --set-mode fast`
- `node bin/convention.js --language de`
- `node bin/convention.js --help`

`--help`는 help 본문 출력 확인용이고, 나머지는 logger 스타일 확인용입니다. 실제 사용자 home을 오염시키지 않도록 테스트용 home/mock 경로에서 확인하는 것이 좋습니다.

## 4. 테스트 환경 주의사항
- 실제 사용자 `~/.config/convention/config.json`을 직접 오염시키지 않습니다.
- Logger 테스트는 spy/mock 기반 단위 테스트로 우선 확인합니다.
- Git 커밋을 만들지 않습니다.
- `.env`, `credentials.json`, private key 파일 내용을 출력하지 않습니다.
- 실패 테스트에서도 config 객체 전체나 diff 원문을 로그로 출력하지 않습니다.

## 5. 검증 결과 요약
- **모든 항목 통과 시:** Phase L 완료 및 Phase M(Git 저장소 확인) 진입 가능
- **실패 항목 존재 시:** `warn()`, `info()` 누락, prefix 불일치, stream 분리 오류, command의 직접 console 출력, 민감정보 출력 가능성을 우선 점검합니다.
