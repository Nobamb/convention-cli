import chalk from 'chalk';

/**
 * convention --help 실행 시 출력할 커스텀 도움말을 관리합니다.
 */
export const printHelp = () => {
  const helpText = `
${chalk.bold.cyan('AI 에이전트를 사용하는 지능형 Git 커밋 워크플로 자동화 도구')}

${chalk.yellow('Usage:')}
  convention [options]

${chalk.yellow('Options:')}
  --step            변경된 파일들을 하나씩 확인하며 커밋을 진행합니다.
  --batch           모든 변경사항을 분석하여 하나의 통합 커밋을 생성합니다.
  --group           변경 사항을 의도(intent)와 영역에 따라 지능적으로 그룹화하여 커밋을 진행합니다.
  --set-mode <mode> 기본 실행 모드를 설정합니다. (사용 가능 값: step, batch)
  --language <lang> 커밋 메시지 생성 언어를 설정합니다. (사용 가능 값: ko, en, jp, cn)
  -q, --question    커밋 메시지 생성 후 커밋 여부를 물어볼지 설정합니다. (true, false)
  -m, --model [arg] AI Provider 및 모델 설정을 저장합니다. (예: convention -m github-copilot oauth)
  --template [act]  커밋 템플릿을 관리합니다. (사용 가능 값: init, show, validate)
  --reset           마지막 convention 실행으로 생성된 모든 커밋들을 안전하게 취소하고 작업 내역을 보존합니다.
  --pr              현재 브랜치의 변경사항을 기반으로 PR 제목/본문을 AI로 자동 생성하고 GitHub PR을 생성합니다.
  --base <branch>   PR target branch를 지정합니다. (기본값: origin 기본 브랜치, --pr 전용)
  --head <branch>   PR head branch를 지정합니다. (기본값: 현재 브랜치, --pr 전용)
  --remote <name>   우선하여 사용할 GitHub remote 이름을 지정합니다. (기본값: origin)
  --print-only      GitHub PR 생성을 건너뛰고 생성된 제목과 본문만 화면에 출력합니다. (--pr 전용)
  --yes             PR 미리보기 및 확인 단계를 건너뛰고 즉시 PR을 생성합니다. (--pr 전용)
  --draft           GitHub PR을 draft(초안) 상태로 생성합니다. (--pr 전용)
  -am, --agy-mcp    로컬 MCP(Model Context Protocol) 서버 모드로 기동합니다. (Antigravity 연동 및 연동 활성화 환경 변수 선언 필요)
  --help, -h        도움말을 출력합니다.
  --version, -v     버전을 출력합니다.

${chalk.grey('※ PR 자동화 기능(--pr)은 로컬에 gh CLI가 설치되어 있고 로그인(gh auth login)이 완료된 상태여야 원격 PR 생성이 가능합니다.')}
${chalk.grey('※ Antigravity MCP 구동 시에는 CONVENTION_EXPERIMENTAL_ANTIGRAVITY=true 환경 변수를 선언해야 합니다.')}

${chalk.grey('더 자세한 내용은 README.md를 참고하거나 convention-cli 저장소를 방문해주세요.')}
`;
  console.log(helpText);
};
