import './mini.css';
import { GameAudio } from './audio';
import { activeProfile, persist, saved, selectProfile } from './storage';
import { normalizeName } from '../functions/src/shared/rules';
import { MiniProgressStore } from './mini-storage';
import type { MiniAction, MiniGameDefinition, MiniSession, MiniStatus } from './mini-types';

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag); element.className = className; if (text) element.textContent = text; return element;
};
function button(text: string, className: string, action: () => void): HTMLButtonElement {
  const element = node('button', className, text); element.type = 'button'; element.addEventListener('click', action); return element;
}

export function mountMiniGame(definition: MiniGameDefinition): void {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.replaceChildren(); app.className = `mini-app mini-${definition.id}`;
  document.body.classList.add('mini-page');
  document.title = `${definition.title} · 지한이의 작은 오락실`;
  app.style.setProperty('--mini-accent', definition.accent);
  const hasPad = definition.controls.some(control => control.action === 'down');
  if (hasPad) app.classList.add('mini-has-pad');
  const store = new MiniProgressStore();
  let driver = activeProfile()?.name || '지한이';
  try { driver = normalizeName(driver); } catch { driver = '지한이'; }
  let phase: 'ready' | 'playing' | 'paused' | 'result' = 'ready';
  let session: MiniSession;
  let runId = '', runDriver = driver, lastStatus: MiniStatus | undefined, lastFeedback = '';
  let stage = 0, character = '', visualTime = 0;
  const audio = new GameAudio(); audio.setPreferences(saved.music, saved.sound);
  const header = node('header', 'mini-header');
  const brand = node('a', 'mini-brand'); brand.href = '/'; brand.append(node('span', 'mini-brand-mark', '✦'), node('strong', '', '지한이의 작은 오락실'));
  const nav = node('nav'); nav.setAttribute('aria-label', '게임 메뉴');
  const home = node('a', 'mini-home', '← 게임 고르기'); home.href = '/';
  const soundButton = button('♫', 'mini-icon-button', () => openDialog(soundDialog)); soundButton.setAttribute('aria-label', '음악과 효과음 설정');
  nav.append(home, soundButton); header.append(brand, nav); app.append(header);
  const main = node('main', 'mini-layout'); app.append(main);
  const intro = node('aside', 'mini-intro');
  intro.append(node('p', 'mini-kicker', definition.kicker), node('h1', '', definition.title), node('p', 'mini-tagline', definition.tagline), node('p', 'mini-description', definition.description));
  const guide = node('div', 'mini-guide'); guide.append(node('h2', '', '이렇게 놀아요'));
  for (const instruction of definition.instructions) {
    const row = node('div', 'mini-guide-row'), copy = node('p');
    copy.append(node('strong', '', instruction.title), node('span', '', instruction.copy)); row.append(node('span', 'mini-guide-icon', instruction.icon), copy); guide.append(row);
  }
  intro.append(guide, node('p', 'mini-keyboard-note', '화면의 큰 버튼이나 키보드로 움직여요. 화면을 밀어도 돼요.')); main.append(intro);
  const gameColumn = node('section', 'mini-game-column'); gameColumn.setAttribute('aria-label', `${definition.title} 게임`); main.append(gameColumn);
  const toolbar = node('div', 'mini-toolbar'), heading = node('div'); heading.append(node('span', 'mini-kicker', definition.kicker), node('h2', '', `${definition.icon} ${definition.title}`));
  const tools = node('div', 'mini-tools');
  const stageButton = button('🗺️ 코스', 'mini-chip', () => openDialog(stageDialog)); stageButton.hidden = !definition.stages?.length;
  const collectionButton = button('✦ 수집', 'mini-chip', () => openDialog(collectionDialog));
  const helpButton = button('?', 'mini-chip mini-help', () => openDialog(helpDialog)); helpButton.setAttribute('aria-label', '게임 방법 보기');
  tools.append(stageButton, collectionButton, helpButton); toolbar.append(heading, tools); gameColumn.append(toolbar);
  const board = node('div', 'mini-board'); gameColumn.append(board);
  const canvas = node('canvas', 'mini-canvas'); canvas.width = 840; canvas.height = 1120; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${definition.title}. ${definition.description}`); board.append(canvas);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');
  const hud = node('div', 'mini-hud'), hudTop = node('div', 'mini-hud-top');
  const stars = node('strong', 'mini-stars', '★ 0'), statusLabel = node('strong', 'mini-status-label', '준비!');
  const pauseButton = button('Ⅱ', 'mini-pause', pause); pauseButton.setAttribute('aria-label', '잠깐 쉬기'); pauseButton.disabled = true;
  hudTop.append(stars, statusLabel, pauseButton);
  const progress = node('progress', 'mini-progress'); progress.max = 1; progress.value = 0; progress.setAttribute('aria-label', '이번 모험의 진행');
  const detail = node('p', 'mini-detail'); hud.append(hudTop, progress, detail); board.append(hud);
  const ready = node('div', 'mini-ready'), form = node('form', 'mini-ready-card');
  form.append(node('p', 'mini-card-kicker', 'READY, LITTLE ADVENTURER?'), node('h2', '', '같이 모험을 떠나볼까?'));
  const nameLabel = node('label', 'mini-name'); nameLabel.htmlFor = 'mini-player-name'; nameLabel.append(node('span', 'sr-only', '친구 이름'), node('span', '', '☺'));
  const nameInput = node('input'); nameInput.id = 'mini-player-name'; nameInput.maxLength = 12; nameInput.required = true; nameInput.setAttribute('autocomplete', 'nickname'); nameInput.value = driver; nameInput.placeholder = '친구 이름'; nameInput.setAttribute('aria-describedby', 'mini-name-error');
  nameLabel.append(nameInput, node('small', '', '의 모험'));
  const nameError = node('p', 'mini-error'); nameError.id = 'mini-name-error'; nameError.setAttribute('role', 'alert');
  const readyChoice = node('p', 'mini-ready-choice');
  const startButton = node('button', 'mini-primary', `${definition.startLabel} →`); startButton.type = 'submit';
  form.append(nameLabel, nameError, readyChoice, startButton, node('p', 'mini-ready-note', definition.id === 'maze' ? '시간 걱정 없이, 천천히 찾아봐요.' : '처음엔 천천히! 실수해도 다시 해볼 수 있어요.')); ready.append(form); board.append(ready);
  const feedback = node('p', 'mini-feedback'); feedback.hidden = true; board.append(feedback);
  const controls = node('div', `mini-controls${hasPad ? ' mini-direction-pad' : ''}`); controls.setAttribute('aria-label', '게임 조작'); gameColumn.append(controls);
  const actionButtons: HTMLButtonElement[] = [];
  for (const control of definition.controls) {
    const target = node('button', `mini-control mini-control-${control.action}`); target.type = 'button'; target.disabled = true; target.setAttribute('aria-label', control.label);
    target.append(node('span', 'mini-control-icon', control.icon), node('span', '', control.label));
    target.addEventListener('pointerdown', event => { event.preventDefault(); act(control.action); target.classList.add('pressed'); });
    target.addEventListener('click', event => { if (event.detail === 0) act(control.action); });
    for (const type of ['pointerup', 'pointerleave', 'pointercancel', 'blur']) target.addEventListener(type, () => target.classList.remove('pressed'));
    controls.append(target); actionButtons.push(target);
  }
  gameColumn.append(node('p', 'mini-below', '오늘도 내 속도로, 즐겁게 놀아요.'));
  const sidebar = node('aside', 'mini-sidebar'), stageList = node('div', 'mini-stage-list'), collectionList = node('div', 'mini-character-list');
  sidebar.append(node('p', 'mini-kicker', 'MY LITTLE ADVENTURE'), node('h2', '', '오늘의 모험'), stageList, node('h2', 'mini-collection-heading', '나의 작은 수집함'), collectionList); main.append(sidebar);
  const recordLabel = node('p', 'mini-record-label'), storageNote = node('p', 'mini-storage-note'); sidebar.append(recordLabel, storageNote);
  app.append(node('footer', 'mini-footer', '작은 도전, 커다란 즐거움 ✦'));
  const live = node('p', 'sr-only'); live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); app.append(live);
  const toast = node('p', 'mini-toast'); toast.hidden = true; app.append(toast);
  let toastTimer: ReturnType<typeof setTimeout>, feedbackTimer: ReturnType<typeof setTimeout>;
  function notify(message: string): void {
    live.textContent = message; toast.textContent = message; toast.hidden = false;
    const dialogStatus = app.querySelector<HTMLElement>('dialog[open] .mini-dialog-status'); if (dialogStatus) dialogStatus.textContent = message;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
  }
  function makeDialog(title: string): { dialog: HTMLDialogElement; body: HTMLDivElement } {
    const dialog = node('dialog', 'mini-dialog'); const id = `mini-dialog-${app.querySelectorAll('dialog').length}`;
    const top = node('div', 'mini-dialog-top'), titleElement = node('h2', '', title); titleElement.id = id; dialog.setAttribute('aria-labelledby', id);
    const close = button('×', 'mini-dialog-close', () => dialog.close()); close.setAttribute('aria-label', '닫기'); top.append(titleElement, close);
    const body = node('div', 'mini-dialog-body'), dialogStatus = node('p', 'mini-dialog-status'); dialogStatus.setAttribute('role', 'status');
    dialog.append(top, body, dialogStatus); app.append(dialog);
    dialog.addEventListener('click', event => { if (event.target !== dialog) return; const rectangle = dialog.getBoundingClientRect(); if (event.clientX < rectangle.left || event.clientX > rectangle.right || event.clientY < rectangle.top || event.clientY > rectangle.bottom) dialog.close(); });
    return { dialog, body };
  }
  const { dialog: stageDialog, body: stageDialogBody } = makeDialog('어디로 떠날까?');
  const { dialog: collectionDialog, body: collectionBody } = makeDialog('나의 작은 수집함');
  const { dialog: helpDialog, body: helpBody } = makeDialog('이렇게 놀아요'); helpBody.append(guide.cloneNode(true));
  const { dialog: soundDialog, body: soundBody } = makeDialog('소리도 함께 즐겨요');
  for (const [field, title] of [['music', '배경 음악'], ['sound', '효과음']] as const) {
    const label = node('label', 'mini-sound-setting', title), input = node('input'); input.type = 'checkbox'; input.checked = saved[field];
    input.addEventListener('change', () => { saved[field] = input.checked; persist(); audio.setPreferences(saved.music, saved.sound); audio.unlock(); }); label.append(input); soundBody.append(label);
  }
  const pauseDialog = node('dialog', 'mini-dialog mini-pause-dialog'); pauseDialog.setAttribute('aria-labelledby', 'mini-pause-heading');
  const pauseHeading = node('h2', '', '잠깐 쉬어가요'); pauseHeading.id = 'mini-pause-heading';
  const resumeButton = button('이어서 놀기 →', 'mini-primary', resume);
  pauseDialog.append(node('div', 'mini-dialog-art', '☁'), pauseHeading, node('p', '', '친구가 여기서 기다리고 있어요.'), resumeButton, button('처음으로 돌아가기', 'mini-secondary', reset)); app.append(pauseDialog);
  const resultDialog = node('dialog', 'mini-dialog mini-result-dialog'); resultDialog.setAttribute('aria-labelledby', 'mini-result-heading');
  const resultHeading = node('h2', '', '멋지게 해냈어!'); resultHeading.id = 'mini-result-heading';
  const resultSummary = node('p', 'mini-result-summary'), resultStars = node('strong', 'mini-result-stars'), resultScore = node('p', 'mini-result-score'), resultSave = node('p', 'mini-result-save');
  const retryButton = button('한 번 더 놀기 →', 'mini-primary', start);
  resultDialog.append(node('div', 'mini-dialog-art', '🏅'), resultHeading, resultSummary, resultStars, resultScore, resultSave, retryButton, button('코스 · 친구 고르기', 'mini-secondary', reset)); app.append(resultDialog);
  pauseDialog.addEventListener('cancel', event => { event.preventDefault(); resume(); }); resultDialog.addEventListener('cancel', event => { event.preventDefault(); reset(); });
  function openDialog(dialog: HTMLDialogElement): void { pause(); dialog.querySelector<HTMLElement>('.mini-dialog-status')!.textContent = ''; dialog.showModal(); }
  function recordName(): string { try { return normalizeName(nameInput.value); } catch { return driver; } }
  function drawStages(parent: HTMLElement, inDialog = false): void {
    parent.replaceChildren();
    (definition.stages || []).forEach((item, index) => {
      const choice = button('', 'mini-stage-choice', () => {
        if (phase !== 'ready') return; stage = index; store.selectStage(recordName(), definition.id, stage); renderChoices(); preview(); if (inDialog) stageDialog.close();
      });
      choice.disabled = phase !== 'ready'; choice.setAttribute('aria-pressed', String(stage === index)); choice.append(node('span', 'mini-choice-icon', item.icon), node('strong', '', item.name), node('small', '', item.copy)); parent.append(choice);
    });
  }
  function drawCharacters(parent: HTMLElement): void {
    parent.replaceChildren(); const record = store.get(recordName(), definition.id);
    for (const item of definition.characters || []) {
      const owned = item.cost === 0 || record.owned.includes(item.id), selected = item.id === character;
      const choice = button('', 'mini-character-choice', () => {
        if (phase !== 'ready') return;
        const result = store.chooseCharacter(recordName(), definition.id, item.id, item.cost);
        if (result === 'insufficient') { notify(`별 ${Math.max(0, item.cost - record.wallet)}개를 더 모으면 만날 수 있어요!`); return; }
        character = item.id; notify(result === 'purchased' ? `${item.name} 친구를 만났어요!` : `${item.name}, 함께 놀자!`); renderChoices(); preview();
      });
      choice.disabled = phase !== 'ready'; choice.setAttribute('aria-pressed', String(selected)); choice.setAttribute('aria-label', `${item.name}, ${selected ? '선택됨' : owned ? '선택하기' : `별 ${item.cost}개로 만나기`}`);
      choice.append(node('span', 'mini-choice-icon', item.icon), node('strong', '', item.name), node('small', '', selected ? '함께 놀고 있어요 ✓' : owned ? '친구로 고르기' : `★ ${item.cost}`)); parent.append(choice);
    }
  }
  function renderChoices(): void {
    const record = store.get(recordName(), definition.id);
    drawStages(stageList); drawStages(stageDialogBody, true); drawCharacters(collectionList);
    collectionBody.replaceChildren(node('p', 'mini-wallet', `내가 모은 별 ★ ${record.wallet}`)); const characters = node('div', 'mini-character-list'); drawCharacters(characters); collectionBody.append(characters, node('p', 'mini-local-note', '친구의 모습만 달라져요. 모은 별과 기록은 이 브라우저에 이름별로 저장돼요.'));
    recordLabel.textContent = `${definition.id === 'maze' ? '가장 짧은 모험' : '나의 최고'} ${record.best} ${definition.scoreUnit} · 완주 ${record.runs}번 · ★ ${record.wallet}`;
    storageNote.textContent = store.available ? '모은 별과 기록은 이 브라우저에 이름별로 저장돼요.' : '저장 공간을 사용할 수 없어 지금 창에서만 기억해요.';
    readyChoice.textContent = `${definition.stages?.[stage]?.name || definition.title} · ${definition.characters?.find(item => item.id === character)?.name || '나의 모험'}`;
    stageButton.disabled = collectionButton.disabled = phase !== 'ready';
  }
  function restorePreferences(): void {
    const record = store.get(recordName(), definition.id);
    stage = Math.min(record.stage, Math.max(0, (definition.stages?.length || 1) - 1));
    character = definition.characters?.find(item => item.id === record.character && (item.cost === 0 || record.owned.includes(item.id)))?.id || definition.characters?.[0]?.id || 'default';
  }
  function preview(): void { session = definition.create({ seed: 73129, level: stage, character }); lastStatus = undefined; updateHUD(session.getStatus()); }
  function updateHUD(status: MiniStatus): void {
    stars.textContent = `★ ${status.stars}`; statusLabel.textContent = status.label; detail.textContent = status.detail; progress.value = Math.max(0, Math.min(1, status.progress));
  }
  function setControls(enabled: boolean): void { actionButtons.forEach(target => { target.disabled = !enabled; }); pauseButton.disabled = !enabled; board.dataset.phase = phase; }
  function start(): void {
    if (phase === 'playing' || phase === 'paused') return;
    try { driver = normalizeName(nameInput.value); } catch (error) { nameError.textContent = (error as Error).message; nameInput.focus(); return; }
    nameInput.value = driver; nameError.textContent = ''; restorePreferences();
    try { selectProfile(driver); if (!persist()) notify('친구 이름을 저장하지 못했어요. 다음에도 같은 이름으로 놀면 기록을 찾을 수 있어요.'); } catch { /* Name-based records remain usable when shared identity cannot be stored. */ }
    resultDialog.close(); runId = crypto.randomUUID?.() || `${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`; runDriver = driver;
    session = definition.create({ seed: crypto.getRandomValues(new Uint32Array(1))[0], level: stage, character });
    phase = 'playing'; lastStatus = undefined; lastFeedback = ''; visualTime = 0; ready.hidden = true; feedback.hidden = true; setControls(true); renderChoices();
    nameInput.blur(); actionButtons[0]?.focus({ preventScroll: true });
    audio.unlock(); audio.playMusic(definition.id === 'maze' ? 'practice' : 'challenge'); live.textContent = `${definition.title}, 출발!`;
    if (document.hidden || !document.hasFocus()) pause();
  }
  function pause(): void {
    if (phase !== 'playing') return; phase = 'paused'; setControls(false); audio.pause(); pauseDialog.showModal(); resumeButton.focus({ preventScroll: true });
  }
  function resume(): void {
    if (phase !== 'paused') return; phase = 'playing'; pauseDialog.close(); setControls(true); audio.resume(); actionButtons[0]?.focus({ preventScroll: true });
  }
  function reset(): void {
    audio.stop(); pauseDialog.close(); resultDialog.close(); phase = 'ready'; ready.hidden = false; feedback.hidden = true; setControls(false); restorePreferences(); renderChoices(); preview(); startButton.focus({ preventScroll: true });
  }
  function finish(status: MiniStatus): void {
    if (phase !== 'playing') return;
    phase = 'result'; setControls(false); audio.stop(); audio.tone('record');
    const result = store.award(runDriver, definition.id, runId, status.stars, status.score);
    resultHeading.textContent = status.won ? '멋지게 해냈어!' : '아주 멋진 도전!'; resultSummary.textContent = status.summary; resultStars.textContent = `★ ${status.stars}`; resultScore.textContent = `${runDriver} · ${status.score} ${definition.scoreUnit}`;
    resultSave.textContent = result.stored ? `모은 별을 수집함에 넣었어요. 지금까지 ★ ${result.record.wallet}` : '저장 공간이 없어 기록은 지금 창에서만 기억해요.';
    renderChoices(); resultDialog.showModal(); retryButton.focus({ preventScroll: true }); live.textContent = `${status.summary} 별 ${status.stars}개를 모았어요.`;
  }
  function sync(): void {
    const status = session.getStatus(); updateHUD(status);
    if (!status.feedback) lastFeedback = '';
    if (phase === 'playing') {
      if (lastStatus && status.stars > lastStatus.stars) audio.tone('step', status.stars);
      if (lastStatus && (status.mistakes || 0) > (lastStatus.mistakes || 0)) audio.tone('turn');
      if (status.feedback && (status.feedback !== lastFeedback || lastStatus && (status.stars > lastStatus.stars || (status.mistakes || 0) > (lastStatus.mistakes || 0)))) {
        lastFeedback = status.feedback; feedback.textContent = status.feedback; feedback.hidden = false; live.textContent = status.feedback; clearTimeout(feedbackTimer); feedbackTimer = setTimeout(() => { feedback.hidden = true; }, 2400);
      }
      if (status.finished) finish(status);
    }
    lastStatus = status;
  }
  function act(action: MiniAction): void { if (phase !== 'playing') return; if (action === 'hint') lastFeedback = ''; session.act(action); sync(); }
  form.addEventListener('submit', event => { event.preventDefault(); start(); });
  nameInput.addEventListener('input', () => { nameError.textContent = ''; });
  nameInput.addEventListener('change', () => { if (phase !== 'ready') return; try { normalizeName(nameInput.value); } catch { return; } restorePreferences(); renderChoices(); preview(); });
  let lastKeyAt = 0;
  document.addEventListener('keydown', event => {
    if (app.querySelector('dialog[open]') || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target as HTMLElement).isContentEditable) return;
    if (event.code === 'Escape') { event.preventDefault(); if (!event.repeat) pause(); return; }
    if (event.code === 'Space' && event.target instanceof HTMLElement && event.target.closest('button') && !controls.contains(event.target)) return;
    const control = definition.controls.find(item => item.keys.includes(event.code) || item.keys.includes(event.key));
    if (control && phase === 'playing') { event.preventDefault(); if (!event.repeat || performance.now() - lastKeyAt > 130) { lastKeyAt = performance.now(); act(control.action); } }
  });
  let pointer: { id: number; x: number; y: number } | undefined;
  canvas.addEventListener('pointerdown', event => { if (phase !== 'playing') return; pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return; const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y; pointer = undefined;
    const action: MiniAction = definition.controls.some(item => item.action === 'jump') ? 'jump' : Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down';
    if (action === 'jump' || Math.max(Math.abs(dx), Math.abs(dy)) > 20) act(action);
  });
  canvas.addEventListener('pointercancel', () => { pointer = undefined; });
  window.addEventListener('blur', pause); document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }); window.addEventListener('pagehide', () => { pause(); audio.pause(); });
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  restorePreferences(); renderChoices(); preview(); setControls(false);
  let previousTime = performance.now();
  function frame(time: number): void {
    const delta = Math.max(0, Math.min(100, time - previousTime)); previousTime = time;
    if (phase === 'playing' && !document.hidden) { session.advance(delta); sync(); }
    if (phase !== 'paused' && !document.hidden) visualTime += delta;
    context!.setTransform(2, 0, 0, 2, 0, 0); context!.clearRect(0, 0, 420, 560);
    context!.save(); definition.draw(context!, session, { width: 420, height: 560, time: visualTime, reducedMotion: motion.matches }); context!.restore();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
