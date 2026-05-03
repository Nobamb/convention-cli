# Phase L Logger Agent Research

## 1. 개요
Phase L은 CLI 전반의 출력 메시지 스타일을 통일하는 Logger Agent 단계입니다. `AGENTS.md`와 `init/01_mvp-1.md` 기준으로 command 파일에서는 `console.log`를 직접 남발하지 않고 `src/utils/logger.js`의 `success()`, `error()`, `warn()`, `info()`를 재사용해야 합니다.

현재 `src/utils/logger.js`에는 `success(message)`와 `error(message)`만 구현되어 있습니다. `warn(message)`, `info(message)`는 아직 없으므로 Phase L에서 보완해야 합니다.

## 2. 현재 상태
- `src/utils/logger.js`
  - `success(message)` 구현됨
  - `error(message)` 구현됨
  - `warn(message)` 미구현
  - `info(message)` 미구현
- `src/commands/config.js`
  - `setMode(mode)`, `setLanguage(language)`에서 `success()`, `error()`를 사용하고 있음
- `src/commands/commit.js`
  - Phase C 확인용 debug `console.log()` placeholder가 남아 있음
  - 실제 commit flow 구현 전후로 `info()` 또는 실제 사용자 메시지로 교체하는 것이 좋음
- `src/commands/help.js`
  - help 본문 전체 출력은 예외적으로 `console.log(helpText)` 사용을 허용할 수 있음
  - 단, 상태/성공/실패/경고 메시지는 logger로 통일하는 것이 좋음

## 3. 작업 목표
- `src/utils/logger.js`에 아래 함수를 모두 export
  - `success(message): void`
  - `error(message): void`
  - `warn(message): void`
  - `info(message): void`
- 성공, 실패, 경고, 안내 메시지 prefix와 출력 stream 기준을 통일
- command 계층에서 직접 `console.log`, `console.error`, `console.warn` 사용을 줄이고 logger를 재사용
- config, commit, git, ai 단계에서 같은 메시지 스타일을 유지할 수 있게 기준 정리
- 민감정보, diff 원문, config 전체 객체를 logger로 출력하지 않도록 제한

## 4. 구현 기준

### 4.1. 함수별 역할
`success(message)`는 작업 성공 메시지에 사용합니다.

```javascript
success('설정이 저장되었습니다.');
success(`기본 실행 모드가 ${mode}로 저장되었습니다.`);
```

`error(message)`는 사용자가 조치해야 하는 실패나 잘못된 입력에 사용합니다.

```javascript
error('지원하지 않는 mode입니다. 사용 가능 값: step, batch');
error('Git 저장소가 아닙니다.');
```

`warn(message)`는 작업은 계속 가능하지만 주의가 필요한 상황에 사용합니다.

```javascript
warn('변경 사항이 없습니다.');
warn('일부 파일은 민감 파일 후보라 제외되었습니다.');
```

`info(message)`는 진행 상태나 일반 안내에 사용합니다.

```javascript
info('변경 파일을 확인하는 중입니다.');
info('커밋 메시지를 생성하는 중입니다.');
```

### 4.2. prefix 및 stream 기준
1차 MVP에서는 아래 기준을 권장합니다.

| 함수 | prefix | 출력 대상 |
| :--- | :--- | :--- |
| `success()` | `✅` | `console.log` |
| `error()` | `❌` | `console.error` |
| `warn()` | `⚠️` | `console.warn` |
| `info()` | `ℹ️` | `console.log` |

기존 `success()`, `error()` prefix는 유지합니다. 테스트에서는 prefix뿐 아니라 stdout/stderr 계열이 분리되는지도 확인합니다.

### 4.3. 직접 console 사용 제한
command 파일에서는 상태, 성공, 실패, 경고 메시지를 직접 출력하지 않는 것이 원칙입니다.

피해야 할 예시:

```javascript
console.log('설정이 저장되었습니다.');
console.error('지원하지 않는 옵션입니다.');
console.log('[DEBUG] runBatchCommit 호출됨');
```

권장 예시:

```javascript
success('설정이 저장되었습니다.');
error('지원하지 않는 옵션입니다.');
info('batch 모드로 커밋을 준비합니다.');
```

다만 `src/commands/help.js`처럼 여러 줄 help text를 한 번에 출력하는 경우는 `console.log(helpText)`를 예외로 둘 수 있습니다.

### 4.4. 보안 및 데이터 보호 기준
- API Key, OAuth Token, Secret, private key, `.env` 내용은 출력하지 않습니다.
- Git diff 원문은 logger로 출력하지 않습니다.
- config 객체 전체를 그대로 출력하지 않습니다.
- 에러 객체 전체를 무조건 출력하지 않고 사용자에게 필요한 요약 메시지만 출력합니다.
- 이후 외부 AI API 연동 단계에서도 prompt/diff 원문을 info 로그로 노출하지 않습니다.

## 5. 연결 파일 및 다음 단계
- 구현 대상 파일: `src/utils/logger.js`
- 재사용 대상 파일: `src/commands/config.js`, `src/commands/commit.js`, 이후 `src/core/git.js`, `src/core/ai.js`
- 주요 함수: `success(message)`, `error(message)`, `warn(message)`, `info(message)`
- 다음 단계: Phase M 이후 Git 분석 단계에서 Git 저장소 아님, 변경 사항 없음, diff 추출 실패 같은 메시지를 logger 기준으로 통일합니다.
