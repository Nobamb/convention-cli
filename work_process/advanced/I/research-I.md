# Phase 2 / I Diff Chunking Agent Research

## 1. 개요

Phase I는 Phase H의 large diff 감지 이후, 큰 diff를 AI가 안정적으로 처리할 수 있는 작은 단위로 나누는 단계입니다. 핵심 함수는 `chunkDiff()`이며, 파일 단위 chunk를 기본으로 만들고 너무 큰 파일 diff는 line 기준으로 다시 분할합니다. 이 단계는 이후 Phase J의 chunk summary 입력을 안정적으로 제공해야 합니다.

## 2. 작업 목표

- `chunkDiff()`를 구현해 large diff를 chunk 배열로 변환합니다.
- 기본 분할 단위는 파일별 diff입니다.
- 단일 파일 diff가 기준 크기를 초과하면 line 기준으로 여러 chunk로 나눕니다.
- 모든 chunk에 순차 `index`와 파일 metadata를 포함합니다.
- 빈 diff, 공백-only diff, 분할 과정에서 생긴 빈 chunk는 제거합니다.
- 한글 파일명과 공백이 포함된 파일명을 깨뜨리지 않고 보존합니다.
- diff 원문은 로그로 출력하지 않습니다.

## 3. 구현 범위

- `src/core/diff.js`
  - `chunkDiff(fileDiffs, options)`
  - 필요 시 내부 helper: `splitLargeFileDiff()`, `createChunkMetadata()`, `removeEmptyChunks()`
- `src/config/defaults.js`
  - large diff chunk 기준값 추가 또는 Phase H 기준값 재사용
- `src/commands/commit.js` 또는 large diff flow 연결부
  - Phase J가 사용할 수 있도록 `chunkDiff()` 결과를 전달

## 4. 입력과 출력 계약

`chunkDiff()` 입력은 `getFileDiffs(files)`의 결과를 우선 기준으로 합니다.

```javascript
chunkDiff([
  {
    file: "src/auth/login.js",
    diff: "diff --git ..."
  }
], {
  maxChunkCharacters: 12000,
  maxChunkLines: 400
});
```

권장 반환 형태는 아래와 같습니다.

```javascript
[
  {
    index: 1,
    file: "src/auth/login.js",
    files: ["src/auth/login.js"],
    chunkType: "file",
    part: 1,
    totalParts: 1,
    startLine: 1,
    endLine: 120,
    lineCount: 120,
    characterCount: 5000,
    diff: "diff --git ..."
  }
]
```

단일 파일이 여러 조각으로 나뉘는 경우 `chunkType`은 `"file-part"`로 두고, 같은 `file` 값에 대해 `part`와 `totalParts`를 순서대로 부여합니다.

## 5. 권장 구현 방향

1. `fileDiffs` 배열 순서를 유지하면서 파일별 diff를 순회합니다.
2. `diff`가 비어 있거나 `trim()` 결과가 비어 있으면 chunk 후보에서 제외합니다.
3. 파일 diff가 `maxChunkCharacters`와 `maxChunkLines` 기준 안에 있으면 파일 단위 chunk 하나를 만듭니다.
4. 기준을 초과하면 `split(/\r?\n/)`로 line 배열을 만들고, 최대 line 수와 최대 문자 수를 동시에 넘지 않는 범위로 나눕니다.
5. 각 chunk에는 원본 파일명, part 정보, line 범위, line/character count를 metadata로 넣습니다.
6. 모든 chunk 후보 생성 후 빈 chunk를 한 번 더 제거합니다.
7. 마지막에 남은 chunk 배열 기준으로 `index`를 1부터 다시 부여합니다.

line 분할 시 diff header를 보존할지 여부를 명확히 해야 합니다. 권장 방식은 첫 chunk에는 원본 header를 포함하고, 이후 chunk에는 동일 파일 metadata를 통해 파일명을 전달하는 것입니다. 이후 Phase J prompt가 metadata를 함께 사용하면 header 반복 없이도 어떤 파일의 diff인지 알 수 있습니다.

## 6. 파일명 처리 기준

- 파일명은 Git에서 받은 UTF-8 문자열을 그대로 metadata에 보존합니다.
- 한글 파일명 예: `문서/사용자 설정.md`
- 공백 파일명 예: `src/pages/Login Form.jsx`
- shell 문자열 조합을 사용하지 않고, 기존 `getFileDiffs(files)`의 안전한 argv 배열 방식 결과를 입력으로 사용합니다.
- chunk metadata 생성 과정에서 path separator나 공백을 임의로 escape하지 않습니다.

## 7. 보안 및 안정성 기준

- diff 원문, chunk diff 원문, secret 후보 문자열을 logger에 출력하지 않습니다.
- debug가 필요해도 파일명, chunk 개수, line/character count 같은 metadata만 출력합니다.
- 민감 파일 제외와 secret scan은 AI 전송 전 보안 gate와 연결되어야 하며, chunking이 이를 우회하지 않아야 합니다.
- chunking 실패 시 원본 diff 전체를 fallback으로 외부 AI에 보내지 않습니다.
- 입력이 비정상일 때는 빈 배열 또는 명확한 에러를 반환하고 commit flow가 안전하게 중단되도록 합니다.

## 8. 완료 기준

- 파일별 diff가 파일 단위 chunk로 분리됩니다.
- oversized file diff가 line 기준으로 여러 chunk로 안정적으로 분리됩니다.
- chunk index가 1부터 순서대로 부여되고, part metadata가 정확합니다.
- 빈 chunk가 반환되지 않습니다.
- 한글/공백 파일명이 metadata에 깨지지 않고 유지됩니다.
- large diff에서도 메모리 폭증 없이 예측 가능한 배열을 반환합니다.
- 로그에 diff 원문이나 secret 후보가 출력되지 않습니다.
