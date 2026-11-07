// Tester 3 pond ripples (Fable contract stub, wave T3; T4: a ripple now starts only when a super
// nova Gravity well is destroyed, no warning). Shared so the sim push (Forge), the
// grid wave (Glow) and the sound (Chorus) agree on timing and size. Pure constants, no logic.

/** Deprecated in T4 (no warning any more); removed once no module reads it. */
export const RIPPLE_WARN_SEC = 1;
/** Speed of the wave front, arena units per second. */
export const POND_WAVE_SPEED = 360;
/** Half width of the wave band, arena units. A body inside the band is pushed. */
export const POND_WAVE_WIDTH = 160;
/** Seconds a wave lives; it fades to nothing at the end. */
export const POND_WAVE_LIFE = 3.2;
