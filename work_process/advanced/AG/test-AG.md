# AG. GitHub Remote Detector Agent 테스트 계획

## 테스트 목표

Git remote URL에서 GitHub `owner/repo`를 안전하게 추출하고, GitHub가 아닌 remote와 credential 포함 URL을 안전하게 처리하는지 검증한다.

중점 검증 항목은 다음과 같다.

- HTTPS remote parsing
- SSH remote parsing
- GitHub가 아닌 remote 처리
- credential redaction
- 여러 remote 선택 정책

## URL Parsing 테스트

| 케이스 | 입력 | 기대 결과 |
| --- | --- | --- |
| HTTPS `.git` | `https://github.com/acme/app.git` | owner `acme`, repo `app` |
| HTTPS no suffix | `https://github.com/acme/app` | owner `acme`, repo `app` |
| SSH scp style | `git@github.com:acme/app.git` | owner `acme`, repo `app` |
| SSH URL style | `ssh://git@github.com/acme/app.git` | owner `acme`, repo `app` |
| repo에 dash 포함 | `https://github.com/acme/my-app.git` | repo `my-app` |
| owner에 dash 포함 | `https://github.com/acme-org/app.git` | owner `acme-org` |

## Non-GitHub Remote 테스트

| 케이스 | 입력 | 기대 결과 |
| --- | --- | --- |
| GitLab HTTPS | `https://gitlab.com/acme/app.git` | GitHub remote 아님으로 처리 |
| Bitbucket SSH | `git@bitbucket.org:acme/app.git` | GitHub remote 아님으로 처리 |
| 로컬 path remote | `../repo.git` | GitHub remote 아님으로 처리 |
| 잘못된 URL | `not-a-url` | parse 실패 또는 null 반환 |
| 빈 URL | 빈 문자열 | null 반환 |

## Credential Redaction 테스트

| 케이스 | 입력 | 기대 결과 |
| --- | --- | --- |
| token 포함 HTTPS | `https://token@github.com/acme/app.git` | owner/repo 추출, token 로그 미출력 |
| user/token 포함 HTTPS | `https://user:token@github.com/acme/app.git` | credential 제거 후 처리 |
| 오류 메시지 | parse 실패 URL에 token 포함 | token 원문이 오류에 없다. |
| logger 출력 | logger mock 사용 | remote URL credential 원문이 없다. |

## Remote 선택 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| origin GitHub | `origin`이 GitHub remote | origin의 owner/repo를 반환한다. |
| origin non-GitHub, upstream GitHub | 두 remote fixture | upstream을 후보로 반환하거나 선택 필요 상태를 반환한다. |
| 여러 GitHub remote | origin, upstream 모두 GitHub | preferred remote 정책을 따른다. |
| remote 없음 | git remote 결과 빈 값 | PR 문서 출력 흐름으로 넘길 수 있는 상태를 반환한다. |
| Git 저장소 아님 | git command 실패 mock | Git 저장소 오류를 반환한다. |

## Git 명령 안전성 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| remote 조회 | git mock spy | `execFileSync("git", ["remote", "-v"])` 형태로 호출된다. |
| shell injection branch | remote 이름에 특수문자 | shell 문자열 조합이 사용되지 않는다. |
| stderr에 token 포함 | git mock stderr에 token 포함 | stderr 원문을 출력하지 않는다. |

## 완료 기준

- HTTPS/SSH GitHub remote parsing 테스트가 통과한다.
- Non-GitHub remote가 PR 생성 불가 상태로 안전하게 처리된다.
- credential 포함 URL의 secret이 출력되지 않는다.
- 여러 remote와 remote 없음 케이스가 명확히 처리된다.
