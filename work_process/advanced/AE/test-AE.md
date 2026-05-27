# AE. PR Title Generator Agent 테스트 계획

## 테스트 목표

`generatePrTitle()`이 변경 요약 또는 commit history를 기반으로 안전하고 일관된 PR 제목을 생성하는지 검증한다.

중점 검증 항목은 다음과 같다.

- Conventional Commits 스타일
- 빈 응답 처리
- 길이 제한
- markdown code block 제거
- secret 출력 방지
- provider 실패 처리

## 제목 생성 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| summary 기반 제목 | `diffSummary`에 신규 PR command 추가 내용 | `feat: ...` 형식의 제목이 생성된다. |
| commit log 기반 제목 | commit log에 `fix: parse remote url` 포함 | 변경 목적을 반영한 제목이 생성된다. |
| docs 변경 | docs 파일만 변경 | `docs:` type 후보가 생성된다. |
| test 변경 | test 파일만 변경 | `test:` type 후보가 생성된다. |
| refactor 변경 | 기능 변화 없는 구조 변경 summary | `refactor:` type 후보가 생성된다. |

## 응답 정리 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| code block 응답 | AI가 ```txt fenced title 반환 | fence가 제거된 제목만 반환된다. |
| 여러 줄 응답 | 첫 줄 제목, 이후 설명 포함 | 첫 번째 의미 있는 제목 줄만 사용한다. |
| bullet 응답 | `- feat: add pr flow` | bullet prefix를 제거한다. |
| numbering 응답 | `1. feat: add pr flow` | numbering prefix를 제거한다. |
| 따옴표 응답 | `"feat: add pr flow"` | 따옴표를 제거한다. |

## 검증 실패 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 빈 응답 | provider가 빈 문자열 반환 | 제목 생성 실패 오류를 반환한다. |
| 공백 응답 | provider가 공백만 반환 | 제목 생성 실패 오류를 반환한다. |
| 너무 긴 제목 | 72자 초과 제목 반환 | 줄이거나 오류로 처리한다. |
| type 없음 | `add pr flow` 반환 | Conventional Commits 형식 오류 또는 보정 대상으로 처리한다. |
| 허용되지 않는 type | `build: add pr flow` 반환 | 허용 type 오류로 처리한다. |

## Secret 방지 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 제목에 API Key 포함 | AI 응답에 `API_KEY=abc` 포함 | 제목으로 사용하지 않고 오류 또는 마스킹 처리한다. |
| 제목에 token 포함 | AI 응답에 `TOKEN=abc` 포함 | 원문 token이 반환되지 않는다. |
| provider raw response secret | raw response에 secret 포함 | raw response 전체가 로그에 출력되지 않는다. |
| summary secret 마스킹 | 입력 summary에 `[REDACTED]` 포함 | 원문 secret 없이 제목 생성이 진행된다. |

## Provider 실패 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| provider throw | AI provider mock throw | 안전한 오류로 중단한다. |
| provider timeout | provider timeout mock | PR 생성으로 자동 진행하지 않는다. |
| provider unsupported | provider 설정 오류 | mock fallback 없이 명확한 오류를 반환한다. |
| fallback 후보 | commit log 첫 줄 존재 | fallback 후보를 만들 수 있으나 사용자 확인 전 PR 생성하지 않는다. |

## 완료 기준

- 정상 제목 생성 테스트가 통과한다.
- AI 응답 정리 테스트가 통과한다.
- 빈 응답, 긴 제목, 잘못된 type이 안전하게 처리된다.
- secret 원문이 제목, stdout, stderr, logger에 노출되지 않는다.
- provider 실패가 자동 PR 생성으로 이어지지 않는다.
