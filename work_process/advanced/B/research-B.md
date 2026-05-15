# Phase B Config Versioning Agent Research

## 1. 개요

Phase B는 3차 고도화에서 늘어나는 설정 항목을 안전하게 관리하기 위한 config schema versioning 단계입니다. 기존 1차/2차 MVP에서 생성된 `~/.config/convention/config.json`을 유지하면서 3차 기본 필드를 보정하고, 이후 migration을 확장할 수 있는 구조를 마련합니다.

## 2. 작업 목표

- `DEFAULT_CONFIG`에 `configVersion`과 3차 기본 설정 필드를 추가합니다.
- 기존 config 로드 시 버전을 확인하고 누락 필드를 기본값으로 보정합니다.
- 구버전 config를 현재 schema로 migration하는 `src/config/migration.js`를 추가합니다.
- migration 실패 시 config 원문이나 secret이 출력되지 않도록 명확한 에러만 반환합니다.
- `loadConfig()`가 migration 결과를 반환하도록 `src/config/store.js`와 연결합니다.

## 3. 구현 범위

- `src/config/defaults.js`
  - `configVersion`
  - `previewBeforeCommit`
  - `maxRegenerateCount`
  - 추후 template/large diff/update 설정을 수용할 기본 구조
- `src/config/migration.js`
  - `migrateConfig(config)`
  - `getConfigVersion(config)`
  - 누락 필드 병합 로직
- `src/config/store.js`
  - `loadConfig()`에서 migration 적용
  - 깨진 JSON 처리 정책 유지

## 4. 권장 구현 방향

기존 설정을 덮어쓰기 전에 `DEFAULT_CONFIG`를 기준으로 얕은 병합을 수행합니다. 단, 중첩 객체가 추가될 경우에는 필드별 병합 기준을 명확히 두어 사용자의 기존 설정이 사라지지 않게 합니다.

```javascript
export function migrateConfig(config = {}) {
  const migrated = {
    ...DEFAULT_CONFIG,
    ...config,
    configVersion: CURRENT_CONFIG_VERSION
  };

  return migrated;
}
```

버전이 없는 config는 1차/2차 MVP 설정으로 간주합니다. 지원하지 않는 미래 버전이 들어오면 임의로 downgrade하지 말고 명확한 에러를 내는 쪽이 안전합니다.

## 5. 보안 및 안정성 기준

- config 전체 원문을 로그로 출력하지 않습니다.
- `credentials.json` 또는 API Key 계층과 migration을 섞지 않습니다.
- migration 실패 시 실제 파일 내용 대신 "설정 파일을 읽을 수 없습니다" 수준의 메시지만 출력합니다.
- 사용자의 기존 provider, model, baseURL 설정은 보존합니다.

## 6. 완료 기준

- 기존 1차/2차 config가 있어도 3차 config 구조로 안전하게 보정됩니다.
- config 파일이 없어도 최신 `DEFAULT_CONFIG`가 반환됩니다.
- 깨진 JSON은 기존 정책대로 안전하게 처리되고 secret 또는 파일 원문이 출력되지 않습니다.

