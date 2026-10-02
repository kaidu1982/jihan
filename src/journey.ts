import { ACHIEVEMENTS, ADVENTURE_STAGES, COMPANIONS, DAILY_MISSIONS, worldById, type AdventureStage, type CompanionId } from './content';
import { achievementProgress, missionProgress, seoulDateKey, type ProfileProgress, type ProgressStore } from './progression';

type Options = {
  store: ProgressStore;
  profile: () => { id: string; name: string } | undefined;
  ensureProfile: () => { id: string; name: string } | undefined;
  stage: () => string;
  selectStage: (stage: AdventureStage) => void;
  selectDaily: () => void;
  equip: (companion: CompanionId) => void;
  notify: (text: string) => void;
  beforeOpen: () => void;
};
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const number = (value: number) => value.toLocaleString('ko-KR');
const color = (value: number) => `#${value.toString(16).padStart(6, '0')}`;

export class JourneyBook {
  private tab: 'map' | 'friends' | 'badges' = 'map';
  constructor(private options: Options) {
    const dialog = document.createElement('dialog');
    dialog.id = 'journey-dialog'; dialog.setAttribute('aria-labelledby', 'journey-title');
    dialog.innerHTML = `<div class="dialog-header"><div><span class="eyebrow">A LITTLE WORLD, A BIG ADVENTURE</span><h2 id="journey-title">나의 모험 수첩</h2></div><button class="dialog-close" aria-label="모험 수첩 닫기">×</button></div><div class="journey-summary" id="journey-summary"></div><div class="journey-tabs" role="tablist" aria-label="모험 수첩 메뉴"><button id="journey-tab-map" role="tab" aria-controls="journey-panel" data-tab="map">모험 지도</button><button id="journey-tab-friends" role="tab" aria-controls="journey-panel" data-tab="friends">동행 친구</button><button id="journey-tab-badges" role="tab" aria-controls="journey-panel" data-tab="badges">배지 · 미션</button></div><div id="journey-panel" role="tabpanel"></div><p class="journey-note">별과 친구, 모험 기록은 이 브라우저에 저장돼요.<br>친구들은 함께 걷는 꾸미기예요. 점수에는 영향을 주지 않아요.</p>`;
    document.body.append(dialog);
    dialog.querySelector('.dialog-close')!.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
    });
    dialog.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button => {
      button.addEventListener('click', () => { this.tab = button.dataset.tab as typeof this.tab; this.render(); });
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const tabs = ['map', 'friends', 'badges'] as const;
        const current = tabs.indexOf(this.tab);
        this.tab = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (current + (event.key === 'ArrowRight' ? 1 : 2)) % 3];
        this.render(); $<HTMLButtonElement>(`#journey-tab-${this.tab}`).focus();
      });
    });
    $('#journey-open').addEventListener('click', () => this.open());
    $('#missions-open').addEventListener('click', () => this.open('badges'));
  }
  progress(): ProfileProgress { return this.options.store.get(this.options.profile()?.id || 'preview'); }
  open(tab: typeof this.tab = 'map'): void {
    this.tab = tab; this.options.beforeOpen(); this.render();
    if (!$<HTMLDialogElement>('#journey-dialog').open) $<HTMLDialogElement>('#journey-dialog').showModal();
  }
  refresh(): void {
    const p = this.progress();
    $('#journey-wallet').textContent = `${number(p.stars)} 별`;
    $('#journey-caption').textContent = `모험 ${p.completedStages.length}/5 · 친구 ${p.ownedCompanions.length}/6`;
    $('#mission-caption').textContent = `${p.daily.missionIds.length}/3 완료`;
    if ($<HTMLDialogElement>('#journey-dialog').open) this.render();
  }
  private render(): void {
    const p = this.progress();
    const profile = this.options.profile();
    $('#journey-title').textContent = profile ? `${profile.name}의 모험 수첩` : '나의 모험 수첩';
    $('#journey-summary').innerHTML = `<div><span class="journey-wallet-big">✦ ${number(p.stars)}</span><small>모은 별</small></div><div><strong>${number(p.totalStairs)}</strong><small>함께 오른 계단</small></div><div><strong>${p.achievements.length}<small class="inline-small"> / 8</small></strong><small>반짝이는 배지</small></div>`;
    document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button => {
      const selected = button.dataset.tab === this.tab;
      button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
    });
    $('#journey-panel').setAttribute('aria-labelledby', `journey-tab-${this.tab}`);
    if (this.tab === 'map') this.renderMap(p);
    else if (this.tab === 'friends') this.renderFriends(p);
    else this.renderBadges(p);
    if (!profile) {
      const note = document.createElement('p'); note.className = 'journey-empty-note';
      note.textContent = '게임에서 이름을 정하면 나만의 모험이 시작돼요.';
      $('#journey-panel').append(note);
    }
  }
  private renderMap(p: ProfileProgress): void {
    const profileId = this.options.profile()?.id || 'preview';
    $('#journey-panel').innerHTML = `<p class="book-intro">다섯 세상을 잇는 작은 발걸음.<br>시간 제한 없이, 실수 세 번 전까지 목적지에 도착해요.</p><div class="adventure-map">${ADVENTURE_STAGES.map((stage, index) => {
      const world = worldById(stage.worldId);
      const unlocked = this.options.store.isStageUnlocked(profileId, stage.id);
      const cleared = p.completedStages.includes(stage.id);
      return `<button class="stage-card ${cleared ? 'cleared' : ''} ${stage.id === this.options.stage() ? 'selected-stage' : ''}" data-stage="${stage.id}" ${unlocked ? '' : 'disabled'} style="--world-top:${color(world.palette.skyTop)};--world-bottom:${color(world.palette.skyBottom)}"><span class="stage-art" aria-hidden="true"><i>${world.icon}</i><b>${String(index + 1).padStart(2, '0')}</b></span><span class="stage-copy"><small>${world.name} · ${stage.goal}계단</small><strong>${stage.title}</strong><span>${cleared ? '완주했어요 · 다시 놀기' : unlocked ? `첫 완주 선물 ✦ ${stage.reward}별` : '앞의 모험을 먼저 완주해요'}</span></span><span class="stage-mark" aria-hidden="true">${cleared ? '✓' : unlocked ? '↗' : '🔒'}</span></button>`;
    }).join('')}</div><button class="daily-invitation" id="book-daily"><span>☀️</span><span><strong>오늘의 계단</strong><small>${seoulDateKey()} · 모두 같은 150계단<br>오늘 나의 최고 ${p.daily.best}계단</small></span><b>↗</b></button>`;
    document.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach(button => button.addEventListener('click', () => {
      const stage = ADVENTURE_STAGES.find(item => item.id === button.dataset.stage)!;
      this.options.selectStage(stage); $<HTMLDialogElement>('#journey-dialog').close();
    }));
    $('#book-daily').addEventListener('click', () => { this.options.selectDaily(); $<HTMLDialogElement>('#journey-dialog').close(); });
  }
  private renderFriends(p: ProfileProgress): void {
    $('#journey-panel').innerHTML = `<p class="book-intro">열 계단마다 작은 별 하나.<br>모은 별로 마음에 드는 친구를 만나보세요.</p><div class="companion-grid">${COMPANIONS.map(friend => {
      const owned = p.ownedCompanions.includes(friend.id), equipped = p.equippedCompanion === friend.id;
      return `<article class="companion-card ${equipped ? 'equipped' : ''}"><div class="companion-portrait companion-${friend.id}" aria-hidden="true">${friend.icon}</div><strong>${friend.name}</strong><p>${friend.description}</p><button data-companion="${friend.id}" ${equipped || (!owned && p.stars < friend.cost) ? 'disabled' : ''}>${equipped ? '✓ 함께 걷는 중' : owned ? '함께 걷기' : p.stars < friend.cost ? `✦ ${friend.cost} · ${friend.cost - p.stars}별 더 모아요` : `✦ ${friend.cost}별로 만나기`}</button></article>`;
    }).join('')}</div>`;
    document.querySelectorAll<HTMLButtonElement>('[data-companion]').forEach(button => button.addEventListener('click', () => {
      const profile = this.options.profile() || this.options.ensureProfile(); if (!profile) return;
      const id = button.dataset.companion as CompanionId;
      const current = this.options.store.get(profile.id);
      const result = current.ownedCompanions.includes(id) ? this.options.store.equip(profile.id, id) : this.options.store.purchase(profile.id, id);
      if (!result.ok) { this.options.notify('별이 조금 더 필요해요. 계단을 함께 올라볼까요?'); return; }
      const equipped = this.options.store.equip(profile.id, id);
      this.options.equip(id); this.refresh();
      this.options.notify(equipped.stored && result.stored ? `${COMPANIONS.find(item => item.id === id)!.name}와 함께 걸어요!` : '지금은 함께할 수 있지만, 브라우저에 저장하지 못했어요.');
    }));
  }
  private renderBadges(p: ProfileProgress): void {
    $('#journey-panel').innerHTML = `<div class="book-section-heading"><h3>오늘의 작은 미션</h3><span>한국 시간 자정에 새로 만나요</span></div><div class="mission-list">${DAILY_MISSIONS.map(mission => {
      const value = Math.min(mission.goal, missionProgress(p, mission.id)), done = p.daily.missionIds.includes(mission.id);
      return `<div class="mission-row ${done ? 'done' : ''}"><span aria-hidden="true">${done ? '✓' : mission.icon}</span><div><strong>${mission.title}<small>✦ ${mission.reward}</small></strong><p>${mission.description}</p><progress max="${mission.goal}" value="${value}" aria-label="${mission.title}"></progress><small>${value} / ${mission.goal}${done ? ' · 선물 받았어요' : ''}</small></div></div>`;
    }).join('')}</div><div class="book-section-heading"><h3>발걸음이 남긴 배지</h3><span>${p.achievements.length} / 8</span></div><div class="badge-grid">${ACHIEVEMENTS.map(badge => {
      const done = p.achievements.includes(badge.id), value = Math.min(badge.goal, achievementProgress(p, badge.id));
      return `<article class="badge-card ${done ? 'earned' : ''}"><span aria-hidden="true">${badge.icon}</span><strong>${badge.title}</strong><p>${badge.description}</p><small>${done ? '✓ 받았어요' : `${value} / ${badge.goal}`} · ✦ ${badge.reward}</small></article>`;
    }).join('')}</div>`;
  }
}
