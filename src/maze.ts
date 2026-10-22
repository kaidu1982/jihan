import type { MiniGameDefinition, MiniFrame, MiniSession } from './mini-types';
import { MazeSession, sameMazePoint } from './maze-session';

const PALETTES = [
  { sky: '#dff6e6', grass: '#b7df91', hedge: '#4d9e62', leaf: '#79bd72', dark: '#34794f', path: '#fff1cb', flower: '#ff8b98' },
  { sky: '#fff0dc', grass: '#d5dfa1', hedge: '#77a858', leaf: '#a6c96c', dark: '#577c44', path: '#fff3d5', flower: '#b993ef' },
  { sky: '#e5efff', grass: '#b4d1c2', hedge: '#538e83', leaf: '#7db7a2', dark: '#376c69', path: '#fdf0d7', flower: '#f7b78b' },
];

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  ctx.fillStyle = color; ctx.beginPath();
  for (let index = 0; index < 10; index++) {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const r = radius * (index % 2 ? .42 : 1);
    const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r;
    if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
}

function drawKey(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, pulse: number): void {
  circle(ctx, x, y, size * .52 + pulse, '#ffdd6860');
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.55);
  ctx.strokeStyle = '#b77913'; ctx.lineWidth = size * .18; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-size * .18, -size * .16, size * .19, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-size * .03, 0); ctx.lineTo(size * .29, size * .34); ctx.lineTo(size * .42, size * .22); ctx.stroke();
  ctx.strokeStyle = '#ffdc4b'; ctx.lineWidth = size * .11;
  ctx.beginPath(); ctx.arc(-size * .18, -size * .19, size * .19, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-size * .03, -.03 * size); ctx.lineTo(size * .29, size * .31); ctx.lineTo(size * .42, size * .19); ctx.stroke();
  ctx.restore();
  star(ctx, x + size * .38, y - size * .42, size * .14, '#ffffff');
}

function drawChest(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, open: boolean, ready: boolean): void {
  if (ready) circle(ctx, x, y, size * .65, '#ffe27b77');
  const w = size * .8, h = size * .53;
  round(ctx, x - w / 2, y - h * .12, w, h, size * .1, '#9b622f');
  round(ctx, x - w / 2 + 2, y - h * .12 + 2, w - 4, h - 4, size * .07, '#d39646');
  ctx.save(); ctx.translate(x, y - h * .1); if (open) ctx.rotate(-.25);
  round(ctx, -w / 2, -h * .7 - (open ? size * .24 : 0), w, h * .75, size * .16, '#a5682e');
  round(ctx, -w / 2 + 2, -h * .7 + 2 - (open ? size * .24 : 0), w - 4, h * .65, size * .11, '#edb15c');
  ctx.restore();
  ctx.fillStyle = '#ffdb65';
  ctx.fillRect(x - w * .31, y - h * .68, w * .13, h * 1.52);
  ctx.fillRect(x + w * .18, y - h * .68, w * .13, h * 1.52);
  round(ctx, x - size * .12, y - size * .03, size * .24, size * .22, size * .05, '#ffdf70');
  circle(ctx, x, y + size * .05, size * .035, '#9b622f');
  if (open) {
    star(ctx, x - size * .15, y - size * .27, size * .23, '#fff9ae');
    star(ctx, x + size * .2, y - size * .1, size * .15, '#ffdf45');
  }
}

function drawExplorer(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, character: string): void {
  const s = size / 32;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#44774633'; ctx.beginPath(); ctx.ellipse(0, 12, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
  round(ctx, -10, 2, 20, 15, 7, character === 'fox' ? '#ef9155' : character === 'bunny' ? '#c2a4de' : '#5da9e7');
  circle(ctx, -6, 14, 4, '#586a84'); circle(ctx, 6, 14, 4, '#586a84');
  if (character === 'fox') {
    ctx.fillStyle = '#e77839'; ctx.beginPath(); ctx.moveTo(-12, -4); ctx.lineTo(-12, -19); ctx.lineTo(-3, -11); ctx.fill();
    ctx.beginPath(); ctx.moveTo(12, -4); ctx.lineTo(12, -19); ctx.lineTo(3, -11); ctx.fill();
    circle(ctx, 0, -4, 13, '#ed8b49');
    ctx.fillStyle = '#fff2d3'; ctx.beginPath(); ctx.ellipse(0, 1, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
    circle(ctx, 0, 0, 2, '#484439');
  } else if (character === 'bunny') {
    round(ctx, -10, -26, 7, 20, 4, '#fff8ee'); round(ctx, 3, -26, 7, 20, 4, '#fff8ee');
    round(ctx, -8, -23, 3, 13, 2, '#f5b0bf'); round(ctx, 5, -23, 3, 13, 2, '#f5b0bf');
    circle(ctx, 0, -4, 13, '#fff8ee'); circle(ctx, 0, 0, 2, '#ec91a5');
  } else {
    circle(ctx, 0, -5, 12, '#ffd7af');
    round(ctx, -13, -17, 26, 9, 5, '#f6bb49'); round(ctx, -16, -10, 33, 5, 2, '#db9b2d');
    round(ctx, -8, -21, 16, 11, 5, '#ffce63');
  }
  circle(ctx, -4.5, -5, 1.65, '#344447'); circle(ctx, 4.5, -5, 1.65, '#344447');
  circle(ctx, -8, -1, 2, '#f5a7a266'); circle(ctx, 8, -1, 2, '#f5a7a266');
  ctx.strokeStyle = '#8c6554'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(0, -1, 3, .2, Math.PI - .2); ctx.stroke();
  round(ctx, -8, 5, 16, 4, 2, '#f9d35d');
  ctx.restore();
}

function drawMaze(ctx: CanvasRenderingContext2D, rawSession: MiniSession, frame: MiniFrame): void {
  const session = rawSession as MazeSession;
  const { maze } = session;
  const colors = PALETTES[session.level];
  ctx.save();
  ctx.scale(frame.width / 420, frame.height / 560);
  ctx.fillStyle = colors.sky; ctx.fillRect(0, 0, 420, 560);
  // Soft garden hills sit behind the overlaid game HUD.
  circle(ctx, 68, 25, 125, '#ffffff55'); circle(ctx, 392, 49, 145, '#ffffff44');
  const boardSize = 364, left = 28, top = 139, tile = boardSize / maze.size;
  round(ctx, left - 8, top - 8, boardSize + 16, boardSize + 16, 18, '#446f4433');
  round(ctx, left - 5, top - 7, boardSize + 10, boardSize + 10, 17, '#ffffff');
  round(ctx, left, top, boardSize, boardSize, 13, colors.grass);
  ctx.save(); ctx.beginPath(); ctx.roundRect(left, top, boardSize, boardSize, 13); ctx.clip();
  for (let row = 0; row < maze.size; row++) for (let column = 0; column < maze.size; column++) {
    const x = left + column * tile, y = top + row * tile;
    if (maze.tiles[row][column] === '.') {
      ctx.fillStyle = colors.path; ctx.fillRect(x - .5, y - .5, tile + 1, tile + 1);
      if ((column * 11 + row * 7) % 4 === 0) {
        circle(ctx, x + tile * .24, y + tile * .8, 1.2, '#d7c79c');
        circle(ctx, x + tile * .77, y + tile * .22, .9, '#dfcfa7');
      }
    }
  }
  for (let row = 0; row < maze.size; row++) for (let column = 0; column < maze.size; column++) {
    if (maze.tiles[row][column] !== '#') continue;
    const x = left + column * tile, y = top + row * tile;
    round(ctx, x + 1, y + tile * .1, tile - 2, tile * .88, tile * .2, colors.dark);
    round(ctx, x + 1, y + 1, tile - 2, tile * .8, tile * .23, colors.hedge);
    circle(ctx, x + tile * .32, y + tile * .3, tile * .2, colors.leaf);
    circle(ctx, x + tile * .67, y + tile * .45, tile * .23, colors.leaf);
    if ((column * 3 + row * 11 + session.level) % 9 === 0) {
      for (let petal = 0; petal < 5; petal++) circle(ctx, x + tile * .5 + Math.cos(petal * Math.PI * .4) * tile * .1, y + tile * .48 + Math.sin(petal * Math.PI * .4) * tile * .1, tile * .065, colors.flower);
      circle(ctx, x + tile * .5, y + tile * .48, tile * .06, '#fff4ab');
    } else if (session.level === 1 && (column + row * 2) % 7 === 0) {
      round(ctx, x + tile * .44, y + tile * .38, tile * .13, tile * .29, tile * .04, '#ffefcb');
      ctx.fillStyle = '#de857c'; ctx.beginPath(); ctx.arc(x + tile * .5, y + tile * .4, tile * .22, Math.PI, 0); ctx.fill();
      circle(ctx, x + tile * .41, y + tile * .3, tile * .035, '#fff7e5');
      circle(ctx, x + tile * .57, y + tile * .27, tile * .04, '#fff7e5');
    } else if (session.level === 2 && (column * 2 + row) % 7 === 0) {
      round(ctx, x + tile * .46, y + tile * .37, tile * .1, tile * .37, tile * .03, '#b38b57');
      ctx.fillStyle = '#306d66'; ctx.beginPath(); ctx.moveTo(x + tile * .5, y + tile * .08); ctx.lineTo(x + tile * .22, y + tile * .57); ctx.lineTo(x + tile * .78, y + tile * .57); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a3d0a7'; ctx.beginPath(); ctx.moveTo(x + tile * .5, y + tile * .08); ctx.lineTo(x + tile * .37, y + tile * .36); ctx.lineTo(x + tile * .63, y + tile * .36); ctx.closePath(); ctx.fill();
    }
  }
  const center = (point: { x: number; y: number }): [number, number] => [left + (point.x + .5) * tile, top + (point.y + .5) * tile];
  const [startX, startY] = center(maze.start);
  circle(ctx, startX, startY, tile * .26, '#c4dda4');
  ctx.fillStyle = '#76a566'; ctx.font = `700 ${tile * .24}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('집', startX, startY + tile * .09);
  const motion = frame.reducedMotion ? 0 : Math.sin(session.elapsed / 300) * 2;
  session.hintPath.slice(1).forEach((point, index) => {
    const [x, y] = center(point);
    circle(ctx, x, y, tile * .24, '#fff688aa');
    star(ctx, x, y + motion * .4, tile * .12 - index * .3, '#d6a127');
  });
  maze.gems.forEach((gem, index) => {
    if (session.collectedGems.has(`${gem.x},${gem.y}`)) return;
    const [x, y] = center(gem), s = tile * .25;
    ctx.fillStyle = ['#47c2c2', '#b48ce5', '#ed89a6', '#68badf', '#74bf8b'][index % 5];
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * .75, y - s * .25); ctx.lineTo(x + s * .6, y + s * .6); ctx.lineTo(x, y + s); ctx.lineTo(x - s * .7, y + s * .2); ctx.lineTo(x - s * .65, y - s * .5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffffff99'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x - s * .4, y - s * .3); ctx.lineTo(x + s * .4, y - s * .1); ctx.lineTo(x, y + s * .65); ctx.stroke();
    star(ctx, x + s * .55, y - s * .6, tile * .07, '#ffffff');
  });
  const [keyX, keyY] = center(maze.key);
  if (!session.hasKey) drawKey(ctx, keyX, keyY, tile * .75, motion);
  const [chestX, chestY] = center(maze.chest);
  drawChest(ctx, chestX, chestY, tile * .85, session.finished, session.hasKey);
  const movement = frame.reducedMotion ? 1 : Math.min(1, session.movementAge / 85);
  const eased = 1 - (1 - movement) ** 2;
  const visual = { x: session.previousPosition.x + (session.position.x - session.previousPosition.x) * eased, y: session.previousPosition.y + (session.position.y - session.previousPosition.y) * eased };
  const [playerX, playerY] = center(visual);
  drawExplorer(ctx, playerX, playerY - tile * .03, Math.min(34, tile * .8), session.character);
  if (session.finished && sameMazePoint(session.position, maze.chest)) {
    for (let index = 0; index < 7; index++) {
      const angle = index * Math.PI * 2 / 7;
      star(ctx, playerX + Math.cos(angle) * tile * .8, playerY + Math.sin(angle) * tile * .8, 5, index % 2 ? '#fff7a5' : '#ffc948');
    }
  }
  ctx.restore();
  round(ctx, 64, 518, 292, 26, 13, '#ffffffaa');
  ctx.textAlign = 'center'; ctx.fillStyle = colors.dark; ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText(`💎 ${session.collectedGems.size} / ${maze.gems.length}    ·    시간 제한 없이 천천히!`, 210, 535);
  ctx.restore();
}

const maze: MiniGameDefinition = {
  id: 'maze', title: '보물 미로', icon: '🗝️', kicker: '천천히 생각하는 정원 탐험',
  tagline: '열쇠를 찾아 반짝이는 보물상자를 열자!',
  description: '작은 정원을 산책하며 보석과 열쇠를 찾아요. 막힌 길에서는 돌아가도 괜찮아요. 시간 제한 없이 나만의 속도로 보물을 찾아보세요.',
  accent: '#5b9c64', startLabel: '보물 찾으러 가기', scoreUnit: '걸음',
  instructions: [
    { icon: '👆', title: '한 칸씩 움직여요', copy: '방향 버튼이나 키보드 방향키로 정원 길을 걸어요.' },
    { icon: '🔑', title: '열쇠를 먼저 찾아요', copy: '황금 열쇠를 주운 뒤 보물상자에 도착하면 성공!' },
    { icon: '✨', title: '힌트는 언제든지', copy: '길이 헷갈리면 반짝이는 발자국을 따라가요. 별은 줄지 않아요.' },
  ],
  controls: [
    { action: 'up', label: '위로', icon: '↑', keys: ['ArrowUp', 'KeyW'] },
    { action: 'left', label: '왼쪽', icon: '←', keys: ['ArrowLeft', 'KeyA'] },
    { action: 'down', label: '아래로', icon: '↓', keys: ['ArrowDown', 'KeyS'] },
    { action: 'right', label: '오른쪽', icon: '→', keys: ['ArrowRight', 'KeyD'] },
    { action: 'hint', label: '길 힌트', icon: '✨', keys: ['KeyH'] },
  ],
  stages: [
    { name: '꽃잎 정원', icon: '🌼', copy: '작은 7칸 정원 · 보석 3개' },
    { name: '버섯 숲길', icon: '🍄', copy: '갈림길이 늘어난 9칸 정원 · 보석 4개' },
    { name: '비밀의 정원', icon: '🌳', copy: '넓은 11칸 정원 · 보석 5개' },
  ],
  characters: [
    { id: 'child', name: '꼬마 탐험가', icon: '🧒', cost: 0 },
    { id: 'fox', name: '여우 탐험가', icon: '🦊', cost: 10 },
    { id: 'bunny', name: '토끼 탐험가', icon: '🐰', cost: 20 },
  ],
  create: options => new MazeSession(options),
  draw: drawMaze,
};

export default maze;
