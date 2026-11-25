// Korean copy for the parent-facing parts (spec §5.1). Every string is a draft.
export const koJoin = {
  parentHelp: [
    '아이 카드의 QR 코드를 스캔하면 바로 시작할 수 있어요.', // DRAFT: Kyla to confirm
    '카드를 잃어버렸다면 선생님께 받은 반 코드를 입력하고 아이 이름을 눌러 주세요.', // DRAFT: Kyla to confirm
  ],
  problemTitle: '링크를 열 수 없어요', // DRAFT: Kyla to confirm
  problemHelp: '반 코드로 들어가거나 선생님께 새 카드를 요청해 주세요.', // DRAFT: Kyla to confirm
} as const;

export const koKid = {
  whoAreYou: '로그인이 풀렸어요. 반 코드를 입력하고 아이 이름을 다시 눌러 주세요.', // DRAFT: Kyla to confirm
  notOpen: '아직 열리지 않은 수업이에요. 홈 화면으로 돌아가 주세요.', // DRAFT: Kyla to confirm
} as const;
