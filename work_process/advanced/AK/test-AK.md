# AK. npm Registry Check Agent 테스트 계획

## 테스트 목표

npm registry에서 최신 버전을 확인하고 현재 버전과 비교하는 로직이 안전하게 동작하는지 검증한다.

중점 검증 항목은 다음과 같다.

- registry API 호출 구성
- latest version parsing
- semver 비교
- 네트워크 실패 무시
- 실제 네트워크 호출 없는 unit test

## checkLatestVersion 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 최신 버전 있음 | current `1.0.0`, registry `1.1.0` | `hasUpdate: true`를 반환한다. |
| 최신 상태 | current `1.1.0`, registry `1.1.0` | `hasUpdate: false`를 반환한다. |
| 현재가 더 높음 | current `1.2.0`, registry `1.1.0` | `hasUpdate: false`를 반환한다. |
| prerelease 현재 | current `1.1.0-beta.1`, registry `1.1.0` | update 있음으로 판단한다. |
| prerelease latest | current `1.1.0`, registry `1.2.0-beta.1` | 정책에 맞게 비교하고 결과를 문서화한다. |

## registry 응답 테스트

| 케이스 | registry mock | 기대 결과 |
| --- | --- | --- |
| 정상 JSON | `{ "version": "1.1.0" }` | latest version을 파싱한다. |
| version 누락 | `{ "name": "convention-cli" }` | update check를 skip한다. |
| 깨진 JSON | JSON parse throw | 사용자 작업 실패 없이 skip한다. |
| 404 응답 | status 404 | skip한다. |
| 500 응답 | status 500 | skip한다. |
| timeout | fetch timeout mock | skip한다. |
| DNS 실패 | fetch reject | skip한다. |

## URL 구성 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 일반 package | `convention-cli` | `https://registry.npmjs.org/convention-cli/latest`로 호출한다. |
| scoped package | `@scope/name` | package name이 안전하게 인코딩된다. |
| custom registry | registry URL 주입 | 중복 slash 없이 latest endpoint를 구성한다. |
| 잘못된 registry URL | invalid URL | 네트워크 호출 없이 skip 또는 안전한 오류 처리 |

## 버전 비교 테스트

| current | latest | 기대 결과 |
| --- | --- | --- |
| `1.0.0` | `1.0.1` | update 있음 |
| `1.0.0` | `1.1.0` | update 있음 |
| `1.0.0` | `2.0.0` | update 있음 |
| `1.0.1` | `1.0.0` | update 없음 |
| `1.0.0` | `1.0.0` | update 없음 |
| `1.0.0-beta.1` | `1.0.0` | update 있음 |
| invalid | `1.0.0` | 안전하게 skip 또는 update 없음 |

## 네트워크 mock 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| fetch mock 사용 | global fetch mock | 실제 npm registry를 호출하지 않는다. |
| fetch 호출 횟수 | 정상 check 1회 | fetch가 1회만 호출된다. |
| 실패 후 재시도 없음 | fetch reject | 같은 함수 호출 안에서 무한 재시도하지 않는다. |
| stderr 출력 없음 | network reject | stderr에 raw error가 출력되지 않는다. |

## 보안 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| auth header 없음 | fetch mock inspect | 기본 registry 호출에 token header를 넣지 않는다. |
| 응답 원문 출력 방지 | 응답에 임의 secret 포함 | 응답 JSON 전체가 로그에 출력되지 않는다. |
| npm 명령 실행 방지 | child_process mock | `npm install`, `npm publish`가 호출되지 않는다. |
| 본래 작업 방해 없음 | check 실패 mock | 호출자는 commit flow를 계속 진행할 수 있는 반환값을 받는다. |

## 완료 기준

- latest version 조회와 비교가 테스트된다.
- registry 실패가 조용히 skip되는지 테스트된다.
- 실제 네트워크 없이 모든 unit test가 수행된다.
- npm install 또는 npm publish가 자동 실행되지 않는 것이 검증된다.
- 응답 원문과 인증 정보가 로그에 노출되지 않는다.
