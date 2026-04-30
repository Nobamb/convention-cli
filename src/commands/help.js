import chalk from 'chalk';

/**
 * convention --help 실행 시 출력될 커스텀 도움말을 관리합니다.
 */
export const printHelp = () => {
  const helpText = `
${chalk.bold.cyan('AI 에이전트를 활용한 지능형 Git 커밋 & 워크플로우 자동화 툴 🚀')}

${chalk.yellow('Usage:')}
  convention [options]

${chalk.yellow('Options:')}
  --step            변경된 파일들을 하나씩 확인하며 커밋을 진행합니다.
  --batch           모든 변경 사항을 분석하여 하나의 통합 커밋을 생성합니다.
  --set-mode <mode> 기본 실행 모드를 설정합니다. (사용 가능 값: step, batch)
  --language <lang> 커밋 메시지 생성 언어를 설정합니다. (사용 가능 값: ko, en, jp, cn)
  --help, -h        도움말을 출력합니다.
  --version, -v     버전을 출력합니다.

${chalk.grey('더 자세한 내용은 README.md를 참고하거나 convention-cli 저장소를 방문해주세요.')}
`;
  console.log(helpText);
};
