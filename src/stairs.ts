import { createGame, type RunResult, type StairScene } from './game';
import { api, type Ranking, type Ticket } from './api';
import { activeProfile, saved, persist, selectProfile, rememberScore, type Profile } from './storage';
import { normalizeName, type Action, type Mode } from '../functions/src/shared/rules';
import { GameAudio } from './audio';
import { ADVENTURE_STAGES, ACHIEVEMENTS, worldById, type GameMode } from './content';
import { ProgressStore, createProgressRunId, dailySeed, seoulDateKey } from './progression';
import { JourneyBook } from './journey';
import { deleteKartProgress } from './kart-storage';
import { deleteMiniProgress } from './mini-storage';
import { STAIRS_LESSON, lessonCue } from './stairs-lesson';
import './stairs-lesson.css';

document.body.classList.add('stairs-page');
document.title = '지한이의 무한계단 · 작은 오락실';

const icons = {
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1z"/></svg>',
  stairs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h6v-6h6V8h6M3 20v-5h6V9h6V3h6v17z"/></svg>',
  cup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10v7a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 3v5m-4 1h8"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m11 4-6 5H2v6h3l6 5zm5 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m11 4-6 5H2v6h3l6 5zm5 5 6 6m0-6-6 6"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  turn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 7 7v4"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 11 6-6 6 6m-6-6v15"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg>',
};

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="site-header">
    <a class="brand" href="/" aria-label="지한이의 작은 오락실"><span class="brand-mark">${icons.stairs}</span><span>지한이의 <strong>작은 오락실</strong></span></a>
    <nav aria-label="게임 메뉴"><a class="arcade-return" href="/" aria-label="게임 고르기로 돌아가기">← <span>게임 고르기</span></a><button class="icon-button mobile-rank" id="rank-mobile" aria-label="순위표">${icons.cup}</button><button class="icon-button" id="sound-button" aria-label="소리 설정" aria-haspopup="dialog">${icons.sound}</button><button class="profile-button" id="profile-button">${icons.user}<span id="header-name">플레이어</span></button></nav>
  </header>
  <main class="layout">
    <aside class="intro-panel">
      <span class="eyebrow"><span class="tiny-star">✦</span> FIVE WORLDS, ONE LITTLE ADVENTURER</span>
      <h1>지한이의<br><span>무한계단</span><i>✦</i></h1>
      <p class="intro-copy">구름 초원에서 별빛 우주까지.<br>우리 어디까지 올라갈까?</p>
      <div class="best-card"><span class="best-icon">${icons.cup}</span><div><span class="label">나의 최고 기록</span><strong><span id="personal-best">0</span><small> 계단</small></strong></div></div>
      <div class="how-to"><h2>두 버튼이면 준비 끝!</h2><div><span class="mini-key turn">${icons.turn}</span><p><strong>방향 바꾸기</strong><span>반대로 돌아서 한 계단</span></p></div><div><span class="mini-key climb">${icons.up}</span><p><strong>오르기</strong><span>바라보는 쪽으로 한 계단</span></p></div><p class="keyboard-note">키보드는 <kbd>←</kbd> 방향 바꾸기 · <kbd>→</kbd> 오르기</p></div>
      <button class="text-button" id="help-button">처음이라면? 게임 방법 보기 <span>↗</span></button>
      <div class="intro-footer">작은 도전이 모여, 커다란 모험이 돼요.</div>
    </aside>

    <section class="game-column" aria-label="무한계단 게임">
      <div class="game-shell">
        <div id="game-canvas" aria-label="지한이가 구름 위 계단을 오르는 게임 화면"></div>
        <div class="game-hud" id="hud" hidden><div class="mode-badge" id="mode-badge">도전 모드</div><div class="score-display"><strong id="score">0</strong><span id="score-unit">계단</span></div><button id="pause-button" class="pause-button" aria-label="일시정지">${icons.pause}</button><div class="energy-track" aria-label="남은 시간"><div id="energy-fill"></div></div><div class="journey-hud"><span id="world-label">구름 초원</span><span id="run-combo">0 연속</span><span id="run-stars">✦ 0</span></div><div id="step-hint" class="step-hint" hidden></div><div id="lesson-guide" class="stairs-lesson-guide" role="status" aria-live="polite" aria-atomic="true" hidden><div><span id="lesson-chapter"></span><span id="lesson-progress"></span></div><strong id="lesson-instruction"></strong><p id="lesson-explanation"></p><small>시간 제한 없이, 틀려도 다시 해 봐요.</small></div></div>
        <div class="sky-label" id="sky-label"><span>✦</span> 오늘의 모험은 구름 위로</div>
        <div class="start-overlay" id="start-overlay">
          <img class="start-mascot" src="/assets/jihan-climber.png" alt="빨간 운동화를 신고 웃고 있는 지한이" />
          <div class="start-card"><div class="card-kicker">HELLO, ADVENTURER!</div><h2 id="welcome-title">어떤 이름으로 놀까요?</h2><form id="start-form"><label class="sr-only" for="player-name">캐릭터 이름</label><div class="name-field">${icons.user}<input id="player-name" name="name" maxlength="12" autocomplete="off" placeholder="캐릭터 이름" required><span>✎</span></div><p class="field-error" id="name-error" role="alert"></p><div class="mode-picker" role="group" aria-label="게임 모드"><button type="button" data-mode="challenge" aria-pressed="true"><span>⚡</span> 무한 도전</button><button type="button" data-mode="adventure" aria-pressed="false"><span>🗺️</span> 세계 모험</button><button type="button" data-mode="daily" aria-pressed="false"><span>☀️</span> 오늘의 계단</button><button type="button" data-mode="practice" aria-pressed="false"><span>☁</span> 편안한 연습</button></div><p class="mode-description" id="mode-description">50계단마다 새로운 풍경! 최고 기록에 도전해요.</p><button id="stage-select" class="stage-select" type="button" hidden></button><button type="button" id="lesson-start" class="stairs-lesson-start" disabled><span>🎓</span><span><strong>처음이라면? 12계단 조작 교실</strong><small>두 버튼을 하나씩 배워요 · 시간 제한 없어요</small></span><b>↗</b></button><button class="primary-button start-button" id="start-button" type="submit" disabled>게임 준비 중…</button></form><p class="start-footnote">이름 하나면 준비 끝. 가입 없이 놀아요.</p></div>
        </div>
        <div class="play-message" id="play-message" role="status"></div>
        <div class="pause-overlay" id="pause-overlay" hidden><div class="pause-card"><span class="pause-cloud">☁</span><h2>잠깐 쉬어가요</h2><p>지한이가 여기서 기다리고 있어요.</p><button id="resume-button" class="primary-button">계속 올라가기 <span>↗</span></button><button id="pause-home" class="text-button">처음으로</button></div></div>
        <div class="result-overlay" id="result-overlay" hidden><div class="result-card"><span class="result-star">${icons.star}</span><p class="card-kicker" id="result-kicker">아주 멋진 도전!</p><h2><span id="result-score">0</span><small>계단</small></h2><p id="result-copy">한 번 더 올라가 볼까요?</p><div id="result-rewards" class="result-rewards"></div><div class="result-best"><span id="result-best-label">나의 최고</span><strong id="result-best">0 계단</strong></div><p id="save-status" class="save-status" role="status"></p><button id="next-stage" class="primary-button" hidden>다음 모험으로 ↗</button><button id="retry-button" class="primary-button">한 번 더! <span>↗</span></button><button id="result-home" class="text-button">이름·모드 바꾸기</button></div></div>
      </div>
      <div class="game-controls"><button id="turn-button" class="control-button turn-control" aria-label="방향 바꾸기" disabled>${icons.turn}<span>방향 바꾸기<small>← 키</small></span></button><button id="climb-button" class="control-button climb-control" aria-label="오르기" disabled>${icons.up}<span>오르기<small>→ 키</small></span></button></div>
      <div class="journey-launchers"><button id="journey-open"><span class="book-symbol">🗺️</span><span><strong>모험 수첩 <b id="journey-wallet">0 별</b></strong><small id="journey-caption">모험 0/5 · 친구 1/6</small></span><i>↗</i></button><button id="missions-open"><span>✦</span><strong>오늘의 미션</strong><small id="mission-caption">0/3 완료</small></button></div>
      <p class="below-game" id="below-game">내 속도로 즐기고 싶다면, 연습 모드로 시작해요.</p>
    </section>

    <aside class="ranking-panel"><div class="ranking-heading"><span class="eyebrow">HALL OF FAME</span><span class="rank-spark">✦</span><h2>구름 위의 친구들</h2><p>가장 높이 올라간 100개의 기록</p></div><div class="ranking-list" id="ranking-preview"></div><button class="all-rankings" id="all-rankings">전체 순위 보기 <span>↗</span></button><div class="practice-note"><span>☁</span><h3>천천히 해도 괜찮아!</h3><p>연습 모드에서는 시간이 흐르지 않아요. 계단을 하나씩 익혀봐요.</p></div><p class="ranking-footnote">도전 모드 · 캐릭터별 최고 점수</p><p class="environment-note" id="environment-note"></p></aside>
  </main>
  <footer class="site-footer"><span>MADE FOR JIHAN, & EVERY LITTLE ADVENTURER.</span><span>즐거움은 한 계단부터 <i>✦</i></span></footer>
  <dialog id="sound-dialog" aria-labelledby="sound-title"><div class="dialog-header"><div><span class="eyebrow">LITTLE MELODIES</span><h2 id="sound-title">어떤 소리로 놀까요?</h2></div><button class="dialog-close" aria-label="닫기">×</button></div><p class="dialog-description">통통 뛰는 도전, 포근한 연습.<br>모드에 어울리는 구름 음악이 함께해요.</p><div class="sound-options"><label class="sound-option"><span><strong>배경 음악</strong><small>게임에 흐르는 구름 멜로디</small></span><input id="music-toggle" type="checkbox" role="switch" aria-label="배경 음악"></label><label class="sound-option"><span><strong>효과음</strong><small>계단을 오르고 기록을 세우는 소리</small></span><input id="effects-toggle" type="checkbox" role="switch" aria-label="효과음"></label></div><p class="sound-status" id="music-status" role="status"></p><button class="primary-button" id="sound-close">좋아요!</button></dialog>
  <dialog id="ranking-dialog"><div class="dialog-header"><div><span class="eyebrow">TOP 100</span><h2>구름 위의 친구들</h2></div><button class="dialog-close" aria-label="닫기">×</button></div><p class="dialog-description">도전 모드의 캐릭터별 최고 기록이에요.</p><div id="ranking-full" class="ranking-list full-list"></div></dialog>
  <dialog id="profile-dialog"><div class="dialog-header"><div><span class="eyebrow">OUR PLAYERS</span><h2>누가 놀까요?</h2></div><button class="dialog-close" aria-label="닫기">×</button></div><div id="profile-list"></div><button id="new-profile" class="primary-button">새 캐릭터 만들기 +</button><p class="dialog-description">이 기기에 저장된 캐릭터예요. 브라우저 데이터를 지우면 기록에 다시 연결할 수 없어요.</p><button id="delete-profile" class="danger-button">현재 캐릭터와 기록 삭제</button><p id="profile-error" class="field-error" role="alert"></p></dialog>
  <dialog id="help-dialog"><div class="dialog-header"><h2>함께 올라가 볼까요?</h2><button class="dialog-close" aria-label="닫기">×</button></div><div class="help-steps"><p><b>1</b><span><strong>지한이가 보는 방향을 살펴요.</strong>처음에는 오른쪽을 보고 있어요.</span></p><p><b>2</b><span><strong>앞으로 갈 땐 ‘오르기’!</strong>반대쪽 계단이 나오면 ‘방향 바꾸기’를 눌러요. 돌아서면서 한 칸 올라가요.</span></p><p><b>3</b><span><strong>시간이 다 되기 전에 한 계단 더!</strong>올라갈 때마다 시간이 채워져요. 연습 모드에서는 시간 제한도, 추락도 없어요.</span></p></div><button class="primary-button" id="help-close">이제 알겠어요!</button></dialog>
  <div id="toast" class="toast" role="status"></div>
`;

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
let scene: StairScene;
let mode: GameMode = 'challenge';
let selectedStage = ADVENTURE_STAGES[0].id;
const progressStore = new ProgressStore();
let journey: JourneyBook;
let currentRun: { id: string; lesson: boolean; mode: GameMode; dateKey: string; stageId?: string; stars: number; awards: string[]; closed: boolean; stored: boolean; world?: string; dailyBestAtStart: number } | undefined;
let runProfile: Profile | undefined;
let ticket: Ticket | undefined;
let screen: 'start' | 'playing' | 'paused' | 'result' = 'start';
let starting = false;
let deleting = false;
let entries: Ranking[] = [];
let leaderboardAvailable = false;
let toastTimer: ReturnType<typeof setTimeout>;
let messageTimer: ReturnType<typeof setTimeout>;
let submissionSequence = 0;
const sound = new GameAudio({ onStatus: () => updateSound() });
const ruleMode = (value: GameMode): Mode => value === 'practice' || value === 'adventure' ? 'practice' : 'challenge';
const selectedAdventure = () => ADVENTURE_STAGES.find(stage => stage.id === selectedStage)!;
const isLesson = () => currentRun?.lesson === true;
function ensureProfile(): Profile | undefined {
  if (activeProfile()) return activeProfile();
  try {
    const profile = selectProfile(normalizeName($<HTMLInputElement>('#player-name').value));
    updateProfile(); return profile;
  } catch { toast('게임 화면에서 캐릭터 이름을 먼저 정해 주세요.'); return undefined; }
}

function toast(text: string): void {
  $('#toast').textContent = text; $('#toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3200);
}
function message(text: string): void {
  $('#play-message').textContent = text; $('#play-message').classList.add('visible');
  clearTimeout(messageTimer); messageTimer = setTimeout(() => $('#play-message').classList.remove('visible'), 1700);
}
function updateProfile(): void {
  const profile = activeProfile();
  $('#header-name').textContent = profile?.name || '플레이어';
  $('#personal-best').textContent = (mode === 'practice' ? profile?.practiceBest : profile?.best)?.toLocaleString() || '0';
  if (profile) $('#player-name').setAttribute('value', profile.name);
  $('#welcome-title').textContent = profile ? '오늘도 한 계단 더!' : '어떤 이름으로 놀까요?';
  if (!progressStore.isStageUnlocked(profile?.id || 'preview', selectedStage)) selectedStage = ADVENTURE_STAGES[0].id;
  updateMode(); journey?.refresh();
}
function updateMode(): void {
  const stage = selectedAdventure();
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  const descriptions: Record<GameMode, string> = {
    challenge: '50계단마다 새로운 풍경! 최고 기록에 도전해요.',
    practice: '시간도 실수도 걱정 없이, 다섯 세상을 둘러봐요.',
    adventure: '시간 제한 없이 완주해요. 실수 기회는 세 번!',
    daily: `${seoulDateKey()} · 모두 같은 150계단 · 내 최고 ${progressStore.get(activeProfile()?.id || 'preview').daily.best}`,
  };
  $('#mode-description').textContent = descriptions[mode];
  $('#stage-select').hidden = mode !== 'adventure';
  $('#stage-select').textContent = `${worldById(stage.worldId).icon} ${stage.title} · ${stage.goal}계단  ›`;
}
function chooseMode(value: GameMode, stageId?: string): void {
  if (starting) return;
  if (screen !== 'start') home();
  mode = value;
  if (stageId) selectedStage = stageId;
  updateProfile();
}
function saveJourney(completed = false): void {
  if (!currentRun || currentRun.lesson || currentRun.closed || !runProfile || !scene) return;
  const detail = scene.getProgress();
  const result = progressStore.record(runProfile.id, {
    runId: currentRun.id, mode: currentRun.mode, dateKey: currentRun.dateKey,
    score: detail.score, stageId: currentRun.stageId, mistakes: detail.mistakes,
    maxCombo: detail.maxCombo, completed,
  });
  currentRun.stars += result.earnedStars;
  currentRun.stored = result.stored;
  for (const id of result.newAchievements) {
    const name = ACHIEVEMENTS.find(item => item.id === id)!.title;
    currentRun.awards.push(name);
    if (!completed) toast(`새 배지! ${name} ✦`);
  }
  if (completed) currentRun.closed = true;
  journey?.refresh();
}
function updateSound(): void {
  $('#sound-button').innerHTML = saved.sound || saved.music ? icons.sound : icons.mute;
  $<HTMLInputElement>('#music-toggle').checked = saved.music;
  $<HTMLInputElement>('#effects-toggle').checked = saved.sound;
  const labels = { idle: '게임을 시작하면 음악이 함께해요.', loading: '구름 음악을 준비하고 있어요…', playing: '구름 음악이 흐르고 있어요.', paused: '계속 올라가면 음악도 이어져요.', muted: '배경 음악은 쉬고 있어요.', unavailable: '음악을 불러오지 못했어요. 게임은 계속 즐길 수 있어요.' };
  $('#music-status').textContent = labels[sound.status];
}
function setControls(enabled: boolean): void {
  $<HTMLButtonElement>('#turn-button').disabled = !enabled;
  $<HTMLButtonElement>('#climb-button').disabled = !enabled;
}
function setScreen(value: typeof screen): void {
  screen = value;
  $('#start-overlay').hidden = value !== 'start';
  $('#sky-label').hidden = value !== 'start';
  $('#hud').hidden = value === 'start';
  $('#pause-overlay').hidden = value !== 'paused';
  $('#result-overlay').hidden = value !== 'result';
  setControls(value === 'playing');
  $('#game-canvas').classList.toggle('softened', value === 'paused' || value === 'result');
  if (value !== 'playing') { clearTimeout(messageTimer); $('#play-message').classList.remove('visible'); $('#play-message').textContent = ''; }
  if (value === 'paused') sound.pause();
  else if (value === 'start' || value === 'result') sound.stop();
  updateLessonGuide();
}
function updateLessonGuide(): void {
  const visible = isLesson() && screen === 'playing';
  $('#lesson-guide').hidden = !visible;
  document.querySelector('.game-column')!.classList.toggle('stairs-lesson-playing', visible);
  const cue = visible ? lessonCue(scene.getProgress()) : undefined;
  for (const [id, action] of [['#turn-button', 'turn'], ['#climb-button', 'climb']] as const) {
    const button = $(id);
    button.classList.toggle('stairs-lesson-next', cue?.action === action);
    if (visible) button.setAttribute('aria-describedby', 'lesson-guide');
    else button.removeAttribute('aria-describedby');
  }
  if (!cue) return;
  $('#lesson-chapter').textContent = cue.chapter;
  $('#lesson-progress').textContent = `${cue.step} / ${STAIRS_LESSON.goal}`;
  $('#lesson-instruction').textContent = cue.instruction;
  $('#lesson-explanation').textContent = cue.explanation;
  $('#lesson-guide').dataset.action = cue.action || '';
}
function rankList(target: HTMLElement, rows: Ranking[], emptyCopy: string): void {
  target.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement('div'); empty.className = 'empty-ranking';
    empty.innerHTML = `${icons.cup}<strong></strong><p></p>`;
    empty.querySelector('strong')!.textContent = emptyCopy;
    empty.querySelector('p')!.textContent = leaderboardAvailable ? '첫 번째 모험의 주인공이 되어봐요.' : '게임은 지금도 즐길 수 있어요.';
    target.append(empty); return;
  }
  for (const row of rows) {
    const item = document.createElement('div'); item.className = `rank-row ${row.mine ? 'is-me' : ''}`;
    const number = document.createElement('span'); number.className = `rank-number rank-${row.rank}`; number.textContent = String(row.rank).padStart(2, '0');
    const name = document.createElement('strong'); name.textContent = row.name;
    if (row.mine) { const badge = document.createElement('small'); badge.textContent = '나'; name.append(badge); }
    const points = document.createElement('span'); points.className = 'rank-score'; points.textContent = row.score.toLocaleString();
    const unit = document.createElement('small'); unit.textContent = ' 계단'; points.append(unit);
    item.append(number, name, points); target.append(item);
  }
}
async function refreshRankings(): Promise<void> {
  try {
    const response = await api.leaderboard(activeProfile()?.id);
    entries = response.entries; leaderboardAvailable = true;
    $('#environment-note').textContent = response.local ? '현재는 이 컴퓨터의 테스트 순위표예요.' : '';
  } catch { leaderboardAvailable = false; }
  const empty = leaderboardAvailable ? '첫 기록을 기다리고 있어요' : '순위표에 연결하는 중이에요';
  rankList($('#ranking-preview'), entries.slice(0, 5), empty);
  rankList($('#ranking-full'), entries, empty);
}
async function startRun(lesson = false): Promise<void> {
  if (starting || deleting || !scene) return;
  let name: string;
  try { name = normalizeName($<HTMLInputElement>('#player-name').value); } catch (error) { $('#name-error').textContent = (error as Error).message; return; }
  const runMode: Mode = lesson ? 'practice' : ruleMode(mode);
  sound.stop(); sound.unlock(); sound.prepare(runMode);
  $('#name-error').textContent = ''; starting = true;
  submissionSequence++;
  document.querySelectorAll<HTMLButtonElement>('.site-header button, [data-mode], #result-home, #journey-open, #missions-open, #stage-select, #next-stage, #lesson-start').forEach(button => { button.disabled = true; });
  $<HTMLInputElement>('#player-name').disabled = true;
  $('#start-button').textContent = '계단을 준비하고 있어요…';
  $<HTMLButtonElement>('#start-button').disabled = true;
  $<HTMLButtonElement>('#retry-button').disabled = true;
  runProfile = selectProfile(name); updateProfile();
  if (mode === 'adventure' && !progressStore.isStageUnlocked(runProfile.id, selectedStage)) selectedStage = ADVENTURE_STAGES[0].id;
  currentRun = { id: createProgressRunId(), lesson, mode: lesson ? 'practice' : mode, dateKey: seoulDateKey(), stageId: mode === 'adventure' ? selectedStage : undefined, stars: 0, awards: [], closed: false, stored: true, dailyBestAtStart: progressStore.get(runProfile.id).daily.best };
  ticket = undefined;
  if (!lesson && mode === 'challenge') {
    try { ticket = await api.start(runProfile.id, name); }
    catch { toast('연결이 어려워요. 이번 기록은 이 기기에 저장할게요.'); }
  }
  const stage = selectedAdventure();
  const seed = lesson ? STAIRS_LESSON.seed : mode === 'daily' ? dailySeed(currentRun.dateKey) : mode === 'adventure' ? stage.seed : ticket?.seed ?? crypto.getRandomValues(new Uint32Array(1))[0];
  scene.startRun(seed, runMode, {
    ...(lesson ? STAIRS_LESSON.options : mode === 'adventure' ? { world: stage.worldId, goal: stage.goal, mistakeLimit: 3 } : mode === 'daily' ? { goal: 150 } : {}),
    companion: progressStore.get(runProfile.id).equippedCompanion,
    starOffset: lesson ? 0 : progressStore.get(runProfile.id).totalStairs % 10,
  }); setScreen('playing');
  $<HTMLInputElement>('#player-name').blur();
  $('#mode-badge').textContent = lesson ? '🎓 조작 교실' : { practice: '☁ 연습', challenge: '⚡ 무한 도전', adventure: '🗺️ 세계 모험', daily: '☀️ 오늘의 계단' }[mode];
  $('#score-unit').textContent = lesson ? `/ ${STAIRS_LESSON.goal} 계단` : mode === 'adventure' ? `/ ${stage.goal} 계단` : mode === 'daily' ? '/ 150 계단' : '계단';
  $('#below-game').textContent = lesson ? '반짝이는 버튼을 눌러 두 가지 조작을 배워요. 틀려도 괜찮아요!' : runMode === 'practice' ? '다음 계단 힌트를 보고 천천히 올라가요.' : '반대쪽 계단이 보이면 방향 바꾸기!';
  $('#energy-fill').parentElement!.classList.toggle('practice-energy', runMode === 'practice');
  $('#step-hint').hidden = lesson || runMode !== 'practice';
  starting = false;
  document.querySelectorAll<HTMLButtonElement>('.site-header button, [data-mode], #result-home, #journey-open, #missions-open, #stage-select, #next-stage, #lesson-start').forEach(button => { button.disabled = false; });
  $<HTMLInputElement>('#player-name').disabled = false;
  $('#start-button').innerHTML = '올라가 볼까? <span>↗</span>';
  $<HTMLButtonElement>('#start-button').disabled = false;
  $<HTMLButtonElement>('#retry-button').disabled = false;
  sound.playMusic(runMode); sound.tone('step');
  if (document.hidden || !document.hasFocus()) pause();
  message(lesson ? '반짝이는 오르기 버튼부터 눌러 봐요!' : mode === 'adventure' ? `${stage.title}, 출발!` : mode === 'practice' ? '시간 걱정 없이, 천천히 올라가요!' : mode === 'daily' ? '오늘은 같은 길, 나만의 최고에 도전!' : '오른쪽부터! 오르기를 눌러봐요.');
}
async function endRun(result: RunResult): Promise<void> {
  if (!runProfile) return;
  const seq = ++submissionSequence;
  const profile = runProfile;
  const runTicket = ticket;
  const playedMode = currentRun?.mode || mode;
  const oldDailyBest = currentRun?.dailyBestAtStart || 0;
  if (isLesson()) {
    if (currentRun) currentRun.closed = true;
    setScreen('result');
    $('#result-score').textContent = result.score.toLocaleString();
    $('#result-kicker').textContent = '조작 교실 졸업! 🎓';
    $('#result-copy').textContent = '오르기와 방향 바꾸기를 모두 배웠어요. 이제 모험을 떠나 볼까요?';
    $('#result-rewards').textContent = '🎓 12계단을 끝까지 올라왔어요!';
    $('#result-best-label').textContent = '오늘 배운 두 버튼';
    $('#result-best').textContent = '오르기 · 방향 바꾸기';
    $('#save-status').textContent = '언제든 교실에서 천천히 다시 배울 수 있어요.';
    $('#next-stage').textContent = '세계 모험 떠나기 ↗';
    $('#next-stage').hidden = false;
    $('#retry-button').textContent = '교실 다시 하기';
    $('#retry-button').classList.add('secondary-retry');
    sound.tone('record');
    return;
  }
  saveJourney(true);
  const normalMode = playedMode === 'challenge' || playedMode === 'practice';
  const { newBest, stored } = normalMode ? rememberScore(profile, result.mode, result.score) : { newBest: playedMode === 'daily' && result.score > oldDailyBest, stored: currentRun?.stored ?? false };
  const cleared = playedMode === 'adventure' && result.reason === 'finished';
  updateProfile(); setScreen('result');
  $('#result-score').textContent = result.score.toLocaleString();
  $('#result-kicker').textContent = cleared ? '모험 완주! 참 잘했어요 ✦' : newBest ? '새로운 최고 기록!' : '아주 멋진 도전!';
  $('#result-copy').textContent = cleared ? `${worldById(selectedAdventure().worldId).name}에서 멋진 추억을 만들었어요.` : result.reason === 'wrong' ? playedMode === 'adventure' ? '세 번의 연습을 마쳤어요. 다음에는 더 높이!' : '반대쪽 계단에서는 방향을 바꿔봐요!' : result.reason === 'time' ? '한 계단 더! 다시 도전해 볼까요?' : '끝까지 올라왔어요. 정말 대단해요!';
  $('#result-rewards').textContent = `✦ ${currentRun?.stars || 0}별을 모았어요${currentRun?.awards.length ? ` · 새 배지 ${currentRun.awards.length}개` : ''}`;
  $('#result-best-label').textContent = playedMode === 'adventure' ? '완주한 모험' : playedMode === 'daily' ? `${currentRun?.dateKey.slice(5)} 최고` : '나의 최고';
  $('#result-best').textContent = playedMode === 'adventure' ? `${progressStore.get(profile.id).completedStages.length} / 5` : `${playedMode === 'daily' ? Math.max(oldDailyBest, result.score) : result.mode === 'practice' ? profile.practiceBest : profile.best} 계단`;
  $('#save-status').textContent = stored && currentRun?.stored ? normalMode ? '기록과 모은 별을 이 기기에 저장했어요.' : '모험 기록은 이 브라우저에 저장했어요.' : '브라우저 저장 공간을 사용할 수 없어요.';
  $('#next-stage').textContent = '다음 모험으로 ↗';
  $('#retry-button').innerHTML = '한 번 더! <span>↗</span>';
  const stageIndex = ADVENTURE_STAGES.findIndex(stage => stage.id === currentRun?.stageId);
  $('#next-stage').hidden = !cleared || stageIndex >= ADVENTURE_STAGES.length - 1;
  $('#retry-button').classList.toggle('secondary-retry', !$('#next-stage').hidden);
  sound.tone(newBest || cleared ? 'record' : 'end');
  if (playedMode === 'challenge' && runTicket && result.score > 0) {
    $('#save-status').textContent = '순위표에 기록을 확인하고 있어요…';
    try {
      const response = await api.submit(runTicket.token, result.inputs);
      if (seq === submissionSequence) $('#save-status').textContent = response.rank ? `구름 위의 친구들 ${response.rank}위!` : stored ? '최고 기록은 기기에 저장했어요. 다음엔 100위에 도전!' : '100위 밖 기록이에요. 브라우저 저장 공간도 확인해 주세요.';
      void refreshRankings();
    } catch {
      if (seq === submissionSequence) $('#save-status').textContent = stored ? '순위표 저장에 실패했어요. 개인 기록은 기기에 남아 있어요.' : '기록을 저장하지 못했어요. 연결과 브라우저 저장 공간을 확인해 주세요.';
    }
  }
}
function pause(): void {
  if (screen !== 'playing') return;
  scene.setPaused(true); setScreen('paused'); saveJourney();
}
function home(): void {
  if (currentRun && !currentRun.closed) {
    if (runProfile && !currentRun.lesson && currentRun.mode === 'practice') rememberScore(runProfile, 'practice', scene.getProgress().score);
    saveJourney(true);
  }
  currentRun = undefined;
  submissionSequence++;
  scene.idle({ companion: progressStore.get(activeProfile()?.id || 'preview').equippedCompanion });
  setScreen('start');
  $('#play-message').classList.remove('visible'); updateProfile();
  $('#below-game').textContent = '내 속도로 즐기고 싶다면, 연습 모드로 시작해요.';
}
function openDialog(id: string): void { pause(); $<HTMLDialogElement>(id).showModal(); }
function act(action: Action): void { if (screen === 'playing') scene.act(action); }

$('#start-form').addEventListener('submit', event => { event.preventDefault(); void startRun(); });
$('#lesson-start').addEventListener('click', () => void startRun(true));
$('#retry-button').addEventListener('click', () => void startRun(isLesson()));
$('#result-home').addEventListener('click', home);
$('#pause-home').addEventListener('click', home);
$('#next-stage').addEventListener('click', () => {
  if (isLesson()) { chooseMode('adventure', ADVENTURE_STAGES[0].id); void startRun(); return; }
  const index = ADVENTURE_STAGES.findIndex(stage => stage.id === currentRun?.stageId);
  const next = ADVENTURE_STAGES[index + 1];
  if (next) { chooseMode('adventure', next.id); void startRun(); }
});
$('#pause-button').addEventListener('click', pause);
$('#resume-button').addEventListener('click', () => { scene.setPaused(false); setScreen('playing'); sound.resume(); });
for (const [id, action] of [['#turn-button', 'turn'], ['#climb-button', 'climb']] as const) {
  const button = $(id);
  button.addEventListener('pointerdown', event => { event.preventDefault(); act(action); button.classList.add('pressed'); });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) button.addEventListener(type, () => button.classList.remove('pressed'));
  button.addEventListener('click', event => { if ((event as MouseEvent).detail === 0) act(action); });
}
document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || document.querySelector('dialog[open]') || event.repeat) return;
  if (event.code === 'Escape') { pause(); return; }
  if (screen !== 'playing') return;
  if (['ArrowLeft', 'KeyA'].includes(event.code)) { event.preventDefault(); act('turn'); }
  if (['ArrowRight', 'KeyD', 'Space', 'ArrowUp'].includes(event.code)) { event.preventDefault(); act('climb'); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('blur', pause);
window.addEventListener('pagehide', () => { pause(); sound.pause(); });
window.addEventListener('online', () => void refreshRankings());
$('#sound-button').addEventListener('click', () => { openDialog('#sound-dialog'); updateSound(); });
$('#sound-close').addEventListener('click', () => $<HTMLDialogElement>('#sound-dialog').close());
$('#music-toggle').addEventListener('change', () => {
  saved.music = $<HTMLInputElement>('#music-toggle').checked; persist();
  sound.setPreferences(saved.music, saved.sound); sound.unlock(); updateSound();
});
$('#effects-toggle').addEventListener('change', () => {
  saved.sound = $<HTMLInputElement>('#effects-toggle').checked; persist();
  sound.setPreferences(saved.music, saved.sound); sound.unlock(); updateSound(); sound.tone('step');
});
document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => button.addEventListener('click', () => chooseMode(button.dataset.mode as GameMode)));
$('#stage-select').addEventListener('click', () => journey.open('map'));
for (const id of ['#all-rankings', '#rank-mobile']) $(id).addEventListener('click', () => { openDialog('#ranking-dialog'); void refreshRankings(); });
$('#help-button').addEventListener('click', () => openDialog('#help-dialog'));
$('#help-close').addEventListener('click', () => $<HTMLDialogElement>('#help-dialog').close());
document.querySelectorAll<HTMLButtonElement>('.dialog-close').forEach(button => button.addEventListener('click', () => button.closest('dialog')!.close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } }));
$('#profile-button').addEventListener('click', () => {
  deleteArmed = false; $('#delete-profile').textContent = '현재 캐릭터와 기록 삭제';
  const list = $('#profile-list'); list.replaceChildren(); $('#profile-error').textContent = '';
  for (const profile of saved.profiles) {
    const button = document.createElement('button'); button.className = 'profile-choice';
    const name = document.createElement('strong'); name.textContent = profile.name;
    const score = document.createElement('span'); score.textContent = `${profile.best} 계단${profile.id === saved.activeId ? ' · 선택됨' : ''}`;
    button.append(name, score); button.addEventListener('click', () => {
      saved.activeId = profile.id; persist(); $<HTMLInputElement>('#player-name').value = profile.name;
      $<HTMLDialogElement>('#profile-dialog').close(); home(); void refreshRankings();
    }); list.append(button);
  }
  $<HTMLButtonElement>('#delete-profile').disabled = !activeProfile();
  openDialog('#profile-dialog');
});
$('#new-profile').addEventListener('click', () => {
  saved.activeId = ''; persist();
  $<HTMLDialogElement>('#profile-dialog').close(); home();
  $<HTMLInputElement>('#player-name').value = ''; $('#welcome-title').textContent = '새 친구의 이름은 뭘까요?';
  $('#player-name').focus();
});
let deleteArmed = false;
$('#delete-profile').addEventListener('click', async () => {
  if (deleting) return;
  if (!deleteArmed) { deleteArmed = true; $('#delete-profile').textContent = '정말 삭제할까요? 다시 누르면 삭제돼요'; return; }
  const profile = activeProfile(); if (!profile) return;
  deleting = true;
  const disabled = [...document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button,input')].map(element => [element, element.disabled] as const);
  disabled.forEach(([element]) => { element.disabled = true; });
  try {
    await api.remove(profile.id);
    if (!progressStore.deleteProfileProgress(profile.id)) throw new Error('서버 기록은 지웠지만 기기의 모험 기록을 지우지 못했어요. 브라우저 저장 공간을 확인하고 다시 시도해 주세요.');
    if (!deleteKartProgress(profile.id, profile.name)) throw new Error('기기의 미니 카트 기록을 지우지 못했어요. 브라우저 저장 공간을 확인하고 다시 시도해 주세요.');
    if (!deleteMiniProgress(profile.name)) throw new Error('기기의 미니 모험 기록을 지우지 못했어요. 브라우저 저장 공간을 확인하고 다시 시도해 주세요.');
    const previousProfiles = saved.profiles, previousId = saved.activeId;
    saved.profiles = saved.profiles.filter(p => p.id !== profile.id); saved.activeId = saved.profiles[0]?.id || '';
    if (!persist()) {
      saved.profiles = previousProfiles; saved.activeId = previousId;
      throw new Error('서버와 모험 기록은 지웠지만 캐릭터 정보를 기기에 저장하지 못했어요. 다시 시도해 주세요.');
    }
    currentRun = undefined; runProfile = undefined;
    $<HTMLDialogElement>('#profile-dialog').close(); $<HTMLInputElement>('#player-name').value = activeProfile()?.name || '';
    home(); void refreshRankings(); toast('캐릭터와 기록을 삭제했어요.');
  } catch (error) { $('#profile-error').textContent = error instanceof Error ? error.message : '기록을 지우지 못했어요. 연결 후 다시 시도해 주세요.'; }
  finally { deleting = false; disabled.forEach(([element, value]) => { element.disabled = value; }); }
  deleteArmed = false; $('#delete-profile').textContent = '현재 캐릭터와 기록 삭제';
});

journey = new JourneyBook({ store: progressStore, profile: activeProfile, ensureProfile,
  stage: () => selectedStage, selectStage: stage => chooseMode('adventure', stage.id),
  selectDaily: () => chooseMode('daily'), beforeOpen: pause, notify: toast,
  equip: id => scene?.setCompanion(id),
});
sound.setPreferences(saved.music, saved.sound);
updateProfile(); updateSound(); void refreshRankings();
createGame($('#game-canvas'), {
  update: (score, energy) => {
    $('#score').textContent = score.toLocaleString();
    $('#energy-fill').style.transform = `scaleX(${energy})`;
    $('#energy-fill').classList.toggle('low', energy < .25);
  },
  step: (action, score) => {
    if (score === -1) return;
    sound.tone(action === 'turn' ? 'turn' : 'step', score);
  },
  progress: detail => {
    const world = worldById(detail.worldId);
    $('#world-label').textContent = `${world.icon} ${world.name}`;
    $('#run-combo').textContent = isLesson() ? '천천히 배워요' : mode === 'adventure' ? `${'♥'.repeat(detail.mistakesLeft ?? 3)}${'♡'.repeat(detail.mistakes)}` : `${detail.combo} 연속`;
    $('#run-stars').textContent = isLesson() ? `🎓 ${Math.min(detail.score, STAIRS_LESSON.goal)}/${STAIRS_LESSON.goal}` : `✦ ${detail.collected}`;
    $('#step-hint').textContent = detail.nextAction === 'turn' ? '↶ 다음은 방향 바꾸기' : '↑ 다음은 오르기';
    $('#step-hint').dataset.action = detail.nextAction;
    updateLessonGuide();
    document.querySelector('.game-shell')!.setAttribute('data-world', detail.worldId);
    if (currentRun) {
      if (currentRun.world && currentRun.world !== detail.worldId) message(`${world.icon} ${world.name}에 도착했어요!`);
      currentRun.world = detail.worldId;
      saveJourney();
    }
  },
  end: result => void endRun(result),
}).then(result => {
  scene = result.scene;
  scene.setCompanion(progressStore.get(activeProfile()?.id || 'preview').equippedCompanion);
  $('#start-button').innerHTML = '올라가 볼까? <span>↗</span>';
  $<HTMLButtonElement>('#start-button').disabled = false;
  $<HTMLButtonElement>('#lesson-start').disabled = false;
}).catch(() => { $('#start-button').textContent = '새로고침해서 다시 시작해 주세요'; });
