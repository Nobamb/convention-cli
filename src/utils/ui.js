import prompts from 'prompts';

/**
 * 커밋 직전에 사용자에게 최종 승인 여부를 묻는 공통 UI 함수입니다.
 *
 * 1차 MVP의 핵심 보안 규칙은 "AI가 커밋 메시지를 만들었더라도 사용자가 확인하기 전에는
 * git commit을 실행하지 않는다"입니다. commit command는 이 함수를 통해 승인 여부만 받고,
 * 실제 Git 조작은 command 계층에서 승인 결과를 확인한 뒤 수행합니다.
 *
 * 테스트나 배치 환경에서는 `confirmBeforeCommit: false` 설정을 사용해 이 함수를 건너뛸 수 있습니다.
 * 이 함수는 diff 원문이나 민감 정보를 출력하지 않고, 호출자가 전달한 정리된 커밋 메시지만 보여줍니다.
 */
export async function confirmCommit(message, { file } = {}) {
  const label = file ? `${file} 파일을 커밋할까요?` : '이 변경사항을 커밋할까요?';

  const response = await prompts({
    type: 'confirm',
    name: 'confirmed',
    message: `${label}\n\n${message}`,
    initial: true,
  });

  return response.confirmed === true;
}
