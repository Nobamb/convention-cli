# Phase I --set-mode 구현 Research

## 1. 개요
Phase I는 `convention --set-mode step|batch` 명령으로 CLI의 기본 실행 모드를 저장하는 단계입니다. 사용자가 선택한 모드는 `~/.config/convention/config.json`에 저장되고, 이후 기본 `convention` 실행 흐름에서 `step` 또는 `batch` 모드를 결정하는 기준으로 사용됩니다.

현재 `src/commands/config.js`의 `setMode(mode)`는 debug 출력만 하는 placeholder 상태이므로, Phase G/H에서 준비된 `loadConfig()`와 `saveConfig(config)`를 연결해 실제 설정 저장 흐름으로 바꾸는 것이 목표입니다.

## 2. 작업 목표
- `src/commands/config.js`의 `setMode(mode)` 구현
- 입력값이 `step` 또는 `batch`인지 검증
- 잘못된 mode 값은 저장하지 않고 실패 메시지 처리
- 기존 config를 `loadConfig()`로 불러오기
- 기존 설정 객체에서 `mode`만 새 값으로 변경
- 변경된 config를 `saveConfig(config)`로 저장
- 성공/실패 메시지는 `src/utils/logger.js`를 통해 출력

## 3. 구현 기준

### 3.1. 입력값 검증
`setMode(mode)`는 가장 먼저 입력값을 검증해야 합니다. 허용 값은 1차 MVP 기준 `step`, `batch` 두 개뿐입니다.

```javascript
if (!isValidMode(mode)) {
  error('지원하지 않는 mode입니다. 사용 가능 값: step, batch');
  return;
}
```

검증 로직은 `src/utils/validator.js`의 `isValidMode(mode)`로 분리하는 것이 이후 K단계와의 책임 분리에 맞습니다. I단계 작업 시점에 validator가 아직 비어 있다면, I단계 구현에서 필요한 최소 검증을 추가하거나 K단계에서 보완할 항목으로 명확히 남겨야 합니다.

### 3.2. 기존 config 로드
유효한 mode 값이면 `loadConfig()`로 기존 설정을 불러옵니다. 설정 파일이 없거나 일부 필드만 저장되어 있어도 Phase G의 병합 로직에 의해 `DEFAULT_CONFIG` 기반 객체가 반환되어야 합니다.

```javascript
const config = loadConfig();
```

### 3.3. mode 변경 후 저장
기존 설정의 다른 필드는 유지하고 `mode` 필드만 변경합니다. `language`, provider placeholder, `confirmBeforeCommit` 같은 값은 덮어쓰지 않습니다.

```javascript
saveConfig({
  ...config,
  mode,
});
```

### 3.4. 메시지 처리
성공 시에는 저장된 mode를 사용자에게 알려야 합니다. 실패 시에는 허용 가능한 값을 포함한 안내 메시지를 출력합니다.

```javascript
success(`기본 실행 모드가 ${mode}로 저장되었습니다.`);
```

`console.log()`를 직접 남발하지 말고 `src/utils/logger.js`의 `success()`, `error()`를 사용합니다.

### 3.5. CLI 라우팅 연결
`bin/convention.js`에서 `--set-mode <mode>` 옵션이 들어오면 `setMode(mode)`로 전달되어야 합니다. C단계 라우팅이 이미 연결되어 있다면 I단계에서는 command 내부 구현만 보완하면 됩니다.

## 4. 보안 및 데이터 보호 기준
- `setMode(mode)`는 Git 명령이나 shell 명령을 실행하지 않습니다.
- credentials, API key, OAuth token, `.env` 파일은 읽거나 쓰지 않습니다.
- config 저장 시 기존 설정 객체 전체를 불필요하게 로그로 출력하지 않습니다.
- 잘못된 mode 입력 시 기존 `config.json`을 변경하지 않습니다.
- 실제 사용자 홈을 대상으로 한 자동 테스트는 피하고, 테스트는 임시 home 또는 mock 경로에서 수행합니다.

## 5. 연결 파일 및 다음 단계
- 연결 파일: `src/commands/config.js`, `src/config/store.js`, `src/utils/validator.js`, `src/utils/logger.js`
- 주요 함수: `setMode(mode): void`, `loadConfig(): object`, `saveConfig(config): void`, `isValidMode(mode): boolean`
- 다음 단계: Phase J에서 `setLanguage(language)`가 같은 패턴으로 기존 config를 로드하고 `language`만 변경해 저장합니다.
