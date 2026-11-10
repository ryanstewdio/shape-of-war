// Scene player state machine (docs/19 "Panel spec for the builder"). Pure: the DOM player feeds it
// frame time and taps, emits the 'ui:story' events it returns and marks a scene seen on its 'end'.
// One panel at a time. Text types out at about 40 characters per second; a tap while typing
// completes the panel, the next tap advances. A panel with the picker flag opens the call sign
// picker once its text is out, and only the picker's Done moves on. Skip ends the whole scene.
import type { Events } from '../../core/events';
import { fillCallsign, sceneById, type Panel, type Scene } from '../../story/scenes';

export type StoryEvent = Events['ui:story'];

/** Typewriter speed, characters per second. */
export const TYPE_CPS = 40;

export interface StoryRun {
  /** Trigger ids to play, in order. */
  readonly ids: readonly string[];
  /** Index into ids of the scene on screen; ids.length once every scene has ended. */
  readonly scene: number;
  readonly panel: number;
  /** Characters of the panel text typed so far. */
  readonly typed: number;
  /** Seconds since the panel was shown (drives reveals and tweens). */
  readonly age: number;
  /** The call sign picker is open. */
  readonly picking: boolean;
}

export interface Step {
  readonly run: StoryRun;
  readonly events: StoryEvent[];
}

/** Pure: the scene on screen, or undefined once the run is over. */
export function currentScene(r: StoryRun): Scene | undefined {
  const id = r.ids[r.scene];
  return id === undefined ? undefined : sceneById(id);
}

export function currentPanel(r: StoryRun): Panel | undefined {
  return currentScene(r)?.panels[r.panel];
}

export function runOver(r: StoryRun): boolean {
  return currentScene(r) === undefined;
}

/** Pure: the panel's lines with the call sign put in. */
export function panelLines(p: Panel, callsign: string): string[] {
  return p.lines.map((l) => fillCallsign(l.text, callsign));
}

/** Pure: characters to type for a panel (lines joined, no separator). */
export function panelChars(p: Panel, callsign: string): number {
  return panelLines(p, callsign).reduce((s, l) => s + l.length, 0);
}

function ev(s: Scene, panel: number, phase: StoryEvent['phase']): StoryEvent {
  return { id: s.id, type: s.type, panel, phase };
}

/** Pure: open scene `index` (skipping unknown ids), emitting its start and first panel. */
function openScene(ids: readonly string[], index: number): Step {
  let i = index;
  while (i < ids.length && sceneById(ids[i] ?? '') === undefined) i++;
  const run: StoryRun = { ids, scene: i, panel: 0, typed: 0, age: 0, picking: false };
  const s = currentScene(run);
  return { run, events: s === undefined ? [] : [ev(s, 0, 'start'), ev(s, 0, 'panel')] };
}

/** Pure: start a run of scenes. */
export function startRun(ids: readonly string[]): Step {
  return openScene([...ids], 0);
}

/** Pure: end the current scene and open the next. */
function endScene(r: StoryRun): Step {
  const s = currentScene(r);
  if (s === undefined) return { run: r, events: [] };
  const next = openScene(r.ids, r.scene + 1);
  return { run: next.run, events: [ev(s, r.panel, 'end'), ...next.events] };
}

function typedOut(r: StoryRun, p: Panel, callsign: string): StoryRun {
  const full = panelChars(p, callsign);
  return { ...r, typed: full, picking: p.picker === true };
}

/** Pure: advance time. Typing runs at TYPE_CPS; the picker opens when a picker panel is typed out. */
export function tickRun(r: StoryRun, dt: number, callsign: string): StoryRun {
  const p = currentPanel(r);
  if (p === undefined) return r;
  const d = Math.max(0, dt);
  const full = panelChars(p, callsign);
  const typed = Math.min(full, r.typed + d * TYPE_CPS);
  const next = { ...r, typed, age: r.age + d };
  return typed >= full && p.picker === true && !r.picking && r.typed < full ? { ...next, picking: true } : next;
}

/** Pure: a tap on the scene. Completes the typing, else moves to the next panel or scene. */
export function tapRun(r: StoryRun, callsign: string): Step {
  const s = currentScene(r);
  const p = currentPanel(r);
  if (s === undefined || p === undefined) return { run: r, events: [] };
  if (r.picking) return { run: r, events: [] }; // only the picker's Done leaves a picker panel
  if (r.typed < panelChars(p, callsign)) return { run: typedOut(r, p, callsign), events: [] };
  return nextPanel(r);
}

function nextPanel(r: StoryRun): Step {
  const s = currentScene(r);
  if (s === undefined) return { run: r, events: [] };
  const panel = r.panel + 1;
  if (panel >= s.panels.length) return endScene(r);
  return { run: { ...r, panel, typed: 0, age: 0, picking: false }, events: [ev(s, panel, 'panel')] };
}

/** Pure: the picker's Done. Closes the picker and moves to the next panel. */
export function pickedRun(r: StoryRun): Step {
  if (!r.picking) return { run: r, events: [] };
  return nextPanel({ ...r, picking: false });
}

/** Pure: Skip ends the whole scene on screen in one tap (the next queued scene, if any, opens). */
export function skipRun(r: StoryRun): Step {
  return endScene(r);
}
