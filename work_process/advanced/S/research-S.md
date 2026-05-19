# S 단계 연구 문서: Template Load Agent

## 역할

S 단계는 Template Load Agent로, 커밋 콘텐츠 템플릿을 안전하게 찾고 로드하는 `loadTemplate()` 구현 계획을 정리한다. 실제 구현 대상은 이후 단계의 `src/templates/loader.js`이며, 이 문서는 구현 기준과 경계 조건을 정의한다.

## 구현 목표

`loadTemplate()`은 프로젝트별 템플릿을 우선 적용하고, 없거나 사용할 수 없으면 사용자 홈 템플릿, 최종적으로 기본 템플릿을 반환해야 한다. 지원하지 않는 경로를 임의로 탐색하지 않고, 정해진 후보만 순서대로 검사한다.

## 로드 우선순위

1. 프로젝트 루트의 `.convention/template.json`
2. 프로젝트 루트의 `.conventionrc`
3. 사용자 홈의 `~/.config/convention/template.json`
4. 기본 템플릿

프로젝트 루트는 호출자가 명시한 `projectRoot`를 우선 사용하고, 없으면 `process.cwd()`를 사용한다. 사용자 홈 경로는 반드시 `os.homedir()`로 얻고, 모든 경로 조합은 `path.join()`을 사용한다.

## 권장 함수 형태

```js
loadTemplate(options = {})
```

권장 입력:

- `projectRoot`: 템플릿을 찾을 프로젝트 루트 경로. 없으면 `process.cwd()` 사용
- `logger`: 선택적 logger. 실패 원인은 요약만 남기고 파일 원문은 출력하지 않음

권장 출력:

```js
{
  template,
  source,
  path
}
```

- `template`: 로드된 템플릿 객체
- `source`: `project-template`, `project-rc`, `user-template`, `default` 중 하나
- `path`: 실제 파일에서 로드한 경우의 경로. 기본 템플릿이면 `null`

## 경로 처리 계획

후보 경로는 다음처럼 구성한다.

```js
const root = options.projectRoot ?? process.cwd();
const candidates = [
  {
    source: "project-template",
    path: path.join(root, ".convention", "template.json")
  },
  {
    source: "project-rc",
    path: path.join(root, ".conventionrc")
  },
  {
    source: "user-template",
    path: path.join(os.homedir(), ".config", "convention", "template.json")
  }
];
```

문자열 결합으로 `/` 또는 `\`를 직접 붙이지 않는다. 프로젝트 루트 밖의 임의 파일을 템플릿 후보로 받지 않으며, 사용자 입력으로 후보 경로 목록을 확장하지 않는다.

## 로드 절차

1. 후보 경로 배열을 우선순위대로 만든다.
2. 각 후보에 대해 파일 존재 여부를 확인한다.
3. 없으면 다음 후보로 이동한다.
4. 있으면 UTF-8로 읽고 JSON 파싱을 시도한다.
5. 파싱 성공 후 결과가 plain object인지 확인한다.
6. 배열, `null`, 문자열처럼 템플릿 객체가 아닌 JSON은 사용할 수 없는 후보로 보고 다음 후보로 이동한다.
7. 파싱 성공 시 템플릿 객체와 source 정보를 반환한다.
8. 파일 읽기 실패, JSON 파싱 실패, 비객체 JSON 발견 시 경고는 요약만 남기고 다음 후보로 이동한다.
9. 모든 후보가 실패하면 기본 템플릿을 반환한다.

## 기본 템플릿

기본 템플릿은 R 단계의 schema와 맞춰 별도 상수로 관리하는 것을 권장한다. 예시는 다음과 같다.

```json
{
  "name": "default",
  "language": "ko",
  "format": "{type}: {message}",
  "types": ["feat", "fix", "refactor", "docs", "style", "test", "chore"],
  "rules": {
    "maxLength": 72,
    "requireScope": false,
    "allowEmoji": false
  }
}
```

기본 템플릿은 파일 시스템 오류와 무관하게 항상 반환 가능해야 한다.

## 오류 및 fallback 정책

- 템플릿 파일이 없으면 정상 상황으로 보고 조용히 다음 후보를 확인한다.
- JSON 파싱 실패는 CLI 중단 사유로 만들지 않고 다음 후보로 fallback한다.
- JSON 파싱에는 성공했지만 결과가 plain object가 아니면 잘못된 템플릿 후보로 보고 다음 후보로 fallback한다.
- 파일 읽기 권한 오류도 다음 후보로 fallback한다.
- 모든 후보가 실패하면 기본 템플릿을 사용한다.
- fallback 로그에는 파일 경로와 요약 사유만 남기고 템플릿 원문, diff 원문, secret 후보 값은 출력하지 않는다.

## 보안 고려사항

- 홈 디렉터리 전체를 스캔하지 않는다.
- 프로젝트 루트와 정해진 사용자 설정 경로 외 파일을 읽지 않는다.
- `.env`, credentials, private key 같은 파일을 템플릿 후보로 취급하지 않는다.
- 템플릿 파일 내용 전체를 로그로 출력하지 않는다.
- JSON 파싱 오류 메시지에 원문 조각이 포함될 수 있으므로 사용자 출력에는 일반화된 메시지를 사용한다.
- 외부 네트워크 호출은 필요하지 않다.

## 다음 단계 연결

T 단계 Template Validation Agent가 `loadTemplate()`의 반환값을 검증한다. 따라서 S 단계는 schema 세부 검증을 깊게 수행하지 않고, JSON 객체 로드와 안전한 fallback 책임에 집중한다.
