// A formless test tune (the v2.1 Neon Drive bed: A minor, 120 BPM, Am F C G two bars each, the
// hashed arp). Tests of the arp machinery, hooks and fills on tunes without a written form use
// it; every shipped tune has a form since v3.4.
import { DEFAULT_KEY, HARMONIES } from '../../../src/audio/music/harmony';
import { DEFAULT_TUNE, type ChordVoicing, type Tune } from '../../../src/audio/music/tunes';

const v = (name: 'Am' | 'F' | 'C' | 'G', bass: number, pad: number[], arpAnchor: number): ChordVoicing => ({ name, harmony: HARMONIES[name], bass, pad, arpAnchor });

export const PLAIN_TUNE: Tune = {
  ...DEFAULT_TUNE,
  name: 'Plain',
  bpm: 120,
  stepSec: 60 / 120 / 4,
  root: 69,
  key: DEFAULT_KEY,
  loopBars: 8,
  voicings: {
    Am: v('Am', 45, [57, 60, 64], 0),
    F: v('F', 41, [57, 60, 65], 1),
    C: v('C', 48, [55, 60, 64], 3),
    G: v('G', 43, [55, 59, 62], 2),
  },
  drums: { ...DEFAULT_TUNE.drums, kickTurn: [{ step: 13, vel: 0.7 }] },
  bed: { bass: 'triangle', pad: 'sawtooth', arp: 'square', padDetune: 9 },
  form: undefined,
};
