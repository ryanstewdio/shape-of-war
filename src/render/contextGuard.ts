// Context guard (glow-fury-orbs, Ryan's device crash 2026-11-13). Pure, no pixi import.
// GraphicsContext.destroy() nulls context.instructions, and pixi then reads instructions.length in
// buildContextBatches whenever a Graphics still holding that context is rendered or rebuilt (the
// destroy itself emits 'unload' to every holder, hidden or not). The renderer retires contexts in
// many places (the neon shapes hook, the damaged and fury boss bodies, the Broodling looks) but only
// the views drawn that frame pick up a new one; pooled hidden views, the boss body, the Mirage echo
// and afterimage and the Tempest dash ghosts can keep a retired context. So before any retired
// context is destroyed, every holder still on one moves onto a fallback (a shared empty context),
// and its owner forgets the slot so the next draw assigns a live context. One rule for every path.

/** Anything carrying a context, a pixi Graphics in the renderer, a plain object in tests. */
export interface ContextHolder<C> {
  context: C;
}

/**
 * Pure on the holders: every holder whose context is in retired moves onto fallback, and onMoved
 * (when given) hears its index so the owner can reset its cached slot. Null and undefined holders
 * are skipped. Returns how many holders moved. No allocation; runs only on frames that retire.
 */
export function releaseRetired<C>(
  holders: readonly (ContextHolder<C> | null | undefined)[],
  retired: readonly C[],
  fallback: C,
  onMoved?: (index: number) => void,
): number {
  if (retired.length === 0) return 0;
  let moved = 0;
  for (let i = 0; i < holders.length; i++) {
    const h = holders[i];
    if (h === null || h === undefined) continue;
    if (h.context === fallback || !retired.includes(h.context)) continue;
    h.context = fallback;
    moved++;
    if (onMoved) onMoved(i);
  }
  return moved;
}

/** Pure: true when no holder still carries a retired context (tests and the dev check). */
export function noRetiredHeld<C>(holders: readonly (ContextHolder<C> | null | undefined)[], retired: readonly C[]): boolean {
  for (const h of holders) if (h !== null && h !== undefined && retired.includes(h.context)) return false;
  return true;
}
