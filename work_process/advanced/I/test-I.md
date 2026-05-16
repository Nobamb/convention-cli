# Phase 2 / I Diff Chunking Agent Test

`research-I.md` 기준으로 `chunkDiff()`가 large diff를 파일 단위와 line 단위 chunk로 안전하게 나누고, metadata와 보안 기준을 지키는지 검증합니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :-- | :-- | :-- |
| I-V-1 | `chunkDiff()` 존재 | `src/core/diff.js` 확인 | large diff chunking을 담당하는 함수가 export된다. |
| I-V-2 | 파일 단위 chunk 기준 | 구현 확인 | `getFileDiffs()` 결과의 파일 순서를 유지해 chunk를 만든다. |
| I-V-3 | oversized file 분할 | 구현 확인 | 큰 단일 파일 diff는 line 기준으로 여러 chunk가 된다. |
| I-V-4 | metadata 포함 | 반환 객체 확인 | `index`, `file`, `part`, `totalParts`, line/character count가 포함된다. |
| I-V-5 | 빈 chunk 제거 | 구현 확인 | 빈 diff와 공백-only diff가 반환 배열에 포함되지 않는다. |
| I-V-6 | raw diff logging 금지 | logger 호출 확인 | diff 원문이나 chunk diff 원문을 로그로 출력하지 않는다. |

## 2. 기능 테스트 항목

### I-T-1: 파일 단위 chunk 생성

- **준비:** 크기 기준을 넘지 않는 파일 diff 3개를 입력한다.
- **실행:** `chunkDiff(fileDiffs, options)`를 호출한다.
- **예상 결과:** 파일 3개가 각각 chunk 1개로 반환되고, 입력 파일 순서가 유지된다.

### I-T-2: oversized file line splitting

- **준비:** 한 파일의 diff가 `maxChunkLines` 또는 `maxChunkCharacters`를 초과하도록 만든다.
- **실행:** `chunkDiff()`를 호출한다.
- **예상 결과:** 같은 `file` metadata를 가진 여러 `file-part` chunk가 생성되고, `part`가 1부터 순서대로 증가한다.

### I-T-3: metadata와 index ordering

- **준비:** 일반 파일 diff 1개, oversized 파일 diff 1개, 일반 파일 diff 1개를 순서대로 입력한다.
- **실행:** `chunkDiff()`를 호출한다.
- **예상 결과:** 전체 `index`는 1부터 연속 증가하고, oversized 파일의 `totalParts`가 모든 part에 동일하게 기록된다.

### I-T-4: empty chunk 제거

- **준비:** `diff: ""`, `diff: "   \n"`, 정상 diff를 함께 입력한다.
- **실행:** `chunkDiff()`를 호출한다.
- **예상 결과:** 정상 diff chunk만 반환되고 빈 diff 입력은 결과에서 제외된다.

### I-T-5: 한글 파일명 보존

- **준비:** `file: "문서/사용자 설정.md"`인 diff를 입력한다.
- **실행:** `chunkDiff()`를 호출한다.
- **예상 결과:** 반환 chunk의 `file`과 `files` metadata에 한글 파일명이 그대로 유지된다.

### I-T-6: 공백 포함 파일명 보존

- **준비:** `file: "src/pages/Login Form.jsx"`인 diff를 입력한다.
- **실행:** `chunkDiff()`를 호출한다.
- **예상 결과:** 공백이 포함된 파일명이 escape 또는 split되지 않고 그대로 유지된다.

### I-T-7: large diff stability

- **준비:** 수십 개 파일과 수천 line 규모의 synthetic diff를 만든다.
- **실행:** `chunkDiff()`를 호출한다.
- **예상 결과:** 함수가 예외 없이 종료되고, 각 chunk가 설정된 line/character 기준을 크게 초과하지 않는다.

### I-T-8: security logging

- **준비:** diff 안에 `API_KEY=`, `SECRET=`, `TOKEN=`, `PASSWORD=`, `PRIVATE_KEY` 같은 secret 후보 문자열을 포함한다.
- **실행:** logger를 spy/mock한 상태에서 `chunkDiff()`를 호출한다.
- **예상 결과:** logger 호출에 diff 원문이나 secret 후보 값이 포함되지 않는다.

### I-T-9: input validation

- **준비:** `null`, `undefined`, 배열이 아닌 값, `file` 또는 `diff`가 없는 객체를 입력한다.
- **실행:** `chunkDiff()`를 호출한다.
- **예상 결과:** 안전한 빈 배열을 반환하거나 명확한 validation error를 발생시키며, diff 원문을 출력하지 않는다.

## 3. 테스트 절차

1. `chunkDiff()` unit test는 Git 명령 없이 synthetic `fileDiffs` 입력으로 작성한다.
2. line splitting 기준은 테스트에서 작게 설정해 oversized 조건을 빠르게 만든다.
3. 한글/공백 파일명은 Windows/macOS/Linux 모두에서 path 문자열로만 검증한다.
4. logger spy를 사용해 raw diff와 secret 후보가 출력되지 않는지 확인한다.
5. 기존 large diff detector 테스트와 함께 실행해 Phase H에서 Phase I로 이어지는 입력 계약을 확인한다.

## 4. 검증 결과 요약

- **모든 항목 통과 시:** large diff가 Phase J chunk summary에 전달 가능한 안정적인 chunk 배열로 변환됨.
- **실패 항목 존재 시:** index 재부여, line splitting 기준, 빈 chunk 제거, raw diff logging 차단을 우선 수정한다.
