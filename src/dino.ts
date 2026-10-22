import { DinoSession } from './dino-session';
import type { MiniGameDefinition } from './mini-types';

const PALETTES = [
  { sky: '#d8f5ec', low: '#f4f6d9', far: '#b2d8c5', mountain: '#8ebdab', tree: '#418c70', leaf: '#267a5b', earth: '#dfbb85', dirt: '#bd955e', grass: '#81bd59', accent: '#fff4c6' },
  { sky: '#ffdfc5', low: '#fff2d4', far: '#e3b3a4', mountain: '#bc9699', tree: '#927864', leaf: '#6c8054', earth: '#dcae78', dirt: '#bf8a62', grass: '#bec468', accent: '#ffe29d' },
  { sky: '#deeffb', low: '#f7fbff', far: '#bdd7e8', mountain: '#9bbbd4', tree: '#719eb5', leaf: '#4e879e', earth: '#c7d5dc', dirt: '#9aaebc', grass: '#edf9fd', accent: '#f5fdff' },
];

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}
function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string): void {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}
function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - size, y - size, x - size * .3, y - size * 1.5); ctx.quadraticCurveTo(x + size * .5, y - size, x, y); ctx.fill();
}
function fern(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) {
    const tx = x + i * size * .35, ty = y - size + Math.abs(i) * 5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(tx, y - size * .8, tx, ty); ctx.stroke();
    leaf(ctx, tx, ty + 5, size * .45, color);
  }
}
function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ellipse(ctx, x, y, size, size * .32, '#ffffffb8'); ellipse(ctx, x - size * .3, y - size * .2, size * .5, size * .45, '#ffffffb8'); ellipse(ctx, x + size * .25, y - size * .3, size * .55, size * .5, '#ffffffb8');
}

function dinosaur(ctx: CanvasRenderingContext2D, session: DinoSession, x: number, ground: number): void {
  const colors = session.character === 'sunny' ? { body: '#f4ae43', shade: '#d98736', pale: '#fff0ba', spikes: '#c97737' }
    : session.character === 'berry' ? { body: '#ab83d6', shade: '#8262b6', pale: '#eddaff', spikes: '#6750a5' }
      : { body: '#66ba67', shade: '#439457', pale: '#e2f3bb', spikes: '#2c8156' };
  const cycle = session.elapsed / 85;
  const running = session.grounded && !session.finished;
  const bob = running ? Math.sin(cycle * 2) * 1.4 : 0;
  ellipse(ctx, x + 1, ground + 3, 25 - session.height * .055, 6 - session.height * .018, '#346c4530');
  ctx.save(); ctx.translate(x, ground - session.height + bob);
  if (session.protected && Math.floor(session.elapsed / 90) % 2 === 0) ctx.globalAlpha = .65;
  ctx.rotate(session.grounded ? 0 : -.07);
  // Long, rounded tail and little back plates make the silhouette unmistakable.
  ctx.fillStyle = colors.shade; ctx.beginPath(); ctx.moveTo(-9, -37); ctx.quadraticCurveTo(-33, -27, -43, -36); ctx.quadraticCurveTo(-36, -7, -10, -12); ctx.fill();
  for (let i = 0; i < 4; i++) {
    const px = -22 + i * 8, py = -31 - i * 7;
    ctx.fillStyle = colors.spikes; ctx.beginPath(); ctx.moveTo(px - 5, py + 8); ctx.lineTo(px - 3, py - 5); ctx.lineTo(px + 5, py + 6); ctx.fill();
  }
  ellipse(ctx, -2, -28, 21, 26, colors.body);
  ellipse(ctx, 4, -25, 13, 19, colors.pale);
  round(ctx, -2, -64, 43, 34, 13, colors.body);
  round(ctx, 21, -44, 25, 14, 6, colors.body);
  // Far leg, near leg, and tiny toes.
  for (let i = 0; i < 2; i++) {
    const stride = running ? Math.sin(cycle + i * Math.PI) * 7 : i ? 5 : -5;
    round(ctx, -13 + i * 16 + stride, -15, 12, 18 - Math.abs(stride) * .3, 5, i ? colors.body : colors.shade);
    round(ctx, -13 + i * 16 + stride, -4 - Math.abs(stride) * .3, 19, 7, 4, i ? colors.body : colors.shade);
  }
  ctx.strokeStyle = colors.shade; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(15, -30); ctx.lineTo(25, -24); ctx.lineTo(30, -28); ctx.stroke();
  ellipse(ctx, 27, -53, 7.5, 9, '#fff'); ellipse(ctx, 30, -52, 3.4, 4.4, '#223c35'); ellipse(ctx, 31, -54, 1.1, 1.4, '#fff');
  ellipse(ctx, 40, -39, 1.3, 1.3, '#37664a'); ellipse(ctx, 16, -41, 5, 3, '#f5ae9288');
  ctx.strokeStyle = '#37664a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(28, -33); ctx.quadraticCurveTo(34, -29, 39, -33); ctx.stroke();
  if (session.character === 'sunny') {
    ctx.fillStyle = '#fff2cb'; ctx.beginPath(); ctx.moveTo(4, -62); ctx.lineTo(1, -77); ctx.lineTo(12, -63); ctx.fill();
    ctx.beginPath(); ctx.moveTo(24, -63); ctx.lineTo(30, -76); ctx.lineTo(32, -62); ctx.fill();
  }
  if (session.character === 'berry') {
    for (let i = 0; i < 3; i++) ellipse(ctx, 1 + i * 5, -66 - (i === 1 ? 4 : 0), 5, 5, '#f9c5e9');
    ellipse(ctx, 6, -69, 2, 2, '#fff4b3');
  }
  ctx.restore();
}

const definition: MiniGameDefinition = {
  id: 'dino', title: '공룡 달리기', icon: '🦖', kicker: '폴짝폴짝 공룡 탐험',
  tagline: '두 번 폴짝! 공룡 알을 찾아요', description: '달리는 공룡과 함께 바위와 작은 구덩이를 넘어요. 공중에서 한 번 더 점프해 반짝이는 공룡 알을 찾아요.',
  accent: '#4b9867', startLabel: '공룡이랑 달리기', scoreUnit: 'm',
  instructions: [
    { icon: '👆', title: '한 번, 두 번 폴짝!', copy: '바위 앞에서 점프! 공중에서 한 번 더 누르면 더 높이 뛰어요. 땅에 내려오면 다시 두 번!' },
    { icon: '🥚', title: '공룡 알을 찾아요', copy: '점프해서 알을 모아요. 모은 알은 새 공룡을 만나는 별이 돼요.' },
    { icon: '🏁', title: '천천히 해도 괜찮아', copy: '부딪혀도 다시 달릴 수 있어요. 약 50초 뒤 결승선에서 만나요!' },
  ],
  controls: [{ action: 'jump', label: '점프 · 한 번 더!', icon: '↑', keys: ['Space', 'ArrowUp', 'KeyW'] }],
  stages: [
    { name: '초록 화석 숲', icon: '🌿', copy: '커다란 나무와 싱그러운 풀밭' },
    { name: '노을 공룡 계곡', icon: '🌅', copy: '따뜻한 노을 아래 알 찾기' },
    { name: '반짝 얼음 숲', icon: '❄️', copy: '눈송이처럼 반짝이는 푸른 숲' },
  ],
  characters: [
    { id: 'sprout', name: '초록이', icon: '🦖', cost: 0 },
    { id: 'sunny', name: '햇살 뿔공룡', icon: '☀️', cost: 15 },
    { id: 'berry', name: '보라 꽃공룡', icon: '🌸', cost: 30 },
  ],
  create: options => new DinoSession(options),
  draw(ctx, rawSession, frame) {
    const session = rawSession as DinoSession;
    const p = PALETTES[session.level];
    const ground = 423;
    ctx.save(); ctx.scale(frame.width / 420, frame.height / 560);
    const sky = ctx.createLinearGradient(0, 0, 0, ground); sky.addColorStop(0, p.sky); sky.addColorStop(1, p.low);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 420, 560);
    ellipse(ctx, 338, 72, 34, 34, '#fff9d4'); ellipse(ctx, 338, 72, 46, 46, '#fff8cb44');
    for (let i = 0; i < 4; i++) {
      const x = ((i * 175 + 40 - session.distance * .035) % 700 + 700) % 700 - 100;
      cloud(ctx, x, 85 + i % 2 * 42, 37 + i % 2 * 12);
    }
    // Layered soft peaks drift more slowly than the forest.
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = layer ? p.mountain : p.far;
      const offset = (session.distance * (layer ? .12 : .055)) % 270;
      ctx.beginPath(); ctx.moveTo(-300, ground);
      for (let i = -1; i < 4; i++) {
        const x = i * 270 - offset;
        ctx.lineTo(x, ground); ctx.quadraticCurveTo(x + 120, 157 + layer * 57, x + 250, ground);
      }
      ctx.lineTo(700, 500); ctx.lineTo(-300, 500); ctx.fill();
    }
    for (let i = -1; i < 4; i++) {
      const x = i * 180 - (session.distance * .35) % 180;
      const y = 285 + (i % 2) * 24;
      round(ctx, x + 51, y - 22, 15, ground - y + 28, 6, `${p.tree}88`);
      ellipse(ctx, x + 56, y - 12, 49, 53, `${p.tree}bb`);
      ellipse(ctx, x + 26, y + 5, 37, 39, `${p.tree}bb`);
      ellipse(ctx, x + 87, y + 6, 34, 38, `${p.tree}bb`);
      ctx.strokeStyle = `${p.leaf}50`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 82, y + 18); ctx.quadraticCurveTo(x + 78, y + 70, x + 86, y + 100); ctx.stroke();
    }
    ctx.fillStyle = p.grass; ctx.beginPath(); ctx.moveTo(0, ground); ctx.quadraticCurveTo(100, ground - 13, 210, ground); ctx.quadraticCurveTo(300, ground - 9, 420, ground - 3); ctx.lineTo(420, 560); ctx.lineTo(0, 560); ctx.fill();
    ctx.fillStyle = p.earth; ctx.fillRect(0, ground + 12, 420, 148);
    ctx.fillStyle = p.dirt; ctx.fillRect(0, ground + 33, 420, 127);
    for (let i = -1; i < 12; i++) {
      const x = i * 43 - session.distance % 43;
      ellipse(ctx, x, 479 + Math.sin(i * 4) * 16, 4, 2.5, '#ffffff25');
      ellipse(ctx, x + 19, 528 + Math.cos(i * 3) * 8, 7, 3.5, '#654d2820');
    }
    // Course objects share exactly the simulation's world coordinates.
    for (const obstacle of session.obstacles) {
      const x = 86 + obstacle.x - session.distance;
      if (x < -100 || x > 520) continue;
      if (obstacle.kind === 'gap') {
        round(ctx, x - obstacle.width / 2, ground - 1, obstacle.width, 42, 8, '#594b3b');
        round(ctx, x - obstacle.width / 2 + 5, ground + 7, obstacle.width - 10, 29, 7, '#3f3c38');
        ctx.fillStyle = p.grass; ctx.fillRect(x - obstacle.width / 2 - 5, ground - 2, 9, 10); ctx.fillRect(x + obstacle.width / 2 - 4, ground - 2, 9, 10);
        ellipse(ctx, x, ground + 29, 15, 3, '#e8d8ab30');
      } else if (obstacle.kind === 'log') {
        round(ctx, x - obstacle.width / 2, ground - obstacle.height, obstacle.width, obstacle.height, 10, '#9f713e');
        ctx.strokeStyle = '#6e4f32'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 11, ground - 19); ctx.lineTo(x + 8, ground - 19); ctx.moveTo(x - 13, ground - 9); ctx.lineTo(x + 7, ground - 9); ctx.stroke();
        ellipse(ctx, x + obstacle.width / 2 - 5, ground - 13, 8, 12, '#edca8e'); ellipse(ctx, x + obstacle.width / 2 - 5, ground - 13, 4, 7, '#b38a53');
        leaf(ctx, x - 9, ground - obstacle.height + 1, 12, p.leaf);
      } else {
        ctx.fillStyle = '#81928a'; ctx.beginPath(); ctx.moveTo(x - obstacle.width / 2 - 3, ground); ctx.lineTo(x - obstacle.width / 2 + 2, ground - 21); ctx.lineTo(x - 5, ground - obstacle.height); ctx.lineTo(x + 11, ground - obstacle.height + 4); ctx.lineTo(x + obstacle.width / 2 + 2, ground - 9); ctx.lineTo(x + obstacle.width / 2, ground); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#acb9a7'; ctx.beginPath(); ctx.moveTo(x - 5, ground - obstacle.height); ctx.lineTo(x + 11, ground - obstacle.height + 4); ctx.lineTo(x + 3, ground - 12); ctx.lineTo(x - 13, ground - 15); ctx.closePath(); ctx.fill();
        round(ctx, x - 13, ground - obstacle.height + 2, 16, 5, 3, p.grass);
      }
    }
    for (const egg of session.eggs) {
      if (egg.collected) continue;
      const x = 86 + egg.x - session.distance, y = ground - egg.height;
      if (x < -20 || x > 460) continue;
      const bob = frame.reducedMotion ? 0 : Math.sin(session.elapsed / 180 + egg.id) * 3;
      ellipse(ctx, x, y + bob, 15, 18, '#fff8d044');
      ctx.save(); ctx.translate(x, y + bob); ctx.fillStyle = '#fff2c5'; ctx.strokeStyle = '#d8ac58'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.bezierCurveTo(10, -9, 14, 8, 5, 11); ctx.bezierCurveTo(-9, 17, -16, 0, 0, -12); ctx.closePath(); ctx.fill(); ctx.stroke();
      ellipse(ctx, -3, -4, 2.5, 3.5, '#79b478'); ellipse(ctx, 5, 5, 3, 2.5, '#79b478'); ellipse(ctx, -4, 7, 2, 2, '#d7ba66');
      ctx.restore();
    }
    const finishX = 86 + session.courseLength - session.distance;
    if (finishX < 510) {
      round(ctx, finishX, ground - 165, 7, 170, 3, '#b48b56');
      round(ctx, finishX + 5, ground - 163, 102, 45, 5, '#fff9dc');
      for (let row = 0; row < 3; row++) for (let col = 0; col < 7; col++) if ((row + col) % 2 === 0) { ctx.fillStyle = '#476f5b'; ctx.fillRect(finishX + 6 + col * 14, ground - 160 + row * 14, 14, 14); }
      ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#356345'; ctx.fillText('도착!', finishX + 50, ground - 177);
    }
    const next = session.nextObstacle;
    if (next && next.x - session.distance < 270 && next.x - session.distance > 12 && !session.finished) {
      const x = Math.min(355, 86 + next.x - session.distance);
      round(ctx, x - 30, ground - 123, 60, 28, 14, '#fffdf0');
      ctx.fillStyle = '#386e4b'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(next.x - session.distance > 110 ? '준비!' : '↑ 점프!', x, ground - 104);
      ctx.fillStyle = '#fffdf0'; ctx.beginPath(); ctx.moveTo(x - 4, ground - 96); ctx.lineTo(x + 4, ground - 96); ctx.lineTo(x, ground - 90); ctx.fill();
    }
    dinosaur(ctx, session, 86, ground);
    if (session.elapsed < session.jumpBurstUntil) {
      const burst = 1 - (session.jumpBurstUntil - session.elapsed) / 400;
      const y = ground - session.height + 8;
      ctx.save(); ctx.globalAlpha = 1 - burst;
      ctx.strokeStyle = '#fff3ad'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(86, y, frame.reducedMotion ? 27 : 19 + burst * 23, frame.reducedMotion ? 8 : 5 + burst * 8, 0, 0, Math.PI * 2); ctx.stroke();
      if (!frame.reducedMotion) for (const offset of [-1, 0, 1]) {
        ellipse(ctx, 86 + offset * (19 + burst * 15), y + burst * 25, 3, 3, '#fff1b5');
      }
      ctx.restore();
    }
    if (!session.finished) {
      round(ctx, 22, ground + 63, 170, 34, 15, '#fffdf1eb');
      ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#386e4b';
      ctx.fillText(session.grounded ? '다시 두 번 폴짝!' : '남은 공중 점프', 34, ground + 85);
      for (let hop = 0; hop < 2; hop++) {
        ellipse(ctx, 157 + hop * 19, ground + 80, 6, 8, hop < session.jumpsRemaining ? '#69ad65' : '#dce5cd');
      }
    }
    for (let i = -1; i < 6; i++) {
      const x = i * 100 - (session.distance * 1.12) % 100;
      fern(ctx, x + 25, 546 + (i % 2) * 11, 30 + (i % 2) * 12, p.leaf);
      if (i % 2 === 0) { ellipse(ctx, x + 57, 530, 5, 5, '#fff3bb'); ellipse(ctx, x + 57, 530, 2, 2, '#d6a35a'); }
    }
    if (session.elapsed < 3_700) {
      round(ctx, 126, 185, 204, 59, 18, '#fffdf1ed');
      ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#386e4b'; ctx.fillText('공룡과 함께 출발!', 228, 209);
      ctx.font = '12px sans-serif'; ctx.fillText('공중에서 한 번 더 폴짝 ↑', 228, 230);
    }
    ctx.restore();
  },
};

export default definition;
