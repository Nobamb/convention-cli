# AM. Update Policy Agent 테스트 계획

## 테스트 목표

업데이트 확인 정책이 config 기반으로 안전하게 적용되고, registry check가 하루 1회 이하로 제한되는지 검증한다.

중점 검증 항목은 다음과 같다.

- `updateCheck` 기본값과 비활성화
- `lastUpdateCheckAt` 처리
- 24시간 주기 제한
- config 저장
- 네트워크 호출 방지

## DEFAULT_CONFIG 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 기본 updateCheck | default config 로드 | `updateCheck: true`가 포함된다. |
| 기본 lastUpdateCheckAt | default config 로드 | `lastUpdateCheckAt: null`이 포함된다. |
| 기존 config migration | 기존 1차/2차 config | 누락 필드가 기본값으로 보정된다. |
| 기존 값 보존 | provider/language/mode 포함 config | update 필드 추가 후 기존 값이 유지된다. |
| credentials 분리 | credentials mock 존재 | credentials 파일은 읽거나 수정하지 않는다. |

## shouldCheckUpdate 테스트

| 케이스 | config | now | 기대 결과 |
| --- | --- | --- | --- |
| 비활성화 | `updateCheck: false` | 현재 | false |
| 최초 확인 | `lastUpdateCheckAt: null` | 현재 | true |
| 24시간 경과 | 마지막 확인 25시간 전 | 현재 | true |
| 24시간 미만 | 마지막 확인 1시간 전 | 현재 | false |
| 정확히 24시간 | 마지막 확인 24시간 전 | 현재 | true |
| invalid date | `lastUpdateCheckAt: "bad-date"` | 현재 | true |
| updateCheck 누락 | 기존 config | 현재 | 기본값 보정 후 true |

## runUpdateCheckIfNeeded 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| check 필요 | last check 없음 | `checkLatestVersion()`이 호출된다. |
| check 불필요 | last check 1시간 전 | `checkLatestVersion()`이 호출되지 않는다. |
| updateCheck false | config false | 네트워크 호출이 발생하지 않는다. |
| update 있음 | check 결과 hasUpdate true | `notifyUpdate()`가 호출된다. |
| update 없음 | check 결과 hasUpdate false | `notifyUpdate()`가 호출되지 않거나 아무 출력이 없다. |
| check 실패 | checkLatestVersion null | 본래 작업 실패 없이 종료한다. |

## lastUpdateCheckAt 저장 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| check 성공 | registry mock success | `lastUpdateCheckAt`이 ISO 문자열로 저장된다. |
| check 실패 | registry mock reject | 반복 실패 방지를 위해 정책에 따라 갱신된다. |
| 저장 실패 | saveConfig throw | 본래 CLI 작업은 실패하지 않는다. |
| 기존 설정 보존 | config에 provider/model 포함 | 저장 후 기존 필드가 유지된다. |
| 날짜 형식 | markUpdateChecked 호출 | ISO 8601 형식 문자열이 저장된다. |

## 명령별 호출 정책 테스트

| 명령 | 기대 결과 |
| --- | --- |
| `convention --help` | update check를 호출하지 않는다. |
| `convention --version` | update check를 호출하지 않는다. |
| `convention --set-mode batch` | update check를 호출하지 않는다. |
| `convention --language ko` | update check를 호출하지 않는다. |
| `convention --model mock` | secret/auth 설정 흐름을 방해하지 않는다. |
| `convention --batch` | 정책상 필요할 때만 update check를 호출한다. |
| `convention --pr` | 정책상 필요할 때만 update check를 호출한다. |

## 네트워크 제한 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 하루 내 반복 실행 | last check 10분 전 | fetch가 호출되지 않는다. |
| updateCheck false | false 설정 | fetch가 호출되지 않는다. |
| CI 환경 | `CI=true` | 정책에 따라 fetch를 호출하지 않는다. |
| GitHub Actions | `GITHUB_ACTIONS=true` | workflow output을 방해하지 않는다. |
| config load 실패 | loadConfig throw | 네트워크 호출 없이 skip한다. |

## 보안 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| config에 secret 저장 방지 | update policy 저장 | API Key/token 필드가 config에 추가되지 않는다. |
| credentials 미접근 | credentials mock | update policy가 credentials를 수정하지 않는다. |
| raw error 출력 방지 | network error mock | stderr/stdout에 raw stack trace가 없다. |
| npm 자동 실행 금지 | child_process mock | `npm install`, `npm publish`가 호출되지 않는다. |
| 본래 작업 유지 | update check 실패 | commit 또는 PR flow가 계속 진행 가능하다. |

## 완료 기준

- update check 주기 정책이 테스트된다.
- `updateCheck: false`에서 네트워크 호출이 없는 것이 검증된다.
- `lastUpdateCheckAt` 저장과 기존 config 보존이 검증된다.
- `--help`, `--version`, 설정 명령에서 update check가 실행되지 않는다.
- update policy가 secret 저장, npm 자동 실행, 본래 작업 실패를 유발하지 않는다.
