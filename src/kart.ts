import './kart.css';
import { GameAudio } from './audio';
import { activeProfile, persist, saved, selectProfile } from './storage';
import { normalizeName } from '../functions/src/shared/rules';
import { KART_STORAGE_KEY } from './kart-storage';
import { createKartGame, type KartScene, type KartTheme, type KartVehicle, type KartProgress, type KartResult } from './kart-game';

type Phase = 'ready' | 'playing' | 'paused' | 'finished';
type RecordData = { wallet: number; totalStars: number; runs: number; bestStars: number; owned: KartVehicle[]; vehicle: KartVehicle; theme: KartTheme };
type Store = { version: 1; records: Record<string, RecordData> };
const COURSES: { id: KartTheme; symbol: string; name: string; detail: string; color: string }[] = [
  { id: 'meadow', symbol: '🌳', name: '초록 들판', detail: '나무 사이로 기분 좋게 씽씽', color: '#dcebc6' },
  { id: 'sunset', symbol: '🌅', name: '노을 언덕', detail: '따뜻한 노을빛 길을 달려요', color: '#f5d5b5' },
  { id: 'snow', symbol: '⛄', name: '눈꽃 마을', detail: '포근한 눈길로 겨울 여행', color: '#d7e8ef' },
];
const VEHICLES: { id: KartVehicle; symbol: string; name: string; detail: string; cost: number }[] = [
  { id: 'kart', symbol: '🏎️', name: '빨강 카트', detail: '언제나 함께하는 첫 자동차', cost: 0 },
  { id: 'firetruck', symbol: '🚒', name: '꼬마 소방차', detail: '출동! 씩씩한 빨강 친구', cost: 20 },
  { id: 'dino', symbol: '🦖', name: '공룡 자동차', detail: '초록 공룡과 우당탕 모험', cost: 35 },
  { id: 'space', symbol: '🚀', name: '우주 자동차', detail: '별을 향해 날아갈 것 같아', cost: 50 },
];
const isVehicle = (value: unknown): value is KartVehicle => VEHICLES.some(item => item.id === value);
const isTheme = (value: unknown): value is KartTheme => COURSES.some(item => item.id === value);
const count = (value: unknown, max = 1_000_000_000): number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? Math.min(max, value) : 0;
const freshRecord = (): RecordData => ({ wallet: 0, totalStars: 0, runs: 0, bestStars: 0, owned: ['kart'], vehicle: 'kart', theme: 'meadow' });
let storageAvailable = true;
function loadStore(): Store {
  const result: Store = { version: 1, records: Object.create(null) as Record<string, RecordData> };
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KART_STORAGE_KEY) || 'null');
    if (!raw || typeof raw !== 'object' || !('version' in raw) || raw.version !== 1 || !('records' in raw) || !raw.records || typeof raw.records !== 'object') return result;
    for (const [key, value] of Object.entries(raw.records).slice(0, 1000)) {
      if (!value || typeof value !== 'object') continue;
      const data = value as Partial<RecordData>;
      const owned = [...new Set<KartVehicle>(['kart', ...(Array.isArray(data.owned) ? data.owned.filter(isVehicle) : [])])];
      result.records[key] = { wallet: count(data.wallet), totalStars: count(data.totalStars), runs: count(data.runs), bestStars: count(data.bestStars, 10000), owned, vehicle: isVehicle(data.vehicle) && owned.includes(data.vehicle) ? data.vehicle : 'kart', theme: isTheme(data.theme) ? data.theme : 'meadow' };
    }
  } catch { storageAvailable = false; }
  return result;
}
const store = loadStore();
let sharedProfileStored = true;
function nameKey(name: string): string { return `name:${name}`; }
const initialProfile = activeProfile();
let initialName = '지한이';
try { if (initialProfile) initialName = normalizeName(initialProfile.name); } catch { /* Ignore an invalid older profile name. */ }
let profileId = nameKey(initialName);
if (!store.records[profileId] && initialProfile && store.records[initialProfile.id]) store.records[profileId] = store.records[initialProfile.id];
function record(): RecordData { return store.records[profileId] ||= freshRecord(); }
function storeRecord(): boolean {
  try { localStorage.setItem(KART_STORAGE_KEY, JSON.stringify(store)); storageAvailable = true; return true; }
  catch { storageAvailable = false; return false; }
}
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node;
}
function button(text: string, className: string, onClick: () => void): HTMLButtonElement {
  const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', onClick); return node;
}
function link(text: string, href: string, className: string): HTMLAnchorElement { const node = el('a', className, text); node.href = href; return node; }
const app = document.querySelector<HTMLDivElement>('#app')!;
app.classList.add('kart-app');
document.title = '미니 카트 · 지한이의 작은 오락실';
const header = el('header', 'kart-header');
const brand = link('', '/', 'kart-brand');
brand.append(el('span', 'kart-brand-mark', '✦'), el('strong', '', '지한이의 작은 오락실'));
const nav = el('nav', 'kart-nav'); nav.setAttribute('aria-label', '주 메뉴');
const homeLink = link('← 게임 고르기', '/', 'kart-home');
const soundButton = button('♫', 'kart-sound-button', () => openDialog(soundDialog)); soundButton.setAttribute('aria-label', '음악과 효과음 설정');
nav.append(homeLink, soundButton); header.append(brand, nav); app.append(header);
const main = el('main', 'kart-layout'); app.append(main);
const intro = el('section', 'kart-intro'); intro.setAttribute('aria-labelledby', 'kart-title');
intro.append(el('p', 'kart-eyebrow', 'LITTLE DRIVER, BIG ADVENTURE'));
const title = el('h1', 'kart-title'); title.id = 'kart-title'; title.append(document.createTextNode('바람을 타고,'), el('br'), el('span', '', '씽씽!')); intro.append(title);
intro.append(el('p', 'kart-intro-copy', '작은 자동차로 떠나는 1분 여행.\n반짝이는 별을 따라 달려볼까?'));
const infoTag = el('div', 'kart-info-tag'); infoTag.append(el('span', '', '🏁'), el('div', '', ''));
infoTag.lastElementChild!.append(el('strong', '', '미니 카트'), el('small', '', '한 판 60초 · 좌우로 움직여요')); intro.append(infoTag);
const how = el('div', 'kart-how'); how.append(el('h2', '', '이렇게 달려요'));
[['↔', '왼쪽, 오른쪽!', '큰 화살표 버튼으로 길을 바꿔요.'], ['★', '반짝이는 별을 쏙!', '모은 별로 새 자동차를 만나요.'], ['♥', '부딪혀도 괜찮아', '잠깐 느려져도 끝까지 갈 수 있어요.']].forEach(([symbol, name, detail]) => {
  const row = el('div', 'kart-how-row'); const copy = el('p'); copy.append(el('strong', '', name), el('span', '', detail)); row.append(el('span', 'kart-how-icon', symbol), copy); how.append(row);
});
intro.append(how, el('p', 'kart-keyboard-note', '키보드는 ← → 또는 A D · 화면을 밀어도 돼요'));
main.append(intro);
const gameColumn = el('section', 'kart-game-column'); gameColumn.setAttribute('aria-label', '미니 카트 레이싱'); main.append(gameColumn);
const mobileTitle = el('div', 'kart-mobile-title'); mobileTitle.append(el('div', '', ''));
mobileTitle.firstElementChild!.append(el('span', 'kart-eyebrow', 'LET’S GO FOR A RIDE'), el('h2', '', '미니 카트'));
const setupTools = el('div', 'kart-setup-tools');
const courseOpen = button('🌳 코스', 'kart-chip-button', () => openDialog(courseDialog));
const garageOpen = button('🏎️ 차고', 'kart-chip-button', () => openDialog(garageDialog)); setupTools.append(courseOpen, garageOpen); mobileTitle.append(setupTools); gameColumn.append(mobileTitle);
const shell = el('div', 'kart-game-shell'); gameColumn.append(shell);
const canvasParent = el('div', 'kart-canvas'); canvasParent.id = 'kart-canvas'; canvasParent.setAttribute('aria-label', '3차선 도로를 달리는 자동차'); shell.append(canvasParent);
const hud = el('div', 'kart-hud');
const hudTop = el('div', 'kart-hud-top'); const starCount = el('strong', 'kart-star-count', '★ 0'); starCount.setAttribute('aria-label', '모은 별 0개');
const timeLeft = el('strong', 'kart-time', '60'); const timerWrap = el('span', 'kart-timer'); timerWrap.append(timeLeft, el('small', '', '초'));
const pauseButton = button('Ⅱ', 'kart-pause', () => pauseRun()); pauseButton.setAttribute('aria-label', '잠깐 쉬기'); pauseButton.disabled = true;
hudTop.append(starCount, timerWrap, pauseButton); hud.append(hudTop);
const progressRow = el('div', 'kart-progress-row'); const raceProgress = el('progress', 'kart-progress'); raceProgress.max = 1; raceProgress.value = 0; raceProgress.setAttribute('aria-label', '결승선까지 달린 거리'); progressRow.append(el('span', '', '출발'), raceProgress, el('span', '', '🏁')); hud.append(progressRow); shell.append(hud);
const gentleMessage = el('p', 'kart-gentle-message'); gentleMessage.hidden = true; shell.append(gentleMessage);
const readyOverlay = el('div', 'kart-overlay kart-ready-overlay');
const readyCard = el('form', 'kart-ready-card'); readyCard.noValidate = true; const readyKicker = el('p', 'kart-card-kicker', 'READY, LITTLE DRIVER?');
readyCard.append(readyKicker, el('h2', '', '우리 같이 달려볼까?'));
const nameLabel = el('label', 'kart-name-label'); nameLabel.htmlFor = 'kart-driver-name'; nameLabel.append(el('span', 'sr-only', '운전할 친구 이름'), el('span', 'kart-name-icon', '☺'));
const nameInput = el('input'); nameInput.id = 'kart-driver-name'; nameInput.name = 'driver'; nameInput.type = 'text'; nameInput.maxLength = 12; nameInput.placeholder = '친구 이름'; nameInput.setAttribute('autocomplete', 'nickname'); nameInput.value = initialName; nameInput.required = true; nameInput.setAttribute('aria-describedby', 'kart-name-error'); nameLabel.append(nameInput, el('span', 'kart-name-end', '의 자동차'));
const nameError = el('p', 'kart-name-error'); nameError.id = 'kart-name-error'; nameError.setAttribute('role', 'alert');
const readyDescription = el('p', 'kart-ready-description');
const startButton = el('button', 'kart-primary', '불러오는 중…'); startButton.type = 'submit'; startButton.disabled = true;
const readyFootnote = el('p', 'kart-ready-footnote', '천천히 시작해요. 부딪혀도 계속 달릴 수 있어요.');
readyCard.append(nameLabel, nameError, readyDescription, startButton, readyFootnote); readyOverlay.append(readyCard); shell.append(readyOverlay);
const pauseOverlay = el('div', 'kart-overlay kart-pause-overlay'); pauseOverlay.hidden = true;
const pauseCard = el('div', 'kart-modal-card'); pauseCard.setAttribute('role', 'dialog'); pauseCard.setAttribute('aria-modal', 'true'); pauseCard.setAttribute('aria-labelledby', 'kart-pause-heading');
const pauseHeading = el('h2', '', '잠깐 쉬어가요'); pauseHeading.id = 'kart-pause-heading';
const resumeButton = button('이어서 달리기 →', 'kart-primary', () => resumeRun());
const leaveButton = button('처음으로 돌아가기', 'kart-secondary', () => resetReady());
pauseCard.append(el('span', 'kart-pause-art', '☁'), pauseHeading, el('p', '', '자동차도 잠깐 숨 고르는 중!'), resumeButton, leaveButton, el('small', 'kart-abandon-note', '완주한 경기의 별만 모을 수 있어요.')); pauseOverlay.append(pauseCard); shell.append(pauseOverlay);
const resultOverlay = el('div', 'kart-overlay kart-result-overlay'); resultOverlay.hidden = true;
const resultCard = el('div', 'kart-modal-card kart-finish-card'); resultCard.setAttribute('role', 'dialog'); resultCard.setAttribute('aria-modal', 'true'); resultCard.setAttribute('aria-labelledby', 'kart-finish-heading');
const finishHeading = el('h2', '', '멋지게 도착!'); finishHeading.id = 'kart-finish-heading';
const finishName = el('p', 'kart-finish-name'); const finishStars = el('strong', 'kart-finish-stars', '★ 0'); const finishGoals = el('div', 'kart-finish-goals');
const finishSave = el('p', 'kart-finish-save');
const retryButton = button('한 번 더 달리기 →', 'kart-primary', () => startRun());
resultCard.append(el('div', 'kart-finish-medal', '🏁'), finishHeading, finishName, finishStars, finishGoals, finishSave, retryButton, button('코스 · 자동차 고르기', 'kart-secondary', () => resetReady())); resultOverlay.append(resultCard); shell.append(resultOverlay);
const controls = el('div', 'kart-controls');
const leftButton = button('', 'kart-drive-button kart-drive-left', () => move(-1)); leftButton.setAttribute('aria-label', '왼쪽 차선으로 이동'); leftButton.append(el('span', 'kart-arrow', '←'), el('span', '', '왼쪽'));
const rightButton = button('', 'kart-drive-button kart-drive-right', () => move(1)); rightButton.setAttribute('aria-label', '오른쪽 차선으로 이동'); rightButton.append(el('span', '', '오른쪽'), el('span', 'kart-arrow', '→'));
leftButton.disabled = rightButton.disabled = true; controls.append(leftButton, rightButton); gameColumn.append(controls);
gameColumn.append(el('p', 'kart-below-game', '별을 모으고, 바람을 느끼고. 오늘도 즐거운 드라이브!'));
const sidebar = el('aside', 'kart-sidebar'); main.append(sidebar);
const coursePanel = el('div', 'kart-side-panel'); coursePanel.append(el('p', 'kart-eyebrow', 'PICK YOUR ADVENTURE'), el('h2', '', '어디로 떠날까?'));
const courseList = el('div', 'kart-course-list'); coursePanel.append(courseList); sidebar.append(coursePanel);
const garagePanel = el('div', 'kart-side-panel kart-garage-panel');
const garageHeading = el('div', 'kart-side-heading'); garageHeading.append(el('h2', '', '나의 작은 차고'));
const wallet = el('strong', 'kart-wallet', '★ 0'); garageHeading.append(wallet); garagePanel.append(garageHeading, el('p', 'kart-side-copy', '별을 모아 나만의 자동차를 만나요.'));
const garageList = el('div', 'kart-garage-list'); garagePanel.append(garageList, el('p', 'kart-cosmetic-note', '모든 자동차의 빠르기와 조작은 같아요.'), button('차고 구경하기 →', 'kart-text-button', () => openDialog(garageDialog))); sidebar.append(garagePanel);
const bestPanel = el('div', 'kart-best-panel'); const personalBest = el('strong'); const totalRuns = el('small'); bestPanel.append(el('span', '', '✦'), el('div')); bestPanel.lastElementChild!.append(el('span', '', '나의 최고 별 기록'), personalBest, totalRuns); sidebar.append(bestPanel);
const storageNote = el('p', 'kart-storage-note'); sidebar.append(storageNote);
const footer = el('footer', 'kart-footer', '작은 도전, 커다란 즐거움 ✦'); app.append(footer);
const live = el('p', 'sr-only'); live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); app.append(live);
const toast = el('div', 'kart-toast'); toast.setAttribute('role', 'status'); app.append(toast);
let toastTimeout: ReturnType<typeof setTimeout> | undefined;
function notify(message: string): void { toast.textContent = message; toast.classList.add('visible'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => toast.classList.remove('visible'), 3000); }
function openDialog(dialog: HTMLDialogElement): void { pauseRun(); dialog.showModal(); }
function makeDialog(titleText: string, description: string): { dialog: HTMLDialogElement; body: HTMLDivElement } {
  const dialog = el('dialog', 'kart-dialog'); const headingRow = el('div', 'kart-dialog-heading'); const heading = el('h2', '', titleText); heading.id = `kart-dialog-${app.querySelectorAll('dialog').length}`; dialog.setAttribute('aria-labelledby', heading.id);
  const close = button('×', 'kart-dialog-close', () => dialog.close()); close.setAttribute('aria-label', '닫기'); headingRow.append(heading, close); const body = el('div', 'kart-dialog-body'); dialog.append(headingRow, el('p', 'kart-dialog-description', description), body); app.append(dialog);
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); const click = event as MouseEvent; if (click.clientX < rect.left || click.clientX > rect.right || click.clientY < rect.top || click.clientY > rect.bottom) dialog.close(); } }); return { dialog, body };
}
const { dialog: courseDialog, body: courseDialogBody } = makeDialog('어디로 떠날까?', '마음에 드는 풍경을 골라요. 모든 코스는 60초예요.');
const { dialog: garageDialog, body: garageDialogBody } = makeDialog('나의 작은 차고', '완주해서 모은 별로 새 자동차를 만나요. 빠르기와 조작은 모두 같아요.');
const dialogWallet = el('p', 'kart-dialog-wallet'); const dialogGarageList = el('div', 'kart-dialog-garage-list'); garageDialogBody.append(dialogWallet, dialogGarageList, el('p', 'kart-dialog-local-note', '별과 자동차는 이 브라우저에, 친구 이름별로 저장돼요.'));
const { dialog: soundDialog, body: soundDialogBody } = makeDialog('소리도 함께 씽씽', '음악과 효과음을 따로 켜고 끌 수 있어요.');
const audio = new GameAudio(); audio.setPreferences(saved.music, saved.sound);
function soundSetting(titleText: string, description: string, field: 'music' | 'sound'): void {
  const label = el('label', 'kart-sound-setting'); const copy = el('span'); copy.append(el('strong', '', titleText), el('small', '', description)); const input = el('input'); input.type = 'checkbox'; input.checked = saved[field]; input.addEventListener('change', () => { saved[field] = input.checked; audio.setPreferences(saved.music, saved.sound); audio.unlock(); if (!persist()) notify('소리 설정은 지금 창에서만 기억할게요.'); }); label.append(copy, input); soundDialogBody.append(label);
}
soundSetting('배경 음악', '자동차와 함께 가볍게 흥얼흥얼', 'music'); soundSetting('효과음', '별을 모을 때 반짝이는 소리', 'sound');
let scene: KartScene | undefined;
let phase: Phase = 'ready';
let awarded = false;
let runProfileId = profileId;
let lastProgress: KartProgress | undefined;
let lastSeconds = -1;
let messageTimeout: ReturnType<typeof setTimeout> | undefined;
function setDriving(enabled: boolean): void { leftButton.disabled = rightButton.disabled = !enabled; pauseButton.disabled = !enabled; courseOpen.disabled = garageOpen.disabled = phase === 'playing' || phase === 'paused'; shell.dataset.phase = phase; }
function renderCourseChoices(parent: HTMLElement, closeOnChoice: boolean): void {
  parent.replaceChildren();
  for (const course of COURSES) {
    const choice = button('', 'kart-course-choice', () => { if (phase !== 'ready' && phase !== 'finished') return; record().theme = course.id; storeRecord(); renderChoices(); scene?.idle({ theme: record().theme, vehicle: record().vehicle }); if (closeOnChoice) courseDialog.close(); });
    choice.disabled = phase === 'playing' || phase === 'paused'; choice.setAttribute('aria-pressed', String(record().theme === course.id)); choice.style.setProperty('--course-color', course.color); const art = el('span', 'kart-course-art', course.symbol); art.setAttribute('aria-hidden', 'true'); const copy = el('span', 'kart-course-copy'); copy.append(el('strong', '', course.name), el('small', '', course.detail)); choice.append(art, copy, el('span', 'kart-choice-check', record().theme === course.id ? '✓' : '')); parent.append(choice);
  }
}
function chooseVehicle(vehicle: typeof VEHICLES[number]): void {
  if (phase !== 'ready' && phase !== 'finished') return;
  const data = record();
  if (!data.owned.includes(vehicle.id)) {
    if (data.wallet < vehicle.cost) { notify(`별 ${vehicle.cost - data.wallet}개를 더 모으면 만날 수 있어요!`); return; }
    data.wallet -= vehicle.cost; data.owned.push(vehicle.id); notify(`${vehicle.name}가 차고에 왔어요!`);
  }
  data.vehicle = vehicle.id; storeRecord(); renderChoices(); scene?.idle({ theme: data.theme, vehicle: data.vehicle });
}
function renderGarage(parent: HTMLElement, compact = false): void {
  parent.replaceChildren();
  for (const vehicle of VEHICLES) {
    const owned = record().owned.includes(vehicle.id); const selected = record().vehicle === vehicle.id; const choice = button('', `kart-vehicle-choice${compact ? ' kart-vehicle-compact' : ''}`, () => chooseVehicle(vehicle));
    choice.disabled = phase === 'playing' || phase === 'paused'; choice.setAttribute('aria-pressed', String(selected)); choice.setAttribute('aria-label', `${vehicle.name}, ${selected ? '선택됨' : owned ? '선택하기' : `별 ${vehicle.cost}개로 만나기`}`);
    const art = el('span', 'kart-vehicle-art', vehicle.symbol); art.setAttribute('aria-hidden', 'true'); const copy = el('span', 'kart-vehicle-copy'); copy.append(el('strong', '', vehicle.name)); if (!compact) copy.append(el('small', '', vehicle.detail));
    const status = el('span', 'kart-vehicle-status', selected ? '함께 달리는 중 ✓' : owned ? '선택하기' : `★ ${vehicle.cost}`); if (!owned && record().wallet < vehicle.cost) status.classList.add('kart-vehicle-locked'); choice.append(art, copy, status); parent.append(choice);
  }
}
function renderChoices(): void {
  renderCourseChoices(courseList, false); renderCourseChoices(courseDialogBody, true); renderGarage(garageList, true); renderGarage(dialogGarageList);
  const data = record(); wallet.textContent = `★ ${data.wallet}`; dialogWallet.textContent = `내가 모은 별 ★ ${data.wallet}`; personalBest.textContent = `${data.bestStars}개`; totalRuns.textContent = `${data.runs}번의 즐거운 완주`; storageNote.textContent = storageAvailable ? sharedProfileStored ? '별과 자동차는 이 브라우저에 친구 이름별로 저장돼요.' : '별은 이 이름으로 저장돼요. 다음에 친구 이름을 다시 입력해 주세요.' : '저장 공간을 사용할 수 없어, 기록은 지금 창에서만 기억해요.';
  const course = COURSES.find(item => item.id === data.theme)!; const vehicle = VEHICLES.find(item => item.id === data.vehicle)!;
  courseOpen.textContent = `${course.symbol} 코스`; garageOpen.textContent = `${vehicle.symbol} 차고`; readyDescription.textContent = `${course.name} · ${vehicle.name} · 60초 드라이브`;
}
function update(progress: KartProgress): void {
  if (phase !== 'playing') return;
  lastProgress = progress; const seconds = Math.ceil(Math.max(0, progress.duration - progress.elapsed)); if (seconds !== lastSeconds) { timeLeft.textContent = String(seconds); lastSeconds = seconds; }
  starCount.textContent = `★ ${progress.stars}`; starCount.setAttribute('aria-label', `모은 별 ${progress.stars}개`); raceProgress.value = progress.progress;
  if (progress.stars === 10 && starCount.dataset.goal !== 'done') { starCount.dataset.goal = 'done'; live.textContent = '별 10개 모으기 성공!'; }
}
function event(kind: 'star' | 'bump'): void {
  if (phase !== 'playing') return;
  if (kind === 'star') audio.tone('step', lastProgress?.stars || 0);
  else { audio.tone('turn'); gentleMessage.textContent = '괜찮아! 잠깐 쉬고 다시 씽씽'; gentleMessage.hidden = false; live.textContent = '괜찮아! 잠깐 느려져도 계속 달릴 수 있어요.'; clearTimeout(messageTimeout); messageTimeout = setTimeout(() => { gentleMessage.hidden = true; }, 1800); }
}
function finish(result: KartResult): void {
  if (awarded || phase !== 'playing') return;
  awarded = true; phase = 'finished'; setDriving(false); audio.stop(); audio.tone('record'); timeLeft.textContent = '0'; raceProgress.value = 1;
  const stars = count(result.stars, 10000); const data = store.records[runProfileId] ||= freshRecord(); data.wallet += stars; data.totalStars += stars; data.runs += 1; data.bestStars = Math.max(data.bestStars, stars); const stored = storeRecord();
  finishName.textContent = `${nameInput.value.trim()}의 1분 여행, 끝까지 성공했어요.`; finishStars.textContent = `★ ${stars}`; finishGoals.replaceChildren();
  [[true, '끝까지 완주했어요'], [stars >= 10, '별 10개를 모아요'], [result.bumps === 0, '부딪히지 않고 도착해요']].forEach(([achieved, text]) => { const goal = el('p', achieved ? 'achieved' : ''); goal.append(el('span', '', achieved ? '✓' : '○'), document.createTextNode(String(text))); finishGoals.append(goal); });
  finishSave.textContent = stored ? `별 ${stars}개가 차고에 쏙! 지금까지 ${data.wallet}개 모았어요.` : `별 ${stars}개를 모았어요. 저장 공간이 없어 지금 창에서만 기억해요.`;
  resultOverlay.hidden = false; renderChoices(); live.textContent = `멋지게 도착! 별 ${stars}개를 모았어요.`; retryButton.focus();
}
function startRun(): void {
  if (!scene || phase === 'playing' || phase === 'paused') return;
  let name: string;
  try { name = normalizeName(nameInput.value); }
  catch (error) { nameError.textContent = (error as Error).message; nameInput.focus(); return; }
  nameInput.value = name;
  nameError.textContent = ''; const previousId = profileId;
  profileId = nameKey(name);
  try { const profile = selectProfile(name); sharedProfileStored = persist(); if (!store.records[profileId] && store.records[profile.id]) store.records[profileId] = store.records[profile.id]; }
  catch { sharedProfileStored = false; }
  if (!sharedProfileStored) notify('친구 이름을 저장하지 못했어요. 다음에 같은 이름을 입력하면 별을 찾을 수 있어요.');
  if (previousId !== profileId && previousId === 'guest' && !store.records[profileId]) store.records[profileId] = { ...recordFor(previousId), owned: [...recordFor(previousId).owned] };
  runProfileId = profileId; const data = record(); awarded = false; phase = 'playing'; lastSeconds = -1; lastProgress = undefined; starCount.dataset.goal = ''; starCount.textContent = '★ 0'; starCount.setAttribute('aria-label', '모은 별 0개'); timeLeft.textContent = '60'; raceProgress.value = 0;
  readyOverlay.hidden = pauseOverlay.hidden = resultOverlay.hidden = true; gentleMessage.hidden = true; clearTimeout(messageTimeout); courseDialog.close(); garageDialog.close(); setDriving(true); renderChoices();
  audio.unlock(); audio.playMusic('challenge'); scene.startRun({ theme: data.theme, vehicle: data.vehicle }); live.textContent = '출발! 왼쪽, 오른쪽으로 움직여 별을 모아요.'; leftButton.focus({ preventScroll: true });
}
function recordFor(id: string): RecordData { return store.records[id] ||= freshRecord(); }
function pauseRun(): void {
  if (phase !== 'playing') return;
  phase = 'paused'; scene?.setPaused(true); audio.pause(); setDriving(false); pauseOverlay.hidden = false; gentleMessage.hidden = true; clearTimeout(messageTimeout); live.textContent = '잠깐 쉬는 중이에요. 이어서 달리기를 누르면 계속할 수 있어요.'; resumeButton.focus({ preventScroll: true });
}
function resumeRun(): void {
  if (phase !== 'paused') return;
  phase = 'playing'; pauseOverlay.hidden = true; scene?.setPaused(false); audio.resume(); setDriving(true); leftButton.focus({ preventScroll: true });
}
function resetReady(): void {
  audio.stop(); scene?.stop(); phase = 'ready'; awarded = false; readyOverlay.hidden = false; pauseOverlay.hidden = resultOverlay.hidden = true; gentleMessage.hidden = true; clearTimeout(messageTimeout); setDriving(false); timeLeft.textContent = '60'; starCount.textContent = '★ 0'; raceProgress.value = 0; renderChoices(); scene?.idle({ theme: record().theme, vehicle: record().vehicle }); startButton.focus({ preventScroll: true });
}
function move(direction: -1 | 1): void { if (phase === 'playing') scene?.move(direction); }
readyCard.addEventListener('submit', submit => { submit.preventDefault(); startRun(); });
nameInput.addEventListener('input', () => { nameError.textContent = ''; });
nameInput.addEventListener('change', () => {
  if (phase !== 'ready') return;
  let name: string; try { name = normalizeName(nameInput.value); } catch { return; }
  profileId = nameKey(name); const existing = saved.profiles.find(profile => profile.name === name); if (!store.records[profileId] && existing && store.records[existing.id]) store.records[profileId] = store.records[existing.id]; renderChoices(); scene?.idle({ theme: record().theme, vehicle: record().vehicle });
});
document.addEventListener('keydown', key => {
  if (app.querySelector('dialog[open]')) return;
  if (key.code === 'Tab' && (phase === 'paused' || phase === 'finished')) {
    const modal = phase === 'paused' ? pauseCard : resultCard;
    const focusable = [...modal.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (key.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { key.preventDefault(); last.focus(); }
    else if (!key.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { key.preventDefault(); first.focus(); }
    return;
  }
  const target = key.target as HTMLElement; if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) return;
  if (key.code === 'Escape') { key.preventDefault(); if (key.repeat) return; if (phase === 'playing') pauseRun(); else if (phase === 'paused') resumeRun(); return; }
  if (phase !== 'playing') return;
  if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(key.code)) { key.preventDefault(); if (!key.repeat) move(key.code === 'ArrowLeft' || key.code === 'KeyA' ? -1 : 1); }
});
let swipeStart: { x: number; y: number; id: number } | undefined;
canvasParent.addEventListener('pointerdown', pointer => { if (phase !== 'playing') return; swipeStart = { x: pointer.clientX, y: pointer.clientY, id: pointer.pointerId }; canvasParent.setPointerCapture(pointer.pointerId); });
canvasParent.addEventListener('pointerup', pointer => { if (!swipeStart || swipeStart.id !== pointer.pointerId) return; const dx = pointer.clientX - swipeStart.x; const dy = pointer.clientY - swipeStart.y; swipeStart = undefined; if (Math.abs(dx) > 22 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? -1 : 1); });
canvasParent.addEventListener('pointercancel', () => { swipeStart = undefined; });
for (const control of [leftButton, rightButton]) { control.addEventListener('pointerdown', () => control.classList.add('pressed')); ['pointerup', 'pointercancel', 'pointerleave', 'blur'].forEach(kind => control.addEventListener(kind, () => control.classList.remove('pressed'))); }
window.addEventListener('blur', () => pauseRun()); document.addEventListener('visibilitychange', () => { if (document.hidden) pauseRun(); }); window.addEventListener('pagehide', () => { pauseRun(); audio.pause(); });
renderChoices();
void createKartGame(canvasParent, { update, event, end: finish }).then(result => { scene = result.scene; scene.idle({ theme: record().theme, vehicle: record().vehicle }); startButton.disabled = false; startButton.textContent = '씽씽! 출발하기 →'; }).catch(() => { startButton.textContent = '게임을 다시 불러와요'; startButton.disabled = false; startButton.type = 'button'; startButton.addEventListener('click', () => window.location.reload()); readyFootnote.textContent = '게임을 불러오지 못했어요. 버튼을 눌러 다시 시작해요.'; });
