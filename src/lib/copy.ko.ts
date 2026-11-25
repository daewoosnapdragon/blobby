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
  offline: '인터넷에 연결되어 있지 않아요. 연결되면 아이가 하던 곳에서 이어서 할 수 있어요.', // DRAFT: Kyla to confirm
  error: '문제가 생겼어요. 아래 버튼을 눌러 다시 시도해 주세요. 계속되면 선생님께 알려 주세요.', // DRAFT: Kyla to confirm
  loading: '불러오는 중이에요. 잠시만 기다려 주세요.', // DRAFT: Kyla to confirm
  muteNote: '효과음만 꺼져요. 읽어 주는 소리는 계속 나와요.', // DRAFT: Kyla to confirm
  notOpen: '아직 열리지 않은 수업이에요. 홈 화면으로 돌아가 주세요.', // DRAFT: Kyla to confirm
  noPractice: '첫 주차가 열리면 자유 연습도 시작돼요. 홈 화면으로 돌아가 주세요.', // DRAFT: Kyla to confirm
} as const;

/** Printed on every QR card (spec §5.1). */
export const koCards = {
  help: [
    '처음 한 번만 QR 코드를 스캔하세요. 휴대폰이 기억해요.', // DRAFT: Kyla to confirm
    '카드를 잃어버렸다면 사이트에 들어가 반 코드를 입력하고 우리 아이 이름을 눌러 주세요.', // DRAFT: Kyla to confirm
  ],
  classCodeLabel: '반 코드', // DRAFT: Kyla to confirm
} as const;
