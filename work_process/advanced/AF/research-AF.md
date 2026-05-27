# AF. PR Body Generator Agent 구현 계획

## 작업 범위

AF 단계는 변경 요약, commit log, 테스트 결과, 변경 파일 목록을 기반으로 markdown PR 본문을 생성하는 `generatePrBody()` 흐름을 정의한다.

이 단계는 PR 제목 생성과 GitHub PR 생성은 담당하지 않는다. AE와 AH 단계가 각각 담당한다.

## 선행 조건

AF 단계는 AD 단계의 PR prompt 또는 안전한 변경 요약을 입력으로 사용한다.

- raw diff 대신 diff summary를 사용한다.
- secret scan 결과가 준비되어 있다.
- 실행한 테스트 명령 목록을 전달할 수 있다.
- PR template이 있으면 template 구조를 사용할 수 있다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `src/core/pr.js`
- `src/core/prPrompt.js`
- `src/core/security.js`
- `src/utils/validator.js`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 구현 계획만 정리한다.

## 권장 함수 구조

`src/core/pr.js`에 다음 함수를 추가한다.

```js
export async function generatePrBody({
  prompt,
  summary,
  changedFiles,
  commitLog,
  tests,
  securitySummary,
  config
})
```

반환값은 markdown 문자열이다.

## 기본 PR 본문 구조

기본 본문은 다음 섹션을 포함한다.

```md
## Summary

- ...

## Changes

- ...

## Tests

- ...
```

테스트를 실행하지 않은 경우에는 거짓으로 통과했다고 쓰지 않는다.

```md
## Tests

- Not run (reason: ...)
```

프로젝트 PR template이 있으면 template 구조를 우선하되, `Summary`, `Changes`, `Tests`에 해당하는 정보가 빠지지 않도록 한다.

## Security Scan 반영 계획

PR 본문 생성 전후로 secret scan을 수행한다.

반영 규칙은 다음과 같다.

- secret 감지 결과가 있으면 원문 값 대신 `[REDACTED]`를 사용한다.
- 민감 파일명은 필요 시 언급할 수 있으나 파일 내용은 포함하지 않는다.
- token, API Key, password, private key 원문은 본문에 들어가지 않는다.
- provider raw response를 그대로 본문에 넣지 않는다.
- GitHub remote URL에 credential이 포함되면 credential 부분을 제거한다.

## AI 응답 정리 계획

AI가 생성한 PR 본문은 다음 기준으로 정리한다.

1. markdown code fence로 전체가 감싸져 있으면 제거한다.
2. 빈 본문이면 오류로 처리한다.
3. `Summary`, `Changes`, `Tests` 섹션 누락 시 보정하거나 오류로 처리한다.
4. secret scan을 다시 수행한다.
5. 과도하게 긴 본문은 요약하거나 preview 단계에서 사용자에게 표시한다.

## 테스트 결과 입력 정책

테스트 결과는 실제 실행 결과 또는 호출자가 전달한 목록만 사용한다.

허용 예시는 다음과 같다.

- `npm test`
- `node --test`
- `node bin/convention.js --help`

테스트를 실행하지 않았으면 "Not run"으로 표시하고 이유를 함께 적는다. AI가 임의로 테스트 실행 사실을 꾸미지 않도록 prompt에 명시한다.

## 오류 처리 계획

- 변경 요약 없음: 본문 생성 불가 오류
- provider 빈 응답: 본문 생성 실패
- secret scan 실패: 본문 출력 및 PR 생성 중단
- template 불일치: 기본 구조로 fallback
- 테스트 결과 없음: Not run 섹션으로 안전하게 표시

오류 발생 시 commit, push, reset, PR 생성은 자동 실행하지 않는다.

## 완료 기준

- `generatePrBody()`가 markdown PR 본문을 생성한다.
- 본문에는 `Summary`, `Changes`, `Tests` 섹션이 포함된다.
- 실행하지 않은 테스트는 실행했다고 표시하지 않는다.
- secret scan 결과가 반영되고 token 원문이 포함되지 않는다.
- raw diff와 provider raw response가 본문에 그대로 들어가지 않는다.
