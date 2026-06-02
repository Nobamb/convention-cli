# AS. 3차 통합 테스트 Agent 테스트 계획

## 테스트 목표

3차 고도화 기능이 서로 충돌하지 않고 기존 commit flow와 함께 정상 동작하는지 검증한다.

중점 검증 항목은 다음과 같다.

- preview, regenerate, manual edit 통합 흐름
- large diff 처리 흐름
- grouping 기반 commit 흐름
- template 적용 흐름
- OAuth mock 흐름
- PR 생성/출력 흐름
- update check 흐름
- CI mode 흐름

## commit UX 통합 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| batch preview | fixture 변경 파일 생성 | 생성 메시지와 변경 파일 요약을 표시한다. |
| regenerate | AI provider mock 응답 2개 | 두 번째 메시지가 표시되고 commit 선택으로 이어진다. |
| manual edit | 사용자 입력 mock | 수정된 메시지가 commit 함수로 전달된다. |
| cancel | decision mock | `git add`와 `git commit`이 호출되지 않는다. |
| step mode | 여러 파일 변경 | 파일별 preview와 confirm 흐름이 유지된다. |

## large diff 통합 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| threshold 초과 | 긴 diff fixture | large diff flow로 전환된다. |
| chunk 생성 | 여러 파일 diff | chunk metadata가 생성된다. |
| chunk summary | provider mock | chunk별 요약이 생성된다. |
| summary merge | 요약 목록 | 최종 prompt에 병합 요약이 사용된다. |
| raw diff logging | 긴 diff | stdout/stderr에 diff 원문 전체가 없다. |

## grouping 통합 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| source/test/docs 변경 | 파일 유형별 변경 | 목적별 그룹이 생성된다. |
| grouping preview | 그룹 mock | 그룹 목록을 표시한다. |
| grouped commit | 승인 mock | 그룹별 `git add`와 `git commit`이 호출된다. |
| use batch fallback | 선택 mock | 단일 batch flow로 전환된다. |
| empty grouping | analyzer 실패 mock | 안전하게 batch fallback 또는 오류 처리한다. |

## template 통합 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| template init | fixture repo | `.convention/template.json`이 생성된다. |
| template validate | 정상 template | 유효하다고 판단한다. |
| invalid template | 깨진 JSON 또는 schema 불일치 | 기본 template fallback 또는 명확한 오류를 출력한다. |
| prompt 적용 | template types 설정 | prompt에 template 규칙이 반영된다. |
| commit message 제한 | maxLength 설정 | 생성 메시지 검증 또는 재요청 기준이 적용된다. |

## OAuth/PR/update/CI 통합 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| OAuth mock | callback/state/token mock | state 검증 후 token 저장 흐름이 완료된다. |
| PR print-only | GitHub remote fixture | 제목/본문을 출력하고 PR 생성은 하지 않는다. |
| PR create confirm | `gh` mock, 승인 mock | argv 배열 방식으로 PR 생성 명령이 호출된다. |
| update check | registry mock | 최신 버전 안내 또는 조용한 무시가 동작한다. |
| CI mode | `CI=true` | prompt 호출 없이 실행 또는 안전 실패한다. |

## 회귀 보호 테스트

| 케이스 | 기대 결과 |
| --- | --- |
| `convention` | 저장된 mode 기준으로 동작한다. |
| `convention --step` | 저장된 mode보다 우선한다. |
| `convention --batch` | 단일 메시지 flow가 유지된다. |
| `--push` | commit 완료 후에만 push가 실행된다. |
| `--reset` | transaction 기록과 confirm 기준을 만족할 때만 실행된다. |

## 보안 테스트

| 케이스 | 기대 결과 |
| --- | --- |
| secret diff | 외부 provider 호출 전 중단 또는 확인 정책을 따른다. |
| credentials mock | 원문이 stdout/stderr에 없다. |
| OAuth token mock | token 원문이 출력되지 않는다. |
| CI secret env | env 값 원문이 출력되지 않는다. |
| 실제 사용자 repo | 테스트 대상에서 제외된다. |

## 완료 기준

- 3차 통합 시나리오가 fixture 또는 mock 기반으로 검증된다.
- 기존 1차·2차 MVP flow가 회귀되지 않는다.
- 보안 gate와 confirm 정책이 통합 테스트에서도 유지된다.
- 49번 기준의 누락, 경로, test/research 지시, 보안 위험 검토가 포함된다.
