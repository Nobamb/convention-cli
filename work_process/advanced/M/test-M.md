# Phase 3 / M Changed File Classifier Agent Test

`research-M.md` 기준으로 변경 파일 목록이 `fileType` metadata로 안정적으로 분류되는지 검증합니다. 이 테스트는 파일 경로 중심의 rule 기반 분류를 확인하며, raw diff 출력이나 Git 히스토리 변경이 없어야 합니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :-- | :-- | :-- |
| M-V-1 | 분류 함수 존재 | `src/core/grouping.js` 확인 | `classifyChangedFiles()` 또는 동등한 함수가 존재한다. |
| M-V-2 | git.js 입력 연동 | 호출부 또는 계획 확인 | `getChangedFiles()` 결과 배열을 분류 함수 입력으로 사용할 수 있다. |
| M-V-3 | 필수 type 지원 | rule 목록 확인 | `source`, `test`, `docs`, `config`, `style`, `dependency`, `generated`를 모두 지원한다. |
| M-V-4 | 순수 함수 구조 | 함수 내부 확인 | 분류 함수가 Git 명령이나 파일 내용 읽기를 직접 수행하지 않는다. |
| M-V-5 | raw diff logging 금지 | logger/error 호출 확인 | diff 원문, secret, credentials 내용이 출력되지 않는다. |
| M-V-6 | Git 히스토리 변경 금지 | Git wrapper 호출 확인 | `git add`, `git commit`, `git reset`, `git push`가 호출되지 않는다. |

## 2. 기능 테스트 항목

### M-T-1: source 파일 분류

- **준비:** `["src/core/git.js", "bin/convention.js"]` 입력을 구성한다.
- **실행:** `classifyChangedFiles(files)`를 호출한다.
- **예상 결과:** 두 파일 모두 `fileType: "source"`로 분류되고, reasons에 source 경로나 JavaScript 확장자 근거가 포함된다.

### M-T-2: test 파일 분류

- **준비:** `["tests/core/git.test.js", "src/core/grouping.spec.js", "__tests__/commit.test.js"]` 입력을 구성한다.
- **실행:** 분류 함수를 호출한다.
- **예상 결과:** 모든 파일이 `fileType: "test"`로 분류된다.

### M-T-3: docs 파일 분류

- **준비:** `["README.md", "docs/model.md", "CHANGELOG.md", "work_process/advanced/M/research-M.md"]` 입력을 구성한다.
- **실행:** 분류 함수를 호출한다.
- **예상 결과:** 모든 파일이 `fileType: "docs"`로 분류된다.

### M-T-4: config 파일 분류

- **준비:** `[".gitignore", ".github/workflows/test.yml", "eslint.config.js", "prettier.config.mjs", "tsconfig.json"]` 입력을 구성한다.
- **실행:** 분류 함수를 호출한다.
- **예상 결과:** 모든 파일이 `fileType: "config"`로 분류된다.

### M-T-5: style 파일 분류

- **준비:** `["src/styles/app.css", "src/styles/theme.scss", "assets/main.less"]` 입력을 구성한다.
- **실행:** 분류 함수를 호출한다.
- **예상 결과:** 모든 파일이 `fileType: "style"`로 분류된다.

### M-T-6: dependency 파일 분류

- **준비:** `["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"]` 입력을 구성한다.
- **실행:** 분류 함수를 호출한다.
- **예상 결과:** 모든 파일이 `fileType: "dependency"`로 분류된다. `package.json`은 `config`가 아니라 `dependency`여야 한다.

### M-T-7: generated 파일 분류

- **준비:** `["dist/index.js", "build/app.js", "coverage/lcov.info", "src/vendor/lib.min.js"]` 입력을 구성한다.
- **실행:** 분류 함수를 호출한다.
- **예상 결과:** 모든 파일이 `fileType: "generated"`로 분류된다.

### M-T-8: 우선순위 충돌 처리

- **준비:** `["tests/fixtures/package.json", "docs/example.test.md", "dist/report.md"]` 입력을 구성한다.
- **실행:** 분류 함수를 호출한다.
- **예상 결과:** 구현 문서에 정의된 우선순위대로 일관되게 분류된다. 충돌 rule은 테스트 기대값과 코드가 동일해야 한다.

### M-T-8A: unknown fallback 처리

- **준비:** 어떤 경로/확장자 rule에도 맞지 않는 `["misc/file_without_extension"]` 입력을 구성한다.
- **실행:** 분류 함수를 호출한다.
- **예상 결과:** 파일은 임의로 `source`, `config`, `docs`로 오분류되지 않고 `fileType: "unknown"`, `requiresReview: true`, `reasons: ["unclassified"]`를 포함한다.

### M-T-9: 빈 변경 목록 처리

- **준비:** 빈 배열 `[]`을 입력한다.
- **실행:** 분류 함수를 호출한다.
- **예상 결과:** 오류 없이 빈 배열을 반환한다.

### M-T-10: 잘못된 입력 처리

- **준비:** `null`, `undefined`, 문자열, 객체를 입력한다.
- **실행:** 분류 함수를 호출한다.
- **예상 결과:** 명확한 오류를 반환하거나 throw 하며, 오류 메시지에 diff 원문 또는 파일 내용이 포함되지 않는다.

### M-T-11: 한글 및 공백 파일명 처리

- **준비:** `["docs/사용자 가이드.md", "src/한글 파일.js", "tests/공백 파일.test.js"]` 입력을 구성한다.
- **실행:** 분류 함수를 호출한다.
- **예상 결과:** 파일명이 깨지지 않고 각각 `docs`, `source`, `test`로 분류된다.

### M-T-12: getChangedFiles 결과 연동

- **준비:** 격리된 임시 Git 저장소 또는 mock으로 `getChangedFiles()`가 `["src/core/grouping.js", "README.md"]`를 반환하게 한다.
- **실행:** 반환값을 `classifyChangedFiles()`에 전달한다.
- **예상 결과:** `src/core/grouping.js`는 `source`, `README.md`는 `docs`로 분류된다.

### M-T-13: raw diff 및 secret logging 방지

- **준비:** 파일명 배열에는 안전한 경로만 넣고, 테스트 spy로 stdout, stderr, logger 호출 인자를 감시한다.
- **실행:** 분류 성공과 실패 케이스를 모두 실행한다.
- **예상 결과:** `API_KEY=`, `SECRET=`, `TOKEN=`, `PASSWORD=`, `PRIVATE_KEY`, `DATABASE_URL`, `AWS_ACCESS_KEY_ID`, `-----BEGIN PRIVATE KEY-----` 같은 secret 후보 문자열과 raw diff 원문이 출력되지 않는다.

### M-T-14: Git 히스토리 변경 없음

- **준비:** Git wrapper 또는 child process 호출을 spy 처리한다.
- **실행:** 변경 파일 분류 flow를 실행한다.
- **예상 결과:** `git status` 또는 기존 `getChangedFiles()` 같은 읽기 동작만 허용되고, `git add`, `git commit`, `git reset`, `git push`는 호출되지 않는다.

## 3. 테스트 절차

1. `classifyChangedFiles()`를 unit test에서 직접 호출해 rule별 분류를 검증한다.
2. `getChangedFiles()`는 실제 사용자 저장소 대신 mock 또는 격리된 임시 Git 저장소를 사용한다.
3. stdout, stderr, logger spy를 사용해 diff 원문과 secret 후보 문자열이 출력되지 않는지 확인한다.
4. Git 명령 spy를 사용해 히스토리 변경 명령이 호출되지 않는지 확인한다.
5. 기존 회귀 테스트인 `npm test`를 함께 실행한다.

## 4. 검증 결과 요약

- **모든 항목 통과 시:** 변경 파일 분류 metadata가 후속 grouping 단계에서 사용할 수 있는 형태로 생성되며, raw diff/secret logging과 Git 히스토리 변경 없이 안전하게 동작한다.
- **실패 항목 존재 시:** 분류 우선순위, 잘못된 입력 처리, 보안 출력, Git 히스토리 변경 가능성을 우선 수정한다.
