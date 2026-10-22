import { CrossingSession, type CrossingRow } from './crossing-session';
import type { MiniGameDefinition } from './mini-types';

const palettes = [
  { grass: '#b5d793', hedge: '#699a6b', road: '#82948e', path: '#e9e3bd', flower: '#f4bd86', roof: '#d58e68', sky: '#d0e4b4' },
  { grass: '#bfd8a2', hedge: '#5d957b', road: '#869793', path: '#eee4c3', flower: '#edd6a2', roof: '#789e90', sky: '#d5e7c3' },
  { grass: '#d4c58e', hedge: '#919c73', road: '#8b8d92', path: '#f4deb6', flower: '#edaa92', roof: '#c98878', sky: '#ead5ad' },
];
function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number, fill: string): void {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
}
function star(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.fillStyle = '#f2c451'; ctx.strokeStyle = '#fff2ad'; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const angle = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? radius * .47 : radius; const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
}
function car(ctx: CanvasRenderingContext2D, row: CrossingRow, x: number, y: number): void {
  const width = row.width * 49, body = ['#e8a16e', '#89b6be', '#e7c867', '#c99ba5'][row.color];
  ctx.save(); ctx.translate(x, y); if (row.direction < 0) ctx.scale(-1, 1);
  rounded(ctx, -width / 2 - 2, -13, width + 4, 29, 8, '#3f565230');
  for (const dx of [-width / 2 + 8, width / 2 - 16]) { rounded(ctx, dx, -18, 12, 9, 3, '#3c5050'); rounded(ctx, dx, 10, 12, 9, 3, '#3c5050'); }
  rounded(ctx, -width / 2, -15, width, 30, 9, body);
  rounded(ctx, -width / 2 + 14, -12, width * .42, 24, 6, '#647b75');
  rounded(ctx, -width / 2 + 16, -9, width * .35, 18, 4, '#c6ded9');
  rounded(ctx, width / 2 - 8, -11, 4, 6, 2, '#fff4c6'); rounded(ctx, width / 2 - 8, 5, 4, 6, 2, '#fff4c6');
  ctx.restore();
}
function railway(ctx: CanvasRenderingContext2D, session: CrossingSession, row: CrossingRow, y: number, width: number, reducedMotion: boolean): void {
  rounded(ctx, 0, y - 23, width, 46, 0, '#b3a48e');
  for (let x = 4; x < width; x += 23) rounded(ctx, x, y - 17, 9, 34, 2, '#7f705f');
  for (const dy of [-10, 10]) { rounded(ctx, 0, y + dy - 3, width, 6, 1, '#555e5c'); rounded(ctx, 0, y + dy - 3, width, 2, 0, '#d7ded4'); }
  const signal = session.trainState(row)!;
  const closed = signal.phase !== 'clear', bright = reducedMotion || Math.floor(session.elapsed / 280) % 2 === 0;
  for (const x of [16, width - 16]) {
    rounded(ctx, x - 3, y - 29, 6, 51, 2, '#526b5c');
    rounded(ctx, x - 10, y - 36, 20, 24, 7, '#40574d');
    ctx.fillStyle = closed ? bright ? '#ffad86' : '#d76d57' : '#bce889';
    ctx.beginPath(); ctx.arc(x, y - 24, 6, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(x, y + 20);
    ctx.rotate(closed ? 0 : x < width / 2 ? -.85 : .85);
    const direction = x < width / 2 ? 1 : -1;
    rounded(ctx, Math.min(0, direction * (width / 2 - 24)), -3, width / 2 - 24, 7, 2, '#fff2cf');
    for (let segment = 0; segment < width / 2 - 29; segment += 25) {
      ctx.fillStyle = '#d37860'; ctx.fillRect(direction > 0 ? segment : -segment - 11, -3, 11, 7);
    }
    ctx.restore();
  }
  if (signal.phase !== 'passing') return;
  const trainWidth = signal.width * 49;
  ctx.save(); ctx.translate(38 + signal.center! * 49, y); if (row.direction < 0) ctx.scale(-1, 1);
  rounded(ctx, -trainWidth / 2, -17, trainWidth, 38, 10, '#43585135');
  for (let i = 0; i < 6; i++) rounded(ctx, -trainWidth / 2 + 10 + i * (trainWidth - 30) / 5, 10, 12, 12, 4, '#405451');
  rounded(ctx, -trainWidth / 2, -19, trainWidth, 36, 8, '#d48a59');
  rounded(ctx, -trainWidth / 2 + 2, -21, trainWidth - 4, 7, 3, '#eebd78');
  rounded(ctx, -trainWidth / 2 + 5, 6, trainWidth - 10, 7, 2, '#f0c870');
  for (let i = 0; i < 6; i++) {
    rounded(ctx, -trainWidth / 2 + 10 + i * (trainWidth - 25) / 6, -11, 19, 13, 3, '#536f70');
    rounded(ctx, -trainWidth / 2 + 12 + i * (trainWidth - 25) / 6, -10, 15, 5, 2, '#bfe0d7');
  }
  rounded(ctx, trainWidth / 2 - 7, -11, 5, 8, 2, '#fff3bb');
  ctx.restore();
}
function crosswalk(ctx: CanvasRenderingContext2D, session: CrossingSession, row: CrossingRow, y: number, width: number, reducedMotion: boolean): void {
  for (const dy of [-16, -5, 6, 17]) rounded(ctx, 42, y + dy - 3, width - 84, 6, 1, '#fff9e5cc');
  const signal = session.signalState(row)!;
  const green = signal.phase !== 'traffic';
  const bright = signal.phase !== 'flashing' || reducedMotion || Math.floor(session.elapsed / 280) % 2 === 0;
  for (const x of [20, width - 20]) {
    rounded(ctx, x - 2, y - 22, 4, 44, 2, '#53675b');
    rounded(ctx, x - 11, y - 35, 22, 36, 6, '#344d46');
    ctx.fillStyle = green ? bright ? '#bcea85' : '#557648' : '#ed9980';
    ctx.beginPath(); ctx.arc(x, y - 27, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(x, y - 22); ctx.lineTo(x, y - 14);
    ctx.moveTo(x - 5, y - 19); ctx.lineTo(x + 5, y - 19);
    ctx.moveTo(x, y - 14); ctx.lineTo(x - 4, y - 7);
    ctx.moveTo(x, y - 14); ctx.lineTo(x + 4, y - 7); ctx.stroke();
    rounded(ctx, x - 12, y + 5, 24, 12, 4, '#344d46');
    for (const [dx, active, color] of [[-5, green, '#ed9980'], [5, !green, '#bcea85']] as const) {
      ctx.fillStyle = active ? color : '#526259'; ctx.beginPath(); ctx.arc(x + dx, y + 11, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  rounded(ctx, width / 2 - 67, y - 43, 134, 20, 7, '#fff9e9');
  ctx.fillStyle = green ? '#4b733e' : '#a9634d'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(signal.phase === 'walk' ? `초록불 ${Math.ceil(signal.remainingMs / 1000)}초 · 좌우 살펴요`
    : signal.phase === 'flashing' ? '깜빡이면 다음 초록불에' : '차량 신호 · 풀밭에서 기다려요', width / 2, y - 29);
  for (const x of session.cars(row)) car(ctx, row, 38 + x * 49, y);
}
function character(ctx: CanvasRenderingContext2D, session: CrossingSession, x: number, y: number, time: number, reduce: boolean): void {
  const bunny = session.character === 'bunny', frog = session.character === 'frog';
  const color = bunny ? '#eee6d6' : frog ? '#8ebd70' : '#ffdc78';
  const hop = !reduce && session.moving ? Math.sin((session.visualRow % 1 + session.visualColumn % 1) * Math.PI) * 7 : 0;
  ctx.fillStyle = '#35583d25'; ctx.beginPath(); ctx.ellipse(x, y + 14, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(x, y - Math.abs(hop));
  if (session.protected) { ctx.strokeStyle = '#fff8d5'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 24 + (reduce ? 0 : Math.sin(time / 100) * 2), 0, Math.PI * 2); ctx.stroke(); }
  rounded(ctx, -13, -16, 26, 31, 10, color);
  if (bunny) { rounded(ctx, -11, -31, 8, 23, 4, color); rounded(ctx, 3, -31, 8, 23, 4, color); rounded(ctx, -9, -27, 4, 14, 2, '#efc5bc'); rounded(ctx, 5, -27, 4, 14, 2, '#efc5bc'); }
  if (frog) { for (const dx of [-8, 8]) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(dx, -14, 7, 0, Math.PI * 2); ctx.fill(); } }
  ctx.fillStyle = '#3f5140'; for (const dx of [-6, 6]) { ctx.beginPath(); ctx.arc(dx, -5, 2, 0, Math.PI * 2); ctx.fill(); }
  if (!bunny && !frog) { ctx.fillStyle = '#eea354'; ctx.beginPath(); ctx.moveTo(-4, 1); ctx.lineTo(4, 1); ctx.lineTo(0, 7); ctx.fill(); }
  else { ctx.strokeStyle = '#687856'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 1, 4, 0, Math.PI); ctx.stroke(); }
  rounded(ctx, -12, 10, 9, 6, 3, '#e7ac68'); rounded(ctx, 3, 10, 9, 6, 3, '#e7ac68'); ctx.restore();
}

const crossing: MiniGameDefinition = {
  id: 'crossing', title: '길 건너기', icon: '🐥', kicker: 'ONE LITTLE HOP AT A TIME', tagline: '살펴보고, 폴짝!\n친구들이 기다리고 있어.',
  description: '횡단보도는 초록불에 좌우를 보고 건너요. 차와 기차를 살피고, 별길을 따라 풀밭에서 쉬어가요.', accent: '#729361', startLabel: '폴짝! 건너기', scoreUnit: '점',
  instructions: [
    { icon: '↑', title: '한 칸씩 폴짝!', copy: '화살표 버튼이나 방향키로 움직여요.' },
    { icon: '🚦', title: '초록불에 좌우를 살펴요', copy: '깜빡이거나 빨간불이면 앞 풀밭에서 기다려요.' },
    { icon: '☘', title: '풀밭에서 쉬어가요', copy: '실수하면 가까운 풀밭으로 돌아와요.' },
  ],
  controls: [
    { action: 'up', label: '앞으로', icon: '↑', keys: ['ArrowUp', 'KeyW', 'Space'] },
    { action: 'left', label: '왼쪽', icon: '←', keys: ['ArrowLeft', 'KeyA'] },
    { action: 'down', label: '뒤로', icon: '↓', keys: ['ArrowDown', 'KeyS'] },
    { action: 'right', label: '오른쪽', icon: '→', keys: ['ArrowRight', 'KeyD'] },
  ],
  stages: [ { name: '작은 마을', icon: '🌼', copy: '10칸 · 횡단보도 초록불에 건너기' }, { name: '나무 마을 기찻길', icon: '🚂', copy: '14칸 · 횡단보도와 기찻길 1곳' }, { name: '노을 마을 기찻길', icon: '🌅', copy: '18칸 · 횡단보도와 기찻길 2곳' } ],
  characters: [ { id: 'chick', name: '꼬마 병아리', icon: '🐥', cost: 0 }, { id: 'frog', name: '초록 개구리', icon: '🐸', cost: 10 }, { id: 'bunny', name: '하얀 토끼', icon: '🐰', cost: 20 } ],
  create: options => new CrossingSession(options),
  draw(ctx, model, frame): void {
    const session = model as CrossingSession, palette = palettes[session.level], width = frame.width;
    ctx.fillStyle = palette.sky; ctx.fillRect(0, 0, width, frame.height);
    const camera = Math.max(0, session.visualRow - 4), tile = 46;
    const projectY = (row: number): number => 502 - (row - camera) * tile;
    for (let index = Math.max(0, Math.floor(camera) - 2); index < session.rows.length; index++) {
      const row = session.rows[index], y = projectY(index); if (y < 75 || y > 590) continue;
      ctx.fillStyle = row.kind === 'road' || row.kind === 'crosswalk' ? palette.road : palette.grass; ctx.fillRect(0, y - tile / 2, width, tile + 1);
      if (row.kind === 'rail') {
        railway(ctx, session, row, y, width, frame.reducedMotion);
      } else if (row.kind === 'crosswalk') {
        crosswalk(ctx, session, row, y, width, frame.reducedMotion);
      } else if (row.kind === 'road') {
        ctx.strokeStyle = '#f7f2db65'; ctx.lineWidth = 2; ctx.setLineDash([12, 14]); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); ctx.setLineDash([]);
        for (const x of session.cars(row)) car(ctx, row, 38 + x * 49, y);
      } else {
        ctx.fillStyle = palette.path; ctx.fillRect(22, y + tile / 2 - 5, 376, 5);
        for (const x of [6, 410]) { ctx.fillStyle = palette.hedge; ctx.beginPath(); ctx.arc(x, y - 4, 21, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffffff19'; ctx.beginPath(); ctx.arc(x - 4, y - 11, 14, 0, Math.PI * 2); ctx.fill(); }
        if (row.kind === 'finish') {
          for (let i = 0; i < 14; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#5a7a5e' : '#fff5d9'; ctx.fillRect(25 + i * 26.4, y - 5 + j * 9, 27, 9); }
          rounded(ctx, 141, y - 37, 140, 25, 9, '#fff8dc'); ctx.fillStyle = '#5f8056'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('친구들에게 도착!', 211, y - 20);
        } else {
          for (let i = 0; i < 6; i++) { const x = 45 + ((i * 67 + index * 13) % 330); ctx.fillStyle = palette.flower; ctx.beginPath(); ctx.arc(x, y - 10 + (i % 2) * 20, 3, 0, Math.PI * 2); ctx.fill(); }
        }
      }
    }
    for (const coin of session.coins) { const y = projectY(coin.row); if (!coin.collected && y > 92 && y < 570) star(ctx, 38 + coin.column * 49, y + (frame.reducedMotion ? 0 : Math.sin(frame.time / 240) * 2), 12); }
    character(ctx, session, 38 + session.visualColumn * 49, projectY(session.visualRow), frame.time, frame.reducedMotion);
    const shade = ctx.createLinearGradient(0, 0, 0, 112); shade.addColorStop(0, `${palette.sky}`); shade.addColorStop(1, `${palette.sky}00`); ctx.fillStyle = shade; ctx.fillRect(0, 0, width, 112);
  },
};
export default crossing;
