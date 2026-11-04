// R5 (Ryan, build 64a20eb): "intro and results screens still have minor clustering and developer
// information, but if dev info is needed for testing keep it". The developer and secondary values
// (seed, level code, build, kills, time, multiplier, geoms, loadout) move into a collapsed Details
// row at the bottom of a card: a touch toggle over a list of labelled rows, closed by default and
// closed again whenever the card is filled. Every row is "Label value", never a bare value.
// R6 (Ryan, gate R5): the toggle is a big button like Next and Menu (sow-big: size, border, glow);
// open or closed shows only in its "+" or "-" suffix and aria-expanded, never as a selected look.
import { button, el } from './dom';
import type { LabelledValue } from './intro';

export const DETAILS_LABEL = 'Details';

/** Pure: "Label value" (R5 wording: "Seed 42", "Kills 412", "Time 3:31"). */
export function inline(v: LabelledValue): string {
  return `${v.label} ${v.value}`;
}

/** Pure: only the items with a label and a value, in order. */
export function shownItems(items: readonly (LabelledValue | null)[]): LabelledValue[] {
  return items.filter((v): v is LabelledValue => v !== null && v.label !== '' && v.value !== '');
}

/** One labelled row: the label dimmed, then the value. */
export function kvRow(v: LabelledValue, cls = 'sow-kv'): HTMLDivElement {
  const row = el('div', cls);
  row.append(el('span', 'sow-k', v.label), el('span', 'sow-v', v.value));
  return row;
}

export interface DetailsRow {
  readonly root: HTMLDivElement;
  /** Replace the rows and close the row. Hides the whole row when there is nothing to show. */
  fill(items: readonly LabelledValue[]): void;
  isOpen(): boolean;
  setOpen(open: boolean): void;
}

/** The collapsed Details row. `attr` names the data attribute the screen's tests read. */
export function createDetails(attr: string): DetailsRow {
  const root = el('div', 'sow-details');
  root.setAttribute(attr, 'details');
  const body = el('div', 'sow-details-body');
  body.setAttribute(attr, 'detailsBody');
  let open = false;
  const toggle = button(DETAILS_LABEL, () => setOpen(!open));
  toggle.classList.add('sow-big', 'sow-details-toggle');
  toggle.setAttribute(attr, 'detailsToggle');
  function setOpen(v: boolean): void {
    open = v;
    body.style.display = open ? '' : 'none';
    toggle.setAttribute('aria-expanded', String(open));
  }
  root.append(toggle, body);
  setOpen(false);
  return {
    root,
    fill(items) {
      body.replaceChildren(...items.map((v) => kvRow(v)));
      root.style.display = items.length > 0 ? '' : 'none';
      setOpen(false);
    },
    isOpen: () => open,
    setOpen,
  };
}
