import type { MiniFrame, MiniGameDefinition } from './mini-types';
import { SPACE_LOOKAHEAD_MS, SpaceSession } from './space-session';

const palettes = [
  { top: '#131d55', bottom: '#493275', glow: '#7ae6e4', planet: '#8ed6c8', ring: '#d8f6d1', name: '민트 행성' },
  { top: '#27143e', bottom: '#743d69', glow: '#ffcd91', planet: '#ffac87', ring: '#ffe2bd', name: '복숭아 성운' },
  { top: '#071f49', bottom: '#1c5673', glow: '#9bdbff', planet: '#7ba8ec', ring: '#d2eaff', name: '푸른 고리별' },
];

function circle(context: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string): void {
  context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fillStyle = fill; context.fill();
}
function ellipse(context: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string): void {
  context.beginPath(); context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); context.fillStyle = fill; context.fill();
}
function star(context: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string): void {
  context.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const r = i % 2 ? radius * .47 : radius;
    if (i === 0) context.moveTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    else context.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  }
  context.closePath(); context.fillStyle = fill; context.fill();
}

function face(context: CanvasRenderingContext2D, y: number, spread = 7): void {
  circle(context, -spread, y, 2.2, '#29324b'); circle(context, spread, y, 2.2, '#29324b');
  context.beginPath(); context.arc(0, y + 3, 4, .15, Math.PI - .15); context.strokeStyle = '#29324b'; context.lineWidth = 1.7; context.stroke();
}

function friend(context: CanvasRenderingContext2D, variant: number, motion: number): void {
  const colours = ['#ffc995', '#d7c1ff', '#b2edd5', '#ffaccb'];
  const colour = colours[variant % 4];
  context.save(); context.translate(0, Math.sin(motion) * 2);
  // A transparent rescue bubble makes the animals readable against every planet.
  circle(context, 0, 0, 31, '#d4f5ff18');
  context.strokeStyle = '#cff5ffb8'; context.lineWidth = 1.6; context.stroke();
  if (variant === 0) {
    ellipse(context, -11, -18, 6, 12, colour); ellipse(context, 11, -18, 6, 12, colour);
    ellipse(context, -11, -18, 2.5, 7, '#f493a1'); ellipse(context, 11, -18, 2.5, 7, '#f493a1');
  } else if (variant === 1) {
    circle(context, -15, -14, 8, colour); circle(context, 15, -14, 8, colour);
  } else if (variant === 2) {
    context.beginPath(); context.moveTo(-18, -6); context.lineTo(-17, -25); context.lineTo(-4, -15); context.lineTo(8, -15); context.lineTo(19, -25); context.lineTo(19, -3); context.fillStyle = colour; context.fill();
  } else {
    ellipse(context, -18, 3, 8, 15, colour); ellipse(context, 18, 3, 8, 15, colour);
  }
  ellipse(context, 0, 4, 21, 20, colour);
  ellipse(context, 0, 12, 12, 8, '#ffffff70');
  face(context, 1);
  circle(context, -13, 9, 3, '#ff919b99'); circle(context, 13, 9, 3, '#ff919b99');
  context.beginPath(); context.arc(-10, -10, 16, 3.9, 4.7); context.strokeStyle = '#ffffffa0'; context.lineWidth = 3; context.stroke();
  context.restore();
}

function ship(context: CanvasRenderingContext2D, character: string, activeTime: number, reducedMotion: boolean, shielded: boolean): void {
  const colour = character === 'aurora' ? '#bd9df8' : character === 'sunbeam' ? '#ffbe77' : '#81e5da';
  const flame = reducedMotion ? 21 : 23 + Math.sin(activeTime / 60) * 5;
  // Curved fins and a little helmet give the craft a friendly toy silhouette.
  context.beginPath(); context.moveTo(-8, 22); context.quadraticCurveTo(0, 22 + flame * 1.5, 8, 22);
  context.fillStyle = '#ffae72'; context.fill();
  context.beginPath(); context.moveTo(-5, 23); context.quadraticCurveTo(0, 23 + flame, 5, 23);
  context.fillStyle = '#fff2b1'; context.fill();
  context.beginPath(); context.moveTo(-12, -10); context.quadraticCurveTo(-36, 3, -29, 27); context.lineTo(-7, 19); context.fillStyle = colour; context.fill();
  context.beginPath(); context.moveTo(12, -10); context.quadraticCurveTo(36, 3, 29, 27); context.lineTo(7, 19); context.fill();
  context.beginPath(); context.moveTo(0, -38); context.bezierCurveTo(-20, -23, -23, 3, -12, 26); context.lineTo(12, 26); context.bezierCurveTo(23, 3, 20, -23, 0, -38); context.fillStyle = '#f1f4fd'; context.fill();
  context.beginPath(); context.moveTo(0, -38); context.quadraticCurveTo(-8, -31, -11, -20); context.lineTo(11, -20); context.quadraticCurveTo(8, -31, 0, -38); context.fillStyle = colour; context.fill();
  circle(context, 0, -5, 14, '#426a9e'); circle(context, 0, -5, 11, '#d5efff');
  circle(context, 0, -3, 7, '#ffd3a3'); face(context, -4, 3.4);
  ellipse(context, -5, -11, 3, 1.5, '#ffffffc9');
  context.fillStyle = colour; context.fillRect(-8, 21, 16, 5);
  if (shielded) {
    circle(context, 0, -4, 48, '#b7f7ff19'); context.strokeStyle = '#c1f5ff'; context.lineWidth = 2.5; context.stroke();
    star(context, 39, -29, 6, '#ffffff');
  }
}

function meteor(context: CanvasRenderingContext2D, variant: number, motion: number): void {
  // Bright trailing dust gives the player a clear preview of incoming meteor streams.
  context.save(); context.rotate(-.2);
  const trail = context.createLinearGradient(0, -76, 0, 0);
  trail.addColorStop(0, '#ffc4a100'); trail.addColorStop(1, '#ffc4a155');
  context.beginPath(); context.moveTo(-14, -6); context.lineTo(0, -82); context.lineTo(15, -3); context.fillStyle = trail; context.fill();
  context.rotate(motion * .07 + variant);
  context.beginPath();
  for (let i = 0; i < 9; i++) {
    const angle = i * Math.PI * 2 / 9;
    const r = 22 + Math.sin(i * 3 + variant) * 3;
    if (i === 0) context.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
    else context.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  context.closePath(); context.fillStyle = '#ad91a0'; context.fill(); context.strokeStyle = '#e7c4c1'; context.lineWidth = 2; context.stroke();
  circle(context, -6, -6, 6, '#776882'); circle(context, 9, 6, 4, '#82718b'); circle(context, -7, 10, 3, '#c6a5b1');
  context.restore();
}

function station(context: CanvasRenderingContext2D, x: number, y: number): void {
  context.save(); context.translate(x, y);
  context.fillStyle = '#91b4ea'; context.fillRect(-75, -10, 150, 20);
  context.fillStyle = '#446da5'; context.fillRect(-92, -26, 38, 52); context.fillRect(54, -26, 38, 52);
  context.strokeStyle = '#a6dfff'; context.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    context.beginPath(); context.moveTo(-89 + i * 10, -24); context.lineTo(-89 + i * 10, 24); context.stroke();
    context.beginPath(); context.moveTo(57 + i * 10, -24); context.lineTo(57 + i * 10, 24); context.stroke();
  }
  circle(context, 0, 0, 37, '#e0f4ff'); circle(context, 0, 0, 26, '#7086c3'); circle(context, 0, 0, 19, '#a5e8d9');
  star(context, 0, 0, 10, '#fff3b6');
  context.beginPath(); context.moveTo(0, -37); context.lineTo(0, -55); context.strokeStyle = '#cdefff'; context.lineWidth = 3; context.stroke(); circle(context, 0, -58, 5, '#ffe0a6');
  context.restore();
}

function draw(context: CanvasRenderingContext2D, session: SpaceSession, frame: MiniFrame): void {
  const { width, height, reducedMotion } = frame;
  const theme = palettes[session.level];
  const time = session.elapsed;
  const motion = reducedMotion ? 0 : time / 1000;
  context.save(); context.scale(width / 420, height / 560);
  const background = context.createLinearGradient(0, 0, 0, 560);
  background.addColorStop(0, theme.top); background.addColorStop(1, theme.bottom);
  context.fillStyle = background; context.fillRect(0, 0, 420, 560);
  // Broad nebula glows and hand placed stars create depth without external assets.
  const nebula = context.createRadialGradient(325, 180, 8, 325, 180, 240);
  nebula.addColorStop(0, `${theme.glow}20`); nebula.addColorStop(1, `${theme.glow}00`);
  context.fillStyle = nebula; context.fillRect(0, 0, 420, 560);
  for (let i = 0; i < 66; i++) {
    const x = (i * 131 + 29) % 420;
    const drift = reducedMotion ? 0 : time * (.006 + (i % 3) * .005);
    const y = ((i * 79 + 17 + drift) % 590) - 15;
    const alpha = .3 + (i % 5) * .12;
    context.globalAlpha = alpha;
    circle(context, x, y, i % 9 === 0 ? 1.8 : .8, '#edf7ff');
    if (i % 13 === 0) { context.fillStyle = '#edf7ff'; context.fillRect(x - 4, y - .5, 8, 1); context.fillRect(x - .5, y - 4, 1, 8); }
  }
  context.globalAlpha = 1;
  context.save(); context.translate(336, 99); context.rotate(-.35);
  context.beginPath(); context.ellipse(0, 0, 75, 19, 0, 0, Math.PI * 2); context.strokeStyle = `${theme.ring}80`; context.lineWidth = 11; context.stroke();
  circle(context, 0, 0, 42, theme.planet);
  context.save(); context.beginPath(); context.arc(0, 0, 42, 0, Math.PI * 2); context.clip();
  ellipse(context, -13, -14, 43, 8, '#ffffff25'); ellipse(context, 7, 13, 40, 7, '#405b8a25');
  circle(context, 25, -20, 10, '#ffffff20'); context.restore();
  context.beginPath(); context.ellipse(0, 0, 75, 19, 0, 0, Math.PI); context.strokeStyle = theme.ring; context.lineWidth = 7; context.stroke(); context.restore();
  circle(context, 47, 192, 17, '#8e91c855'); circle(context, 42, 187, 4, '#626b9b77');

  // Subtle flight beacons indicate the three reachable columns, without a road.
  for (const x of [100, 210, 320]) {
    context.beginPath(); context.moveTo(x, 368); context.lineTo(x, 475); context.strokeStyle = '#d9f7ff10'; context.lineWidth = 1; context.setLineDash([2, 9]); context.stroke(); context.setLineDash([]);
    ellipse(context, x, 469, 24, 5, '#b8dcff10');
  }
  if (time > 47_000) {
    const arrival = Math.min(1, (time - 47_000) / 7_000);
    station(context, 210, -70 + arrival * 300);
    context.textAlign = 'center'; context.fillStyle = '#e3f7ff'; context.font = '700 13px system-ui, sans-serif';
    if (arrival > .35) context.fillText('우주 정거장이 보여!', 210, -5 + arrival * 300);
  }

  const readyFriend = session.signalsRemaining > 0 ? session.signalTarget : undefined;
  for (const object of session.objects) {
    const untilArrival = object.arrivalAt - time;
    if (untilArrival > SPACE_LOOKAHEAD_MS || untilArrival < -600 || object.outcome === 'collected' || object.outcome === 'shielded' || object.outcome === 'bumped') continue;
    const y = 430 - untilArrival * .081;
    if (y < -90 || y > 570) continue;
    context.save(); context.translate(100 + object.lane * 110, y);
    context.globalAlpha = untilArrival < 0 ? Math.max(0, 1 + untilArrival / 600) : 1;
    if (object.kind === 'star') {
      circle(context, 0, 0, 19, '#fff2a812'); star(context, 0, 0, 12, '#ffe7a2'); circle(context, -3, -4, 2, '#fff9d2');
    } else if (object.kind === 'friend') {
      if (object === readyFriend) {
        circle(context, 0, 0, 36, '#ffedb32d');
        context.strokeStyle = '#ffe5a0'; context.lineWidth = 2;
        context.beginPath(); context.arc(0, 0, 33, 0, Math.PI * 2); context.stroke();
      }
      friend(context, object.variant, motion * 2 + object.id);
      context.textAlign = 'center'; context.fillStyle = object === readyFriend ? '#ffe5a0' : '#edf7ff'; context.font = '700 10px system-ui, sans-serif'; context.fillText(object === readyFriend ? '신호로 구조!' : '여기야!', 0, -39);
    } else meteor(context, object.variant, motion);
    context.restore();
  }
  // Engine particles follow active time, so the whole scene also freezes on pause.
  const shipX = 100 + session.lane * 110;
  const signal = session.signalRescue;
  if (signal && time - signal.startedAt < 700) {
    const progress = Math.min(1, (time - signal.startedAt) / 700);
    const travel = reducedMotion ? 1 : 1 - (1 - progress) ** 3;
    const sourceX = 100 + signal.lane * 110;
    const sourceY = 430 - (signal.arrivalAt - signal.startedAt) * .081;
    context.save(); context.globalAlpha = 1 - progress * .7;
    context.beginPath(); context.arc(shipX, 426, reducedMotion ? 68 : 42 + progress * 105, 0, Math.PI * 2);
    context.strokeStyle = '#ffe8a7'; context.lineWidth = 3; context.stroke();
    context.beginPath(); context.moveTo(shipX, 417); context.lineTo(sourceX, sourceY);
    context.strokeStyle = '#fff1c580'; context.lineWidth = 9 * (1 - progress); context.stroke();
    context.translate(sourceX + (shipX - sourceX) * travel, sourceY + (402 - sourceY) * travel);
    context.scale(.8, .8); friend(context, signal.variant, 0); context.restore();
  }
  if (!reducedMotion) {
    for (let i = 0; i < 7; i++) {
      const drift = (time / 7 + i * 16) % 100;
      circle(context, shipX + Math.sin(i * 2) * (drift * .12), 460 + drift, 2 - drift / 60, `#b9f4ff${Math.round((1 - drift / 100) * 110).toString(16).padStart(2, '0')}`);
    }
  }
  context.save(); context.translate(shipX, 430);
  const tilt = reducedMotion ? 0 : (session.targetLane - session.lane) * .18;
  context.rotate(tilt); ship(context, session.character, time, reducedMotion, session.shielded); context.restore();
  // Three lit beacons match the three available rescue signals.
  context.beginPath(); context.roundRect(18, 508, 166, 39, 16); context.fillStyle = '#17234dbb'; context.fill();
  context.textAlign = 'left'; context.fillStyle = '#edf7ff'; context.font = '700 12px system-ui, sans-serif';
  context.fillText('구조 신호', 31, 532);
  for (let signalIndex = 0; signalIndex < 3; signalIndex++) {
    const x = 119 + signalIndex * 21;
    circle(context, x, 527, 6, signalIndex < session.signalsRemaining ? '#ffe3a2' : '#596481');
    if (signalIndex < session.signalsRemaining) {
      context.beginPath(); context.arc(x, 527, 9, -.9, .9); context.strokeStyle = '#ffe3a280'; context.lineWidth = 1.5; context.stroke();
    }
  }
  if (readyFriend && !session.finished) {
    context.textAlign = 'center'; context.font = '700 12px system-ui, sans-serif'; context.fillStyle = '#ffe3a2';
    context.fillText('친구에게 신호를 보내요!', 293, 532);
  }
  if (time < 4_400) {
    const alpha = Math.min(1, (4_400 - time) / 500);
    context.globalAlpha = alpha; context.textAlign = 'center'; context.fillStyle = '#f6f2ff'; context.font = '800 17px system-ui, sans-serif';
    context.fillText('별길을 따라 친구를 데리러 가자!', 210, 298);
    context.font = '500 12px system-ui, sans-serif'; context.fillStyle = '#dae5ff'; context.fillText('← → 움직이기 · 가까운 친구는 구조 신호!', 210, 322); context.globalAlpha = 1;
  }
  context.restore();
}

const space: MiniGameDefinition = {
  id: 'space',
  title: '우주 탐험',
  icon: '🚀',
  kicker: '친구를 찾아 떠나는 여행',
  tagline: '반짝이는 별길 끝에 누가 있을까?',
  description: '별길을 따라 동물 친구들을 데려와요. 가까운 옆길의 친구에게 구조 신호를 보내고 우주 정거장으로 출발!',
  accent: '#8388dd',
  startLabel: '우주로 출발',
  scoreUnit: '명 구조',
  instructions: [
    { icon: '↔️', title: '좌우로 슝!', copy: '왼쪽·오른쪽 버튼이나 방향키로 우주선을 움직여요.' },
    { icon: '📡', title: '구조 신호는 세 번!', copy: '가까운 옆길 친구는 구조 신호 버튼이나 스페이스 키로 데려와요. 친구가 없으면 횟수를 쓰지 않아요.' },
    { icon: '🐰', title: '친구와 끝까지 탐험', copy: '별길에서 친구를 만나요. 운석에 닿아도 계속 출발! 54초 뒤 도착하고, 6명·10명 구조 메달에 도전해요.' },
  ],
  controls: [
    { action: 'left', label: '왼쪽', icon: '←', keys: ['ArrowLeft', 'a', 'A'] },
    { action: 'right', label: '오른쪽', icon: '→', keys: ['ArrowRight', 'd', 'D'] },
    { action: 'signal', label: '구조 신호', icon: '📡', keys: ['Space'] },
  ],
  stages: [
    { name: '민트 행성', icon: '🪐', copy: '초록빛 행성에서 첫 구조 임무' },
    { name: '복숭아 성운', icon: '🌅', copy: '분홍빛 별구름과 운석 사이로' },
    { name: '푸른 고리별', icon: '🌌', copy: '파란 은하에서 친구들과 집으로' },
  ],
  characters: [
    { id: 'comet', name: '민트 혜성호', icon: '🚀', cost: 0 },
    { id: 'sunbeam', name: '햇살 탐험호', icon: '☀️', cost: 15 },
    { id: 'aurora', name: '보라 오로라호', icon: '🌠', cost: 30 },
  ],
  create: options => new SpaceSession(options),
  draw: (context, session, frame) => draw(context, session as SpaceSession, frame),
};

export default space;
