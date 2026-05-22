# Y. OAuth Local Callback Agent 테스트 계획

## 테스트 목표

OAuth Local Callback Agent가 브라우저 로그인 이후 CLI로 돌아오는 callback 요청을 안전하게 수신하는지 검증한다.

중점 검증 대상은 다음과 같다.

- 성공 callback 수신
- timeout 처리
- invalid path 처리
- state handoff
- 서버 종료
- authorization code, token, state 로그 미노출
- 브라우저 실행 mock 및 환경 제약

테스트는 외부 OAuth provider와 실제 브라우저를 사용하지 않고 mock 요청과 mock launcher를 우선 사용한다.

## Localhost 서버 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 랜덤 port listen | `port: 0`, `callbackPath: "/oauth/callback"`으로 서버 시작 | OS가 배정한 port를 읽고 redirect URI에 반영한다. |
| loopback bind | 기본 host 설정으로 서버 시작 | `127.0.0.1` 또는 명시된 loopback host에만 bind한다. |
| callback path 정규화 | `callbackPath: "oauth/callback"` 입력 | `/oauth/callback`으로 정규화해 처리한다. |
| redirect URI 생성 | 서버 시작 후 port 확인 | `http://127.0.0.1:{port}/oauth/callback` 형식의 URI를 반환한다. |
| listen 실패 | 이미 사용 중인 port를 명시적으로 사용 | 명확한 오류를 반환하고 secret을 출력하지 않는다. |

## 성공 Callback 테스트

| 케이스 | 요청 | 기대 결과 |
| --- | --- | --- |
| code 수신 | `GET /oauth/callback?code=abc123&state=state123` | 결과 객체에 `code`, `state`, `redirectUri`가 포함된다. |
| state handoff | `state=expected-state` 포함 | 받은 state가 변경 없이 다음 단계로 전달된다. |
| HTML 응답 | 성공 callback 요청 | 브라우저에 인증 완료 안내 응답을 반환한다. |
| Promise 완료 | 성공 callback 요청 | callback 대기 Promise가 resolve된다. |
| query 추가값 존재 | `scope`, `prompt` 등 추가 query 포함 | 필요한 `code`, `state`만 사용하고 나머지는 무시한다. |

## Timeout 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| callback 없음 | timeout을 짧게 설정하고 요청을 보내지 않음 | timeout 오류 또는 실패 결과를 반환한다. |
| timeout 후 서버 종료 | timeout 발생 후 같은 port 접근 시도 | 서버가 더 이상 요청을 처리하지 않는다. |
| timeout 메시지 | timeout 발생 | code, state, token, redirect URL 전체가 로그에 포함되지 않는다. |
| timeout timer 정리 | 성공 callback 후 timeout 시간 경과 | timeout handler가 뒤늦게 실행되지 않는다. |

## Invalid Path 테스트

| 케이스 | 요청 | 기대 결과 |
| --- | --- | --- |
| 다른 path 요청 | `GET /wrong?code=abc123&state=state123` | `404`를 응답하고 인증 성공으로 처리하지 않는다. |
| root path 요청 | `GET /` | 인증 결과 없이 안내 또는 `404` 응답을 반환한다. |
| invalid path 후 정상 callback | 먼저 `/wrong`, 이후 `/oauth/callback?code=abc&state=s` 요청 | invalid path는 무시되고 정상 callback에서 resolve된다. |
| invalid path logging | invalid path 요청 | 요청 URL 전체나 code 값이 로그에 출력되지 않는다. |

## Invalid Callback 테스트

| 케이스 | 요청 | 기대 결과 |
| --- | --- | --- |
| code 없음 | `GET /oauth/callback?state=state123` | `400` 또는 실패 결과를 반환하고 서버를 닫는다. |
| provider error | `GET /oauth/callback?error=access_denied&state=state123` | 인증 실패 결과를 반환하고 서버를 닫는다. |
| error description 포함 | `error_description` query 포함 | 원문 전체를 그대로 로그에 출력하지 않는다. |
| 중복 callback | 성공 callback 후 같은 URL 재요청 | 첫 요청만 처리되고 서버는 이미 닫혀 있다. |

## State Handoff 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| state 보존 | 특수문자가 URL encoding된 state 사용 | decoding된 state 또는 합의된 원문 형태가 손실 없이 반환된다. |
| state 없음 | `code`만 포함된 callback | Y 단계는 수신 결과를 반환하되, Z 단계 검증에서 실패할 수 있도록 state 누락 상태를 명확히 전달한다. |
| state 불일치 | 기대값과 다른 state 수신 | Y 단계는 값을 전달하고, token 요청 차단 판단은 Z 단계가 수행한다. |

## 서버 종료 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 성공 후 close | 정상 callback 수신 | `server.close()`가 호출된다. |
| provider error 후 close | `error=access_denied` callback 수신 | `server.close()`가 호출된다. |
| invalid callback 후 close | callback path는 맞지만 code 없음 | `server.close()`가 호출된다. |
| timeout 후 close | callback 없이 timeout | `server.close()`가 호출된다. |
| close 중복 방지 | 성공 후 close helper 재호출 | 예외 없이 한 번만 종료 처리된다. |

## Browser Launch 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| interactive 승인 | 사용자 승인 mock이 true | browser launcher mock이 authorization URL과 함께 호출된다. |
| 사용자 거부 | 사용자 승인 mock이 false | browser launcher가 호출되지 않고 수동 URL 안내 흐름으로 간다. |
| CI 환경 | `CI=true` | browser launcher가 호출되지 않는다. |
| GitHub Actions 환경 | `GITHUB_ACTIONS=true` | browser launcher가 호출되지 않는다. |
| TTY 없음 | non-interactive mock | browser launcher가 호출되지 않는다. |
| 브라우저 실행 실패 | launcher mock이 오류 반환 | callback 서버는 유지되고 사용자가 수동으로 URL을 열 수 있도록 안내한다. |
| 자동 실행 성공 | launcher mock이 성공 | authorization URL 전체가 logger/debug 출력에 남지 않는다. |
| non-interactive 수동 URL 제한 | `CI=true` 또는 TTY 없음 | 브라우저도 실행하지 않고 수동 authorization URL도 출력하지 않은 채 안전하게 실패한다. |
| interactive 수동 URL 안내 | 사용자 승인 후 launcher 실패 | URL은 사용자 화면 안내에만 표시되고 logger, 파일, snapshot에는 기록되지 않는다. |

## No Token/Code Logging 테스트

| 케이스 | 입력 | 기대 결과 |
| --- | --- | --- |
| authorization code 포함 | `code=secret-code-123` | stdout/stderr/logger 출력에 `secret-code-123`이 없다. |
| state 포함 | `state=secret-state-123` | stdout/stderr/logger 출력에 `secret-state-123`이 없다. |
| provider error description 포함 | `error_description=contains-secret-token` | 원문 값이 그대로 출력되지 않는다. |
| callback URL 전체 | `/oauth/callback?code=abc&state=s` | 전체 URL이 로그에 출력되지 않는다. |
| token query 오염 | `access_token=token123` query 추가 | token 값이 출력되지 않고 무시된다. |

## Mock Server 테스트 방식

테스트는 다음 방식으로 구성한다.

1. `waitForOAuthCallback({ callbackPath, timeoutMs })`를 짧은 timeout으로 실행한다.
2. 반환된 `redirectUri` 또는 서버 정보에서 port를 확인한다.
3. Node.js `http` 또는 `fetch`로 mock callback 요청을 보낸다.
4. Promise 결과와 응답 status를 검증한다.
5. logger를 mock해 민감값이 출력되지 않았는지 확인한다.
6. server close 여부를 spy 또는 후속 요청 실패로 확인한다.

외부 네트워크 호출, 실제 OAuth provider, 실제 브라우저 실행은 unit test에서 사용하지 않는다.

## Commit Flow 미실행 테스트

OAuth callback 테스트에서는 다음 함수 또는 Git 명령이 호출되지 않아야 한다.

- `runDefaultCommit()`
- `runStepCommit()`
- `runBatchCommit()`
- `getChangedFiles()`
- `getFullDiff()`
- `getFileDiffs()`
- `generateCommitMessage()`
- `addAll()`
- `addFile()`
- `commit()`
- `push()`
- `resetLastCommit()`

Y 단계는 인증 callback 수신만 담당하며 Git 상태를 변경하지 않는다.

## 격리 원칙

- 테스트는 실제 사용자 저장소에서 commit, reset, push를 수행하지 않는다.
- 외부 OAuth provider에 요청하지 않는다.
- 실제 브라우저를 실행하지 않는다.
- 실제 credentials 파일을 읽거나 쓰지 않는다.
- token, code, state 원문을 fixture 파일이나 스냅샷에 저장하지 않는다.

## 완료 기준

- 정상 callback에서 authorization code와 state를 수신한다.
- timeout에서 서버가 닫히고 안전한 실패 결과를 반환한다.
- invalid path는 인증 성공으로 처리되지 않는다.
- state 값이 Z 단계로 전달 가능하게 보존된다.
- 모든 종료 경로에서 callback 서버가 닫힌다.
- browser launch는 사용자 승인과 환경 제약을 따른다.
- 테스트는 mock server와 mock launcher를 우선 사용한다.
- authorization code, state, token류 값이 로그에 노출되지 않는다.
