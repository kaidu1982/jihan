import { activeProfile } from './storage';
import { MINI_CARDS, renderMiniCard } from './mini-catalog';

document.body.classList.add('arcade-page');
document.title = '지한이의 작은 오락실 · 오늘은 어떤 모험을 할까?';

const stairsArt = `<svg preserveAspectRatio="xMidYMid slice" viewBox="0 0 520 280" aria-hidden="true" class="arcade-illustration">
  <defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#c3e8ea"/><stop offset="1" stop-color="#eff5d5"/></linearGradient></defs>
  <rect width="520" height="280" fill="url(#sky)"/>
  <circle cx="418" cy="57" r="32" fill="#fff2b8"/>
  <g fill="#fff" opacity=".8"><ellipse cx="88" cy="74" rx="53" ry="14"/><circle cx="80" cy="59" r="22"/><circle cx="107" cy="65" r="18"/><ellipse cx="422" cy="143" rx="66" ry="14"/><circle cx="397" cy="129" r="22"/><circle cx="428" cy="125" r="29"/></g>
  <path d="M0 246Q93 184 211 249T520 224V280H0" fill="#b2d4b2"/><path d="M0 268Q153 220 280 271T520 247V280H0" fill="#96bd96"/>
  <g stroke="#fffbed" stroke-width="2"><path d="M111 239h83v18h-83z" fill="#75a99c"/><path d="M155 204h83v18h-83z" fill="#82b5a4"/><path d="M199 169h83v18h-83z" fill="#8cbb9c"/><path d="M243 134h83v18h-83z" fill="#9ac2a3"/><path d="M287 99h83v18h-83z" fill="#aaceac"/></g>
  <g fill="#e7b94c"><path d="m361 59 4 9 10 1-8 7 2 10-8-5-9 5 2-10-8-7 11-1z"/><path d="m99 144 3 6 6 1-5 4 1 7-5-3-6 3 1-7-4-4 6-1z"/></g>
  <g fill="#fff9e9" opacity=".9"><ellipse cx="448" cy="225" rx="25" ry="9"/><circle cx="438" cy="218" r="11"/><circle cx="452" cy="214" r="14"/><circle cx="465" cy="221" r="9"/></g>
</svg><img class="arcade-stair-boy" src="/assets/jihan-climber.png" alt="구름 계단을 오르는 지한이" width="1280" height="1280" />`;

const kartArt = `<svg preserveAspectRatio="xMidYMid slice" viewBox="0 0 520 280" aria-hidden="true" class="arcade-illustration">
  <rect width="520" height="280" fill="#e7eec9"/>
  <path d="M0 0h520v72Q404 32 288 76T0 48" fill="#d4e6c5"/>
  <path d="M225-30C380 61 110 113 268 300" fill="none" stroke="#fdf5dc" stroke-width="157"/>
  <path d="M225-30C380 61 110 113 268 300" fill="none" stroke="#7e9292" stroke-width="132"/>
  <path d="M225-30C380 61 110 113 268 300" fill="none" stroke="#f5f0d9" stroke-width="3" stroke-dasharray="15 14"/>
  <g fill="#729d70"><circle cx="90" cy="67" r="28"/><circle cx="117" cy="93" r="23"/><circle cx="413" cy="178" r="32"/><circle cx="432" cy="149" r="24"/></g>
  <g fill="#8fb37b"><circle cx="84" cy="55" r="22"/><circle cx="109" cy="82" r="18"/><circle cx="406" cy="162" r="26"/><circle cx="426" cy="137" r="19"/></g>
  <g fill="#edc85d"><path d="m306 49 4 9 10 1-7 7 1 10-8-5-9 5 2-10-8-7 11-1z"/><path d="m278 94 4 9 10 1-7 7 1 10-8-5-9 5 2-10-8-7 11-1z"/></g>
  <g transform="translate(225 186) rotate(-17)"><ellipse cy="32" rx="45" ry="15" fill="#345757" opacity=".18"/><rect x="-39" y="-24" width="15" height="29" rx="6" fill="#314c49"/><rect x="24" y="-24" width="15" height="29" rx="6" fill="#314c49"/><rect x="-40" y="18" width="16" height="28" rx="6" fill="#314c49"/><rect x="24" y="18" width="16" height="28" rx="6" fill="#314c49"/><rect x="-29" y="-43" width="58" height="88" rx="19" fill="#e87c59"/><rect x="-22" y="-34" width="44" height="21" rx="9" fill="#f6ad75"/><rect x="-20" y="-5" width="40" height="28" rx="10" fill="#405d56"/><circle cy="1" r="12" fill="#ffd0a2"/><path d="M-13-1q0-23 25 0" fill="#33443b"/><rect x="-21" y="30" width="42" height="8" rx="3" fill="#f8c887"/></g>
  <g transform="translate(375 35)"><path d="M0 0v65" stroke="#56694b" stroke-width="4"/><path d="M2 0h47v32H2" fill="#fff9e6"/><path d="M2 0h12v11H2m24 0h12v11H26m12-11h11v11H38M14 11h12v11H14M2 22h12v10H2m24-10h12v10H26m12-11h11v11H38" fill="#3e5850"/></g>
  <g fill="#f6ae7e"><circle cx="133" cy="213" r="5"/><circle cx="152" cy="240" r="4"/><circle cx="376" cy="246" r="5"/></g>
</svg>`;

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="site-header arcade-header">
    <a class="brand" href="/" aria-label="지한이의 작은 오락실 처음으로"><span class="brand-mark" aria-hidden="true">✦</span><span>지한이의 <strong>작은 오락실</strong></span></a>
    <span class="arcade-header-note">${MINI_CARDS.length + 2}가지 놀이 · 작은 손으로, 커다란 모험</span>
  </header>
  <main class="arcade-main">
    <div class="arcade-welcome"><span class="arcade-kicker">HELLO, LITTLE ADVENTURER!</span><h1>오늘은 어떤 <span>모험</span>을 할까?<i aria-hidden="true">✦</i></h1><p id="arcade-greeting">올라가도 좋고, 달려도 좋아.<br class="arcade-mobile-break"> 마음이 가는 게임을 골라봐!</p></div>
    <div class="arcade-games" aria-label="게임 고르기">
      <a class="arcade-game arcade-stairs" href="/?game=stairs" aria-label="무한계단 게임 시작">
        <div class="arcade-art">${stairsArt}<span class="arcade-art-tag">☁ 다섯 세상 모험</span></div>
        <div class="arcade-game-copy"><div class="arcade-game-meta"><span>차곡차곡, 구름 위로</span><span aria-hidden="true">01</span></div><h2>무한계단</h2><p>처음에는 20계단부터!<br>두 버튼으로 내 속도에 맞춰 올라요.</p><div class="arcade-card-bottom"><span class="arcade-control-hint">↶ 방향 바꾸기 <b>·</b> ↑ 오르기</span><span class="arcade-play">놀러 가기 <b aria-hidden="true">↗</b></span></div></div>
      </a>
      <a class="arcade-game arcade-kart" href="/?game=kart" aria-label="미니 카트 게임 시작">
        <div class="arcade-art">${kartArt}<span class="arcade-art-tag">🏁 1분 드라이브</span><span class="arcade-new">NEW</span></div>
        <div class="arcade-game-copy"><div class="arcade-game-meta"><span>부릉부릉, 별을 따라</span><span aria-hidden="true">02</span></div><h2>미니 카트</h2><p>별 15개면 자석이 준비돼요.<br>세 차선의 별을 모아 결승선까지!</p><div class="arcade-card-bottom"><span class="arcade-control-hint">← 왼쪽 <b>·</b> → 오른쪽</span><span class="arcade-play">달려 보기 <b aria-hidden="true">↗</b></span></div></div>
      </a>
      ${MINI_CARDS.map(renderMiniCard).join('')}
    </div>
    <div class="arcade-bottom-note"><span aria-hidden="true">✦</span><p>천천히 익혀도 괜찮아.<br class="arcade-mobile-break"> 오늘도 내 속도로 신나게 놀아요.</p></div>
  </main>
  <footer class="site-footer arcade-footer"><span>MADE FOR JIHAN, & EVERY LITTLE ADVENTURER.</span><span>즐거움은 작은 도전부터 <i>✦</i></span></footer>
`;

const name = activeProfile()?.name;
if (name) document.querySelector('#arcade-greeting')!.textContent = `${name}, 반가워! 올라가도 좋고, 달려도 좋아. 마음이 가는 게임을 골라봐!`;
