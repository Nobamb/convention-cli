# S 단계 테스트 문서: Template Load Agent

## 테스트 목표

`loadTemplate()`이 정해진 우선순위대로 템플릿을 로드하고, 파일 누락이나 잘못된 JSON이 있어도 CLI를 중단하지 않으며, 민감 정보와 파일 원문을 로그로 출력하지 않는지 확인한다.

## 테스트 전제

- 테스트는 실제 사용자 저장소가 아닌 임시 디렉터리 또는 `fixtures/test-repo`에서 수행한다.
- 사용자 홈 경로는 테스트에서 mock 처리하거나 임시 홈 디렉터리로 격리한다.
- 경로 구성 검증은 `path.join()`과 `os.homedir()` 기준으로 확인한다.
- 네트워크 호출, Git commit, push, reset은 수행하지 않는다.

## 우선순위 테스트

1. 프로젝트 루트 `.convention/template.json`과 `.conventionrc`, 사용자 홈 템플릿이 모두 있을 때 `.convention/template.json`이 선택되는지 확인한다.
2. `.convention/template.json`이 없고 `.conventionrc`와 사용자 홈 템플릿이 있을 때 `.conventionrc`가 선택되는지 확인한다.
3. 프로젝트 템플릿 두 개가 없고 사용자 홈 `~/.config/convention/template.json`만 있을 때 사용자 홈 템플릿이 선택되는지 확인한다.
4. 세 파일이 모두 없을 때 기본 템플릿이 반환되는지 확인한다.
5. 반환값의 `source`가 각각 `project-template`, `project-rc`, `user-template`, `default`로 구분되는지 확인한다.

## 누락 파일 테스트

1. `.convention` 디렉터리 자체가 없어도 예외 없이 다음 후보로 넘어가는지 확인한다.
2. `.convention/template.json`만 누락된 경우 `.conventionrc` 확인이 계속되는지 확인한다.
3. 사용자 홈 `.config/convention` 디렉터리가 없어도 기본 템플릿으로 fallback되는지 확인한다.
4. 모든 후보 파일이 없을 때 오류 로그를 남발하지 않고 기본 템플릿을 반환하는지 확인한다.

## 잘못된 JSON fallback 테스트

1. `.convention/template.json`이 invalid JSON이고 `.conventionrc`가 valid JSON이면 `.conventionrc`로 fallback되는지 확인한다.
2. `.convention/template.json`과 `.conventionrc`가 invalid JSON이고 사용자 홈 템플릿이 valid JSON이면 사용자 홈 템플릿으로 fallback되는지 확인한다.
3. 모든 후보 파일이 invalid JSON이면 기본 템플릿을 반환하는지 확인한다.
4. invalid JSON 오류가 발생해도 파일 원문 일부가 로그에 포함되지 않는지 확인한다.
5. 빈 파일, 공백만 있는 파일, JSON 배열, `null`, 문자열 같은 비객체 JSON은 사용할 수 없는 후보로 처리하고 다음 후보 또는 기본 템플릿으로 fallback되는지 확인한다.

## 경로 안전성 테스트

1. 후보 경로가 `path.join(projectRoot, ".convention", "template.json")` 형태로 만들어지는지 확인한다.
2. 후보 경로가 `path.join(projectRoot, ".conventionrc")` 형태로 만들어지는지 확인한다.
3. 사용자 홈 후보가 `path.join(os.homedir(), ".config", "convention", "template.json")` 형태로 만들어지는지 확인한다.
4. 문자열 결합으로 `/` 또는 `\`를 직접 붙이는 구현이 없는지 정적 검토한다.
5. 사용자 입력으로 `../`가 포함된 별도 템플릿 경로를 주입해도 후보 목록이 확장되지 않는지 확인한다.
6. 홈 디렉터리 전체 스캔이나 프로젝트 외부 임의 탐색이 발생하지 않는지 확인한다.

## 로그 보안 테스트

1. 템플릿 파일에 `API_KEY=sample`, `TOKEN=sample`, `PASSWORD=sample` 같은 문자열이 있어도 로그에 원문이 출력되지 않는지 확인한다.
2. invalid JSON 파일 내용이 오류 메시지에 그대로 포함되지 않는지 확인한다.
3. fallback 경고에는 source, 경로, 요약 사유만 포함되고 템플릿 원문은 포함되지 않는지 확인한다.
4. credentials 파일 경로나 secret 파일을 템플릿 후보로 읽지 않는지 확인한다.
5. diff 원문, API Key, OAuth Token, Secret이 테스트 출력에 포함되지 않는지 확인한다.

## 기본 템플릿 테스트

1. 기본 템플릿에 `name`, `language`, `format`, `types`, `rules`가 포함되는지 확인한다.
2. 기본 템플릿의 `types`에 `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`가 포함되는지 확인한다.
3. 기본 템플릿 반환 시 `path`가 `null`이고 `source`가 `default`인지 확인한다.
4. 파일 시스템 오류가 발생해도 기본 템플릿 반환이 가능한지 확인한다.

## 회귀 테스트 항목

1. 기존 config 로드와 credentials 로드 경로를 변경하지 않는지 확인한다.
2. commit flow에서 템플릿 로드 실패가 커밋 흐름 전체 실패로 이어지지 않는지 확인한다.
3. 외부 AI 호출 전 보안 Gate나 confirm 흐름을 우회하지 않는지 확인한다.
4. S 단계 구현이 T 단계 validation fallback과 충돌하지 않는지 확인한다.

## 예상 테스트 명령 후보

```bash
npm test
node tests/templates/loader.test.js
```

테스트 파일명과 명령은 실제 테스트 러너 구조에 맞춰 조정한다. 중요한 기준은 우선순위, 누락 파일, invalid JSON fallback, 경로 안전성, secret 및 raw content 로그 차단을 모두 검증하는 것이다.
