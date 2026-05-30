# AL. Update Notification Agent 테스트 계획

## 테스트 목표

최신 버전이 있을 때 사용자에게 업데이트 안내를 표시하되, 본래 작업과 보안 정책을 방해하지 않는지 검증한다.

중점 검증 항목은 다음과 같다.

- 알림 메시지 내용
- 알림 표시 조건
- 알림 생략 조건
- 자동 업데이트 미실행
- interactive flow 방해 없음

## formatUpdateNotification 테스트

| 케이스 | 입력 | 기대 결과 |
| --- | --- | --- |
| 정상 안내 | current `1.0.0`, latest `1.1.0` | 현재/최신 버전과 업데이트 명령이 포함된다. |
| package name 포함 | package `convention-cli` | package name이 메시지에 포함된다. |
| prerelease latest | latest `1.2.0-beta.1` | 버전 문자열이 깨지지 않고 표시된다. |
| 빈 current | current 빈 값 | 메시지 생성 전 오류 또는 null 처리 |
| 빈 latest | latest 빈 값 | 메시지 생성 전 오류 또는 null 처리 |

## notifyUpdate 표시 조건 테스트

| 케이스 | updateInfo | 기대 결과 |
| --- | --- | --- |
| update 있음 | `hasUpdate: true` | logger info 또는 warn으로 안내한다. |
| update 없음 | `hasUpdate: false` | 아무 메시지도 출력하지 않는다. |
| check skip | `null` 또는 `skipped: true` | 아무 메시지도 출력하지 않는다. |
| version invalid | latest invalid | 아무 메시지도 출력하지 않는다. |
| logger 주입 | logger mock | 직접 console.log 대신 logger가 호출된다. |

## CLI 흐름 방해 방지 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| commit confirm 전 | confirm mock | confirm prompt 중간에 update 메시지가 삽입되지 않는다. |
| commit flow 실패 아님 | update notify throw mock | commit flow는 update 알림 실패 때문에 실패하지 않는다. |
| `--help` | `node bin/convention.js --help` | help 출력에 update 알림을 섞지 않는다. |
| `--version` | `node bin/convention.js --version` | version만 출력하고 update 알림을 섞지 않는다. |
| reset confirm | reset flow mock | reset confirm 메시지를 방해하지 않는다. |

## 자동 업데이트 금지 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| npm install 방지 | child_process mock | `npm install -g`가 호출되지 않는다. |
| npm publish 방지 | child_process mock | `npm publish`가 호출되지 않는다. |
| 안내 명령만 표시 | update 있음 | `npm install -g convention-cli@latest`는 문자열 안내로만 존재한다. |
| 사용자 confirm 없음 | update 있음 | 업데이트 설치 여부를 묻거나 실행하지 않는다. |

## CI 및 non-interactive 테스트

| 케이스 | 환경 | 기대 결과 |
| --- | --- | --- |
| CI true | `CI=true` | 정책에 따라 알림을 생략하거나 stdout noise 없는 출력만 수행한다. |
| GitHub Actions | `GITHUB_ACTIONS=true` | GitHub Actions output을 오염시키지 않는다. |
| no-interactive | `--no-interactive` | prompt를 호출하지 않고 알림도 작업을 막지 않는다. |
| print-only PR | `--pr --print-only` | PR body/title 출력 형식을 깨지 않는다. |

## 보안 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| registry secret 포함 | updateInfo에 secret 유사 문자열 | secret 원문을 출력하지 않거나 입력을 검증해 제외한다. |
| raw response 없음 | registry raw body mock | raw JSON 전체가 출력되지 않는다. |
| logger redaction | logger mock | token/API Key 패턴은 redaction 대상이다. |
| Git 호출 없음 | git mock | notification만으로 Git 명령이 실행되지 않는다. |

## 완료 기준

- update가 있을 때 안내 메시지가 정확히 표시된다.
- update가 없거나 check 실패 시 조용히 넘어간다.
- `--help`, `--version`, confirm 흐름을 방해하지 않는다.
- 자동 npm install/publish가 실행되지 않는다.
- CI output과 secret 보호 정책이 깨지지 않는다.
