// Tester 3 pond ripples (Fable contract stub, wave T3). Shared so the sim push (Forge), the
// grid wave (Glow) and the sound (Chorus) agree on timing and size. Pure constants, no logic.

/** Seconds between the warning (sim:rippleWarn) and the wave start (sim:ripple). */
export const RIPPLE_WARN_SEC = 1;
/** Speed of the wave front, arena units per second. */
export const POND_WAVE_SPEED = 360;
/** Half width of the wave band, arena units. A body inside the band is pushed. */
export const POND_WAVE_WIDTH = 90;
/** Seconds a wave lives; it fades to nothing at the end. */
export const POND_WAVE_LIFE = 2.6;
