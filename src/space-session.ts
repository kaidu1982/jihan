import type { MiniAction, MiniOptions, MiniSession, MiniStatus } from './mini-types';

export const SPACE_DURATION_MS = 54_000;
export const SPACE_LOOKAHEAD_MS = 6_000;
export const SPACE_SIGNAL_RANGE_MS = 1_000;
export const SPACE_SIGNAL_CHARGES = 3;
export const SPACE_COMBO_SIZE = 3;
export const SPACE_COMBO_REWARD = 2;
export type SpaceObject = {
  id: number;
  wave: number;
  kind: 'friend' | 'star' | 'meteor';
  lane: number;
  arrivalAt: number;
  variant: number;
  outcome: 'pending' | 'collected' | 'bumped' | 'shielded' | 'missed';
};
export type SpaceWave = { arrivalAt: number; safeLane: number; meteorLanes: number[] };

/** Every rescue has an adjacent, unobstructed approach marked by a trail of stars. */
export function makeSpaceMission(seed: number, level = 0): { objects: SpaceObject[]; waves: SpaceWave[] } {
  let state = ((Number.isFinite(seed) ? Math.floor(seed) : 104729) + level * 2654435761) >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const objects: SpaceObject[] = [], waves: SpaceWave[] = [];
  let lane = 1;
  const add = (wave: number, kind: SpaceObject['kind'], objectLane: number, arrivalAt: number, variant: number) => {
    objects.push({ id: objects.length, wave, kind, lane: objectLane, arrivalAt, variant, outcome: 'pending' });
  };
  for (let wave = 0; wave < 12; wave++) {
    const choices = [lane - 1, lane, lane + 1].filter(value => value >= 0 && value <= 2);
    lane = choices[Math.floor(random() * choices.length)];
    const arrivalAt = 6_000 + wave * 3_900;
    const otherLanes = [0, 1, 2].filter(value => value !== lane);
    const meteorLanes = wave < 2 || (level === 0 && random() < .5)
      ? [otherLanes[Math.floor(random() * otherLanes.length)]] : otherLanes;
    waves.push({ arrivalAt, safeLane: lane, meteorLanes });
    for (const offset of [-1_100, -650]) add(wave, 'star', lane, arrivalAt + offset, wave % 3);
    add(wave, 'friend', lane, arrivalAt, wave % 4);
    for (const meteorLane of meteorLanes) add(wave, 'meteor', meteorLane, arrivalAt, Math.floor(random() * 6));
  }
  objects.sort((a, b) => a.arrivalAt - b.arrivalAt || a.id - b.id);
  return { objects, waves };
}

/** Active time only: the host pauses this model by withholding advance(). */
export class SpaceSession implements MiniSession {
  readonly objects: SpaceObject[];
  readonly waves: SpaceWave[];
  readonly duration = SPACE_DURATION_MS;
  readonly level: number;
  readonly character: string;
  elapsed = 0;
  lane = 1;
  targetLane = 1;
  rescued = 0;
  combo = 0;
  bestCombo = 0;
  comboBonusStars = 0;
  comboBonusUntil = 0;
  stars = 0;
  bumps = 0;
  signalsRemaining = SPACE_SIGNAL_CHARGES;
  signalledRescues = 0;
  signalRescue: { variant: number; lane: number; arrivalAt: number; startedAt: number } | undefined;
  finished = false;
  shieldUntil = 0;
  private feedback = '';
  private feedbackUntil = 0;

  constructor(options: MiniOptions = { seed: 104729, level: 0, character: 'comet' }) {
    this.level = Math.max(0, Math.min(2, Math.floor(options.level) || 0));
    this.character = options.character;
    const mission = makeSpaceMission(options.seed, this.level);
    this.objects = mission.objects;
    this.waves = mission.waves;
  }

  get shielded(): boolean { return this.elapsed < this.shieldUntil; }
  get nextFriend(): SpaceObject | undefined {
    return this.objects.find(object => object.kind === 'friend' && object.outcome === 'pending');
  }
  get signalTarget(): SpaceObject | undefined {
    return this.objects.find(object => object.kind === 'friend' && object.outcome === 'pending'
      && object.arrivalAt >= this.elapsed - 1e-6 && object.arrivalAt - this.elapsed <= SPACE_SIGNAL_RANGE_MS + 1e-6
      && Math.abs(object.lane - this.lane) <= 1.1);
  }

  act(action: MiniAction): void {
    if (this.finished) return;
    if (action === 'left') this.targetLane = Math.max(0, this.targetLane - 1);
    if (action === 'right') this.targetLane = Math.min(2, this.targetLane + 1);
    if (action === 'signal') {
      if (this.signalsRemaining <= 0) {
        this.announce('구조 신호를 다 썼어. 별길을 따라 친구를 만나자!', 1_500);
        return;
      }
      const target = this.signalTarget;
      if (!target) {
        this.announce('친구가 우주선 가까이 오면 구조 신호를 보내요!', 1_300);
        return;
      }
      this.signalsRemaining--;
      this.signalledRescues++;
      this.rescue(target, true);
      this.signalRescue = { variant: target.variant, lane: target.lane, arrivalAt: target.arrivalAt, startedAt: this.elapsed };
    }
  }

  advance(deltaMs: number): void {
    if (this.finished || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
    let remaining = Math.min(deltaMs, this.duration - this.elapsed);
    while (remaining > 1e-7) {
      const step = Math.min(1000 / 120, remaining);
      const before = this.elapsed;
      const previousLane = this.lane;
      const gap = this.targetLane - this.lane;
      this.lane += Math.sign(gap) * Math.min(Math.abs(gap), 3.6 * step / 1000);
      this.elapsed = Math.min(this.duration, this.elapsed + step);
      for (const object of this.objects) {
        if (object.outcome !== 'pending') continue;
        if (object.arrivalAt > this.elapsed + 1e-7) break;
        // Interpolate the swept ship path at the object's arrival plane. Long frames
        // cannot skip a rescue or meteor, and a missed object cannot be collected later.
        const fraction = Math.max(0, Math.min(1, (object.arrivalAt - before) / step));
        const crossingLane = previousLane + (this.lane - previousLane) * fraction;
        const radius = object.kind === 'meteor' ? .39 : .49;
        if (Math.abs(crossingLane - object.lane) > radius) {
          object.outcome = 'missed';
          if (object.kind === 'friend') this.breakCombo();
        } else if (object.kind === 'meteor') {
          this.breakCombo();
          if (object.arrivalAt < this.shieldUntil) object.outcome = 'shielded';
          else {
            object.outcome = 'bumped';
            this.bumps++;
            this.shieldUntil = object.arrivalAt + 1_800;
            this.announce('보호막이 지켜줬어! 계속 날아가자', 1_800);
          }
        } else {
          if (object.kind === 'friend') {
            this.rescue(object, false);
          } else {
            object.outcome = 'collected';
            this.stars++;
            this.announce('반짝! 별을 모았어', 700);
          }
        }
      }
      remaining -= step;
    }
    // Avoid floating-point accumulation leaving a completed mission one frame short.
    if (this.elapsed >= this.duration - 1e-6) {
      this.elapsed = this.duration;
      this.finished = true;
    }
  }

  /** Both ways of rescuing a friend share one receipt and one combo reward. */
  private rescue(object: SpaceObject, signalled: boolean): void {
    if (this.finished || object.kind !== 'friend' || object.outcome !== 'pending') return;
    object.outcome = 'collected';
    this.rescued++;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const bonus = this.combo % SPACE_COMBO_SIZE === 0;
    if (bonus) {
      this.stars += SPACE_COMBO_REWARD;
      this.comboBonusStars += SPACE_COMBO_REWARD;
      this.comboBonusUntil = this.elapsed + 1_500;
    }
    this.announce(`${signalled ? '구조 신호 도착!' : '친구 구조!'} ${this.combo}명 연속${bonus ? ' · 함께해서 별 +2!' : ` · ${this.rescued}명이 함께해`}`, 1_600);
  }

  private breakCombo(): void {
    if (this.combo > 0) this.announce('다시 친구들을 이어 보자! 모은 별은 그대로야', 1_400);
    this.combo = 0;
  }

  private announce(message: string, duration: number): void {
    this.feedback = message;
    this.feedbackUntil = this.elapsed + duration;
  }

  getStatus(): MiniStatus {
    const totalFriends = this.waves.length;
    return {
      score: this.rescued,
      stars: this.stars,
      progress: Math.min(1, this.elapsed / this.duration),
      label: `${Math.ceil(Math.max(0, this.duration - this.elapsed) / 1000)}초`,
      detail: `구조 ${this.rescued}/${totalFriends} · ${this.combo}명 연속 · 신호 ${this.signalsRemaining}번${this.signalsRemaining > 0 && this.signalTarget ? ' · 지금 구조 가능!' : ''}`,
      finished: this.finished,
      won: this.finished && this.rescued >= 3,
      summary: this.rescued >= 3
        ? `우주 정거장 도착! 친구 ${this.rescued}명을 데려왔어. 최고 ${this.bestCombo}명 연속 구조! 별 ${this.stars}개 중 함께 모은 보너스는 ${this.comboBonusStars}개야.`
        : `우주 정거장 도착! 친구 ${this.rescued}명과 별 ${this.stars}개를 만났어. 최고 ${this.bestCombo}명 연속 구조! 다음 탐험에서는 친구 3명 구조에 도전하자!`,
      feedback: this.elapsed < this.feedbackUntil ? this.feedback : undefined,
      mistakes: this.bumps,
      objectives: [
        { id: 'arrive', label: '우주 정거장 도착', done: this.finished },
        { id: 'rescue', label: '친구 6명 구조하기', done: this.rescued >= 6 },
        { id: 'captain', label: '친구 10명 구조하기', done: this.rescued >= 10 },
      ],
    };
  }
}
