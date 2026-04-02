const SFX = {
  cardSlide: 'assets/sfx/card_draw_3.wav',
};

const audioPool = {};
const POOL_SIZE = 6;
let sfxVolume = 0.5;
let sfxMuted = false;

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = AudioContext ? new AudioContext() : null;
const sfxBuffers = {};
let sfxUnlocked = false;

function initPool(key, src) {
  audioPool[key] = Array.from({ length: POOL_SIZE }, () => {
    const a = new Audio(src);
    a.preload = 'auto';
    return a;
  });
  audioPool[key]._index = 0;
}

async function loadSfxBuffer(key, src) {
  if (!audioContext) return;
  try {
    const resp = await fetch(src);
    const arrayBuffer = await resp.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(arrayBuffer);
    sfxBuffers[key] = decoded;
  } catch (err) {
    // Keep fallback path in case WebAudio path fails.
    console.warn('SFX buffer load failed for', key, err);
  }
}

function unlockSfx() {
  if (!audioContext || sfxUnlocked) return;
  audioContext.resume().finally(() => {
    sfxUnlocked = true;
    for (const [key, src] of Object.entries(SFX)) {
      if (!sfxBuffers[key]) loadSfxBuffer(key, src);
    }
  });
}

// Ensure we try to unlock audio on first user interaction (required on iOS/Android)
['touchstart', 'mousedown', 'keydown', 'click'].forEach(evt => {
  document.addEventListener(evt, unlockSfx, { once: true, passive: true });
});

for (const [key, src] of Object.entries(SFX)) {
  initPool(key, src);
  loadSfxBuffer(key, src);
}

function playWebAudio(key) {
  if (!audioContext || !sfxUnlocked) return false;
  const buffer = sfxBuffers[key];
  if (!buffer) return false;

  const source = audioContext.createBufferSource();
  source.buffer = buffer;

  const gain = audioContext.createGain();
  gain.gain.value = sfxVolume;

  source.connect(gain).connect(audioContext.destination);
  source.start(0);

  source.onended = () => {
    source.disconnect();
    gain.disconnect();
  };

  return true;
}

export function setSfxVolume(v) {
  sfxVolume = Math.max(0, Math.min(1, v));
}

export function getSfxVolume() {
  return sfxVolume;
}

export function setSfxMuted(m) {
  sfxMuted = m;
}

export function isSfxMuted() {
  return sfxMuted;
}

export function playCardSlide() {
  if (sfxMuted) return;
  // Prefer low-latency WebAudio path and fall back to HTMLAudio pool.
  if (playWebAudio('cardSlide')) return;

  const pool = audioPool.cardSlide;
  const audio = pool[pool._index % POOL_SIZE];
  pool._index++;
  audio.volume = sfxVolume;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}
