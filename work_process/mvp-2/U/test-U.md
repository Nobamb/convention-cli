# Phase U --push Agent Test

`research-U.md` 기준으로 `convention --push`가 commit 완료 후 원격 저장소로 안전하게 push되는지 검증한다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| U-V-1 | CLI 옵션 등록 | `bin/convention.js` 확인 | commander에 `--push` 옵션이 등록되고 help에 표시된다. |
| U-V-2 | commit 후 push 연결 | `src/commands/commit.js` 확인 | commit 성공 이후에만 `push()`가 호출된다. |
| U-V-3 | 안전한 Git 실행 | `src/core/git.js` 확인 | `git push`가 `execFileSync` 또는 `spawnSync`의 argv 배열 방식으로 실행된다. |
| U-V-4 | 민감정보 출력 방지 | 실패 처리 로직 확인 | token, 원격 URL 인증 정보, credential 세부 정보가 그대로 출력되지 않는다. |
| U-V-5 | push 단독 정책 | CLI/command 흐름 확인 | `--push`가 commit flow 이후 push인지, push 단독 실행인지 동작이 명확하다. |

## 2. 기능 테스트 항목

### U-T-1: help 옵션 표시

- **준비:** 로컬 CLI 진입점 사용
- **실행:** `node bin/convention.js --help`
- **예상 결과:** help 출력에 `--push` 설명이 포함된다.

### U-T-2: batch commit 후 push

- **준비:** 격리된 임시 Git 저장소와 bare remote 저장소 구성, mock provider 사용, 변경 파일 1개 생성
- **실행:** `node bin/convention.js --batch --push`
- **예상 결과:** 사용자 confirm 이후 commit이 생성되고 원격 저장소에 해당 commit이 push된다.

### U-T-3: 기본 mode commit 후 push

- **준비:** 격리된 HOME에 `mode: "batch"` 또는 `mode: "step"` 설정, 임시 Git 저장소와 remote 구성
- **실행:** `node bin/convention.js --push`
- **예상 결과:** 저장된 mode에 따라 commit이 완료된 뒤 push가 실행된다.

### U-T-4: commit 취소 시 push 미실행

- **준비:** 격리된 임시 Git 저장소와 remote 구성, confirm prompt에서 No 선택
- **실행:** `node bin/convention.js --push`
- **예상 결과:** commit이 생성되지 않고 push도 실행되지 않는다.

### U-T-5: remote 없음 실패 처리

- **준비:** 격리된 임시 Git 저장소에 remote를 설정하지 않음
- **실행:** `node bin/convention.js --batch --push`
- **예상 결과:** commit 성공 후 push 단계에서 안전한 실패 메시지를 출력하고 token 또는 remote 인증 정보는 출력하지 않는다.

### U-T-6: 인증 실패 출력 sanitize

- **준비:** 인증 실패를 반환하는 fake remote 또는 `git push` mock 구성
- **실행:** `push()` 호출
- **예상 결과:** 실패 메시지는 원인을 요약하되 access token, username/password 포함 URL, credential helper 세부 정보를 그대로 노출하지 않는다.

### U-T-7: branch 안내

- **준비:** 격리된 임시 Git 저장소에서 현재 branch와 upstream 상태를 다르게 구성
- **실행:** `node bin/convention.js --batch --push`
- **예상 결과:** 가능한 경우 현재 branch 또는 upstream 상태를 안내하고, 정보 확인 실패가 push 자체를 방해하지 않는다.

## 3. 테스트 절차

1. 임시 디렉터리에 Git 저장소와 bare remote 저장소를 생성한다.
2. 격리된 HOME 또는 config path mock을 사용해 실제 사용자 config/credentials를 건드리지 않는다.
3. mock provider로 commit message를 고정한다.
4. `--batch --push`, `--step --push`, `--push`를 각각 실행한다.
5. remote 저장소의 HEAD 또는 log를 확인해 push 여부를 검증한다.
6. 실패 케이스에서는 출력 메시지에 secret, token, 인증 포함 URL이 없는지 확인한다.

## 4. 검증 결과 요약

- **모든 항목 통과 시:** `convention --push`가 commit 성공 후 안전하게 push를 실행하며 실패 시 민감정보를 노출하지 않는다.
- **실패 항목 존재 시:** CLI routing, commit 성공/취소 분기, `push()`의 argv 배열 실행, 실패 메시지 sanitize를 우선 점검한다.
