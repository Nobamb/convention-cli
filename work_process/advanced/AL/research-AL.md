# AL. Update Notification Agent 구현 계획

## 작업 범위

AL 단계는 AK 단계의 update check 결과를 사용자에게 방해가 적은 방식으로 안내한다.

업데이트 안내는 정보성 출력이어야 하며, 사용자의 명령 실행을 막거나 자동 업데이트를 수행하면 안 된다.

## 선행 조건

- AJ 단계의 현재 버전 조회가 가능하다.
- AK 단계의 최신 버전 확인 결과가 구조화된 객체로 제공된다.
- logger 유틸리티가 존재한다.
- AM 단계에서 update check 호출 여부와 주기 정책을 결정한다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `src/core/update.js`
- `src/utils/logger.js`
- `src/commands/commit.js`
- `bin/convention.js`
- `tests/update-notification.test.js`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 구현 계획만 정리한다.

## 권장 함수 구조

`src/core/update.js`에 다음 함수를 둔다.

```js
export function formatUpdateNotification({ currentVersion, latestVersion, packageName })
export function notifyUpdate(updateInfo, logger)
```

권장 출력 내용은 다음과 같다.

```text
convention-cli 새 버전이 있습니다.
현재 버전: 1.0.0
최신 버전: 1.1.0
업데이트: npm install -g convention-cli@latest
```

출력에는 명령 안내만 포함하고, 실제 `npm install`은 실행하지 않는다.

## 출력 위치와 타이밍

업데이트 알림은 사용자의 본래 작업 흐름을 방해하지 않는 위치에 배치한다.

권장 정책:

- 일반 `convention` 실행 시작 전 또는 종료 후 짧게 출력한다.
- commit confirm 질문 중간에는 끼워 넣지 않는다.
- `--version` 출력에는 최신 버전 확인을 섞지 않는다.
- `--help` 출력에는 업데이트 알림을 섞지 않는다.
- CI 환경에서는 기본적으로 출력하지 않거나 별도 옵션에서만 출력한다.

## 안내 조건

다음 조건이 모두 충족될 때만 안내한다.

- update check가 활성화되어 있다.
- AK 단계가 정상적으로 latest version을 확인했다.
- `latestVersion`이 `currentVersion`보다 높다.
- 현재 명령이 `--help`, `--version`, `--reset` confirm 같은 민감한 단일 목적 명령을 방해하지 않는다.

## 메시지 설계 기준

메시지는 짧고 실행 가능한 형태여야 한다.

포함할 정보:

- package name
- 현재 버전
- 최신 버전
- 수동 업데이트 명령

포함하지 않을 정보:

- registry 응답 원문
- network error stack trace
- npm token, auth header
- 자동 업데이트 실행 여부를 암시하는 문구

## 실패 처리 기준

다음 경우에는 알림을 출력하지 않는다.

- update check 결과가 `null`
- `hasUpdate`가 false
- current/latest version 중 하나가 유효하지 않음
- logger 출력 실패
- CI에서 update notification 비활성 정책

알림 실패는 CLI 실패로 처리하지 않는다.

## 보안 기준

- `npm publish` 실행 없음
- `npm install` 자동 실행 없음
- registry 응답 원문 출력 없음
- token, API Key, Authorization header 출력 없음
- update notification 때문에 Git 명령, AI 호출, reset이 추가 실행되지 않음

## 완료 기준

- 새 버전이 있을 때 현재 버전, 최신 버전, 업데이트 명령을 안내한다.
- 최신 상태이거나 check 실패 시 아무 알림도 출력하지 않는다.
- 알림은 commit confirm, PR preview, reset confirm 등 중요한 사용자 선택 흐름을 방해하지 않는다.
- 자동 업데이트나 npm publish를 실행하지 않는다.
