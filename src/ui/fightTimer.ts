// Dev only: guardian fight timer. Times are sim clock seconds (world.time), so paused time never
// counts. Pure: main.ts feeds it bus events with the sim time of each and shows the line.
import { bossName } from './boss';
import type { BossId } from '../levelgen/leveldef';

/** How long the dev fight line stays up as a HUD toast. */
export const FIGHT_TOAST_MS = 6000;

export interface FightTimer {
  id: BossId | null;
  enterAt: number;
  splitAt: number | null;
  breakAt: number | null;
  onAt: number | null;
}

export const FIGHT_TIMER_START: Readonly<FightTimer> = { id: null, enterAt: 0, splitAt: null, breakAt: null, onAt: null };

export type FightEvent =
  | { type: 'enter'; id: BossId; t: number }
  | { type: 'split'; t: number }
  | { type: 'fury'; stage: 'break' | 'on'; t: number };

/** Pure: next timer state for one boss event. A split or fury before any entrance is ignored. */
export function fightStep(s: Readonly<FightTimer>, e: FightEvent): FightTimer {
  if (e.type === 'enter') return { id: e.id, enterAt: e.t, splitAt: null, breakAt: null, onAt: null };
  if (s.id === null) return { ...s };
  if (e.type === 'split') return { ...s, splitAt: s.splitAt ?? e.t };
  if (e.stage === 'break') return { ...s, breakAt: s.breakAt ?? e.t };
  return { ...s, onAt: s.onAt ?? e.t };
}

/** Pure: seconds as m:ss, rounded down. Negative or non finite reads 0:00. */
export function fightClock(sec: number): string {
  const n = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

/** Pure: "Brood 1:52 (body 0:58, Broodlings 0:54)" or "Warden 1:05 (to break 0:31, break 0:05, enraged 0:29)". '' with no fight. */
export function fightLine(s: Readonly<FightTimer>, downAt: number): string {
  if (s.id === null) return '';
  const name = bossName(s.id);
  const total = `${name} ${fightClock(downAt - s.enterAt)}`;
  const parts: string[] = [];
  if (s.splitAt !== null) {
    parts.push(`body ${fightClock(s.splitAt - s.enterAt)}`, `Broodlings ${fightClock(downAt - s.splitAt)}`);
  } else if (s.breakAt !== null) {
    parts.push(`to break ${fightClock(s.breakAt - s.enterAt)}`);
    if (s.onAt !== null) {
      parts.push(`break ${fightClock(s.onAt - s.breakAt)}`, `enraged ${fightClock(downAt - s.onAt)}`);
    } else {
      parts.push(`break ${fightClock(downAt - s.breakAt)}`);
    }
  }
  return parts.length > 0 ? `${total} (${parts.join(', ')})` : total;
}
