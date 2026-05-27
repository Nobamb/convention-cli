# AE. PR Title Generator Agent 구현 계획

## 작업 범위

AE 단계는 현재 변경 사항 또는 commit history를 기반으로 PR 제목을 생성하는 `generatePrTitle()` 흐름을 정의한다.

이 단계는 PR 본문 생성, PR preview, GitHub PR 생성은 담당하지 않는다. AF, AI, AH 단계가 후속으로 처리한다.

## 선행 조건

AE 단계는 AD 단계의 PR prompt 또는 안전한 변경 요약을 입력으로 사용할 수 있어야 한다.

- PR prompt 또는 diff summary가 준비되어 있다.
- provider routing과 AI 응답 정리 함수가 존재한다.
- Conventional Commits 허용 type 정책이 존재한다.
- secret scan과 raw diff 출력 금지 정책이 유지된다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `src/core/pr.js`
- `src/core/prPrompt.js`
- `src/core/ai.js`
- `src/utils/validator.js`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 구현 계획만 정리한다.

## 권장 함수 구조

`src/core/pr.js`에 다음 함수를 추가한다.

```js
export async function generatePrTitle({
  prompt,
  summary,
  commitLog,
  config
})
```

역할은 다음과 같다.

- PR title 전용 prompt를 구성한다.
- provider를 통해 제목 후보를 생성한다.
- AI 응답을 한 줄 제목으로 정리한다.
- 빈 응답, 과도하게 긴 제목, markdown code block을 제거한다.
- Conventional Commits 스타일을 검증한다.

## 제목 생성 규칙

PR 제목은 Conventional Commits 스타일을 우선한다.

허용 type은 다음과 같다.

- `feat`
- `fix`
- `refactor`
- `docs`
- `style`
- `test`
- `chore`

권장 제목 예시는 다음과 같다.

```txt
feat: add pull request generation flow
fix: handle GitHub remote parsing safely
docs: document PR automation command
```

규칙은 다음과 같다.

- 제목은 한 줄이어야 한다.
- markdown code block으로 감싸지 않는다.
- bullet, numbering, quote prefix를 제거한다.
- 기본 최대 길이는 72자 또는 프로젝트 template 기준을 따른다.
- 빈 응답이면 명확한 오류로 중단한다.
- 제목에 secret처럼 보이는 값이 있으면 마스킹 또는 재생성 대상으로 처리한다.

## AI 응답 정리 계획

AI 응답은 그대로 사용하지 않고 정리한다.

정리 순서는 다음과 같다.

1. 앞뒤 공백 제거
2. markdown code fence 제거
3. 첫 번째 의미 있는 줄만 선택
4. 따옴표, bullet prefix, numbering 제거
5. Conventional Commits type 검증
6. 길이 제한 검증
7. secret pattern scan

검증 실패 시 즉시 commit 또는 PR 생성으로 진행하지 않는다. 재생성 가능 여부는 AI 단계 또는 command flow에서 결정한다.

## Fallback 정책

AI provider가 실패하거나 빈 제목을 반환한 경우에도 조용히 임의 제목을 만들어 PR을 생성하지 않는다.

허용 가능한 fallback은 안전한 후보 출력까지만이다.

- commit log 첫 줄 기반 제목 후보
- changed files 기반 `chore: update project files`
- 사용자 수동 입력 요청

단, fallback 제목도 preview와 사용자 확인을 거쳐야 한다.

## 보안 기준

- raw diff를 title generator에 직접 전달하지 않는다.
- title 생성 실패 메시지에 provider raw response 전체를 출력하지 않는다.
- secret pattern이 제목에 포함되면 사용하지 않는다.
- 외부 AI 전송 전 AD 단계의 prompt 보안 정책을 유지한다.
- 제목 생성만으로 commit, push, reset, PR 생성이 실행되지 않는다.

## 완료 기준

- `generatePrTitle()`이 변경 요약 또는 commit history를 바탕으로 PR 제목을 생성한다.
- 제목은 한 줄 Conventional Commits 스타일로 정리된다.
- 빈 응답, 과도한 길이, markdown code block은 정리 또는 오류 처리된다.
- secret 값이 제목에 노출되지 않는다.
- provider 실패 시 자동 PR 생성으로 이어지지 않는다.
