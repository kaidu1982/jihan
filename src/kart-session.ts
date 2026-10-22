export type KartTheme = 'meadow' | 'sunset' | 'snow';
export type KartVehicle = 'kart' | 'firetruck' | 'dino' | 'space';
export type KartProgress = {
  elapsed: number;
  duration: number;
  progress: number;
  stars: number;
  bumps: number;
  lane: number;
  slowed: boolean;
};
export type KartResult = { stars: number; bumps: number; elapsed: number };
export type KartObject = {
  id: number;
  row: number;
  kind: 'star' | 'cone' | 'hay' | 'puddle';
  lane: number;
  distance: number;
  resolved: boolean;
};
export type KartRow = { distance: number; safeLane: number; obstacleLanes: number[] };
export type KartEvent = { kind: 'star' | 'bump'; object: KartObject };

export const KART_DURATION_MS = 60_000;
export const KART_VIEW_DISTANCE = 1_350;
const LANE_SPEED = 5.2;
const PHYSICS_STEP_MS = 1000 / 120;
const CONTACT_DISTANCE = 24;

/** A seeded route keeps the next safe lane within one turn of the previous one. */
export function makeKartCourse(seed: number): { objects: KartObject[]; rows: KartRow[] } {
  let state = (Number.isFinite(seed) ? Math.floor(seed) : 73129) >>> 0;
  const random = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const objects: KartObject[] = [], rows: KartRow[] = [];
  let safeLane = 1;
  for (let row = 0, distance = 760; distance < 16_000; row++, distance += 450) {
    if (row > 0) {
      const choices = [safeLane - 1, safeLane, safeLane + 1].filter(lane => lane >= 0 && lane <= 2);
      safeLane = choices[Math.floor(random() * choices.length)];
    }
    const otherLanes = [0, 1, 2].filter(lane => lane !== safeLane);
    const obstacleLanes = row < 3 || random() < .4 ? [otherLanes[Math.floor(random() * 2)]] : otherLanes;
    rows.push({ distance, safeLane, obstacleLanes });
    for (const lane of obstacleLanes) {
      const kind = (['cone', 'hay', 'puddle'] as const)[Math.floor(random() * 3)];
      objects.push({ id: objects.length, row, kind, lane, distance, resolved: false });
    }
    // A visible star trail leads through the opening before an obstacle arrives.
    for (const offset of [-125, -25, 75]) {
      objects.push({ id: objects.length, row, kind: 'star', lane: safeLane, distance: distance + offset, resolved: false });
    }
  }
  objects.sort((a, b) => a.distance - b.distance || a.id - b.id);
  return { objects, rows };
}

/** Pure active-time simulation. Pausing freezes movement, stars, and the finish clock. */
export class KartSession {
  readonly objects: KartObject[];
  readonly rows: KartRow[];
  readonly duration = KART_DURATION_MS;
  elapsed = 0;
  distance = 0;
  lane = 1;
  targetLane = 1;
  stars = 0;
  bumps = 0;
  paused = false;
  finished = false;
  private slowedUntil = 0;
  private protectedUntil = 0;

  constructor(seed = 73129) {
    const course = makeKartCourse(seed);
    this.objects = course.objects;
    this.rows = course.rows;
  }

  get slowed(): boolean { return this.elapsed < this.slowedUntil; }
  get speed(): number { return (174 + 52 * this.elapsed / this.duration) * (this.slowed ? .53 : 1); }

  move(direction: -1 | 1): void {
    if (this.paused || this.finished) return;
    this.targetLane = Math.max(0, Math.min(2, this.targetLane + direction));
  }

  setPaused(value: boolean): void { this.paused = value; }

  advance(deltaMs: number): KartEvent[] {
    const events: KartEvent[] = [];
    if (this.paused || this.finished || !Number.isFinite(deltaMs) || deltaMs <= 0) return events;
    let remaining = Math.min(deltaMs, this.duration - this.elapsed);
    // Small physics steps check the swept route, including irregular/long active frames.
    while (remaining > 1e-7 && !this.finished) {
      const delta = Math.min(PHYSICS_STEP_MS, remaining);
      const previousDistance = this.distance;
      const seconds = delta / 1000;
      const laneDifference = this.targetLane - this.lane;
      this.lane += Math.sign(laneDifference) * Math.min(Math.abs(laneDifference), LANE_SPEED * seconds);
      this.distance += this.speed * seconds;
      this.elapsed = Math.min(this.duration, this.elapsed + delta);
      for (const object of this.objects) {
        if (object.resolved || object.distance < previousDistance - CONTACT_DISTANCE) continue;
        if (object.distance > this.distance + CONTACT_DISTANCE) break;
        const touchesLane = Math.abs(this.lane - object.lane) < (object.kind === 'star' ? .47 : .39);
        if (!touchesLane) continue;
        object.resolved = true;
        if (object.kind === 'star') {
          this.stars++;
          events.push({ kind: 'star', object });
        } else if (this.elapsed >= this.protectedUntil) {
          this.bumps++;
          this.slowedUntil = this.elapsed + 1100;
          this.protectedUntil = this.elapsed + 900;
          events.push({ kind: 'bump', object });
        }
      }
      remaining -= delta;
      if (this.elapsed >= this.duration - 1e-7) {
        this.elapsed = this.duration;
        this.finished = true;
      }
    }
    return events;
  }

  getProgress(): KartProgress {
    return {
      elapsed: this.elapsed / 1000, duration: this.duration / 1000,
      progress: this.elapsed / this.duration, stars: this.stars, bumps: this.bumps,
      lane: this.lane, slowed: this.slowed,
    };
  }

  getResult(): KartResult { return { stars: this.stars, bumps: this.bumps, elapsed: this.elapsed / 1000 }; }
}
