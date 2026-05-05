# Phase S Prompt 생성 Agent Research

## 1. 개요

Phase S는 Git diff와 사용자 설정값을 바탕으로 AI Provider에 전달할 커밋 메시지 생성 prompt를 만드는 단계입니다. 구현 대상은 `src/core/prompt.js`의 `buildCommitPrompt({ diff, language, mode })`이며, 이 함수는 Conventional Commits 형식의 커밋 메시지만 반환하도록 AI에 명확히 지시해야 합니다.

이 단계는 실제 AI 호출을 수행하지 않습니다. diff 원문, 언어 설정, 실행 mode를 하나의 prompt 문자열로 조합하는 역할만 담당합니다.

## 2. 작업 목표

- `src/core/prompt.js`에 `buildCommitPrompt({ diff, language, mode }): string` 구현
- Conventional Commits 규칙을 prompt에 포함
- 허용 type을 `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`로 제한
- 설정된 `language`(`ko`, `en`, `jp`, `cn`)를 커밋 메시지 작성 언어 지시로 반영
- `mode`가 `step`인지 `batch`인지에 따라 diff 해석 기준을 다르게 안내
- AI가 설명, markdown, 코드블록 없이 커밋 메시지만 반환하도록 지시
- 민감 diff 취급 주의사항을 prompt 설계와 호출 흐름에 반영

## 3. 입력 계약

```javascript
buildCommitPrompt({
  diff: string,
  language: "ko" | "en" | "jp" | "cn",
  mode: "step" | "batch"
});
```

- `diff`: Git diff 문자열입니다. Phase O/P에서 민감 파일 제외와 기본 보안 gate를 통과한 값을 전달받는 것을 전제로 합니다.
- `language`: 커밋 메시지 본문 언어를 결정합니다.
- `mode`: `step`이면 단일 파일 또는 파일별 diff 기준, `batch`이면 전체 변경사항 기준으로 메시지를 만들도록 안내합니다.

## 4. Prompt 포함 조건

prompt에는 최소한 아래 내용이 포함되어야 합니다.

- Conventional Commits 형식 사용
- 허용 type 목록
- 커밋 메시지는 한 줄 또는 git commit에 바로 사용할 수 있는 간결한 문자열
- 설명, 후보 목록, markdown 코드블록, 따옴표 wrapper 금지
- diff 내용을 근거로 가장 적절한 type 선택
- 설정 언어에 맞춰 subject 작성
- `step` mode: 전달된 diff를 해당 파일 단위 변경으로 보고 구체적인 subject 작성
- `batch` mode: 전체 변경사항을 하나로 요약하는 subject 작성

## 5. 언어별 지시 기준

- `ko`: 한국어로 커밋 메시지 subject 작성
- `en`: 영어로 커밋 메시지 subject 작성
- `jp`: 일본어로 커밋 메시지 subject 작성
- `cn`: 중국어로 커밋 메시지 subject 작성

type prefix는 Conventional Commits 규칙이므로 언어와 무관하게 영어 type을 유지합니다.

예:

```text
feat: 사용자 로그인 흐름 추가
fix: handle empty config file
```

## 6. 보안 및 데이터 취급 기준

- `buildCommitPrompt`는 diff를 콘솔이나 logger에 출력하지 않습니다.
- 이 함수 안에서 `.env`, credentials, private key 내용을 별도로 읽지 않습니다.
- 민감 파일 제외와 secret masking은 Git diff 추출 단계 또는 AI 호출 전 보안 gate에서 우선 수행되어야 합니다.
- prompt 문자열에 diff를 포함하더라도, 외부 AI Provider 전송 여부는 T/V/W 단계에서 사용자 확인 정책을 따라야 합니다.

## 7. 에러 처리 기준

1차 MVP에서는 다음 기준을 권장합니다.

- `diff`가 문자열이 아니면 `TypeError`
- `diff.trim()`이 비어 있으면 빈 diff용 prompt를 반환하거나 상위 workflow에서 “변경사항 없음”으로 중단
- `language`가 지원 목록에 없으면 기본값 `ko` 또는 `DEFAULT_CONFIG.language` 사용
- `mode`가 지원 목록에 없으면 기본값 `step` 사용

상위 command flow에서 이미 validator를 거친다는 전제가 있더라도, prompt 함수는 최소한의 방어 로직을 갖는 것이 안전합니다.

## 8. 테스트 관점

- 언어별 지시가 prompt에 포함되는지 확인
- `step`과 `batch` mode별 안내 문구가 달라지는지 확인
- Conventional Commits 허용 type 목록이 포함되는지 확인
- “커밋 메시지만 반환” 조건이 포함되는지 확인
- diff 원문이 prompt에 포함되지만 console/logger로 출력되지 않는지 확인
- 빈 diff 또는 잘못된 입력이 명확히 처리되는지 확인

## 9. 다음 단계 연결

Phase S의 결과 prompt는 Phase T의 `generateCommitMessage(prompt, config)`로 전달됩니다. 이후 Phase U의 `cleanAIResponse(response)`를 거쳐 실제 `git commit -m`에 넣을 수 있는 문자열로 정리됩니다.
