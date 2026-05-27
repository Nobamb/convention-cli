# AF. PR Body Generator Agent 테스트 계획

## 테스트 목표

`generatePrBody()`가 안전한 markdown PR 본문을 생성하고, 보안 scan 결과와 테스트 실행 정보를 올바르게 반영하는지 검증한다.

중점 검증 항목은 다음과 같다.

- `Summary`, `Changes`, `Tests` 섹션 포함
- changed files와 commit log 반영
- 테스트 결과 반영
- secret/token 출력 방지
- 빈 응답 및 malformed markdown 처리

## 본문 생성 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 정상 본문 생성 | summary, changed files, commit log 입력 | markdown PR 본문이 반환된다. |
| Summary 섹션 | 변경 목적 summary 입력 | `## Summary` 섹션이 포함된다. |
| Changes 섹션 | 변경 파일 목록 입력 | `## Changes` 섹션에 주요 변경이 정리된다. |
| Tests 섹션 | `npm test` 성공 결과 입력 | `## Tests` 섹션에 실행 명령이 포함된다. |
| 테스트 미실행 | tests 빈 배열과 reason 입력 | `Not run`과 이유가 표시된다. |

## Template 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| PR template 존재 | template fixture 입력 | template 구조가 반영된다. |
| template 없음 | template null | 기본 섹션 구조를 사용한다. |
| template에 Tests 없음 | custom template 입력 | 테스트 정보가 누락되지 않도록 보정한다. |
| 깨진 template | parse 불가 template | 기본 구조로 fallback한다. |

## AI 응답 정리 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| code fence 본문 | AI가 fenced markdown 반환 | fence가 제거된다. |
| 빈 본문 | provider가 빈 문자열 반환 | 본문 생성 실패 오류를 반환한다. |
| 섹션 누락 | AI가 Summary만 반환 | 보정 또는 오류 처리된다. |
| 과도하게 긴 본문 | 매우 긴 응답 반환 | 요약 또는 preview 가능한 형태로 정리한다. |
| raw response 포함 | provider metadata가 섞임 | 본문에서 제거된다. |

## Secret 방지 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| summary에 API Key 포함 | `API_KEY=abc` 포함 | 본문에는 `[REDACTED]`만 포함된다. |
| changed file이 `.env` | 민감 파일 변경 | 파일 내용은 포함되지 않는다. |
| private key 포함 | `-----BEGIN PRIVATE KEY-----` 포함 | 본문 생성이 중단되거나 마스킹된다. |
| remote URL credential 포함 | `https://token@github.com/a/b.git` | credential 부분이 출력되지 않는다. |
| provider body secret | AI 응답에 token 포함 | token 원문이 stdout/stderr/logger에 없다. |

## 테스트 결과 정확성 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 테스트 성공 | `{ command: "npm test", status: "passed" }` | 성공한 테스트로 표시된다. |
| 테스트 실패 | `{ command: "npm test", status: "failed" }` | 실패 사실이 그대로 표시된다. |
| 테스트 미실행 | 테스트 결과 없음 | 임의로 성공했다고 표시하지 않는다. |
| 여러 테스트 | help check와 unit test 입력 | 모든 테스트 명령이 표시된다. |

## 완료 기준

- 기본 PR 본문 구조가 생성된다.
- 테스트 실행 여부가 정확히 표시된다.
- secret 원문과 raw diff가 본문과 로그에 노출되지 않는다.
- template 유무와 AI 응답 변형이 안전하게 처리된다.
