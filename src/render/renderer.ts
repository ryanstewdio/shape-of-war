// Game renderer (docs/03-architecture.md section 6). Scene graph:
//   stage > world > gridLayer (alpha = gridAlpha): dust, grid (v1, low tier), lattice
//                 > bloomLayer (bloom filter, reduced resolution): wallGlow, wallPulse,
//                   wallFlash, glowSprites, particles, bulletTrails, enemyFxGlow, ringGlow
//                 > lines (no filter, full resolution, MSAA): walls, floor, enemyFx, entities,
//                   bullets, rings
//   stage > sticks (outside bloom)
// v2 wave C: the new enemies draw from shapeSpecs.ts; per kind alpha, scale and tells come
// from the pure render contract helpers in enemyFx.ts. Slime puddles sit on the floor layer
// under every entity. enemyFx holds the Charger lane and dash streak, the Blink destination
// ring and the arrival and splat flashes. wallPulse (threat) and wallFlash (kills near a wall)
// are multipliers on their own layers (mapFx.ts); applyNeon still owns every SPEC 4 value.
// Crisp line work never passes through the filter, so it renders at the full backing store
// resolution with antialiasing. The bloom layer only holds soft content: one bloom source
// sprite per entity (pre-rendered at resolution 2), a thick wall copy, particles and trails.
// On the fallback path the filter is removed and the sprites switch to blurred glow textures.
// v2 wave B: bullet heads draw from one atlas by BulletPool.style (bullets container) and the
// attached trails from the trail texture (bulletTrails): two draw calls for every bullet look.
// Weapon pickups use per weapon visual slots (shapeSpecs.ts). Ship and bullet particle trails
// go into the shared particle pool (particles.ts) and follow the effects tier.
// v2 wave D: on the standard and high tiers the v1 grid and ripple are replaced by the spring
// lattice (latticeView.ts, sim in lattice/): one position buffer, line-list meshes, impulses from
// fx events, well pull and ship wake read from the World, and a governor that coarsens the
// spacing under sustained load. The low tier keeps the v1 grid and ripple path as it was.
// Run 0198 hit feedback (hitFx.ts): 'fx:hit' draws a tiny additive flash on a multi HP target
// (80 ms) or, when a Bulwark shield blocked it, a short arc on the shield plus 3 to 5 sparks. The
// flashes live in a second small pool whose Particles sit in the same pulses container (no extra
// draw call, no new buffer), throttled to one per entity per 50 ms, and are off on the low tier.
// The app is created with autoStart false; draw() updates the scene and calls app.render().
import {
  Application,
  BlurFilter,
  Container,
  Graphics,
  Matrix,
  Mesh,
  MeshGeometry,
  Particle,
  ParticleContainer,
  Rectangle,
  Sprite,
  Texture,
  type Renderer,
} from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters';
import { registerParticleStress } from '../core/debug';
import { bus } from '../core/events';
import { gameState, isTelegraphing, telegraphLeft } from '../game/game';
import type { World } from '../game/world';
import type { ArenaDef, LevelDef, Obstacle } from '../levelgen/leveldef';
import { geomAlpha, invulnAlpha } from './blink';
import { hash01 } from './color';
import {
  arenaGridSegments,
  drawGrid,
  drawGridProjected,
  drawWalls,
  drawDrumGrid,
  drawDrumWalls,
  drawTroughGrid,
  drawTroughWalls,
  drawWallsProjected,
  gridLineWidth,
  WALL_GLOW_PX,
  WALL_LINE_PX,
  wallPasses,
  type DrumArcs,
  type WallPass,
} from './grid';
import { wrapCoord } from '../core/surface';
import { GRID_SPACING } from './gridGeom';
// Wave V3-G: render only tilt (project.ts, tiltScene.ts). Off takes the v3 path untouched.
import { cameraFor, fitProjected, parseTiltKnob, project, projectNodes, TILT_DEG, type Camera, type Projected } from './project';
import {
  MEMBRANE_GLOW_STEPS,
  barrierRects,
  circleOverlapsObstacle,
  glowStep,
  isVertical,
  markGlowCells,
  membraneCellCount,
  membraneObstacles,
  membraneSegments,
  stepGlow,
} from './membrane';
import { clearEnraged, createEnrageTrack, enrageGlowMul, enrageTint, growEnrageTrack, isEnraged, markEnraged } from './enrage';
import { createDriftStreaks, driftBurstEvent, driftStreakFrame, streakAt, type StreakFrame, type StreakSeg } from './driftStreaks';
import { getTilt, setTilt, type TiltLevel } from './tilt';
import { createTiltScene } from './tiltScene';
import { outlinePoints, WALL_LIP } from './tiltGeom';
import {
  createDrumPen,
  penBegin,
  penCircle,
  penClose,
  penFill,
  penLineTo,
  penMoveTo,
  penOwner,
  penOwnerLineTo,
  penOwnerMoveTo,
  penStroke,
  backCulled,
  createPenTrace,
  penFillTrace,
  penOwnerMatrix,
  penStrokeTrace,
  traceArc,
  traceLine,
  tracePoint,
  traceRay,
  traceReset,
  traceRing,
  type DrumPen,
  type PenAffine,
  type PenTrace,
} from './drumPen';
// G6 tilt-depth: the pseudo 3D volume under and over the entity views while the tilt is on.
import { volumeShapeOf, type VolumeShape } from './volume';
import { createVolumeView } from './volumeView';
// D13 phase C1: cylinder levels draw as a neon drum (drum.ts). Flat levels never touch it.
import { BACK_ALPHA, drumCamBucket, drumCamera, drumProject, projectPhi, drumProjectNodes, drumRectSegsInto, drumULines, fitDrum, followCamU, interpWrap, makeDrum, makeTroughDrum, ringArcs, unwrapNear, type Drum, type DrumPoint } from './drum';
// Trough wave: a trough level draws through the drum's trough projection (no wrap, no turn).
import { parseTroughKnob, polyEdges, rimBuckets, troughRimSegs, troughShadeBands } from './troughGeom';
import {
  backingSize,
  bloomResolution,
  bulletRenderPos,
  fitArena,
  gruntPulse,
  interp,
  parseBloomKnobs,
  renderResolution,
  screenRectInWorld,
  superFired,
  telegraphAlpha,
  type Fit,
  type PlayRect,
  type SuperWatch,
} from './layout';
import { planFx, RIPPLE_KILL_BIG, type FxEvent } from './fx';
import { current, currentRender, palette, type NeonRender, type PaletteKey } from './neon';
import { bindNeon } from './neonApply';
import {
  burst,
  burstFx,
  clearParticles,
  disposeParticles,
  emitBulletTrail,
  emitShipTrail,
  initParticles,
  liveParticleCount,
  resetShipTrail,
  setParticleBounds,
  setParticleStress,
  stepParticles,
  STREAK_TEX_LEN,
} from './particles';
import { addRipple, stepRipples, tracePondGridProjected, traceRippledGrid, type Ripple } from './ripple';
import {
  addPondWave,
  crestAlpha,
  crestWhite,
  devPondDrop,
  DEV_POND_PERIOD,
  parsePondKnob,
  POND_CRESTS,
  pondCrestRadius,
  stepPondWaves,
  type PondWave,
} from './pondWave';
import { addShake, createShake, stepShake } from './shake';
import { buildBloomSourceContext, buildContext, buildGlowSourceContext, contextForSlot, rebuildShapeContexts } from './shapes';
import type { GraphicsContext } from 'pixi.js';
import type { ShapeSpec } from './shapeSpecs';
import { exposedBossSlot, MAX_SLOT, PICKUP_KIND, PICKUP_SPIN, pickupAlpha, specForSlot, visualSlot } from './shapeSpecs';
import {
  ATLAS_CELLS,
  ATLAS_H,
  ATLAS_W,
  BULLET_FRAMES,
  bulletStyleVisual,
  crescentPoints,
  SPIKE_CODE,
  spikePoints,
  spikeVisual,
  PICKUP_BURST_COUNT,
  styleCode,
  visualForCode,
  weaponTint,
  type BulletFrame,
  type BulletStyleVisual,
} from './bulletStyles';
import {
  attachedTrailFor,
  bulletTrailRate,
  dartTrailRate,
  ENEMY_TRAIL_CHARGER,
  ENEMY_TRAIL_DART,
  ENEMY_TRAIL_SWIRL,
  geomTwinkle,
  TAPER_TEX_H,
  TAPER_TEX_LEN,
  taperProfile,
  V1_TRAIL_TEX_LEN,
  type AttachedTrail,
  type Emitter,
} from './trails';
import {
  COMET_VERTS,
  cometAlpha,
  cometIndices,
  cometUvs,
  createComet,
  pushComet,
  resetComet,
  writeCometStrip,
} from './comet';
import {
  addPulse,
  clearPulses,
  createPulsePool,
  PULSE_ARC,
  PULSE_BAR,
  PULSE_FLASH,
  PULSE_RING,
  PULSE_STREAK,
  pulseAlpha,
  pulseLive,
  SHOCK_BIG_MUL,
  SHOCK_LIFE,
  SHOCK_R0,
  SHOCK_R1,
  shockRadius,
  stepPulses,
  STREAK_LIFE,
  WALL_GLOW_LEN,
  WALL_GLOW_LIFE,
  WALL_GLOW_THICK,
  WALL_HIT_RANGE,
} from './pulses';
import { heatBombFor, HEAT_SUPER } from './lattice/heat';
import { AMBIENT_AMP } from './lattice/ambient';
import {
  createHitThrottle,
  DEFLECT_ARC_HALF,
  DEFLECT_ARC_LIFE,
  DEFLECT_ARC_PAD,
  DEFLECT_ARC_R,
  DEFLECT_WHITE,
  arcFrame,
  deflectArcScale,
  deflectDir,
  HIT_DOT_FRAME,
  HIT_DOT_R,
  HIT_FLASH_LIFE,
  HIT_FLASH_WHITE,
  HIT_FX_CAP,
  hitFlashScale,
  hitHueKey,
  hitThrottleAllow,
  resetHitThrottle,
  type Dir,
} from './hitFx';
import {
  dustOn,
  trailsOn,
  getEffectsTier,
  hitFxOn,
  latticeCapFor,
  latticeOn,
  latticeSpacingFor,
  mapEffectsOn,
  onEffectsTierChanged,
  type EffectsTier,
} from './effects';
import { createLatticeView } from './latticeView';
import { chooseSpacing } from './lattice/layout';
import { addForce, addImpulse, addRing, clearForces } from './lattice/sim';
import {
  bombKickFor,
  heatPulseFor,
  KICK_SUPER_PULSE,
  latticeKickFor,
  MAX_WELLS,
  SUPER_FORCE_RADIUS,
  superForceAccel,
  superPulseDue,
  WAKE_RADIUS,
  wakeAccel,
  WELL_PULL_ACCEL,
  wellPullRadius,
} from './lattice/kicks';
import { GAP_MS, initialGovernor, nextGovernor, smoothFrameMs, type GovernorState } from './lattice/governor';
import {
  blinkArrived,
  blinkGhostAlpha,
  blinkRing,
  CHARGER_CHEVRON_GAP,
  CHARGER_CHEVRON_SIZE,
  CHARGER_DASH_TRAIL_RATE,
  CHARGER_LANE_FILL,
  CHARGER_LANE_HALF,
  CHARGER_LANE_LEN,
  chargerChevrons,
  splimeDropRing,
  type SplimeRing,
  chargerDashing,
  chargerLaneAlpha,
  chargerStreak,
  chargerStreakLen,
  mineAlpha,
  SLIME_RADIUS,
  slimeAlpha,
  slimeFresh,
  slimeScale,
  splimeSwell,
  SWIRL_TRAIL_RATE,
  type BlinkRing,
} from './enemyFx';
import {
  clampThreat,
  createWallHit,
  easeThreat,
  FLASH_LIFE,
  flashFade,
  flashStrength,
  MAX_FLASHES,
  mapFxNeonGain,
  mixRgb,
  nearestWall,
  PULSE_WARM_MAX,
  rayWallDistance,
  threatPulse,
  wallFeatures,
  wallPulseAlpha,
  wallTangent,
  type ThreatPulse,
  type WallFeature,
} from './mapFx';
import { burstBoss, burstSmall, emitBlinkStreak, emitDeflectSparks, emitEnemyTrail, emitGeomSparkle, trailsActive } from './particles';
import { bossSlot, DRONE_KIND_NUM, isFloorSlot, KIND_NUM, LEAVER_KIND_NUM, leaverSlot, partSlot, partVisualSlot, specFor } from './shapeSpecs';
import {
  leaverFrameStep,
  leaverSpin,
  SHARD_BAND_MAX_PTS,
  SHARD_GLINT_SIZE,
  SHARD_HOLD_SPIN,
  shardBandCentre,
  shardBandPoly,
  shardCorner,
  shardCornerIndex,
  shardGlintCount,
  shardHueMix,
  shardKey,
  shardPulse,
  shardPulseAlpha,
  shardShimmerKey,
  shardSweepPhase,
} from './leaverLook';
import { SHARD_HOLD_SEC } from '../game/enemies/leaver';
// v31: Brood's split into Broodlings (sim:bossSplit): the green shard burst (bossSplit.ts).
import {
  SPLIT_LIFE_MAX,
  SPLIT_LIFE_MIN,
  SPLIT_RING_MUL,
  SPLIT_HOT_MIX,
  SPLIT_SPEED_MAX,
  SPLIT_SPEED_MIN,
  splitCoord,
  splitHotCount,
  splitKey,
  splitShardCount,
} from './bossSplit';
// V3 wave D: the Prism gem (hue cycle, chromatic ghost, run to white; bossPrism.ts, prismFx.ts).
import {
  BOSS_PRISM,
  createPrismClock,
  prismBodyColour,
  prismCycle,
  prismFlash,
  prismGlowMul,
  prismLodFor,
  prismPhaseKey,
  prismSaturation,
  prismWhite,
} from './bossPrism';
import { createPrismFrame, createPrismLayer, type PrismLayer } from './prismFx';
// V3 wave A: boss, parts, hazards and enemy bullets (bossLook.ts, bossShapes.ts, hazardFx.ts,
// enemyBulletFx.ts). The boss is read through readBoss only; enemy bullets through enemyBulletsOf.
import { createBossView, readBoss, type BossView } from '../game/bosses/view';
import { bossOpen as simBossOpen } from '../game/bosses/core';
import { bossOf } from '../game/bosses/state';
import { enemyBulletsOf } from '../game/enemyBullets';
import { shieldOf, weaponState } from '../game/weapons';
import { Detach, droneArm } from '../game/drones';
import type { DroneMode } from '../core/events';
import {
  decoyPulse,
  decoyTint,
  dronePickupRot,
  DRONE_MODE_LOOKS,
  glyphDots,
  glyphSegments,
  GLYPH_HALF,
  GLYPH_LIFT,
  MODE_RING_R,
  partJitter,
  TEMPESTLING_SWIRL_ARCS,
  TEMPESTLING_SWIRL_LEN,
  TEMPESTLING_SWIRL_R,
  tempestlingLead,
  tempestlingSwirl,
  type DroneGlyph,
} from './partLooks';
import { NOVA_RADIUS, PULL_RADIUS, wellInNova } from '../game/enemies/gravitywell';
import { gs, isHostile, SNAKE_SEGMENTS, SNAKE_SLOTS } from '../game/state';
// GW3: nova snakes keep a white core line and a faint shimmer for their whole life.
import {
  createNovaSnakeState,
  NOVA_SNAKE_CORE_A,
  NOVA_SNAKE_CORE_W,
  NOVA_SNAKE_GLINTS_MAX,
  NOVA_SNAKE_GLOW_W,
  NOVA_SNAKE_TRACK,
  novaSnakeCount,
  novaSnakeGlow,
} from './novaSnake';
import { GLINT_STRIDE, novaSnakeBody, novaSnakeGlints, novaSnakeSync } from './novaSnakeLive';
import { BOSS_IDS } from '../levelgen/leveldef';
import {
  approach,
  BOSS_BROOD,
  BOSS_SPINDLE,
  BOSS_BURST_WHITE,
  BOSS_DEATH_SHAKE_PX,
  BOSS_DEATH_SHAKE_SEC,
  BOSS_OPEN_STEPS,
  BOSS_PHASE_BURST,
  bossBodyAlpha,
  bossColourOf,
  bossDeathBurst,
  bossEdgePulse,
  bossGlowMul,
  bossHitAllow,
  bossIndex,
  bossPhaseFlash,
  bossTierOf,
  tierWeight,
  createBossHitThrottle,
  entranceRing,
  OPEN_RATE,
  opennessStep,
  PHASE_FLASH_SEC,
  podPulse,
  TIER_BULLET_KEY,
  type EntranceRing,
} from './bossLook';
import {
  BOSS_LINE,
  bossBodyR,
  bossCoreFrac,
  EMBER_NOSE,
  isBakedPart,
  isBroodlingPart,
  isTwinPart,
  MIRAGE_SHIELD,
  PART_ANCHOR,
  PART_BROODLING,
  PART_POD,
  PART_TEMPESTLING,
  PART_TURRET,
  partR,
  partType,
} from './bossShapes';
// V3 wave C: tier 3 boss effects (Bastion turret alpha and keep heat, Tempest Slime drips and dash
// afterimage, Twins tether hum and enrage, the wider tier 3 halo on the hazard layer). Render only.
import {
  BASTION_TURRETS,
  BOSS_BASTION,
  BOSS_TEMPEST,
  BOSS_TWINS,
  DASH_GHOSTS,
  DASH_GHOST_SEC,
  bastionCoreHeat,
  bastionGlow,
  dashGhostAlpha,
  dashGhostCount,
  dashGhostDue,
  dashGhostScale,
  dashGhostWhite,
  tempestDashing,
  tempestDripRate,
  tierHalo,
  turretShown,
  turretState,
  twinsEnrageGlow,
} from './bossTier3';
// V3 wave B: tier 2 boss effects (Ember lane and trails, Mirage arc, afterimage and landing flash,
// Gravitas tethers and lattice pull, the Mine pulse). Pure helpers and planners, render only.
import {
  afterimageAlpha,
  afterimageScale,
  BOSS_EMBER,
  BOSS_GRAVITAS,
  BOSS_MIRAGE,
  EMBER_LANE_LEN,
  emberDashing,
  emberFlameRate,
  emberLaneAlpha,
  emberSparkRate,
  GRAVITAS_LATTICE_R,
  gravitasLatticeAccel,
  landingSparks,
  mineGlow,
  minePulse,
  mirageArcOpenness,
  warpJumped,
} from './bossTier2';
import { planAnchorTethers, planEmberLane, planMirageArc, TETHER_ANCHORS_MAX } from './bossTier2Fx';
import {
  ADD_HUE_MIX,
  addGlow,
  addPulse as addAngryPulse,
  addScale,
  advancePhase,
  exposeShake,
  exposeShakePx,
  EXPOSE_HOT_WHITE,
  EXPOSE_SPRITE_CAP,
  EXPOSE_UNKNOWN,
  exposedOpenTarget,
  exposePulse,
  exposePulseHz,
  exposeAlarm,
  flickerRedWhite,
  shellHot,
  FRAG_ORBIT_HZ,
  fragmentCount,
  exposeState,
  onBossExposed,
  planBossExpose,
  resolveExposed,
  stepSpread,
  type ExposeInput,
  type Offset,
} from './bossExpose';
import {
  TURBO_BURST,
  TURBO_RING_LIFE,
  TURBO_RING_R0,
  TURBO_RING_R1,
  TURBO_WHITE,
  turboActivated,
  turboCometAlpha,
  turboGlow,
  turboIntensity,
  turboRate,
  turboWidth,
} from './turboFx';
import { createSpriteBuf, fxHalo, resetSpriteBuf, type FxHalo } from './fxSprites';
import { createFxSpriteLayer, makeBossFxAtlas } from './fxSpriteLayer';
// G3C boss identity (run 0288): Prism window from 'sim:bossWindow', per boss hit flash, cracks from
// 'sim:bossCrack', owner hue attacks, the tier 3 halo and the Twins enrage flare (bossIdentity.ts).
import {
  BOSS_OUTLINES,
  bossAttackKey,
  bossFlashAllow,
  createBossCracks,
  createBossFlashThrottle,
  createBossWindow,
  accentRgb,
  bossAccent,
  bossPartTint,
  crackEvent,
  FRAG_PTS,
  fragmentPts,
  hitFlashAlpha,
  hitSparkCount,
  onBossCrack,
  onBossWindow,
  outlineRadius,
  pieceAlpha,
  pieceDrift,
  pieceSpin,
  PIECE_LIFE,
  PIECES_MAX,
  newArcRange,
  BREAK_SETTLE_SEC,
  resetBossCracks,
  stepBossCracks,
  type AccentPart,
  resetBossWindow,
  stepBossWindow,
  tier3HaloAlpha,
  tier3Pulse,
  TIER3_HALO_WIDTH,
  twinsFlare,
  windowFlash,
  windowRing,
  windowEvent,
  windowWhite,
  type WindowRing,
} from './bossIdentity';
// Look v33: damage by incompleteness (no dark paint), the Ember flame body, the nova colour cycle.
import { DETACH_ARC, damageColours, damagedSpec, EDGE_SPAN, edgeFlicker, STUB_LEN, type DamageColours } from './bossDamage';
import { EMBER_TONGUES, FLAME_BANDS, FLAME_STOP_COUNT, flameAt, flameColour, flameStops, flameTongue, TONGUE_FLOATS } from './emberFlame';
import {
  CALM_BANDS,
  CALM_MOTES,
  CALM_RATE,
  CALM_REACH,
  createNovaState,
  NOVA_HUES,
  NOVA_WHITE,
  novaAny,
  novaCoreFlare,
  novaCycleStops,
  novaEvent,
  novaColour,
  novaGlintSpot,
  novaGrow,
  GALAXY_ARMS,
  GALAXY_SPEED,
  galaxyArmBase,
  galaxyArmUniform,
  galaxyTwinkle,
  novaShift,
  NOVA_GLINT_SIZE,
  NOVA_GLINTS,
  novaSlotFor,
  novaStreamColour,
  novaWhite,
  onWellNova,
  stepNovaState,
  WHIRL_BAND_PTS,
  WHIRL_BANDS,
  WHIRL_DASH_U,
  WHIRL_DASHES,
  WHIRL_MOTES,
  WHIRL_VISUAL,
  WHIRL_SPARKS,
  WHIRL_GAS_LAYERS,
  WHIRL_GAS_PTS,
  WHIRL_WISP_PTS,
  WHIRL_WISPS,
  whirlBand,
  whirlDashU,
  whirlFlowAngle,
  whirlFlowRadius,
  whirlGasAlpha,
  whirlGasSector,
  whirlMote,
  whirlWisp,
  type Mote,
} from './wellNova';
// Look GW2: well arrival ring, snake emergence, the orbit chainsaw and the boss shield shell.
import {
  ARRIVE_DOTS,
  arriveAny,
  arriveDot,
  arriveEvent,
  arriveFlash,
  arriveProgress,
  arriveRadius,
  createArriveState,
  createEmergeState,
  EMERGE_TRAIL,
  emergeAny,
  emergeEvent,
  emergeFlash,
  emergeRing,
  emergeTrack,
  emergeTrailAlpha,
  onWellArrive,
  onWellSpawn,
  stepArrive,
  stepEmerge,
  type DustPoint,
} from './wellArrive';
import {
  nearTooth,
  SAW_SPARK_REACH,
  SAW_BAR_GLOW_W,
  SAW_BAR_LINE_W,
  SAW_CHAIN_MAX,
  sawChain,
  sawChainAlpha,
  sawSparkCount,
  sawTrackGhost,
  SPIKE_GHOST_ALPHA,
  SPIKE_GHOSTS,
  spikeDrawLen,
  spikeHalfWidth,
  spikeStretch,
  spikeTriangle,
  markSpikeMask,
  bulletDrawCode,
  toothTip,
  type SpikePose,
} from './spikeSaw';
// GW4 fluid plus crystal: the nova shader quads, gem glints and the one well reset.
import { createGlint, GLINT_CORE, GLINT_STAR_PTS, glintAt, glintSize, glintStar } from './gemGlint';
import { fluidShaderOn } from './wellFluid';
import { createWellFluidView, type FluidQuadParams } from './wellFluidView';
import { resetWellVisuals } from './wellReset';
import {
  createShellState,
  onBossShield,
  resetShellState,
  SHELL_CORE_DIM,
  SHELL_PAD,
  SHELL_SIDES,
  SHELL_WHITE,
  shellBreath,
  shellHit,
  shellRimPulse,
  shellRot,
  shellShard,
  shellVertex,
  stepShell,
  windowCorePulse,
  windowRingR,
  windowShare,
  type Shard,
} from './bossShell';
import type { ShapePrim } from './shapeSpecs';
import { createEnemyBulletLayer } from './enemyBullets';
import type { EnemyBulletFrame, EnemyBulletsLike } from './enemyBulletFx';
import { HAZARD_LANE, HAZARD_PULL, HAZARD_SPRITE_CAP, planEntranceRing, planHazard, type HazardInput } from './hazardFx';
import { BOSS_PULL_ACCEL, KICK_BOSS_DOWN, KICK_BOSS_PHASE } from './lattice/kicks';
import { HEAT_BOSS } from './lattice/heat';
import { RIPPLE_BOSS } from './fx';

/** Structural view of Forge's BulletPool (03 section 5). Only the fields the renderer reads. */
export interface BulletPoolLike {
  readonly cap: number;
  readonly alive: Uint8Array;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  /** 1 for homing bullets (super). Optional so older pools still match. */
  readonly homing?: Uint8Array;
  /** Weapon style per bullet: 0 spread, 1 rapid, 2 pierce, 3 orbit (docs/10 render contract). */
  readonly style?: Uint8Array;
  /** Previous step positions, used to interpolate orbit blades that Swarm places each step. */
  readonly prevX?: Float32Array;
  readonly prevY?: Float32Array;
  /** GW2: length in u of a style 3 orbit spike along its tangent (BulletPool.spikeLen), 0 otherwise. */
  readonly spikeLen?: Float32Array;
  /** GW3: orbit spike phase (rad round the ship), for the chain order (BulletPool.phase). */
  readonly phase?: Float32Array;
}

/** Structural view of one circle from Thumbs' stickVisuals output, in CSS px. */
export interface StickCircleLike {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  /** 0..1, default 1. Rings use 0.25 and knobs 0.6 per docs/01 section 3. */
  readonly alpha?: number;
  /** Filled knob instead of a ring outline. */
  readonly filled?: boolean;
}

export type GlowPath = 'bloom' | 'fallback';

export interface RenderStats {
  entities: number;
  bullets: number;
  particles: number;
  glowPath: GlowPath;
  /** Lattice nodes and spacing in arena units; 0 on the low tier (v1 grid). */
  latticeNodes: number;
  latticeSpacing: number;
  /** V3: live enemy bullets drawn, and sprite instances in the hazard and enemy bullet layers. */
  enemyBullets: number;
  hazardSprites: number;
  bulletSprites: number;
}

/** Reads the boss into out (readBoss from src/game/bosses/view.ts, or a test or stress stand in). */
export type BossReader = (w: World, out: BossView) => BossView;

export interface GameRenderer {
  readonly app: Application;
  resize(cssW: number, cssH: number, dpr: number): void;
  setArena(def: LevelDef): void;
  draw(w: World, alpha: number): void;
  setBloomEnabled(on: boolean): void; // false selects fallback glow sprites
  // Additive members (Glow W1).
  readonly bloomEnabled: boolean;
  readonly stats: Readonly<RenderStats>;
  /** Safe play rect in CSS px (viewport minus insets and HUD band). Null means full viewport. */
  setPlayRect(rect: PlayRect | null): void;
  /** Explicit bullet source. If unset, draw() reads w.bullets when Forge adds it. */
  setBullets(pool: BulletPoolLike | null): void;
  /** Stick rings and knobs in CSS px, drawn outside bloom. Call each frame or on change. */
  setSticks(circles: readonly StickCircleLike[]): void;
  /** Ring burst, particles and ripple at a point (super activation). Also fired automatically. */
  superFx(x: number, y: number): void;
  /** V3: explicit enemy bullet source. If unset, draw() reads enemyBulletsOf(w). */
  setEnemyBullets(pool: EnemyBulletsLike | null): void;
  /** V3: explicit boss reader (stress proxy). If unset, draw() uses readBoss. */
  setBossReader(reader: BossReader | null): void;
  destroy(): void;
}

const SIM_DT = 1 / 120;
const PARK = -99999;
const GLOW_PAD = 34;
/** Run 0180: lattice heat glow layer alpha at full neon (scaled by mapFxNeonGain). */
const HEAT_GLOW_ALPHA = 0.9;
/** Comet halo alpha relative to the core (both scaled by trailAlpha and cometAlpha). */
const COMET_HALO_ALPHA = 0.85;
/** Share of yellow mixed into the orange comet halo. */
const COMET_HALO_YELLOW = 0.35;
/** Geom sparkle colour: geom green mixed toward white. */
const GEOM_SPARKLE_WHITE = 0.5;
/** Ring frame radius in the fx atlas, texture units: a pulse ring of radius r scales by r / this. */
const FX_RING_R = 56;
/** Render clock step used for trail emission is clamped like the particle step. */
const MAX_FX_DT = 0.05;
/** Resolution of every generated texture (dot, streak, trail, glow and bloom sources). */
const GEN_TEX_RES = 2;
/** Extra filter area around the screen so shake never shows an unbloomed edge strip. */
const SHAKE_PAD_PX = 20;
const RING_SPEED = 1700; // arena units per second
const RING_LIFE = 0.6; // seconds
/** G10: samples per Tempestling swirl arc on the drum (pixi's arc is used off it). */
const STORM_ARC_STEPS = 6;
const MAX_RINGS = 4;
/** Blink arrival and Slime splat flashes live at once. */
const MAX_POPS = 16;
/** A Blink that moved further than this in one sim step jumped: draw it at the landing spot. */
const BLINK_SNAP_U = 60;
/** Slime glow sprite alpha factor: the puddle glows far less than an enemy. */
const SLIME_GLOW_MUL = 0.35;
/** Slime edge squash amplitude and rate, render clock only (a living puddle). */
const SLIME_WOBBLE_AMP = 0.035;
const SLIME_WOBBLE_HZ = 0.6;
/** Slime slow spin, radians per second, direction from hash01(id). */
const SLIME_SPIN = 0.08;
const TAU = Math.PI * 2;

// Kind values used for per kind visual scale; numeric literals avoid importing the const enum.
const KIND_SHIP = 1;
const KIND_GRUNT = 2;
const KIND_DART = 6;
const KIND_GRAVITY_WELL = 9;
const KIND_GEOM = 10;
const WELL_BASE_RADIUS = 24;
const KIND_SNAKE_HEAD = 7;
/** Look GW2: white particles in the snake emergence burst. */
const EMERGE_BURST = 18;

const DEFAULT_ARENA: ArenaDef = {
  shape: 'rect',
  width: 1400,
  height: 900,
  cornerRadius: 0,
  obstacles: [],
  spawnPoint: { x: 0, y: 0 },
};

function isTypedPool(v: object): v is BulletPoolLike {
  const r = v as Partial<Record<keyof BulletPoolLike, unknown>>;
  return (
    typeof r.cap === 'number' &&
    r.alive instanceof Uint8Array &&
    r.x instanceof Float32Array &&
    r.y instanceof Float32Array &&
    r.vx instanceof Float32Array &&
    r.vy instanceof Float32Array
  );
}

/** Reads w.bullets if Forge's World carries the pool, else null. */
function bulletsFromWorld(w: World): BulletPoolLike | null {
  if (!('bullets' in w)) return null;
  const b: unknown = w.bullets;
  return typeof b === 'object' && b !== null && isTypedPool(b) ? b : null;
}

/** False while the ship is dead (respawn delay). */
function shipActive(w: World): boolean {
  return w.ship.active;
}

function viewportSize(host: HTMLElement): { w: number; h: number } {
  const vv = window.visualViewport;
  const w = host.clientWidth || (vv ? vv.width : window.innerWidth);
  const h = host.clientHeight || (vv ? vv.height : window.innerHeight);
  return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
}

interface BulletAtlas {
  /** The whole atlas; the bullet ParticleContainer binds its source. */
  readonly texture: Texture;
  readonly frames: Readonly<Record<BulletFrame, Texture>>;
}

/**
 * Every bullet look in one generated texture (layout in bulletStyles.ts), so all heads share one
 * texture source and one draw call. Drawn white; particles are tinted per style. The dot cell is
 * the v1 bullet dot unchanged.
 */
function makeBulletAtlas(app: Application): BulletAtlas {
  const g = new Graphics();
  const d = ATLAS_CELLS.dot;
  const dx = d.x + d.w / 2;
  const dy = d.y + d.h / 2;
  g.circle(dx, dy, 8).fill({ color: 0xffffff, alpha: 0.18 });
  g.circle(dx, dy, 5.5).fill({ color: 0xffffff, alpha: 0.45 });
  g.circle(dx, dy, 3).fill({ color: 0xffffff, alpha: 1 });
  // Rapid: thin short streak, brightest core toward the nose (+x).
  const r = ATLAS_CELLS.rapid;
  g.roundRect(r.x, r.y, r.w, r.h, r.h / 2).fill({ color: 0xffffff, alpha: 0.2 });
  g.roundRect(r.x + 3, r.y + r.h / 2 - 1.4, r.w - 4, 2.8, 1.4).fill({ color: 0xffffff, alpha: 0.5 });
  g.roundRect(r.x + 8, r.y + r.h / 2 - 0.8, r.w - 9, 1.6, 0.8).fill({ color: 0xffffff, alpha: 1 });
  // Pierce: long bright lance inside a wide soft halo, hot nose.
  const p = ATLAS_CELLS.pierce;
  const pcx = p.x + p.w / 2;
  const pcy = p.y + p.h / 2;
  g.ellipse(pcx, pcy, p.w / 2, p.h / 2).fill({ color: 0xffffff, alpha: 0.13 });
  g.ellipse(pcx, pcy, p.w / 2 - 2, p.h / 2 - 2.5).fill({ color: 0xffffff, alpha: 0.28 });
  g.roundRect(p.x + 3, pcy - 1.6, p.w - 6, 3.2, 1.6).fill({ color: 0xffffff, alpha: 1 });
  g.circle(p.x + p.w * 0.74, pcy, 2.8).fill({ color: 0xffffff, alpha: 1 });
  // Orbit: crescent blade, bulge toward +x, with a soft rim.
  const o = ATLAS_CELLS.orbit;
  const ocx = o.x + o.w / 2;
  const ocy = o.y + o.h / 2;
  const pts = crescentPoints(9, 4, 14);
  for (let i = 0; i < pts.length; i += 2) {
    pts[i] = (pts[i] ?? 0) + ocx + 1;
    pts[i + 1] = (pts[i + 1] ?? 0) + ocy;
  }
  g.poly(pts, true).stroke({ width: 4, color: 0xffffff, alpha: 0.28, join: 'round' });
  g.poly(pts, true).fill({ color: 0xffffff, alpha: 1 });
  // Look v33 spike: a sharp triangle, nose toward +x, with a soft rim.
  const sk = ATLAS_CELLS.spike;
  const spk = spikePoints(14, 5);
  for (let i = 0; i < spk.length; i += 2) {
    spk[i] = (spk[i] ?? 0) + sk.x + sk.w / 2;
    spk[i + 1] = (spk[i + 1] ?? 0) + sk.y + sk.h / 2;
  }
  g.poly(spk, true).stroke({ width: 3, color: 0xffffff, alpha: 0.3, join: 'miter' });
  g.poly(spk, true).fill({ color: 0xffffff, alpha: 1 });
  const texture = app.renderer.generateTexture({
    target: g,
    frame: new Rectangle(0, 0, ATLAS_W, ATLAS_H),
    resolution: GEN_TEX_RES,
    antialias: true,
  });
  g.destroy({ context: true });
  const frames = {} as Record<BulletFrame, Texture>;
  for (const f of BULLET_FRAMES) {
    const c = ATLAS_CELLS[f];
    frames[f] = new Texture({ source: texture.source, frame: new Rectangle(c.x, c.y, c.w, c.h) });
  }
  return { texture, frames };
}

/** Soft horizontal streak for particles, STREAK_TEX_LEN px long, centred. */
function makeStreakTexture(app: Application): Texture {
  const L = STREAK_TEX_LEN;
  const g = new Graphics()
    .roundRect(-L / 2, -4, L, 8, 4)
    .fill({ color: 0xffffff, alpha: 0.22 })
    .roundRect(-L / 2 + 3, -2, L - 6, 4, 2)
    .fill({ color: 0xffffff, alpha: 0.55 })
    .roundRect(-L / 2 + 6, -1, L - 12, 2, 1)
    .fill({ color: 0xffffff, alpha: 1 });
  const tex = app.renderer.generateTexture({ target: g, frame: new Rectangle(-L / 2, -4, L, 8), resolution: GEN_TEX_RES, antialias: true });
  g.destroy({ context: true });
  return tex;
}

interface TrailAtlas {
  /** The whole atlas; the bulletTrails ParticleContainer binds its source. */
  readonly texture: Texture;
  /** v1 trail (low tier): constant thickness, fading in from the left. */
  readonly v1: Texture;
  /** Run 0180 trail (standard, high): a wedge, thin and faint at the tail, wide and hot at the head. */
  readonly taper: Texture;
}

/** Draw a tapered streak (head at the right) of length L and height H with its top left at (x0, y0). */
function drawTaper(g: Graphics, x0: number, y0: number, L: number, H: number, steps: number): void {
  const prof = { haloH: 0, haloA: 0, coreH: 0, coreA: 0 };
  const cy = y0 + H / 2;
  for (let i = 0; i < steps; i++) {
    taperProfile((i + 1) / steps, prof);
    const x = x0 + (i * L) / steps;
    const hh = (H / 2) * prof.haloH;
    const ch = (H / 2) * prof.coreH;
    if (hh > 0.05) g.rect(x, cy - hh, L / steps, 2 * hh).fill({ color: 0xffffff, alpha: prof.haloA });
    g.rect(x, cy - ch, L / steps, 2 * ch).fill({ color: 0xffffff, alpha: prof.coreA });
  }
}

/**
 * Bullet trails, both looks in one texture so every attached trail stays in one ParticleContainer.
 * The v1 frame is the wave B texture unchanged (low keeps its look); the taper frame sits below.
 */
function makeTrailAtlas(app: Application): TrailAtlas {
  const L = V1_TRAIL_TEX_LEN;
  const steps = 16;
  const g = new Graphics();
  for (let i = 0; i < steps; i++) {
    const t = (i + 1) / steps;
    const x = (i * L) / steps;
    g.rect(x, 0, L / steps, 6).fill({ color: 0xffffff, alpha: 0.24 * t });
    g.rect(x, 1.6, L / steps, 2.8).fill({ color: 0xffffff, alpha: 0.95 * t * t });
  }
  const ty = 8;
  drawTaper(g, 0, ty, TAPER_TEX_LEN, TAPER_TEX_H, 32);
  const w = Math.max(L, TAPER_TEX_LEN);
  const h = ty + TAPER_TEX_H;
  const texture = app.renderer.generateTexture({ target: g, frame: new Rectangle(0, 0, w, h), resolution: GEN_TEX_RES, antialias: true });
  g.destroy({ context: true });
  return {
    texture,
    v1: new Texture({ source: texture.source, frame: new Rectangle(0, 0, L, 6) }),
    taper: new Texture({ source: texture.source, frame: new Rectangle(0, ty, TAPER_TEX_LEN, TAPER_TEX_H) }),
  };
}

interface FxAtlas {
  readonly texture: Texture;
  /**
   * Pulse frames by shape: ring (kill shockwave), bar (wall glow), streak (Blink jump), arc
   * (Bulwark deflect, anchored at its midpoint) and dot (tiny hit flash).
   */
  readonly frames: readonly [Texture, Texture, Texture, Texture, Texture];
  /** Anchor of the arc midpoint inside the arc frame (0 to 1). */
  readonly arcAnchorX: number;
}

/** The sprite pulse looks in one texture: one ParticleContainer, one draw call for all pulses. */
function makeFxAtlas(app: Application): FxAtlas {
  const g = new Graphics();
  const R = FX_RING_R;
  const c = R + 8;
  g.circle(c, c, R).stroke({ width: 12, color: 0xffffff, alpha: 0.18 });
  g.circle(c, c, R).stroke({ width: 6, color: 0xffffff, alpha: 0.4 });
  g.circle(c, c, R).stroke({ width: 2.5, color: 0xffffff, alpha: 1 });
  const ringW = 2 * c;
  const bx = ringW + 2;
  g.roundRect(bx, 0, 64, 16, 8).fill({ color: 0xffffff, alpha: 0.3 });
  g.roundRect(bx + 5, 3.5, 54, 9, 4.5).fill({ color: 0xffffff, alpha: 0.6 });
  g.roundRect(bx + 12, 6, 40, 4, 2).fill({ color: 0xffffff, alpha: 1 });
  const sy = 20;
  drawTaper(g, bx, sy, TAPER_TEX_LEN, TAPER_TEX_H, 32);
  // Run 0198 hit feedback: the deflect arc (a slice of the shield circle, same three stroke glow
  // as the ring) and the soft hit dot sit to the right of the bar column.
  const af = arcFrame(DEFLECT_ARC_R, DEFLECT_ARC_HALF, DEFLECT_ARC_PAD);
  const ax = bx + 64 + 2;
  const arcCx = ax + af.cx;
  // After a stroke pixi restarts the path at the last point, so each arc starts with a moveTo at
  // its own start point, or a stray line would join the previous shape to the arc.
  const arcX0 = arcCx + DEFLECT_ARC_R * Math.cos(-DEFLECT_ARC_HALF);
  const arcY0 = af.cy + DEFLECT_ARC_R * Math.sin(-DEFLECT_ARC_HALF);
  const arcPath = (): Graphics => g.moveTo(arcX0, arcY0).arc(arcCx, af.cy, DEFLECT_ARC_R, -DEFLECT_ARC_HALF, DEFLECT_ARC_HALF);
  arcPath().stroke({ width: 12, color: 0xffffff, alpha: 0.2, cap: 'round' });
  arcPath().stroke({ width: 6, color: 0xffffff, alpha: 0.5, cap: 'round' });
  arcPath().stroke({ width: 2.5, color: 0xffffff, alpha: 1, cap: 'round' });
  const dx = ax + af.w + 2;
  const dc = HIT_DOT_FRAME / 2;
  g.circle(dx + dc, dc, HIT_DOT_R).fill({ color: 0xffffff, alpha: 0.22 });
  g.circle(dx + dc, dc, HIT_DOT_R * 0.62).fill({ color: 0xffffff, alpha: 0.5 });
  g.circle(dx + dc, dc, HIT_DOT_R * 0.3).fill({ color: 0xffffff, alpha: 1 });
  const w = dx + HIT_DOT_FRAME;
  const texture = app.renderer.generateTexture({ target: g, frame: new Rectangle(0, 0, w, ringW), resolution: GEN_TEX_RES, antialias: true });
  g.destroy({ context: true });
  const sub = (x: number, y: number, fw: number, fh: number): Texture => new Texture({ source: texture.source, frame: new Rectangle(x, y, fw, fh) });
  return {
    texture,
    frames: [
      sub(0, 0, ringW, ringW),
      sub(bx, 0, 64, 16),
      sub(bx, sy, TAPER_TEX_LEN, TAPER_TEX_H),
      sub(ax, 0, af.w, af.h),
      sub(dx, 0, HIT_DOT_FRAME, HIT_DOT_FRAME),
    ],
    arcAnchorX: af.anchorX,
  };
}

interface CometAtlas {
  readonly texture: Texture;
  /** u along the ribbon (0 head at the left), v across it. A wide soft halo and a hot core. */
  readonly halo: Texture;
  readonly core: Texture;
}

const COMET_TEX_LEN = 64;
const COMET_TEX_H = 16;

/** The comet ribbon looks: alpha falls from the head (left) to the tail (right). */
function makeCometAtlas(app: Application): CometAtlas {
  const g = new Graphics();
  const L = COMET_TEX_LEN;
  const H = COMET_TEX_H;
  const steps = 32;
  for (let i = 0; i < steps; i++) {
    const u = (i + 0.5) / steps;
    const along = Math.pow(1 - u, 1.6);
    const x = (i * L) / steps;
    const w = L / steps;
    g.rect(x, 0, w, H).fill({ color: 0xffffff, alpha: 0.28 * along });
    g.rect(x, H * 0.22, w, H * 0.56).fill({ color: 0xffffff, alpha: 0.45 * along });
    const cy = H + 2;
    g.rect(x, cy + H * 0.3, w, H * 0.4).fill({ color: 0xffffff, alpha: 0.6 * along });
    g.rect(x, cy + H * 0.42, w, H * 0.16).fill({ color: 0xffffff, alpha: Math.pow(along, 0.8) });
  }
  const texture = app.renderer.generateTexture({ target: g, frame: new Rectangle(0, 0, L, 2 * H + 2), resolution: GEN_TEX_RES, antialias: true });
  g.destroy({ context: true });
  return {
    texture,
    halo: new Texture({ source: texture.source, frame: new Rectangle(0, 0, L, H) }),
    core: new Texture({ source: texture.source, frame: new Rectangle(0, H + 2, L, H) }),
  };
}

/** Soft round dot, 8 px across, for the dust motes. */
function makeDotTexture(app: Application): Texture {
  const g = new Graphics()
    .circle(0, 0, 4)
    .fill({ color: 0xffffff, alpha: 0.25 })
    .circle(0, 0, 2.6)
    .fill({ color: 0xffffff, alpha: 0.6 })
    .circle(0, 0, 1.4)
    .fill({ color: 0xffffff, alpha: 1 });
  const tex = app.renderer.generateTexture({ target: g, frame: new Rectangle(-4, -4, 8, 8), resolution: GEN_TEX_RES, antialias: true });
  g.destroy({ context: true });
  return tex;
}

/** WebGL context antialias attribute as the browser granted it, for the boot log. */
function contextAntialias(r: Renderer): string {
  if ('gl' in r) {
    const attrs = r.gl.getContextAttributes();
    return attrs ? String(attrs.antialias) : 'unknown';
  }
  return 'n/a';
}

export async function createRenderer(host: HTMLElement): Promise<GameRenderer> {
  const size = viewportSize(host);
  const dpr = renderResolution(window.devicePixelRatio);
  const app = new Application();
  await app.init({
    width: size.w,
    height: size.h,
    resolution: dpr,
    autoDensity: true,
    // MSAA on the canvas: v8 Graphics strokes have no analytic AA, so without it the arena
    // outline stair steps. Line work sits outside the filter so it keeps this MSAA.
    antialias: true,
    background: 0x000000,
    preference: 'webgl',
    powerPreference: 'high-performance',
    autoStart: false,
  });
  host.appendChild(app.canvas);
  app.stage.eventMode = 'none';

  const world = new Container({ label: 'world' });
  world.interactiveChildren = false;
  // Grid layer: its alpha is applyNeon's gridAlpha (bindNeon below). Holds the v1 grid (low
  // tier) or the wave D lattice and dust (standard and high); neither sets its own base alpha.
  const gridLayer = new Container({ label: 'gridLayer' });
  const grid = new Graphics({ label: 'grid' });
  // Trough wave: the slope shade under the grid (trough levels only, static, every tier).
  const troughShade = new Graphics({ label: 'troughShade' });
  troughShade.visible = false;
  const dotTexture = makeDotTexture(app);
  const lattice = createLatticeView(dotTexture);
  const bloomLayer = new Container({ label: 'bloomLayer' });
  const lines = new Container({ label: 'lines' });
  const walls = new Graphics({ label: 'walls' });
  const wallGlow = new Graphics({ label: 'wallGlow' });
  // D13 phase C1: cylinder obstacles (the rims replace the walls). Obstacles are wide, so they are
  // projected as sampled outlines (drumRectSegs) and redrawn per frame while the camera turns, on
  // cylinder levels with obstacles only: one crisp and one bloom Graphics.
  const drumObs = new Graphics({ label: 'drumObs' });
  const drumObsGlow = new Graphics({ label: 'drumObsGlow' });
  drumObs.visible = false;
  drumObsGlow.visible = false;
  // R2 membrane: the bars draw with the solid obstacles (barrierRects); these two layers carry the
  // red glow where an enemy is passing (crisp and bloom source), redrawn only while any glow lives.
  const membraneG = new Graphics({ label: 'membrane' });
  const membraneGlowG = new Graphics({ label: 'membraneGlow' });
  // R2 drift burst: speed streaks across the drum face (open drums only), crisp and bloom source.
  const streakG = new Graphics({ label: 'driftStreaks' });
  const streakGlowG = new Graphics({ label: 'driftStreaksGlow' });
  const glowSprites = new Container({ label: 'glowSprites' });
  const entities = new Container({ label: 'entities' });
  const atlas = makeBulletAtlas(app);
  const streak = makeStreakTexture(app);
  const trailAtlas = makeTrailAtlas(app);
  const trails = new ParticleContainer({
    label: 'bulletTrails',
    texture: trailAtlas.texture,
    blendMode: 'add',
    dynamicProperties: { position: true, rotation: true, uvs: false, vertex: false, color: false },
  });
  // Run 0180 trails and map effects. Pulses: kill shock rings, bullet wall glows and Blink jump
  // streaks, at most PULSE_CAP sprites from one atlas in one container.
  const fxAtlas = makeFxAtlas(app);
  const pulseLayer = new ParticleContainer({
    label: 'pulses',
    texture: fxAtlas.texture,
    blendMode: 'add',
    dynamicProperties: { position: true, rotation: true, uvs: true, vertex: true, color: true },
  });
  const pulsePool = createPulsePool();
  const pulseItems: Particle[] = [];
  for (let i = 0; i < pulsePool.cap; i++) {
    const p = new Particle({ texture: fxAtlas.frames[0], x: PARK, y: PARK, alpha: 0, anchorX: 0.5, anchorY: 0.5 });
    pulseItems.push(p);
    pulseLayer.addParticle(p);
  }
  // Run 0198 hit feedback: a second, small pool in the same container (same atlas, same draw
  // call), so a burst of hit flashes can never overwrite a kill shockwave ring.
  const hitPool = createPulsePool(HIT_FX_CAP);
  const hitItems: Particle[] = [];
  for (let i = 0; i < hitPool.cap; i++) {
    const p = new Particle({ texture: fxAtlas.frames[4], x: PARK, y: PARK, alpha: 0, anchorX: 0.5, anchorY: 0.5 });
    hitItems.push(p);
    pulseLayer.addParticle(p);
  }
  const hitThrottle = createHitThrottle();
  // Comet: one ribbon geometry, drawn twice (warm halo, white core) from one atlas. Under 100
  // vertices, so pixi batches both into the bloom layer's batch: no extra draw call.
  const cometAtlas = makeCometAtlas(app);
  const comet = createComet();
  const cometGeom = new MeshGeometry({
    positions: new Float32Array(COMET_VERTS * 2),
    uvs: cometUvs(),
    indices: cometIndices(),
  });
  const cometPositions = cometGeom.positions;
  const cometHalo = new Mesh({ geometry: cometGeom, texture: cometAtlas.halo, label: 'cometHalo' });
  const cometCore = new Mesh({ geometry: cometGeom, texture: cometAtlas.core, label: 'cometCore' });
  cometHalo.blendMode = 'add';
  cometCore.blendMode = 'add';
  cometHalo.visible = false;
  cometCore.visible = false;
  const comets = new Container({ label: 'comet' });
  comets.addChild(cometHalo, cometCore);
  // Bullet heads: one container, one atlas, one draw call. Rotation is dynamic because streaks
  // follow their velocity and orbit blades turn with the ship; frame, anchor, scale and tint are
  // static and re-uploaded only when a slot changes style (update() below).
  const bullets = new ParticleContainer({
    label: 'bullets',
    texture: atlas.texture,
    blendMode: 'add',
    dynamicProperties: { position: true, rotation: true, uvs: false, vertex: false, color: false },
  });
  const particles = new ParticleContainer({
    label: 'particles',
    texture: streak,
    blendMode: 'add',
    dynamicProperties: { position: true, rotation: true, uvs: false, vertex: true, color: true },
  });
  const rings = new Graphics({ label: 'rings' });
  const ringGlow = new Graphics({ label: 'ringGlow' });
  const sticks = new Graphics({ label: 'sticks' });
  // v2 wave C layers. The wall pulse geometry is drawn once in white per arena or neon change and
  // driven per frame by alpha and tint only; the others redraw only while they hold content.
  const floor = new Container({ label: 'floor' });
  const enemyFx = new Graphics({ label: 'enemyFx' });
  const enemyFxGlow = new Graphics({ label: 'enemyFxGlow' });
  const wallPulse = new Graphics({ label: 'wallPulse' });
  const wallFlash = new Graphics({ label: 'wallFlash' });
  wallPulse.visible = false;
  wallFlash.visible = false;

  // V3 wave A: boss hazards (lanes, rings, sweeps, tethers, pulls and the entrance ring) and enemy
  // bullets, each one pooled ParticleContainer from one atlas: one draw call each, no Graphics.clear.
  // Hazards sit under the entities, enemy bullets above the player bullets so they always read.
  const bossAtlas = makeBossFxAtlas(app.renderer);
  const hazardLayer = createFxSpriteLayer('bossHazards', bossAtlas.texture, bossAtlas.frames, HAZARD_SPRITE_CAP);
  const hazardBuf = createSpriteBuf(HAZARD_SPRITE_CAP);
  const enemyBulletLayer = createEnemyBulletLayer(bossAtlas.texture, bossAtlas.frames);
  // G3A, ED1: the boss weak point cue (the broken hot core fragments) sits over the entities, so
  // it reads on top of the boss body. Same atlas, one small pooled layer, hidden when empty.
  const cueLayer = createFxSpriteLayer('bossCue', bossAtlas.texture, bossAtlas.frames, EXPOSE_SPRITE_CAP);
  const cueBuf = createSpriteBuf(EXPOSE_SPRITE_CAP);

  bloomLayer.addChild(lattice.glow, wallGlow, drumObsGlow, membraneGlowG, streakGlowG, wallPulse, wallFlash, comets, glowSprites, particles, trails, pulseLayer, enemyFxGlow, ringGlow);
  lines.addChild(walls, drumObs, membraneG, streakG, floor, hazardLayer.container, enemyFx, entities, cueLayer.container, bullets, enemyBulletLayer.layer.container, rings);
  gridLayer.addChild(lattice.dust, troughShade, grid, lattice.lines);
  world.addChild(gridLayer, bloomLayer, lines);
  app.stage.addChild(world, sticks);
  initParticles(particles, streak);

  const knobs = parseBloomKnobs(window.location.search);
  const tiltKnob = parseTiltKnob(window.location.search);
  if (tiltKnob !== null) setTilt(tiltKnob);
  const bloom = new AdvancedBloomFilter({
    threshold: currentRender.bloomThreshold,
    bloomScale: currentRender.bloomStrength,
    brightness: 1,
    blur: knobs.blur,
    quality: knobs.quality,
  });
  bloom.resolution = bloomResolution(dpr, knobs.resolution);
  bloom.antialias = 'off'; // soft content only; MSAA here would cost fill rate for nothing

  let cssW = size.w;
  let cssH = size.h;
  let playRect: PlayRect | null = null;
  let arena: ArenaDef = DEFAULT_ARENA;
  // Tilt: the level last applied and its camera for the current arena (off: cam.on is false).
  let tiltLevel: TiltLevel = 'off';
  let cam: Camera = cameraFor(tiltLevel, arena.height);
  // D13 phase C1: the drum of a cylinder level (null on flat levels), the u period for render
  // interpolation (0 flat), the static rim and ring arcs, the low tier u lines and the comet's
  // unwrapped u (its history never jumps across the seam).
  let drum: Drum | null = null;
  let wrapW = 0;
  let drumSnap = true;
  let drumRims: DrumArcs[] = [];
  let drumRings: DrumArcs[] = [];
  const drumUFront: number[] = [];
  // Trough wave: the projected low tier grid segments (static per arena, tilt and fit), sorted
  // into rim height buckets (glow trough-depth), and the outline the same way.
  const troughSegs: number[][] = rimBuckets();
  let troughWallSegs: number[][] = rimBuckets();
  const drumUBack: number[] = [];
  const drumObsFront: number[] = [];
  const drumObsBack: number[] = [];
  let drumObsCrisp: WallPass[] = [];
  let drumObsSoft: WallPass[] = [];
  // G10 perf: camera u buckets of the last obstacle and low tier grid build (NaN forces a rebuild).
  let drumObsKey = Number.NaN;
  let drumGridKey = Number.NaN;
  const obsStroke = { width: 1, color: 0xffffff, alpha: 1, cap: 'round' as const, join: 'round' as const };
  let cometU = 0;
  let cometUPrimed = false;
  /** Render interpolation of an x (u) coordinate: the short way across the seam on a cylinder. */
  const ix = (prev: number, cur: number, a: number): number => (wrapW > 0 ? interpWrap(prev, cur, a, wrapW) : interp(prev, cur, a));
  let fit: Fit = fitArena(arena.width, arena.height, { x: 0, y: 0, w: cssW, h: cssH });
  let bloomOn = true;
  let explicitBullets: BulletPoolLike | null = null;
  let lastDraw = 0;

  const stats: RenderStats = {
    entities: 0,
    bullets: 0,
    particles: 0,
    glowPath: 'bloom',
    latticeNodes: 0,
    latticeSpacing: 0,
    enemyBullets: 0,
    hazardSprites: 0,
    bulletSprites: 0,
  };

  // V3 boss render state. The view is filled once per frame by the boss reader (no allocation).
  const bossView: BossView = createBossView();
  let bossReader: BossReader = readBoss;
  let explicitEnemyBullets: EnemyBulletsLike | null = null;
  /** Displayed shell or core openness (eased), boss index and tier of the live or last boss. */
  let bossOpen = 0;
  let bossIdx = 0;
  let bossTier = 1;
  /** Drawn boss position (event payloads without a position use it). */
  let bossDrawX = 0;
  let bossDrawY = 0;
  /** Seconds since the last boss hit flash, phase event and entrance (edge pulse). */
  let bossHitAge = Number.POSITIVE_INFINITY;
  let bossPhaseAge = Number.POSITIVE_INFINITY;
  let bossEdgeAge = Number.POSITIVE_INFINITY;
  let bossEdgeKey: PaletteKey = 'bossBlue';
  const bossHitThrottle = createBossHitThrottle();
  // G3C identity state. The window, the per boss flash throttle and age, the crack state, two
  // broken pieces (world space), the drawn body transforms (boss plus up to two Twins bodies), and
  // two Graphics: the tier 3 halo under the bodies, the flash, cracks, ring and pieces over them.
  const bossWin = createBossWindow();
  const bossFlashT = createBossFlashThrottle();
  let bossFlashAge = Number.POSITIVE_INFINITY;
  let bossSparkSeq = 0;
  const bossCracks = createBossCracks();
  // v33: outline fragments, one per removed arc, each a polyline (world units, relative to its
  // centre, already rotated into the world) that drifts out, tumbles and fades in the boss colours.
  const PIECES = PIECES_MAX;
  const pieceAge = new Float64Array(PIECES).fill(Number.POSITIVE_INFINITY);
  const pieceX = new Float64Array(PIECES);
  const pieceY = new Float64Array(PIECES);
  const pieceDx = new Float64Array(PIECES);
  const pieceDy = new Float64Array(PIECES);
  const pieceSpinDir = new Int8Array(PIECES);
  const piecePts = new Float32Array(PIECES * FRAG_PTS * 2);
  const fragScratch = new Float32Array(FRAG_PTS * 2);
  const fragCentre = new Float32Array(2);
  // Two tone scratch (Spindle axis, Tempest tail) and the whirlpool band buffer.
  const accentPts = new Float32Array(12);
  const novaArm = new Float32Array(WHIRL_BAND_PTS * 2);
  const novaMote: Mote = { x: 0, y: 0, u: 0, a: 0 };
  // Mote scratch for the brightness buckets: x, y, alpha per mote (no per frame allocation).
  const motePts = new Float32Array(WHIRL_MOTES * 3);
  // GW3 fluid scratch: one gas sector outline and one wisp polyline.
  const gasPts = new Float32Array(WHIRL_GAS_PTS * 4);
  const wispPts = new Float32Array(WHIRL_WISP_PTS * 2);
  const nova = createNovaState();
  const novaG = new Graphics({ label: 'wellNova' });
  // GW3 Tempestling overlay (fast swirl, bright leading edge): drawn positions this frame, one Graphics.
  const STORM_MAX = 4;
  const stormX = new Float64Array(STORM_MAX);
  const stormY = new Float64Array(STORM_MAX);
  const stormR = new Float64Array(STORM_MAX);
  const stormLead = new Float64Array(STORM_MAX);
  const stormH = new Float64Array(STORM_MAX);
  const stormA = new Float64Array(STORM_MAX);
  let stormCount = 0;
  let stormShown = false;
  // R6 shard shimmer overlay: drawn shard positions, turns, phases and alphas this frame, one Graphics.
  const SHARD_MAX = 48;
  const shardX = new Float64Array(SHARD_MAX);
  const shardY = new Float64Array(SHARD_MAX);
  const shardRot = new Float64Array(SHARD_MAX);
  const shardScale = new Float64Array(SHARD_MAX);
  const shardH = new Float64Array(SHARD_MAX);
  const shardA = new Float64Array(SHARD_MAX);
  const shardTint = new Int32Array(SHARD_MAX);
  const shardId = new Int32Array(SHARD_MAX);
  let shardCount = 0;
  let shardShown = false;
  const shardBand = new Float32Array(SHARD_BAND_MAX_PTS * 2);
  const shardPt = { x: 0, y: 0 };
  // GW3 nova snakes: tracked heads and one body polyline scratch (head plus segments).
  const novaSnakes = createNovaSnakeState();
  const snakePts = new Float32Array((SNAKE_SEGMENTS + 1) * 2);
  // G6 item j: one snake's glint draw list (novaSnakeLive.ts) and the layer it paints on, over the
  // entity views so no later created body view can cover a glint.
  const snakeGlints = new Float32Array(NOVA_SNAKE_GLINTS_MAX * GLINT_STRIDE);
  const snakeG = new Graphics({ label: 'novaSnakeGlints' });
  // G9 drum attachment pens (drumPen.ts): the well layer, the snake glints and the chainsaw.
  const wellPen = createDrumPen();
  const snakePen = createDrumPen();
  const sawPen = createDrumPen();
  // G10 drum lines: every remaining free form layer draws through the drum the same way. Lines on
  // the surface (Charger lanes, chevrons and streaks, shock rings, wall flashes) are sampled every
  // DRUM_SAMPLE_U and projected per sample; marks round one entity (pops, Blink and Slime rings,
  // drone glyphs, Tempestling arcs) attach to that owner; the boss identity layers follow the boss.
  const fxPen = createDrumPen();
  const fxGlowPen = createDrumPen();
  const ringPen = createDrumPen();
  const ringGlowPen = createDrumPen();
  const flashPen = createDrumPen();
  const dronePen = createDrumPen();
  const stormPen = createDrumPen();
  const bossPen = createDrumPen();
  const bossAff: PenAffine = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
  let bossAttached = false;
  const bossMatrix = new Matrix();
  const fxTrace: PenTrace = createPenTrace(64);
  let snakeShown = false;
  const stormG = new Graphics({ label: 'tempestling' });
  const shardG = new Graphics({ label: 'shardShimmer' });
  const shardPen = createDrumPen();
  // Look GW2: well arrival and snake emergence state, the chainsaw layer and the boss shell.
  const arrive = createArriveState();
  const emerge = createEmergeState();
  const wellVisuals = { nova, arrive, emerge, snakes: novaSnakes };
  const dustPt: DustPoint = { x: 0, y: 0, a: 0 };
  const sawG = new Graphics({ label: 'spikeSaw' });
  let sawShown = false;
  const sawTri = new Float32Array(6);
  // GW4 saw scratch: the white tip triangle and a motion blur ghost pose.
  const sawTip = new Float32Array(6);
  const sawGhost: SpikePose = { x: 0, y: 0 };
  // GW4: the nova shader quads (Standard and High), their per frame parameters, and glint scratch.
  const fluid = createWellFluidView();
  const fluidP: FluidQuadParams = {
    x: 0,
    y: 0,
    reach: 1,
    timeSec: 0,
    spin: 1,
    seed: 0,
    alpha: 1,
    core: 1,
    glow: 1,
    white: NOVA_WHITE,
    hue0: 0xffffff,
    hue1: 0xffffff,
    hue2: 0xffffff,
    hue3: 0xffffff,
    arm: 0,
  };
  const glint = createGlint();
  const glintPts = new Float32Array(GLINT_STAR_PTS * 2);
  const glintPt = { x: 0, y: 0 };
  // GW3 chain line scratch: per ring (2) the teeth positions and phases, the sort order and counts.
  const chainX = new Float32Array(SAW_CHAIN_MAX * 2);
  const chainY = new Float32Array(SAW_CHAIN_MAX * 2);
  const chainRingPh = new Float32Array(SAW_CHAIN_MAX * 2);
  const chainPh = new Float32Array(SAW_CHAIN_MAX);
  const chainOrder = new Int32Array(SAW_CHAIN_MAX);
  const chainN = new Int32Array(2);
  let sawLevel = 0;
  let sawTint = 0xffffff;
  let sawSparkSeq = 0;
  const shell = createShellState();
  const shellPt = new Float32Array(2);
  const shard: Shard = { x0: 0, y0: 0, x1: 0, y1: 0, a: 0 };
  let shellDropRot = 0;
  lines.addChildAt(sawG, lines.getChildIndex(bullets) + 1);
  lines.addChildAt(fluid.layer, lines.getChildIndex(entities));
  // G6 tilt-depth: side faces under the entity views, highlights over them (projected already, so
  // they are not in the tilt scene pass). Hidden and never drawn while the tilt is off.
  const volume = createVolumeView();
  lines.addChildAt(volume.under, lines.getChildIndex(entities));
  lines.addChildAt(volume.over, lines.getChildIndex(entities) + 1);
  /** Volume outline per visual slot, made on first sight (undefined: not made yet, null: none). */
  const volumeShapes: (VolumeShape | null | undefined)[] = [];
  let volumeOn = false;
  function volumeShapeFor(slot: number): VolumeShape | null {
    let v = volumeShapes[slot];
    if (v === undefined) {
      v = volumeShapeOf(specForSlot(slot), slot === KIND_GRAVITY_WELL);
      volumeShapes[slot] = v;
    }
    return v;
  }
  // Look v33: drone mode glyph over the drone and the thin mode ring round the ship, one Graphics
  // rebuilt only while a drone mode is armed. Buzz scratch and the drawn drone and ship positions.
  const droneFx = new Graphics({ label: 'droneMode' });
  let droneFxShown = false;
  let droneDecoyOut = false;
  let droneDrawX = 0;
  let droneDrawY = 0;
  let droneDrawn = false;
  let twinDrawX = 0;
  let twinDrawY = 0;
  let twinDrawn = false;
  let shipDrawX = 0;
  let shipDrawY = 0;
  let shipDrawn = false;
  const partJit = { x: 0, y: 0 };
  let novaShown = false;
  const winRing: WindowRing = { r: 0, alpha: 0, width: 0 };
  const BODIES = 3;
  const bodyX = new Float64Array(BODIES);
  const bodyY = new Float64Array(BODIES);
  const bodyRot = new Float64Array(BODIES);
  const bodyScale = new Float64Array(BODIES);
  let bodyCount = 1;
  let bossSeen = false;
  const bossUnder = new Graphics({ label: 'bossUnder' });
  const bossOver = new Graphics({ label: 'bossOver' });
  // Wave V3-G tilt pass: what gets projected between drawing and app.render() (tiltScene.ts). The
  // lattice projects its own nodes, the walls and v1 grid are redrawn projected, the HUD and the
  // sticks (on the stage, outside world) are never projected.
  const tiltScene = createTiltScene({
    billboardParents: [entities, floor, glowSprites, fluid.layer],
    particles: [
      { layer: bullets, scale: false },
      { layer: trails, scale: false },
      { layer: particles, scale: true },
      { layer: pulseLayer, scale: true },
      { layer: lattice.dust, scale: false },
      { layer: hazardLayer.container, scale: true },
      { layer: cueLayer.container, scale: true },
      { layer: enemyBulletLayer.layer.container, scale: true },
    ],
    freeform: [rings, ringGlow, enemyFx, enemyFxGlow, wallFlash, sawG, novaG, snakeG, stormG, shardG, droneFx, bossUnder, bossOver],
    // G9 and G10: every free form layer draws through the drum itself (drumPen.ts), owner by owner
    // or sample by sample, so the drum pass never linearises one. The tilt pass still projects them.
    drumDrawn: [sawG, novaG, snakeG, rings, ringGlow, enemyFx, enemyFxGlow, wallFlash, stormG, shardG, droneFx, bossUnder, bossOver],
  });
  // Look v33: the damaged boss body. A copy of the body context with the removed arcs cut out of
  // the geometry (bossDamage.ts damagedSpec), and its glow texture, rebuilt only when the slot, the
  // stage or the neon settings change. Keyed by slot x 3 + stage.
  let dmgCtx: GraphicsContext | null = null;
  let dmgTex: Texture | null = null;
  let dmgKey = -1;
  let dmgTexKey = -1;
  let levelSeed = 0;
  const dmgCol: DamageColours = { edge: 0xffffff, stub: 0xffffff, frag: 0xffffff };
  const DAMAGE_ACCENT_PARTS: readonly AccentPart[] = ['core', 'rim', 'tips', 'axis', 'tail', 'turrets', 'pods', 'sparks', 'split', 'centre', 'coreA', 'coreB'];
  // Look v32 scratch: Ember flame tongues and stop colours, the nova cycle stops (no per frame allocation).
  const flamePts = new Float32Array(EMBER_TONGUES * TONGUE_FLOATS);
  const flameRgb = new Uint32Array(FLAME_STOP_COUNT);
  const novaStops = new Uint32Array(NOVA_HUES);
  /** Sim clock (w.time) of the frame, driving the Ember flame motion. */
  let flameTime = 0;
  let bossOverShown = false;
  /** G3A weak point cue: 'sim:bossExposed' state (EXPOSE_UNKNOWN until the event arrives). */
  let exposeEvent = EXPOSE_UNKNOWN;
  /** Resolved exposure this frame, seconds since it began, and the pulse phase in cycles. */
  let exposed = false;
  let exposeAge = 0;
  let exposePhase = 0;
  const exposeIn: ExposeInput = { x: 0, y: 0, coreR: 0, pulse: 0, spread: 0, orbit: 0, count: 3, alpha: 0, hot: 0xffffff };
  /**
   * ED1 cue: fragment spread (0 assembled, 1 out) and orbit phase in cycles; the boss shake offset in
   * arena units (render only, never the sim position); the boss whose exposed shells are prewarmed.
   */
  let exposeSpread = 0;
  let exposeOrbit = 0;
  const bossShake: Offset = { x: 0, y: 0 };
  let prewarmedBoss = -1;
  /** Boss add ids this frame (spawnAdd), copied from the boss state so the entity pass can mark them. */
  const addIds = new Int32Array(16).fill(-1);
  let addCount = 0;
  /** G3A Turbo: intensity this frame (0 off) and the last super seen, for the activation burst. */
  let turboK = 0;
  let turboPrevActive: string | null = null;
  let turboPrevTimer = 0;
  const entrance: EntranceRing = { r: 0, alpha: 0 };
  // V3 wave B tier 2 state. Drawn boss facing and scale; the last drawn position (NaN when none) for
  // the warp test; the Ember lane and drawn speed; lane hazards seen this frame (a sim lane replaces
  // the render lane); the Mirage afterimage spot, age and slot; anchor positions this frame and the
  // anchor count of the last frame (the lattice pull reads it before the parts are drawn).
  let bossDrawRot = 0;
  let bossDrawScale = 1;
  // V3 wave D Prism: the pooled gem layer (made on first use), its cycle clock and frame, whether it
  // drew this frame, and the glow sprite tint and boost it hands the entity pass.
  let prismLayer: PrismLayer | null = null;
  let prismDrawn = false;
  let prismGlowTint = 0xffffff;
  let prismGlow = 1;
  const prismClock = createPrismClock();
  const prismFrame = createPrismFrame();
  let bossLastX = Number.NaN;
  let bossLastY = Number.NaN;
  let bossSpeed = 0;
  let laneHazards = 0;
  let ghostX = 0;
  let ghostY = 0;
  let ghostRot = 0;
  let ghostScale = 1;
  let ghostAge = Number.POSITIVE_INFINITY;
  let ghostSlot = -1;
  let ghostView: Graphics | null = null;
  const anchorX = new Float32Array(TETHER_ANCHORS_MAX);
  const anchorY = new Float32Array(TETHER_ANCHORS_MAX);
  let anchorCount = 0;
  let anchorsLast = 3;
  const emberFlameEm: Emitter = { acc: 0 };
  const emberSparkEm: Emitter = { acc: 0 };
  // V3 wave C tier 3 state. The boss layer halo (tier widened), the live turret count of this frame
  // and of the last, the most turrets seen this fight, the Tempest drip emitter, the distance dashed
  // since the last ghost and a fixed pool of dash ghosts (views share the exposed boss context).
  const haloBoss: FxHalo = { alpha: 0, width: 0 };
  let turretCount = 0;
  let turretsLast = 0;
  let turretsSeen = 0;
  const tempestDripEm: Emitter = { acc: 0 };
  let dashDist = 0;
  let dashCursor = 0;
  const dashGhosts: { x: number; y: number; rot: number; scale: number; age: number; slot: number; view: Graphics | null }[] = [];
  for (let i = 0; i < DASH_GHOSTS; i++) dashGhosts.push({ x: 0, y: 0, rot: 0, scale: 1, age: DASH_GHOST_SEC, slot: -1, view: null });
  let partPeak = new Float32Array(0);
  const halo: FxHalo = { alpha: 0, width: 0 };
  const hazardIn: HazardInput = { type: 0, x: 0, y: 0, rot: 0, radius: 0, vx: 0, vy: 0, age: 0, tier: 1, tint: 0xffffff, timeSec: 0 };
  const bulletTints: number[] = [0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff];
  const bulletFrame: EnemyBulletFrame = { alpha: 0, timeSec: 0, effects: 'standard', halo, tints: bulletTints, white: 0xffffff };

  // Lattice (wave D): on when the tier says so; the governor only coarsens inside a level.
  let latticeActive = false;
  let gov: GovernorState = initialGovernor();
  let govNotchBuilt = 0;
  let avgFrameMs = 0;
  let wellsSeen = 0;

  // Entity view pool indexed by entity id. Kind and tint caches avoid redundant setter calls.
  let views: (Graphics | null)[] = [];
  let glowViews: (Sprite | null)[] = [];
  let viewKind = new Int16Array(0);
  let viewTint = new Int32Array(0);
  let glowKind = new Int16Array(0);

  // Per kind sprite textures (slot 0 is the unknown magenta circle): blurred glow for the
  // fallback path, sharp thick core lines as the bloom source on the bloom path.
  // Indexed by visual slot (shapeSpecs.ts), so each weapon pickup variant has its own texture.
  const emptyTextures = (): (Texture | null)[] => new Array<Texture | null>(MAX_SLOT + 1).fill(null);
  let glowTextures = emptyTextures();
  let bloomTextures = emptyTextures();
  let glowTexturesDirty = false;

  // Bullet particles, one head and one attached trail per bullet slot, parked when dead.
  const bulletItems: Particle[] = [];
  const trailItems: Particle[] = [];
  /** Particle trail emitter per bullet slot (styles 1 and 2). */
  const bulletEmitters: Emitter[] = [];
  /** styleCode shown per bullet slot, -1 unknown, so frame, tint and trail change once. */
  let bulletCodeShown = new Int8Array(0);
  /** Scratch for attachedTrailFor (no allocation per restyle). */
  const trailShape: AttachedTrail = { len: 0, thick: 0, taper: false };

  // Run 0180: last drawn position per entity slot (Blink jump streak), NaN until seen.
  let lastDrawX = new Float32Array(0);
  let lastDrawY = new Float32Array(0);
  /** Timed super running (sustained lattice distortion), and the render time of the last frame. */
  let superOn = false;
  let lastFxSec = Number.NaN;
  /** Shared wall hit scratch for bullet wall glows. */
  const bulletHit = createWallHit();
  /** True while any pulse sprite may still be on screen. */
  let pulsesShown = false;
  /** True while any hit flash or deflect arc sprite may still be on screen. */
  let hitShown = false;
  /** Draw clock (ms) for the per entity hit throttle, and the world the last frame drew. */
  let hitClockMs = 0;
  let hitWorld: World | null = null;
  const hitDir: Dir = { x: 1, y: 0 };
  let hitSeq = 0;
  /** Geom sparkle colour for this frame (palette follows neon). */
  let sparkleColour = 0xffffff;

  // Grid segments cached per arena; the ripple redraw traces them without allocating.
  let gridSegs: number[] = [];

  // Super activation watch (no fx:super event exists yet, see hand-off).
  const superPrev: SuperWatch = { active: null, timer: 0, droneAbsent: 0 };
  const superCur: SuperWatch = { active: null, timer: 0, droneAbsent: 0 };
  let superWorld: World | null = null;

  // Effects state: shake offset in CSS px, grid ripples and bomb rings in arena units.
  const shake = createShake();
  const shakeOff = { x: 0, y: 0 };
  const ripples: Ripple[] = [];
  let gridRippling = false;
  // T4 pond ripples (a super nova well destroyed): live waves, aged on the sim clock so a pause freezes them.
  const pondWaves: PondWave[] = [];
  lattice.setPond(pondWaves);
  /** Sim clock at the last draw, -1 before the first. */
  let pondSimTime = -1;
  /** Dev only (?dev=1&pond=1): sim time of the next hand fired drop, and its count. */
  const devPond = parsePondKnob(window.location.search);
  /** Dev only (?dev=1&trough=1): draw every non cylinder level as a trough (render only). */
  const devTrough = parseTroughKnob(window.location.search);
  let devPondAt = 1;
  let devPondN = 0;
  const ringList: { x: number; y: number; age: number; colour: PaletteKey }[] = [];
  // Old shape contexts are freed after the next render, once no view batches from them.
  let retiredContexts: GraphicsContext[] = [];
  /** Look v33: damaged boss glow textures replaced this frame, destroyed at the next draw. */
  let retiredTextures: Texture[] = [];

  // v2 wave C enemy fx state, per entity slot: last drawn w.t (NaN until seen; the Blink arrival
  // and Slime splat edges read it) and a trail emitter (Swirl, Charger dash).
  let enemyPhase = new Float32Array(0);
  const enemyEmitters: Emitter[] = [];
  let enemyFxDirty = false;
  const ringScratch: BlinkRing = { r: 0, alpha: 0 };
  const splimeRingScratch: SplimeRing = { r: 0, alpha: 0 };
  // Arrival and splat flashes: a fixed ring of expanding circles, no allocation per event.
  const pops: { x: number; y: number; age: number; life: number; r0: number; r1: number; colour: PaletteKey }[] = [];
  for (let i = 0; i < MAX_POPS; i++) pops.push({ x: 0, y: 0, age: 1, life: 0, r0: 0, r1: 0, colour: 'white' });
  let popCursor = 0;

  // Map effects: wall features per arena, eased threat, pulse phase, wall flashes.
  let features: WallFeature[] = [];
  let threatTarget = 0;
  let threatShown = 0;
  let pulsePhase = 0;
  const pulse: ThreatPulse = { amp: 0, hz: 0 };
  const hit = createWallHit();
  const flashes: { feature: number; s0: number; s1: number; age: number; strength: number }[] = [];
  for (let i = 0; i < MAX_FLASHES; i++) flashes.push({ feature: -1, s0: 0, s1: 0, age: FLASH_LIFE, strength: 0 });
  let flashCursor = 0;
  let flashDirty = false;

  function growPools(cap: number): void {
    if (views.length >= cap) return;
    const oldLen = views.length;
    views = views.concat(new Array<Graphics | null>(cap - oldLen).fill(null));
    glowViews = glowViews.concat(new Array<Sprite | null>(cap - oldLen).fill(null));
    const nk = new Int16Array(cap).fill(-1);
    nk.set(viewKind);
    viewKind = nk;
    const nt = new Int32Array(cap).fill(-1);
    nt.set(viewTint);
    viewTint = nt;
    const ng = new Int16Array(cap).fill(-1);
    ng.set(glowKind);
    glowKind = ng;
    const np = new Float32Array(cap).fill(Number.NaN);
    np.set(enemyPhase);
    enemyPhase = np;
    const pp = new Float32Array(cap);
    pp.set(partPeak);
    partPeak = pp;
    const lx = new Float32Array(cap).fill(Number.NaN);
    lx.set(lastDrawX);
    lastDrawX = lx;
    const ly = new Float32Array(cap).fill(Number.NaN);
    ly.set(lastDrawY);
    lastDrawY = ly;
    while (enemyEmitters.length < cap) enemyEmitters.push({ acc: 0 });
  }

  /** Write one style onto a slot's head and attached trail (static properties). */
  function styleSlot(i: number, v: BulletStyleVisual): void {
    const item = bulletItems[i];
    const tail = trailItems[i];
    if (!item || !tail) return;
    const tint = palette[v.tint];
    item.texture = atlas.frames[v.frame];
    item.anchorX = v.anchorX;
    item.scaleX = item.scaleY = v.scale;
    item.tint = tint;
    tail.tint = tint;
    tail.alpha = currentRender.trailAlpha;
    // Run 0180: standard and high draw the longer tapered trail; low keeps the v1 frame and size.
    const at = attachedTrailFor(v, getEffectsTier(), trailShape);
    tail.texture = at.taper ? trailAtlas.taper : trailAtlas.v1;
    tail.scaleX = at.len / (at.taper ? TAPER_TEX_LEN : V1_TRAIL_TEX_LEN);
    tail.scaleY = at.thick;
  }

  /** Restyle every bullet slot (palette, neon or tier change) and flag both containers. */
  function restyleBullets(): void {
    for (let i = 0; i < bulletItems.length; i++) {
      styleSlot(i, visualForCode(bulletCodeShown[i] ?? -1));
    }
    bullets.update();
    trails.update();
  }

  function ensureBulletItems(cap: number): void {
    const spread = bulletStyleVisual(0, false);
    while (bulletItems.length < cap) {
      const p = new Particle({ texture: atlas.frames.dot, x: PARK, y: PARK, anchorX: 0.5, anchorY: 0.5 });
      bulletItems.push(p);
      bullets.addParticle(p);
      const t = new Particle({ texture: trailAtlas.v1, x: PARK, y: PARK, anchorX: 1, anchorY: 0.5 });
      trailItems.push(t);
      trails.addParticle(t);
      bulletEmitters.push({ acc: 0 });
      styleSlot(bulletItems.length - 1, spread);
    }
    if (bulletCodeShown.length < cap) {
      const next = new Int8Array(cap).fill(-1);
      next.set(bulletCodeShown);
      bulletCodeShown = next;
    }
  }

  /** Capture one visual slot's sprite texture: blurred glow (fallback) or sharp core (bloom source). */
  function makeKindTexture(slot: number, blurred: boolean, override?: ShapeSpec): Texture {
    const spec = override ?? specForSlot(slot);
    const g = new Graphics(blurred ? buildGlowSourceContext(spec, palette) : buildBloomSourceContext(spec, palette));
    if (blurred) g.filters = [new BlurFilter({ strength: 6, quality: 2 })];
    const r = spec.radius + (blurred ? GLOW_PAD : GLOW_PAD / 2);
    const tex = app.renderer.generateTexture({
      target: g,
      frame: new Rectangle(-r, -r, 2 * r, 2 * r),
      resolution: GEN_TEX_RES,
      antialias: true,
    });
    g.destroy({ context: true });
    return tex;
  }

  /** Sprite texture for a visual slot on the current glow path, built lazily. */
  function glowTextureFor(visual: number): Texture {
    const slot = visual >= 1 && visual <= MAX_SLOT ? visual : 0;
    const set = bloomOn ? bloomTextures : glowTextures;
    const existing = set[slot];
    if (existing) return existing;
    const tex = makeKindTexture(slot, !bloomOn);
    set[slot] = tex;
    return tex;
  }

  /** Drop both texture sets (palette or path changed) and reassign every visible sprite. */
  function rebuildGlowTextures(): void {
    const old = glowTextures.concat(bloomTextures);
    glowTextures = emptyTextures();
    bloomTextures = emptyTextures();
    glowKind.fill(-1); // forces a texture reassign on the next draw
    prewarmedBoss = -1; // the live boss rewarms its exposed shells on the next frame
    for (let i = 0; i < glowViews.length; i++) {
      const s = glowViews[i];
      if (s && s.visible) {
        const k = viewKind[i] ?? -1;
        if (k >= 0) {
          s.texture = glowTextureFor(k);
          glowKind[i] = k;
        }
      }
    }
    for (const t of old) t?.destroy(true);
    if (dmgTex !== null) dmgTex.destroy(true);
    dmgTex = null;
    dmgTexKey = -1;
    glowTexturesDirty = false;
  }

  function redrawGrid(): void {
    // Standard and high draw the lattice instead; the v1 grid stays empty and hidden.
    if (latticeActive) return;
    if (drum && drum.trough) {
      // Trough on the low tier: the clipped v1 grid bent along u onto the valley (static), wider
      // and brighter toward the rims (glow trough-depth).
      troughRimSegs(drum, gridSegs, troughSegs);
      drawTroughGrid(grid, troughSegs, palette.grid, fit.scale);
      gridRippling = false;
      return;
    }
    if (drum) {
      // Cylinder on the low tier: static rings plus the u lines for the current camera angle.
      drumULines(drum, GRID_SPACING, drumUFront, drumUBack);
      drawDrumGrid(grid, drumRings, drumUFront, drumUBack, palette.grid, fit.scale, BACK_ALPHA);
      gridRippling = false;
      return;
    }
    if (cam.on) {
      // Tilt on the low tier: the projected v1 grid, bent and lifted by a live pond wave (the
      // small explosion ripples stay off it).
      if (pondWaves.length === 0) {
        drawGridProjected(grid, gridSegs, palette.grid, fit.scale, cam);
        gridRippling = false;
        return;
      }
      grid.clear();
      tracePondGridProjected(gridSegs, pondWaves, grid, cam);
      grid.stroke({ width: gridLineWidth(fit.scale), color: palette.grid, alpha: 1 });
      gridRippling = true;
      return;
    }
    if (ripples.length === 0 && pondWaves.length === 0) {
      drawGrid(grid, gridSegs, palette.grid, fit.scale);
      gridRippling = false;
      return;
    }
    grid.clear();
    traceRippledGrid(gridSegs, ripples, grid, pondWaves);
    grid.stroke({ width: gridLineWidth(fit.scale), color: palette.grid, alpha: 1 });
    gridRippling = true;
  }

  /** Walls flat (off) or projected on the CPU (tilt), so they meet the projected lattice ends. */
  function wallsTo(g: Graphics, colour: number, passes: readonly WallPass[]): void {
    if (drum && drum.trough) drawTroughWalls(g, troughWallSegs, colour, passes);
    else if (drum) drawDrumWalls(g, drumRims, colour, passes, BACK_ALPHA);
    else if (cam.on) drawWallsProjected(g, arena, colour, passes, cam);
    else drawWalls(g, arena, colour, passes);
  }

  // R2 membrane red glow. Per bar: glow cells (MEMBRANE_CELL u each) and the segment intervals.
  // Scratch is sized per arena, so the per frame path does not allocate.
  let membraneObs: Obstacle[] = [];
  let mbCellOff = new Int32Array(0);
  let mbCellN = new Int32Array(0);
  let mbSegOff = new Int32Array(0);
  let mbSegN = new Int32Array(0);
  let mbSegs = new Float32Array(0);
  let mbGlow = new Float32Array(0);
  let mbLit = new Uint8Array(0);
  let mbCrisp: WallPass[] = [];
  let mbSoft: WallPass[] = [];
  let mbShown = false;
  const mbPt: Projected = { x: 0, y: 0, s: 1 };
  const mbDrumPt: DrumPoint = { x: 0, y: 0, s: 1, a: 1, m: 1 };
  const mbStroke = { width: 1, color: 0xffffff, alpha: 1, cap: 'round' as const, join: 'round' as const };
  /** Drum sample step along a bar edge, arena units (a drum bends long edges). */
  const MB_DRUM_STEP = 24;
  let mbX = 0;
  let mbY = 0;
  let mbBack = 1;

  function refreshMembranes(r: Readonly<NeonRender>): void {
    membraneObs = membraneObstacles(arena);
    const n = membraneObs.length;
    mbCellOff = new Int32Array(n);
    mbCellN = new Int32Array(n);
    mbSegOff = new Int32Array(n);
    mbSegN = new Int32Array(n);
    const iv: number[] = [];
    const segAll: number[] = [];
    let cells = 0;
    for (let k = 0; k < n; k++) {
      const o = membraneObs[k];
      if (!o) continue;
      const vertical = isVertical(o);
      const len = vertical ? o.h : o.w;
      const c = membraneCellCount(len);
      mbCellOff[k] = cells;
      mbCellN[k] = c;
      cells += c;
      const sn = membraneSegments((vertical ? o.cy : o.cx) - len / 2, len, iv);
      mbSegOff[k] = segAll.length;
      mbSegN[k] = sn;
      segAll.push(...iv);
    }
    mbSegs = Float32Array.from(segAll);
    mbGlow = new Float32Array(cells);
    mbLit = new Uint8Array(cells);
    mbCrisp = wallPasses(r.innerAlpha, r.wallWidthMul, fit.scale, 'crisp');
    mbSoft = wallPasses(r.innerAlpha, r.wallWidthMul, fit.scale, 'bloom');
    membraneG.clear();
    membraneGlowG.clear();
    mbShown = false;
  }

  /** Arena point at lift z to the same space the walls draw in (flat, tilt or drum). */
  function mbMap(x: number, y: number, z: number): void {
    if (drum) {
      drumProject(x, y, 0, drum, mbDrumPt);
      mbX = mbDrumPt.x;
      mbY = mbDrumPt.y;
      mbBack = mbDrumPt.a === 1 ? 1 : BACK_ALPHA;
    } else if (cam.on) {
      project(x, y, z, cam, mbPt);
      mbX = mbPt.x;
      mbY = mbPt.y;
      mbBack = 1;
    } else {
      mbX = x;
      mbY = y;
      mbBack = 1;
    }
  }

  /** A line along the bar (at cross offset c) from s = a to s = b, sampled on the drum. */
  function mbLine(g: Graphics, vertical: boolean, c: number, a: number, b: number, z: number): void {
    const n = drum ? Math.max(1, Math.ceil(Math.abs(b - a) / MB_DRUM_STEP)) : 1;
    for (let i = 0; i <= n; i++) {
      const s = a + ((b - a) * i) / n;
      mbMap(vertical ? c : s, vertical ? s : c, z);
      if (i === 0) g.moveTo(mbX, mbY);
      else g.lineTo(mbX, mbY);
    }
  }

  /** A line across the bar at s, from cross offset c0 to c1. */
  function mbCross(g: Graphics, vertical: boolean, s: number, c0: number, c1: number, z: number): void {
    mbMap(vertical ? c0 : s, vertical ? s : c0, z);
    g.moveTo(mbX, mbY);
    mbMap(vertical ? c1 : s, vertical ? s : c1, z);
    g.lineTo(mbX, mbY);
  }

  /** Trace the outline of bar k between s = r0 and r1, clipped to its segments (openings stay open). */
  function mbTraceRun(g: Graphics, k: number, o: Obstacle, r0: number, r1: number, z: number): void {
    const vertical = isVertical(o);
    const centre = vertical ? o.cx : o.cy;
    const half = (vertical ? o.w : o.h) / 2;
    const off = mbSegOff[k] ?? 0;
    const sn = mbSegN[k] ?? 0;
    for (let j = 0; j < sn; j++) {
      const a = mbSegs[off + 2 * j] ?? 0;
      const b = mbSegs[off + 2 * j + 1] ?? 0;
      const lo = a > r0 ? a : r0;
      const hi = b < r1 ? b : r1;
      if (hi <= lo) continue;
      mbLine(g, vertical, centre - half, lo, hi, z);
      mbLine(g, vertical, centre + half, lo, hi, z);
      if (a >= r0 && a <= r1) mbCross(g, vertical, a, centre - half, centre + half, z);
      if (b >= r0 && b <= r1) mbCross(g, vertical, b, centre - half, centre + half, z);
    }
  }

  /** Stroke every lit run of equal glow step on every bar for one pass. */
  function mbGlowPass(g: Graphics, pass: WallPass, red: number): void {
    const lip = cam.on && drum === null;
    for (let k = 0; k < membraneObs.length; k++) {
      const o = membraneObs[k];
      if (!o) continue;
      const vertical = isVertical(o);
      const len = vertical ? o.h : o.w;
      const s0 = (vertical ? o.cy : o.cx) - len / 2;
      const off = mbCellOff[k] ?? 0;
      const cn = mbCellN[k] ?? 0;
      const cl = len / Math.max(1, cn);
      let c = 0;
      while (c < cn) {
        const q = glowStep(mbGlow[off + c] ?? 0);
        let e = c + 1;
        while (e < cn && glowStep(mbGlow[off + e] ?? 0) === q) e++;
        if (q > 0) {
          const r0 = s0 + c * cl;
          const r1 = s0 + e * cl;
          const mid = (r0 + r1) / 2;
          mbMap(vertical ? o.cx : mid, vertical ? mid : o.cy, 0);
          const back = mbBack;
          if (back === 1 || !backCulled(pass.alpha)) {
            mbTraceRun(g, k, o, r0, r1, 0);
            if (lip) mbTraceRun(g, k, o, r0, r1, WALL_LIP);
            const st = mbStroke;
            st.width = pass.width;
            st.color = red;
            st.alpha = pass.alpha * (q / MEMBRANE_GLOW_STEPS) * back;
            g.stroke(st);
          }
        }
        c = e;
      }
    }
  }

  /**
   * R2: while a hostile overlaps a membrane, the bar within MEMBRANE_GLOW_RADIUS of it glows red
   * (palette red, through applyNeon), fading in over 0.1 s and out over 0.4 s. Flat, tilt and drum.
   */
  function drawMembranes(w: World, dt: number): void {
    if (membraneObs.length === 0) return;
    mbLit.fill(0);
    for (let i = 0; i < w.cap; i++) {
      if (w.alive[i] !== 1 || !isHostile(w.kind[i] ?? 0)) continue;
      const ex = w.x[i] ?? 0;
      const ey = w.y[i] ?? 0;
      const er = w.radius[i] ?? 0;
      for (let k = 0; k < membraneObs.length; k++) {
        const o = membraneObs[k];
        if (!o || !circleOverlapsObstacle(o, ex, ey, er)) continue;
        const vertical = isVertical(o);
        const len = vertical ? o.h : o.w;
        const s0 = (vertical ? o.cy : o.cx) - len / 2;
        markGlowCells(mbLit, mbCellOff[k] ?? 0, mbCellN[k] ?? 0, len, (vertical ? ey : ex) - s0);
      }
    }
    let any = false;
    for (let c = 0; c < mbGlow.length; c++) {
      const v = stepGlow(mbGlow[c] ?? 0, dt, mbLit[c] === 1);
      mbGlow[c] = v;
      if (v > 0) any = true;
    }
    if (!any && !mbShown) return;
    membraneG.clear();
    membraneGlowG.clear();
    mbShown = any;
    if (!any) return;
    const red = palette.red;
    for (const pass of mbCrisp) mbGlowPass(membraneG, pass, red);
    for (const pass of mbSoft) mbGlowPass(membraneGlowG, pass, red);
  }

  // R2 drift burst streaks (open drums). State from sim:driftBurst; scratch reused per frame.
  const streaks = createDriftStreaks();
  // R2 enraged enemies: slots marked by sim:enrage, cleared when the slot is hidden (death).
  const enraged = createEnrageTrack(64);
  const streakFrame: StreakFrame = { level: 0, count: 0, burst: false };
  const streakSeg: StreakSeg = { phi0: 0, phi1: 0, v: 0, alpha: 0 };
  const streakPt: DrumPoint = { x: 0, y: 0, s: 1, a: 1, m: 1 };
  const streakStroke = { width: 1, color: 0xffffff, alpha: 1, cap: 'round' as const, join: 'round' as const };
  /** Samples per streak along the drum (a streak bends with the face). */
  const STREAK_SAMPLES = 5;
  /** Streak core lift toward white, and line widths as shares of the wall line. */
  const STREAK_WHITE = 0.45;
  const STREAK_CORE_MUL = 0.9;
  const STREAK_HALO_MUL = 3;
  let streakShown = false;

  function strokeStreak(g: Graphics, d: Drum, seg: StreakSeg, width: number, colour: number, alpha: number): void {
    for (let i = 0; i <= STREAK_SAMPLES; i++) {
      const phi = seg.phi0 + ((seg.phi1 - seg.phi0) * i) / STREAK_SAMPLES;
      projectPhi(phi, seg.v, 0, d, streakPt);
      if (i === 0) g.moveTo(streakPt.x, streakPt.y);
      else g.lineTo(streakPt.x, streakPt.y);
    }
    const st = streakStroke;
    st.width = width;
    st.color = colour;
    st.alpha = alpha;
    g.stroke(st);
  }

  /**
   * R2: speed streaks across the drum front face in the burst direction, faint for the telegraph,
   * dense and fast for the burst. Colour from the palette grid lifted toward white (applyNeon).
   */
  function drawDriftStreaks(dt: number): void {
    driftStreakFrame(streaks, dt, streakFrame);
    const on = drum !== null && !drum.trough && streakFrame.level > 0;
    if (!on) {
      if (streakShown) {
        streakG.clear();
        streakGlowG.clear();
        streakShown = false;
      }
      return;
    }
    const d = drum;
    if (!d) return;
    streakG.clear();
    streakGlowG.clear();
    streakShown = true;
    const s = Math.max(fit.scale, 0.01);
    const core = (WALL_LINE_PX * STREAK_CORE_MUL * currentRender.wallWidthMul) / s;
    const halo = (WALL_LINE_PX * STREAK_HALO_MUL * currentRender.wallWidthMul) / s;
    const colour = mixRgb(palette.grid, 0xffffff, STREAK_WHITE);
    const glowA = currentRender.innerAlpha;
    for (let k = 0; k < streakFrame.count; k++) {
      streakAt(k, streaks.travel, streaks.dir, streakFrame.level, d.height / 2, streakSeg);
      if (streakSeg.alpha <= 0.01) continue;
      if (glowA > 0) strokeStreak(streakG, d, streakSeg, halo, colour, streakSeg.alpha * glowA * 0.3);
      strokeStreak(streakG, d, streakSeg, core, colour, streakSeg.alpha);
      strokeStreak(streakGlowG, d, streakSeg, core * 1.5, colour, streakSeg.alpha);
    }
  }

  function redrawWalls(r: Readonly<NeonRender>): void {
    refreshMembranes(r);
    wallsTo(walls, palette.grid, wallPasses(r.innerAlpha, r.wallWidthMul, fit.scale, 'crisp'));
    wallsTo(wallGlow, palette.grid, wallPasses(r.innerAlpha, r.wallWidthMul, fit.scale, 'bloom'));
    // Pulse layer: white geometry, coloured per frame by tint and driven by alpha. A wide soft
    // pass plus a core pass, so it reads as glow on the fallback path too (no filter there).
    const s = Math.max(fit.scale, 0.01);
    wallsTo(wallPulse, 0xffffff, [
      { width: (WALL_GLOW_PX * r.wallWidthMul * 1.6) / s, alpha: 0.35 },
      { width: (WALL_LINE_PX * r.wallWidthMul * 1.8) / s, alpha: 1 },
    ]);
    redrawDrumObstacles(r);
  }

  /** Cylinder obstacle passes for the current neon and fit; the outlines follow in drawDrumObstacles. */
  function redrawDrumObstacles(r: Readonly<NeonRender>): void {
    drumObsCrisp = wallPasses(r.innerAlpha, r.wallWidthMul, fit.scale, 'crisp');
    drumObsSoft = wallPasses(r.innerAlpha, r.wallWidthMul, fit.scale, 'bloom');
    drumObsKey = Number.NaN;
    drumGridKey = Number.NaN;
    const on = drum !== null && arena.obstacles.length > 0;
    if (!on && drumObs.visible) {
      drumObs.clear();
      drumObsGlow.clear();
    }
    drumObs.visible = on;
    drumObsGlow.visible = on;
  }

  function strokeSegs(g: Graphics, segs: readonly number[], width: number, alpha: number): void {
    if (segs.length < 4) return;
    for (let i = 0; i + 3 < segs.length; i += 4) g.moveTo(segs[i] ?? 0, segs[i + 1] ?? 0).lineTo(segs[i + 2] ?? 0, segs[i + 3] ?? 0);
    const st = obsStroke;
    st.width = width;
    st.color = palette.grid;
    st.alpha = alpha;
    g.stroke(st);
  }

  /**
   * Cylinder with obstacles: every obstacle outline through the drum, back half dimmed. G10 perf:
   * rebuilt only when the camera u leaves its bucket (drum.ts drumCamBucket) or the look changes,
   * all obstacles in one front and one back list so each pass is one stroke, and back passes that
   * would show below BACK_CULL_A are skipped.
   */
  function drawDrumObstacles(d: Drum): void {
    if (!drumObs.visible) return;
    const key = drumCamBucket(d.camU);
    if (key === drumObsKey) return;
    drumObsKey = key;
    drumObs.clear();
    drumObsGlow.clear();
    drumObsFront.length = 0;
    drumObsBack.length = 0;
    for (const o of barrierRects(arena)) drumRectSegsInto(d, o.cx - o.w / 2, o.cy - o.h / 2, o.w, o.h, drumObsFront, drumObsBack);
    for (const pass of drumObsCrisp) {
      if (!backCulled(pass.alpha)) strokeSegs(drumObs, drumObsBack, pass.width, pass.alpha * BACK_ALPHA);
      strokeSegs(drumObs, drumObsFront, pass.width, pass.alpha);
    }
    for (const pass of drumObsSoft) {
      if (!backCulled(pass.alpha)) strokeSegs(drumObsGlow, drumObsBack, pass.width, pass.alpha * BACK_ALPHA);
      strokeSegs(drumObsGlow, drumObsFront, pass.width, pass.alpha);
    }
  }

  /** Cylinder: the rim arcs and the low tier v rings (camera angle invariant; tilt, arena or fit change only). */
  function rebuildDrumArcs(d: Drum): void {
    if (d.trough) {
      // Trough: the arena outline bent onto the valley is the one rim (front only); no rings.
      // Glow trough-depth: it is drawn from rim height buckets (drawTroughWalls), not drumRims.
      drumRims = [];
      drumRings = [];
      troughWallSegs = rimBuckets();
      troughRimSegs(d, polyEdges(outlinePoints(arena)), troughWallSegs);
      return;
    }
    const hh = d.height / 2;
    drumRims = [ringArcs(d, -hh), ringArcs(d, hh)];
    drumRings = [];
    for (let k = -Math.floor(hh / GRID_SPACING); k * GRID_SPACING < hh; k++) {
      const v = k * GRID_SPACING;
      if (v > -hh && v < hh) drumRings.push(ringArcs(d, v));
    }
  }

  /** Level surface: a drum for a cylinder, nothing for flat. The camera snaps to the ship on the next frame. */
  function applySurface(def: LevelDef): void {
    // A new level starts with no burst streaks and no enraged slots.
    streaks.age = Number.POSITIVE_INFINITY;
    enraged.on.fill(0);
    if (def.surface === 'cylinder') {
      drum = makeDrum(arena.width, arena.height, TILT_DEG[tiltLevel]);
      drum.camU = wrapCoord(arena.spawnPoint.x, drum.width);
      wrapW = drum.width;
      drumSnap = true;
    } else if (def.surface === 'trough' || devTrough) {
      // Trough wave: the valley projection; nothing wraps and the camera never follows.
      drum = makeTroughDrum(arena.width, arena.height, TILT_DEG[tiltLevel]);
      wrapW = 0;
      drumSnap = false;
    } else {
      drum = null;
      wrapW = 0;
    }
    cometUPrimed = false;
    lattice.setDrum(drum);
    lattice.setCamera(drum || !cam.on ? null : cam);
  }

  /** Trough wave: the slope shade bands in the grid colour (palette through applyNeon); hidden off a trough. */
  function redrawTroughShade(): void {
    troughShade.clear();
    const on = drum !== null && drum.trough;
    troughShade.visible = on;
    if (!drum || !on) return;
    for (const b of troughShadeBands(drum, outlinePoints(arena))) troughShade.poly(b.pts, true).fill({ color: palette.grid, alpha: b.alpha });
  }

  function redrawArena(): void {
    redrawTroughShade();
    redrawGrid();
    gridLayer.alpha = currentRender.gridAlpha;
    redrawWalls(currentRender);
  }

  /**
   * Switch between the v1 grid (low) and the lattice (standard, high) for the current arena,
   * tier and governor notch. Allocates: called on arena, tier and governor changes only.
   */
  function applyLatticeTier(t: EffectsTier): void {
    const on = latticeOn(t);
    if (on) {
      const s = chooseSpacing(arena, latticeSpacingFor(t), latticeCapFor(t), gov.notch);
      if (!latticeActive || lattice.spacing !== s || govNotchBuilt !== gov.notch || lattice.sim === null) {
        lattice.build(arena, s);
      }
      govNotchBuilt = gov.notch;
      lattice.setColour(palette.grid);
      ripples.length = 0;
      if (!latticeActive) {
        grid.clear();
        gridRippling = false;
      }
      latticeActive = true;
      grid.visible = false;
      lattice.lines.visible = true;
      lattice.glow.visible = mapEffectsOn(t);
      lattice.setAmbient(mapEffectsOn(t) ? AMBIENT_AMP : 0);
    } else {
      lattice.clear();
      latticeActive = false;
      grid.visible = true;
      lattice.lines.visible = false;
      lattice.glow.visible = false;
      lattice.setAmbient(0);
      redrawGrid();
    }
    lattice.dust.visible = dustOn(t);
    stats.latticeNodes = lattice.nodes;
    stats.latticeSpacing = lattice.spacing;
  }

  /** Feed the frame interval to the governor; rebuild one notch coarser when it says so. */
  function governLattice(dtSec: number, nowSec: number): void {
    if (!latticeActive) return;
    const ms = dtSec * 1000;
    if (!(ms > 0) || ms > GAP_MS) {
      // A pause, hidden tab or fold is not load: restart the streak.
      if (gov.overSince >= 0) gov = { notch: gov.notch, overSince: -1 };
      return;
    }
    avgFrameMs = smoothFrameMs(avgFrameMs, ms);
    const next = nextGovernor(gov, { frameMs: avgFrameMs, nowSec });
    if (next === gov) return;
    gov = next;
    if (gov.notch !== govNotchBuilt) applyLatticeTier(getEffectsTier());
  }

  function applyFit(): void {
    const rect = playRect ?? { x: 0, y: 0, w: cssW, h: cssH };
    if (drum) rebuildDrumArcs(drum);
    fit = drum ? fitDrum(drum, rect) : cam.on ? fitProjected(arena.width, arena.height, rect, cam) : fitArena(arena.width, arena.height, rect);
    world.position.set(fit.x + shakeOff.x, fit.y + shakeOff.y);
    world.scale.set(fit.scale);
    const r = screenRectInWorld(cssW, cssH, fit);
    const pad = SHAKE_PAD_PX / Math.max(fit.scale, 0.01);
    bloomLayer.filterArea = new Rectangle(r.x - pad, r.y - pad, r.w + 2 * pad, r.h + 2 * pad);
    lattice.setPixel(1 / Math.max(0.01, fit.scale * app.renderer.resolution));
    redrawArena();
  }

  // Neon: bindNeon writes bloom strength and threshold onto this live filter instance and the
  // grid alpha onto the live grid layer (v1 grid, lattice and dust), then calls these hooks for
  // the shape, tint and sprite paths.
  const offNeon = bindNeon({
    bloom,
    grid: gridLayer,
    shapes(r: Readonly<NeonRender>): void {
      const old = rebuildShapeContexts(r);
      for (let i = 0; i < views.length; i++) {
        const v = views[i];
        const k = viewKind[i] ?? -1;
        if (v && k >= 0) v.context = contextForSlot(k);
      }
      // Wave B: the Mirage afterimage shares a boss context, so it follows the new neon too.
      if (ghostView && ghostSlot >= 0) ghostView.context = contextForSlot(ghostSlot);
      // Wave C: the Tempest dash ghosts share the exposed boss context, so they follow it too.
      for (const g of dashGhosts) if (g.view && g.slot >= 0) g.view.context = contextForSlot(g.slot);
      retiredContexts = retiredContexts.concat(old);
      if (dmgCtx !== null) retiredContexts.push(dmgCtx);
      dmgCtx = null;
      dmgKey = -1;
      redrawWalls(r);
    },
    tint(): void {
      viewTint.fill(-1); // every live view retints from the new palette on the next draw
      // Bullets: every slot restyles from the new palette, with the new trail alpha.
      restyleBullets();
      redrawGrid();
      redrawTroughShade();
      lattice.setColour(palette.grid);
    },
    sprites(): void {
      // Both sprite sets bake palette colours; rebuild lazily for the live path.
      glowTexturesDirty = true;
      rebuildGlowTextures();
    },
  });

  // Effects from the sim (docs/01 section 12). Payloads are reused scratch objects, so read
  // the fields now.
  function playFx(x: number, y: number, e: FxEvent): void {
    burstFx(x, y, e);
    const plan = planFx(e);
    if (plan.shake) addShake(shake, plan.shake.amp, plan.shake.dur);
    if (latticeActive) kickLattice(x, y, e, plan.ripple);
    else if (plan.ripple > 0) addRipple(ripples, x, y, plan.ripple);
    if (plan.ring !== null) {
      if (ringList.length >= MAX_RINGS) ringList.shift();
      ringList.push({ x, y, age: 0, colour: plan.ring });
    }
    if (mapEffectsOn(getEffectsTier())) mapPulse(x, y, e, plan.ripple);
  }

  /**
   * Run 0180 map effects for an fx event: the shockwave ring sprite in the enemy hue (kills and
   * deaths) and the colour pulse through the lattice. Standard and high only.
   */
  function mapPulse(x: number, y: number, e: FxEvent, ripple: number): void {
    const hue = e.type === 'kill' ? palette[e.colour ?? 'white'] : e.type === 'death' ? palette.ship : e.type === 'bomb' ? palette.bomb : palette.geom;
    if (e.type === 'kill' || e.type === 'death') {
      const big = e.type === 'death' || ripple >= RIPPLE_KILL_BIG;
      addPulse(pulsePool, PULSE_RING, x, y, 0, SHOCK_R0, SHOCK_R1 * (big ? SHOCK_BIG_MUL : 1), SHOCK_LIFE * (big ? 1.3 : 1), hue, 1);
    }
    if (!lattice.sim) return;
    const hp = e.type === 'bomb' ? heatBombFor(arena.width, arena.height) : heatPulseFor(e.type, ripple);
    if (hp) lattice.pulse(x, y, hue, hp);
  }

  /** Lattice impulse for an fx event: a point kick, or an expanding ring for bombs and supers. */
  function kickLattice(x: number, y: number, e: FxEvent, ripple: number): void {
    const sim = lattice.sim;
    if (!sim) return;
    // Run 0180: the bomb ring lives until it has crossed the whole arena.
    const k = e.type === 'bomb' ? bombKickFor(arena.width, arena.height) : latticeKickFor(e.type, ripple);
    if (k === null) return;
    if (k.t === 'point') addImpulse(sim, x, y, k.strength, k.radius);
    else addRing(sim, x, y, k.strength, k.speed, k.life, k.width);
  }

  /**
   * Sustained super distortion: while a timed super runs, a throbbing field around the ship and a
   * small ring with a colour pulse every SUPER_PULSE_SEC. Lattice tiers only.
   */
  function superDistort(shipX: number, shipY: number, nowSec: number): void {
    const sim = lattice.sim;
    if (!superOn || !sim || !mapEffectsOn(getEffectsTier())) return;
    addForce(sim, shipX, shipY, SUPER_FORCE_RADIUS, superForceAccel(nowSec));
    if (superPulseDue(lastFxSec, nowSec)) {
      const k = KICK_SUPER_PULSE;
      addRing(sim, shipX, shipY, k.strength, k.speed, k.life, k.width);
      lattice.pulse(shipX, shipY, palette.geom, HEAT_SUPER);
    }
  }

  /** A bullet that died within WALL_HIT_RANGE of a wall lights the wall there in its colour. */
  function bulletWallGlow(x: number, y: number, colour: number): void {
    nearestWall(features, x, y, bulletHit);
    if (bulletHit.feature < 0 || !(bulletHit.dist <= WALL_HIT_RANGE)) return;
    const rot = wallTangent(features[bulletHit.feature], bulletHit.x, bulletHit.y);
    addPulse(pulsePool, PULSE_BAR, bulletHit.x, bulletHit.y, rot, WALL_GLOW_LEN, WALL_GLOW_THICK, WALL_GLOW_LIFE, colour, 1);
  }

  /** Mirror the pulse pool onto its Particles. Alpha is scaled by the neon glow, like map fx. */
  function drawPulses(dt: number): void {
    if (pulsePool.live === 0 && !pulsesShown) return;
    stepPulses(pulsePool, dt);
    const gain = mapFxNeonGain(current.glowAlpha);
    let any = false;
    for (let i = 0; i < pulsePool.cap; i++) {
      const p = pulseItems[i];
      if (!p) continue;
      if (!pulseLive(pulsePool, i)) {
        if (p.x !== PARK) {
          p.x = PARK;
          p.y = PARK;
          p.alpha = 0;
        }
        continue;
      }
      any = true;
      const shape = pulsePool.shape[i] ?? PULSE_RING;
      const u = (pulsePool.age[i] ?? 0) / Math.max(1e-6, pulsePool.life[i] ?? 1);
      if (pulsePool.fresh[i] === 1) {
        pulsePool.fresh[i] = 0;
        p.texture = fxAtlas.frames[shape === PULSE_BAR ? 1 : shape === PULSE_STREAK ? 2 : 0];
        p.anchorX = shape === PULSE_STREAK ? 1 : 0.5;
        p.anchorY = 0.5;
        p.tint = pulsePool.colour[i] ?? 0xffffff;
        p.rotation = pulsePool.rot[i] ?? 0;
      }
      p.x = pulsePool.x[i] ?? 0;
      p.y = pulsePool.y[i] ?? 0;
      const r0 = pulsePool.r0[i] ?? 0;
      const r1 = pulsePool.r1[i] ?? 0;
      if (shape === PULSE_RING) {
        const s = shockRadius(r0, r1, u) / FX_RING_R;
        p.scaleX = s;
        p.scaleY = s;
      } else if (shape === PULSE_BAR) {
        // A wall glow swells a little along the wall as it fades.
        p.scaleX = (r0 / 64) * (0.8 + 0.4 * u);
        p.scaleY = r1 * (1.2 - 0.4 * u);
      } else {
        p.scaleX = r0 / TAPER_TEX_LEN;
        p.scaleY = r1 * (1 - 0.5 * u);
      }
      p.alpha = pulseAlpha(shape, u) * (pulsePool.strength[i] ?? 1) * gain;
    }
    pulsesShown = any;
  }

  /** Drop every pulse and park its sprite (tier off, level change). */
  function clearPulseFx(): void {
    clearPulses(pulsePool);
    for (const p of pulseItems) {
      p.x = PARK;
      p.y = PARK;
      p.alpha = 0;
    }
    pulsesShown = false;
  }

  /**
   * 'fx:hit' (core/events.ts): one event per hit, no rate limit, so the throttle lives here. At
   * most one flash per entity per 50 ms on the draw clock. blocked: a Bulwark shield absorbed it,
   * so draw the deflect arc on the shield plus 3 to 5 sparks. Otherwise a multi HP target took
   * damage: one tiny additive flash in its hue. Off on the low tier. No allocation.
   */
  function onHit(x: number, y: number, kind: number, id: number, blocked: boolean): void {
    if (kind === KIND_NUM.boss) {
      if (blocked) shellHit(shell);
      onBossHit(x, y, blocked);
      return;
    }
    if (!hitFxOn(getEffectsTier()) || !hitThrottleAllow(hitThrottle, id, hitClockMs)) return;
    hitSeq = (hitSeq + 1) | 0;
    if (blocked) deflectAt(x, y, kind, id);
    else {
      sawSparks(x, y);
      const colour = mixRgb(palette[hitHueKey(specFor(kind))], 0xffffff, HIT_FLASH_WHITE);
      addPulse(hitPool, PULSE_FLASH, x, y, 0, 0, 0, HIT_FLASH_LIFE, colour, 1);
    }
  }

  /**
   * Deflect arc and sparks for a blocked hit on entity id. With the Bulwark known (the world the
   * last frame drew) the arc snaps onto its shield plate along the hit direction, so it sits where
   * the plate is drawn whichever step the bullet died on; otherwise it sits at the hit point.
   */
  function deflectAt(x: number, y: number, kind: number, id: number): void {
    const w = hitWorld;
    let px = x;
    let py = y;
    if (w !== null && id > 0 && id < w.cap && w.alive[id] === 1 && w.kind[id] === kind) {
      const cx = w.x[id] ?? x;
      const cy = w.y[id] ?? y;
      deflectDir(x, y, cx, cy, hitSeq, hitDir);
      px = cx + hitDir.x * DEFLECT_ARC_R;
      py = cy + hitDir.y * DEFLECT_ARC_R;
    } else {
      deflectDir(x, y, Number.NaN, Number.NaN, hitSeq, hitDir);
    }
    const colour = mixRgb(palette.bulwark, 0xffffff, DEFLECT_WHITE);
    addPulse(hitPool, PULSE_ARC, px, py, Math.atan2(hitDir.y, hitDir.x), 0, 0, DEFLECT_ARC_LIFE, colour, 1);
    emitDeflectSparks(px, py, hitDir.x, hitDir.y, colour);
  }

  /**
   * 'fx:hit' with Kind.Boss, throttled to one flash per BOSS_HIT_MS on the draw clock. A damaging hit
   * boosts the boss glow sprite briefly (every tier: a multiplier on the existing sprite) and, off
   * Low, adds a flash at the hit point. A blocked hit (shell, membrane) throws deflect sparks off
   * the body instead, so the player sees the shot did nothing. No allocation.
   */
  function onBossHit(x: number, y: number, blocked: boolean): void {
    // G3C: a 60 ms white outline flash and 2 to 3 sparks in the boss hue, at most 20 per second per
    // boss, on every tier, so damage reads on Bastion and Tempest at full speed.
    if (!blocked && bossFlashAllow(bossFlashT, bossIdx, hitClockMs)) {
      bossFlashAge = 0;
      bossSparkSeq = (bossSparkSeq + 1) | 0;
      burstBoss(x, y, palette[bossColourOf(bossIdx)], hitSparkCount(bossSparkSeq), 140, 360, 0.15, 0.3);
    }
    if (!bossHitAllow(bossHitThrottle, hitClockMs)) return;
    if (!blocked) bossHitAge = 0;
    if (!hitFxOn(getEffectsTier())) return;
    const hue = palette[bossColourOf(bossIdx)];
    if (blocked) {
      const dx = x - bossDrawX;
      const dy = y - bossDrawY;
      const d = Math.sqrt(dx * dx + dy * dy);
      const colour = mixRgb(hue, 0xffffff, DEFLECT_WHITE);
      emitDeflectSparks(x, y, d > 1e-3 ? dx / d : 1, d > 1e-3 ? dy / d : 0, colour);
      return;
    }
    addPulse(hitPool, PULSE_FLASH, x, y, 0, 0, 0, HIT_FLASH_LIFE * 1.5, mixRgb(hue, 0xffffff, HIT_FLASH_WHITE), 1);
  }

  /** Boss index of a bus payload id (a BossId string). No allocation. */
  function payloadBoss(id: string): number {
    return bossIndex((BOSS_IDS as readonly string[]).indexOf(id));
  }

  /** 'sim:bossEnter': the screen edge pulse in the boss colour (map effect, off on Low). */
  function onBossEnter(id: string): void {
    const b = payloadBoss(id);
    bossIdx = b;
    bossTier = bossTierOf(b);
    bossEdgeKey = bossColourOf(b);
    if (mapEffectsOn(getEffectsTier())) bossEdgeAge = 0;
    exposeEvent = EXPOSE_UNKNOWN;
    resetIdentity();
  }

  /** G3C: drop the window, cracks, pieces and flash (boss enter, boss down, new level). */
  function resetIdentity(): void {
    resetBossWindow(bossWin);
    resetBossCracks(bossCracks);
    pieceAge.fill(Number.POSITIVE_INFINITY);
    bossFlashAge = Number.POSITIVE_INFINITY;
  }

  /** 'sim:bossWindow': the Prism run up (open false, secondsLeft) and the open window. */
  function onWindow(id: string, open: boolean, secondsLeft: number): void {
    if (id !== '' && payloadBoss(id) !== bossIdx) return;
    windowEvent(bossWin, open, secondsLeft);
  }

  /**
   * 'sim:bossCrack' at 66 and 33 percent: lay the crack (kept until the boss dies) and break a
   * wedge off at (x, y), which drifts 40 u outward and dissolves in 0.8 s.
   */
  function onCrack(id: string, stage: number, x: number, y: number): void {
    if (id !== '' && payloadBoss(id) !== bossIdx) return;
    const px = Number.isFinite(x) ? x : bossDrawX + 1;
    const py = Number.isFinite(y) ? y : bossDrawY;
    const wa = Math.atan2(py - bossDrawY, px - bossDrawX);
    const rot = bossSeen ? (bodyRot[0] ?? 0) : bossView.rot;
    const s = stage >= 2 ? 2 : 1;
    if (!crackEvent(bossCracks, s, wa - rot, ((levelSeed >>> 0) % 100003) * 13 + bossIdx * 17)) return;
    // The outline pieces removed by this stage break away in the boss colours. At stage 2 the
    // DETACH_ARC piece is the one whole section that drifts off.
    const outline = BOSS_OUTLINES[bossIdx];
    if (outline !== undefined) {
      const sc = bossSeen ? (bodyScale[0] ?? 1) : 1;
      const c = Math.cos(rot) * sc;
      const sn = Math.sin(rot) * sc;
      const [k0, k1] = newArcRange(s);
      for (let k = k0; k < k1 && k < PIECES; k++) {
        const a0 = bossCracks.arcs[k * 2] ?? 0;
        const a1 = bossCracks.arcs[k * 2 + 1] ?? 0;
        fragmentPts(outline, (a0 + a1) / 2, (a1 - a0) / 2, fragScratch, fragCentre);
        const lx = fragCentre[0] ?? 0;
        const ly = fragCentre[1] ?? 0;
        const wx = lx * c - ly * sn;
        const wy = lx * sn + ly * c;
        const len = Math.sqrt(wx * wx + wy * wy) || 1;
        pieceAge[k] = 0;
        pieceX[k] = bossDrawX + wx;
        pieceY[k] = bossDrawY + wy;
        pieceDx[k] = wx / len;
        pieceDy[k] = wy / len;
        pieceSpinDir[k] = k === DETACH_ARC ? 0 : (k & 1) === 0 ? 1 : -1;
        for (let q = 0; q < FRAG_PTS; q++) {
          const fx = fragScratch[q * 2] ?? 0;
          const fy = fragScratch[q * 2 + 1] ?? 0;
          piecePts[(k * FRAG_PTS + q) * 2] = fx * c - fy * sn;
          piecePts[(k * FRAG_PTS + q) * 2 + 1] = fx * sn + fy * c;
        }
      }
    }
    burstBoss(px, py, palette[bossColourOf(bossIdx)], 6 * s, 80, 240, 0.3, 0.7);
  }

  /**
   * 'sim:bossPhase': a body flash (every tier), a ring of sparks and, on the lattice tiers, a shock
   * ring and a short lattice kick at the drawn boss position.
   */
  function onBossPhase(id: string): void {
    const b = payloadBoss(id);
    bossPhaseAge = 0;
    const hue = palette[bossColourOf(b)];
    const hot = mixRgb(hue, 0xffffff, 0.45);
    burstBoss(bossDrawX, bossDrawY, hot, BOSS_PHASE_BURST, 200, 600, 0.4, 0.8);
    if (!mapEffectsOn(getEffectsTier())) return;
    addPulse(pulsePool, PULSE_RING, bossDrawX, bossDrawY, 0, SHOCK_R0, SHOCK_R1 * 2.2, SHOCK_LIFE * 1.6, hot, 1);
    const sim = lattice.sim;
    if (latticeActive && sim) {
      const k = KICK_BOSS_PHASE;
      addRing(sim, bossDrawX, bossDrawY, k.strength, k.speed, k.life, k.width);
    }
  }

  /**
   * 'sim:bossSplit' (once): Brood broke into Broodlings and its body is already gone from the world,
   * so the green shard burst goes where the body last drew (bossDrawX, bossDrawY), with a green shock
   * ring on the map effect tiers. The Broodlings themselves draw as part slots (bossShapes.ts).
   */
  function onBossSplit(): void {
    const x = splitCoord(bossDrawX, 0);
    const y = splitCoord(bossDrawY, 0);
    const t = getEffectsTier();
    const hue = palette[splitKey()];
    const total = splitShardCount(t);
    const hot = splitHotCount(total);
    burstBoss(x, y, hue, total - hot, SPLIT_SPEED_MIN, SPLIT_SPEED_MAX, SPLIT_LIFE_MIN, SPLIT_LIFE_MAX);
    burstBoss(x, y, mixRgb(hue, 0xffffff, SPLIT_HOT_MIX), hot, SPLIT_SPEED_MIN, SPLIT_SPEED_MAX, SPLIT_LIFE_MIN, SPLIT_LIFE_MAX);
    if (!mapEffectsOn(t)) return;
    addPulse(pulsePool, PULSE_RING, x, y, 0, SHOCK_R0, SHOCK_R1 * SPLIT_RING_MUL, SHOCK_LIFE * SPLIT_RING_MUL, hue, 1);
  }

  /**
   * 'sim:bossDown': the large death burst (capped by effects tier), a 14 px shake for 0.6 s, the bomb
   * style ring in the boss colour, and the lattice shock (or the v1 ripple on Low).
   */
  function onBossDown(id: string, x: number, y: number): void {
    exposeEvent = EXPOSE_UNKNOWN;
    resetIdentity();
    const b = payloadBoss(id);
    const t = getEffectsTier();
    const key = bossColourOf(b);
    const hue = palette[key];
    const total = bossDeathBurst(t, bossTierOf(b));
    const white = Math.round(total * BOSS_BURST_WHITE);
    burstBoss(x, y, hue, total - white, 250, 1100, 0.7, 1.6);
    burstBoss(x, y, 0xffffff, white, 350, 1300, 0.5, 1.1);
    addShake(shake, BOSS_DEATH_SHAKE_PX, BOSS_DEATH_SHAKE_SEC);
    if (ringList.length >= MAX_RINGS) ringList.shift();
    ringList.push({ x, y, age: 0, colour: key });
    const sim = lattice.sim;
    if (latticeActive && sim) {
      const k = KICK_BOSS_DOWN;
      addRing(sim, x, y, k.strength, k.speed, k.life, k.width);
      if (mapEffectsOn(t)) lattice.pulse(x, y, hue, HEAT_BOSS);
    } else {
      addRipple(ripples, x, y, RIPPLE_BOSS);
    }
    if (mapEffectsOn(t)) {
      addPulse(pulsePool, PULSE_RING, x, y, 0, SHOCK_R0, SHOCK_R1 * 3, SHOCK_LIFE * 2, mixRgb(hue, 0xffffff, 0.3), 1);
      wallFlashAt(x, y);
    }
  }

  /** Read the boss once per frame and ease its displayed openness. */
  function updateBoss(w: World, dt: number): void {
    bossReader(w, bossView);
    levelSeed = w.level.seed;
    bossHitAge += dt;
    bossPhaseAge += dt;
    bossEdgeAge += dt;
    bossFlashAge += dt;
    for (let k = 0; k < PIECES; k++) pieceAge[k] = (pieceAge[k] ?? 0) + dt;
    stepBossWindow(bossWin, dt);
    stepBossCracks(bossCracks, dt);
    addCount = 0;
    ghostAge += dt;
    laneHazards = 0;
    anchorsLast = anchorCount;
    anchorCount = 0;
    turretsLast = turretCount;
    turretCount = 0;
    for (const g of dashGhosts) g.age += dt;
    if (!bossView.active) {
      bossLastX = Number.NaN;
      bossLastY = Number.NaN;
      bossSpeed = 0;
      emberFlameEm.acc = 0;
      emberSparkEm.acc = 0;
      tempestDripEm.acc = 0;
      dashDist = 0;
      turretsSeen = 0;
      partPeak.fill(0);
      bossOpen = 0;
      exposed = false;
      exposeAge = 0;
      exposeSpread = 0;
      bossShake.x = 0;
      bossShake.y = 0;
      resetShellState(shell);
      return;
    }
    // GW2: the shield shell follows the view flag or 'sim:bossShield'; the window uses exposedLeft.
    stepShell(shell, bossView.shielded === true, bossView.exposedLeft ?? -1, dt);
    bossIdx = bossIndex(bossView.id);
    bossTier = bossTierOf(bossIdx);
    if (prewarmedBoss !== bossIdx) prewarmExposed(bossIdx);
    // Exposure: the bus event, else the sim open flag (real boss only, never a stress proxy).
    const bs = bossReader === readBoss ? bossOf(w) : null;
    const simState = bs !== null && bs.status === 'alive' ? exposeState(simBossOpen(bs)) : EXPOSE_UNKNOWN;
    const now = resolveExposed(exposeEvent, simState, bossIdx, bossView.mode);
    if (now !== exposed) {
      exposed = now;
      exposeAge = 0;
      exposePhase = 0;
    } else exposeAge += dt;
    if (exposed) exposePhase = advancePhase(exposePhase, exposePulseHz(bossIdx, bossView.mode, bossView.modeT), dt);
    const known = exposeEvent !== EXPOSE_UNKNOWN || simState !== EXPOSE_UNKNOWN;
    bossOpen = approach(bossOpen, exposedOpenTarget(known, exposed, bossIdx, bossView.mode, bossView.modeT), dt, OPEN_RATE);
    // ED1 cue: the core fragments drift out while exposed and reassemble after; the boss shakes
    // only while exposed. The shake is in screen pixels, so it is divided by the fit scale.
    exposeSpread = stepSpread(exposeSpread, exposed, dt);
    if (exposeSpread > 0) exposeOrbit = advancePhase(exposeOrbit, FRAG_ORBIT_HZ, dt);
    if (exposed) exposeShake(exposeAge, (exposeShakePx(bossTier) * exposeAlarm(exposeAge)) / Math.max(fit.scale, 0.01), bossShake);
    else {
      bossShake.x = 0;
      bossShake.y = 0;
    }
    // Boss adds for the hostile look (the boss state owns the list; read only).
    if (bs !== null) {
      for (let k = 0; k < bs.addIds.length && addCount < addIds.length; k++) {
        const id = bs.addIds[k] ?? -1;
        if (id > 0 && w.alive[id] === 1 && w.kind[id] === bs.addKind[k]) addIds[addCount++] = id;
      }
    }
  }

  /** True when entity i is a live boss add this frame. At most 16 compares, no allocation. */
  function isBossAdd(i: number): boolean {
    for (let k = 0; k < addCount; k++) if (addIds[k] === i) return true;
    return false;
  }

  /**
   * Build the exposed shell contexts and glow textures of a boss once, so the first exposure never
   * builds them mid fight. Runs when a boss first shows (its 2 s entrance) and after a texture rebuild.
   */
  function prewarmExposed(b: number): void {
    for (let s = 0; s < BOSS_OPEN_STEPS; s++) {
      const slot = exposedBossSlot(b, s);
      contextForSlot(slot);
      glowTextureFor(slot);
    }
    if (b === BOSS_BROOD) {
      // The Broodling slot too, so the split never builds its context and glow texture mid fight.
      const slot = partSlot(PART_BROODLING, bossTierOf(b));
      contextForSlot(slot);
      glowTextureFor(slot);
    }
    prewarmedBoss = b;
  }

  /** True while the boss draws its coreless exposed shell: exposed, or its core still reassembling. */
  function bossCoreless(): boolean {
    return bossView.active && (exposed || exposeSpread > 0);
  }

  /** The broken core cue while exposed and while it reassembles, then sync the cue layer. */
  function drawBossCue(): void {
    resetSpriteBuf(cueBuf);
    if (bossCoreless()) {
      const r = bossView.radius > 0 ? bossView.radius : bossBodyR(bossIdx);
      const e = exposeIn;
      e.x = bossDrawX + bossShake.x;
      e.y = bossDrawY + bossShake.y;
      e.coreR = bossCoreFrac(bossIdx, 1) * r;
      e.pulse = exposePulse(exposePhase);
      e.spread = exposeSpread;
      e.orbit = exposeOrbit;
      e.count = fragmentCount(bossTier);
      e.alpha = bossBodyAlpha(bossView.mode, bossView.modeT);
      // Hot yellow while exposed; whitens as it reassembles, into the baked white core.
      const hot = mixRgb(palette.yellow, 0xffffff, EXPOSE_HOT_WHITE);
      e.hot = exposed ? hot : mixRgb(hot, 0xffffff, 1 - exposeSpread);
      planBossExpose(e, cueBuf, halo);
    }
    if (cueBuf.count > 0 || cueLayer.shown > 0) cueLayer.sync(cueBuf);
  }

  /** One Kind.BossHazard into the hazard sprite buffer, in the boss tier colour. */
  function planHazardAt(w: World, i: number, alpha: number, timeSec: number): void {
    const h = hazardIn;
    h.type = w.a[i] ?? 0;
    h.x = ix(w.prevX[i] ?? 0, w.x[i] ?? 0, alpha);
    h.y = interp(w.prevY[i] ?? 0, w.y[i] ?? 0, alpha);
    h.rot = w.rot[i] ?? 0;
    h.radius = w.radius[i] ?? 0;
    h.vx = w.vx[i] ?? 0;
    h.vy = w.vy[i] ?? 0;
    h.age = w.t[i] ?? 0;
    h.tier = bossTier;
    h.tint = palette[bossColourOf(bossIdx)];
    h.timeSec = timeSec;
    planHazard(h, hazardBuf, haloBoss);
    if (h.type === HAZARD_LANE) laneHazards++;
    // A pull dimples the lattice like a well. Gravitas pulls from its own position instead (the
    // entity pass), so its pull hazard adds no second force.
    const sim = lattice.sim;
    const gravitasPulls = bossView.active && bossIdx === BOSS_GRAVITAS;
    if (h.type === HAZARD_PULL && !gravitasPulls && sim && wellsSeen < MAX_WELLS) {
      addForce(sim, h.x, h.y, h.radius, BOSS_PULL_ACCEL);
      wellsSeen++;
    }
  }

  /**
   * Wave B: tier 2 sprite effects after the entity pass, on the hazard layer (one pooled geometry):
   * the Ember wind up lane (unless the sim drew a lane hazard this frame), the Mirage open arc and
   * window, and the faint Gravitas anchor tethers. All follow the body alpha (entrance, dying).
   */
  function planTier2(timeSec: number): void {
    const tint = palette[bossColourOf(bossIdx)];
    const bx = bossDrawX + bossShake.x;
    const by = bossDrawY + bossShake.y;
    const body = bossBodyAlpha(bossView.mode, bossView.modeT);
    if (bossIdx === BOSS_EMBER) {
      const la = laneHazards > 0 ? 0 : emberLaneAlpha(bossView.mode, bossView.modeT, bossSpeed) * body;
      if (la <= 0) return;
      const dx = Math.cos(bossDrawRot);
      const dy = Math.sin(bossDrawRot);
      const from = EMBER_NOSE * bossBodyR(bossIdx) * bossDrawScale;
      const len = rayWallDistance(features, bx, by, dx, dy, EMBER_LANE_LEN);
      // Look v32: the dash lane glows in the flame palette, shimmering between orange and yellow.
      flameStops(palette, flameRgb);
      const lane = flameColour(flameRgb, 0.35, timeSec, 5);
      if (len > from) planEmberLane(hazardBuf, bx + dx * from, by + dy * from, bossDrawRot, len - from, la, lane, halo);
    } else if (bossIdx === BOSS_MIRAGE) {
      const r = MIRAGE_SHIELD * bossBodyR(bossIdx) * bossDrawScale;
      const open = mirageArcOpenness(bossView.mode, bossView.modeT);
      planMirageArc(hazardBuf, bx, by, r, bossDrawRot, open, bossDrawScale, tint, mixRgb(tint, 0xffffff, 0.6), body, timeSec, halo);
    } else if (bossIdx === BOSS_GRAVITAS) {
      planAnchorTethers(hazardBuf, anchorX, anchorY, anchorCount, bx, by, timeSec, tint, halo);
    }
  }

  /**
   * Wave B: tier 2 effects of the boss body in the entity pass. (x, y) is the drawn centre before the
   * exposed shake, rot the drawn facing. Ember sheds its flame (and dash sparks), Mirage leaves an
   * afterimage and a landing flash on a warp, Gravitas pulls the lattice from its position through
   * the well channel. Trails and sparks are off on Low; the lattice is off where it is off.
   */
  function bossTier2Body(w: World, i: number, x: number, y: number, rot: number, scale: number, dt: number): void {
    const lx = bossLastX;
    const ly = bossLastY;
    bossLastX = x;
    bossLastY = y;
    bossDrawRot = rot;
    bossDrawScale = scale;
    const vx = ((w.x[i] ?? 0) - (w.prevX[i] ?? 0)) / SIM_DT;
    const vy = ((w.y[i] ?? 0) - (w.prevY[i] ?? 0)) / SIM_DT;
    const jumped = Number.isFinite(lx) && Number.isFinite(ly) && warpJumped(x - lx, y - ly);
    // A warp is one sim step: its speed is not a dash.
    bossSpeed = jumped || warpJumped(vx * SIM_DT, vy * SIM_DT) ? 0 : Math.hypot(vx, vy);
    const t = getEffectsTier();
    const tint = palette[bossColourOf(bossIdx)];
    if (bossIdx === BOSS_EMBER) {
      const dashing = emberDashing(bossSpeed);
      const R = bossBodyR(bossIdx) * scale;
      const dx = Math.cos(rot);
      const dy = Math.sin(rot);
      // Flame from the notched tail, blown back along the facing; hot sparks along the dash.
      // Look v32: the dash flame and sparks take the flame palette, shifting colour frame to frame.
      flameStops(palette, flameRgb);
      const ft = w.time;
      const flame = emberFlameRate(bossView.mode, dashing, t);
      if (flame > 0) emitEnemyTrail(emberFlameEm, flame, x - dx * R * 0.4, y - dy * R * 0.4, dx * 300, dy * 300, ENEMY_TRAIL_SWIRL, flameColour(flameRgb, (ft * 3.7) % 0.75, ft, 1), dt);
      else emberFlameEm.acc = 0;
      const spark = emberSparkRate(dashing, t);
      if (spark > 0) emitEnemyTrail(emberSparkEm, spark, x, y, vx, vy, ENEMY_TRAIL_CHARGER, flameAt(flameRgb, 0.7 + ((ft * 5.3) % 0.3)), dt);
      else emberSparkEm.acc = 0;
    } else if (bossIdx === BOSS_MIRAGE && jumped) {
      // Ghost at the old spot (off on Low through afterimageAlpha) and a landing flash at the new one.
      ghostX = lx;
      ghostY = ly;
      ghostRot = rot;
      ghostScale = scale;
      ghostAge = 0;
      const R = bossBodyR(bossIdx) * scale;
      addPulse(pulsePool, PULSE_RING, x, y, 0, R * 0.6, R * 2.4, 0.4, mixRgb(tint, 0xffffff, 0.4), 1);
      const n = landingSparks(t);
      if (n > 0) burstSmall(x, y, tint, n, 120, 360, 0.35);
    } else if (bossIdx === BOSS_GRAVITAS && lattice.sim && wellsSeen < MAX_WELLS) {
      const accel = gravitasLatticeAccel(anchorsLast, bossView.mode, bossView.modeT);
      if (accel < 0) {
        addForce(lattice.sim, x, y, GRAVITAS_LATTICE_R, accel);
        wellsSeen++;
      }
    } else if (bossIdx === BOSS_TEMPEST) {
      const dashing = tempestDashing(bossSpeed);
      const R = bossBodyR(bossIdx) * scale;
      const dx = Math.cos(rot);
      const dy = Math.sin(rot);
      // Slime drips off the tail on the lap (slow ooze at rest); the dash leaves hot ghosts instead.
      const drip = tempestDripRate(bossView.mode, dashing, t);
      if (drip > 0) emitEnemyTrail(tempestDripEm, drip, x - dx * R * 0.5, y - dy * R * 0.5, -dx * 40, -dy * 40, ENEMY_TRAIL_SWIRL, palette.slime, dt);
      else tempestDripEm.acc = 0;
      const ghosts = dashGhostCount(t);
      if (dashing && ghosts > 0 && Number.isFinite(lx) && Number.isFinite(ly)) {
        dashDist += Math.hypot(x - lx, y - ly);
        if (dashGhostDue(dashDist)) {
          dashDist = 0;
          const g = dashGhosts[dashCursor % ghosts];
          dashCursor = (dashCursor + 1) % ghosts;
          if (g) {
            g.x = x;
            g.y = y;
            g.rot = rot;
            g.scale = scale;
            g.age = 0;
          }
        }
      } else dashDist = 0;
    }
  }

  /**
   * Wave D: draw the Prism gem for this frame from the sim clock (w.time) and the boss view: the hue
   * cycle, the chromatic ghost, the phase tint and the run to white before the damage window. Sets
   * prismGlowTint and prismGlow for the body's glow sprite. Colours follow applyNeon's saturation.
   */
  function drawPrism(w: World, x: number, y: number, rot: number, scale: number, alpha: number): void {
    if (!prismLayer) prismLayer = createPrismLayer(entities, BOSS_LINE);
    // G3C: whiteness and flash come from 'sim:bossWindow' (run up and open), never from a cycle
    // guessed off w.time. Before the first event, only the exposed flag of the view counts.
    const isOpen = bossView.exposed === true;
    const c = prismCycle(prismClock, w.time, bossView.mode, isOpen, bossView.exposedT ?? 0);
    const white = bossWin.known ? windowWhite(bossWin) : isOpen ? prismWhite(c) : 0;
    const flash = bossWin.known ? windowFlash(bossWin) : isOpen ? prismFlash(c) : 0;
    const f = prismFrame;
    f.timeSec = w.time;
    f.x = x;
    f.y = y;
    f.rot = rot;
    f.scale = scale;
    f.alpha = alpha;
    f.white = white;
    f.borrowed = palette[prismPhaseKey(bossView.phase)];
    f.saturation = current.saturation;
    f.lod = prismLodFor(getEffectsTier());
    prismLayer.update(f);
    prismDrawn = true;
    prismGlowTint = prismBodyColour(w.time, prismSaturation(current.saturation), f.borrowed, white);
    prismGlow = prismGlowMul(white, flash);
  }

  /** Wave C: the Tempest dash ghosts, pooled views on the exposed boss shell (no Graphics.clear). */
  function drawDashGhosts(): void {
    const live = bossView.active && bossIdx === BOSS_TEMPEST;
    const eff = getEffectsTier();
    const body = live ? bossBodyAlpha(bossView.mode, bossView.modeT) : 0;
    const tint = palette[bossColourOf(BOSS_TEMPEST)];
    for (const g of dashGhosts) {
      const a = live ? dashGhostAlpha(g.age, eff) * body : 0;
      if (a <= 0) {
        if (g.view && g.view.visible) g.view.visible = false;
        continue;
      }
      const slot = exposedBossSlot(BOSS_TEMPEST, 0);
      if (!g.view) {
        g.view = new Graphics(contextForSlot(slot));
        g.view.label = 'bossDashGhost';
        g.slot = slot;
      } else if (g.slot !== slot) {
        g.view.context = contextForSlot(slot);
        g.slot = slot;
      }
      if (g.view.parent !== entities) entities.addChildAt(g.view, 0);
      g.view.visible = true;
      g.view.position.set(g.x, g.y);
      g.view.rotation = g.rot;
      g.view.scale.set(g.scale * dashGhostScale(g.age));
      g.view.tint = mixRgb(tint, 0xffffff, dashGhostWhite(g.age));
      g.view.alpha = a;
    }
  }

  /** Wave B: the Mirage afterimage, one pooled view sharing the boss context (no Graphics.clear). */
  function drawGhost(): void {
    const a = bossView.active && bossIdx === BOSS_MIRAGE ? afterimageAlpha(ghostAge, getEffectsTier()) : 0;
    if (a <= 0) {
      if (ghostView && ghostView.visible) ghostView.visible = false;
      return;
    }
    const slot = bossSlot(bossIdx, 0);
    if (!ghostView) {
      ghostView = new Graphics(contextForSlot(slot));
      ghostView.label = 'bossGhost';
      ghostSlot = slot;
    } else if (ghostSlot !== slot) {
      ghostView.context = contextForSlot(slot);
      ghostSlot = slot;
    }
    if (ghostView.parent !== entities) entities.addChildAt(ghostView, 0);
    ghostView.visible = true;
    ghostView.position.set(ghostX, ghostY);
    ghostView.rotation = ghostRot;
    ghostView.scale.set(ghostScale * afterimageScale(ghostAge));
    ghostView.alpha = a;
  }

  /** Entrance telegraph ring while the boss enters, then sync the hazard layer. */
  function drawHazards(timeSec: number): void {
    if (bossView.active) {
      entranceRing(bossView.mode, bossView.modeT, bossView.radius, entrance);
      if (entrance.alpha > 0) planEntranceRing(hazardBuf, bossDrawX, bossDrawY, entrance.r, entrance.alpha, palette[bossColourOf(bossIdx)], bossTier, haloBoss);
      planTier2(timeSec);
    }
    if (hazardBuf.count > 0 || hazardLayer.shown > 0) hazardLayer.sync(hazardBuf);
    stats.hazardSprites = hazardBuf.count;
  }

  /** Enemy bullets: one layer, one draw call. Tints and halo follow the palette and neon each frame. */
  function drawEnemyBullets(w: World, alpha: number, timeSec: number, dt: number): void {
    const pool = explicitEnemyBullets ?? enemyBulletsOf(w);
    bulletTints[1] = palette[TIER_BULLET_KEY[1]];
    bulletTints[2] = palette[TIER_BULLET_KEY[2]];
    bulletTints[3] = palette[TIER_BULLET_KEY[3]];
    bulletTints[4] = palette[TIER_BULLET_KEY[4]];
    // G3C: the live boss's bullets take its own hue (attack colour family per boss).
    if (bossView.active) bulletTints[bossTier] = palette[bossAttackKey(bossIdx)];
    bulletFrame.alpha = alpha;
    bulletFrame.timeSec = timeSec;
    bulletFrame.effects = getEffectsTier();
    // Look v32: Ember's fan bullets take the flame palette while Ember is the live boss.
    if (bossView.active && bossIdx === BOSS_EMBER) {
      flameStops(palette, flameRgb);
      bulletFrame.flame = flameRgb;
    } else bulletFrame.flame = null;
    enemyBulletLayer.draw(pool, bulletFrame, dt);
    stats.enemyBullets = enemyBulletLayer.live;
    stats.bulletSprites = enemyBulletLayer.layer.shown;
  }

  /**
   * Mirror the hit pool onto its Particles. Skipped outright when none is live and none is still
   * showing. Mirror first, then age, so a new flash draws at full strength on its first frame.
   * Alpha follows the neon glow like the other map effects (a multiplier, not a SPEC 4 write).
   */
  function drawHitFx(dt: number): void {
    if (hitPool.live === 0 && !hitShown) return;
    const gain = mapFxNeonGain(current.glowAlpha);
    let any = false;
    for (let i = 0; i < hitPool.cap; i++) {
      const p = hitItems[i];
      if (!p) continue;
      if (!pulseLive(hitPool, i)) {
        if (p.x !== PARK) {
          p.x = PARK;
          p.y = PARK;
          p.alpha = 0;
        }
        continue;
      }
      any = true;
      const shape = hitPool.shape[i] ?? PULSE_FLASH;
      const u = (hitPool.age[i] ?? 0) / Math.max(1e-6, hitPool.life[i] ?? 1);
      if (hitPool.fresh[i] === 1) {
        hitPool.fresh[i] = 0;
        const arc = shape === PULSE_ARC;
        p.texture = fxAtlas.frames[arc ? 3 : 4];
        p.anchorX = arc ? fxAtlas.arcAnchorX : 0.5;
        p.anchorY = 0.5;
        p.tint = hitPool.colour[i] ?? 0xffffff;
        p.rotation = hitPool.rot[i] ?? 0;
      }
      p.x = hitPool.x[i] ?? 0;
      p.y = hitPool.y[i] ?? 0;
      const s = shape === PULSE_ARC ? deflectArcScale(u) : hitFlashScale(u);
      p.scaleX = s;
      p.scaleY = s;
      p.alpha = pulseAlpha(shape, u) * (hitPool.strength[i] ?? 1) * gain;
    }
    stepPulses(hitPool, dt);
    hitShown = any;
  }

  /** Drop every hit flash and arc and park its sprite (tier off, level change). */
  function clearHitFx(): void {
    clearPulses(hitPool);
    resetHitThrottle(hitThrottle);
    for (const p of hitItems) {
      p.x = PARK;
      p.y = PARK;
      p.alpha = 0;
    }
    hitShown = false;
  }

  /** Ship comet: push the drawn position, rebuild the ribbon, fade by speed and neon. */
  function drawComet(x: number, y: number, vx: number, vy: number, dt: number): void {
    if (!trailsActive()) {
      hideComet();
      return;
    }
    pushComet(comet, x, y, dt);
    const speed = Math.hypot(vx, vy);
    const a = turboCometAlpha(cometAlpha(speed), speed, turboK) * currentRender.trailAlpha;
    const show = a > 0.01;
    // Keep the ribbon geometry current even while hidden, so it reappears without a jump.
    writeCometStrip(comet, x, y, cometPositions, turboWidth(turboK));
    if (show) cometGeom.getBuffer('aPosition').update();
    cometHalo.visible = show;
    cometCore.visible = show;
    if (!show) return;
    cometCore.alpha = a;
    cometHalo.alpha = a * COMET_HALO_ALPHA;
    // Turbo runs the ribbon hot: the core toward white yellow, the halo toward yellow.
    const hot = mixRgb(palette.yellow, 0xffffff, TURBO_WHITE);
    cometCore.tint = turboK > 0 ? mixRgb(palette.ship, hot, 0.65 * turboK) : palette.ship;
    const halo0 = mixRgb(palette.orange, palette.yellow, COMET_HALO_YELLOW);
    cometHalo.tint = turboK > 0 ? mixRgb(halo0, hot, 0.5 * turboK) : halo0;
  }

  function hideComet(): void {
    resetComet(comet);
    cometUPrimed = false;
    cometHalo.visible = false;
    cometCore.visible = false;
  }

  function superFx(x: number, y: number): void {
    playFx(x, y, { type: 'super' });
  }

  /** Fire superFx at the ship when the game state shows a super activation. */
  function watchSuper(w: World, nowSec: number): void {
    const g = gameState(w);
    superOn = g.superActive !== null && g.superTimer > 0;
    superCur.active = g.superActive;
    superCur.timer = g.superTimer;
    superCur.droneAbsent = g.droneAbsent;
    const sameWorld = w === superWorld;
    if (sameWorld && superFired(superPrev, superCur)) superFx(w.x[0] ?? 0, w.y[0] ?? 0);
    superWorld = w;
    superPrev.active = superCur.active;
    superPrev.timer = superCur.timer;
    superPrev.droneAbsent = superCur.droneAbsent;
    watchTurbo(w, sameWorld, g.superActive, g.superTimer, nowSec);
  }

  /**
   * G3A Turbo: intensity for the comet, sparks and ship glow, and a short burst (hot sparks and a
   * shock ring) on activation, on top of the generic super fx.
   */
  function watchTurbo(w: World, sameWorld: boolean, active: string | null, timer: number, nowSec: number): void {
    turboK = turboIntensity(active, timer, nowSec);
    if (sameWorld && turboActivated(turboPrevActive, turboPrevTimer, active, timer)) {
      const x = w.x[0] ?? 0;
      const y = w.y[0] ?? 0;
      const hot = mixRgb(palette.yellow, 0xffffff, TURBO_WHITE);
      burst(x, y, hot, TURBO_BURST);
      if (mapEffectsOn(getEffectsTier())) addPulse(pulsePool, PULSE_RING, x, y, 0, TURBO_RING_R0, TURBO_RING_R1, TURBO_RING_LIFE, hot, 1);
    }
    turboPrevActive = active;
    turboPrevTimer = timer;
  }
  /** Wall flash for a kill within FLASH_RANGE of a wall (map effect, off on the low tier). */
  function wallFlashAt(x: number, y: number): void {
    if (!mapEffectsOn(getEffectsTier())) return;
    nearestWall(features, x, y, hit);
    const strength = flashStrength(hit.dist);
    if (strength <= 0 || hit.feature < 0) return;
    const f = flashes[flashCursor];
    flashCursor = (flashCursor + 1) % MAX_FLASHES;
    if (!f) return;
    f.feature = hit.feature;
    f.s0 = hit.s0;
    f.s1 = hit.s1;
    f.age = 0;
    f.strength = strength;
    flashDirty = true;
  }

  /** Start an expanding flash circle (Blink arrival, Slime splat). Tells: on every tier. */
  function addPop(x: number, y: number, r0: number, r1: number, life: number, colour: PaletteKey): void {
    const p = pops[popCursor];
    popCursor = (popCursor + 1) % MAX_POPS;
    if (!p) return;
    p.x = x;
    p.y = y;
    p.r0 = r0;
    p.r1 = r1;
    p.life = life;
    p.age = 0;
    p.colour = colour;
    enemyFxDirty = true;
  }

  const offFx = [
    bus.on('fx:kill', (p) => {
      playFx(p.x, p.y, { type: 'kill', colour: p.colour });
      wallFlashAt(p.x, p.y);
    }),
    // Threat level from the sim (Swarm, wave C), at most every 100 ms; eased per frame.
    bus.on('sim:threat', (p) => {
      threatTarget = clampThreat(p.level);
    }),
    bus.on('fx:death', (p) => playFx(p.x, p.y, { type: 'death' })),
    bus.on('fx:bomb', (p) => playFx(p.x, p.y, { type: 'bomb' })),
    bus.on('fx:geom', (p) => playFx(p.x, p.y, { type: 'geom' })),
    // Weapon pickup collected (Swarm, wave B): a burst in the weapon's bullet colour.
    bus.on('fx:pickup', (p) => burst(p.x, p.y, palette[weaponTint(p.weapon)], PICKUP_BURST_COUNT)),
    // Damage that did not kill, or a Bulwark shield block (run 0198). The payload is reused.
    bus.on('fx:hit', (p) => onHit(p.x, p.y, p.kind, p.id, p.blocked)),
    // V3 boss events (Swarm, wave A). Payloads are reused: read the fields now.
    bus.on('sim:bossEnter', (p) => onBossEnter(p.id)),
    bus.on('sim:bossPhase', (p) => onBossPhase(p.id)),
    // v31: Brood split into three Broodlings (Swarm, merged): the green shard burst.
    bus.on('sim:bossSplit', () => onBossSplit()),
    bus.on('sim:bossDown', (p) => onBossDown(p.id, p.x, p.y)),
    // G3A: weak point exposure (Swarm, parallel run). Coded against the event name.
    onBossExposed(bus, (on) => {
      exposeEvent = exposeState(on);
    }),
    // G3C: the Prism window and the 66 and 33 percent cracks (Swarm, parallel run).
    onBossWindow(bus, onWindow),
    onBossCrack(bus, onCrack),
    // v31: a gravity well erupts into a supernova (Swarm, parallel run).
    onWellNova(bus, (id, x, y) => {
      novaEvent(nova, id, x, y);
    }),
    // Look GW2: the arrival ring, the snake emergence burst and the boss shield shell.
    onWellArrive(bus, (id, x, y, inSec) => {
      arriveEvent(arrive, id, x, y, inSec);
    }),
    onWellSpawn(bus, (_id, x, y) => {
      emergeEvent(emerge, x, y);
      burstSmall(x, y, NOVA_WHITE, EMERGE_BURST, 160, 420, 0.45);
    }),
    onBossShield(bus, (up) => {
      shell.evUp = up;
    }),
    // R2 (Forge): an enemy came through a membrane and stays enraged; an open drum burst is due.
    bus.on('sim:enrage', (p) => markEnraged(enraged, p.id)),
    bus.on('sim:driftBurst', (p) => driftBurstEvent(streaks, p.inSec, p.dir)),
    // T4 (Forge): a super nova well was destroyed; the pond wave starts at once, no telegraph.
    bus.on('sim:ripple', (p) => addPondWave(pondWaves, p.x, p.y, p.strength)),
  ];
  offFx.push(
    onEffectsTierChanged((t) => {
      applyLatticeTier(t);
      // Attached trail frame and length follow the tier; the comet and pulses hide on low.
      restyleBullets();
      if (!trailsOn(t)) hideComet();
      if (!mapEffectsOn(t)) {
        clearPulseFx();
        bossEdgeAge = Number.POSITIVE_INFINITY;
      }
      if (!hitFxOn(t)) clearHitFx();
    }),
  );
  registerParticleStress(setParticleStress);

  function stepEffects(dt: number): void {
    stepShake(shake, dt, shakeOff);
    world.position.set(fit.x + shakeOff.x, fit.y + shakeOff.y);
    if (ripples.length > 0 || pondWaves.length > 0 || gridRippling) {
      stepRipples(ripples, dt);
      // Trough wave: the trough grid is static (ripples do not bend it), so it is never redrawn here.
      if (!drum || !drum.trough) redrawGrid();
    }
    if (ringList.length > 0 || rings.visible) {
      rings.clear();
      ringGlow.clear();
      for (let i = ringList.length - 1; i >= 0; i--) {
        const r = ringList[i];
        if (!r) continue;
        r.age += dt;
        if (r.age >= RING_LIFE) {
          ringList.splice(i, 1);
          continue;
        }
        const f = 1 - r.age / RING_LIFE;
        const rad = 20 + r.age * RING_SPEED;
        const color = palette[r.colour];
        if (drum) {
          // G10: a shock ring is a circle on the surface, sampled round its centre through the drum.
          penBegin(ringPen, rings, drum);
          penBegin(ringGlowPen, ringGlow, drum);
          traceRing(ringPen, traceReset(fxTrace), r.x, r.y, rad);
          penStrokeTrace(ringPen, fxTrace, 26 * f, color, 0.25 * f);
          penStrokeTrace(ringPen, fxTrace, 6, color, f);
          if (bloomOn) penStrokeTrace(ringGlowPen, fxTrace, 12, color, f);
          continue;
        }
        rings.circle(r.x, r.y, rad).stroke({ width: 26 * f, color, alpha: 0.25 * f });
        rings.circle(r.x, r.y, rad).stroke({ width: 6, color, alpha: f });
        if (bloomOn) ringGlow.circle(r.x, r.y, rad).stroke({ width: 12, color, alpha: f });
      }
      rings.visible = ringList.length > 0;
      ringGlow.visible = rings.visible && bloomOn;
    }
    stepMapFx(dt);
  }

  /**
   * Threat pulse and wall flashes. Both are alpha multipliers on their own layers, scaled by the
   * neon gain; neither writes a SPEC 4 value. Off (hidden, flashes dropped) on the low tier.
   */
  function stepMapFx(dt: number): void {
    threatShown = easeThreat(threatShown, threatTarget, dt);
    if (!mapEffectsOn(getEffectsTier())) {
      if (wallPulse.visible) wallPulse.visible = false;
      if (wallFlash.visible || flashDirty) {
        for (const f of flashes) f.age = FLASH_LIFE;
        wallFlash.clear();
        wallFlash.visible = false;
        flashDirty = false;
      }
      return;
    }
    const gain = mapFxNeonGain(current.glowAlpha);
    threatPulse(threatShown, pulse);
    pulsePhase = (pulsePhase + pulse.hz * dt) % 1;
    const a = wallPulseAlpha(pulse.amp, pulsePhase) * gain;
    // V3: the boss entrance edge pulse takes over the wall pulse layer while it is the stronger.
    const edge = bossEdgePulse(bossEdgeAge) * gain;
    wallPulse.visible = a > 0.004 || edge > 0.004;
    if (wallPulse.visible) {
      wallPulse.alpha = edge > a ? edge : a;
      wallPulse.tint = edge > a ? palette[bossEdgeKey] : mixRgb(palette.grid, palette.red, threatShown * PULSE_WARM_MAX);
    }
    if (!flashDirty) return;
    wallFlash.clear();
    let any = false;
    const s = Math.max(fit.scale, 0.01);
    const colour = mixRgb(palette.grid, 0xffffff, 0.55);
    for (const f of flashes) {
      if (f.age >= FLASH_LIFE) continue;
      f.age += dt;
      const fa = f.strength * flashFade(f.age) * gain;
      const feat = features[f.feature];
      if (fa <= 0 || !feat) continue;
      any = true;
      if (drum) {
        // G10: the flash lies on the wall, sampled along it through the drum.
        penBegin(flashPen, wallFlash, drum);
        const t = traceReset(fxTrace);
        if (feat.t === 'seg') {
          const dx = feat.x2 - feat.x1;
          const dy = feat.y2 - feat.y1;
          traceLine(flashPen, t, feat.x1 + dx * f.s0, feat.y1 + dy * f.s0, feat.x1 + dx * f.s1, feat.y1 + dy * f.s1);
        } else traceArc(flashPen, t, feat.cx, feat.cy, feat.r, f.s0, f.s1);
        penStrokeTrace(flashPen, t, (WALL_GLOW_PX * 2) / s, colour, fa * 0.4, 'round');
        penStrokeTrace(flashPen, t, (WALL_LINE_PX * 2) / s, colour, fa, 'round');
        continue;
      }
      for (let pass = 0; pass < 2; pass++) {
        if (feat.t === 'seg') {
          const dx = feat.x2 - feat.x1;
          const dy = feat.y2 - feat.y1;
          wallFlash.moveTo(feat.x1 + dx * f.s0, feat.y1 + dy * f.s0).lineTo(feat.x1 + dx * f.s1, feat.y1 + dy * f.s1);
        } else {
          wallFlash.moveTo(feat.cx + Math.cos(f.s0) * feat.r, feat.cy + Math.sin(f.s0) * feat.r);
          wallFlash.arc(feat.cx, feat.cy, feat.r, f.s0, f.s1);
        }
        if (pass === 0) wallFlash.stroke({ width: (WALL_GLOW_PX * 2) / s, color: colour, alpha: fa * 0.4, cap: 'round' });
        else wallFlash.stroke({ width: (WALL_LINE_PX * 2) / s, color: colour, alpha: fa, cap: 'round' });
      }
    }
    wallFlash.visible = any;
    flashDirty = any;
  }

  function setBloomEnabled(on: boolean): void {
    const changed = on !== bloomOn;
    bloomOn = on;
    bloomLayer.filters = on ? [bloom] : [];
    wallGlow.visible = on; // fallback: the crisp walls carry their own halo strokes
    membraneGlowG.visible = on;
    streakGlowG.visible = on;
    ringGlow.visible = on && rings.visible;
    stats.glowPath = on ? 'bloom' : 'fallback';
    if (changed || glowTexturesDirty) rebuildGlowTextures();
  }

  function hideSlot(i: number): void {
    clearEnraged(enraged, i);
    const v = views[i];
    if (v && v.visible) v.visible = false;
    const s = glowViews[i];
    if (s && s.visible) s.visible = false;
    enemyPhase[i] = Number.NaN;
    lastDrawX[i] = Number.NaN;
    const em = enemyEmitters[i];
    if (em) em.acc = 0;
  }

  // Per entity draw values for the v2 kinds, written by applyEnemyContract (no allocation).
  const ev = { x: 0, y: 0, alpha: 1, scaleX: 1, scaleY: 1, rot: 0, glowMul: 1 };

  /** The fx pens for this frame (the identity off the drum). */
  function fxPens(): void {
    penBegin(fxPen, enemyFx, drum);
    penBegin(fxGlowPen, enemyFxGlow, drum);
  }

  /** Stroke the traced fx line: halo and core on the crisp layer, plus a copy in the bloom layer. */
  function fxStrokeTrace(t: PenTrace, width: number, colour: number, a: number, join: 'round' | 'miter' = 'miter'): void {
    fxPens();
    const halo = currentRender.haloAlpha * a;
    if (halo > 0) penStrokeTrace(fxPen, t, width * currentRender.haloWidthMul, colour, halo, 'round', join);
    penStrokeTrace(fxPen, t, width, colour, a, 'round', join);
    if (bloomOn) penStrokeTrace(fxGlowPen, t, width * 2, colour, a, 'round', join);
    enemyFxDirty = true;
  }

  /** One fx line on the surface (sampled through the drum on a cylinder), three passes. */
  function fxLine(x1: number, y1: number, x2: number, y2: number, width: number, colour: number, a: number): void {
    fxPens();
    traceLine(fxPen, traceReset(fxTrace), x1, y1, x2, y2);
    fxStrokeTrace(fxTrace, width, colour, a);
  }

  /** One fx ray on the surface: from (x, y) along (dx, dy), distances d0 to d1, three passes. */
  function fxRay(x: number, y: number, dx: number, dy: number, d0: number, d1: number, width: number, colour: number, a: number): void {
    fxPens();
    traceRay(fxPen, traceReset(fxTrace), x, y, dx, dy, d0, d1);
    fxStrokeTrace(fxTrace, width, colour, a);
  }

  /** One fx circle outline round an owner at (x, y) (it attaches to the owner on the drum), same three passes. */
  function fxCircle(x: number, y: number, r: number, width: number, colour: number, a: number): void {
    fxPens();
    const halo = currentRender.haloAlpha * a;
    if (halo > 0) {
      penCircle(penOwner(fxPen, x, y), x, y, r);
      penStroke(fxPen, width * currentRender.haloWidthMul, colour, halo);
    }
    penCircle(penOwner(fxPen, x, y), x, y, r);
    penStroke(fxPen, width, colour, a);
    if (bloomOn) {
      penCircle(penOwner(fxGlowPen, x, y), x, y, r);
      penStroke(fxGlowPen, width * 2, colour, a);
    }
    enemyFxDirty = true;
  }

  /**
   * Charger wind up lane (GC: make it unmistakable). A translucent band exactly as wide as the
   * dash sweeps, two rails, a bright centre line, an end bar where the dash stops at a wall or
   * at full length, and chevrons that crawl toward the dash direction. (x, y) is the Charger,
   * (dx, dy) the unit heading, len the lane length, la the lane alpha, phase the w.t phase.
   */
  function drawChargerLane(x: number, y: number, dx: number, dy: number, len: number, la: number, phase: number): void {
    const colour = palette.charger;
    const nx = -dy * CHARGER_LANE_HALF;
    const ny = dx * CHARGER_LANE_HALF;
    // G10: every part is a line on the surface, sampled from the Charger along the dash direction
    // (drumPen.ts traceRay), so on a cylinder the lane bends round the drum and turns with it.
    fxPens();
    if (len > 16) {
      const t = traceReset(fxTrace);
      traceRay(fxPen, t, x + nx, y + ny, dx, dy, 16, len);
      traceRay(fxPen, t, x - nx, y - ny, dx, dy, len, 16);
      penFillTrace(fxPen, t, colour, CHARGER_LANE_FILL * la);
      fxRay(x + nx, y + ny, dx, dy, 16, len, 1.4, colour, la * 0.75);
      fxRay(x - nx, y - ny, dx, dy, 16, len, 1.4, colour, la * 0.75);
    }
    fxRay(x, y, dx, dy, 16, len, 2, colour, la);
    const x1 = x + dx * len;
    const y1 = y + dy * len;
    fxLine(x1 + nx, y1 + ny, x1 - nx, y1 - ny, 2.4, colour, la);
    const n = chargerChevrons(len);
    const cs = CHARGER_CHEVRON_SIZE;
    const crawl = (phase * 120) % CHARGER_CHEVRON_GAP;
    for (let k = 0; k < n; k++) {
      const d = 30 + crawl + k * CHARGER_CHEVRON_GAP;
      if (d > len - 8) break;
      const px = x + dx * d;
      const py = y + dy * d;
      const bx = px - dx * cs;
      const by = py - dy * cs;
      const t = traceReset(fxTrace);
      tracePoint(fxPen, t, bx - dy * cs, by + dx * cs);
      tracePoint(fxPen, t, px, py);
      tracePoint(fxPen, t, bx + dy * cs, by - dx * cs);
      penStrokeTrace(fxPen, t, 2, colour, la, 'round', 'round');
    }
    enemyFxDirty = true;
  }

  /**
   * Render contract for the v2 kinds (docs/10 wave C table): per kind alpha, scale and turn, plus
   * the tells (Charger lane, Blink ring and arrival, Slime splat) and the trails (Swirl, Charger
   * dash). Telegraphing entities draw no tells or trails. Reads the World, writes only render.
   */
  function applyEnemyContract(w: World, i: number, kind: number, tele: boolean, timeSec: number, dt: number): void {
    const t = w.t[i] ?? 0;
    const prevT = enemyPhase[i] ?? Number.NaN;
    enemyPhase[i] = t;
    const em = enemyEmitters[i];
    const trails = trailsActive() && !tele;
    // Drawn velocity from the last sim step (Blink keeps its destination in vx and vy).
    const vx = ((w.x[i] ?? 0) - (w.prevX[i] ?? 0)) / SIM_DT;
    const vy = ((w.y[i] ?? 0) - (w.prevY[i] ?? 0)) / SIM_DT;
    if (kind === KIND_NUM.charger) {
      if (tele) return;
      const la = chargerLaneAlpha(t);
      const dx = Math.cos(ev.rot);
      const dy = Math.sin(ev.rot);
      if (la > 0) {
        const len = rayWallDistance(features, ev.x, ev.y, dx, dy, CHARGER_LANE_LEN);
        drawChargerLane(ev.x, ev.y, dx, dy, len, la, t);
      } else if (chargerDashing(t) && trailsActive()) {
        const len = chargerStreakLen(t);
        if (len > 4) fxRay(ev.x, ev.y, dx, dy, -8, -len, 4, palette.charger, 0.7 * chargerStreak(t));
        if (trails && em) emitEnemyTrail(em, CHARGER_DASH_TRAIL_RATE, ev.x, ev.y, vx, vy, ENEMY_TRAIL_CHARGER, palette.charger, dt);
      } else if (em) em.acc = 0;
    } else if (kind === KIND_NUM.blink) {
      ev.alpha *= blinkGhostAlpha(t);
      // Jump streak (run 0180): the drawn position jumped since the last frame.
      const lx = lastDrawX[i] ?? Number.NaN;
      const ly = lastDrawY[i] ?? Number.NaN;
      lastDrawX[i] = ev.x;
      lastDrawY[i] = ev.y;
      if (tele) return;
      if (trails && Number.isFinite(lx) && Number.isFinite(ly)) {
        const jx = ev.x - lx;
        const jy = ev.y - ly;
        if (jx * jx + jy * jy > BLINK_SNAP_U * BLINK_SNAP_U) {
          addPulse(pulsePool, PULSE_STREAK, ev.x, ev.y, Math.atan2(jy, jx), Math.hypot(jx, jy), 0.9, STREAK_LIFE, palette.blink, 1);
          emitBlinkStreak(lx, ly, ev.x, ev.y, palette.blink);
        }
      }
      blinkRing(t, ringScratch);
      if (ringScratch.alpha > 0) fxCircle(w.vx[i] ?? 0, w.vy[i] ?? 0, ringScratch.r, 2, palette.blink, ringScratch.alpha);
      if (blinkArrived(prevT, t)) {
        addPop(ev.x, ev.y, 10, 36, 0.25, 'blink');
        burstSmall(ev.x, ev.y, palette.blink, 12, 150, 380, 0.3);
      }
    } else if (kind === KIND_NUM.swirl) {
      if (trails && em) emitEnemyTrail(em, SWIRL_TRAIL_RATE, ev.x, ev.y, vx, vy, ENEMY_TRAIL_SWIRL, palette.swirl, dt);
    } else if (kind === KIND_NUM.splime) {
      const sw = splimeSwell(t);
      ev.scaleX *= sw;
      ev.scaleY *= sw;
      // Drop telegraph: a footprint ring growing to the puddle size where the Slime will land.
      if (!tele) {
        splimeDropRing(t, splimeRingScratch);
        if (splimeRingScratch.alpha > 0) fxCircle(ev.x, ev.y, splimeRingScratch.r, 2, palette.splime, splimeRingScratch.alpha);
      }
    } else if (kind === KIND_NUM.mine) {
      ev.alpha *= mineAlpha(t);
    } else if (kind === KIND_NUM.slime) {
      const h = hash01(i);
      const r = w.radius[i] ?? 0;
      const base = (r > 0 ? r / SLIME_RADIUS : 1) * slimeScale(t);
      const wob = SLIME_WOBBLE_AMP * Math.sin((timeSec * SLIME_WOBBLE_HZ + h) * TAU);
      ev.scaleX = base * (1 + wob);
      ev.scaleY = base * (1 - wob);
      ev.rot = h * TAU + timeSec * SLIME_SPIN * (h < 0.5 ? -1 : 1);
      ev.alpha *= slimeAlpha(t);
      ev.glowMul = SLIME_GLOW_MUL;
      // Splat when a puddle lands: first sight of a fresh one, or its age restarted (id reuse).
      if ((Number.isNaN(prevT) || t < prevT) && slimeFresh(t)) {
        addPop(ev.x, ev.y, 18 * base, 50, 0.3, 'splime');
        burstSmall(ev.x, ev.y, palette.splime, 10, 60, 200, 0.35);
      }
    }
  }

  /**
   * Run 0180 trails and sparkle on two v1 kinds: the Dart leaves a trail in its orange while it
   * moves fast, and a geom twinkles (glow alpha through ev.glowMul) and sheds tiny sparkles.
   * Trails and sparkles are off on low; the twinkle is a multiplier on the glow sprite only.
   */
  function applyV1Sparkle(w: World, i: number, kind: number, tele: boolean, timeSec: number, dt: number): void {
    const em = enemyEmitters[i];
    if (!em) return;
    if (tele || !trailsActive()) {
      em.acc = 0;
      return;
    }
    if (kind === KIND_DART) {
      const vx = ((w.x[i] ?? 0) - (w.prevX[i] ?? 0)) / SIM_DT;
      const vy = ((w.y[i] ?? 0) - (w.prevY[i] ?? 0)) / SIM_DT;
      emitEnemyTrail(em, dartTrailRate(Math.hypot(vx, vy)), ev.x, ev.y, vx, vy, ENEMY_TRAIL_DART, palette.orange, dt);
      return;
    }
    ev.glowMul = geomTwinkle(timeSec, hash01(i * 7 + 3));
    emitGeomSparkle(em, ev.x, ev.y, sparkleColour, dt);
  }

  /** Expanding flash circles (arrival, splat). Drawn after the entity pass. */
  function drawPops(dt: number): void {
    for (const p of pops) {
      if (p.age >= p.life) continue;
      p.age += dt;
      const u = p.age / p.life;
      if (u >= 1) continue;
      const ease = 1 - (1 - u) * (1 - u);
      fxCircle(p.x, p.y, p.r0 + (p.r1 - p.r0) * ease, 2.5 * (1 - u) + 0.5, palette[p.colour], 1 - u);
    }
  }

  /** Add the outline path of the live boss at a body transform (moveTo and lineTo, no allocation). */
  function outlinePath(g: Graphics, x: number, y: number, rot: number, scale: number): void {
    const p = BOSS_OUTLINES[bossIdx] ?? null;
    if (p === null || p.t === 'line' || p.t === 'rect') {
      g.circle(x, y, bossBodyR(bossIdx) * scale);
      return;
    }
    if (p.t === 'circle') g.circle(x, y, p.r * scale);
    else if (p.t === 'regularPoly') g.regularPoly(x, y, p.r * scale, p.sides, rot + p.rot);
    else polyPath(g, p, x, y, rot, scale);
  }

  function polyPath(g: Graphics, p: Extract<ShapePrim, { t: 'poly' }>, x: number, y: number, rot: number, scale: number): void {
    const c = Math.cos(rot) * scale;
    const s = Math.sin(rot) * scale;
    const pts = p.pts;
    for (let k = 0; k + 1 < pts.length; k += 2) {
      const lx = pts[k] ?? 0;
      const ly = pts[k + 1] ?? 0;
      const wx = x + lx * c - ly * s;
      const wy = y + lx * s + ly * c;
      if (k === 0) g.moveTo(wx, wy);
      else g.lineTo(wx, wy);
    }
    g.closePath();
  }

  /** Add a unit space polyline or triangle (body radii) at a transform; close for a filled wedge. */
  function unitPath(g: Graphics, pts: Float32Array, n: number, x: number, y: number, rot: number, rs: number, close: boolean): void {
    const c = Math.cos(rot) * rs;
    const s = Math.sin(rot) * rs;
    for (let k = 0; k < n; k++) {
      const lx = pts[k * 2] ?? 0;
      const ly = pts[k * 2 + 1] ?? 0;
      const wx = x + lx * c - ly * s;
      const wy = y + lx * s + ly * c;
      if (k === 0) g.moveTo(wx, wy);
      else g.lineTo(wx, wy);
    }
    if (close) g.closePath();
  }

  /** Add a short arc along the boss outline from a0 to a1 (local radians) at the body transform. */
  function outlineArc(g: Graphics, a0: number, a1: number, x: number, y: number, rot: number, sc: number): void {
    const p = BOSS_OUTLINES[bossIdx];
    if (p === undefined) return;
    for (let q = 0; q <= 6; q++) {
      const t = a0 + ((a1 - a0) * q) / 6;
      const r = outlineRadius(p, t) * sc;
      const wx = x + Math.cos(t + rot) * r;
      const wy = y + Math.sin(t + rot) * r;
      if (q === 0) g.moveTo(wx, wy);
      else g.lineTo(wx, wy);
    }
  }

  /** The damaged arc layout of slot at the current stage, as a ShapeSpec (pure, see damagedSpec). */
  function damagedSpecFor(slot: number): ShapeSpec {
    return damagedSpec(specForSlot(slot), bossCracks.arcs, bossCracks.arcCount);
  }

  /**
   * The boss body context for slot: the shared one before any crack, else the damaged copy with
   * the removed arcs cut out of the geometry. Rebuilt only when the slot or stage changes.
   */
  function bossBodyContext(slot: number): GraphicsContext {
    if (bossCracks.stage < 1 || bossCracks.arcCount < 1) return contextForSlot(slot);
    const key = slot * 3 + bossCracks.stage;
    if (dmgCtx === null || dmgKey !== key) {
      if (dmgCtx !== null) retiredContexts.push(dmgCtx);
      dmgCtx = buildContext(damagedSpecFor(slot), currentRender, palette);
      dmgKey = key;
    }
    return dmgCtx;
  }

  /** The boss glow texture for slot: shared before any crack, else the damaged copy's. */
  function bossGlowTexture(slot: number): Texture {
    if (bossCracks.stage < 1 || bossCracks.arcCount < 1) return glowTextureFor(slot);
    const key = (slot * 3 + bossCracks.stage) * 2 + (bloomOn ? 1 : 0);
    if (dmgTex === null || dmgTexKey !== key) {
      const old = dmgTex;
      dmgTex = makeKindTexture(slot, !bloomOn, damagedSpecFor(slot));
      dmgTexKey = key;
      // The sprite is reassigned to the new texture in the same frame, before any render.
      if (old !== null) retiredTextures.push(old);
    }
    return dmgTex;
  }

  /**
   * Look v33 battle damage over the damaged body (the removed arcs are already cut out of the body
   * geometry, see bossBody). On g: the remaining outline for EDGE_SPAN either side of each gap,
   * hue shifted toward the accent (dmgCol.edge) on an uneven flicker, and a short bright stub at
   * each torn end in the boss primary at 1.3x (dmgCol.stub) that flares as the stage lands. Every
   * colour is from damageColours, so nothing is darker than DAMAGE_MIN_L; no erase or dark fill.
   */
  function drawDamage(g: Graphics, rs: number, lw: number, a: number, timeSec: number): void {
    const st = bossCracks.stage;
    const n = bossCracks.arcCount;
    const outline = BOSS_OUTLINES[bossIdx];
    if (st < 1 || n < 1 || outline === undefined) return;
    const x = bodyX[0] ?? 0;
    const y = bodyY[0] ?? 0;
    const rot = bodyRot[0] ?? 0;
    const sc = bodyScale[0] ?? 1;
    const flare = 1 + 0.8 * Math.max(0, 1 - bossCracks.age / BREAK_SETTLE_SEC);
    for (let k = 0; k < n; k++) {
      const a0 = bossCracks.arcs[k * 2] ?? 0;
      const a1 = bossCracks.arcs[k * 2 + 1] ?? 0;
      // The outline beside each torn end shifts hue toward the accent and flickers.
      outlineArc(g, a0 - EDGE_SPAN, a0, x, y, rot, sc);
      g.stroke({ width: lw * 1.15, color: dmgCol.edge, alpha: edgeFlicker(timeSec, k * 2) * a, cap: 'round' });
      outlineArc(g, a1, a1 + EDGE_SPAN, x, y, rot, sc);
      g.stroke({ width: lw * 1.15, color: dmgCol.edge, alpha: edgeFlicker(timeSec, k * 2 + 1) * a, cap: 'round' });
      // Torn ends: a short bright stub angled out of the line, like a snapped filament.
      for (let e = 0; e < 2; e++) {
        const t = e === 0 ? a0 : a1;
        const r = outlineRadius(outline, t) * sc;
        const ca = Math.cos(t + rot);
        const sa = Math.sin(t + rot);
        const ex = x + ca * r;
        const ey = y + sa * r;
        // Along the tangent into the gap, kinked outward.
        const dir = e === 0 ? 1 : -1;
        const tx = -sa * dir;
        const ty = ca * dir;
        const len = rs * STUB_LEN;
        g.moveTo(ex, ey).lineTo(ex + (tx * 0.8 + ca * 0.6) * len, ey + (ty * 0.8 + sa * 0.6) * len);
        g.stroke({ width: lw * 1.3, color: dmgCol.stub, alpha: Math.min(1, a * flare), cap: 'round' });
        g.circle(ex, ey, lw * 0.9 * flare).fill({ color: dmgCol.stub, alpha: Math.min(1, 0.85 * a * flare) });
      }
    }
  }

  /** The RGB of an accent part of the live boss under the live palette, or -1 when it has none. */
  function accentOf(part: AccentPart): number {
    const t = bossAccent(bossIdx, part);
    return t === null ? -1 : accentRgb(t, palette);
  }

  /** The colour the damage edge shifts toward: the boss's first accent tone, else white. */
  function damageAccent(hue: number): number {
    for (const part of DAMAGE_ACCENT_PARTS) {
      const c = accentOf(part);
      if (c >= 0 && c !== hue) return c;
    }
    return 0xffffff;
  }

  /**
   * Look v32 Ember flame: EMBER_TONGUES tongues round the diamond core licking toward screen up, each
   * shaded in FLAME_BANDS bands from deep red at the root through orange and yellow to a white hot
   * tip, the mix reshuffling every 0.5 s, with a thin bright edge. Motion on the sim clock t.
   */
  function drawEmberFlame(g: Graphics, x: number, y: number, rot: number, rs: number, lw: number, a: number, t: number): void {
    flameStops(palette, flameRgb);
    for (let k = 0; k < EMBER_TONGUES; k++) {
      flameTongue(k, t, rs, rot, flamePts);
      const o = k * TONGUE_FLOATS;
      const rt = o + (FLAME_BANDS + 1) * 2;
      for (let j = 0; j < FLAME_BANDS; j++) {
        const col = flameColour(flameRgb, (j + 0.5) / FLAME_BANDS, t, k);
        g.moveTo(x + (flamePts[o + j * 2] ?? 0), y + (flamePts[o + j * 2 + 1] ?? 0))
          .lineTo(x + (flamePts[o + (j + 1) * 2] ?? 0), y + (flamePts[o + (j + 1) * 2 + 1] ?? 0))
          .lineTo(x + (flamePts[rt + (j + 1) * 2] ?? 0), y + (flamePts[rt + (j + 1) * 2 + 1] ?? 0))
          .lineTo(x + (flamePts[rt + j * 2] ?? 0), y + (flamePts[rt + j * 2 + 1] ?? 0))
          .closePath();
        g.fill({ color: col, alpha: (0.78 - 0.08 * j) * a });
      }
      for (let j = 0; j <= FLAME_BANDS; j++) {
        const px = x + (flamePts[o + j * 2] ?? 0);
        const py = y + (flamePts[o + j * 2 + 1] ?? 0);
        if (j === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      for (let j = FLAME_BANDS - 1; j >= 0; j--) g.lineTo(x + (flamePts[rt + j * 2] ?? 0), y + (flamePts[rt + j * 2 + 1] ?? 0));
      g.stroke({ width: lw * 0.45, color: flameColour(flameRgb, 0.6, t, k + 3), alpha: 0.85 * a, join: 'round' });
    }
  }

  /**
   * Look v32 Spindle thread: two thin white strands wound round the axis, turning, so the spindle
   * reads as spinning. (c, s) is the facing; the strands pinch to the axis at both tips.
   */
  function drawSpindleThread(g: Graphics, x: number, y: number, c: number, s: number, rs: number, lw: number, a: number, timeSec: number): void {
    const n = 16;
    for (let strand = 0; strand < 2; strand++) {
      for (let q = 0; q <= n; q++) {
        const u = -1 + (2 * q) / n;
        const along = u * rs * 0.95;
        const off = Math.sin(u * Math.PI * 2.5 + timeSec * 7 + strand * Math.PI) * rs * 0.15 * (1 - u * u);
        const px = x + c * along - s * off;
        const py = y + s * along + c * off;
        if (q === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke({ width: lw * 0.3, color: 0xffffff, alpha: (strand === 0 ? 0.9 : 0.5) * a, join: 'round' });
    }
  }

  /** v31 two tone: the accent parts of the live boss over its primary body (no allocation). */
  function drawAccents(g: Graphics, rs: number, lw: number, a: number, timeSec: number): void {
    const R = bossBodyR(bossIdx);
    const tint = accentOf;
    const x = bodyX[0] ?? 0;
    const y = bodyY[0] ?? 0;
    const rot = bodyRot[0] ?? 0;
    const sc = bodyScale[0] ?? 1;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    if (bossIdx === BOSS_EMBER) drawEmberFlame(g, x, y, rot, rs, lw, a, flameTime);
    let col = tint('rim');
    if (col >= 0) {
      outlinePath(g, x, y, rot, sc * 0.94);
      g.stroke({ width: lw * 0.55, color: col, alpha: 0.85 * a });
    }
    col = tint('core');
    if (col >= 0) g.circle(x, y, rs * 0.32).stroke({ width: rs * 0.14, color: col, alpha: 0.85 * a });
    col = tint('sparks');
    if (col >= 0) {
      for (let k = 0; k < 4; k++) {
        const ph = timeSec * 0.8 + k * 0.27;
        const u = ph - Math.floor(ph);
        const ang = k * 1.71 + timeSec * 0.9;
        const rr = rs * (0.55 + 0.6 * u);
        g.circle(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, lw * (0.9 - 0.5 * u)).fill({ color: col, alpha: (1 - u) * 0.9 * a });
      }
    }
    col = tint('axis');
    if (col >= 0) {
      g.moveTo(x - c * rs * 0.95, y - s * rs * 0.95).lineTo(x + c * rs * 0.95, y + s * rs * 0.95);
      g.stroke({ width: lw * 0.7, color: col, alpha: 0.9 * a });
    }
    col = tint('tips');
    if (col >= 0) {
      // Look v32: sharp needle tips past the star points on the axis, not round dots.
      for (let e = -1; e <= 1; e += 2) {
        const bx = x + e * c * rs * 0.9;
        const by = y + e * s * rs * 0.9;
        g.moveTo(x + e * c * rs * 1.22, y + e * s * rs * 1.22)
          .lineTo(bx - s * lw * 1.3, by + c * lw * 1.3)
          .lineTo(bx + s * lw * 1.3, by - c * lw * 1.3)
          .closePath();
      }
      g.fill({ color: col, alpha: 0.95 * a });
    }
    if (bossIdx === BOSS_SPINDLE) drawSpindleThread(g, x, y, c, s, rs, lw, a, timeSec);
    col = tint('split');
    if (col >= 0) {
      g.moveTo(x + s * rs * 0.85, y - c * rs * 0.85).lineTo(x - s * rs * 0.85, y + c * rs * 0.85);
      g.stroke({ width: lw * 0.45, color: col, alpha: 0.8 * a });
    }
    col = tint('centre');
    if (col >= 0) g.circle(x, y, rs * 0.39).stroke({ width: rs * 0.12, color: col, alpha: 0.85 * a });
    col = tint('tail');
    if (col >= 0) {
      // A kite tail streaming behind the nose (local -x), waving gently.
      for (let k = 0; k < 6; k++) {
        const u = k / 5;
        const lx = -rs * (0.75 + 0.9 * u);
        const ly = Math.sin(timeSec * 4 + u * 4) * rs * 0.16 * u;
        accentPts[k * 2] = x + lx * c - ly * s;
        accentPts[k * 2 + 1] = y + lx * s + ly * c;
      }
      for (let k = 0; k < 6; k++) {
        if (k === 0) g.moveTo(accentPts[0] ?? x, accentPts[1] ?? y);
        else g.lineTo(accentPts[k * 2] ?? x, accentPts[k * 2 + 1] ?? y);
      }
      g.stroke({ width: lw * 0.6, color: col, alpha: 0.9 * a, cap: 'round' });
    }
    // Twins: one gold and one silver core.
    for (let b = 0; b < bodyCount && b < 2; b++) {
      col = tint(b === 0 ? 'coreA' : 'coreB');
      if (col < 0) break;
      g.circle(bodyX[b] ?? 0, bodyY[b] ?? 0, R * (bodyScale[b] ?? 1) * 0.3).stroke({ width: R * (bodyScale[b] ?? 1) * 0.12, color: col, alpha: 0.9 * a });
    }
  }

  /** Add points k0 to k1 of the band buffer around (x, y) as one polyline. */
  function novaRun(g: DrumPen, x: number, y: number, k0: number, k1: number): void {
    for (let k = k0; k <= k1; k++) {
      const px = x + (novaArm[k * 2] ?? 0);
      const py = y + (novaArm[k * 2 + 1] ?? 0);
      if (k === k0) penMoveTo(g, px, py);
      else penLineTo(g, px, py);
    }
  }

  /** The shared well layer (whirlpools, calm swirls, arrivals, emergences), shown on first use this frame. */
  function wellLayer(): DrumPen {
    if (!novaShown) {
      novaShown = true;
      if (novaG.parent !== entities) entities.addChild(novaG);
    }
    // G9: on a cylinder every point goes through the drum from its owner (drumPen.ts).
    return penBegin(wellPen, novaG, drum);
  }

  /** Add the gas sector outline in gasPts around (x, y) as one closed polygon. */
  function gasRun(g: DrumPen, x: number, y: number): void {
    const n = WHIRL_GAS_PTS * 2;
    for (let k = 0; k < n; k++) {
      const px = x + (gasPts[k * 2] ?? 0);
      const py = y + (gasPts[k * 2 + 1] ?? 0);
      if (k === 0) penMoveTo(g, px, py);
      else penLineTo(g, px, py);
    }
    penClose(g);
  }

  /**
   * Supernova wells (v31, look GW2 whirlpool, GW3 fluid). After the eruption the well becomes a
   * whirlpool of white gas and dust spiralling inward and clockwise on screen, its outer edge at
   * exactly the sim pull radius pullR (no ring): WHIRL_GAS_LAYERS layers of soft white gas filling
   * the space behind each band (denser toward the core), WHIRL_BANDS sheared and wobbling log spiral
   * bands with bright dashes flowing down them, WHIRL_MOTES dust motes on turbulent streamlines,
   * WHIRL_WISPS wisps peeling off the band edges, WHIRL_SPARKS multicolour shimmer sparks riding the
   * flow, and a bright white core flare. Every well draws into one shared Graphics (one batch),
   * rebuilt once per frame. id seeds the flow (hash01, no PRNG). GW4: on Standard and High the gas,
   * bands and wisps are one shader quad (wellFluidView); the motes, spark motes and NOVA_GLINTS gem
   * glints draw on top on every tier.
   */
  function drawNova(slot: number, id: number, x: number, y: number, r: number, pullR: number, timeSec: number): void {
    const g = penOwner(wellLayer(), x, y);
    const age = nova.age[slot] ?? 0;
    const grow = novaGrow(age);
    const shift = novaShift(age);
    const reach = Math.max(r, pullR) * grow;
    // GW6: everything but the shader quad and its haze lives in the smaller visual disc.
    const vis = reach * WHIRL_VISUAL;
    const red = palette.red;
    const white = novaWhite(red, shift);
    novaCycleStops(palette, novaStops);
    const f = novaCoreFlare(age, timeSec);
    const shader = fluidShaderOn(getEffectsTier());
    // GW5 galaxy: every tier flows at GALAXY_SPEED; the arms start at a hashed angle per well.
    const rate = GALAXY_SPEED;
    const armBase = galaxyArmBase(id);
    if (shader) {
      // GW4: Standard and High draw the gas as one shader quad sized to the pull radius (it draws the disc at WHIRL_VISUAL of it plus a faint haze).
      fluidP.x = x;
      fluidP.y = y;
      fluidP.reach = reach;
      fluidP.timeSec = timeSec;
      fluidP.spin = 1;
      fluidP.seed = hash01(id * 7919 + 13) * 64;
      fluidP.alpha = Math.min(1, grow);
      fluidP.core = 0.55 + 0.45 * f;
      fluidP.glow = mapFxNeonGain(current.glowAlpha);
      fluidP.white = white;
      fluidP.hue0 = palette.cyan;
      fluidP.hue1 = palette.magenta;
      fluidP.hue2 = palette.yellow;
      fluidP.hue3 = palette.blue;
      fluidP.arm = galaxyArmUniform(timeSec, armBase, rate);
      fluid.set(slot, fluidP);
    } else {
      // Low keeps the GW3 geometry: gas sectors trailing each band, one fill per layer.
      for (let L = 0; L < WHIRL_GAS_LAYERS; L++) {
        for (let b = 0; b < WHIRL_BANDS; b++) {
          whirlGasSector(timeSec, b, WHIRL_BANDS, L, vis, id, gasPts, rate);
          gasRun(g, x, y);
        }
        penFill(g, white, whirlGasAlpha(L) * grow);
      }
      // Bands: three layered passes, wide and faint to thin and bright, then dashes sliding down.
      for (let b = 0; b < WHIRL_BANDS; b++) {
        whirlBand(timeSec, b, WHIRL_BANDS, vis, novaArm, rate, id);
        novaRun(g, x, y, 0, WHIRL_BAND_PTS - 1);
        penStroke(g, vis * 0.09, white, 0.07 * grow, 'round', 'round');
        novaRun(g, x, y, 0, WHIRL_BAND_PTS - 1);
        penStroke(g, vis * 0.035, white, 0.16 * grow, 'round', 'round');
        novaRun(g, x, y, 0, WHIRL_BAND_PTS - 1);
        penStroke(g, 1.6, white, 0.45 * grow, 'round', 'round');
        const base = (b * Math.PI * 2) / WHIRL_BANDS;
        for (let d = 0; d < WHIRL_DASHES; d++) {
          const u0 = whirlDashU(timeSec, b, d, rate);
          for (let q = 0; q < 4; q++) {
            const u = Math.min(1, u0 + (WHIRL_DASH_U * q) / 3);
            const rr = whirlFlowRadius(u, vis, timeSec, id, b, rate);
            const an = whirlFlowAngle(u, timeSec, base, id, rate);
            if (q === 0) penMoveTo(g, x + Math.cos(an) * rr, y + Math.sin(an) * rr);
            else penLineTo(g, x + Math.cos(an) * rr, y + Math.sin(an) * rr);
          }
          penStroke(g, 2.6, 0xffffff, (0.3 + 0.6 * (1 - u0)) * grow, 'round', 'round');
        }
      }
      // Wisps peel off the band edges and stretch along the flow.
      for (let k = 0; k < WHIRL_WISPS; k++) {
        const wa = whirlWisp(timeSec, id, k, vis, wispPts, rate);
        if (wa <= 0.01) continue;
        for (let q = 0; q < WHIRL_WISP_PTS; q++) {
          const px = x + (wispPts[q * 2] ?? 0);
          const py = y + (wispPts[q * 2 + 1] ?? 0);
          if (q === 0) penMoveTo(g, px, py);
          else penLineTo(g, px, py);
        }
        penStroke(g, 3.2, white, wa * grow, 'round', 'round');
      }
      // The core flares white (the shader draws its own core on the other tiers).
      penCircle(g, x, y, r * 1.5 * grow);
      penFill(g, white, 0.18 * f);
    }
    // Star dust: motes (most on the arms, streaming along them) with tiny twinkles, in four
    // brightness buckets, one fill each. Low keeps half the GW5 count (the GW4 count).
    const moteN = shader ? WHIRL_MOTES : WHIRL_MOTES >> 1;
    for (let k = 0; k < WHIRL_MOTES; k++) {
      if (k >= moteN) {
        motePts[k * 3 + 2] = 0;
        continue;
      }
      whirlMote(timeSec, id, k, vis, novaMote, rate, GALAXY_ARMS, armBase);
      motePts[k * 3] = x + novaMote.x;
      motePts[k * 3 + 1] = y + novaMote.y;
      motePts[k * 3 + 2] = novaMote.a * galaxyTwinkle(id, k, timeSec);
    }
    for (let bk = 0; bk < 4; bk++) {
      const lo = bk / 4;
      const hi = (bk + 1) / 4;
      let any = false;
      for (let k = 0; k < WHIRL_MOTES; k++) {
        const ma = motePts[k * 3 + 2] ?? 0;
        if (ma > lo && ma <= hi) {
          penCircle(g, motePts[k * 3] ?? 0, motePts[k * 3 + 1] ?? 0, 1 + 1.4 * hi);
          any = true;
        }
      }
      if (any) penFill(g, white, ((lo + hi) / 2) * grow);
    }
    // The coloured spark motes stay on top of the gas, steady (the glints are the shimmer now).
    for (let k = 0; k < WHIRL_SPARKS; k++) {
      whirlMote(timeSec, id + 7919, k, vis, novaMote, rate);
      const c = novaStreamColour(novaStops, red, k, timeSec, shift);
      penCircle(g, x + novaMote.x, y + novaMote.y, 1.8);
      penFill(g, c, Math.min(1, novaMote.a * 1.4) * grow);
    }
    // GW4 crystal shimmer: gem glints pop in and out on the flow, prismatic with a white hot centre.
    for (let k = 0; k < NOVA_GLINTS; k++) {
      glintAt(id * 13 + 1, k, timeSec, glint);
      novaGlintSpot(glint.a, glint.b, timeSec, id, vis, glintPt, rate);
      drawGlint(g, x + glintPt.x, y + glintPt.y, glintSize(NOVA_GLINT_SIZE, glint.flare) * grow, glint.rot, novaColour(novaStops, red, glint.hue, 0, shift), glint.flare * grow);
    }
    penCircle(g, x, y, r * (0.6 + 0.25 * f) * grow);
    penFill(g, white, 0.45 * f);
    penCircle(g, x, y, r * 0.32 * grow);
    penFill(g, 0xffffff, 0.7 + 0.3 * f);
  }

  /** GW4: one gem glint: a sharp 4 point star in its hue with a white hot centre star. */
  function drawGlint(g: DrumPen, x: number, y: number, size: number, rot: number, colour: number, a: number): void {
    if (a <= 0.01 || size <= 0.2) return;
    glintStar(x, y, size, rot, glintPts);
    glintRun(g);
    penFill(g, colour, Math.min(1, a));
    glintStar(x, y, size * GLINT_CORE, rot, glintPts);
    glintRun(g);
    penFill(g, 0xffffff, Math.min(1, a * 1.1));
  }

  /** Add the star outline in glintPts as one closed polygon (no array allocation). */
  function glintRun(g: DrumPen): void {
    for (let k = 0; k < GLINT_STAR_PTS; k++) {
      if (k === 0) penMoveTo(g, glintPts[0] ?? 0, glintPts[1] ?? 0);
      else penLineTo(g, glintPts[k * 2] ?? 0, glintPts[k * 2 + 1] ?? 0);
    }
    penClose(g);
  }

  /**
   * R6 shard shimmer: a bright band sweeps across each shard every SHARD_SWEEP_SEC, and 1 or 2 crystal
   * glints (gemGlint.ts) pop on its corners. The band takes a palette mix of the shard colour toward
   * white; the glints take the shard colour with the white hot centre of drawGlint. The pulse itself
   * is applied to the shard view (alpha and glow) in the entity loop.
   */
  function drawShardShimmer(timeSec: number): void {
    if (shardShown) {
      shardG.clear();
      shardShown = false;
    }
    if (shardCount === 0) return;
    shardShown = true;
    const last = entities.children[entities.children.length - 1];
    if (shardG.parent !== entities || (last !== shardG && last !== bossOver)) entities.addChild(shardG);
    const sp = penBegin(shardPen, shardG, drum);
    for (let k = 0; k < shardCount; k++) {
      const x = shardX[k] ?? 0;
      const y = shardY[k] ?? 0;
      const rot = shardRot[k] ?? 0;
      const sc = shardScale[k] ?? 1;
      const h = shardH[k] ?? 0;
      const a = shardA[k] ?? 1;
      const base = shardTint[k] ?? 0xffffff;
      penOwner(sp, x, y);
      const n = shardBandPoly(shardBandCentre(shardSweepPhase(timeSec, h)), shardBand);
      if (n >= 3) {
        const cr = Math.cos(rot);
        const sr = Math.sin(rot);
        for (let q = 0; q < n; q++) {
          const lx = (shardBand[q * 2] ?? 0) * sc;
          const ly = (shardBand[q * 2 + 1] ?? 0) * sc;
          const px = x + lx * cr - ly * sr;
          const py = y + lx * sr + ly * cr;
          if (q === 0) penMoveTo(sp, px, py);
          else penLineTo(sp, px, py);
        }
        penClose(sp);
        penFill(sp, mixRgb(base, palette.white, 0.85), 0.9 * a);
      }
      const gl = shardGlintCount(h);
      for (let g = 0; g < gl; g++) {
        glintAt((shardId[k] ?? 0) * 17 + 3, g, timeSec + h * 5, glint);
        shardCorner(shardCornerIndex(glint.a), rot, shardPt);
        drawGlint(sp, x + shardPt.x * sc, y + shardPt.y * sc, glintSize(SHARD_GLINT_SIZE * sc, glint.flare), glint.rot, base, glint.flare * a);
      }
    }
  }

  /**
   * GW3 Tempestlings: a fast swirl of storm arcs round each one and a bright leading edge (the
   * kite's front edges, white hot) facing its move direction. One Graphics, cleared only while it
   * holds content, kept just under the boss identity layer.
   */
  function drawTempestlings(timeSec: number): void {
    if (stormShown) {
      stormG.clear();
      stormShown = false;
    }
    if (stormCount === 0) return;
    stormShown = true;
    const last = entities.children[entities.children.length - 1];
    if (stormG.parent !== entities || (last !== stormG && last !== bossOver)) entities.addChild(stormG);
    const c = palette.tempestling;
    const hot = 0xffffff;
    // G10: each Tempestling's arcs and edge attach to it on the drum (the identity off it).
    const sp = penBegin(stormPen, stormG, drum);
    for (let k = 0; k < stormCount; k++) {
      const x = stormX[k] ?? 0;
      const y = stormY[k] ?? 0;
      const R = stormR[k] ?? 0;
      const a = stormA[k] ?? 1;
      const h = stormH[k] ?? 0;
      penOwner(sp, x, y);
      for (let j = 0; j < TEMPESTLING_SWIRL_ARCS; j++) {
        const s0 = tempestlingSwirl(timeSec, h, j);
        const rr = R * (TEMPESTLING_SWIRL_R + 0.08 * j);
        stormArc(x, y, rr, s0, s0 + TEMPESTLING_SWIRL_LEN);
      }
      penStroke(sp, 1.8, c, 0.6 * a, 'round');
      // Leading edge: wing, nose, wing of the kite turned to the move direction.
      const L = stormLead[k] ?? 0;
      const cl = Math.cos(L);
      const sl = Math.sin(L);
      const nx = 1.7 * R;
      const bx = 0.15 * R;
      const by = 0.72 * R;
      for (let pass = 0; pass < 2; pass++) {
        penMoveTo(sp, x + cl * bx - sl * by, y + sl * bx + cl * by);
        penLineTo(sp, x + cl * nx, y + sl * nx);
        penLineTo(sp, x + cl * bx + sl * by, y + sl * bx - cl * by);
        if (pass === 0) penStroke(sp, 4.5, c, 0.35 * a, 'butt', 'miter');
        else penStroke(sp, 2, hot, 0.95 * a, 'butt', 'miter');
      }
    }
  }

  /**
   * GW3 nova snakes: every tracked snake (it crawled out of a well) draws a faint white shimmer band
   * and a white core line through its head and segments, with a ribbon of NOVA_SNAKE_GLINTS gem glints
   * orbiting it in a loose helix and, near its well, NOVA_STREAM_GLINTS glints streaming from the
   * whirlpool to the head (GW5). G6 item j: the body and the glint list come from novaSnakeLive.ts
   * (the same code the real game test runs); the band and core line stay on the shared well layer,
   * the glints paint on their own layer over the entity views.
   */
  function drawNovaSnakes(w: World, alpha: number, timeSec: number): void {
    if (novaSnakeCount(novaSnakes) === 0) return;
    const g = wellLayer();
    const st = gs(w);
    if (snakeG.parent !== lines || lines.getChildIndex(snakeG) !== lines.getChildIndex(entities) + 1) lines.addChildAt(snakeG, lines.getChildIndex(entities) + 1);
    snakeShown = true;
    novaCycleStops(palette, novaStops);
    for (let k = 0; k < NOVA_SNAKE_TRACK; k++) {
      const head = novaSnakes.head[k] ?? -1;
      if (head < 0) continue;
      const slot = w.a[head] ?? -1;
      if (slot < 0 || slot >= SNAKE_SLOTS) continue;
      const n = novaSnakeBody(w, st, head, SNAKE_SEGMENTS, alpha, wrapW, snakePts);
      if (n < 1) continue;
      const h = hash01(head);
      if (n >= 2) {
        for (let pass = 0; pass < 2; pass++) {
          for (let q = 0; q < n; q++) {
            // G9: every body point is its own owner (each segment draws where its entity view draws).
            if (q === 0) penOwnerMoveTo(g, snakePts[0] ?? 0, snakePts[1] ?? 0);
            else penOwnerLineTo(g, snakePts[q * 2] ?? 0, snakePts[q * 2 + 1] ?? 0);
          }
          if (pass === 0) penStroke(g, NOVA_SNAKE_GLOW_W, NOVA_WHITE, novaSnakeGlow(timeSec, h), 'round', 'round');
          else penStroke(g, NOVA_SNAKE_CORE_W, 0xffffff, NOVA_SNAKE_CORE_A, 'round', 'round');
        }
      }
      // GW5: the ribbon round the body and, near its well, the stream from the whirlpool.
      const well = st.snakeWell[slot] ?? -1;
      const hasWell = well >= 0 && w.alive[well] === 1 && w.kind[well] === KIND_GRAVITY_WELL;
      const wx = hasWell ? unwrapNear(snakePts[0] ?? 0, ix(w.prevX[well] ?? 0, w.x[well] ?? 0, alpha), wrapW) : 0;
      const wy = hasWell ? interp(w.prevY[well] ?? 0, w.y[well] ?? 0, alpha) : 0;
      // G9: Ryan dropped the snake glints; on the drum they are not drawn at all (no cheap owner).
      if (drum) continue;
      const c = novaSnakeGlints(snakePts, n, head, h, timeSec, hasWell, wx, wy, snakeGlints);
      const sp = penOwner(penBegin(snakePen, snakeG, null), 0, 0);
      for (let q = 0; q < c; q++) {
        const o = q * GLINT_STRIDE;
        drawGlint(
          sp,
          snakeGlints[o] ?? 0,
          snakeGlints[o + 1] ?? 0,
          snakeGlints[o + 2] ?? 0,
          snakeGlints[o + 3] ?? 0,
          novaColour(novaStops, 0xffffff, snakeGlints[o + 4] ?? 0, 0, 1),
          snakeGlints[o + 5] ?? 0,
        );
      }
    }
  }

  /** Add an arc (a0 to a1, clockwise on screen) round (x, y) to the Tempestling layer as its own subpath. */
  function stormArc(x: number, y: number, r: number, a0: number, a1: number): void {
    if (!drum) {
      stormG.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r);
      stormG.arc(x, y, r, a0, a1);
      return;
    }
    // G10: on the drum the arc is sampled round its owner (set by drawTempestlings).
    for (let q = 0; q <= STORM_ARC_STEPS; q++) {
      const t = a0 + ((a1 - a0) * q) / STORM_ARC_STEPS;
      if (q === 0) penMoveTo(stormPen, x + Math.cos(t) * r, y + Math.sin(t) * r);
      else penLineTo(stormPen, x + Math.cos(t) * r, y + Math.sin(t) * r);
    }
  }

  /** Look GW2: a calm small swirl at a well before its nova, so the nova is a clear escalation. */
  function drawCalmSwirl(id: number, x: number, y: number, r: number, timeSec: number): void {
    const g = penOwner(wellLayer(), x, y);
    const reach = r * CALM_REACH;
    const col = mixRgb(palette.red, NOVA_WHITE, 0.35);
    for (let b = 0; b < CALM_BANDS; b++) {
      whirlBand(timeSec, b, CALM_BANDS, reach, novaArm, CALM_RATE, id);
      novaRun(g, x, y, 0, WHIRL_BAND_PTS - 1);
      penStroke(g, 3, col, 0.12, 'round', 'round');
      novaRun(g, x, y, 0, WHIRL_BAND_PTS - 1);
      penStroke(g, 1, col, 0.3, 'round', 'round');
    }
    for (let k = 0; k < CALM_MOTES; k++) {
      whirlMote(timeSec, id, k, reach, novaMote, CALM_RATE);
      penCircle(g, x + novaMote.x, y + novaMote.y, 1.1);
    }
    penFill(g, col, 0.45);
  }

  /**
   * T4: age the pond waves by the sim clock step since the last draw (a pause, the menu or a new
   * level adds nothing), and fire the dev drops behind ?dev=1&pond=1: a strength 1 wave every
   * DEV_POND_PERIOD seconds, at once, with no telegraph.
   */
  function stepPond(simNow: number): void {
    const t = Number.isFinite(simNow) ? simNow : 0;
    const step = pondSimTime < 0 ? 0 : t - pondSimTime;
    pondSimTime = t;
    const d = step > 0 && step < 0.5 ? step : 0;
    if (pondWaves.length > 0) stepPondWaves(pondWaves, d);
    if (!devPond) return;
    if (t < devPondAt - DEV_POND_PERIOD) devPondAt = t + 1;
    if (t >= devPondAt) {
      const drop = devPondDrop(devPondN++, arena.width, arena.height);
      addPondWave(pondWaves, drop.x, drop.y, drop.strength);
      devPondAt = t + DEV_POND_PERIOD;
    }
  }

  /**
   * T4: an outline on each wave crest, so the wave reads on every tier and under tilt (on low it
   * is the only whitening). Each crest is lifted from the grid colour toward white and thickened
   * by its height right now; the bloom picks it up through the neon settings.
   */
  function drawPond(): void {
    if (pondWaves.length === 0) return;
    const g = wellLayer();
    for (const w of pondWaves) {
      penOwner(g, w.x, w.y);
      for (let k = 0; k < POND_CRESTS; k++) {
        const al = crestAlpha(w, k);
        if (al <= 0.01) continue;
        const wh = crestWhite(w, k);
        penCircle(g, w.x, w.y, pondCrestRadius(w.age, k));
        penStroke(g, 2 + 3 * wh, mixRgb(palette.grid, palette.white, wh), al);
      }
    }
  }

  /** Look GW2: arrival rings converging on new wells and the snake emergence bursts and trails. */
  function drawWellFx(): void {
    if (arriveAny(arrive)) {
      const g = wellLayer();
      for (let k = 0; k < arrive.age.length; k++) {
        const age = arrive.age[k] ?? Infinity;
        if (!Number.isFinite(age)) continue;
        const T = arrive.inSec[k] ?? 1;
        const x = arrive.x[k] ?? 0;
        const y = arrive.y[k] ?? 0;
        const p = arriveProgress(age, T);
        const fl = arriveFlash(age, T);
        const fade = age < T ? 1 : fl;
        penOwner(g, x, y);
        if (fade > 0) {
          penCircle(g, x, y, arriveRadius(p));
          penStroke(g, 1.2, NOVA_WHITE, (0.12 + 0.3 * p) * fade);
          for (let d = 0; d < ARRIVE_DOTS; d++) {
            arriveDot(arrive.id[k] ?? 0, d, p, dustPt);
            penCircle(g, x + dustPt.x, y + dustPt.y, 1 + dustPt.a);
          }
          penFill(g, NOVA_WHITE, (0.3 + 0.65 * p) * fade);
        }
        if (fl > 0) {
          penCircle(g, x, y, 24 * (1 + 1.6 * (1 - fl)));
          penFill(g, 0xffffff, 0.55 * fl);
          penCircle(g, x, y, 24 * (1.4 + 2.2 * (1 - fl)));
          penStroke(g, 3, NOVA_WHITE, fl);
        }
      }
    }
    if (emergeAny(emerge)) {
      const g = wellLayer();
      for (let k = 0; k < emerge.age.length; k++) {
        const age = emerge.age[k] ?? Infinity;
        if (!Number.isFinite(age)) continue;
        const x = emerge.x[k] ?? 0;
        const y = emerge.y[k] ?? 0;
        const fl = emergeFlash(age);
        const ta = emergeTrailAlpha(age);
        penOwner(g, x, y);
        penCircle(g, x, y, 10 + 18 * fl);
        penFill(g, 0xffffff, 0.9 * fl);
        penCircle(g, x, y, emergeRing(age));
        penStroke(g, 3, NOVA_WHITE, 0.8 * ta);
        const n = emerge.count[k] ?? 0;
        if (n >= 2) {
          const base = k * EMERGE_TRAIL * 2;
          for (let pass = 0; pass < 2; pass++) {
            for (let q = 0; q < n; q++) {
              const px = emerge.trail[base + q * 2] ?? x;
              const py = emerge.trail[base + q * 2 + 1] ?? y;
              // Each trail point is its own owner, so the trail bends round the drum.
              if (q === 0) penOwnerMoveTo(g, px, py);
              else penOwnerLineTo(g, px, py);
            }
            if (pass === 0) penStroke(g, 7, NOVA_WHITE, 0.22 * ta, 'round', 'round');
            else penStroke(g, 2.2, 0xffffff, 0.85 * ta, 'round', 'round');
          }
        }
      }
    }
  }

  /** Add one drone mode glyph centred at (x, y) to droneFx in colour c. */
  function modeGlyph(glyph: DroneGlyph, x: number, y: number, c: number): void {
    // G10: the glyph attaches to its drone on the drum (the identity off it).
    const g = penOwner(penBegin(dronePen, droneFx, drum), x, y);
    if (glyph === 'dots') {
      const d = glyphDots(GLYPH_HALF);
      for (let k = 0; k + 1 < d.pts.length; k += 2) penCircle(g, x + (d.pts[k] ?? 0), y + (d.pts[k + 1] ?? 0), d.r);
      penFill(g, c, 0.95);
      return;
    }
    const seg = glyphSegments(glyph, GLYPH_HALF);
    for (let k = 0; k + 3 < seg.length; k += 4) {
      penMoveTo(g, x + (seg[k] ?? 0), y + (seg[k + 1] ?? 0));
      penLineTo(g, x + (seg[k + 2] ?? 0), y + (seg[k + 3] ?? 0));
    }
    penStroke(g, 1.6, c, 0.95, 'round', 'round');
  }

  /**
   * Look v33: while a drone mode is armed, its glyph (H, D, R or a doubled dot) floats above each
   * drone in the mode colour and a thin ring in that colour circles the ship, so the arm is
   * unmistakable. Cleared once when the mode ends.
   */
  function drawDroneMode(mode: DroneMode | null): void {
    const g = droneFx;
    if (mode === null || (!droneDrawn && !shipDrawn)) {
      if (droneFxShown) {
        g.clear();
        droneFxShown = false;
      }
      return;
    }
    if (g.parent !== entities) entities.addChild(g);
    g.clear();
    droneFxShown = true;
    const look = DRONE_MODE_LOOKS[mode];
    const c = palette[look.key];
    if (droneDrawn) modeGlyph(look.glyph, droneDrawX, droneDrawY - GLYPH_LIFT, c);
    if (twinDrawn) modeGlyph(look.glyph, twinDrawX, twinDrawY - GLYPH_LIFT, c);
    if (shipDrawn) {
      const sp = penOwner(penBegin(dronePen, droneFx, drum), shipDrawX, shipDrawY);
      penCircle(sp, shipDrawX, shipDrawY, MODE_RING_R);
      penStroke(sp, 1.2, c, 0.6);
    }
  }

  /**
   * GW2 boss shield shell (Warden, or any boss that emits 'sim:bossShield'). Up: a slowly turning
   * hexagon in the Bulwark white, translucent fill and a rim that pulses on every absorbed hit,
   * the core veiled behind it. Dropped: 6 outline shards fly off and the open core pulses bright
   * inside a ring that shrinks over the window. g is the over layer, u the under layer.
   */
  function drawShell(g: Graphics, u: Graphics, rs: number, lw: number, bodyA: number, timeSec: number): void {
    const x = bodyX[0] ?? 0;
    const y = bodyY[0] ?? 0;
    const R = rs * SHELL_PAD;
    const coreR = bossCoreFrac(bossIdx, 1) * rs;
    if (shell.up) {
      const rot = shellRot(timeSec);
      shellDropRot = rot;
      const pulse = shellRimPulse(shell.hitAge);
      const br = shellBreath(timeSec);
      // The core dims behind the shell.
      // GW2 glue: no dark paint on a boss (Ryan's rule); the shielded core reads as frosted white instead.
      u.circle(x, y, coreR * 1.25).fill({ color: 0xf2f2f2, alpha: (1 - SHELL_CORE_DIM) * 0.4 * bodyA });
      for (let k = 0; k <= SHELL_SIDES; k++) {
        shellVertex(k % SHELL_SIDES, rot, R, shellPt);
        if (k === 0) g.moveTo(x + (shellPt[0] ?? 0), y + (shellPt[1] ?? 0));
        else g.lineTo(x + (shellPt[0] ?? 0), y + (shellPt[1] ?? 0));
      }
      g.closePath();
      g.fill({ color: SHELL_WHITE, alpha: (0.1 + 0.12 * pulse) * bodyA });
      for (let k = 0; k <= SHELL_SIDES; k++) {
        shellVertex(k % SHELL_SIDES, rot, R, shellPt);
        if (k === 0) g.moveTo(x + (shellPt[0] ?? 0), y + (shellPt[1] ?? 0));
        else g.lineTo(x + (shellPt[0] ?? 0), y + (shellPt[1] ?? 0));
      }
      g.closePath();
      g.stroke({ width: lw * (1.6 + 2.4 * pulse), color: pulse > 0.05 ? 0xffffff : SHELL_WHITE, alpha: Math.min(1, 0.7 * br + 0.5 * pulse) * bodyA, join: 'miter' });
      // An inner hexagon, counter turning, makes the shell read as a solid layer.
      for (let k = 0; k <= SHELL_SIDES; k++) {
        shellVertex(k % SHELL_SIDES, -rot, R * 0.86, shellPt);
        if (k === 0) g.moveTo(x + (shellPt[0] ?? 0), y + (shellPt[1] ?? 0));
        else g.lineTo(x + (shellPt[0] ?? 0), y + (shellPt[1] ?? 0));
      }
      g.closePath();
      g.stroke({ width: lw * 0.8, color: SHELL_WHITE, alpha: 0.4 * br * bodyA });
      return;
    }
    if (Number.isFinite(shell.dropAge)) {
      for (let k = 0; k < SHELL_SIDES; k++) {
        shellShard(k, shell.dropAge, shellDropRot, R, shard);
        g.moveTo(x + shard.x0, y + shard.y0).lineTo(x + shard.x1, y + shard.y1);
        g.stroke({ width: lw * 1.8, color: SHELL_WHITE, alpha: shard.a * bodyA, cap: 'round' });
      }
    }
    if (shell.openLeft > 0) {
      const share = windowShare(shell.openLeft, shell.openTotal);
      const p = windowCorePulse(timeSec, share);
      g.circle(x, y, coreR * (1 + 0.25 * p)).fill({ color: 0xffffff, alpha: 0.55 * p * bodyA });
      g.circle(x, y, windowRingR(share) * rs).stroke({ width: lw * 1.6, color: 0xffffff, alpha: (0.5 + 0.5 * share) * bodyA });
    }
  }

  /**
   * G10: the boss identity layers are drawn round the boss in arena units. On the drum both get
   * the boss body's billboard transform (drumPen.ts penOwnerMatrix: its screen point, depth scale,
   * mirror and back half alpha), so they sit on the body exactly as its view does. Off the drum
   * they go back to the identity once, and the tilt pass projects them as before.
   */
  function attachBossLayers(g: Graphics, u: Graphics): void {
    if (drum) {
      const a = penOwnerMatrix(penOwner(penBegin(bossPen, g, drum), bodyX[0] ?? 0, bodyY[0] ?? 0), bossAff);
      bossMatrix.set(bossAff.a, bossAff.b, bossAff.c, bossAff.d, bossAff.tx, bossAff.ty);
      g.setFromMatrix(bossMatrix);
      u.setFromMatrix(bossMatrix);
      g.alpha = a;
      u.alpha = a;
      bossAttached = true;
      return;
    }
    if (!bossAttached) return;
    for (const l of [g, u]) {
      l.position.set(0, 0);
      l.scale.set(1, 1);
      l.rotation = 0;
      l.skew.set(0, 0);
      l.alpha = 1;
    }
    bossAttached = false;
  }

  /**
   * G3C boss identity pass, after the bodies: the tier 3 dark red halo (under) and slow red pulse,
   * the Twins survivor flare, the 60 ms white hit flash, the Prism run to white and window ring, the
   * kept cracks and the broken pieces. Two Graphics, rebuilt only while a boss or a piece shows.
   */
  function drawBossIdentity(timeSec: number): void {
    const g = bossOver;
    const u = bossUnder;
    const active = bossView.active && bossSeen;
    let piecesLive = false;
    for (let k = 0; k < PIECES; k++) if ((pieceAge[k] ?? Infinity) < PIECE_LIFE) piecesLive = true;
    if (!active && !piecesLive) {
      if (bossOverShown) {
        g.clear();
        u.clear();
        bossOverShown = false;
      }
      return;
    }
    if (u.parent !== entities) entities.addChildAt(u, 0);
    // bossOver sits over every body.
    if (entities.children[entities.children.length - 1] !== g) entities.addChild(g);
    g.clear();
    u.clear();
    bossOverShown = true;
    attachBossLayers(g, u);
    const hue = palette[bossColourOf(bossIdx)];
    damageColours(hue, damageAccent(hue), dmgCol);
    const hot = mixRgb(hue, 0xffffff, 0.6);
    const R = bossBodyR(bossIdx);
    const lw = BOSS_LINE * tierWeight(bossTier);
    if (active) {
      const bodyA = bossBodyAlpha(bossView.mode, bossView.modeT);
      // Tier 3: wide dark red halo under every body and a slow red pulse over it.
      const ha = tier3HaloAlpha(bossTier, timeSec) * bodyA;
      if (ha > 0) {
        const dark = mixRgb(palette.bossRed, 0x000000, 0.55);
        const pulse = tier3Pulse(bossTier, timeSec);
        for (let b = 0; b < bodyCount; b++) {
          if (b === 0 ? false : bossIdx !== BOSS_TWINS) continue;
          const bs = bodyScale[b] ?? 1;
          const rr = R * bs;
          for (let k = 0; k < 3; k++) {
            u.circle(bodyX[b] ?? 0, bodyY[b] ?? 0, rr * (1.18 + k * 0.16)).stroke({
              width: rr * TIER3_HALO_WIDTH * 0.36,
              color: dark,
              alpha: ha * (1 - k * 0.3),
            });
          }
          outlinePath(g, bodyX[b] ?? 0, bodyY[b] ?? 0, bodyRot[b] ?? 0, bs);
          g.fill({ color: palette.bossRed, alpha: 0.14 * pulse * bodyA }).stroke({ width: lw * 1.4, color: palette.bossRed, alpha: 0.5 * pulse * bodyA });
        }
      }
      // Twins: the enraged survivor flares red at a faster beat.
      const fl = bossIdx === BOSS_TWINS ? twinsFlare(bossView.phase, timeSec) * bodyA : 0;
      if (fl > 0) {
        for (let b = 0; b < bodyCount; b++) {
          const bs = bodyScale[b] ?? 1;
          outlinePath(g, bodyX[b] ?? 0, bodyY[b] ?? 0, bodyRot[b] ?? 0, bs);
          g.stroke({ width: lw * 2, color: palette.red, alpha: fl });
          g.circle(bodyX[b] ?? 0, bodyY[b] ?? 0, R * bs * 1.35).stroke({ width: lw * 1.2, color: palette.red, alpha: fl * 0.6 });
        }
      }
      // Cracks stay until the boss dies.
      const rs = R * (bodyScale[0] ?? 1);
      // Bastion: turret stubs at the four corners keep the fortress read after the turrets fall.
      if (bossIdx === BOSS_BASTION) {
        const x = bodyX[0] ?? 0;
        const y = bodyY[0] ?? 0;
        for (let k = 0; k < 4; k++) {
          const a = (bodyRot[0] ?? 0) + Math.PI / 4 + (k * Math.PI) / 2;
          const c = Math.cos(a);
          const s = Math.sin(a);
          g.moveTo(x + c * rs * 0.98, y + s * rs * 0.98).lineTo(x + c * rs * 1.22, y + s * rs * 1.22);
        }
        const grey = accentOf('turrets');
        g.stroke({ width: lw * 1.8, color: grey >= 0 ? grey : hue, alpha: 0.9 * bodyA });
      }
      // Two tone accents, then the battle damage over them (the gaps cut both).
      drawAccents(g, rs, lw, bodyA, timeSec);
      drawDamage(g, rs, lw, bodyA, timeSec);
      // Prism: the whole body runs to white with a contracting ring, then holds a white flash.
      if (bossIdx === BOSS_PRISM) {
        const wv = bossWin.known ? windowWhite(bossWin) : bossView.exposed === true ? 1 : 0;
        if (wv > 0) {
          const x = bodyX[0] ?? 0;
          const y = bodyY[0] ?? 0;
          const fl2 = bossWin.known ? windowFlash(bossWin) : 0.6;
          outlinePath(g, x, y, bodyRot[0] ?? 0, bodyScale[0] ?? 1);
          g.fill({ color: 0xffffff, alpha: 0.12 * wv + 0.25 * fl2 }).stroke({ width: lw * 1.5, color: 0xffffff, alpha: wv });
          g.circle(x, y, bossCoreFrac(bossIdx, 1) * rs).fill({ color: 0xffffff, alpha: wv });
          const ring = bossWin.known ? windowRing(bossWin, winRing) : null;
          if (ring !== null && ring.alpha > 0) g.circle(x, y, ring.r * rs).stroke({ width: lw * ring.width, color: 0xffffff, alpha: ring.alpha });
        }
      }
      drawShell(g, u, rs, lw, bodyA, timeSec);
      // Hit flash: a 60 ms white outline on every body.
      const fa = hitFlashAlpha(bossFlashAge) * bodyA;
      if (fa > 0) {
        for (let b = 0; b < bodyCount; b++) {
          if (b > 0 && bossIdx !== BOSS_TWINS) continue;
          outlinePath(g, bodyX[b] ?? 0, bodyY[b] ?? 0, bodyRot[b] ?? 0, bodyScale[b] ?? 1);
          g.stroke({ width: lw * 1.6, color: 0xffffff, alpha: fa });
        }
      }
    }
    // Outline fragments drift 60 u outward, tumble (the detached section only slides) and fade over
    // 1.5 s, in the boss colours: a soft primary line under a bright core.
    for (let k = 0; k < PIECES; k++) {
      const age = pieceAge[k] ?? Infinity;
      if (age >= PIECE_LIFE) continue;
      const d = pieceDrift(age);
      const a = pieceAlpha(age);
      const sp = pieceSpin(age, pieceSpinDir[k] ?? 1);
      const c = Math.cos(sp);
      const s = Math.sin(sp);
      const px = (pieceX[k] ?? 0) + (pieceDx[k] ?? 0) * d;
      const py = (pieceY[k] ?? 0) + (pieceDy[k] ?? 0) * d;
      for (let q = 0; q < FRAG_PTS; q++) {
        const fx = piecePts[(k * FRAG_PTS + q) * 2] ?? 0;
        const fy = piecePts[(k * FRAG_PTS + q) * 2 + 1] ?? 0;
        const wx = px + fx * c - fy * s;
        const wy = py + fx * s + fy * c;
        if (q === 0) g.moveTo(wx, wy);
        else g.lineTo(wx, wy);
      }
      g.stroke({ width: lw * 2.4, color: dmgCol.frag, alpha: a * 0.35, cap: 'round', join: 'round' });
      for (let q = 0; q < FRAG_PTS; q++) {
        const fx = piecePts[(k * FRAG_PTS + q) * 2] ?? 0;
        const fy = piecePts[(k * FRAG_PTS + q) * 2 + 1] ?? 0;
        const wx = px + fx * c - fy * s;
        const wy = py + fx * s + fy * c;
        if (q === 0) g.moveTo(wx, wy);
        else g.lineTo(wx, wy);
      }
      g.stroke({ width: lw * 1.1, color: dmgCol.stub, alpha: a, cap: 'round', join: 'round' });
    }
  }

  function drawEntities(w: World, alpha: number, timeSec: number, dt: number): void {
    growPools(w.cap);
    growEnrageTrack(enraged, w.cap);
    flameTime = w.time;
    // v31 well layer: one Graphics, cleared once and rebuilt only while it holds content.
    const novaLive = novaAny(nova);
    const emergeLive = emergeAny(emerge);
    if (novaShown) {
      novaG.clear();
      novaShown = false;
    }
    if (snakeShown) {
      snakeG.clear();
      snakeShown = false;
    }
    fluid.hideAll();
    stormCount = 0;
    shardCount = 0;
    // G6 item j: nova snakes come from the sim's ownership table every frame, not an event match.
    novaSnakeSync(novaSnakes, w, gs(w), SNAKE_SLOTS, KIND_SNAKE_HEAD);
    if (enemyFxDirty) {
      enemyFx.clear();
      enemyFxGlow.clear();
      enemyFxDirty = false;
    }
    // One sprite per entity on both paths: bloom source (sharp, scale 1) or blurred glow.
    const glowAlpha = bloomOn ? currentRender.bloomSourceAlpha : currentRender.spriteAlpha;
    const glowScale = bloomOn ? 1 : currentRender.spriteScale;
    // ED1 cue: while exposed (or reassembling) the boss draws its coreless white shell, tinted the
    // tier colour or, in the flicker's on share while exposed, hot red.
    const coreless = bossCoreless();
    const bossTint = coreless
      ? exposed && shellHot(exposeAge)
        ? mixRgb(palette.red, 0xffffff, flickerRedWhite(bossTier))
        : palette[bossColourOf(bossIdx)]
      : 0xffffff;
    let live = 0;
    prismDrawn = false;
    // G6 tilt-depth: volumes only while a flat level is tilted; Off (and the drum) never draw any.
    volumeOn = cam.on && drum === null;
    if (volumeOn) volume.begin(cam);
    else volume.off();
    // Look v33 drone state for this frame (read only from the sim's drone arm).
    const arm = droneArm(w);
    droneDecoyOut = arm.mode === 'detach' && arm.detach === Detach.Out;
    droneDrawn = false;
    twinDrawn = false;
    shipDrawn = false;
    bossSeen = false;
    bodyCount = 1;
    for (let i = 0; i < w.cap; i++) {
      if (w.alive[i] !== 1) {
        hideSlot(i);
        continue;
      }
      live++;
      const kind = w.kind[i] ?? 0;
      // V3: boss hazards draw through the hazard sprite layer, never as a Graphics view.
      if (kind === KIND_NUM.bossHazard) {
        hideSlot(i);
        planHazardAt(w, i, alpha, timeSec);
        continue;
      }
      const isPickup = kind === PICKUP_KIND;
      const isV2 = kind >= KIND_NUM.charger && kind <= KIND_NUM.slime;
      const isBoss = kind === KIND_NUM.boss;
      const isPart = kind === KIND_NUM.bossPart;
      // Visual slot: the kind, the pickup variant for its weapon index (w.a), the Slime outline
      // variant from hash01(id), the boss per id and openness step, or the part per type and tier.
      const slot = isBoss
        ? coreless
          ? exposedBossSlot(bossIdx, opennessStep(bossOpen))
          : bossSlot(bossIdx, opennessStep(bossOpen))
        : isPart
          ? partVisualSlot(w.a[i] ?? 0, bossTier, opennessStep(bossOpen), coreless)
          : kind === LEAVER_KIND_NUM.leaver
            ? leaverSlot(leaverFrameStep(timeSec, hash01(i)))
            : visualSlot(kind, w.a[i] ?? -1, kind === KIND_NUM.slime ? hash01(i) : 0);
      const isShard = kind === LEAVER_KIND_NUM.shard;
      let v = views[i];
      if (!v) {
        v = new Graphics(contextForSlot(slot));
        views[i] = v;
        viewKind[i] = slot;
      } else if (viewKind[i] !== slot) {
        v.context = contextForSlot(slot);
        viewKind[i] = slot;
        viewTint[i] = -1;
        enemyPhase[i] = Number.NaN;
      }
      // Look v33: a cracked boss draws its damaged body (arcs cut out of the geometry).
      if (isBoss) {
        const bc = bossBodyContext(slot);
        if (v.context !== bc) v.context = bc;
      }
      // Slime puddles sit on the floor layer, under every entity.
      const parent = isFloorSlot(slot) ? floor : entities;
      if (v.parent !== parent) parent.addChild(v);
      if (!v.visible) v.visible = true;
      const spec = specForSlot(slot);
      // Parts are drawn white and take the boss colour; bosses bake theirs (tint stays white).
      // G3A: boss adds take a hostile hue (their own colour mixed toward red) and an angry pulse.
      const isAdd = addCount > 0 && !isBoss && !isPart && isBossAdd(i);
      // The Twins second body is a full boss body: it takes the boss tint (baked red, or the exposed look).
      const baseTint = isPart
        ? isTwinPart(w.a[i] ?? 0)
          ? bossTint
          : isBakedPart(w.a[i] ?? 0)
            ? 0xffffff // Broodling, Hornet, Gravitant and Mirror bake their colours (bossShapes.ts)
            : bossPartTint(bossIdx, palette[bossColourOf(bossIdx)], palette)
        : isBoss
          ? bossTint
          : isShard
            ? // Leaver shard: its own colour, shimmering toward a neighbouring hue of the same family.
              mixRgb(palette[shardKey(w.a[i] ?? 0)], palette[shardShimmerKey(w.a[i] ?? 0)], shardHueMix(timeSec, hash01(i)))
            : spec.tint === null
              ? 0xffffff
              : palette[spec.tint];
      // Look v33: the detach decoy drone pulses red orange while it is out, so the chase reads.
      const decoy = kind === DRONE_KIND_NUM.drone && droneDecoyOut;
      // R2: an enemy that came through a membrane burns hot red (body and glow) with a subtle flicker.
      const hot = !isBoss && !isPart && !isPickup && isEnraged(enraged, i, kind);
      const tint = hot
        ? enrageTint(palette.red, timeSec, hash01(i))
        : decoy
          ? decoyTint(palette.red, palette.orange, timeSec)
          : isAdd
            ? mixRgb(baseTint, palette.red, ADD_HUE_MIX)
            : baseTint;
      // The glow sprite takes the body tint, except the Prism: its halo follows the cycling hue.
      let glowTint = tint;
      if (viewTint[i] !== tint) {
        v.tint = tint;
        viewTint[i] = tint;
      }
      let x = ix(w.prevX[i] ?? 0, w.x[i] ?? 0, alpha);
      let y = interp(w.prevY[i] ?? 0, w.y[i] ?? 0, alpha);
      if (kind === KIND_NUM.blink || isBoss) {
        // A Blink jump (and a Mirage warp) is one sim step: never draw it sliding across the arena.
        const jx = (w.x[i] ?? 0) - (w.prevX[i] ?? 0);
        const jy = (w.y[i] ?? 0) - (w.prevY[i] ?? 0);
        if (jx * jx + jy * jy > BLINK_SNAP_U * BLINK_SNAP_U) {
          x = w.x[i] ?? 0;
          y = w.y[i] ?? 0;
        }
      }
      let scale = 1;
      if (kind === KIND_GRUNT) scale = gruntPulse(timeSec, hash01(i));
      else if (kind === KIND_GRAVITY_WELL) {
        const r = w.radius[i] ?? 0;
        if (r > 0) scale = r / WELL_BASE_RADIUS;
      } else if (isBoss) {
        const r = bossView.active && bossView.radius > 0 ? bossView.radius : (w.radius[i] ?? 0);
        if (r > 0) scale = r / bossBodyR(bossIdx);
      } else if (isPart) {
        const a = w.a[i] ?? 0;
        const r = w.radius[i] ?? 0;
        if (r > 0) scale = r / partR(a);
        if (partType(a) === PART_POD && !isTwinPart(a) && !isBroodlingPart(a) && a !== PART_TEMPESTLING) scale *= podPulse(timeSec, hash01(i));
      }
      // Pickups spin on the render clock (phase per slot) and blink in their last 2 s (w.t).
      // Look v33: the drone pickup ring turns the other way to the weapon pickups.
      const rot = isPickup
        ? timeSec * PICKUP_SPIN + hash01(i) * Math.PI * 2
        : kind === DRONE_KIND_NUM.dronePickup
          ? dronePickupRot(timeSec, hash01(i))
          : kind === LEAVER_KIND_NUM.leaver
            ? leaverSpin(timeSec, hash01(i))
            : isShard && (w.t[i] ?? 0) < SHARD_HOLD_SEC
              ? hash01(i) * Math.PI * 2 + timeSec * SHARD_HOLD_SPIN
              : (w.rot[i] ?? 0);
      // Telegraphing enemies flash at 50 percent alpha (Swarm W3 request).
      // The boss has its own 2 s entrance telegraph (the ring and the body fade in), not the 0.6 s one.
      const teleNow = !isPickup && !isBoss && isTelegraphing(w, i);
      const tele = isPickup
        ? pickupAlpha(w.t[i] ?? 0)
        : isBoss
          ? bossView.active
            ? bossBodyAlpha(bossView.mode, bossView.modeT)
            : 1
          : teleNow
            ? telegraphAlpha(telegraphLeft(w, i))
            : 1;
      ev.x = x;
      ev.y = y;
      ev.alpha = tele;
      ev.scaleX = scale;
      ev.scaleY = scale;
      ev.rot = rot;
      ev.glowMul = 1;
      // Ship blinks while invulnerable (B10) and geoms blink in their last second (B11). Both are
      // alpha multipliers, so the glow sprite below follows on the bloom and fallback paths.
      if (i === 0 && kind === KIND_SHIP) ev.alpha *= invulnAlpha(w.ship.invuln);
      else if (kind === KIND_GEOM) ev.alpha *= geomAlpha(w.t[i] ?? 0);
      if (isV2) applyEnemyContract(w, i, kind, teleNow, timeSec, dt);
      else if (kind === KIND_DART || kind === KIND_GEOM) applyV1Sparkle(w, i, kind, teleNow, timeSec, dt);
      else if (isShard) {
        // Leaver shard brightness flicker: alpha and glow, so it shows on the bloom and fallback paths.
        const hs = hash01(i);
        ev.alpha *= shardPulseAlpha(timeSec, hs);
        ev.glowMul *= shardPulse(timeSec, hs);
        if (shardCount < SHARD_MAX) {
          shardX[shardCount] = ev.x;
          shardY[shardCount] = ev.y;
          shardRot[shardCount] = ev.rot;
          shardScale[shardCount] = scale;
          shardH[shardCount] = hs;
          shardA[shardCount] = ev.alpha;
          shardTint[shardCount] = tint;
          shardId[shardCount] = i;
          shardCount++;
        }
      }
      else if (isBoss) {
        bossDrawX = ev.x;
        bossDrawY = ev.y;
        // Exposed shake: the drawn body and its glow move, bossDrawX and the sim stay put.
        ev.x += bossShake.x;
        ev.y += bossShake.y;
        bossSeen = true;
        bodyX[0] = ev.x;
        bodyY[0] = ev.y;
        bodyRot[0] = ev.rot;
        bodyScale[0] = scale;
        const phaseEvent = bossPhaseAge < PHASE_FLASH_SEC ? 1 - bossPhaseAge / PHASE_FLASH_SEC : 0;
        const phaseMode = bossView.active ? bossPhaseFlash(bossView.mode, bossView.modeT) : 0;
        ev.glowMul = bossGlowMul(bossHitAge, phaseEvent > phaseMode ? phaseEvent : phaseMode);
        if (bossView.active) bossTier2Body(w, i, bossDrawX, bossDrawY, ev.rot, scale, dt);
        // Wave C: the Bastion keep burns hotter as turrets fall; a surviving twin is hot and fluttering.
        if (bossView.active && bossIdx === BOSS_BASTION) {
          ev.glowMul *= bastionGlow(bastionCoreHeat(turretsSeen, turretsLast, bossView.exposed === true));
        } else if (bossView.active && bossIdx === BOSS_TWINS) {
          ev.glowMul *= twinsEnrageGlow(bossView.phase, timeSec, getEffectsTier());
        } else if (bossView.active && bossIdx === BOSS_PRISM) {
          // Wave D: the gem overlay (hue cycle, ghost, run to white); the halo follows it.
          drawPrism(w, ev.x, ev.y, ev.rot, scale, ev.alpha);
          glowTint = prismGlowTint;
          ev.glowMul *= prismGlow;
        }
      } else if (isPart) {
        // Parts (pods, anchors, turrets) shake with the body, so the whole boss moves as one.
        ev.x += bossShake.x;
        ev.y += bossShake.y;
        // Look v33: the Hornet buzzes (a render only jitter, hashed per slot).
        partJitter(w.a[i] ?? 0, timeSec, hash01(i), partJit);
        ev.x += partJit.x;
        ev.y += partJit.y;
        if (isTwinPart(w.a[i] ?? 0)) {
          // The Twins second body fades in and out with the boss and burns like it once the pair is one.
          ev.alpha = bossView.active ? bossBodyAlpha(bossView.mode, bossView.modeT) : 1;
          if (bossView.active) ev.glowMul *= twinsEnrageGlow(bossView.phase, timeSec, getEffectsTier());
          if (bodyCount < BODIES) {
            bodyX[bodyCount] = ev.x;
            bodyY[bodyCount] = ev.y;
            bodyRot[bodyCount] = ev.rot;
            bodyScale[bodyCount] = scale;
            bodyCount++;
          }
        }
        // GW3: remember each Tempestling for its swirl and leading edge overlay.
        if ((w.a[i] ?? 0) === PART_TEMPESTLING && stormCount < STORM_MAX) {
          stormX[stormCount] = ev.x;
          stormY[stormCount] = ev.y;
          stormR[stormCount] = partR(PART_TEMPESTLING) * ev.scaleX;
          stormLead[stormCount] = tempestlingLead(w.vx[i] ?? 0, w.vy[i] ?? 0, w.rot[i] ?? 0);
          stormH[stormCount] = hash01(i);
          stormA[stormCount] = ev.alpha;
          stormCount++;
        }
        // Wave B: Gravitas anchors are joined by faint lines (planTier2 reads these positions).
        const pt = partType(w.a[i] ?? 0);
        if (pt === PART_ANCHOR && anchorCount < TETHER_ANCHORS_MAX) {
          anchorX[anchorCount] = ev.x;
          anchorY[anchorCount] = ev.y;
          anchorCount++;
        } else if (pt === PART_TURRET) {
          // Wave C: a turret's alpha follows its hit points (worn, then flickering); the count
          // heats the Bastion keep next frame. The peak hit points are learned per part.
          const hp = w.hp[i] ?? 0;
          if (hp > (partPeak[i] ?? 0)) partPeak[i] = hp;
          const body = bossView.active ? bossBodyAlpha(bossView.mode, bossView.modeT) : 1;
          ev.alpha *= turretShown(turretState(hp, partPeak[i] ?? hp), body, timeSec, hash01(i), getEffectsTier());
          if (hp > 0) {
            turretCount++;
            if (turretCount > turretsSeen) turretsSeen = Math.min(BASTION_TURRETS, turretCount);
          }
        }
      }
      if (kind === KIND_NUM.mine && !teleNow && bossView.active && bossIdx === BOSS_EMBER) {
        // Wave B: while Ember lives its Mines pulse (scale and glow; off on Low).
        const p = minePulse(timeSec, hash01(i), getEffectsTier());
        ev.scaleX *= p;
        ev.scaleY *= p;
        ev.glowMul *= mineGlow(p);
      }
      if (decoy) {
        const p = decoyPulse(timeSec);
        ev.scaleX *= 1 + 0.25 * p;
        ev.scaleY *= 1 + 0.25 * p;
        ev.glowMul *= 1.2 + 0.6 * p;
      }
      // Look v33: remember where the drones and the ship drew, for the mode glyph and ring.
      if (kind === DRONE_KIND_NUM.drone) {
        droneDrawX = ev.x;
        droneDrawY = ev.y;
        droneDrawn = true;
      } else if (kind === DRONE_KIND_NUM.droneTwin) {
        twinDrawX = ev.x;
        twinDrawY = ev.y;
        twinDrawn = true;
      } else if (i === 0 && kind === KIND_SHIP) {
        shipDrawX = ev.x;
        shipDrawY = ev.y;
        shipDrawn = true;
      }
      if (isAdd) {
        const p = addAngryPulse(timeSec, hash01(i));
        ev.scaleX *= addScale(p);
        ev.scaleY *= addScale(p);
        ev.glowMul *= addGlow(p);
      } else if (i === 0 && kind === KIND_SHIP && turboK > 0) {
        ev.glowMul *= turboGlow(turboK, timeSec);
      }
      if (hot) ev.glowMul *= enrageGlowMul(timeSec, hash01(i));
      // v31, look GW2: an erupted well draws its whirlpool, out to exactly the sim pull radius of
      // this well (nova radius once erupted); any other well turns a calm small swirl.
      if (kind === KIND_GRAVITY_WELL) {
        const r = w.radius[i] ?? WELL_BASE_RADIUS;
        const slot = novaLive ? novaSlotFor(nova, i, w.x[i] ?? ev.x, w.y[i] ?? ev.y, r) : -1;
        if (slot >= 0) drawNova(slot, i, ev.x, ev.y, r, wellInNova(w, i) ? NOVA_RADIUS : PULL_RADIUS, timeSec);
        else if (!teleNow) drawCalmSwirl(i, ev.x, ev.y, r, timeSec);
      }
      // The emergence trail follows its snake; whether a snake is a nova snake is novaSnakeSync's call.
      if (kind === KIND_SNAKE_HEAD && emergeLive) emergeTrack(emerge, i, ev.x, ev.y);
      // Wells pull the lattice into a dimple (at most MAX_WELLS, read every frame).
      if (kind === KIND_GRAVITY_WELL && !teleNow && wellsSeen < MAX_WELLS && lattice.sim) {
        addForce(lattice.sim, ev.x, ev.y, wellPullRadius(w.radius[i] ?? 0), WELL_PULL_ACCEL);
        wellsSeen++;
      }
      v.position.set(ev.x, ev.y);
      v.rotation = ev.rot;
      v.scale.set(ev.scaleX, ev.scaleY);
      if (v.alpha !== ev.alpha) v.alpha = ev.alpha;
      if (volumeOn && parent === entities) {
        const vs = volumeShapeFor(slot);
        if (vs) volume.add(vs, ev.x, ev.y, ev.scaleX, ev.rot, tint !== 0xffffff ? tint : vs.colour !== null ? palette[vs.colour] : 0xffffff, ev.alpha);
      }

      let s = glowViews[i];
      if (!s) {
        s = new Sprite({ texture: glowTextureFor(slot), anchor: 0.5, blendMode: 'add' });
        glowSprites.addChild(s);
        glowViews[i] = s;
        glowKind[i] = slot;
      } else if (glowKind[i] !== slot) {
        s.texture = glowTextureFor(slot);
        glowKind[i] = slot;
      }
      if (isBoss) {
        const bt = bossGlowTexture(slot);
        if (s.texture !== bt) s.texture = bt;
      }
      if (!s.visible) s.visible = true;
      s.tint = glowTint;
      const ga = glowAlpha * ev.alpha * ev.glowMul;
      s.alpha = ga > 1 ? 1 : ga;
      s.position.set(ev.x, ev.y);
      s.rotation = ev.rot;
      s.scale.set(ev.scaleX * glowScale, ev.scaleY * glowScale);
    }
    if (!prismDrawn && prismLayer) prismLayer.hide();
    drawTempestlings(timeSec);
    drawShardShimmer(timeSec);
    drawNovaSnakes(w, alpha, timeSec);
    drawBossIdentity(timeSec);
    drawDroneMode(arm.mode);
    drawWellFx();
    drawPond();
    if (novaLive) stepNovaState(nova, dt);
    stepArrive(arrive, dt);
    stepEmerge(emerge, dt);
    drawPops(dt);
    stats.entities = live;
  }

  /**
   * Bullet heads and attached trails by style, plus particle trails for styles 1 and 2.
   * (shipX, shipY) is the drawn ship position, the centre orbit blades turn around.
   */
  /** Look v33: bullet ids of the orbit spikes this frame (1), from the shield hitter table. */
  let spikeMask = new Uint8Array(0);

  /** Mark the orbit spikes: hitters at or past ShieldSpec.blades in WeaponState.blades (1 + ring). */
  function markSpikes(w: World): void {
    const ws = weaponState(w);
    const sh = shieldOf(ws.kind);
    const cap = w.bullets.cap;
    if (spikeMask.length < cap) spikeMask = new Uint8Array(cap);
    sawLevel = sh === null ? 0 : ws.saw;
    // Orbit v2: every hitter is a spike (two rings of sh.perRing), so mark them all (R7: pure, tested).
    markSpikeMask(spikeMask, ws.blades, sh === null ? 0 : sh.perRing);
  }

  /** GW3: while the saw level is above 0, a faint bright chain line through each ring's teeth, by phase. */
  function drawSawChain(): void {
    const a = sawChainAlpha(sawLevel);
    if (a <= 0) return;
    for (let ring = 0; ring < 2; ring++) {
      const n = chainN[ring] ?? 0;
      const o = ring * SAW_CHAIN_MAX;
      for (let k = 0; k < n; k++) chainPh[k] = chainRingPh[o + k] ?? 0;
      const segs = sawChain(chainPh, n, chainOrder);
      if (segs <= 0) continue;
      for (let s = 0; s <= segs; s++) {
        const t = chainOrder[s % n] ?? 0;
        const px = chainX[o + t] ?? 0;
        const py = chainY[o + t] ?? 0;
        if (s === 0) penMoveTo(sawPen, px, py);
        else penLineTo(sawPen, px, py);
      }
      // GW4: the bar is a glowing outline in the weapon hue (the near white line closed round the
      // ship read as a white backdrop): a wide soft glow pass, then a thin bright line.
      penStroke(sawPen, SAW_BAR_GLOW_W, sawTint, a * 0.35, 'round', 'round');
      for (let s = 0; s <= segs; s++) {
        const t = chainOrder[s % n] ?? 0;
        const px = chainX[o + t] ?? 0;
        const py = chainY[o + t] ?? 0;
        if (s === 0) penMoveTo(sawPen, px, py);
        else penLineTo(sawPen, px, py);
      }
      penStroke(sawPen, SAW_BAR_LINE_W, sawTint, Math.min(1, a * 1.6), 'round', 'round');
      sawShown = true;
    }
  }

  /** Add one triangle from t (sawTri or sawTip) to sawG, attached to the ship through the drum. */
  function sawPoly(t: Float32Array = sawTri): void {
    penMoveTo(sawPen, t[0] ?? 0, t[1] ?? 0);
    penLineTo(sawPen, t[2] ?? 0, t[3] ?? 0);
    penLineTo(sawPen, t[4] ?? 0, t[5] ?? 0);
    penClose(sawPen);
  }

  /**
   * GW2 chainsaw tooth, GW3 bar, GW4 look: a sharp metallic triangle in the weapon hue centred on
   * (x, y) along the track direction (vx, vy), len (spikeLen) long, with a white hot tip (toothTip).
   * While the saw runs, SPIKE_GHOSTS fading copies slide back along the track behind it (motion
   * blur along the chain, never turned round the ship). No fill or halo behind the ship.
   */
  function drawSawTooth(x: number, y: number, vx: number, vy: number, len: number, tint: number): void {
    if (!sawShown) sawShown = true;
    const st = spikeStretch(len);
    const half = spikeHalfWidth(st);
    if (sawLevel > 0) {
      for (let k = 1; k <= SPIKE_GHOSTS; k++) {
        sawTrackGhost(x, y, vx, vy, k, sawLevel, sawGhost);
        spikeTriangle(sawGhost.x, sawGhost.y, vx, vy, len, half, sawTri);
        sawPoly();
        penFill(sawPen, tint, (SPIKE_GHOST_ALPHA[k - 1] ?? 0) * sawLevel);
      }
    }
    spikeTriangle(x, y, vx, vy, len, half, sawTri);
    sawPoly();
    penFill(sawPen, tint, 0.95);
    sawPoly();
    // Metallic edge: a lighter rim in the hue (not white), brighter as the tooth stretches.
    penStroke(sawPen, 1 + 0.6 * st, mixRgb(tint, 0xffffff, 0.25 + 0.2 * st), 0.85, 'butt', 'miter');
    toothTip(sawTri, sawTip);
    sawPoly(sawTip);
    penFill(sawPen, 0xffffff, 0.75 + 0.25 * st);
  }

  /** GW4: a saw hit (fx:hit on a tooth while the saw runs) throws 2 to 4 sparks in the weapon hue. */
  function sawSparks(x: number, y: number): void {
    if (sawLevel <= 0) return;
    const n = (chainN[0] ?? 0) + (chainN[1] ?? 0);
    if (n === 0) return;
    // The teeth of the last frame, packed per ring.
    const near = nearTooth(x, y, chainX, chainY, 0, chainN[0] ?? 0, SAW_SPARK_REACH) || nearTooth(x, y, chainX, chainY, SAW_CHAIN_MAX, chainN[1] ?? 0, SAW_SPARK_REACH);
    if (!near) return;
    sawSparkSeq = (sawSparkSeq + 1) | 0;
    burstSmall(x, y, mixRgb(sawTint, 0xffffff, 0.35), sawSparkCount(sawSparkSeq), 140, 380, 0.25);
  }

  function drawBullets(pool: BulletPoolLike | null, alpha: number, shipX: number, shipY: number, dt: number): void {
    if (!pool) {
      stats.bullets = 0;
      return;
    }
    ensureBulletItems(pool.cap);
    const homing = pool.homing;
    const style = pool.style;
    const prevX = pool.prevX;
    const prevY = pool.prevY;
    let live = 0;
    let restyled = false;
    const wallGlowOn = mapEffectsOn(getEffectsTier());
    // GW2: orbit spikes draw as chainsaw teeth in one Graphics, rebuilt only while spikes show.
    if (sawShown) {
      sawG.clear();
      sawShown = false;
    }
    // G9: the teeth and the chain are attached to the ship. On the drum each point goes through the
    // drum from the ship's current position, its offset scaled by the ship's depth (the bar keeps its
    // flat size and stays on the surface); flat and tilted levels draw unchanged.
    penOwner(penBegin(sawPen, sawG, drum), shipX, shipY);
    const spikeLen = pool.spikeLen;
    const spikePh = pool.phase;
    chainN[0] = 0;
    chainN[1] = 0;
    for (let i = 0; i < bulletItems.length; i++) {
      const item = bulletItems[i];
      const tail = trailItems[i];
      const em = bulletEmitters[i];
      if (!item || !tail || !em) continue;
      if (i < pool.cap && pool.alive[i] === 1) {
        live++;
        // Style and homing are static properties: restyle once per change and flag the
        // containers for re-upload below.
        const st = style !== undefined ? (style[i] ?? 0) : 0;
        const h = homing !== undefined && homing[i] === 1;
        // Look v33: orbit spikes (marked from the weapon state in draw) take the triangle frame.
        // GW4: both rings (mask 1 inner, 2 outer) are teeth; the outer ring used to fall through to
        // the crescent sprite, so the long outer bar never read as saw teeth.
        // R7: the choice is pure (spikeSaw.ts bulletDrawCode) and tested for every start weapon.
        const code = bulletDrawCode(st, h, i < spikeMask.length ? (spikeMask[i] ?? 0) : 0);
        const spike = code === SPIKE_CODE;
        const vis = visualForCode(code);
        if (bulletCodeShown[i] !== code) {
          bulletCodeShown[i] = code;
          styleSlot(i, vis);
          restyled = true;
        }
        const vx = pool.vx[i] ?? 0;
        const vy = pool.vy[i] ?? 0;
        let x: number;
        let y: number;
        if (vis.orient === 'radial' && prevX !== undefined && prevY !== undefined) {
          // Orbit blades are placed by the sim each step: interpolate, do not extrapolate.
          x = ix(prevX[i] ?? 0, pool.x[i] ?? 0, alpha);
          y = interp(prevY[i] ?? 0, pool.y[i] ?? 0, alpha);
        } else {
          x = bulletRenderPos(pool.x[i] ?? 0, vx, alpha, SIM_DT);
          y = bulletRenderPos(pool.y[i] ?? 0, vy, alpha, SIM_DT);
        }
        const heading = Math.atan2(vy, vx);
        if (spike) {
          // The atlas frame has a fixed size, so the tooth (length from spikeLen) is drawn instead.
          drawSawTooth(x, y, vx, vy, spikeDrawLen(spikeLen !== undefined ? (spikeLen[i] ?? 0) : 0), palette[vis.tint]);
          // GW3: remember the tooth for its ring's chain line.
          const ring = (spikeMask[i] ?? 1) === 2 ? 1 : 0;
          const cn = chainN[ring] ?? 0;
          if (cn < SAW_CHAIN_MAX) {
            const o = ring * SAW_CHAIN_MAX + cn;
            chainX[o] = x;
            chainY[o] = y;
            chainRingPh[o] = spikePh !== undefined ? (spikePh[i] ?? 0) : Math.atan2(y - shipY, x - shipX);
            chainN[ring] = cn + 1;
          }
          sawTint = palette[vis.tint];
          if (item.x !== PARK) {
            item.x = PARK;
            item.y = PARK;
          }
          if (tail.x !== PARK) {
            tail.x = PARK;
            tail.y = PARK;
          }
          em.acc = 0;
          continue;
        }
        item.x = x;
        item.y = y;
        item.rotation = vis.orient === 'radial' ? Math.atan2(y - shipY, x - shipX) : heading;
        if (vis.trailLenU > 0) {
          tail.x = x;
          tail.y = y;
          tail.rotation = heading;
        } else if (tail.x !== PARK) {
          tail.x = PARK;
          tail.y = PARK;
        }
        if (vis.emitsTrail) emitBulletTrail(em, bulletTrailRate(st), x, y, vx, vy, st, palette[vis.tint], dt);
        else em.acc = 0;
      } else if (item.x !== PARK) {
        // Just died: a bullet that ended at a wall lights it there (orbit blades never do).
        if (wallGlowOn) {
          const vis = visualForCode(bulletCodeShown[i] ?? -1);
          if (vis.orient === 'velocity') bulletWallGlow(item.x, item.y, palette[vis.tint]);
        }
        item.x = PARK;
        item.y = PARK;
        tail.x = PARK;
        tail.y = PARK;
        em.acc = 0;
      }
    }
    drawSawChain();
    if (restyled) {
      bullets.update();
      trails.update();
    }
    stats.bullets = live;
  }

  function draw(w: World, alpha: number): void {
    if (getTilt() !== tiltLevel) applyTilt();
    const now = performance.now();
    const dt = lastDraw === 0 ? 0 : (now - lastDraw) / 1000;
    lastDraw = now;
    const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
    const fxDt = dt > MAX_FX_DT ? MAX_FX_DT : dt;
    watchSuper(w, now / 1000);
    hitClockMs = now;
    hitWorld = w;
    const nowSec = now / 1000;
    const sim = lattice.sim;
    if (sim) clearForces(sim);
    wellsSeen = 0;
    sparkleColour = mixRgb(palette.geom, 0xffffff, GEOM_SPARKLE_WHITE);
    // V3: boss state and the hazard buffer for this frame; the halo follows applyNeon's settings.
    updateBoss(w, fxDt);
    fxHalo(currentRender, bloomOn, halo);
    tierHalo(halo, bossTier, haloBoss);
    resetSpriteBuf(hazardBuf);
    const shipX = ix(w.prevX[0] ?? 0, w.x[0] ?? 0, a);
    const shipY = interp(w.prevY[0] ?? 0, w.y[0] ?? 0, a);
    // G9: the camera u moves before anything is drawn, so every layer drawn through the drum
    // (drumPen.ts) uses the same camera u as the scene pass that projects the entity views.
    if (drum && !drum.trough && w.alive[0] === 1) {
      drum.camU = followCamU(drum.camU, shipX, drumSnap ? Number.POSITIVE_INFINITY : fxDt, drum.width);
      drumSnap = false;
    }
    stepPond(w.time);
    drawEntities(w, a, nowSec, fxDt);
    drawHazards(nowSec);
    drawGhost();
    drawDashGhosts();
    drawBossCue();
    // Ship trail: reads the sim velocity, writes only render particles and the comet ribbon.
    if (w.alive[0] === 1 && shipActive(w)) {
      const svx = w.vx[0] ?? 0;
      const svy = w.vy[0] ?? 0;
      emitShipTrail(shipX, shipY, svx, svy, fxDt, turboRate(turboK), turboK > 0 ? mixRgb(palette.ship, palette.yellow, 0.5 * turboK) : -1);
      drawComet(cometX(shipX), shipY, svx, svy, fxDt);
      // Ship wake through the lattice above 120 u/s.
      const wake = sim ? wakeAccel(Math.hypot(svx, svy)) : 0;
      if (sim && wake > 0) addForce(sim, shipX, shipY, WAKE_RADIUS, wake);
      superDistort(shipX, shipY, nowSec);
    } else {
      resetShipTrail();
      hideComet();
    }
    lastFxSec = nowSec;
    markSpikes(w);
    drawBullets(explicitBullets ?? bulletsFromWorld(w), a, shipX, shipY, fxDt);
    drawEnemyBullets(w, a, nowSec, fxDt);
    stepEffects(dt);
    drawPulses(fxDt);
    drawHitFx(fxDt);
    if (latticeActive) {
      lattice.glow.alpha = HEAT_GLOW_ALPHA * mapFxNeonGain(current.glowAlpha);
      lattice.frame(dt, nowSec);
    }
    if (lattice.dust.visible) lattice.dustFrame(fxDt, nowSec);
    governLattice(dt, now / 1000);
    stepParticles(dt);
    drawMembranes(w, fxDt);
    drawDriftStreaks(fxDt);
    stats.particles = liveParticleCount();
    if (drum) {
      if (!latticeActive) {
        // G10 perf: the low tier u lines only move when the camera u leaves its bucket.
        const gk = drumCamBucket(drum.camU);
        if (gk !== drumGridKey || gridRippling) {
          drumGridKey = gk;
          redrawGrid();
        }
      }
      drawDrumObstacles(drum);
      projectDrumFrame(drum);
      app.render();
      tiltScene.restore();
    } else if (cam.on) {
      projectTilt();
      app.render();
      tiltScene.restore();
    } else app.render();
    if (retiredTextures.length > 0) {
      for (const t of retiredTextures) t.destroy(true);
      retiredTextures = [];
    }
    if (retiredContexts.length > 0) {
      for (const c of retiredContexts) c.destroy();
      retiredContexts = [];
    }
  }

  /** Tilt level changed (setTilt): new camera, projected or flat walls and lattice, new fit. */
  function applyTilt(): void {
    tiltLevel = getTilt();
    cam = cameraFor(tiltLevel, arena.height);
    if (drum) drum.cam = drumCamera(TILT_DEG[tiltLevel], arena.height);
    lattice.setCamera(drum || !cam.on ? null : cam);
    applyFit();
  }

  /** Cylinder only, just before the render: the comet ribbon in place, then the drum scene pass. */
  function projectDrumFrame(d: Drum): void {
    // The ribbon is rewritten in full from its own state every frame, so no restore is needed.
    if (cometHalo.visible) {
      drumProjectNodes(cometPositions, null, cometPositions.length >> 1, d, null);
      cometGeom.getBuffer('aPosition').update();
    }
    tiltScene.projectDrum(d);
  }

  /** The comet's u: on a cylinder the image nearest its last head, so the ribbon never spans the seam. */
  function cometX(x: number): number {
    if (!(wrapW > 0)) return x;
    cometU = cometUPrimed ? unwrapNear(cometU, x, wrapW) : x;
    cometUPrimed = true;
    return cometU;
  }

  /** Tilt only, just before the render: the comet ribbon in place, then the scene pass. */
  function projectTilt(): void {
    // The ribbon is rewritten in full from its own state every frame, so no restore is needed.
    if (cometHalo.visible) {
      projectNodes(cometPositions, null, cometPositions.length >> 1, cam);
      cometGeom.getBuffer('aPosition').update();
    }
    tiltScene.project(cam);
  }

  function resize(w: number, h: number, d: number): void {
    cssW = Math.max(1, Math.round(w));
    cssH = Math.max(1, Math.round(h));
    const res = renderResolution(d);
    app.renderer.resize(cssW, cssH, res); // third argument is the resolution
    bloom.resolution = bloomResolution(res, knobs.resolution);
    applyFit();
  }

  /** One line: CSS size, backing store, resolution, MSAA and bloom density. */
  function logRender(): void {
    const c = app.canvas;
    const res = app.renderer.resolution;
    const want = backingSize(cssW, cssH, res);
    const css = `${c.style.width || `${cssW}px`} x ${c.style.height || `${cssH}px`}`;
    const ok = c.width === want.w && c.height === want.h ? 'ok' : `expected ${want.w}x${want.h}`;
    console.log(
      `[sow] render css ${css} | backing ${c.width}x${c.height} (${ok}) | resolution ${res} | ` +
        `antialias ${contextAntialias(app.renderer)} | bloom res ${String(bloom.resolution)}`,
    );
  }

  function setArena(def: LevelDef): void {
    arena = def.arena;
    gridSegs = arenaGridSegments(arena);
    superWorld = null;
    setParticleBounds(arena.width, arena.height);
    clearParticles();
    ripples.length = 0;
    pondWaves.length = 0;
    pondSimTime = -1;
    devPondAt = 1;
    ringList.length = 0;
    shake.list.length = 0;
    resetEnemyAndMapFx();
    hideComet();
    clearPulseFx();
    clearHitFx();
    clearBossFx();
    // New level: the governor starts again from the tier spacing.
    gov = initialGovernor();
    avgFrameMs = 0;
    lattice.clear();
    tiltLevel = getTilt();
    cam = cameraFor(tiltLevel, arena.height);
    lattice.setCamera(cam.on ? cam : null);
    applySurface(def);
    applyLatticeTier(getEffectsTier());
    lattice.seedDust(arena);
    applyFit();
  }

  /** New level: no hazards, enemy bullets, boss flashes or edge pulse on screen. */
  function clearBossFx(): void {
    resetSpriteBuf(hazardBuf);
    hazardLayer.clear();
    enemyBulletLayer.clear();
    bossOpen = 0;
    bossHitAge = Number.POSITIVE_INFINITY;
    bossPhaseAge = Number.POSITIVE_INFINITY;
    bossEdgeAge = Number.POSITIVE_INFINITY;
    bossHitThrottle.lastMs = Number.NEGATIVE_INFINITY;
    resetIdentity();
    resetSpriteBuf(cueBuf);
    cueLayer.clear();
    exposeEvent = EXPOSE_UNKNOWN;
    exposed = false;
    exposeAge = 0;
    exposePhase = 0;
    exposeSpread = 0;
    exposeOrbit = 0;
    bossShake.x = 0;
    bossShake.y = 0;
    addCount = 0;
    // Wave B tier 2 state.
    bossLastX = Number.NaN;
    bossLastY = Number.NaN;
    bossSpeed = 0;
    ghostAge = Number.POSITIVE_INFINITY;
    if (ghostView) ghostView.visible = false;
    anchorCount = 0;
    anchorsLast = 3;
    emberFlameEm.acc = 0;
    emberSparkEm.acc = 0;
    tempestDripEm.acc = 0;
    dashDist = 0;
    turretCount = 0;
    turretsLast = 0;
    turretsSeen = 0;
    partPeak.fill(0);
    for (const g of dashGhosts) {
      g.age = DASH_GHOST_SEC;
      if (g.view) g.view.visible = false;
    }
    turboK = 0;
    turboPrevActive = null;
    turboPrevTimer = 0;
    resetShellState(shell);
    // GW4: every render side well state (nova slots, whirlpool quads, arrivals, emergences, nova
    // snakes) clears with the level; the lattice and its dimples are rebuilt by setArena.
    resetWellVisuals(wellVisuals);
    fluid.hideAll();
    sawLevel = 0;
  }

  /** New arena: wall features, calm threat, no flashes, pops or per slot fx state. */
  function resetEnemyAndMapFx(): void {
    features = wallFeatures(arena);
    threatTarget = 0;
    threatShown = 0;
    pulsePhase = 0;
    for (const f of flashes) f.age = FLASH_LIFE;
    for (const p of pops) p.age = p.life;
    flashDirty = true; // one pass clears and hides the flash layer
    enemyFxDirty = true; // the next entity pass clears the fx layers
    enemyPhase.fill(Number.NaN);
    for (const e of enemyEmitters) e.acc = 0;
  }

  function setSticks(circles: readonly StickCircleLike[]): void {
    sticks.clear();
    for (const c of circles) {
      const a = c.alpha ?? 1;
      if (a <= 0 || c.r <= 0) continue;
      sticks.circle(c.x, c.y, c.r);
      if (c.filled) sticks.fill({ color: 0xffffff, alpha: a });
      else sticks.stroke({ width: 3, color: 0xffffff, alpha: a });
    }
  }

  function destroy(): void {
    offNeon();
    for (const off of offFx) off();
    registerParticleStress(null);
    disposeParticles();
    lattice.destroy();
    fluid.destroy();
    hazardLayer.destroy();
    cueLayer.destroy();
    enemyBulletLayer.destroy();
    for (const t of bossAtlas.frames) t.destroy(false);
    bossAtlas.texture.destroy(true);
    for (const t of fxAtlas.frames) t.destroy(false);
    fxAtlas.texture.destroy(true);
    cometAtlas.halo.destroy(false);
    cometAtlas.core.destroy(false);
    cometAtlas.texture.destroy(true);
    trailAtlas.v1.destroy(false);
    trailAtlas.taper.destroy(false);
    trailAtlas.texture.destroy(true);
    dotTexture.destroy(true);
    for (const t of glowTextures) t?.destroy(true);
    for (const t of bloomTextures) t?.destroy(true);
    app.destroy(true, { children: true });
    // Mesh.destroy leaves its geometry; free the comet ribbon once both meshes are gone.
    cometGeom.destroy();
  }

  gridSegs = arenaGridSegments(arena);
  features = wallFeatures(arena);
  setParticleBounds(arena.width, arena.height);
  applyLatticeTier(getEffectsTier());
  lattice.seedDust(arena);
  applyFit();
  setBloomEnabled(true);
  logRender();

  return {
    app,
    resize,
    setArena,
    draw,
    setBloomEnabled,
    get bloomEnabled(): boolean {
      return bloomOn;
    },
    stats,
    setPlayRect(rect: PlayRect | null): void {
      playRect = rect;
      applyFit();
    },
    setBullets(pool: BulletPoolLike | null): void {
      explicitBullets = pool;
    },
    setSticks,
    superFx,
    setEnemyBullets(pool: EnemyBulletsLike | null): void {
      explicitEnemyBullets = pool;
    },
    setBossReader(reader: BossReader | null): void {
      bossReader = reader ?? readBoss;
    },
    destroy,
  };
}
