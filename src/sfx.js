const SFX = {
  cardSlide: 'assets/sfx/card_draw_3.wav',
};

const audioPool = {};
const POOL_SIZE = 6;
let sfxVolume = 0.5;

function initPool(key, src) {
  audioPool[key] = Array.from({ length: POOL_SIZE }, () => {
    const a = new Audio(src);
    a.preload = 'auto';
    return a;
  });
  audioPool[key]._index = 0;
}

for (const [key, src] of Object.entries(SFX)) {
  initPool(key, src);
}

export function setSfxVolume(v) {
  sfxVolume = Math.max(0, Math.min(1, v));
}

export function getSfxVolume() {
  return sfxVolume;
}

export function playCardSlide() {
  const pool = audioPool.cardSlide;
  const audio = pool[pool._index % POOL_SIZE];
  pool._index++;
  audio.volume = sfxVolume;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}
