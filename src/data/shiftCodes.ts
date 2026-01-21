export type GameType = 'BL1' | 'BL2' | 'TPS' | 'BL3' | 'WONDERLANDS';
export type CodeStatus = 'active' | 'expired' | 'unknown';
export type RewardType = 'golden-keys' | 'skin' | 'cosmetic' | 'weapon' | 'other';

export interface ShiftCode {
  id: string;
  code: string;
  game: GameType;
  status: CodeStatus;
  reward: string;
  rewardType: RewardType;
  keys?: number;
  expiresAt?: string;
  source: string;
  addedAt: string;
}

export const GAME_INFO: Record<GameType, { name: string; shortName: string; color: string }> = {
  BL1: { name: 'Borderlands', shortName: 'BL1', color: 'hsl(200 70% 50%)' },
  BL2: { name: 'Borderlands 2', shortName: 'BL2', color: 'hsl(45 95% 55%)' },
  TPS: { name: 'The Pre-Sequel', shortName: 'TPS', color: 'hsl(280 70% 60%)' },
  BL3: { name: 'Borderlands 3', shortName: 'BL3', color: 'hsl(25 95% 55%)' },
  WONDERLANDS: { name: 'Tiny Tina\'s Wonderlands', shortName: 'TTW', color: 'hsl(320 70% 60%)' },
};

// Get today's date for mock "new today" codes
const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

// Mock data representing aggregated SHiFT codes
export const mockShiftCodes: ShiftCode[] = [
  {
    id: '1',
    code: 'KBKTB-R3H3K-XBKJK-JT3T3-WC959',
    game: 'BL3',
    status: 'active',
    reward: '3 Golden Keys',
    rewardType: 'golden-keys',
    keys: 3,
    expiresAt: '2025-02-15',
    source: '@Borderlands',
    addedAt: today,
  },
  {
    id: '2',
    code: 'ZFKTB-W9XXK-C6RJK-6T3T3-RCS5H',
    game: 'BL3',
    status: 'active',
    reward: '1 Golden Key',
    rewardType: 'golden-keys',
    keys: 1,
    source: 'shift.orcicorn.com',
    addedAt: today,
  },
  {
    id: '3',
    code: 'WFKTT-6HXR5-FZJKJ-BTT33-HR3RZ',
    game: 'BL3',
    status: 'expired',
    reward: '5 Golden Keys',
    rewardType: 'golden-keys',
    keys: 5,
    expiresAt: '2025-01-10',
    source: '@dgSHiFTCodes',
    addedAt: '2025-01-05',
  },
  {
    id: '4',
    code: 'CJKBJ-JC69S-5WJBW-BJJTB-KZ9B5',
    game: 'BL2',
    status: 'active',
    reward: '5 Golden Keys',
    rewardType: 'golden-keys',
    keys: 5,
    source: '@Borderlands',
    addedAt: yesterday,
  },
  {
    id: '5',
    code: 'WBKBT-3K9FB-R6KJB-JT33J-53CSC',
    game: 'BL2',
    status: 'active',
    reward: '1 Golden Key',
    rewardType: 'golden-keys',
    keys: 1,
    source: 'mentalmars.com',
    addedAt: twoDaysAgo,
  },
  {
    id: '6',
    code: 'K3K3T-TXW3X-5CWBB-BTJJ3-T65SZ',
    game: 'BL2',
    status: 'unknown',
    reward: '3 Golden Keys',
    rewardType: 'golden-keys',
    keys: 3,
    source: 'Reddit r/Borderlands',
    addedAt: '2025-01-15',
  },
  {
    id: '7',
    code: 'HXKBT-BXZWF-RFXJB-J3TJB-SFK69',
    game: 'WONDERLANDS',
    status: 'active',
    reward: 'Skeleton Key',
    rewardType: 'golden-keys',
    keys: 1,
    source: '@PlayWonderlands',
    addedAt: today,
  },
  {
    id: '8',
    code: 'JFKBT-XWTHK-CKXZB-JBTJ3-HRC39',
    game: 'WONDERLANDS',
    status: 'active',
    reward: 'Diamond Armor Cosmetic',
    rewardType: 'cosmetic',
    source: 'shift.orcicorn.com',
    addedAt: '2025-01-16',
  },
  {
    id: '9',
    code: 'WJKBJ-BWR6R-S6WJZ-JTTJB-KWS9T',
    game: 'TPS',
    status: 'active',
    reward: '5 Golden Keys',
    rewardType: 'golden-keys',
    keys: 5,
    source: '@Borderlands',
    addedAt: '2025-01-12',
  },
  {
    id: '10',
    code: 'CBKBT-W5RXF-C6KZB-J3J33-TKC5X',
    game: 'TPS',
    status: 'expired',
    reward: 'Claptastic Voyage Skin',
    rewardType: 'skin',
    expiresAt: '2024-12-31',
    source: 'mentalmars.com',
    addedAt: '2024-12-20',
  },
  {
    id: '11',
    code: 'C35TB-WS6ST-TXFRJ-JTTJ3-JJH6H',
    game: 'BL1',
    status: 'active',
    reward: '5 Golden Keys',
    rewardType: 'golden-keys',
    keys: 5,
    source: '@Borderlands',
    addedAt: '2025-01-14',
  },
  {
    id: '12',
    code: 'WBKJT-6HJKK-5ZK55-JBTJJ-CBHHF',
    game: 'BL3',
    status: 'active',
    reward: 'FL4K Creature Skin',
    rewardType: 'skin',
    source: '@dgSHiFTCodes',
    addedAt: '2025-01-11',
  },
  {
    id: '13',
    code: 'KTKTT-HR6TH-5CXKB-JT3TJ-HFK53',
    game: 'BL3',
    status: 'unknown',
    reward: 'Weapon Trinket',
    rewardType: 'cosmetic',
    source: 'Reddit r/borderlands3',
    addedAt: '2025-01-08',
  },
  {
    id: '14',
    code: 'WBKJ3-6HJ5T-CBKWJ-JTTJ3-W5JJZ',
    game: 'BL2',
    status: 'expired',
    reward: 'Assassin Head',
    rewardType: 'cosmetic',
    expiresAt: '2025-01-01',
    source: '@Borderlands',
    addedAt: '2024-12-28',
  },
  {
    id: '15',
    code: 'ZRWBJ-ST6XR-CBKTJ-JT33B-JR69W',
    game: 'WONDERLANDS',
    status: 'expired',
    reward: '3 Skeleton Keys',
    rewardType: 'golden-keys',
    keys: 3,
    expiresAt: '2025-01-05',
    source: '@PlayWonderlands',
    addedAt: '2025-01-02',
  },
];
