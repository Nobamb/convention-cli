# Phase U AI 응답 정리 Agent Test

`research-U.md`의 구현 기준을 바탕으로 `cleanAIResponse(response)`가 1차 MVP 요구사항을 충족하는지 확인하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| V-1 | 함수 export 확인 | `src/core/ai.js` 확인 | `cleanAIResponse`를 import할 수 있다. |
| V-2 | 문자열 입력 검증 | 코드 확인 | 비문자열 입력을 거부한다. |
| V-3 | trim 처리 확인 | 코드 확인 | 앞뒤 공백 제거 로직이 있다. |
| V-4 | markdown 코드블록 제거 확인 | 코드 확인 | fence 제거 로직이 있다. |
| V-5 | 따옴표 wrapper 제거 확인 | 코드 확인 | 바깥쪽 quote/backtick 제거 로직이 있다. |
| V-6 | 빈 응답 에러 확인 | 코드 확인 | 정리 후 빈 문자열이면 에러를 던진다. |
| V-7 | raw response 로그 금지 | console/logger 검사 | AI 원문 응답을 출력하지 않는다. |

## 2. 기능 테스트 항목

### T-1: 일반 응답
- **준비:** `feat: add user login`
- **실행:** `cleanAIResponse(response)`
- **예상 결과:** `feat: add user login`

### T-2: 앞뒤 공백 제거
- **준비:** `"  fix: handle empty config  \n"`
- **실행:** `cleanAIResponse(response)`
- **예상 결과:** `fix: handle empty config`

### T-3: markdown text 코드블록 제거
- **준비:** ```` ```text\nchore: update project files\n``` ````
- **실행:** `cleanAIResponse(response)`
- **예상 결과:** `chore: update project files`

### T-4: markdown commit 코드블록 제거
- **준비:** ```` ```commit\nfeat: add prompt builder\n``` ````
- **실행:** `cleanAIResponse(response)`
- **예상 결과:** `feat: add prompt builder`

### T-5: 큰따옴표 wrapper 제거
- **준비:** `"docs: update README usage"`
- **실행:** `cleanAIResponse(response)`
- **예상 결과:** `docs: update README usage`

### T-6: 작은따옴표 wrapper 제거
- **준비:** `'test: add ai response cleanup tests'`
- **실행:** `cleanAIResponse(response)`
- **예상 결과:** `test: add ai response cleanup tests`

### T-7: 백틱 wrapper 제거
- **준비:** `` `refactor: simplify provider routing` ``
- **실행:** `cleanAIResponse(response)`
- **예상 결과:** `refactor: simplify provider routing`

### T-8: 여러 줄 응답에서 유효 라인 선택
- **준비:** `Here is the commit message:\nfeat: add mock provider`
- **실행:** `cleanAIResponse(response)`
- **예상 결과:** `feat: add mock provider`

### T-9: 여러 후보 중 첫 번째 유효 라인 선택
- **준비:** `fix: handle empty prompt\nchore: update tests`
- **실행:** `cleanAIResponse(response)`
- **예상 결과:** `fix: handle empty prompt`

### T-10: 빈 응답 에러
- **준비:** `""`, `"   "`, ```` "```text\n\n```" ````
- **실행:** 각각 `cleanAIResponse(response)` 호출
- **예상 결과:** Error가 발생한다.

### T-11: 비문자열 입력 에러
- **준비:** `null`, `undefined`, `{}`, `[]`
- **실행:** 각각 `cleanAIResponse(value)` 호출
- **예상 결과:** TypeError가 발생한다.

### T-12: raw response 미출력
- **준비:** response에 `SECRET=should-not-log`를 포함하고 console/logger를 spy 처리한다.
- **실행:** `cleanAIResponse(response)` 호출
- **예상 결과:** 함수가 반환하거나 에러를 던지더라도 raw response가 console/logger에 출력되지 않는다.

## 3. 테스트 절차

1. `src/core/ai.js`에서 `cleanAIResponse`를 import한다.
2. 일반 응답, 코드블록 응답, 따옴표 응답, 여러 줄 응답을 준비한다.
3. 각 응답을 함수에 전달하고 반환 문자열을 확인한다.
4. 빈 응답과 비문자열 입력에서 에러가 발생하는지 확인한다.
5. console/logger spy를 통해 raw response 출력이 없는지 검증한다.

## 4. 테스트 환경 주의사항

- AI Provider를 실제 호출하지 않고 순수 문자열 함수로 테스트한다.
- Git 저장소나 config 파일이 없어도 테스트 가능해야 한다.
- 응답 원문에 민감 정보처럼 보이는 문자열이 있어도 로그로 출력하지 않아야 한다.

## 5. 검증 결과 요약

- **모든 항목 통과 시:** Phase U 완료 및 V/W commit workflow 진입 가능
- **실패 항목 존재 시:** 코드블록 제거, quote 제거, 여러 줄 선택 기준, 빈 응답 에러 처리를 우선 점검한다.
