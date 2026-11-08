# Public plan

Status: draft for Ryan's approval, 2026-11-08. Drafted by an Opus drafter from Morpheus's spec. Nothing in this plan is approved until Ryan rules on it and the ruling lands in `docs/DECISIONS.md`.

Conventions: every cost and time figure is an estimate unless it cites a source. "Verified" means checked against a source listed in the Sources section on 2026-11-08. Sizing is given in builder waves and external lead times, not calendar weeks, because progress is measured by landings.

## Summary

1. The plan is achievable on the current codebase: the deterministic simulation is the single biggest asset, because it is already the foundation that input only netcode needs.
2. Biggest risks, in order: child privacy and age signal laws for a mixed audience, purchase restore without accounts, cross engine floating point determinism for online play, and the asset rule versus a skins pipeline.
3. P1 ships the solo game (Adventure, Endless, Free Play) to Google Play and the App Store via Capacitor, with earned gems, the Repo shop, a one time premium unlock and no ads, no accounts, no data leaving the device.
4. P2 adds private online play (friend codes, QR, browser guest join) on WebRTC with a small hosted signalling and relay service; recommended stack is Cloudflare Workers, Durable Objects and Cloudflare TURN, to be validated by a spike.
5. P3 adds battle modes (shield battle, hockey, hide and seek) on a mode framework so later modes ship as content.
6. P4 adds tank mode: overhead first in PixiJS, third person 3D as a later spike (three.js, a new dependency needing approval), then artillery.
7. P5 opens public PVP, leaderboards, seasons and live ops, with privacy safe analytics only after a consent design.
8. Spend stays near zero until P2: P1 fixed costs are developer accounts, a domain, company formation and legal review (estimates in the spend plan).
9. Pushback built in: defer consumable gem packs until cloud save exists, choose the general App Store category over the Kids Category, and ban randomised rewards bought with gems.
10. Ryan has 16 open questions to rule on; the first four block P1 briefs.

## Decisions table

Source: Ryan's interview answers, 2026-11-08. These are rulings, not proposals.

| # | Topic | Ruling |
|---|---|---|
| 1 | Audience | Everyone, including children under 13 (mixed audience). Plan must cover COPPA, GDPR, UK Age Appropriate Design Code, Apple Kids Category vs general category with parental gate, Google Play Families and target audience. |
| 2 | First store launch | Solo modes (Adventure, Endless, Free Play) plus earned gems and the Repo shop. Private PVP and co op are the first big update. |
| 3 | Money | Free download, one time premium unlock ("paid player"), gems earned in play, optional gem packs and cosmetics. Apple and Google in app purchase only. No loot boxes, direct purchase only. Purchases behind a parental gate. |
| 4 | Platforms | Capacitor wrap of the existing web game for Android and iOS; same code stays playable in a browser for guest friends. |
| 5 | Accounts | None at launch. Progress and gems on device. Premium unlock restored through the store. Online play later adds an anonymous player ID; sign in only for 13+ or with parental consent. |
| 6 | Ads | None. |
| 7 | Online communication | Emotes and preset phrases only. |
| 8 | Publisher | A new game company formed by Ryan; owns developer accounts, payouts, privacy policy. Jurisdiction open. |
| 9 | Name | Neon arcade energy, one invented word, unused on both stores, matching .com available. |
| 10 | Regions | Worldwide, English only at launch. |

## Risks and constraints

Each risk is a design constraint with a mitigation. Ordered by impact on P1 first.

### 1. Child privacy and age signal laws (P1 blocker if ignored)
- Known: the amended COPPA Rule took effect 2025-06-23 and full compliance was required by 2026-04-22 (verified). It adds a stand alone "mixed audience" definition, separate parental consent before disclosing children's data to third parties, a written data retention policy, and a written information security program (verified).
- Known: Texas SB 2420 (App Store Accountability Act) is enforceable after the Fifth Circuit stayed the injunction (verified). It applies to all apps available in Texas, not only child directed ones; developers must use store provided age category and consent data, assign age ratings to apps and purchases, and notify the store of significant changes (verified). Google offers the Play Age Signals API (beta) for this and, for Texas, requires age ratings on in app products when using Play Billing (verified). Apple offers the Declared Age Range API (verified).
- Known, lower confidence: Utah effective 2026-05-07, Louisiana 2026-07-01, California January 2027 (secondary source; verify against state sources before P1 submission).
- Known: GDPR Article 8 sets the digital consent age at 16 by default, which member states may lower to no less than 13, and requires reasonable efforts to verify parental consent (verified).
- Known: UK Children's Code guidance for games asks for high privacy by default, profiling off by default, no detrimental nudges, neutral purchase buttons, and a DPIA (verified).
- Constraint: P1 collects nothing. No identifiers, no analytics, no crash reporting SDK, no network calls except store billing and age signal APIs.
- Mitigation: integrate both stores' age signal APIs in P1 as a native plugin call, used only to gate purchases and (later) online features. Write the retention policy and security program now even though data is nil; they are cheap and required wording for the privacy policy.
- Why: collecting nothing makes COPPA, GDPR and the Children's Code mostly a documentation exercise in P1, and keeps the approval path short.

### 2. Purchase restore without accounts
- Known: Apple requires in app purchase for unlocking features and in game currency (guideline 3.1.1, verified). Google Play requires Play Billing for digital goods in games.
- Risk: the premium unlock is a non consumable, which both stores restore. Consumable gem packs are not restorable by the store. With progress on device only, a player who uninstalls or changes phone loses purchased gems. That produces refunds, bad reviews and support load.
- Mitigation: at P1 sell only non consumables: the premium unlock and fixed cosmetic bundles (each bundle a non consumable product, restorable). Defer consumable gem packs to P2, when the anonymous player ID can carry a server side gem balance. Gems stay earnable in P1.
- Why: every P1 purchase can then be restored by the store with zero backend, which matches ruling 5.

### 3. Store payment rules and commission
- Known: Apple Small Business Program: 15% commission on paid apps and in app purchases for developers with up to 1M USD proceeds in the prior calendar year, with associated developer accounts counted together; enrolment is a separate step (verified).
- Known: Google Play: 15% service fee on the first 1M USD of earnings each year, enrolment through an Account Group in Play Console (verified).
- Known: Apple requires odds disclosure before purchase for any randomised paid item (3.1.1, verified).
- Mitigation: enrol in both programs on day one of account creation; it is not automatic. Model revenue at 15%.

### 4. Loot box regulation
- Known: Brazil bans selling loot boxes to under 18s from March 2026 under Lei 15.211/2025 (verified). Belgium's Gaming Commission treats certain paid loot boxes as unlicensed gambling, and an Antwerp court ruled against a mobile game's loot boxes in January 2025 (verified).
- Constraint (proposed extension of ruling 3): because gems will eventually be purchasable, any random reward bought with gems is a loot box in substance. No random rewards bought with gems or money, anywhere. Random drops earned purely through play are fine.
- Why: a mixed audience worldwide launch cannot carry gambling classification risk in any market.

### 5. Online infrastructure cost and ops
- Known: a browser cannot accept inbound connections or run a server. WebRTC peer to peer still needs a signalling service to exchange connection offers, and a TURN relay for players behind strict NATs or mobile carriers.
- Known: true offline LAN or hotspot play without internet needs native code on the host (a local socket server in the Capacitor shell); browser guests on the same wifi still need internet signalling, after which WebRTC usually connects over the local network.
- Mitigation: one small managed service, scale to zero, introduced only at P2. Detail in P2.

### 6. Cross engine determinism (online play blocker if ignored)
- Known engineering risk, to be proven by a spike: Android WebView runs V8 and iOS WKWebView runs JavaScriptCore. Basic IEEE 754 arithmetic matches across engines, but transcendental functions (`Math.sin`, `Math.cos`, `Math.atan2`, `Math.exp`, `Math.pow`) are implementation approximated in the ECMAScript spec and may differ in the last bit. Lockstep and rollback desync on one bit.
- Mitigation: P2 spike runs the same seeded match on both engines and compares per tick state hashes. If they differ, add `src/core/dmath.ts` (deterministic polynomial or table based trig) used only by the sim, plus a desync checksum test in Vitest. Solo play is unaffected either way.
- Why: finding this in a spike costs one builder wave; finding it after launch breaks every cross platform match.

### 7. Cheating in PVP
- Known: input only lockstep means each client simulates everything; tampering with state causes a detectable desync, but a modified client can still automate aim, and every client knows every position.
- Constraint: hide and seek is a hidden information mode, so peer to peer lockstep leaks the hider's position to anyone who inspects memory.
- Mitigation: private matches with friends first (low incentive). Cap gems earned from private PVP. For public PVP (P5) and public hide and seek, run the same TypeScript sim inside the backend as the authority and send each client only what it may see.
- Why: the deterministic sim runs unchanged on a server, so authority is a deployment change, not a rewrite.

### 8. Capacitor performance and iOS audio
- Known risk: Android System WebView performance varies widely on low end phones; iOS mutes WebAudio when the ring or silent switch is on unless audio is moved to the media channel (the `unmute` library does this by looping a silent HTML audio track, verified). AudioContext must resume from a user gesture.
- Mitigation: buy one low end Android test phone (estimate 100 to 200 USD); add a quality tier (particle and glow caps) chosen by a frame time probe; a P1 audio unlock task covering silent switch, backgrounding and interruption.
- Known: Apple guideline 4.2 rejects apps that are a repackaged website (verified). Mitigation: bundle all code in the app (no remote URL loading), use native touches (haptics, store restore, share sheet). Risk is low for a full game.

### 9. Platform build requirements
- Known: since 2026-04-28 App Store uploads must be built with Xcode 26 or later on an iOS 26 SDK (verified). Unknown: whether Ryan's Mac runs a macOS version that supports Xcode 26.
- Known: new Android apps and updates must target Android 16 (API level 36) since 2026-08-31 (verified).
- Known: Capgo's native purchases plugin v8 targets Capacitor 8, uses StoreKit 2 and Play Billing 7 (verified). The state of `npm run build:cap` is unverified.

### 10. Third person tank camera needs a 3D renderer
- Known: PixiJS v8 is a 2D renderer. Overhead tanks fit the current engine. A third person camera needs a 3D renderer; three.js is the likely choice and is a new runtime dependency that needs declaration and Morpheus approval, plus Ryan's ruling.
- Mitigation: overhead tank mode first; third person as an isolated spike on its own canvas and scene, sharing the sim, not the renderer.

### 11. Asset rule versus a content pipeline
- Constraint: today no audio, image or font files beyond PWA icons. A continuous skins pipeline is easiest with authored images.
- Mitigation (proposed): keep the rule and define cosmetics as JSON data that drives procedural generation (palette, trail shape, glow profile, hull silhouette from parameters, pattern seed). JSON item definitions are data, not image files. Ryan rules whether that reading holds, or whether to allow SVG files later.
- Why: procedural items keep the neon identity, cost nothing in licensing, and stay tiny for the guest web build.

### 12. Name and trademark
- Known: "Shapes of War" is taken. The new name must be unused on both stores with the .com available (ruling 9).
- Risk: a free name today can collide with a registered mark. Mitigation: a knockout trademark search before buying the domain and making store listings. USPTO base filing fee is 350 USD per class from 2025-01-18 (verified); likely classes are 9 (downloadable game software) and 41 (online game services), estimate 700 USD for a US filing.

## Phases

Each phase lists goal, scope, approach, services with estimated monthly cost, Ryan's external tasks, and an exit gate. Builder sizing is in waves; external lead times are noted.

### P0: close v1 tester round

- Goal: wrap the current tester round without blocking planning.
- Scope in: collect tester notes, triage into a list for Ryan, record the result in `docs/STATUS.md`. Scope out: any build from feedback until Ryan rules.
- Approach: Morpheus triages; no builder wave.
- Services: none (0 USD).
- Ryan's external tasks:
  1. Share the final tester notes in this session within the 24 hour window.
  2. Rule on the triage list (build now, defer, drop).
- Exit gate: triage list ruled and recorded. Runs in parallel with P1 planning.

### P1: store launch (solo)

- Goal: the solo game on Google Play and the App Store, worldwide, English, with gems, the Repo shop and the premium unlock.
- Scope in: new name and brand; company and developer accounts; Capacitor Android and iOS builds; IAP plugin evaluation; gems economy; Repo shop with procedural cosmetics; premium unlock; local save with store restore; age signal integration; parental gate; privacy policy; age rating questionnaires; marketing site on the .com; internal and closed testing; TestFlight.
- Scope out: accounts, any server, analytics, ads, consumable gem packs (deferred to P2, see risk 2), online play, renaming before the name ruling.

Technical approach:
- Capacitor shell: verify `npm run build:cap`; upgrade to Capacitor 8 if needed; app bundles the built `dist/` locally. Android targets API 36; iOS builds with Xcode 26.
- IAP plugin evaluation (one Sonnet wave, spike): compare Capgo native purchases (MPL 2.0, StoreKit 2, Play Billing 7, restore supported, no third party data flow) and RevenueCat (free up to 2,500 USD monthly tracked revenue, then 1%; sends purchase data to a third party, which needs disclosure and weighs against the COPPA separate consent rule). Recommendation: Capgo native purchases, on device entitlement check. Why: no third party data flow and no cost; server receipt validation can come with P2.
- Save: versioned JSON save via Capacitor Preferences, with migration tests. On launch, call store restore and re-grant non consumables. Unknown, to be checked in the spike: whether Android Auto Backup and iCloud device backup carry the save across phones.
- Gems: pure module `src/economy/` with earn table and ledger, Vitest coverage, no PRNG use. Earn events come from existing results (stars, first clears, boss kills, milestones).
- Repo shop: item catalogue as JSON data, procedural cosmetics rendered through `applyNeon(n)`; inventory and equip state in the save.
- Premium unlock: one non consumable product; gates browser guest hosting (lands P2) and agreed perks (open question 3).
- Parental gate: adult level task (Apple's examples are maths or question tasks, verified) before every purchase sheet, external link and settings that change privacy. No dark patterns: neutral buttons, no timers on offers.
- Age signals: native call to Play Age Signals and Declared Age Range; use only to gate purchases; data not stored beyond the check.
- Normal difficulty and frozen generator versions stay bit identical.

Services and estimated cost:

| Item | One time (estimate) | Monthly (estimate) |
|---|---|---|
| Apple Developer Program | | 99 USD per year, about 8 USD per month |
| Google Play developer account | 25 USD | 0 |
| D-U-N-S number | cost unverified | 0 |
| Company formation | wide range, depends on jurisdiction (open question 1) | renewal varies |
| .com domain | | 10 to 25 USD per year |
| Trademark knockout search and US filing (2 classes) | 700 USD filing plus optional attorney 500 to 1,500 USD | 0 |
| Privacy policy and terms, lawyer review | 500 to 3,000 USD | 0 |
| Low end Android test phone | 100 to 200 USD | 0 |
| Marketing site hosting (GitHub Pages or Cloudflare Pages) | 0 | 0 |
| IAP plugin (Capgo native purchases) | 0 | 0 |

Ryan's external tasks (Morpheus gives full step by step instructions for each when its turn comes):
1. Rule on open questions 1 to 4 (jurisdiction, premium price, premium perks, asset rule).
2. Pick the name from the shortlist; buy the .com; optionally reserve social handles.
3. Form the company; open a business bank account in its name.
4. Request a D-U-N-S number for the legal entity (Apple allows up to 5 business days for issue and up to 2 more for Apple to receive it, verified).
5. Enrol in the Apple Developer Program as an organisation (needs legal entity, signing authority, company domain email and website, verified via secondary source).
6. Create a Google Play organisation developer account (25 USD); complete identity verification; set up payments profile.
7. Enrol in Apple's Small Business Program and Google Play's 15% tier.
8. Sign Apple's Paid Apps agreement; add tax and bank details in both consoles.
9. Confirm the Mac runs Xcode 26; install it.
10. Review and approve the privacy policy text; publish on the .com.
11. Answer the Apple age rating questionnaire and Google Play content rating, target audience and Data safety forms (Morpheus prepares answers).
12. Recruit testers for Google closed testing and TestFlight.
13. Play the release candidates on the Z Fold 7, an iPhone and the low end Android phone; paste results using the gate template.

Testing tracks:
- Known: Google requires personal accounts created after 2023-11-13 to run a closed test with at least 12 testers opted in for 14 consecutive days before production access (verified). Google's page names personal accounts only; a secondary source states organisation accounts are exempt. Plan a closed test anyway, because it doubles as the device gate; confirm in Play Console whether it is mandatory.
- TestFlight internal testing for iOS, then external testing (needs a beta review).

Builder sizing (estimate): 5 to 7 waves, several parallel (Capacitor shell, IAP spike, economy module, Repo shop UI, save and restore, parental gate and age signals, marketing site).

Exit gate: both store builds approved and live in production; purchase, restore and parental gate passed on real devices by Ryan; privacy policy live; no network call in the app other than store billing and age signals (checked by a network log during the device check).

### P2: private online

- Goal: friends play together: invite by code or QR, real time 1v1 and co op Adventure and Endless, async 1v1 against bots, browser guest join for premium players, emotes and preset phrases only.
- Scope in: netcode on the deterministic sim, signalling and TURN, anonymous player ID, room codes and QR, guest web build, consumable gem packs with a server side balance, server receipt validation.
- Scope out: public matchmaking, leaderboards, free text chat, voice, friend lists tied to identity, sign in.

Technical approach:
- Netcode: input only. Co op uses lockstep with a small input delay (simple, tolerant of 4 players). 1v1 uses rollback (predict remote inputs, resimulate on correction); the sim already has the properties rollback needs: fixed step, seeded, serialisable state. First spike: determinism across V8 and JavaScriptCore (risk 6), state snapshot cost, resimulation budget per frame on the low end phone.
- Transport: WebRTC data channels (unreliable, unordered for inputs) peer to peer; TURN fallback; WebSocket relay through the backend as a last resort.
- Async 1v1 against bots: the opponent is a recorded input stream (a ghost) or a bot replaying the seed; no live server needed when both inputs and seed are exchanged by link or code. Optional storage of ghosts in the backend later.
- Anonymous player ID: random ID generated on device, stored locally, sent only to the backend for rooms and the gem balance. Used only for internal operations; COPPA's support for internal operations exception applies only with a notice that names those operations (verified). No name, no email, no location. Display names come from a generated word pair, never free text.
- Emotes and preset phrases: fixed list, IDs only over the wire, filtered for age appropriateness.
- Browser guest join: premium host shows a QR and a code; guest opens the web build at the .com; one session per invite, no save, no purchases, no ID stored on the guest device; a "get the game" panel behind no tricks (Children's Code nudge guidance).
- Gem packs: consumables validated by the backend and credited to the anonymous ID's balance, so they survive reinstall only if the player keeps the ID; restore path designed in this phase (open question 12).

Backend options (costs from verified pricing pages; usage figures are estimates for small scale, under 500 concurrent players):

| Option | Pros | Cons | Estimated monthly cost at small scale |
|---|---|---|---|
| Cloudflare Workers, Durable Objects, Realtime TURN | TypeScript; one Durable Object per room for signalling, room codes and relay; can later host the sim as authority; TURN included in same vendor; scale to zero | Durable Objects model is new to the codebase; vendor specific APIs | Workers paid plan minimum 5 USD; 1M Durable Object requests and 400,000 GB s included, then 0.15 USD per million and 12.50 USD per million GB s; TURN and SFU share 1,000 GB free egress, then 0.05 USD per GB. Estimate 5 to 30 USD |
| Colyseus Cloud | TypeScript room server, matchmaking built in; can run the sim server side | Server authoritative model by default, which duplicates work when peers already simulate; TURN still needed separately for WebRTC or all traffic goes through the server | From 15 USD per month, no CCU limit, unlimited bandwidth (verified). Estimate 15 to 50 USD |
| Heroic Labs Nakama | Mature game backend (matchmaking, leaderboards, wallets); open source self host | Self host means running a VM and database; Heroic Cloud price not published on the fetched page; Go or TS runtime learning curve | Self host VM estimate 10 to 40 USD; managed price unknown |
| Supabase Realtime | Postgres plus realtime in one product; free tier | Broadcast relay is not designed for 60 Hz input streams; free projects pause after a week of inactivity | Free: 200 concurrent connections, 2M messages; Pro from 25 USD: 500 connections, 5M messages, then 10 USD per 1,000 connections and 2.50 USD per million messages (verified). Estimate 0 to 50 USD |

Recommendation: Cloudflare Workers with Durable Objects for signalling, room codes, the gem balance and relay fallback, plus Cloudflare Realtime TURN. To be validated by a spike (two players on mobile data, one behind a strict NAT, one Android and one iPhone).
Why: lowest fixed cost, scales to zero between sessions, TypeScript end to end, and the same sim can later run inside a Durable Object as the authority for public PVP and hide and seek.

Services: Cloudflare Workers paid plan and TURN, estimate 5 to 30 USD per month at small scale.

Ryan's external tasks:
1. Rule on the backend recommendation after the spike report.
2. Create a Cloudflare account under the company, enable the Workers paid plan, and add a billing method (Morpheus gives steps).
3. Approve the updated privacy policy (anonymous ID, internal operations notice) and update store Data safety and App Privacy answers.
4. Notify both stores of a significant change through the age signal consoles where the law requires it.
5. Device check: a co op run and a 1v1 between the Z Fold 7 and an iPhone, on wifi and on mobile data; a browser guest join from a third phone.

Exit gate: 20 consecutive cross platform matches without desync (estimate threshold, Ryan to confirm); guest join works from QR; privacy answers updated; monthly cost inside the estimate.

### P3: battle modes

- Goal: standard shield battle, hockey, hide and seek, on a mode framework.
- Scope in: a mode definition interface (rules, win condition, arena, spawns, scoring, allowed loadouts) so later modes ship as data plus a small rules module; the three modes for private online and versus bots.
- Scope out: public queues, ranked play.

Technical approach:
- Shield battle: each player has a shield worn down by player fire and NPC enemies; reuses enemy spawning from Endless.
- Hockey: puck physics in the sim; players cannot damage each other, but can trigger enemies, events and items that stun the opponent.
- Hide and seek: the hider takes an enemy kind's look and movement; the seeker has a limited shot count. Private matches only in P3 because of hidden information (risk 7); public version waits for server authority in P5.
- Each mode gets Vitest coverage of its rules module and a determinism replay test.

Services: no new service; usage grows inside P2 estimate.

Ryan's external tasks:
1. Rule on each mode's rules sheet before its build brief.
2. Device check each mode with a friend.

Exit gate: all three modes pass device checks; a fourth mode prototype can be added without touching the framework (proved by a stub mode in tests).

### P4: tank mode

- Goal: tank combat in the game's branding: overhead live battle, then third person, then artillery strategy.
- Scope in, in order: (a) overhead live battle in PixiJS, solid coloured tanks, procedural geometry; (b) third person spike with a 3D renderer; (c) turn based long range artillery with a pre battle loadout (long and short range weapons) and movement planning.
- Scope out: authored 3D models or textures (asset rule), physics engine dependencies.

Technical approach:
- Overhead: tank sim module (hull and turret angles, tread speed, ricochet) shares the deterministic core and netcode.
- Third person: separate canvas and scene with three.js, flat shaded procedural meshes, same sim; Pixi HUD on top if feasible. New dependency declaration, bundle size budget, and low end frame rate check are part of the spike.
- Artillery: turn based, so it can also run fully async over links or codes; strategy layer is a loadout and a movement plan per turn.

Services: none new.

Ryan's external tasks:
1. Rule on the three.js dependency after the spike report.
2. Rule on the artillery rules sheet.
3. Device check each stage.

Exit gate: overhead tank battle shipped; third person spike decision recorded; artillery shipped or deferred by ruling.

### P5: public PVP and live ops

- Goal: open play with strangers, leaderboards, seasons and a steady content cadence, safely for children.
- Scope in: matchmaking, server authoritative sim for public matches, leaderboards (anonymous generated names), seasons, cosmetic content pipeline releases, moderation (report button, emote abuse limits), analytics with consent.
- Scope out: free text chat, voice, user generated content shared publicly, ads.

Technical approach:
- Matchmaking queue in a Durable Object (or the P2 winner); sim runs authoritative for public matches; clients send inputs, receive filtered state where hidden information exists.
- Leaderboards: score submissions verified by replaying the input log on the server (determinism makes this cheap).
- Content cadence: items defined as JSON data, generated and previewed by a builder lane, reviewed by Ryan, shipped without an app update where store rules allow data only updates.
- Analytics: first party, aggregate only, opt in by a parent or a 13+ player, no third party SDK, written retention period. Requires a DPIA (Children's Code) before launch.
- Moderation: preset phrases only means little to moderate; add report and block, rate limits, and a review log.

Services (estimates): backend usage 30 to 200 USD per month depending on players; optional age assurance or parental consent vendor if sign in arrives, price unknown.

Ryan's external tasks:
1. Rule on public PVP launch criteria (demand signal, e.g. private match count).
2. Approve the analytics consent design and DPIA.
3. Approve the season and content cadence.

Exit gate: public queues stable on device checks; DPIA signed off; analytics consent verified on a child profile device.

Codex lane: placeholder, Ryan will add a ChatGPT Codex builder lane later; scope to be defined then.

## Economy principles

- Gems are earned in play at every phase. Earn sources (placeholders, tuned by a pure economy module with tests):
  - First star on a level: 5 gems; each further star: 5 gems.
  - First clear of a boss level: 50 gems.
  - Endless score milestones: 10 to 100 gems per milestone, once per milestone.
  - Free Play: no gems (custom setups can be farmed).
  - Private PVP win: small amount, daily cap (anti farming), from P2.
- Sinks: Repo shop items only. Placeholder prices: common cosmetic 100 gems, rare 400, arena 800, vehicle 1,500. No energy, no timers, no streak penalties (Children's Code nudge guidance).
- Direct purchase only: every item shows its exact contents and price. No random rewards bought with gems or money (risk 4).
- Real money products (placeholders, Ryan to rule): premium unlock one time; cosmetic bundles as non consumables in P1; gem packs as consumables from P2 only.
- PVP fairness: cosmetics and side grades only (a side grade trades one stat for another and is balanced in tests); or normalised loadouts in ranked play. Ryan to rule (open question 4).
- Parental gate before every purchase, external link and privacy relevant setting; age signals gate purchases where law requires.
- Clear currency labels: gems are never shown as money; real money buttons show the store price (Google Families policy requires a clear distinction, verified).

## Privacy and compliance checklist

P1:
- [ ] Privacy policy on the .com: what is collected (nothing in app), store billing, age signals, retention policy, security program, contact.
- [ ] COPPA: written retention policy and security program in place (required since 2026-04-22).
- [ ] Apple: age rating questionnaire answered (new 4+, 9+, 13+, 16+, 18+ tiers, verified); App Privacy answers "data not collected"; category choice (open question 6).
- [ ] Apple: if Kids Category is chosen, no third party analytics or advertising and all purchases and links behind the parental gate (guideline 1.3, verified); "For Kids" wording reserved for that category (2.3.8, verified).
- [ ] Google: target audience includes under 13, so Families policy applies; no advertising ID, no location, no unapproved SDKs (verified); Data safety form; content rating questionnaire.
- [ ] Texas SB 2420 and other states: age signal APIs integrated; IAP products age rated in Play Console (verified); significant change process documented.
- [ ] GDPR and UK: no processing of personal data in app; DPIA note recording "children likely to access, no data processed".
- [ ] Loot boxes: none; review checklist item for every new shop item.

P2:
- [ ] Anonymous ID notice naming the internal operations it supports (COPPA, verified).
- [ ] No third party disclosure of player data (avoids COPPA separate consent).
- [ ] Generated names only; preset phrases only.
- [ ] Updated Data safety and App Privacy answers; significant change notices to stores.
- [ ] Guest web build stores nothing and sets no identifiers.
- [ ] DPIA updated for online play.

P3 and P4:
- [ ] Re-run DPIA delta for any new data (none expected).
- [ ] Age rating re-check if tank or battle content changes violence descriptors.

P5:
- [ ] Full DPIA; consent flows for analytics; parental consent path for under 13 sign in (GDPR Article 8 thresholds per country, verified).
- [ ] Moderation policy, report and block, retention periods for reports.
- [ ] Re-check state age laws and store policy changes before launch.

## Engineering principles carried forward

- Deterministic simulation is the netcode foundation: seeded RNG only in `src/core/rng.ts`, sim and render never call the PRNG, generator versions frozen, state serialisable. New: per tick state hash for desync detection; deterministic math if the P2 spike demands it.
- TypeScript strict, no `any`; PixiJS v8 API only; `applyNeon(n)` the single neon entry point.
- Vitest for every pure module (economy, save migration, mode rules, netcode buffers); replay tests for each mode.
- One codebase for web, Android and iOS; platform differences behind a thin `platform/` adapter (billing, age signals, haptics, storage).
- Touch only; no keyboard, mouse or gamepad code.
- No new runtime dependency without declaration and approval (Capacitor plugins, three.js).
- Normal difficulty stays bit identical unless Ryan rules otherwise.
- Only Morpheus merges, after `npm test` and `npm run build` pass; deploy is a push to main.

## Spend plan

Rule: pay for a service only when its phase starts. All figures are estimates except where marked verified.

| Phase | One time (estimate) | Monthly (estimate) | Notes |
|---|---|---|---|
| P0 | 0 | 0 | |
| P1 | Company formation (unknown until jurisdiction), 25 USD Google (verified), 700 USD trademark filing (verified fee) plus 0 to 1,500 USD attorney, 500 to 3,000 USD legal review, 100 to 200 USD test phone | About 8 USD Apple (99 USD per year, verified via secondary source), about 1 to 2 USD domain | Biggest unknown is company formation and its yearly renewal |
| P2 | 0 | 5 to 30 USD backend and TURN | Workers paid plan minimum 5 USD (verified) |
| P3 | 0 | inside P2 estimate | |
| P4 | 0 | inside P2 estimate | three.js is free; cost is bundle size and builder time |
| P5 | DPIA review 500 to 2,000 USD | 30 to 200 USD backend; age assurance vendor unknown | Scales with players |

Store commission: model at 15% under both small business programs (verified), 30% above 1M USD.

Builder cost: cloud builder sessions draw on Ryan's Claude plan allowance (and the Codex lane once it exists); Morpheus checks headroom before any wave of more than three Opus sessions.

## New name

Shortlist (researcher run, 2026-11-08; about 250 coined words tried, nearly all .com names taken). The .com check is a Verisign RDAP lookup: a 404 means the .com was unregistered at the moment of the check, not that it is guaranteed or sold at a normal price. Store checks: App Store web search (US, UK, UAE, India, Germany) and Google Play (US, UAE, UK), top results only. Trademark checks are web searches only, not official databases.

| Rank | Name | Say it | Why it fits | Risks found |
|---|---|---|---|---|
| 1 | Strobora | stroh BOR uh | strobe plus aurora: flashing neon light, friendly | similar US mark STROBA; "strobe" invites a photosensitivity notice (needed anyway) |
| 2 | Vectazo | vek TAH zoh | vector plus "azo" (a big hit in Spanish): arcade punch | many vector themed indie games, none with this name; also buy Vektazo.com |
| 3 | Lumblitz | LUM blits | light plus lightning | "blitz" has a mild war sense; misspelling Lumeblitz |
| 4 | Strobazo | stroh BAH zoh | strobe plus "azo" | too close to Strobora to keep both; STROBA mark |
| 5 | Kromavolt | KROH muh volt | chroma plus volt | Chroma or Kroma spelling confusion; games Kromaia and Kromazone nearby |
| 6 | Lumazor | LOO muh zor | light plus laser and razor | US mark LUMIZAR two letters off; small itch.io games Lumaze, Luminaze |
| 7 | Glimvolt | GLIM volt | glimmer plus volt | a prescription medicine "Glimivolt" in India, one letter off; Gunvolt series sounds similar |
| 8 | Lumiblip | LOO mee blip | a light blip on radar, kid friendly | LumiBLO night light brand; reads cute rather than fast |

Morpheus recommendation: Strobora or Vectazo; register the chosen .com as soon as you pick it. Before committing, run a USPTO and EUIPO search in classes 9 and 41, and ask a Spanish speaker and an Arabic speaker to say it aloud.
Why: they are the only two with no hits on either store, the web or trademark web searches, and both are three easy syllables.

Criteria (ruling 9):
- One invented word, neon arcade energy, easy to say and spell after hearing it once.
- Not used by any game on Google Play or the App Store.
- Matching .com available to buy.

Checks, in order:
1. Store search on Google Play and the App Store for the exact word and close spellings.
2. .com availability at a registrar; buy immediately once chosen.
3. Trademark knockout search (recommended, not required by Ryan): USPTO search, WIPO Global Brand Database, EUIPO, and the UAE register; classes 9 and 41.
4. Social handles (optional): check and reserve on the platforms Ryan plans to use.
5. Plain language check: no unintended meaning in major languages.

Rename work starts only after Ryan picks the name; it is a single builder wave (strings, manifest, store metadata, repo docs), with the repo folder name left unchanged unless Ryan rules otherwise.

## Open questions for Ryan

1. Company jurisdiction: UAE mainland, a UAE free zone, or abroad (for example a US LLC)? Considerations: Apple requires a recognised legal entity with a D-U-N-S number and does not accept DBAs or trade names (verified); store payouts need a bank account in the company's name; which data protection law the company falls under; tax treatment of store income; cost and speed of formation; whether Ryan's other ventures should share or stay separate from this entity.
2. Premium unlock price range (placeholder: 2.99 to 6.99 USD)?
3. Which perks are premium: browser guest hosting only, or also extra modes (which ones), extra Repo slots, or a gem bonus? Free players must still get a complete solo game.
4. PVP stance: cosmetics only, cosmetics plus balanced side grades, or normalised loadouts in ranked play?
5. Asset rule: does JSON item data driving procedural cosmetics satisfy the rule, or do you want to allow SVG or image files for skins?
6. iOS category: Kids Category (strictest rules, age bands 5 and under, 6 to 8, 9 to 11) or a general Games category with a parental gate? Draft recommendation: general category, rated by the questionnaire. Why: Kids Category limits later online features and third party services, while the general category still allows a child safe design.
7. Do you agree to defer consumable gem packs to P2 and sell only non consumables in P1?
8. Does the public web build stay fully playable after store launch, or become guest only? A free full web game competes with the store version.
9. Launch target: a fixed date, or "when P1 gate passes"?
10. Marketing budget for launch, if any, and channels (none, social, paid user acquisition)? Paid acquisition aimed at a mixed audience has its own child safety rules.
11. Who owns art direction for skins and arenas: you, a builder lane with your review, or a contractor?
12. Guest join limits: one round, one session, or a time cap; maximum guests per host; any limit per day?
13. Gem pack restore in P2: accept loss on reinstall with clear warning, or add a recovery code shown to the player?
14. Will children use the game in schools or clubs (affects UK and EU expectations and Teacher Approved eligibility on Google Play)?
15. Is a minimum supported device list acceptable (for example Android 10 and newer, iOS 16 and newer)? Lower bounds increase test cost.
16. Do you want a lawyer engaged once for the privacy policy and the P5 DPIA, or a template plus self review for P1?

## Next actions after approval

1. Record Ryan's rulings in `docs/DECISIONS.md` and save this plan as `docs/16-public-plan.md`; update `docs/STATUS.md`.
2. Brief a Sonnet builder (roster nickname, slug "capacitor shell"): verify `npm run build:cap`, Capacitor 8, Android API 36 build, iOS Xcode 26 build, local bundle, audio unlock on iOS.
3. Brief an Opus builder (slug "iap spike"): Capgo native purchases versus RevenueCat, non consumable purchase and restore on both stores' sandboxes, report with recommendation.
4. Morpheus stub commit: shared types for economy events, save schema v1, item catalogue schema, platform adapter interface.
5. Brief an Opus builder (slug "gem ledger"): `src/economy/` pure module with earn table, ledger, Vitest coverage.
6. Brief an Opus builder (slug "repo shop"): shop and inventory UI on the catalogue JSON, procedural cosmetics through `applyNeon(n)`, parental gate component.
7. Brief a Sonnet builder (slug "save restore"): versioned save, migrations, store restore on launch.
8. Brief a Sonnet builder (slug "age signals"): Play Age Signals and Declared Age Range adapter, used only to gate purchases.
9. Draft for Ryan: privacy policy, retention policy, security program, store questionnaire answers.
10. Hand Ryan the step by step instructions for external tasks 1 to 8 of P1, starting with the company and the D-U-N-S request because they have the longest lead time.
11. After the name is chosen: marketing site on the .com and the rename wave.
12. Queue a P2 determinism spike early (V8 versus JavaScriptCore state hash comparison), because its result shapes the P2 netcode brief and costs one wave.

## Sources

Checked 2026-11-08.

- COPPA compliance date and new requirements: https://www.hunton.com/privacy-and-cybersecurity-law-blog/coppa-rule-amendment-compliance-deadline-approaches
- COPPA effective date, mixed audience, separate consent, retention, security program, internal operations notice: https://www.lw.com/en/insights/2025/05/ftc-publishes-updates-to-coppa-rule
- Apple Small Business Program: https://developer.apple.com/app-store/small-business-program/
- Google Play 15% service fee tier: https://support.google.com/googleplay/android-developer/answer/10632485?hl=en
- Google Play closed testing for new personal accounts: https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB
- Apple and Google account fees and organisation requirements, organisation exemption claim (secondary): https://capgo.app/blog/how-to-create-apple-developer-and-google-play-developer-accounts/
- Apple D-U-N-S requirement and timing: https://developer.apple.com/support/D-U-N-S/index.html
- App Store Review Guidelines 1.3, 2.3.6, 2.3.8, 3.1.1, 4.2, 5.1.4: https://developer.apple.com/app-store/review/guidelines/
- Apple kids apps, parental gates, age bands, Declared Age Range, age ratings: https://developer.apple.com/app-store/kids-apps/
- Apple updated age ratings: https://developer.apple.com/news/?id=ks775ehf
- Apple SDK minimum requirements: https://developer.apple.com/news/upcoming-requirements/
- Google Play Families policy: https://support.google.com/googleplay/android-developer/answer/9893335?hl=en
- Google Play target API level: https://support.google.com/googleplay/android-developer/answer/11926878
- Google Play Age Signals API: https://support.google.com/googleplay/android-developer/answer/16569691?hl=en
- Texas SB 2420 status and obligations: https://www.mofo.com/resources/insights/251111-texas-targets-app-stores-with-new-accountability-law
- State app store laws overview: https://www.venable.com/insights/publications/2025/12/new-app-developer-compliance-requirements
- State effective dates (secondary, verify): https://median.co/blog/new-age-verification-laws-2026
- GDPR Article 8: https://externer-datenschutzbeauftragter-dresden.de/gesetze/en/gdpr/art-8
- UK Children's Code game design guidance: https://www.rpclegal.com/snapshots/data-protection/spring-2023/ico-publishes-guidance-on-compliance-of-game-design-with-the-childrens-code/
- Brazil loot box ban: https://www.pocketgamer.biz/brazil-bans-loot-boxes-for-under-18s-in-online-child-safety-measure
- Belgium loot boxes: https://www.taylorwessing.com/en/insights-and-events/insights/2025/03/an-iphone-a-gambling-problem-and-the-loot-box-debate
- Cloudflare Realtime TURN and SFU pricing: https://developers.cloudflare.com/realtime/sfu/platform/pricing/
- Cloudflare Durable Objects pricing: https://developers.cloudflare.com/durable-objects/platform/pricing
- Colyseus Cloud pricing: https://colyseus.io/pricing
- Heroic Cloud pricing: https://heroiclabs.com/pricing
- Supabase pricing: https://supabase.com/pricing
- RevenueCat pricing: https://revenuecat.com/pricing
- Capgo native purchases plugin: https://github.com/Cap-go/capacitor-native-purchases
- iOS WebAudio silent switch workaround: https://github.com/swevans/unmute
- USPTO fees from 2025-01-18: https://www.frosszelnick.com/2025-uspto-fee-increase/
