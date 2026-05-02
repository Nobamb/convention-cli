# Phase H 설정 파일 쓰기 구현 Research

## 1. 개요
Phase H는 사용자 설정을 안전하게 파일에 저장하는 단계입니다. Phase F에서 정의한 설정 경로와 Phase G에서 구현한 `loadConfig()`를 기반으로, `~/.config/convention/config.json`에 설정값을 저장하고 다음 실행 때 동일한 설정을 다시 불러올 수 있어야 합니다.

1차 MVP의 구현 대상은 `src/config/store.js`이며, 핵심 함수는 `ensureConfigDir()`와 `saveConfig(config)`입니다.

## 2. 작업 목표
- `ensureConfigDir()` 함수 구현
- `saveConfig(config)` 함수 구현
- `~/.config/convention` 디렉터리가 없으면 자동 생성
- `config.json` 파일을 UTF-8 JSON으로 저장
- 사람이 읽기 쉬운 JSON pretty format 적용
- `os.homedir()`와 `path.join()` 기반 경로 사용 유지
- 저장 후 `loadConfig()`로 재로드했을 때 저장값이 유지되는 흐름 보장

## 3. 구현 기준

### 3.1. 설정 디렉터리 생성
`ensureConfigDir()`는 `CONFIG_DIR`이 존재하는지 확인하고, 없으면 재귀 옵션으로 디렉터리를 생성합니다. OS별 경로 구분자 차이를 피하기 위해 경로는 문자열 직접 결합이 아니라 기존 `CONFIG_DIR` 상수를 사용합니다.

```javascript
export function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}
```

### 3.2. 설정 파일 저장
`saveConfig(config)`는 저장 전 반드시 `ensureConfigDir()`를 호출해야 합니다. 이후 전달받은 설정 객체를 `JSON.stringify(config, null, 2)`로 변환해 `CONFIG_FILE_PATH`에 UTF-8로 저장합니다.

```javascript
export function saveConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf8');
}
```

### 3.3. 저장 데이터 기준
1차 MVP에서는 `DEFAULT_CONFIG`의 스키마를 유지하는 설정 객체를 저장 대상으로 봅니다.

```json
{
  "mode": "step",
  "language": "ko",
  "provider": null,
  "authType": null,
  "modelDisplayName": null,
  "modelVersion": null,
  "baseURL": null,
  "confirmBeforeCommit": true
}
```

`saveConfig(config)`는 입력 객체를 그대로 저장하고, 누락 필드 보완은 Phase G의 `loadConfig()`에서 `DEFAULT_CONFIG`와 병합해 처리하는 구조가 적절합니다.

### 3.4. 경로 처리 기준
- 설정 디렉터리: `path.join(os.homedir(), '.config', 'convention')`
- 설정 파일: `path.join(CONFIG_DIR, 'config.json')`
- 문자열로 `~/.config/convention/config.json`를 직접 이어 붙이지 않습니다.
- Windows, macOS, Linux 모두에서 `path.join()`이 OS별 구분자를 처리하도록 둡니다.

### 3.5. 저장 완료 메시지
H단계의 핵심 책임은 파일 저장입니다. 사용자-facing 메시지는 이후 `--set-mode`, `--language` 단계에서 `src/utils/logger.js`를 통해 출력하는 편이 책임 분리에 맞습니다. `saveConfig(config)` 자체는 저장 성공 시 값을 반환하지 않아도 됩니다.

## 4. 보안 및 데이터 보호 기준
- `saveConfig(config)`는 `config.json`만 저장합니다.
- credentials, API key, OAuth token은 1차 MVP 저장 대상이 아닙니다.
- `credentials.json`, `.env`, private key 파일을 읽거나 쓰지 않습니다.
- 사용자 홈 디렉터리 전체를 스캔하지 않습니다.
- 저장 실패 시에도 설정 객체 원문이나 민감할 수 있는 값을 로그로 출력하지 않습니다.

## 5. 연결 파일 및 다음 단계
- 연결 파일: `src/config/store.js`, `src/config/defaults.js`
- 주요 함수: `ensureConfigDir(): void`, `saveConfig(config): void`, `loadConfig(): object`
- 다음 단계: Phase I에서 `setMode(mode)`가 기존 config를 로드하고 mode를 바꾼 뒤 `saveConfig(config)`로 저장합니다.
