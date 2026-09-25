// Background music: a quiet felt-piano arrangement of "The Internationale"
// (melody by Pierre De Geyter, 1888; lyrics by Eugène Pottier, 1871 — both
// long in the public domain). The arrangement, synthesis and levels below are
// original to this project; the source transcription comes from the Digital
// Tradition ABC collection (INTERNAT) and is reproduced in the melody table.
// node scripts/render-audio.mjs [path/to/ffmpeg]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const rate = 48000,
  bpm = 72,
  beat = 60 / bpm,
  duration = 128 * beat; // 32 bars of 4/4: verse (16) + chorus (16)
const length = Math.round(rate * duration),
  tau = Math.PI * 2;
const folder = "public/audio";
fs.mkdirSync(folder, { recursive: true });
fs.mkdirSync(".tools/audio-render", { recursive: true });
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
let seed = 93271;
const random = () =>
  ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const stems = Object.fromEntries(
  ["atmosphere", "motif", "pulse"].map((k) => [
    k,
    [new Float32Array(length), new Float32Array(length)],
  ]),
);
function add(stem, start, seconds, pan, synth) {
  const out = stems[stem],
    offset = Math.round(start * rate);
  const l = Math.cos(((pan + 1) * Math.PI) / 4),
    r = Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < Math.round(seconds * rate); i++) {
    const sample = synth(i / rate, i / (seconds * rate));
    const index = (((offset + i) % length) + length) % length;
    out[0][index] += sample * l;
    out[1][index] += sample * r;
  }
}
// Soft felt piano: ~14 ms hammer attack, slightly stretched partials that die
// away quickly in the top, exponential decay and a whisper of hammer noise.
// `bright` trims the upper partials for the low register.
function piano(f, velocity, decay, bright = 1) {
  return (t, p) => {
    const attack = 1 - Math.exp(-t * 72);
    const end = Math.min(1, (1 - p) * 9);
    const body =
      Math.sin(tau * f * t) +
      0.4 * Math.exp(-t * 1.5) * Math.sin(tau * f * 2 * t + 0.4) +
      0.17 * Math.exp(-t * 2.4) * Math.sin(tau * f * 3.008 * t + 1.1) +
      0.075 * bright * Math.exp(-t * 3.6) * Math.sin(tau * f * 4.02 * t) +
      0.03 * bright * Math.exp(-t * 5.5) * Math.sin(tau * f * 5.04 * t);
    const hammer = 0.018 * bright * Math.exp(-t * 130) * random();
    return velocity * attack * end * Math.exp(-t * decay) * (body + hammer);
  };
}
// Bar-by-bar harmony under the melody, in G major. Bar 23 colours the chorus
// repeat with its secondary dominant.
const harmony = [
  "G", "C", "D7", "G", "G", "C", "D7", "G",
  "D", "Bm", "C", "G", "D", "Em", "D", "D7",
  "G", "C", "D", "Em", "G", "D", "E", "Am",
  "G", "C", "D", "Em", "C", "Am", "D", "G",
];
const voicing = {
  G: [55, 59, 62, 67],
  C: [55, 60, 64, 67],
  D7: [54, 57, 60, 62],
  D: [54, 57, 62, 66],
  Bm: [54, 59, 62, 66],
  Em: [55, 59, 64, 67],
  Am: [57, 60, 64, 69],
  E: [56, 59, 64, 68],
};
const root = { G: 43, C: 48, D7: 50, D: 50, Bm: 47, Em: 40, Am: 45, E: 40 };
// atmosphere — quiet sustained chord tones, one felt-piano roll per bar, voices
// overlapping through their release so the harmony never switches off.
harmony.forEach((chord, bar) => {
  voicing[chord].forEach((note, voice) => {
    add(
      "atmosphere",
      bar * 4 * beat + voice * 0.022,
      6.5,
      (voice - 1.5) * 0.3,
      piano(hz(note), 0.027, 0.6),
    );
  });
});
// pulse — sparse low roots only, twice per two-bar group; no ticks, no noise.
for (let group = 0; group < 16; group++) {
  add(
    "pulse",
    group * 8 * beat,
    4.5,
    0,
    piano(hz(root[harmony[group * 2]]), 0.05, 0.8, 0.5),
  );
  add(
    "pulse",
    (group * 8 + 4.5) * beat,
    3.5,
    0,
    piano(hz(root[harmony[group * 2 + 1]]), 0.03, 0.8, 0.5),
  );
}
// motif — the melody of L'Internationale, transcribed note for note.
// [start beat, midi, length in beats]; the verse pickup sits at the very end
// of the loop and wraps through the ring buffer into bar 1.
const melody = [
  [127.5, 62, 0.5],
  [0, 67, 1.5], [1.5, 66, 0.5], [2, 69, 0.5], [2.5, 67, 0.5], [3, 62, 0.5], [3.5, 59, 0.5],
  [4, 64, 2], [6, 60, 1.5], [7.5, 64, 0.5],
  [8, 69, 1.5], [9.5, 67, 0.5], [10, 66, 0.5], [10.5, 64, 0.5], [11, 62, 0.5], [11.5, 60, 0.5],
  [12, 59, 2], [15, 62, 1],
  [16, 67, 1.5], [17.5, 66, 0.5], [18, 69, 0.5], [18.5, 67, 0.5], [19, 62, 0.5], [19.5, 59, 0.5],
  [20, 64, 2], [22, 60, 1], [23, 69, 0.5], [23.5, 67, 0.5],
  [24, 66, 1], [25, 69, 1], [26, 72, 1], [27, 66, 1],
  [28, 67, 2], [31, 71, 0.5], [31.5, 69, 0.5],
  [32, 66, 2], [34, 64, 0.5], [34.5, 66, 0.5], [35, 67, 0.5], [35.5, 64, 0.5],
  [36, 66, 2], [38, 62, 1], [39, 61, 0.5], [39.5, 62, 0.5],
  [40, 64, 1.5], [41.5, 57, 0.5], [42, 69, 1.5], [43.5, 67, 0.5],
  [44, 66, 2], [47.5, 69, 0.5],
  [48, 69, 1.5], [49.5, 66, 0.5], [50, 62, 0.5], [50.5, 62, 0.5], [51, 61, 0.5], [51.5, 62, 0.5],
  [52, 71, 2], [54, 67, 0.5], [54.5, 67, 0.5], [55, 66, 0.5], [55.5, 64, 0.5],
  [56, 66, 1], [57, 69, 1], [58, 67, 1], [59, 64, 1],
  [60, 62, 1], [63, 71, 0.5], [63.5, 69, 0.5],
  [64, 67, 2], [66, 62, 1.5], [67.5, 59, 0.5],
  [68, 64, 2], [70, 60, 1], [71, 69, 0.5], [71.5, 67, 0.5],
  [72, 66, 2], [74, 64, 1.5], [75.5, 62, 0.5],
  [76, 71, 2], [79, 71, 1],
  [80, 71, 2], [82, 69, 1.5], [83.5, 62, 0.5],
  [84, 67, 2], [86, 66, 2],
  [88, 64, 1.5], [89.5, 63, 0.5], [90, 64, 1], [91, 69, 1],
  [92, 69, 2], [95, 71, 0.5], [95.5, 69, 0.5],
  [96, 67, 2], [98, 62, 1.5], [99.5, 59, 0.5],
  [100, 64, 2], [102, 60, 1], [103, 69, 0.5], [103.5, 67, 0.5],
  [104, 66, 2], [106, 64, 1.5], [107.5, 62, 0.5],
  [108, 71, 2], [111, 71, 1],
  [112, 74, 2], [114, 72, 1], [115, 71, 1],
  [116, 69, 0.5], [116.5, 68, 0.5], [117, 69, 0.5], [117.5, 71, 0.5], [118, 72, 1], [119.5, 72, 0.5],
  [120, 71, 1.5], [121.5, 67, 0.5], [122, 69, 1.5], [123.5, 66, 0.5],
  [124, 67, 2],
];
melody.forEach(([start, note, durBeats], i) => {
  const chorus = start >= 64 && start < 127;
  const climax = start >= 112 && start < 127;
  const velocity =
    (chorus ? 0.063 : 0.055) +
    (climax ? 0.004 : 0) +
    (start % 4 === 0 ? 0.0035 : 0);
  add(
    "motif",
    start * beat,
    durBeats * beat + 3.2,
    i % 2 ? 0.05 : -0.05,
    piano(hz(note), velocity, 1.3),
  );
});
// Circular, decorrelated early reflections keep the loop continuous.
for (const [name, channels] of Object.entries(stems)) {
  const original = channels.map((c) => c.slice());
  for (const [seconds, gain] of [
    [0.071, 0.17],
    [0.113, 0.13],
    [0.193, 0.09],
    [0.307, 0.065],
    [0.487, 0.04],
  ]) {
    const delay = Math.round(seconds * rate);
    for (let c = 0; c < 2; c++)
      for (let i = 0; i < length; i++)
        channels[c][(i + delay) % length] += original[1 - c][i] * gain;
  }
}
function wav(channels, file) {
  const data = Buffer.alloc(44 + length * 4);
  data.write("RIFF");
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(2, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 4, 28);
  data.writeUInt16LE(4, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(length * 4, 40);
  for (let i = 0; i < length; i++)
    for (let c = 0; c < 2; c++)
      data.writeInt16LE(
        Math.round(Math.max(-1, Math.min(1, channels[c][i])) * 32767),
        44 + i * 4 + c * 2,
      );
  fs.writeFileSync(file, data);
}
const mix = [new Float32Array(length), new Float32Array(length)];
const metrics = {};
for (const [name, channels] of Object.entries(stems)) {
  for (const channel of channels)
    for (let i = 0; i < length; i++) channel[i] *= 2.2;
  let peak = 0,
    square = 0;
  for (let c = 0; c < 2; c++)
    for (let i = 0; i < length; i++) {
      const x = channels[c][i];
      peak = Math.max(peak, Math.abs(x));
      square += x * x;
      mix[c][i] += x;
    }
  metrics[name] = {
    peakDb: 20 * Math.log10(peak),
    rmsDb: 10 * Math.log10(square / (length * 2)),
    seamDelta: Math.max(...channels.map((c) => Math.abs(c[0] - c[length - 1]))),
  };
  const file = path.join(".tools/audio-render", name + ".wav");
  wav(channels, file);
  if (process.argv[2])
    execFileSync(process.argv[2], [
      "-y",
      "-v",
      "error",
      "-i",
      file,
      "-c:a",
      "libvorbis",
      "-q:a",
      "5",
      path.join(folder, name + ".ogg"),
    ]);
}
wav(mix, ".tools/audio-render/internationale.wav");
if (process.argv[2])
  execFileSync(process.argv[2], [
    "-y",
    "-v",
    "error",
    "-i",
    ".tools/audio-render/internationale.wav",
    "-af",
    `afade=t=in:d=1,afade=t=out:st=${(duration - 2.5).toFixed(6)}:d=2.5`,
    "-c:a",
    "libmp3lame",
    "-b:a",
    "192k",
    path.join(folder, "internationale-preview.mp3"),
  ]);
fs.writeFileSync(
  path.join(folder, "score.json"),
  JSON.stringify(
    {
      title: "Internationale (Quiet Piano) / 国际歌 · 安静钢琴版",
      bpm,
      duration,
      rate,
      seed: 93271,
      metrics,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ duration, metrics }, null, 2));
