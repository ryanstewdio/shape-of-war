// Boss numbers (docs/12 wave V3-A, docs/13 SPEC 3.4). Every tunable lives here so a tuning pass is
// a one file edit (shared rule 5). Hit points are in spread hits; the sim stores tenths of a hit in
// w.hp (Int16Array), so 360 hits is 3600. Starting values, tuned at G3A (D5).
import type { BossId, BossTier } from '../../levelgen/leveldef';
import type { PaletteKey } from '../../render/neon';

const DEG = Math.PI / 180;

export interface BossRow {
  tier: BossTier;
  /** Hit points in spread hits (Ryan, Q4). */
  hp: number;
  phases: number;
  /** Body radius in u (44 to 90). */
  radius: number;
  /** Tier colour key (render and fx payloads). */
  colour: PaletteKey;
}

/**
 * All ten rows of the docs/13 roster. Release polish (item 7): hit points raised so each fight at
 * Normal on its own level lasts 210 to 260 s on the bossFightLength script (about 235 s; damage
 * windows unchanged). Before: warden 520, brood 400, spindle 500, ember 600, mirage 640, gravitas
 * 700, bastion 1242, tempest 1138.5, twins 1000, prism 1000. Rows past the Int16 store (BOSS_HP_MAX
 * tenths) keep the bar at the cap and turn the rest into armour (armourFor). R1 (Ryan: a skilled
 * Warden fight took about 150 s against the 3.5 minute target): every row 40 percent higher, damage
 * windows and patterns unchanged. Before R1: warden 1840, brood 2900, spindle 4227, ember 2289,
 * mirage 4237, gravitas 5430, bastion 3730, tempest 3586, twins 4227, prism 1314.
 * Boss health (Ryan 2026-11-11: Brood took almost 5 minutes): each fight at Normal on its Adventure
 * level lasts about 60 to 75 s at tier 1 (Brood, Warden, Spindle), 90 s at tier 2, 2 min at tier 3
 * and 2.5 min for Prism on the fight bot (tests/game/bossFightBot.ts). Before: warden 2576, brood
 * 4060, spindle 5918, ember 3205, mirage 5932, gravitas 7602, bastion 5222, tempest 5020, twins
 * 5918, prism 1840 (every fight 315 to 345 s on the bot). Brood's row is its body only; its
 * Broodlings add BROODLING.hp each.
 * Warden fury, Brood first cut (Ryan 2026-11-11): Brood's body x0.44 (459 before) and BROODLING.hp
 * x0.31. These come from Ryan's device time (150 to 170 s, about half body and half Broodlings,
 * against a 60 s target: body about 35 s, Broodlings about 25 s at Normal level 5), not the bot.
 * Brood calm pass (Ryan 2026-11-11, device check on ecde5b2): body 202 to 340 and BROODLING.hp
 * 300 to 450. These bracket Ryan's two device fights: 22 s (body 16 s, Broodlings 6 s, rated too
 * easy) against 150 to 170 s on the build before.
 */
export const BOSS_TABLE: Readonly<Record<BossId, BossRow>> = {
  warden: { tier: 1, hp: 519, phases: 2, radius: 56, colour: 'bossBlue' },
  brood: { tier: 1, hp: 340, phases: 2, radius: 52, colour: 'bossGreen' },
  spindle: { tier: 1, hp: 1350, phases: 2, radius: 48, colour: 'bossYellow' },
  ember: { tier: 2, hp: 822, phases: 3, radius: 44, colour: 'bossOrange' },
  mirage: { tier: 2, hp: 1620, phases: 3, radius: 50, colour: 'bossMagenta' },
  gravitas: { tier: 2, hp: 1704, phases: 3, radius: 60, colour: 'bossViolet' },
  bastion: { tier: 3, hp: 1833, phases: 3, radius: 70, colour: 'bossRed' },
  tempest: { tier: 3, hp: 1832, phases: 3, radius: 46, colour: 'bossRed' },
  twins: { tier: 3, hp: 2250, phases: 2, radius: 44, colour: 'bossRed' },
  prism: { tier: 4, hp: 844, phases: 4, radius: 90, colour: 'bossPrism' },
};

/** Damage per hit against a boss or a boss part, in tenths of a hit (boss rule 8). */
export const BOSS_DAMAGE = {
  spread: 10,
  rapid: 7,
  pierce: 40,
  orbit: 15,
  drone: 10,
  ram: 20,
} as const;

/**
 * Boss health (Ryan 2026-11-11): Pierce does this times its BOSS_DAMAGE to guardian bodies, cores
 * and parts (Broodlings, pods, turrets, Hornets). Regular enemies are unchanged. Read only through
 * bossDamageForStyle.
 */
export const PIERCE_GUARDIAN_MULT = 1.5;

/** Orbit blade rest after hitting a boss body, s (0.12 s against everything else). */
export const ORBIT_BOSS_COOLDOWN = 0.25;
/** Detonate takes this fraction of the boss's maximum hit points (boss rule 7). */
export const DETONATE_BOSS_FRACTION = 0.1;
/** Detonate reaches the boss when its body edge is within this many u of the drone. */
export const DETONATE_BOSS_RADIUS = 260;
/** Reward geoms on a boss kill (boss rule 11). */
export const BOSS_REWARD_GEOMS = 20;
/** Stored hit points never exceed this (Int16Array, docs/13 boss rule 2). */
export const BOSS_HP_MAX = 32767;

/** Entrance telegraph ring, harmless and untargetable (boss rule 3). */
export const ENTRANCE_SEC = 2.0;
/** Bomb stagger: no attacks, open to damage (boss rule 7). */
export const STAGGER_SEC = 1.5;
/** Phase change pause: no attacks while the phase flash plays. */
export const PHASE_CHANGE_SEC = 1.0;
/**
 * Enrage after this long alive (boss rule 10), or at once in the hold state. Release polish: 240 s
 * (90 before), so a 3.5 to 4 minute fight is not enraged for most of its length.
 */
export const ENRAGE_AFTER_SEC = 240;
/** Attack clock multiplier while enraged: 30 percent faster. */
export const ENRAGE_RATE = 1.3;
/**
 * Share of the wave schedule kept while a guardian lives, by difficulty (boss rule 4; Ryan
 * 2026-11-11: regular enemies after the entrance scale by difficulty). Insane keeps the old 0.6.
 * Before the entrance nothing changes. Free Play keeps its own setting.
 */
export const WAVE_BUDGET_WITH_BOSS: Readonly<Record<'easy' | 'normal' | 'hard' | 'insane', number>> = {
  easy: 0,
  normal: 0.25,
  hard: 0.5,
  insane: 0.6,
};
/** A lethal hazard that would overlap the ship waits this long and rechecks (fairness rule 5). */
export const HAZARD_RECHECK_SEC = 0.3;
/**
 * Live caps (fairness rule 5). Hazards: 8, Fable's ruling on draft flag 2 (docs/13 "Fable rulings",
 * "Live hazard cap is 8 (lane bursts)"), so Mirage's eight lane burst fits. Tier 1 holds at most 3.
 */
export const MAX_HAZARDS = 8;
export const MAX_ADDS = 8;
/**
 * Hornet pool (GW1): its own cap, separate from the add slots and the part slots. GW2: 10. R1: 16,
 * so Insane's 16 Warden Hornets (10 times addScale 1.6) fit; the 512 entity store has room and the
 * pool is allocated once per world. Normal still releases 10.
 */
export const MAX_HORNETS = 16;
/** R1: live Hornets at Normal (the GW2 cap); other difficulties scale it by addScale up to MAX_HORNETS. */
export const HORNET_CAP = 10;
export const MAX_PARTS = 4;
/** hud:boss throttle, s. */
export const BOSS_HUD_INTERVAL = 0.1;

/** Hazard primitive starting numbers (docs/13 "Hazard primitives"). */
export const HAZARD = {
  laneLength: 600,
  laneHalfWidth: 22,
  /** A lane is at most 60 u wide (fairness rule 5). */
  laneHalfWidthMax: 30,
  laneLethalSec: 0.3,
  ringGrowth: 300,
  /** Lethal band width: the ship centre within half of it from the radius. */
  ringBand: 14,
  sweepHalfWidth: 12,
  sweepLength: 380,
  /** A sweep leaves gaps of at least 90 deg, so at most 4 arms (Spindle's fury fourth arm). */
  sweepArmsMax: 4,
  tetherHalfWidth: 10,
  pullRadius: 300,
  pullMax: 100,
} as const;

/** Warden (tier 1, level 5). */
export const WARDEN = {
  seekSpeed: 55,
  turnRate: 60 * DEG,
  /** GW2: 3.7 s and 2.8 s (4.05 and 3.15 at GW1, 4.5 and 3.5 before). */
  ringEvery: 3.7,
  ringEveryP2: 2.8,
  /** First ring this long after the entrance ends. */
  firstRing: 1.5,
  /** Full gap angle facing the ship. */
  gapDeg: 70,
  /** Gaps per ring in phase 2 (the second is opposite the first). Set 1 to keep one gap. */
  gapsP2: 2,
  /** Core open window after each ring launches. */
  openSec: 2.0,
  /** Ring starts this far outside the body. */
  ringStartPad: 10,
  /** Entrance slide ends at this share of the wall distance. */
  entryHome: 0.55,
} as const;

/** Warden fury: seconds of the invincible break when the Shield bar empties (Ryan 2026-11-11). */
export const FURY_BREAK_SEC = 4.5;

/**
 * Warden fury (Ryan 2026-11-11, every mode Warden appears in). At the stage 1 crack (the Shield bar
 * empties) Warden breaks: it stops, clears its rings and Hornets, closes its core and takes no
 * damage for breakSec, and phase 2 starts. From then to its death it is enraged: faster seek and
 * turn, quicker rings, and a dash charge (aim, dash, a ring of bullets, then an open core). Shields
 * keep their cycle. The single place for every fury number.
 */
export const WARDEN_FURY = {
  breakSec: FURY_BREAK_SEC,
  /** Enraged seek and turn (55 u/s and 60 deg/s before). */
  seekSpeed: 80,
  turnRate: 90 * DEG,
  /** Enraged ring interval (phase 2 was 2.8 s). */
  ringEvery: 2.4,
  /** First dash this long after the break ends, then one every dashEvery, start to start. */
  dashFirst: 3,
  dashEvery: 8,
  /** Aim: Warden stops, heading locked toward the ship at the start. */
  aimSec: 0.8,
  /** Dash speed along the heading, for at most dashSec or until a wall stops it. */
  dashSpeed: 300,
  dashSec: 1.0,
  /** Where it stops: one ring of this many enemy bullets at this speed, u/s. */
  dashRingBullets: 12,
  dashRingSpeed: 180,
  /** Then the core opens this long (the reward window). */
  openSec: 2.0,
} as const;

/**
 * Warden shield and swarm (GW1: every phase): firstSec into the fight, then every everySec start to
 * start, it stops, closes its core for shieldSec and releases Hornets in two bursts, then opens for
 * openSec.
 */
export const WARDEN_SHIELD = {
  /** GW1: the first shield goes up this many seconds into the fight (after the entrance). */
  firstSec: 10,
  /** Then one every everySec, start to start, in every phase. */
  everySec: 14,
  shieldSec: 4,
  /** Bursts fire this many seconds into the shield. */
  burstAt: [0.5, 2.0] as readonly number[],
  /** Hornets per shield (GW2: a fixed 10, two bursts of 5, in their own pool of MAX_HORNETS). */
  hornetsMin: 10,
  hornetsMax: 10,
  /** Core open window when the shield drops (GW2: 2.0 s, 2.5 s at GW1). */
  openSec: 2.0,
  /** Phase 2 (GW2): the shield fires one ring of this many enemy bullets as it drops. */
  dropRingBullets: 12,
  /** Speed of the drop ring bullets, u/s (under ENEMY_BULLET_SPEED_MAX). */
  dropRingSpeed: 180,
} as const;

/** Hornet (Warden's swarm add, Kind.BossPart PartType.Hornet in a Hornet slot). */
export const HORNET = {
  radius: 10,
  /** 1 HP in tenths of a hit. */
  hp: 10,
  /** GW2: 300 u/s (260 at GW1). */
  speed: 300,
  turnRate: 240 * DEG,
  /** Seconds it flies straight out of the hive before it turns to chase. */
  leaveSec: 0.35,
  /** Contact kills only from this age on (the add telegraph). */
  armSec: 0.6,
  /** It dies on its own at this age (chase 5 s after leaving). */
  lifeSec: 5.35,
  /** Spawn this far outside the Warden body. */
  spawnPad: 14,
} as const;

/** Gravitas split (stage 2 crack): two half mass wells that orbit each other. */
export const GRAVITANT = {
  count: 2,
  radius: 28,
  /** Orbit radius around the pair centre, the speed the orbit opens at, and the spin, rad/s. */
  orbit: 70,
  orbitGrow: 60,
  spin: 1.2,
  /** The pair centre seeks the target at this speed. */
  seekSpeed: 45,
  /** Each well pulls at half the Gravitas strength over the same radius. */
  pullRadius: 300,
  pullMax: 50,
} as const;

/** Mirage split (stage 2 crack): two decoys trailing its last two positions. */
export const MIRROR = {
  count: 2,
  /** 1 HP in tenths of a hit. */
  hp: 10,
  /** Mirrors copy the last two positions this long after each warp. */
  delaySec: 0.6,
  /** Missing mirrors come back every respawnSec while Mirage lives. */
  respawnSec: 6,
  /** With no history yet a mirror stands this far beside the body. */
  fallbackOffset: 120,
} as const;

/**
 * Brood (tier 1, level 10). G3A rework (Ryan: "more like a level obstacle than a boss"): it hunts
 * the ship and charges across the arena instead of hugging the boundary, its adds are Darts
 * launched at the ship, and its open core is a flagged window (BossState.exposed).
 */
export const BROOD = {
  /** Prowl: seek the ship, turn limited. */
  prowlSpeed: 75,
  prowlSpeedP2: 90,
  turnRate: 90 * DEG,
  /** Prowl seconds before each charge wind up (attack clock, so enrage shortens it). */
  prowlSec: 3.0,
  prowlSecP2: 2.2,
  /** First wind up this long after the entrance ends. */
  firstCharge: 1.5,
  /**
   * Charge: heading locked toward the ship when the wind up starts. The wind up lasts the tier
   * telegraph (1.0 s at tier 1) and shows a lane marker along the path. The body then runs at
   * chargeSpeed for at most chargeSec or until a wall stops it.
   */
  chargeSpeed: 320,
  chargeSpeedP2: 360,
  chargeSec: 1.8,
  /** Pause after a charge before it prowls again. */
  recoverSec: 0.6,
  /** Marker half width (the lane cap, 30 u). The body is wider: the marker shows the line. */
  markerHalfWidth: 30,
  /**
   * While the core is open it never charges and flees from the ship at this speed (turn limited),
   * so the window is a chase, not a sitting target.
   */
  exposedSpeed: 80,
  addEvery: 6,
  addEveryP2: 5,
  /** First adds this long after the entrance ends. */
  firstAdds: 2,
  addsPerWave: 3,
  addsPerWaveP2: 4,
  /** Adds launch from the side facing the ship, this far apart. */
  addSpreadDeg: 30,
  /** Nearer than this, adds launch from the rear flanks instead (never point blank). */
  addFrontMinDist: 220,
  podCount: 3,
  podOrbit: 90,
  /** 1 HP in tenths of a hit. */
  podHp: 10,
  podRadius: 12,
  podSpin: 1.2,
  openSec: 5,
  /** Pods regrow this long after the last one died (10 at G3A; 9 keeps the fight in 35 to 50 s). */
  regrowSec: 9,
  /** Adds spawn this far outside the body. */
  addPad: 24,
  /** Entrance slide distance in from the wall, u. */
  entrySlide: 40,
} as const;

/**
 * Brood split (G3C): at the stage 2 crack the body is replaced by three Broodlings (Kind.BossPart,
 * PartType.Broodling, slot = role). Stored hit points are tenths of a hit like every boss number.
 */
export const BROODLING = {
  count: 3,
  radius: 20,
  /**
   * 30 spread hits each (the table dialect: HP in hits, stored as tenths). Ryan's device time, not
   * the bot: 600 to 190 in the Warden fury wave, then 190 to 300 (fury two: they died too fast).
   */
  hp: 450,
  /** Spawn ring around the dead body centre, u. */
  spawnRing: 40,
  /** Role 0: seeks the ship, turn limited. Contact kills (every Broodling does). */
  chaseSpeed: 135,
  turnRate: 100 * DEG,
  fleeTurnRate: 180 * DEG,
  /** Role 1: keeps this distance from the ship, circling at orbitRate rad/s, and lays Slime every slimeEvery s. */
  orbitRadius: 200,
  orbitRate: 0.7,
  orbitSpeed: 230,
  slimeEvery: 2,
  /** Role 2: runs from the ship (sliding along walls) and launches dartsPerWave Darts every dartEvery s. */
  fleeSpeed: 120,
  dartEvery: 4,
  dartsPerWave: 2,
  dartSpreadDeg: 20,
  /** First Dart wave and first Slime this long after the split. */
  firstDelay: 1.5,
} as const;

/**
 * Brood frenzy (Ryan 2026-11-11, fury three). Brood's body has no fury and no break: the split is its
 * mid point. The Broodlings enrage when the first one dies ('sim:bossFury' on, once): survivors move
 * speedMul faster, and every everySec of attack time two survivors close on the ship from opposite
 * sides (the pincer): each stops and faces a point reach u past the ship on the far side from the
 * other for aimSec, then drives through it at driveSpeed for at most driveSec. A lone survivor keeps
 * the speed and hunts the ship.
 */
export const BROOD_FRENZY = {
  speedMul: 1.25,
  everySec: 4,
  aimSec: 0.4,
  reach: 140,
  driveSpeed: 200,
  driveSec: 1.6,
} as const;

/** Spindle (tier 1, level 15). */
export const SPINDLE = {
  orbitRadius: 200,
  orbitRate: 0.4,
  /** Top speed while reaching its orbit point, u/s. */
  approachSpeed: 120,
  arms: 2,
  armsP2: 3,
  armLength: 380,
  /** Arm rate without the pellet trade. The shot row below overrides it. */
  armRate: 0.5,
  reverseEvery: 5,
} as const;

/**
 * Spindle fury (Ryan 2026-11-11, fury two). At the stage 1 crack Spindle breaks (FURY_BREAK_SEC, the
 * shared fury), then is enraged to its death: a fourth arm, each sweep turning at a hashed rate in
 * armRateMin to armRateMax, a reversal every reverseEvery (the arm telegraph is never shortened).
 */
export const SPINDLE_FURY = {
  arms: 4,
  armRateMin: 0.4,
  armRateMax: 0.6,
  reverseEvery: 3,
} as const;

/**
 * Spindle needles (fury two: every arm fights). Each arm tip sheds one enemy bullet every every
 * seconds of attack time (everyFury enraged), flung along the sweep tangent at speed u/s. A tip
 * within shipClear u of the ship, or outside the arena, sheds nothing that time. Frozen arms (the
 * telegraph) shed nothing.
 */
export const SPINDLE_NEEDLES = {
  every: 1.2,
  everyFury: 0.9,
  speed: 170,
  shipClear: 150,
} as const;

/**
 * Ember fury (Ryan 2026-11-11, fury two). At the stage 1 crack Ember breaks (FURY_BREAK_SEC), then
 * is enraged to its death: dash speed times dashSpeedMul (the dash time is kept, so the dash runs
 * longer), up to bounces wall bounces, and leaversPerStun enraged Leavers per stun.
 */
export const EMBER_FURY = {
  dashSpeedMul: 1.2,
  bounces: 3,
  leaversPerStun: 3,
} as const;

/**
 * Ember Leavers (fury two): every stun releases perStun Leavers at the body, enraged as a membrane
 * crossing would (World.enraged, 'sim:enrage'), at most cap Ember Leavers alive, inside the add
 * slots and maxLiveEnemies. They spawn spawnPad u outside the body edge.
 */
export const EMBER_LEAVERS = {
  perStun: 2,
  cap: 4,
  spawnPad: 14,
} as const;

/**
 * Ember (tier 2, orange, level 20; roster row 4). Wind up with a lane marker, dash, bounce off up
 * to two walls, a Mine every 120 u along the dash. Hittable only stunned or resting. Each phase is
 * speedUp faster: speeds times speedUp^(phase - 1), timings divided by it, and the wind up never
 * shorter than the tier telegraph.
 */
export const EMBER = {
  windupSec: 0.9,
  dashSpeed: 760,
  dashSec: 0.6,
  /** Wall bounces per dash. A dash that touched a wall ends in a stun; a third wall stuns at once. */
  bounces: 2,
  stunSec: 2.0,
  restSec: 1.2,
  /** Turn rate while winding up, before the heading locks (when the marker shows). */
  turnRate: 240 * DEG,
  /** First wind up this long after the entrance ends. */
  firstDash: 1.0,
  /** A Mine every this many u of dash (the Mine rules: 6 per owner, 24 in total). */
  mineEvery: 120,
  speedUp: 1.15,
  /** Marker half width (lane cap 30 u); the body is wider, the marker shows the line. */
  markerHalfWidth: 30,
  entryHome: 0.5,
} as const;

/**
 * Mirage (tier 2, magenta, level 25; roster row 5). Warps to a point 200 to 300 u from its target,
 * a ring marks the spot markSec early, then eight lanes radiate from the landing point. Its shield
 * ring blocks every shot except through an open arc that turns at arcRate (w.rot of the boss is
 * the arc centre).
 */
export const MIRAGE = {
  warpEvery: 3.0,
  warpEveryP2: 2.5,
  warpEveryP3: 2.0,
  markSec: 0.5,
  warpMin: 200,
  warpMax: 300,
  /** Candidate landing points tried per warp (deterministic, from hash01). */
  warpTries: 8,
  /** A landing waits while the ship is within the body radius plus this pad of the spot. */
  landPad: 40,
  lanes: 8,
  /** Lanes sit this far off the ship's bearing, so the ship starts midway between two of them. */
  laneOffsetDeg: 22.5,
  laneLength: 600,
  laneHalfWidth: 22,
  arcDeg: 70,
  arcRate: 1.5,
  /** First warp marker this long after the entrance ends. */
  firstWarp: 1.5,
  entryHome: 0.5,
} as const;

/**
 * Mirage fury (Ryan 2026-11-11, fury three). Shared fury: the break at the stage 1 crack, then
 * enraged. False landings: every enraged warp shows rings landing ring markers, one real. The fakes
 * are markers only (never lethal) and vanish fakeFadeSec before the landing. Every ring follows the
 * warp distance rule and stands at least fakeGap u from each other ring.
 */
export const MIRAGE_FURY = {
  rings: 3,
  fakeFadeSec: 0.2,
  fakeGap: 120,
} as const;

/**
 * Gravitas (tier 2, violet, level 30; roster row 6). Seeks at 45 u/s with a pull around it. Three
 * anchors gate all damage; each lost anchor weakens the pull by a third. A collapsing ring with a
 * 60 deg gap facing the ship every 5, 4 then 3 s.
 */
export const GRAVITAS = {
  seekSpeed: 45,
  anchors: 3,
  /** 6 HP in tenths of a hit. */
  anchorHp: 60,
  anchorRadius: 14,
  anchorOrbit: 140,
  anchorSpin: 0.6,
  ringEvery: 5,
  ringEveryP2: 4,
  ringEveryP3: 3,
  /** First ring this long after the entrance ends. */
  firstRing: 2.5,
  gapDeg: 60,
  /** The ring starts this far out and collapses onto the body at ringCollapse u/s. */
  ringStart: 480,
  ringCollapse: 220,
  pullRadius: 300,
  pullMax: 100,
  entryHome: 0.45,
} as const;

/**
 * Gravitas fury (Ryan 2026-11-11, fury three). Shared fury: the break at the stage 1 crack, then
 * enraged. Tide: the pull flips to a push and back every flipSec at the same strength (the same
 * speed cap), on the body and after the stage 2 split on the pair. Glow flashes a ring from
 * telegraphSec before each flip (BossView.tideFlipIn).
 */
export const GRAVITAS_FURY = {
  flipSec: 4,
  telegraphSec: 0.8,
} as const;

/**
 * Gravitas shelter pools (Ryan 2026-11-12, version 1 of the low gravity puddle redesign; fury fixes
 * stub, starting values). Enraged, Gravitas (after the split, the pair centre) leaves a pool where it
 * stands every everySec of attack time. A pool has radius u, lasts lifeSec and shrinks to 0 over its
 * last fadeSec; at most max live at once (the oldest goes first). A ship inside gets no Gravitas pull
 * or push and floats (the high Space physics thrust handling). The tide stays. HazardType.Pool.
 */
export const GRAVITAS_POOL = {
  everySec: 3,
  radius: 80,
  lifeSec: 8,
  fadeSec: 2,
  max: 4,
} as const;

/**
 * Bastion (tier 3, red, level 35; roster row 7). Holds the centre and turns at 0.3 rad/s. Four
 * corner turrets (8 HP) take one turn every 1.125 s in order (GW5); a destroyed turret skips its turns. The
 * core takes damage once two turrets are down. Phases follow the turrets: four, two, none.
 */
export const BASTION = {
  turnRate: 0.3,
  turrets: 4,
  /** 30 HP in tenths of a hit (GW4: 180 before, GW3: 8 before that). */
  turretHp: 300,
  /** GW4: a fallen turret rebuilds this long after it fell (one at a time), at half hit points (GW5: 12, 18 before). */
  regenSec: 12,
  /** GW4: rebuilds happen only while the core has more than this share of its hit points, before it wakes. */
  regenAboveShare: 0.33,
  /** GW3: the live turrets are shielded this long after each turret death (hits blocked). */
  turretShieldSec: 1.5,
  /** GW3: each turret death takes this share of maximum hit points off the bar (four: 20 percent at most). */
  turretBarShare: 0.05,
  turretRadius: 16,
  /** Turret centres sit this far from the core centre, on the diagonals of its facing. */
  turretOffset: 100,
  /** GW5: 1.125 s, 25 percent shorter (1.5 before). One turret fires per turn. */
  turnEvery: 1.125,
  /** First turn this long after the entrance ends. */
  firstTurn: 1.0,
  /** The core opens with this many turrets or fewer left. */
  openAtTurrets: 2,
  /** Lanes run straight out from a turret along its diagonal. */
  laneLength: 600,
  laneHalfWidth: 22,
  addEvery: 12,
  /** R1: Bulwarks per add wave at Normal (times addScale on other difficulties). */
  addsPerWave: 1,
  /** R1: extra Bulwarks of one wave sit this far apart round the facing. */
  addSpreadDeg: 40,
  /** Bulwarks join this far outside the body edge, on the side facing the target. */
  addPad: 40,
  // Phase 3 (G3C): the core wakes once the last turret dies.
  /** Drift speed of the woken core toward the ship between shields, u/s (GW2: 50, 110 before). */
  wakeSpeed: 50,
  /** One sweep arm rides the body, turning at sweepRate rad/s. */
  sweepLength: 230,
  /** GW5: 1.08 rad/s, 20 percent faster (0.9 before). */
  sweepRate: 1.08,
  /** A charge every chargeEvery s (chargeEveryCracked after the stage 2 crack), the first firstCharge s after waking. */
  chargeEvery: 5,
  chargeEveryCracked: 3.5,
  firstCharge: 2,
  /** The charge runs at chargeSpeed for chargeSec, or until a wall, after the tier telegraph. */
  chargeSpeed: 520,
  chargeSec: 0.7,
  /** The charge marker lane: half width. */
  chargeMarkerHalf: 30,
} as const;

/**
 * Bastion phase 3 shield (GW2): every everySec (start to start, the first firstSec after waking) it
 * raises a shield for shieldSec (shots absorbed) and releases hornets Hornets in bursts at burstAt
 * from the shared Hornet pool, then opens for openSec. It drifts toward the ship between shields.
 */
export const BASTION_SHIELD = {
  firstSec: 10,
  /** GW4: 10 s start to start (12 before). */
  everySec: 10,
  shieldSec: 3,
  burstAt: [0.4, 1.6] as readonly number[],
  /** GW5: 8 Hornets per shield, two bursts of 4 (6 before). Pool rules unchanged. */
  hornets: 8,
  openSec: 2,
} as const;

/** A boss body cracks when it first drops below these shares of its hit points (stage 1, stage 2). */
export const CRACK_AT = [0.66, 0.33] as const;
/** Seconds between 'sim:bossWindow' reports while a run up to the window shows. */
export const WINDOW_LEAD_INTERVAL = 0.1;

/**
 * Tempest (tier 3, red, level 40; roster row 8). Laps the wall at 140 u/s, 90 u from it, dropping a
 * Slime every 1.0 s (8 of its own live at most, inside the 12 total Slime cap). Every 5 s (4.17,
 * 3.33 in later phases since GW5) it winds up for the tier telegraph with a lane marker, dashes across the arena at
 * its target and rests 1.5 s at the far wall. Hittable on the lap and in the rest.
 */
export const TEMPEST = {
  lapSpeed: 140,
  wallGap: 90,
  /** Catch up speed toward the lap point (after a dash), as a multiple of lapSpeed. */
  catchUp: 1.6,
  slimeEvery: 1.0,
  slimeMax: 8,
  /** GW5: attack cadence 20 percent faster (6, 5 and 4 s before). */
  dashEvery: 6 / 1.2,
  dashEveryP2: 5 / 1.2,
  dashEveryP3: 4 / 1.2,
  /** First dash this long after the entrance ends. */
  firstDash: 4,
  dashSpeed: 600,
  /** A dash ends at the far wall, or after this long at most. */
  dashSecMax: 3,
  restSec: 1.5,
  markerHalfWidth: 30,
} as const;

/**
 * Tempest split (GW2): at the stage 2 crack the body splits once into count smaller Tempests
 * (Kind.BossPart, PartType.Tempestling, slot = index), each sizeShare of the body radius with the
 * remaining hit points split evenly. GW3: each chases a flank point on its own side of the ship
 * away from the walls and makes committed marked dashes through the ship, its clocks at rate.
 */
export const TEMPESTLING = {
  count: 2,
  sizeShare: 0.6,
  /** GW3: the storm attack (Slime and dash clocks) at full rate (0.7 before). */
  rate: 1,
  /** First pincer this long after the split (GW4: 2 before). */
  firstDash: 1.5,
  /**
   * GW4: chase seconds between pincers, counted from the end of the rest (GW3 used the body's
   * dashEvery, counted only in the chase, so a pincer came about every 9 s: "no dashing").
   * GW5: 2.6 s (3 before).
   */
  dashEvery: 2.6,
  /** A due pincer waits at most this long (attack seconds) for the two to reach opposite sides (GW4: 2.5 before). */
  flankWait: 1,
  /**
   * GW5: chase speed between dashes, u/s, from chaseSpeed at full part hit points up to
   * chaseSpeedMax as the part loses them (GW4: a flat 165, GW3: 196).
   */
  chaseSpeed: 165,
  chaseSpeedMax: 185,
  /**
   * GW4: wind up seconds, the lane marker shown the whole time (the tier telegraph was 0.6 s).
   * GW6: 0.5 s (0.7 before); the aim tracks the ship's lead point and locks at the end.
   */
  windupSec: 0.5,
  /** GW6: after a dash the part turns to face the ship within this long. */
  turnSec: 0.2,
  /** GW6: a dash line ends with the body edge at least this far from every wall and obstacle. */
  wallClip: 60,
  /** GW6 unstuck: a centre this close to a wall or obstacle counts as near it. */
  nearWall: 140,
  /** GW6 unstuck: near a wall this long (any state), or moved less than stuckMove in stuckWindow of chase. */
  nearSec: 1,
  stuckMove: 40,
  stuckWindow: 1,
  /** GW6 unstuck: then it steers toward the arena centre for this long. */
  unstuckSec: 0.6,
  /**
   * GW6 cut off: in a pincer slot 1 aims this far to the side of slot 0's aim point, across slot 0's
   * line on the side the ship is sidestepping to (its own side of the line when the ship is not), so
   * the step that clears one dash runs into the other.
   */
  cutOff: 80,
  /** GW6: a sideways ship speed under this (u/s) is no sidestep; slot 1 then cuts on its own side. */
  sidestepMin: 40,
  /** GW3: committed dash speed, u/s (GW5: 462, 420 before). */
  dashSpeed: 462,
  /** GW3: a wind up starts only when the dash line runs at least this far before the wall. */
  dashMin: 200,
  /** GW3: between dashes the centre keeps at least this far from every wall. */
  wallKeep: 150,
  /** GW3: each chases a flank point this far from the ship, the two on opposite sides of it. */
  flankDist: 260,
  /** GW3: rest after a dash (the body's is TEMPEST.restSec). */
  restSec: 0.6,
  /**
   * GW5: after each dash a fan of fanCount bullets, fanSpreadDeg apart, at fanSpeed u/s, aimed back
   * along the dash path (toward where the ship stood). Its own row: a volley of 6 is above
   * SHOT_VOLLEY_MAX, which binds the shot rows only; the brief asks for 6. It fires in the rest once
   * the ship is ENEMY_BULLET_MIN_RANGE from the muzzle, or not at all.
   */
  fanCount: 6,
  fanSpreadDeg: 14,
  fanSpeed: 200,
} as const;

/**
 * Twins (tier 3, red, level 45; roster row 9). Two bodies of 500 HP each orbit the arena centre,
 * 300 to 500 u apart, at 0.6 rad/s, with a lethal tether between them. Each fires a ring every 7 s,
 * offset by 3.5 s. The first to fall breaks the tether and enrages the other (x1.4 speed, a ring
 * every 4 s).
 */
export const TWINS = {
  orbitRate: 0.6,
  sepMin: 300,
  sepMax: 500,
  /** The separation breathes between sepMin and sepMax at this rate, rad/s. */
  sepRate: 0.35,
  /** The second body slides out from the first at this speed after the entrance. */
  slideSpeed: 220,
  /** The tether forms once the bodies are this far apart. */
  tetherAt: 250,
  ringEvery: 7,
  ringEveryEnraged: 4,
  enrageSpeed: 1.4,
  /** First ring this long after the entrance ends. */
  firstRing: 1.5,
  gapDeg: 60,
  ringStartPad: 10,
  /** Entrance home distance from the centre, at most. */
  entryHome: 200,
} as const;

/**
 * Prism (tier 4, multicolour, level 50; roster row 10). Drifts between four points at 90 u/s and
 * quotes the others by phase: 1 ring and pods, 2 sweep arms and a dash lane, 3 a pull and warp lane
 * bursts, 4 turret nodes and a tether. A 4 s damage cycle: 2.3 s colour, 0.5 s run to white, 1.2 s
 * window. Full damage in the window, leak (25 percent) outside it. Its own hazard cap is 6.
 */
export const PRISM = {
  driftSpeed: 90,
  /** Drift points sit on the arena diagonals at this share of the wall distance. */
  pointShare: 0.55,
  /** Arrival distance at a drift point, u. */
  arriveDist: 2,
  /** Visual spin of the body, rad/s. */
  spin: 0.3,
  colourSec: 2.3,
  whiteSec: 0.5,
  windowSec: 1.2,
  /** Share of a hit that gets through outside the window. */
  leak: 0.25,
  maxHazards: 6,
  /** First attack this long after the entrance ends (and after each phase change). */
  firstAttack: 1.5,
  // Phase 1: ring and three pods.
  ringEvery: 3.5,
  gapDeg: 60,
  ringStartPad: 10,
  ringGrowth: 300,
  pods: 3,
  /** 2 HP in tenths of a hit. */
  podHp: 20,
  podRadius: 14,
  podOrbit: 140,
  podSpin: 1.0,
  // Phase 2: two sweep arms and a dash lane.
  sweepArms: 2,
  sweepLength: 380,
  sweepRate: 0.6,
  laneEvery: 2.5,
  laneLength: 600,
  laneHalfWidth: 22,
  // Phase 3: a pull and warp lane bursts.
  pullRadius: 300,
  pullStrength: 70,
  warpEvery: 3.5,
  /** The landing ring marker shows this long before the warp (at least the marker life, so it is gone). */
  markSec: 0.6,
  /** A landing waits while the ship is within the body radius plus this pad of the spot. */
  landPad: 40,
  burstLanes: 4,
  /** Burst lanes sit this far off the ship's bearing, so the ship starts midway between two. */
  burstOffsetDeg: 45,
  // Phase 4: four turret nodes and a tether.
  turrets: 4,
  /** 6 HP in tenths of a hit. */
  turretHp: 60,
  turretRadius: 16,
  turretOffset: 120,
  turnEvery: 1.0,
  entryHome: 0.5,
} as const;

export interface ShotRow {
  pattern: 'pellet' | 'fan' | 'turret';
  /** Bullet speed, u/s (clamped to ENEMY_BULLET_SPEED_MAX by the pool, phase speed ups included). */
  speed: number;
  /** Seconds between volleys (pellet, turret). 0 for a fan, which fires once per open floor dash. */
  every: number;
  everyP2: number;
  /** Bullets per volley (at most SHOT_VOLLEY_MAX). Optional so a row without it fires one. */
  count?: number;
  /** Angle between neighbours in a fan, degrees (at least 12). */
  spreadDeg?: number;
  /** Spindle's trade: arm rate with the pellet on. */
  armRate?: number;
  /** Ember's trade: rest after an open floor dash, s (the fan launches inside it). */
  restSec?: number;
}

/**
 * The three shooters (docs/13 "Boss projectiles"). Each row holds the shot and the trade it pays
 * (Spindle's slower arms, Ember's longer rest after an open floor dash). Cut 5 empties these rows,
 * which removes the shots and reverts the trades; every other attack stays. Bastion's row is its
 * trade too: with it each turret alternates a lane and a bullet on its own turns (same turn rate,
 * BASTION.turnEvery); without it every turn is a lane.
 */
export const BOSS_SHOTS: Readonly<Partial<Record<BossId, ShotRow>>> = {
  spindle: { pattern: 'pellet', speed: 180, every: 3.0, everyP2: 3.6, count: 1, armRate: 0.4 },
  ember: { pattern: 'fan', speed: 210, every: 0, everyP2: 0, count: 3, spreadDeg: 14, restSec: 1.8 },
  bastion: { pattern: 'turret', speed: 200, every: 1.125, everyP2: 1.125, count: 1 },
};

/** A volley is at most this many bullets (docs/13 boss projectiles rule 2). */
export const SHOT_VOLLEY_MAX = 5;
/** Neighbours in a fan are at least this far apart, degrees (rule 6). */
export const SHOT_SPREAD_MIN_DEG = 12;
/** A shot due with the ship nearer than ENEMY_BULLET_MIN_RANGE waits this long and rechecks (rule 6). */
export const SHOT_RECHECK_SEC = 0.3;

/** Ember's rest after an open floor dash: the fan row's trade when the row exists, else the base rest. */
export function emberFanRest(): number {
  return BOSS_SHOTS.ember?.restSec ?? EMBER.restSec;
}

/** Spindle's arm rate: the shot row's trade when the row exists, else the base rate. */
export function spindleArmRate(): number {
  return BOSS_SHOTS.spindle?.armRate ?? SPINDLE.armRate;
}

/** Pure: stored maximum hit points for a row and an hpMul, in tenths, clamped to the Int16 range. */
export function maxHpFor(row: BossRow, hpMul: number): number {
  const v = fullHpFor(row, hpMul);
  return v > BOSS_HP_MAX ? BOSS_HP_MAX : v;
}

/** Pure: maximum hit points for a row and an hpMul in tenths, before the Int16 clamp (at least 1). */
export function fullHpFor(row: BossRow, hpMul: number): number {
  const mul = Number.isFinite(hpMul) && hpMul > 0 ? hpMul : 1;
  const v = Math.round(row.hp * 10 * mul);
  return v < 1 ? 1 : v;
}

/**
 * Pure: armour for a row and an hpMul. Hit points past the Int16 store become armour instead: every
 * hit on the core (and on a split boss's body parts) is divided by it, so the fight lasts as long
 * as the full hit points say while the bar keeps its stored scale. 1 when nothing is clamped.
 */
export function armourFor(row: BossRow, hpMul: number): number {
  const full = fullHpFor(row, hpMul);
  return full > BOSS_HP_MAX ? full / BOSS_HP_MAX : 1;
}

/**
 * Boss scaling with the level (release polish item 7). Attack cadence and bullet speed are
 * 75 percent of the table at level 5, rise linearly to 100 percent at level 20 and on to
 * 115 percent at level 50; later levels and every loop of the list (hpMul above 1) stay at 115.
 */
export const BOSS_LEVEL_SCALE = {
  startLevel: 5,
  start: 0.75,
  midLevel: 20,
  mid: 1,
  topLevel: 50,
  top: 1.15,
} as const;

/** Pure: the attack scale (cadence and bullet speed) for a level index and a loop flag. */
export function levelAttackScale(level: number, loop: boolean): number {
  const s = BOSS_LEVEL_SCALE;
  if (loop || !(level < s.topLevel)) return s.top;
  if (!(level > s.startLevel)) return s.start;
  if (level <= s.midLevel) return s.start + ((s.mid - s.start) * (level - s.startLevel)) / (s.midLevel - s.startLevel);
  return s.mid + ((s.top - s.mid) * (level - s.midLevel)) / (s.topLevel - s.midLevel);
}

/** Campaign level of each boss on the first pass of the list (level 5, 10, ..., 50). */
export function bossNominalLevel(order: number): number {
  return 5 * (order + 1);
}

/**
 * Attack rotation (release polish item 7: long fights stay varied). On top of its signature attack
 * every boss fires a bullet volley every everyByTier seconds of attack time, cycling three patterns
 * in a fixed order (aimed fan, radial burst, pincer), so no pattern repeats twice in a row. Each
 * phase past the first is one escalation: one more bullet per side of the pattern and phaseRate
 * shorter gaps. Speeds are scaled with the level and clamped to ENEMY_BULLET_SPEED_MAX.
 */
export const ROTATION = {
  patterns: 3,
  /** Seconds of attack time between volleys, by tier 1 to 4. */
  everyByTier: [6.5, 6, 5.5, 5] as readonly number[],
  /** First volley this long after the entrance ends (and after a ship respawn). */
  firstSec: 4,
  /** Gap divisor per phase past the first: every / (1 + phaseRate * (phase - 1)). */
  phaseRate: 0.12,
  speed: 190,
  /** Pattern 0, aimed fan: fanBase bullets plus one per phase past the first, at most SHOT_VOLLEY_MAX. */
  fanBase: 3,
  fanSpreadDeg: 14,
  /** Pattern 1, radial burst: burstBase bullets plus burstPerPhase per phase, the ship midway between two. */
  burstBase: 8,
  burstPerPhase: 2,
  /** Pattern 2, pincer: pairs either side of the ship's bearing, the first at pincerDeg, then pincerStepDeg apart. */
  pincerPairs: 1,
  pincerDeg: 24,
  pincerStepDeg: 16,
  /** Recent patterns kept in BossState.rotLog (tests read it). */
  logSize: 32,
} as const;
