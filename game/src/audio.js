// audio.js — all sound in "The Gilded Vault" is synthesised live with the
// Web Audio API: no audio files are shipped, so the game stays fully offline.
let ctx = null;
let alarmNodes = null;
let muted = false;

export function setMuted(value) {
  muted = value;
  if (muted) stopAllSound();
}

export function isMuted() {
  return muted;
}

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    ctx = null;
  }
}

function tone(freq, dur, type = 'sine', vol = 0.12, when = 0, slideTo = null) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export function playPickup() {
  tone(880, 0.09, 'sine', 0.1);
  tone(1318, 0.12, 'sine', 0.08, 0.07);
}

export function playGem() {
  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'sine', 0.1, i * 0.09));
}

export function playDoor() {
  tone(220, 0.25, 'triangle', 0.1, 0, 440);
}

export function playCaught() {
  tone(196, 0.7, 'sawtooth', 0.12, 0, 98);
  tone(147, 0.9, 'sawtooth', 0.1, 0.15, 73);
}

export function playWin() {
  [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', 0.11, i * 0.11));
}

export function playStep() {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const buffer = ctx.createBuffer(1, 220, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = 0.05;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t0);
}

// A soft two-tone siren while the alarm is high; start/stop it with the
// alarm level so it never drones on the title screen.
export function setAlarmSound(level) {
  if (!ctx) return;
  if (level > 55 && !alarmNodes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 660;
    lfo.type = 'sine';
    lfo.frequency.value = 1.6;
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(osc.frequency);
    gain.gain.value = 0.035;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    lfo.start();
    alarmNodes = { osc, gain, lfo };
  } else if (level <= 45 && alarmNodes) {
    const { osc, lfo, gain } = alarmNodes;
    gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    osc.stop(ctx.currentTime + 0.4);
    lfo.stop(ctx.currentTime + 0.4);
    alarmNodes = null;
  }
}

export function stopAllSound() {
  if (alarmNodes && ctx) {
    try {
      alarmNodes.osc.stop();
      alarmNodes.lfo.stop();
    } catch { /* already stopped */ }
    alarmNodes = null;
  }
}
