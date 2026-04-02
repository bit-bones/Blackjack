// ---------------------------------------------------------------------------
// Music – looping jukebox with crossfade, shuffle, and per-track enable
// ---------------------------------------------------------------------------

const FADE_DURATION = 2; // seconds for fade-in / fade-out

const TRACK_LIST = [
  { artist: '21 On The Block', title: 'Funky Diesel', src: 'assets/music/21 On The Block/funky-diesel-21-on-the-block-main-version-44571-01-40.mp3', gain: 0.4 },
  { artist: 'Stan Town', title: 'Groove Sauce', src: 'assets/music/Stan Town/groove-sauce-stan-town-main-version-40277-01-56.mp3', gain: 0.3 },
  { artist: '21 On The Block', title: 'Sizzle Groove', src: 'assets/music/21 On The Block/sizzle-groove-21-on-the-block-main-version-45626-01-42.mp3', gain: 0.4 },
  { artist: 'Joth',     title: 'Funked Up',   src: 'assets/music/Joth/Funked Up.mp3', gain: 0.3 },
  { artist: 'omfgdude', title: 'CVP701Jam',   src: 'assets/music/omfgdude/CVP701Jam.ogg', gain: 0.8 },
];

// Runtime state
let tracks      = TRACK_LIST.map((t, i) => ({ ...t, enabled: true, id: i }));
let queue        = [];          // indices into `tracks`
let currentIndex = -1;          // index inside `queue`
let currentAudio = null;
let currentGain  = 1;           // gain of currently playing track
let nextAudio    = null;
let volume       = 0.5;
let shuffle      = false;
let playing      = false;
let fadeTimer    = null;
let muted        = false;
let paused       = false;
let volumeBeforeMute = 0.5;
let _onTrackChange = null;

// --- helpers ---------------------------------------------------------------

function enabledTracks() {
  return tracks.filter(t => t.enabled);
}

function buildQueue() {
  const enabled = enabledTracks();
  queue = enabled.map((_, i) => i);
  if (shuffle) {
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
  }
}

function makeAudio(track) {
  const a = new Audio(track.src);
  a.volume = 0;
  a.preload = 'auto';
  return a;
}

function effectiveVolume() {
  return volume * currentGain;
}

function fadeIn(audio, dur = FADE_DURATION) {
  audio.volume = 0;
  const step = 0.02;
  let id = null;

  const tick = () => {
    const target = effectiveVolume();
    // Maintain the fade progress toward the current target in real time.
    const next = Math.min(audio.volume + step * target, target);
    audio.volume = next;
    if (next >= target || target <= 0) {
      clearInterval(id);
      audio._fadeInId = null;
    }
  };

  const interval = () => {
    const target = Math.max(effectiveVolume(), 0.01);
    return (dur * 1000 * step) / target;
  };

  id = setInterval(tick, interval());
  audio._fadeInId = id;
  return id;
}

function fadeOut(audio, dur = FADE_DURATION) {
  return new Promise(resolve => {
    if (!audio || audio.paused) { resolve(); return; }
    const startVol = audio.volume;
    const step = 0.02;
    const interval = (dur * 1000 * step) / Math.max(startVol, 0.01);
    const id = setInterval(() => {
      const next = Math.max(audio.volume - step * startVol, 0);
      audio.volume = next;
      if (next <= 0) {
        clearInterval(id);
        audio.pause();
        resolve();
      }
    }, interval);
  });
}

// --- playback --------------------------------------------------------------

/** Immediately stop and discard the current audio element */
function killCurrent() {
  if (currentAudio) {
    if (currentAudio._fadeInId) {
      clearInterval(currentAudio._fadeInId);
      currentAudio._fadeInId = null;
    }
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
  nextAudio = null;
}

function playTrack(queueIdx) {
  const enabled = enabledTracks();
  if (enabled.length === 0) { stop(); return; }

  currentIndex = ((queueIdx % queue.length) + queue.length) % queue.length;
  const track = enabled[queue[currentIndex]];
  if (!track) { stop(); return; }

  // Kill any existing audio immediately — no overlap
  killCurrent();

  currentGain = track.gain ?? 1;
  currentAudio = makeAudio(track);
  const thisAudio = currentAudio; // capture for closure guard
  currentAudio.play().catch(() => {});
  fadeIn(currentAudio);

  if (_onTrackChange) _onTrackChange(track);

  thisAudio.addEventListener('timeupdate', () => {
    // Guard: only act if this is still the active audio
    if (currentAudio !== thisAudio) return;
    const remaining = thisAudio.duration - thisAudio.currentTime;
    if (remaining <= FADE_DURATION && remaining > 0 && !nextAudio) {
      nextAudio = true;
      advance();
    }
  });
}

function advance() {
  if (enabledTracks().length === 0) return;

  let nextIdx = currentIndex + 1;
  if (nextIdx >= queue.length) {
    buildQueue(); // rebuild (re-shuffle if enabled)
    nextIdx = 0;
  }
  playTrack(nextIdx);
  nextAudio = null; // reset flag for the new track
}

// --- public API ------------------------------------------------------------

export function getTracks() {
  return tracks;
}

export function setTrackEnabled(id, enabled) {
  const t = tracks.find(t => t.id === id);
  if (t) t.enabled = enabled;
  // If current track was disabled, skip to next
  if (playing && !enabled) {
    const current = enabledTracks()[queue[currentIndex]];
    if (!current || current.id === id) {
      buildQueue();
      if (enabledTracks().length > 0) playTrack(0);
      else stop();
    }
  }
}

export function setMusicVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (currentAudio) {
    if (!currentAudio.paused) {
      currentAudio.volume = effectiveVolume();
    }
    if (currentAudio._fadeInId) {
      clearInterval(currentAudio._fadeInId);
      currentAudio._fadeInId = null;
      // Re-start quick fade to the new target for smoother transition.
      currentAudio._fadeInId = fadeIn(currentAudio, 0.2);
    }
  }
}

export function getMusicVolume() {
  return volume;
}

export function setShuffle(on) {
  shuffle = on;
  if (playing) {
    buildQueue();
  }
}

export function getShuffle() {
  return shuffle;
}

export function start() {
  if (playing) return;
  playing = true;
  buildQueue();
  if (queue.length > 0) playTrack(0);
}

export function stop() {
  playing = false;
  killCurrent();
}

export function isPlaying() {
  return playing;
}

export function skip() {
  if (!playing) return;
  advance();
}

export function toggleMute() {
  if (muted) {
    muted = false;
    volume = volumeBeforeMute;
    if (currentAudio && !currentAudio.paused) {
      currentAudio.volume = effectiveVolume();
    }
  } else {
    muted = true;
    volumeBeforeMute = volume;
    volume = 0;
    if (currentAudio) currentAudio.volume = 0;
  }
  return muted;
}

export function isMuted() {
  return muted;
}

export function togglePause() {
  if (!playing || !currentAudio) return false;
  if (!currentAudio.paused) {
    currentAudio.pause();
    return true; // now paused
  } else {
    currentAudio.play().catch(() => {});
    return false; // now playing
  }
}

export function isPaused() {
  return playing && currentAudio != null && currentAudio.paused;
}

export function getCurrentTrack() {
  const enabled = enabledTracks();
  if (!playing || enabled.length === 0 || currentIndex < 0) return null;
  return enabled[queue[currentIndex]] || null;
}

export function onTrackChange(cb) {
  _onTrackChange = cb;
}

// Try to auto-start on first user interaction (browser autoplay policy)
let _started = false;
function tryAutoStart() {
  if (_started) return;
  _started = true;
  start();
  document.removeEventListener('click', tryAutoStart);
  document.removeEventListener('keydown', tryAutoStart);
}
document.addEventListener('click', tryAutoStart, { once: false });
document.addEventListener('keydown', tryAutoStart, { once: false });
