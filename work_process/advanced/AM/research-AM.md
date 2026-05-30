# AM. Update Policy Agent 구현 계획

## 작업 범위

AM 단계는 업데이트 확인 정책을 설정에 추가하고, npm registry check가 너무 자주 실행되지 않도록 제어한다.

핵심 목표는 `updateCheck`와 `lastUpdateCheckAt` 설정을 통해 하루 1회 이하로만 registry를 확인하는 것이다. 사용자가 `updateCheck: false`로 설정한 경우 네트워크 호출은 발생하면 안 된다.

## 선행 조건

- AK 단계의 `checkLatestVersion()`이 존재한다.
- AL 단계의 `notifyUpdate()`가 존재한다.
- config load/save 구조가 존재한다.
- 3차 config migration 또는 defaults 확장이 가능하다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `src/config/defaults.js`
- `src/config/store.js`
- `src/config/migration.js`
- `src/core/update.js`
- `bin/convention.js`
- `tests/update-policy.test.js`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 구현 계획만 정리한다.

## Config schema 추가 계획

`DEFAULT_CONFIG`에 다음 필드를 추가한다.

```json
{
  "updateCheck": true,
  "lastUpdateCheckAt": null
}
```

기존 config를 로드할 때 누락 필드는 기본값으로 보정한다.

정책:

- `updateCheck` 기본값은 `true`
- `lastUpdateCheckAt` 기본값은 `null`
- `lastUpdateCheckAt`은 ISO 8601 문자열로 저장
- invalid date는 `null`처럼 처리

## 권장 함수 구조

`src/core/update.js`에 다음 함수를 둔다.

```js
export function shouldCheckUpdate(config, now = new Date())
export function markUpdateChecked(config, checkedAt = new Date())
export async function runUpdateCheckIfNeeded({ config, packageName, currentVersion, logger, now })
```

권장 동작:

1. `updateCheck`가 false면 즉시 skip한다.
2. `lastUpdateCheckAt`이 없으면 check 대상이다.
3. 마지막 check 이후 24시간 이상 지났으면 check 대상이다.
4. 24시간 이하이면 check하지 않는다.
5. check를 시도한 뒤 `lastUpdateCheckAt`을 갱신한다.
6. network 실패도 check 시도로 보고 갱신할지 여부는 정책으로 명확히 정한다. 기본 권장은 실패 시에도 갱신해 반복 네트워크 실패를 방지하는 것이다.

## 호출 위치 계획

업데이트 확인은 사용자의 본래 명령 실행을 방해하지 않는 위치에 둔다.

권장 제외 명령:

- `--help`
- `--version`
- config 설정만 수행하는 명령
- secret 입력이 포함된 model/auth 설정 흐름
- reset confirm 직전

일반 commit flow나 PR flow에서는 시작 또는 종료 시점에 조용히 확인할 수 있다.

## 설정 저장 기준

`lastUpdateCheckAt` 갱신 시에는 기존 config 값을 보존해야 한다.

주의 사항:

- config 파일 전체를 재작성하더라도 기존 provider, language, mode 값이 유지되어야 한다.
- API Key나 credentials를 config에 저장하지 않는다.
- credentials 파일을 건드리지 않는다.
- 저장 실패는 update check 실패로만 처리하고 본래 작업을 중단하지 않는다.

## 네트워크 호출 제한 기준

다음 경우에는 registry check를 호출하지 않는다.

- `updateCheck === false`
- 마지막 확인 후 24시간 미만
- CI 환경에서 정책상 update check 비활성
- 사용자가 `--version` 또는 `--help`만 실행
- config load 실패로 안전한 기본값을 만들 수 없는 경우

## 보안 기준

- `updateCheck: false`일 때 네트워크 호출 없음
- registry check에 token이나 credentials 사용 없음
- config.json에 secret 저장 없음
- update check 실패로 raw error나 registry 응답 원문 출력 없음
- npm install, npm publish 자동 실행 없음

## 완료 기준

- `DEFAULT_CONFIG`에 `updateCheck`, `lastUpdateCheckAt`이 추가된다.
- `shouldCheckUpdate()`가 하루 1회 이하 정책을 적용한다.
- `updateCheck: false`에서는 네트워크 호출이 발생하지 않는다.
- check 시도 후 `lastUpdateCheckAt`이 안전하게 갱신된다.
- update policy는 기존 commit flow, PR flow, model setup을 방해하지 않는다.
