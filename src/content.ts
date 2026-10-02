/** Original places, companions and goals for Jihan's cloud journey. */
export type GameMode = 'challenge' | 'practice' | 'adventure' | 'daily';
export type WorldId = 'meadow' | 'sunset' | 'forest' | 'snow' | 'space';
export type CompanionId = 'cloud' | 'sprout' | 'star' | 'bunny' | 'comet' | 'satellite';

export type World = {
  id: WorldId; name: string; subtitle: string; icon: string;
  palette: { skyTop: number; skyBottom: number; stepTop: number; stepSide: number; stepEdge: number; accent: number; decoration: number };
};
export const WORLDS: readonly World[] = [
  { id: 'meadow', name: '구름 초원', subtitle: '초록 바람을 타고 첫걸음을 내디뎌요.', icon: '🌤️', palette: { skyTop: 0xc5efeb, skyBottom: 0xf0f8dc, stepTop: 0xffffff, stepSide: 0xc4e5c8, stepEdge: 0x7bb49a, accent: 0x329b7e, decoration: 0x92cf9d } },
  { id: 'sunset', name: '노을 언덕', subtitle: '복숭아빛 하늘에 작은 꿈을 띄워요.', icon: '🌅', palette: { skyTop: 0xf7b49b, skyBottom: 0xffe8b7, stepTop: 0xfff4da, stepSide: 0xeab17e, stepEdge: 0xc58368, accent: 0xe27761, decoration: 0xf6ce92 } },
  { id: 'forest', name: '반딧불 숲', subtitle: '반짝이는 숲속 친구들이 길을 밝혀요.', icon: '🌳', palette: { skyTop: 0x1d5755, skyBottom: 0x87b786, stepTop: 0xd9efb7, stepSide: 0x75a576, stepEdge: 0x447666, accent: 0xb7e86a, decoration: 0xe5f59f } },
  { id: 'snow', name: '눈꽃 봉우리', subtitle: '포근한 눈송이 사이로 더 높이 올라가요.', icon: '❄️', palette: { skyTop: 0xabcde9, skyBottom: 0xf0efff, stepTop: 0xffffff, stepSide: 0xb6d8eb, stepEdge: 0x80a8cc, accent: 0x7598d0, decoration: 0xffffff } },
  { id: 'space', name: '별빛 우주', subtitle: '달을 지나 나만의 별을 찾아가요.', icon: '🪐', palette: { skyTop: 0x292b58, skyBottom: 0x7973ad, stepTop: 0xe8dcff, stepSide: 0xa49bd6, stepEdge: 0x7d76b6, accent: 0xffdc7c, decoration: 0xfff0b9 } },
];
export const worldById = (id: string): World => WORLDS.find(world => world.id === id) ?? WORLDS[0];

export type AdventureStage = { id: string; worldId: WorldId; title: string; description: string; goal: number; seed: number; reward: number };
export const ADVENTURE_STAGES: readonly AdventureStage[] = [
  { id: 'meadow-30', worldId: 'meadow', title: '첫 구름 여행', description: '30계단을 올라 구름 초원에 도착해요.', goal: 30, seed: 0x4a484101, reward: 10 },
  { id: 'sunset-50', worldId: 'sunset', title: '노을 따라 한 걸음', description: '50계단 너머 복숭아빛 노을이 기다려요.', goal: 50, seed: 0x4a484102, reward: 15 },
  { id: 'forest-75', worldId: 'forest', title: '반딧불을 찾아서', description: '75계단을 올라 반짝이는 숲을 탐험해요.', goal: 75, seed: 0x4a484103, reward: 20 },
  { id: 'snow-100', worldId: 'snow', title: '눈꽃 정상에 서다', description: '100계단을 올라 눈꽃 봉우리를 만나요.', goal: 100, seed: 0x4a484104, reward: 30 },
  { id: 'space-150', worldId: 'space', title: '지한이의 작은 우주', description: '150계단을 올라 별빛 여행을 완성해요.', goal: 150, seed: 0x4a484105, reward: 40 },
];

export type Companion = { id: CompanionId; name: string; icon: string; description: string; cost: number };
export const COMPANIONS: readonly Companion[] = [
  { id: 'cloud', name: '몽실 구름', icon: '☁️', description: '첫걸음부터 함께하는 포근한 친구', cost: 0 },
  { id: 'sprout', name: '초록 새싹', icon: '🌱', description: '한 걸음마다 씩씩하게 자라는 친구', cost: 20 },
  { id: 'star', name: '반짝 별', icon: '⭐', description: '올라갈 때마다 빛을 나눠 주는 친구', cost: 45 },
  { id: 'bunny', name: '달빛 토끼', icon: '🐰', description: '기쁜 마음으로 폴짝폴짝 뛰는 친구', cost: 80 },
  { id: 'comet', name: '꼬마 혜성', icon: '☄️', description: '하늘에 무지갯빛 꼬리를 그리는 친구', cost: 130 },
  { id: 'satellite', name: '우주 탐험가', icon: '🛰️', description: '별 너머 새로운 길을 찾아 주는 친구', cost: 200 },
];

export type AchievementId = 'first-step' | 'high-50' | 'high-100' | 'stairs-300' | 'stairs-1000' | 'adventure-first' | 'adventure-all' | 'daily-150';
export type Achievement = { id: AchievementId; title: string; description: string; icon: string; goal: number; reward: number };
export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first-step', title: '반가워, 구름!', description: '첫 계단을 올라요.', icon: '👣', goal: 1, reward: 5 },
  { id: 'high-50', title: '구름 위 산책', description: '한 번에 50계단을 올라요.', icon: '🌤️', goal: 50, reward: 10 },
  { id: 'high-100', title: '하늘 탐험가', description: '한 번에 100계단을 올라요.', icon: '🎈', goal: 100, reward: 20 },
  { id: 'stairs-300', title: '차곡차곡 발자국', description: '모든 놀이에서 합해 300계단을 올라요.', icon: '🥾', goal: 300, reward: 20 },
  { id: 'stairs-1000', title: '천 번의 한 걸음', description: '모든 놀이에서 합해 1,000계단을 올라요.', icon: '🏅', goal: 1000, reward: 35 },
  { id: 'adventure-first', title: '모험의 시작', description: '첫 번째 모험을 완주해요.', icon: '🗺️', goal: 1, reward: 15 },
  { id: 'adventure-all', title: '다섯 세상의 친구', description: '다섯 모험을 모두 완주해요.', icon: '🌍', goal: 5, reward: 60 },
  { id: 'daily-150', title: '오늘의 정상', description: '오늘의 계단에서 150계단을 올라요.', icon: '🏆', goal: 150, reward: 25 },
];

export type MissionId = 'daily-stairs' | 'daily-runs' | 'daily-course';
export type DailyMission = { id: MissionId; title: string; description: string; icon: string; goal: number; reward: number };
export const DAILY_MISSIONS: readonly DailyMission[] = [
  { id: 'daily-stairs', title: '오늘도 차곡차곡', description: '어떤 놀이든 합해 60계단을 올라요.', icon: '👣', goal: 60, reward: 5 },
  { id: 'daily-runs', title: '세 번의 작은 도전', description: '서로 다른 세 판에서 10계단씩 올라요.', icon: '🎯', goal: 3, reward: 5 },
  { id: 'daily-course', title: '오늘의 길 만나기', description: '오늘의 계단에서 50계단을 올라요.', icon: '☀️', goal: 50, reward: 10 },
];
