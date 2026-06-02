# AT. Regression Test Agent 구현 계획

## 작업 범위

AT 단계는 3차 고도화 변경 이후에도 1차·2차 MVP 기능이 이전과 동일하게 동작하는지 회귀 검증하는 작업이다.

핵심 목표는 `convention`, `--step`, `--batch`, `--set-mode`, `--language`, `--model`, localLLM, API Key provider, `--push`, `--reset` 흐름이 3차 기능 추가로 깨지지 않았는지 확인하는 것이다.

## 선행 조건

- 1차 MVP 기능이 구현되어 있다.
- 2차 MVP 기능이 구현되어 있다.
- 3차 고도화 기능이 commit flow에 연결되어 있거나 연결 예정이다.
- 테스트는 실제 사용자 저장소가 아닌 fixture 또는 임시 Git 저장소에서 수행한다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `tests/phase3-regression.test.js`
- `tests/cli-help.test.js`
- `tests/config-command.test.js`
- `tests/model-command.test.js`
- `tests/localLLM.test.js`
- `tests/api-key.test.js`
- `tests/commit-command.test.js`
- `tests/reset-command.test.js`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 회귀 검증 계획만 정리한다.

## 회귀 검증 범위

1차 MVP 대상:

- 기본 `convention` 실행
- `convention --step`
- `convention --batch`
- `convention --set-mode step|batch`
- `convention --language ko|en|jp|cn`
- `convention --help`, `convention -h`
- 설정 파일 저장 및 로드
- Git 저장소 확인, 변경 파일 확인, diff 추출
- Mock provider 기반 커밋 메시지 생성
- 사용자 confirm 이후 `git add`와 `git commit`

2차 MVP 대상:

- `convention --model`
- provider routing
- localLLM 연결 확인과 모델 목록 조회
- API Key provider 설정과 credentials 저장
- `convention --push`
- `convention --reset`

## 실행 전략

회귀 테스트는 실제 commit, push, reset이 사용자 저장소에 영향을 주지 않도록 격리한다.

- Git 관련 테스트는 임시 디렉터리에서 `git init`으로 생성한 fixture repo를 사용한다.
- push는 remote와 `git push` 호출을 mock 처리한다.
- reset은 transaction 기록 mock과 임시 repo에서 soft reset만 검증한다.
- 외부 provider와 localLLM endpoint는 네트워크 호출 없이 mock 처리한다.
- config/credentials는 테스트 전용 임시 HOME 또는 path mock을 사용한다.

## 49번 최종 검증 반영 기준

회귀 검증 중 다음 항목은 즉시 문제로 기록한다.

- 3차 옵션이 설정 명령 실행 후 commit flow를 함께 실행하는 경우
- `--step`, `--batch` 우선순위가 저장 config보다 낮아지는 경우
- provider 설정 오류가 mock fallback으로 조용히 숨겨지는 경우
- confirm 없이 commit, push, reset이 실행되는 경우
- reset이 `HEAD~1` fallback 또는 `git reset --hard`를 사용하는 경우
- credentials 원문이 출력되는 경우

## 보안 기준

- `git reset --hard`를 테스트하거나 구현하지 않는다.
- 실제 remote로 push하지 않는다.
- 실제 API Key를 사용하지 않는다.
- secret이 포함된 config/credentials 원문을 출력하지 않는다.
- 외부 AI API로 diff를 보내는 테스트는 mock으로 대체한다.

## 완료 기준

- 1차 MVP 기능 전체가 3차 변경 이후에도 동일하게 동작한다.
- 2차 MVP 기능 전체가 3차 변경 이후에도 동일하게 동작한다.
- 회귀 테스트가 실제 사용자 Git 히스토리와 외부 네트워크를 사용하지 않는다.
- 보안 규칙 위반 가능성이 있는 회귀가 명확히 탐지된다.
