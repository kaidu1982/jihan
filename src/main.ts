import './style.css';
import './arcade.css';
import type { MiniGameDefinition } from './mini-types';

const selection = new URLSearchParams(window.location.search).get('game');
const miniGames: Record<string, () => Promise<{ default: MiniGameDefinition }>> = {
  dino: () => import('./dino'),
  space: () => import('./space'),
  maze: () => import('./maze'),
};
const load = selection === 'stairs'
  ? import('./stairs')
  : selection === 'kart'
    ? import('./kart')
    : selection && Object.hasOwn(miniGames, selection)
      ? Promise.all([import('./mini-shell'), miniGames[selection]()]).then(([shell, game]) => shell.mountMiniGame(game.default))
      : import('./arcade');

void load.catch(error => {
  console.error('Game could not load', error);
  const app = document.querySelector<HTMLElement>('#app')!;
  app.replaceChildren();
  const main = document.createElement('main');
  main.className = 'arcade-load-error';
  const heading = document.createElement('h1');
  heading.textContent = '게임을 준비하지 못했어요';
  const copy = document.createElement('p');
  copy.textContent = '새로고침해서 다시 만나봐요.';
  const retry = document.createElement('button');
  retry.textContent = '다시 해 보기';
  retry.addEventListener('click', () => window.location.reload());
  const home = document.createElement('a');
  home.href = '/'; home.textContent = '게임 고르기';
  main.append(heading, copy, retry, home); app.append(main);
});
