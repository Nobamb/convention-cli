# Phase S Prompt 생성 Agent Test

`research-S.md`의 구현 기준을 바탕으로 `buildCommitPrompt({ diff, language, mode })`가 1차 MVP 요구사항을 충족하는지 확인하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| V-1 | 함수 export 확인 | `src/core/prompt.js` 확인 | `buildCommitPrompt`를 import할 수 있다. |
| V-2 | Conventional Commits 규칙 포함 | 반환 prompt 문자열 검사 | `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`가 포함된다. |
| V-3 | 커밋 메시지만 반환 조건 포함 | 반환 prompt 문자열 검사 | 설명, markdown, 후보 목록 없이 메시지만 반환하라는 지시가 포함된다. |
| V-4 | 언어 설정 반영 | `language`별 prompt 검사 | `ko`, `en`, `jp`, `cn` 각각의 작성 언어 지시가 포함된다. |
| V-5 | mode 설정 반영 | `step`/`batch` prompt 비교 | 파일별 diff와 전체 diff 기준 안내가 구분된다. |
| V-6 | raw diff 로그 금지 | console/logger spy | diff 원문이 출력되지 않는다. |

## 2. 기능 테스트 항목

### T-1: 한국어 prompt 생성
- **준비:** `diff`에 간단한 JS 변경 diff를 전달한다.
- **실행:** `buildCommitPrompt({ diff, language: "ko", mode: "batch" })`
- **예상 결과:** 한국어 커밋 메시지를 작성하라는 지시와 Conventional Commits 조건이 포함된다.

### T-2: 영어 prompt 생성
- **준비:** 동일한 diff를 사용한다.
- **실행:** `buildCommitPrompt({ diff, language: "en", mode: "batch" })`
- **예상 결과:** 영어 커밋 메시지를 작성하라는 지시가 포함된다.

### T-3: 일본어 prompt 생성
- **준비:** 동일한 diff를 사용한다.
- **실행:** `buildCommitPrompt({ diff, language: "jp", mode: "batch" })`
- **예상 결과:** 일본어 커밋 메시지를 작성하라는 지시가 포함된다.

### T-4: 중국어 prompt 생성
- **준비:** 동일한 diff를 사용한다.
- **실행:** `buildCommitPrompt({ diff, language: "cn", mode: "batch" })`
- **예상 결과:** 중국어 커밋 메시지를 작성하라는 지시가 포함된다.

### T-5: step mode prompt
- **준비:** 단일 파일 diff를 전달한다.
- **실행:** `buildCommitPrompt({ diff, language: "ko", mode: "step" })`
- **예상 결과:** 파일별 변경사항을 기준으로 구체적인 커밋 메시지를 만들라는 지시가 포함된다.

### T-6: batch mode prompt
- **준비:** 여러 파일이 포함된 전체 diff를 전달한다.
- **실행:** `buildCommitPrompt({ diff, language: "ko", mode: "batch" })`
- **예상 결과:** 전체 변경사항을 하나로 요약하라는 지시가 포함된다.

### T-7: 빈 diff 처리
- **준비:** `diff`를 빈 문자열로 전달한다.
- **실행:** `buildCommitPrompt({ diff: "", language: "ko", mode: "batch" })`
- **예상 결과:** 구현 정책에 따라 TypeError를 던지거나, 상위 workflow가 변경사항 없음으로 판단할 수 있는 명확한 prompt를 반환한다.

### T-8: Conventional Commits type 제한
- **준비:** 정상 diff를 전달한다.
- **실행:** prompt 문자열을 검사한다.
- **예상 결과:** 허용 type 목록이 명확히 포함되고, 그 외 type을 사용하지 말라는 지시가 포함된다.

### T-9: 커밋 메시지만 반환 조건
- **준비:** 정상 diff를 전달한다.
- **실행:** prompt 문자열을 검사한다.
- **예상 결과:** 설명문, 코드블록, 따옴표, markdown 없이 최종 커밋 메시지만 반환하라는 조건이 포함된다.

### T-10: diff 원문 미출력
- **준비:** `console.log`, `console.error`, logger 함수를 spy 처리한다.
- **실행:** 민감하지 않은 diff로 `buildCommitPrompt`를 호출한다.
- **예상 결과:** 반환값에 diff는 포함될 수 있지만, console/logger에는 diff가 출력되지 않는다.

## 3. 테스트 절차

1. `src/core/prompt.js`에서 `buildCommitPrompt`를 import한다.
2. 테스트용 diff 문자열을 준비한다.
3. 언어별, mode별로 함수를 호출한다.
4. 반환 prompt에 필수 지시문과 diff 내용이 포함되는지 검사한다.
5. console/logger spy로 raw diff 출력이 없는지 확인한다.
6. 잘못된 입력과 빈 diff 처리 정책을 확인한다.

## 4. 검증 결과 요약

- **모든 항목 통과 시:** Phase S 완료 및 Phase T AI 호출 Agent 진입 가능
- **실패 항목 존재 시:** 언어 지시, mode 지시, Conventional Commits 조건, raw diff 출력 여부를 우선 점검한다.
