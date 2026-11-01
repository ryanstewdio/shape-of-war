#!/usr/bin/env node
// Shape of War dispatcher. Node 22, zero dependencies, ESM.
// Canon: SPEC.md section 7.2. Job formats: .agents/README.md.
// Ryan starts it once with `npm run dispatcher` in the Shape of War terminal.
// Fable (Claude Desktop) queues jobs by writing .agents/queue/<seq>-<nickname>-<slug>.json.

import { spawn, execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AGENTS = path.join(REPO, '.agents');
const DIRS = {
  queue: path.join(AGENTS, 'queue'),
  running: path.join(AGENTS, 'running'),
  done: path.join(AGENTS, 'done'),
  failed: path.join(AGENTS, 'failed'),
  runs: path.join(AGENTS, 'runs'),
};

const intEnv = (name, def) => {
  const v = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : def;
};
const MAX_PARALLEL = intEnv('MAX_PARALLEL', 4);
const MAX_BUDGET_USD = intEnv('MAX_BUDGET_USD', 25); // claude 2.1.x dropped --max-turns
const WALL_MS = intEnv('WALL_MS', 90 * 60 * 1000);
const SHELL_WALL_MS = intEnv('SHELL_WALL_MS', 30 * 60 * 1000);
const POLL_MS = 2000;
const SETTLE_MS = 1000; // ignore queue files modified in the last second (partial writes)
const KILL_GRACE_MS = 10000;
// cloud jobs: `claude --cloud` returns once the session exists; a run still attached after this is killed.
const CLOUD_WALL_MS = intEnv('CLOUD_WALL_MS', 60 * 1000);
// watch jobs: poll the remote branch this often, give up after timeoutMin (default below).
const WATCH_POLL_MS = intEnv('WATCH_POLL_MS', 2 * 60 * 1000);
const WATCH_TIMEOUT_MIN = 90;
const CLOUD_MODELS = ['opus', 'sonnet'];
const STDOUT_KEEP = 20 * 1024 * 1024;

// Shell allowlist: a cmd matching any of these is rejected and never run.
const DENY = [
  [/push[^&|;]*--force/, 'push --force'],
  [/push\b[^&|;]*\s-f(\s|$)/, 'push -f'],
  [/reset\s+--hard/, 'reset --hard'],
  [/\brebase\b/, 'rebase'],
  [/filter-branch/, 'filter-branch'],
  [/~/, '~'],
  [/\$HOME|\$\{HOME\}/, '$HOME'],
  [/\bsudo\b/, 'sudo'],
  [/curl .*\|.*sh/, 'curl piped to sh'],
];

const ts = () => new Date().toISOString();
const say = (msg) => console.log(`${ts()} ${msg}`);

// ---------- validation ----------

function shellDenyReason(cmd) {
  for (const [re, label] of DENY) if (re.test(cmd)) return `allowlist: matches ${label}`;
  // rm -rf only when every target starts with ../sow- and has no further ..
  for (const seg of cmd.split(/&&|\|\||;|\||\n/)) {
    const toks = seg.trim().split(/\s+/).filter(Boolean);
    const i = toks.indexOf('rm');
    if (i === -1) continue;
    const args = toks.slice(i + 1);
    const flags = args.filter((a) => a.startsWith('-')).join('');
    if (!(/r|R/.test(flags) && /f/.test(flags))) continue;
    const targets = args.filter((a) => !a.startsWith('-'));
    if (targets.length === 0) return 'allowlist: rm -rf with no target';
    for (const t of targets) {
      const clean = t.replace(/^['"]|['"]$/g, '');
      if (!clean.startsWith('../sow-') || clean.slice(2).includes('..')) {
        return `allowlist: rm -rf outside ../sow- (${clean})`;
      }
    }
  }
  return null;
}

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

const BRANCH_RE = /^[A-Za-z0-9._\/-]+$/;

/** A repo relative path with no .. segment and no leading /. */
function safeRelPath(p) {
  return typeof p === 'string' && p.trim() !== '' && !p.startsWith('/') && !p.split('/').includes('..');
}

function validateJob(job) {
  if (!job || typeof job !== 'object') return 'job is not a JSON object';
  if (!['agent', 'shell', 'cloud', 'watch'].includes(job.type)) return 'type must be "agent", "shell", "cloud" or "watch"';
  if (typeof job.nickname !== 'string' || !NAME_RE.test(job.nickname)) return 'nickname must match [a-z0-9-]';
  if (typeof job.slug !== 'string' || !NAME_RE.test(job.slug)) return 'slug must match [a-z0-9-]';
  if (job.type === 'cloud') {
    if (!CLOUD_MODELS.includes(job.model)) return 'cloud job model must be "opus" or "sonnet"';
    if (typeof job.branch !== 'string' || !BRANCH_RE.test(job.branch) || job.branch === 'main') return 'branch invalid or main';
    if (!safeRelPath(job.brief) || !/^docs\/briefs\/[A-Za-z0-9._-]+\.md$/.test(job.brief)) return 'cloud job brief must be docs/briefs/<name>.md';
    if (!fs.existsSync(path.join(REPO, job.brief))) return `brief file missing: ${job.brief}`;
    return null;
  }
  if (job.type === 'watch') {
    if (typeof job.branch !== 'string' || !BRANCH_RE.test(job.branch) || job.branch === 'main') return 'branch invalid or main';
    if (!safeRelPath(job.handoff) || !/^docs\/handoffs\/[A-Za-z0-9._-]+\.md$/.test(job.handoff)) return 'watch job handoff must be docs/handoffs/<name>.md';
    if (job.timeoutMin !== undefined && !(typeof job.timeoutMin === 'number' && job.timeoutMin > 0)) return 'timeoutMin must be a positive number';
    return null;
  }
  if (job.type === 'agent') {
    for (const k of ['model', 'branch', 'worktree', 'brief']) {
      if (typeof job[k] !== 'string' || job[k].trim() === '') return `agent job needs string "${k}"`;
    }
    if (!/^[A-Za-z0-9._\/-]+$/.test(job.branch) || job.branch === 'main') return 'branch invalid or main';
    if (!job.worktree.startsWith('../sow-') || job.worktree.slice(2).includes('..')) {
      return 'worktree must start with ../sow- and contain no further ..';
    }
    const roster = path.join(REPO, '.claude', 'agents', `${job.nickname}.md`);
    if (!fs.existsSync(roster)) return `roster file missing: .claude/agents/${job.nickname}.md`;
  } else {
    if (typeof job.cmd !== 'string' || job.cmd.trim() === '') return 'shell job needs string "cmd"';
    if (job.cwd !== undefined && typeof job.cwd !== 'string') return 'cwd must be a string';
    const deny = shellDenyReason(job.cmd);
    if (deny) return deny;
    const cwd = path.resolve(REPO, job.cwd ?? '.');
    if (!fs.existsSync(cwd)) return `cwd does not exist: ${job.cwd}`;
  }
  return null;
}

// ---------- helpers ----------

function writeAtomic(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

function git(args, cwd = REPO) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function headSha(cwd) {
  try { return git(['rev-parse', 'HEAD'], cwd); } catch { return null; }
}

let gitChain = Promise.resolve();
function withGitLock(fn) {
  const next = gitChain.then(fn, fn);
  gitChain = next.catch(() => {});
  return next;
}

function ensureBranchAndWorktree(job, log) {
  const wt = path.resolve(REPO, job.worktree);
  try {
    git(['rev-parse', '--verify', '--quiet', `refs/heads/${job.branch}`]);
  } catch {
    log(`git branch ${job.branch} main\n`);
    git(['branch', job.branch, 'main']);
  }
  if (fs.existsSync(wt)) {
    if (!fs.existsSync(path.join(wt, '.git'))) throw new Error(`worktree path exists but is not a git worktree: ${job.worktree}`);
    const cur = git(['rev-parse', '--abbrev-ref', 'HEAD'], wt);
    if (cur !== job.branch) throw new Error(`worktree ${job.worktree} is on ${cur}, expected ${job.branch}`);
  } else {
    log(`git worktree add ${job.worktree} ${job.branch}\n`);
    git(['worktree', 'add', wt, job.branch]);
  }
  return wt;
}

/** The launch line a cloud session gets: the brief path and the two rules. */
function cloudPrompt(brief) {
  return `Read ${brief} and carry it out exactly. Create the branch it names before any edit. Never push main. Before pushing, if git remote -v is empty run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. The brief's push instruction applies to this cloud session. You have explicit go ahead to attach stoopstoop/shape-of-war with push access (add_repo) at the start; do it before any work.`;
}

/**
 * argv of a cloud job. `env -u ANTHROPIC_API_KEY` drops the key so the session bills the logged in
 * Max account; --model must come before --cloud.
 */
function cloudArgv(job) {
  // `claude --cloud` refuses a non interactive stdout, so wrap the call in a pseudo terminal (macOS script).
  return ['script', '-q', '/dev/null', 'env', '-u', 'ANTHROPIC_API_KEY', 'claude', '--model', job.model, '--cloud', cloudPrompt(job.brief)];
}

/**
 * From `claude --cloud` stdout: the session URL (the View line's claude.ai URL, query string
 * dropped) and the Resume line (the text after "Resume:"), or null for either when absent.
 */
function parseCloudOutput(stdout) {
  const clean = String(stdout).replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '');
  let sessionUrl = null;
  let resume = null;
  const urlIn = (l) => {
    const m = l.match(/https:\/\/claude\.ai\/[^\s'"<>)]+/);
    return m ? m[0].split('?')[0].split('#')[0] : null;
  };
  for (const raw of clean.split(/\r?\n/)) {
    const l = raw.trim();
    if (sessionUrl === null && /^view\b/i.test(l)) sessionUrl = urlIn(l);
    if (resume === null && /^resume\b/i.test(l)) {
      const rest = l.replace(/^resume\b\s*:?\s*/i, '').trim();
      resume = rest === '' ? null : rest;
    }
  }
  if (sessionUrl === null) for (const raw of clean.split(/\r?\n/)) if ((sessionUrl = urlIn(raw)) !== null) break;
  return { sessionUrl, resume };
}

/** Watch jobs run beside everything else: they never count against MAX_PARALLEL. */
function countsTowardParallel(job) {
  return job?.type !== 'watch';
}

function parseClaudeJson(stdout) {
  const t = stdout.trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const lines = t.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim();
    if (!l.startsWith('{')) continue;
    try { return JSON.parse(l); } catch { /* keep looking */ }
  }
  return null;
}

// ---------- self test (no API key or claude needed) ----------

function selftest() {
  let failed = 0;
  const check = (name, ok) => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
    if (!ok) failed++;
  };
  const out = [
    '\u001b[32mCreated cloud session\u001b[0m',
    'View: https://claude.ai/code/session_01ABCdef?utm_source=cli&x=1',
    'Resume: claude --resume session_01ABCdef',
    '',
  ].join('\n');
  const p = parseCloudOutput(out);
  check('parse: session URL from the View line, query string dropped', p.sessionUrl === 'https://claude.ai/code/session_01ABCdef');
  check('parse: Resume line text', p.resume === 'claude --resume session_01ABCdef');
  const none = parseCloudOutput('Error: not logged in\n');
  check('parse: nothing printed gives nulls', none.sessionUrl === null && none.resume === null);
  const bare = parseCloudOutput('Created cloud session\n  view at https://claude.ai/code/session_x#top\n');
  check('parse: a URL on a lower case view line, fragment dropped', bare.sessionUrl === 'https://claude.ai/code/session_x');

  const brief = 'docs/briefs/shipwright-cloud-dispatch.md';
  const cloud = { type: 'cloud', nickname: 'shipwright', slug: 'cloud-dispatch', model: 'sonnet', brief, branch: 'chore/cloud-dispatch' };
  check('cloud: a valid job passes', validateJob(cloud) === null);
  check('cloud: main is refused', validateJob({ ...cloud, branch: 'main' }) !== null);
  check('cloud: an unknown model is refused', validateJob({ ...cloud, model: 'claude-opus-5-5' }) !== null);
  check('cloud: a missing brief file is refused', /brief file missing/.test(validateJob({ ...cloud, brief: 'docs/briefs/no-such-brief.md' }) ?? ''));
  check('cloud: a brief outside docs/briefs is refused', validateJob({ ...cloud, brief: '../secrets.md' }) !== null);
  const argv = cloudArgv(cloud);
  check('cloud: argv drops the API key and puts --model before --cloud',
    argv.slice(3, 7).join(' ') === 'env -u ANTHROPIC_API_KEY claude' && argv.indexOf('--model') < argv.indexOf('--cloud') && argv[argv.indexOf('--model') + 1] === 'sonnet');
  check('cloud: the launch line names the brief and the rules',
    argv[argv.length - 1].startsWith(`Read ${brief} and carry it out exactly. Create the branch it names before any edit. Never push main.`) && argv[argv.length - 1].includes('git remote add origin'));

  const watch = { type: 'watch', nickname: 'fable', slug: 'watch-cloud-dispatch', branch: 'chore/cloud-dispatch', handoff: 'docs/handoffs/shipwright-cloud-dispatch.md', timeoutMin: 90 };
  check('watch: a valid job passes', validateJob(watch) === null);
  check('watch: timeoutMin may be left out', validateJob({ ...watch, timeoutMin: undefined }) === null);
  check('watch: main is refused', validateJob({ ...watch, branch: 'main' }) !== null);
  check('watch: a bad timeout is refused', validateJob({ ...watch, timeoutMin: 0 }) !== null);
  check('watch: a handoff outside docs/handoffs is refused', validateJob({ ...watch, handoff: 'docs/../x.md' }) !== null);
  check('watch: never counts against MAX_PARALLEL', !countsTowardParallel(watch) && countsTowardParallel(cloud));

  check('shell: an allowed job is unchanged', validateJob({ type: 'shell', nickname: 'fable', slug: 'diff', cmd: 'git status' }) === null);
  check('shell: the allowlist is unchanged', /allowlist/.test(validateJob({ type: 'shell', nickname: 'fable', slug: 'x', cmd: 'git push --force' }) ?? ''));
  check('type: anything else is refused', validateJob({ type: 'remote', nickname: 'a', slug: 'b' }) !== null);
  console.log(failed === 0 ? 'selftest: all passed' : `selftest: ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

if (process.argv.includes('--selftest')) selftest();

// ---------- startup checks ----------

const key = process.env.ANTHROPIC_API_KEY ?? '';
if (!key) {
  console.error('dispatcher: ANTHROPIC_API_KEY is not set. Export it in this terminal (runbook section B.2) and rerun.');
  process.exit(1);
}

let claudeVersion;
let claudeHelp = '';
try {
  claudeVersion = execFileSync('claude', ['--version'], { encoding: 'utf8' }).trim();
  claudeHelp = execFileSync('claude', ['--help'], { encoding: 'utf8' });
} catch (e) {
  console.error(`dispatcher: cannot run claude (${e.message}). Install Claude Code (runbook section A) and rerun.`);
  process.exit(1);
}
const HAS_BARE = claudeHelp.includes('--bare');

for (const d of Object.values(DIRS)) fs.mkdirSync(d, { recursive: true });

console.log(`dispatcher: watching .agents/queue (max parallel ${MAX_PARALLEL})`);
console.log(`dispatcher: claude ${claudeVersion}`);
console.log(`dispatcher: api key sk-ant-...${key.slice(-4)}`);
say(`mode: ${HAS_BARE ? '--bare' : 'normal'}, budget per agent run $${MAX_BUDGET_USD}, roster and CLAUDE.md via --append-system-prompt, Bash allowlist via --allowedTools`);

// ---------- run bookkeeping ----------

const running = new Map(); // id -> { job, child, cwdKey }
let stopping = false;

function finish(id, job, base, res) {
  const runDir = path.join(DIRS.runs, id);
  const result = {
    id,
    type: job?.type ?? null,
    nickname: job?.nickname ?? null,
    slug: job?.slug ?? null,
    exitCode: res.exitCode,
    startedAt: base.startedAt,
    endedAt: res.endedAt,
    durationMs: Date.parse(res.endedAt) - Date.parse(base.startedAt),
    ...(res.costUsd !== undefined ? { costUsd: res.costUsd } : {}),
    branch: job && ['agent', 'cloud', 'watch'].includes(job.type) ? job.branch : null,
    headSha: res.headSha ?? null,
    error: res.error ?? null,
    ...(res.extra ?? {}),
  };
  fs.mkdirSync(runDir, { recursive: true });
  writeAtomic(path.join(runDir, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  const ok = res.exitCode === 0 && !res.error;
  const from = path.join(DIRS.running, `${id}.json`);
  const to = path.join(ok ? DIRS.done : DIRS.failed, `${id}.json`);
  try { fs.renameSync(from, to); } catch { /* already moved */ }
  say(`${ok ? 'done' : 'failed'} ${id} exit=${res.exitCode}${res.error ? ` error="${res.error}"` : ''}${res.costUsd !== undefined ? ` cost=$${res.costUsd}` : ''}`);
}

function runProcess(id, job, argv, cwd, wallMs, onStdout) {
  return new Promise((resolve) => {
    const runDir = path.join(DIRS.runs, id);
    const logStream = fs.createWriteStream(path.join(runDir, 'log.txt'), { flags: 'a' });
    const child = spawn(argv[0], argv.slice(1), { cwd, env: process.env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const entry = running.get(id);
    if (entry) entry.child = child;
    let timedOut = false;
    let interrupted = false;
    const killGroup = (sig) => { try { process.kill(-child.pid, sig); } catch { try { child.kill(sig); } catch { /* gone */ } } };
    const timer = setTimeout(() => {
      timedOut = true;
      say(`timeout ${id} after ${Math.round(wallMs / 60000)} min, SIGTERM`);
      killGroup('SIGTERM');
      setTimeout(() => killGroup('SIGKILL'), KILL_GRACE_MS).unref();
    }, wallMs);
    if (entry) entry.interrupt = () => { interrupted = true; killGroup('SIGTERM'); setTimeout(() => killGroup('SIGKILL'), KILL_GRACE_MS).unref(); };
    child.stdout.on('data', (b) => { logStream.write(b); onStdout?.(b); });
    child.stderr.on('data', (b) => logStream.write(b));
    child.on('error', (e) => logStream.write(`\n[dispatcher] spawn error: ${e.message}\n`));
    // stragglers in the process group can hold the stdout pipe open and block 'close'; reap them on exit
    child.on('exit', () => killGroup('SIGTERM'));
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      logStream.end(`\n[dispatcher] exit code=${code} signal=${signal ?? 'none'}\n`);
      const exitCode = code ?? 128;
      let error = null;
      if (timedOut) error = `wall clock limit ${wallMs} ms exceeded`;
      else if (interrupted) error = 'interrupted: dispatcher stopped';
      else if (signal) error = `killed by ${signal}`;
      resolve({ exitCode, error });
    });
  });
}

async function runAgent(id, job, base) {
  const runDir = path.join(DIRS.runs, id);
  const logFile = path.join(runDir, 'log.txt');
  const log = (s) => fs.appendFileSync(logFile, s);
  let wt;
  try {
    wt = await withGitLock(() => ensureBranchAndWorktree(job, log));
  } catch (e) {
    log(`[dispatcher] setup failed: ${e.message}\n`);
    return { exitCode: 1, error: `setup: ${e.message}`, endedAt: ts() };
  }
  if (stopping) return { exitCode: 1, error: 'interrupted: dispatcher stopped before launch', headSha: headSha(wt), endedAt: ts() };
  const roster = path.join(REPO, '.claude', 'agents', `${job.nickname}.md`);
  const argv = ['claude', '-p', '--model', job.model, '--output-format', 'json', '--permission-mode', 'acceptEdits', '--max-budget-usd', String(MAX_BUDGET_USD)];
  // Builders need Bash for npm, node, gh api and local git. acceptEdits alone refuses every Bash call in a headless run.
  const ALLOWED = process.env.ALLOWED_TOOLS || ['Read','Edit','Write','MultiEdit','Glob','Grep','Bash(npm:*)','Bash(npx:*)','Bash(node:*)','Bash(tsc:*)','Bash(gh api:*)','Bash(gh run:*)','Bash(git add:*)','Bash(git commit:*)','Bash(git status:*)','Bash(git diff:*)','Bash(git log:*)','Bash(git rev-parse:*)','Bash(git ls-files:*)','Bash(git branch:*)','Bash(ls:*)','Bash(cat:*)','Bash(head:*)','Bash(tail:*)','Bash(grep:*)','Bash(rg:*)','Bash(find:*)','Bash(mkdir:*)','Bash(wc:*)','Bash(sed:*)','Bash(which:*)','Bash(echo:*)','Bash(printf:*)','Bash(cp:*)','Bash(mv:*)','Bash(chmod:*)'].join(',');
  argv.push('--allowedTools', ALLOWED);
  if (HAS_BARE) argv.push('--bare'); // skips user hooks, auto-memory and ~/.claude CLAUDE.md; auth is strictly ANTHROPIC_API_KEY
  const rules = fs.readFileSync(path.join(REPO, 'CLAUDE.md'), 'utf8');
  argv.push('--append-system-prompt', `${rules}\n\n${fs.readFileSync(roster, 'utf8')}`);
  // '--' ends option parsing so a brief starting with '-' is never read as a flag
  // absolute worktree path in argv so `pkill -f "<worktree>"` can find this run (runbook I.5)
  argv.push('--', `${job.brief}\n\n(dispatcher run ${id}, worktree ${wt})`);
  log(`[dispatcher] ${ts()} claude -p --model ${job.model} in ${job.worktree}\n`);

  let out = '';
  const res = await runProcess(id, job, argv, wt, WALL_MS, (b) => {
    out += b.toString('utf8');
    if (out.length > STDOUT_KEEP) out = out.slice(-STDOUT_KEEP);
  });
  const parsed = parseClaudeJson(out);
  let handoff;
  let costUsd;
  let error = res.error;
  if (parsed && typeof parsed === 'object') {
    handoff = typeof parsed.result === 'string' ? parsed.result : JSON.stringify(parsed, null, 2);
    const c = parsed.total_cost_usd ?? parsed.cost_usd;
    if (typeof c === 'number') costUsd = c;
    if (!error && parsed.is_error) error = `claude reported error: ${parsed.subtype ?? 'unknown'}`;
  } else {
    handoff = out.split('\n').slice(-80).join('\n');
    if (!error && res.exitCode === 0) error = 'could not parse claude JSON output';
  }
  writeAtomic(path.join(runDir, 'handoff.md'), handoff.endsWith('\n') ? handoff : handoff + '\n');
  return { exitCode: res.exitCode, error, costUsd, headSha: headSha(wt), endedAt: ts() };
}

async function runCloud(id, job) {
  const runDir = path.join(DIRS.runs, id);
  fs.appendFileSync(path.join(runDir, 'log.txt'), `[dispatcher] ${ts()} env -u ANTHROPIC_API_KEY claude --model ${job.model} --cloud (brief ${job.brief}, branch ${job.branch})\n`);
  let out = '';
  const res = await runProcess(id, job, cloudArgv(job), REPO, CLOUD_WALL_MS, (b) => {
    out += b.toString('utf8');
    if (out.length > STDOUT_KEEP) out = out.slice(-STDOUT_KEEP);
  });
  const { sessionUrl, resume } = parseCloudOutput(out);
  let { exitCode, error } = res;
  // Still attached after CLOUD_WALL_MS: the session exists once its URL is printed, so the kill is fine.
  const attached = typeof error === 'string' && error.startsWith('wall clock limit');
  if (attached && sessionUrl !== null) {
    exitCode = 0;
    error = null;
  } else if (!error && sessionUrl === null) {
    error = 'no session URL in claude --cloud output';
  }
  return { exitCode, error, headSha: null, endedAt: ts(), extra: { sessionUrl, resume, killedAfterUrl: attached && sessionUrl !== null } };
}

const execFileAsync = (cmd, args) =>
  new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd: REPO, encoding: 'utf8' }, (err, stdout) => (err ? reject(err) : resolve(String(stdout).trim())));
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runWatch(id, job) {
  const log = (s) => fs.appendFileSync(path.join(DIRS.runs, id, 'log.txt'), `[dispatcher] ${ts()} ${s}\n`);
  const limitMin = job.timeoutMin ?? WATCH_TIMEOUT_MIN;
  const limitMs = limitMin * 60 * 1000;
  const until = Date.now() + limitMs;
  let cancelled = false;
  const entry = running.get(id);
  if (entry) entry.interrupt = () => { cancelled = true; };
  log(`watching origin ${job.branch} for ${job.handoff}, every ${Math.round(WATCH_POLL_MS / 1000)} s, up to ${limitMin} min`);
  while (!cancelled && !stopping) {
    try {
      const heads = await execFileAsync('git', ['ls-remote', '--heads', 'origin', job.branch]);
      if (heads !== '') {
        await execFileAsync('git', ['fetch', 'origin', job.branch]);
        let found = true;
        try { await execFileAsync('git', ['cat-file', '-e', `origin/${job.branch}:${job.handoff}`]); } catch { found = false; }
        if (found) {
          const head = await execFileAsync('git', ['rev-parse', `origin/${job.branch}`]);
          const mainLine = await execFileAsync('git', ['ls-remote', 'origin', 'refs/heads/main']);
          const originMain = mainLine.split(/\s+/)[0] || null;
          log(`landed: ${job.branch} at ${head}, origin/main ${originMain}`);
          return { exitCode: 0, error: null, headSha: head, endedAt: ts(), extra: { landed: true, originMain } };
        }
        log(`branch is up, ${job.handoff} not there yet`);
      } else {
        log('branch not on origin yet');
      }
    } catch (e) {
      log(`poll error (will retry): ${e.message.split('\n')[0]}`);
    }
    if (Date.now() + WATCH_POLL_MS > until) break;
    const end = Date.now() + WATCH_POLL_MS;
    while (Date.now() < end && !cancelled && !stopping) await sleep(Math.min(1000, end - Date.now()));
  }
  const why = cancelled || stopping ? 'interrupted: dispatcher stopped' : `watch timed out after ${limitMin} min`;
  return { exitCode: 1, error: why, headSha: null, endedAt: ts(), extra: { landed: false, originMain: null } };
}

async function runShell(id, job) {
  const cwd = path.resolve(REPO, job.cwd ?? '.');
  fs.appendFileSync(path.join(DIRS.runs, id, 'log.txt'), `[dispatcher] ${ts()} bash -lc in ${job.cwd ?? '.'}: ${job.cmd}\n`);
  const res = await runProcess(id, job, ['bash', '-lc', job.cmd], cwd, SHELL_WALL_MS);
  return { exitCode: res.exitCode, error: res.error, headSha: headSha(cwd), endedAt: ts() };
}

// ---------- queue scanning ----------

function rejectInQueue(file, id, job, reason) {
  const runDir = path.join(DIRS.runs, id);
  const startedAt = ts();
  if (fs.existsSync(path.join(runDir, 'result.json'))) {
    // never clobber an earlier run's evidence
    const dup = path.join(DIRS.failed, `${id}.duplicate-${Date.now()}.json`);
    try { fs.renameSync(file, dup); } catch { /* claimed elsewhere */ }
    say(`rejected ${id}: ${reason} (moved to failed/${path.basename(dup)})`);
    return;
  }
  try { fs.renameSync(file, path.join(DIRS.running, `${id}.json`)); } catch { return; }
  fs.mkdirSync(runDir, { recursive: true });
  fs.appendFileSync(path.join(runDir, 'log.txt'), `[dispatcher] ${startedAt} rejected: ${reason}\n`);
  say(`rejected ${id}: ${reason}`);
  finish(id, job, { startedAt }, { exitCode: 1, error: reason, endedAt: ts() });
}

let scanning = false;
function scan() {
  if (scanning || stopping) return;
  scanning = true;
  try {
    const files = fs.readdirSync(DIRS.queue).filter((f) => f.endsWith('.json')).sort();
    const busy = () => [...running.values()].filter((r) => countsTowardParallel(r.job)).length;
    for (const f of files) {
      const file = path.join(DIRS.queue, f);
      const id = f.slice(0, -5);
      let st;
      try { st = fs.statSync(file); } catch { continue; }
      if (Date.now() - st.mtimeMs < SETTLE_MS) continue;
      let job;
      try { job = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
        rejectInQueue(file, id, null, `invalid JSON: ${e.message}`);
        continue;
      }
      const invalid = validateJob(job);
      if (invalid) { rejectInQueue(file, id, job, invalid); continue; }
      // watch jobs never wait for a slot; everything else waits while MAX_PARALLEL are busy
      if (countsTowardParallel(job) && busy() >= MAX_PARALLEL) continue;
      if (running.has(id) || fs.existsSync(path.join(DIRS.runs, id, 'result.json'))) {
        rejectInQueue(file, id, job, 'duplicate id: requeue with a new seq');
        continue;
      }
      // shell jobs on the same cwd run one at a time, in filename order
      const cwdKey = job.type === 'shell' ? path.resolve(REPO, job.cwd ?? '.') : null;
      if (cwdKey && [...running.values()].some((r) => r.cwdKey === cwdKey)) continue;
      try { fs.renameSync(file, path.join(DIRS.running, f)); } catch { continue; }
      start(id, job, cwdKey);
    }
  } finally {
    scanning = false;
  }
}

function start(id, job, cwdKey) {
  const runDir = path.join(DIRS.runs, id);
  fs.mkdirSync(runDir, { recursive: true });
  const base = { startedAt: ts() };
  running.set(id, { job, child: null, cwdKey });
  const what = job.type === 'agent' || job.type === 'cloud' ? ` ${job.model} ${job.branch}` : job.type === 'watch' ? ` ${job.branch}` : '';
  say(`claimed ${id} (${job.type} ${job.nickname}${what})`);
  const p =
    job.type === 'agent' ? runAgent(id, job, base) : job.type === 'cloud' ? runCloud(id, job) : job.type === 'watch' ? runWatch(id, job) : runShell(id, job);
  p.catch((e) => ({ exitCode: 1, error: `dispatcher: ${e.message}`, endedAt: ts() }))
    .then((res) => {
      finish(id, job, base, res);
      running.delete(id);
      if (stopping && running.size === 0) process.exit(0);
      scan();
    });
}

// Stale jobs left in running/ by a dispatcher that died: fail them so Fable sees it.
for (const f of fs.readdirSync(DIRS.running).filter((x) => x.endsWith('.json'))) {
  const id = f.slice(0, -5);
  let job = null;
  try { job = JSON.parse(fs.readFileSync(path.join(DIRS.running, f), 'utf8')); } catch { /* keep null */ }
  fs.mkdirSync(path.join(DIRS.runs, id), { recursive: true });
  say(`stale ${id}: found in running/ at startup`);
  finish(id, job, { startedAt: ts() }, { exitCode: 1, error: 'stale: dispatcher restarted while job was running; requeue with a new seq', endedAt: ts() });
}

try { fs.watch(DIRS.queue, () => setTimeout(scan, SETTLE_MS + 50)); } catch { /* polling still works */ }
setInterval(scan, POLL_MS);
scan();

process.on('SIGINT', () => {
  if (stopping) { say('second SIGINT, exiting now'); process.exit(130); }
  stopping = true;
  const ids = [...running.keys()];
  say(`SIGINT: claiming nothing new. running: ${ids.length ? ids.join(', ') : 'none'}`);
  if (ids.length === 0) process.exit(0);
  say('terminating running jobs; they land in failed/ with error "interrupted"');
  for (const r of running.values()) r.interrupt?.();
});
