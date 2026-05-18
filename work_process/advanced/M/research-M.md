# Phase 3 / M Changed File Classifier Agent Research

## 1. 개요

Phase M은 Phase 3 파일 변경사항 자동 그룹핑의 첫 단계입니다. `src/core/git.js`에서 가져온 변경 파일 목록을 `src/core/grouping.js`에서 파일 유형별 metadata로 분류해 이후 N, O, P, Q 단계가 변경 의도 분석과 그룹 커밋 흐름을 안정적으로 진행할 수 있게 합니다.

이 단계는 Git 히스토리를 변경하지 않습니다. diff 원문을 분석하거나 출력하는 단계가 아니라, 파일 경로와 제한된 파일 metadata만 사용해 1차 분류를 수행하는 단계입니다.

## 2. 작업 목표

- 변경 파일 목록을 받아 각 파일의 `fileType` metadata를 생성합니다.
- `src/core/git.js`의 `getChangedFiles()` 결과를 입력으로 사용할 수 있게 설계합니다.
- `src/core/grouping.js`에 `classifyChangedFiles()` 또는 동등한 분류 함수를 둡니다.
- source, test, docs, config, style, dependency, generated, unknown 유형을 지원합니다. `unknown`은 근거 없는 오분류를 피하기 위한 보수적 fallback입니다.
- 경로, 확장자, 특수 파일명을 조합해 결정적이고 재현 가능한 rule 기반 분류를 제공합니다.
- raw diff, secret, token, API Key, credentials 내용을 로그에 출력하지 않습니다.
- git add, commit, reset, push 등 Git 히스토리 변경 명령을 호출하지 않습니다.

## 3. 구현 대상 파일

- `src/core/grouping.js`
  - `classifyChangedFiles(files)` 구현
  - 파일 경로 기반 분류 rule 관리
  - 분류 결과 metadata 생성
- `src/core/git.js`
  - 기존 `getChangedFiles()` 계약을 입력 소스로 사용
  - M 단계에서 수정이 필요하더라도 Git 읽기 전용 함수만 참조

M 단계 구현자는 위 파일을 실제 구현 대상으로 삼되, 현재 문서 작업 범위에서는 `work_process/advanced/M/` 아래 문서만 작성합니다.

## 4. 권장 함수 계약

```javascript
function classifyChangedFiles(files) {
  return files.map((file) => ({
    file,
    fileType: classifyFileType(file),
    reasons: getClassificationReasons(file)
  }));
}
```

권장 반환 형태:

```javascript
[
  {
    file: "src/core/git.js",
    fileType: "source",
    reasons: ["src path", "javascript extension"]
  },
  {
    file: "tests/core/git.test.js",
    fileType: "test",
    reasons: ["test path", "test filename"]
  }
]
```

`fileType`은 단일 문자열로 유지합니다. 이후 단계에서 복수 후보가 필요하면 `confidence` 또는 `secondaryTypes`를 추가할 수 있지만, Phase M의 기본 산출물은 다음 단계가 바로 사용할 수 있는 단일 대표 유형이어야 합니다. Phase N/O는 `classification.fileType` 또는 결합 metadata의 `fileType`만 참조하며, `type`/`category`라는 별도 명칭을 사용하지 않습니다.

## 5. 분류 기준

우선순위는 더 구체적인 규칙이 먼저 적용되도록 합니다.

| 우선순위 | fileType | 기준 예시 |
| :-- | :-- | :-- |
| 1 | dependency | `package.json`, `package-lock.json`, `npm-shrinkwrap.json`, `yarn.lock`, `pnpm-lock.yaml` |
| 2 | generated | `dist/`, `build/`, `coverage/`, `.next/`, `.turbo/`, `*.min.js`, generated marker가 있는 경로 |
| 3 | test | `test/`, `tests/`, `__tests__/`, `*.test.js`, `*.spec.js` |
| 4 | docs | `README.md`, `docs/`, `*.md`, `*.mdx`, `CHANGELOG.md` |
| 5 | config | `.github/`, `.vscode/`, `.npmrc`, `.gitignore`, `eslint.config.*`, `prettier.config.*`, `*.config.js`, `*.config.mjs`, `*.json` |
| 6 | style | `*.css`, `*.scss`, `*.sass`, `*.less` |
| 7 | source | `src/`, `bin/`, `lib/`, `*.js`, `*.mjs`, `*.cjs`, `*.jsx`, `*.ts`, `*.tsx` |
| 8 | unknown | 위 규칙 어디에도 맞지 않는 파일. `requiresReview: true`와 함께 반환합니다. |

동일 파일이 여러 규칙에 걸리면 위 우선순위를 따릅니다. 예를 들어 `package.json`은 JSON config가 아니라 `dependency`로 분류합니다. `tests/fixtures/package.json`처럼 테스트 fixture 성격이 명확하면 `test`를 우선할지 별도 예외를 둘 수 있으나, 그 경우 rule과 테스트를 명시해야 합니다.

## 6. git.js 연동 기준

`classifyChangedFiles()`는 Git 명령을 직접 실행하지 않는 순수 함수로 두는 것을 권장합니다. Git 변경 파일 수집은 `getChangedFiles()`가 담당하고, 분류기는 배열 입력만 처리합니다.

권장 연결 흐름:

1. `isGitRepository()`로 Git 저장소 여부 확인
2. `getChangedFiles()`로 변경 파일 목록 조회
3. 변경 파일 목록이 비어 있으면 빈 배열 반환 또는 상위 flow에서 종료
4. `classifyChangedFiles(files)`로 metadata 생성
5. 이후 N/O 단계에 분류 결과 전달

이 구조를 유지하면 분류 로직은 Git 환경 없이 unit test가 가능하고, Git wrapper는 기존 보안 규칙을 그대로 유지할 수 있습니다.

## 7. 실패 처리 기준

- `files`가 배열이 아니면 명확한 오류를 반환하거나 throw 합니다.
- 빈 배열은 정상 입력으로 보고 빈 배열을 반환합니다.
- 알 수 없는 확장자 또는 경로는 기본적으로 `source`, `config`, `docs` 중 하나로 임의 추정하지 않습니다.
- 알 수 없는 파일은 `fileType: "unknown"`, `requiresReview: true`, `reasons: ["unclassified"]`를 함께 반환합니다.
- Phase N/O는 `unknown`을 `chore` 후보 또는 사용자 확인 대상으로 처리합니다. 근거 없는 `source`, `config`, `docs` fallback은 금지합니다.

## 8. 보안 및 데이터 보호 기준

- raw diff 원문을 로그, 에러, preview에 출력하지 않습니다.
- 파일 내용, credentials, `.env`, private key 내용을 읽거나 출력하지 않습니다.
- 분류 기준은 파일 경로와 확장자 중심으로 유지합니다.
- secret 탐지를 위해 diff나 파일 내용을 읽어야 하는 작업은 M 단계 범위가 아니며, 기존 보안 gate 또는 후속 단계에서 처리합니다.
- Git 명령이 필요할 경우 `src/core/git.js`의 읽기 전용 wrapper를 사용하고 shell 문자열 조합을 사용하지 않습니다.
- `git add`, `git commit`, `git reset`, `git push`를 호출하지 않습니다.
- 테스트 목적으로 실제 사용자 저장소의 Git 히스토리를 변경하지 않습니다.

## 9. 완료 기준

- 변경 파일 목록이 `fileType` metadata 배열로 변환됩니다.
- source, test, docs, config, style, dependency, generated, unknown 분류가 모두 동작합니다.
- `getChangedFiles()` 결과와 자연스럽게 연결할 수 있습니다.
- 분류기는 raw diff나 파일 내용을 요구하지 않습니다.
- 빈 변경 목록, 알 수 없는 파일, 특수 파일명이 안전하게 처리됩니다.
- 로그와 에러 메시지에 diff 원문 또는 secret 후보 문자열이 노출되지 않습니다.
- Git 히스토리 변경 명령이 구현 또는 테스트 과정에서 실행되지 않습니다.
