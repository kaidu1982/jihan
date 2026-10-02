import type Phaser from 'phaser';
import type { CompanionId, WorldId } from './content';

type Graphics = Phaser.GameObjects.Graphics;
export const WORLD_ART: Record<WorldId, { top: number; bottom: number; step: number; side: number; accent: number; shadow: number; glow: number }> = {
  meadow: { top: 0xa4dfea, bottom: 0xe8f5d7, step: 0xfff9e6, side: 0x78b3a1, accent: 0x73b888, shadow: 0x326e64, glow: 0xffd56a },
  sunset: { top: 0xf3adb5, bottom: 0xffe2b8, step: 0xfff0d7, side: 0xbf7da1, accent: 0xe8a16e, shadow: 0x775777, glow: 0xffed93 },
  forest: { top: 0x568d88, bottom: 0xb5dcc3, step: 0xe7efbe, side: 0x588975, accent: 0x87bf70, shadow: 0x245748, glow: 0xf3e875 },
  snow: { top: 0xb4d7ec, bottom: 0xedf8fc, step: 0xfaffff, side: 0x85b8d4, accent: 0x9bd5e4, shadow: 0x63899d, glow: 0xffd577 },
  space: { top: 0x25264f, bottom: 0x71628c, step: 0xdad5f6, side: 0x8176b3, accent: 0xa897dc, shadow: 0x29254c, glow: 0xffde7f },
};

export function star(g: Graphics, x: number, y: number, radius: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha); g.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const r = i % 2 ? radius * .47 : radius;
    const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath(); g.fillPath();
}

function cloud(g: Graphics, x: number, y: number, size: number, color: number, alpha: number): void {
  g.fillStyle(color, alpha);
  g.fillEllipse(x, y + size * .15, size * 1.7, size * .5);
  g.fillCircle(x - size * .28, y, size * .39); g.fillCircle(x + size * .24, y - size * .1, size * .48);
}

function pine(g: Graphics, x: number, y: number, size: number, color: number, snowy = false): void {
  g.fillStyle(color, .6);
  g.fillRect(x - size * .045, y - size * .28, size * .09, size * .28);
  g.fillTriangle(x, y - size, x - size * .27, y - size * .39, x + size * .27, y - size * .39);
  g.fillTriangle(x, y - size * .72, x - size * .37, y - size * .15, x + size * .37, y - size * .15);
  if (snowy) { g.fillStyle(0xffffff, .7); g.fillTriangle(x, y - size, x - size * .13, y - size * .7, x + size * .13, y - size * .7); }
}

export function drawWorld(g: Graphics, world: WorldId, width: number, height: number, time: number, camera: number, reduced: boolean): void {
  const p = WORLD_ART[world];
  const t = reduced ? 0 : time;
  const drift = reduced ? 0 : camera * .06 % 45;
  g.fillGradientStyle(p.top, p.top, p.bottom, p.bottom, 1); g.fillRect(0, 0, width, height);

  if (world === 'meadow') {
    g.fillStyle(0xffefb3, .82); g.fillCircle(width * .18, 110, 38);
    for (let i = 0; i < 6; i++) cloud(g, (i * 147 + t * .002) % (width + 150) - 70, 68 + i % 3 * 115 - drift, 53, 0xffffff, .5);
    g.fillStyle(0x94c6ae, .42); g.fillTriangle(-80, height, 75, height - 165, width * .7, height);
    g.fillTriangle(width * .3, height, width - 70, height - 190, width + 90, height);
    g.fillStyle(0x79b69b, .48); g.fillEllipse(width * .14, height + 42, width * 1.5, 210);
    g.fillStyle(0x5eaa91, .44); g.fillEllipse(width, height + 30, width * 1.4, 160);
    for (let i = 0; i < 11; i++) { const x = (i * 79 + 25) % width, y = height - 19 - i % 3 * 9; g.fillStyle(i % 2 ? 0xffe79c : 0xffd0c3, .85); g.fillCircle(x, y, 3); }
  } else if (world === 'sunset') {
    g.fillStyle(0xffdc9b, .23); g.fillCircle(width * .73, height * .29, 89);
    g.fillStyle(0xffe2ac, .9); g.fillCircle(width * .73, height * .29, 55);
    for (let i = 0; i < 4; i++) cloud(g, (i * 164 + t * .002) % (width + 140) - 65, 70 + i * 84 - drift, 53, 0xfff1d9, .45);
    g.fillStyle(0xad94bd, .4); g.fillTriangle(-30, height * .88, width * .3, height * .59, width * .72, height * .88);
    g.fillStyle(0x9189b0, .32); g.fillTriangle(width * .38, height * .88, width * .87, height * .53, width + 80, height * .88);
    g.fillStyle(0xa997c0, .52); g.fillRect(0, height * .84, width, height * .16);
    for (let i = 0; i < 8; i++) { const y = height * .86 + i * 11; g.lineStyle(2, 0xffebc6, .35); const x = width * .65 + Math.sin(i + t * .0006) * 13; g.lineBetween(x - 17 - i * 6, y, x + 17 + i * 6, y); }
    for (let i = 0; i < 3; i++) { const x = 24 + i * (width - 48) / 2, y = height * .43 + Math.sin(i * 2 + t * .0007) * 12; g.fillStyle(0xffdd9c, .7); g.fillRoundedRect(x - 6, y - 8, 12, 16, 4); g.lineStyle(1, 0xb5767d, .5); g.lineBetween(x - 4, y + 8, x + 4, y + 8); }
  } else if (world === 'forest') {
    for (let i = 0; i < 8; i++) {
      const x = i * width / 6 - 20, h = height * (.55 + (i % 3) * .13);
      g.fillStyle(0x396b65, .18 + i % 2 * .06); g.fillRoundedRect(x - 10, height - h, 20, h, 8);
      g.fillStyle(0x4b8271, .35); g.fillEllipse(x, height - h + 14, 115, 165);
    }
    g.fillStyle(0xdaf1c1, .13); g.fillTriangle(width * .2, 0, width * .15, height, width * .7, height);
    g.fillStyle(0x3c7c66, .6); g.fillEllipse(0, height + 22, width * 1.3, 160); g.fillEllipse(width, height + 26, width * 1.4, 170);
    for (let i = 0; i < 13; i++) {
      const x = ((i * 97 + 21) % width) + Math.sin(t * .0007 + i) * 6, y = height * .25 + (i * 83) % (height * .67) - drift;
      const alpha = reduced ? .5 : .35 + Math.sin(t * .002 + i) * .2;
      g.fillStyle(0xffedaa, alpha * .25); g.fillCircle(x, y, 7); g.fillStyle(0xfff2b5, alpha); g.fillCircle(x, y, 2);
    }
    for (let i = 0; i < 5; i++) { const x = 22 + (i * 111) % width, y = height - 16 - i % 2 * 15; g.fillStyle(0xf8e5c5, .8); g.fillRoundedRect(x - 3, y - 3, 6, 12, 2); g.fillStyle(0xd29187, .85); g.fillEllipse(x, y - 5, 21, 13); g.fillStyle(0xffe7c8, .85); g.fillCircle(x - 4, y - 7, 2); }
  } else if (world === 'snow') {
    g.fillStyle(0xfff4ce, .75); g.fillCircle(width * .78, 100, 29);
    for (let i = 0; i < 4; i++) {
      const x = i * width / 2.5 - 50, peak = height * (.53 + i % 2 * .08);
      g.fillStyle(i % 2 ? 0xadc9db : 0xc5dce8, .95); g.fillTriangle(x - 115, height, x + 35, peak, x + 205, height);
      g.fillStyle(0xf7fdff, .9); g.fillTriangle(x + 35, peak, x - 13, peak + 91, x + 91, peak + 91);
    }
    pine(g, 31, height - 7, 125, 0x74a3b7, true); pine(g, width - 35, height + 4, 153, 0x719eae, true);
    g.fillStyle(0xf7fdff, .82); g.fillEllipse(width * .35, height + 55, width * 1.7, 160);
    for (let i = 0; i < 22; i++) { const x = (i * 83 + 17 + Math.sin(t * .0005 + i) * 8) % width, y = (i * 67 + t * .013) % height; g.fillStyle(0xffffff, .65); g.fillCircle(x, y, 1.5 + i % 3 * .4); }
  } else {
    g.fillStyle(0xb18aca, .1); g.fillEllipse(width * .7, height * .28, width * 1.2, 190);
    for (let i = 0; i < 37; i++) {
      const x = (i * 113 + 19) % width, y = ((i * 83 + 31) % height + height - drift) % height;
      const alpha = reduced ? .62 : .5 + Math.sin(t * .001 + i * 1.7) * .22;
      if (i % 9 === 0) star(g, x, y, 4, 0xffeabd, alpha); else { g.fillStyle(0xffffff, alpha); g.fillCircle(x, y, i % 4 === 0 ? 1.8 : 1); }
    }
    const moonX = width * .79, moonY = 119;
    g.fillStyle(0xe8dcca, .85); g.fillCircle(moonX, moonY, 37);
    g.fillStyle(0xc9bdc4, .55); g.fillCircle(moonX - 11, moonY - 7, 9); g.fillCircle(moonX + 12, moonY + 14, 6); g.fillCircle(moonX + 13, moonY - 14, 4);
    g.lineStyle(8, 0xddaabc, .5); g.strokeEllipse(46, height * .74, 128, 29);
    g.fillStyle(0xbc96bf, .75); g.fillCircle(46, height * .74, 30);
    g.lineStyle(5, 0xdcb6cf, .5); g.beginPath(); g.arc(46, height * .74, 46, 0, Math.PI, false); g.strokePath();
    g.fillStyle(0x9184b0, .2); g.fillEllipse(width * .68, height + 55, width * 1.8, 170);
  }
}

function face(g: Graphics, x: number, y: number, spread = 5): void {
  g.fillStyle(0x3d525b); g.fillEllipse(x - spread, y, 2.7, 3.7); g.fillEllipse(x + spread, y, 2.7, 3.7);
  g.lineStyle(1.2, 0x3d525b); g.beginPath(); g.arc(x, y + 2, 3, 0, Math.PI, false); g.strokePath();
  g.fillStyle(0xf1a9a3, .7); g.fillEllipse(x - spread - 4, y + 3, 5, 2.5); g.fillEllipse(x + spread + 4, y + 3, 5, 2.5);
}

export function drawCompanion(g: Graphics, companion: CompanionId, x: number, y: number, time: number, reduced: boolean): void {
  const bob = reduced ? 0 : Math.sin(time * .004) * 3;
  y += bob;
  if (companion === 'cloud') {
    cloud(g, x, y, 23, 0xffffff, .96); face(g, x, y + 2);
  } else if (companion === 'sprout') {
    g.fillStyle(0xd8a783); g.fillRoundedRect(x - 12, y - 8, 24, 25, 7);
    g.fillStyle(0xeabc92); g.fillRoundedRect(x - 15, y - 9, 30, 7, 3);
    g.lineStyle(3, 0x5e9f66); g.lineBetween(x, y - 8, x, y - 24);
    g.fillStyle(0x8eca77); g.fillEllipse(x - 7, y - 23, 17, 10); g.fillStyle(0x6fb775); g.fillEllipse(x + 7, y - 29, 17, 10);
    face(g, x, y + 4);
  } else if (companion === 'star') {
    star(g, x, y, 22, 0xffdc77); face(g, x, y);
  } else if (companion === 'bunny') {
    g.fillStyle(0xfff4e9); g.fillEllipse(x - 8, y - 23, 11, 30); g.fillEllipse(x + 8, y - 23, 11, 30);
    g.fillStyle(0xefb7b8); g.fillEllipse(x - 8, y - 23, 4, 20); g.fillEllipse(x + 8, y - 23, 4, 20);
    g.fillStyle(0xfff4e9); g.fillEllipse(x, y, 36, 33); g.fillEllipse(x - 11, y + 15, 12, 7); g.fillEllipse(x + 11, y + 15, 12, 7);
    face(g, x, y + 1);
  } else if (companion === 'comet') {
    g.lineStyle(8, 0xf4b79c, .5); g.lineBetween(x - 8, y + 2, x - 37, y - 12);
    g.lineStyle(5, 0xffd08f, .8); g.lineBetween(x - 7, y, x - 30, y - 20);
    star(g, x, y, 21, 0xffe199); face(g, x, y);
  } else {
    g.fillStyle(0x8bacd2); g.fillRoundedRect(x - 31, y - 11, 17, 25, 3); g.fillRoundedRect(x + 14, y - 11, 17, 25, 3);
    g.lineStyle(1, 0xccdef0, .6);
    for (const dx of [-31, 14]) { g.lineBetween(x + dx + 8, y - 9, x + dx + 8, y + 12); g.lineBetween(x + dx + 2, y + 1, x + dx + 15, y + 1); }
    g.lineStyle(2, 0xd8e1ee); g.lineBetween(x, y - 13, x + 5, y - 24);
    g.fillStyle(0xffd68a); g.fillCircle(x + 5, y - 25, 4);
    g.fillStyle(0xe5e4f4); g.fillRoundedRect(x - 14, y - 15, 28, 33, 9); face(g, x, y);
  }
}
