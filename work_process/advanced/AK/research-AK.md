# AK. npm Registry Check Agent 구현 계획

## 작업 범위

AK 단계는 npm registry에서 `convention-cli`의 최신 버전을 확인하고, 현재 버전과 비교할 수 있는 핵심 로직을 정의한다.

네트워크 실패는 CLI의 주요 작업 실패로 취급하지 않는다. 업데이트 확인은 부가 기능이므로 실패해도 commit, PR, version 출력 등 사용자의 본래 작업을 방해하면 안 된다.

## 선행 조건

- AJ 단계의 `getCurrentVersion()`이 존재한다.
- `package.json`의 package name과 version을 읽을 수 있다.
- Node.js 런타임에서 `fetch` 또는 안전한 HTTP client를 사용할 수 있다.
- AM 단계에서 호출 주기 정책을 적용할 예정이다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `src/core/update.js`
- `src/core/version.js`
- `tests/update.test.js`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 구현 계획만 정리한다.

## 권장 함수 구조

`src/core/update.js`에 다음 함수를 둔다.

```js
export async function checkLatestVersion({ packageName, currentVersion, registryUrl })
export function compareVersions(currentVersion, latestVersion)
```

권장 반환값은 boolean 하나보다 구조화된 객체가 좋다.

```js
{
  currentVersion: "1.0.0",
  latestVersion: "1.1.0",
  hasUpdate: true,
  checkedAt: "2026-05-30T00:00:00.000Z"
}
```

네트워크 실패 시에는 `null`을 반환하거나 `{ skipped: true, reason: "network-error" }`처럼 조용히 무시 가능한 값을 반환한다. 이 경우 사용자에게 오류로 보이지 않게 한다.

## npm registry API 계획

기본 registry URL은 다음 형태를 사용한다.

```text
https://registry.npmjs.org/convention-cli/latest
```

처리 기준:

- package name은 `encodeURIComponent()`로 안전하게 URL에 넣는다.
- scoped package를 고려할 경우 `/`가 `%2F` 처리되는지 확인한다.
- 응답 JSON의 `version` 필드를 최신 버전으로 사용한다.
- HTTP 404, 5xx, timeout은 기능 실패가 아니라 update check skip으로 처리한다.
- 응답 본문 전체를 로그로 출력하지 않는다.

## 버전 비교 기준

가능하면 안정적인 semver 비교를 사용한다. 별도 dependency를 추가하지 않는다면 최소한 다음 케이스를 안전하게 처리한다.

- `1.0.0` < `1.0.1`
- `1.0.0` < `1.1.0`
- `1.0.0` < `2.0.0`
- `1.0.0` == `1.0.0`
- prerelease는 일반 release보다 낮게 취급하는 semver 규칙을 따른다.

복잡한 semver 비교를 직접 구현하기 어렵다면 `semver` dependency 추가 여부를 별도 검토한다. dependency 추가 시 package lock 변경과 보안 검토가 필요하다.

## 실패 처리 기준

다음 상황은 조용히 skip한다.

- 네트워크 연결 실패
- DNS 실패
- timeout
- registry 응답 404 또는 5xx
- 응답 JSON parse 실패
- 응답에 version 없음

skip은 debug 수준 내부 상태로만 유지하고, 기본 사용자 출력에는 오류를 노출하지 않는다.

## 보안 기준

- npm token, auth header, registry credential을 출력하지 않는다.
- custom registry URL을 지원하더라도 사용자 입력 URL을 검증한다.
- update check 실패로 commit flow를 중단하지 않는다.
- unit test에서는 실제 네트워크를 호출하지 않고 fetch를 mock한다.
- npm publish, npm install 자동 실행을 하지 않는다.

## AM 단계와의 연결

AK는 최신 버전 확인 함수만 제공한다.

호출 주기, `updateCheck` 설정, `lastUpdateCheckAt` 저장은 AM 단계에서 담당한다. AK 구현이 매 실행마다 registry를 직접 호출하도록 고정하면 안 된다.

## 완료 기준

- npm registry에서 latest version을 조회할 수 있다.
- 현재 버전과 latest version을 비교할 수 있다.
- 네트워크 실패가 조용히 무시된다.
- unit test에서 네트워크 호출은 mock 처리된다.
- update check는 사용자 본래 작업을 방해하지 않는다.
