export type MiniGameId = 'dino' | 'space' | 'maze' | 'crossing';
export type MiniAction = 'left' | 'right' | 'up' | 'down' | 'jump' | 'hint' | 'signal' | 'trail' | 'map';
export type MiniObjective = { id: string; label: string; done: boolean };
export type MiniOptions = { seed: number; level: number; character: string };
export type MiniStatus = {
  score: number;
  stars: number;
  progress: number;
  label: string;
  detail: string;
  finished: boolean;
  won: boolean;
  summary: string;
  feedback?: string;
  mistakes?: number;
  objectives?: MiniObjective[];
};
export interface MiniSession {
  advance(deltaMs: number): void;
  act(action: MiniAction): void;
  getStatus(): MiniStatus;
}
export type MiniFrame = { width: number; height: number; time: number; reducedMotion: boolean };
export type MiniGameDefinition = {
  id: MiniGameId;
  title: string;
  icon: string;
  kicker: string;
  tagline: string;
  description: string;
  accent: string;
  startLabel: string;
  scoreUnit: string;
  instructions: { icon: string; title: string; copy: string }[];
  controls: { action: MiniAction; label: string; icon: string; keys: string[]; placement?: 'toolbar' }[];
  stages?: { name: string; icon: string; copy: string }[];
  characters?: { id: string; name: string; icon: string; cost: number }[];
  create(options: MiniOptions): MiniSession;
  draw(context: CanvasRenderingContext2D, session: MiniSession, frame: MiniFrame): void;
};
