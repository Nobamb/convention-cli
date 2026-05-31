# AP. GitHub Actions Output Agent 구현 계획

## 작업 범위

AP 단계는 GitHub Actions에서 다음 step이 사용할 수 있도록 convention 결과를 output으로 기록하는 유틸리티를 구현하는 작업이다.

대상 output은 `commit_message`, `pr_title`, `pr_body`를 우선한다. GitHub Actions의 `$GITHUB_OUTPUT` 파일에 안전하게 기록하며, multiline output과 secret masking에 주의해야 한다.

## 선행 조건

- AN 단계의 GitHub Actions 감지가 존재한다.
- AO 단계의 non-interactive mode가 존재한다.
- commit message 또는 PR title/body 생성 흐름이 존재한다.
- logger redaction 또는 secret masking 정책이 존재한다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `src/utils/githubActions.js`
- `src/commands/commit.js`
- `src/commands/pr.js`
- `src/utils/logger.js`
- `tests/github-actions-output.test.js`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 구현 계획만 정리한다.

## 권장 함수 구조

`src/utils/githubActions.js`를 새로 만들고 다음 함수를 제공한다.

```js
export function isGitHubOutputAvailable(env = process.env)
export function setOutput(name, value, options = {})
export function setOutputs(outputs, options = {})
```

권장 동작:

1. `GITHUB_OUTPUT` 환경변수가 없으면 파일 기록을 skip한다.
2. output name은 안전한 key 형식만 허용한다.
3. value는 문자열로 변환하되 `null`과 `undefined`는 빈 값으로 처리하지 말고 호출부에서 판단한다.
4. multiline value는 delimiter 형식으로 기록한다.
5. delimiter는 value에 포함되지 않는 랜덤 또는 충분히 고유한 문자열을 사용한다.
6. 파일 append는 `fs.appendFileSync` 또는 async append를 사용하되 경로는 env가 제공한 파일만 사용한다.

## GitHub Actions output 형식

단일 라인:

```text
commit_message=feat: add login flow
```

multiline:

```text
pr_body<<CONVENTION_OUTPUT_xxx
## Summary
...
CONVENTION_OUTPUT_xxx
```

PR body는 multiline 가능성이 높으므로 기본적으로 delimiter 형식을 사용한다.

## 연결 계획

commit flow:

- commit message 생성 후 `commit_message` output 기록
- 실제 commit 실행 여부와 별개로 print-only 또는 CI dry-run 정책에 따라 기록 가능
- 빈 message는 output으로 기록하지 않는다

PR flow:

- PR title 생성 후 `pr_title` output 기록
- PR body 생성 후 `pr_body` output 기록
- `--print-only`에서도 output 기록 가능

## output name 정책

허용 output:

- `commit_message`
- `pr_title`
- `pr_body`

확장 후보:

- `has_changes`
- `provider`
- `mode`
- `changed_files_count`

초기 구현에서는 prompt.md에 명시된 3개 output만 다룬다.

## 보안 기준

- output에 secret이 포함되지 않도록 기록 전 redaction을 적용한다.
- GitHub Actions의 `::add-mask::` 안내 또는 logger masking과 함께 사용한다.
- diff 원문을 output으로 기록하지 않는다.
- provider raw response 전체를 output으로 기록하지 않는다.
- `$GITHUB_OUTPUT` 경로를 로그로 출력하지 않는다.
- 환경변수 전체를 출력하지 않는다.

## 실패 처리 기준

output 기록 실패는 기본 기능 실패로 처리하지 않는 것이 권장된다.

정책:

- output 파일이 없으면 skip
- 파일 append 실패 시 warn만 출력
- output name이 잘못되면 호출부 개발 오류로 throw 가능
- value에 secret 의심 패턴이 있으면 redaction 후 기록하거나 기록을 거부한다

## 완료 기준

- `setOutput()`이 GitHub Actions output 파일에 값을 기록한다.
- multiline output이 안전하게 기록된다.
- `commit_message`, `pr_title`, `pr_body`가 CI에서 다음 step으로 전달 가능하다.
- output 기록 실패가 commit/pr 기본 흐름을 깨지 않는다.
- output에 secret, token, diff 원문이 노출되지 않는다.
