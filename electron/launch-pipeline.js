const fs = require('fs');
const path = require('path');
const { installClient, isStubFile } = require('./client-install');

const STAGES = [
  { id: 'assets', label: 'Loading assets...', weight: 14 },
  { id: 'client', label: 'Loading client...', weight: 30 },
  { id: 'protection', label: 'Loading protection files...', weight: 14 },
  { id: 'jvm', label: 'Loading JVM library...', weight: 14 },
  { id: 'binary', label: 'Loading binary...', weight: 12 },
  { id: 'lib', label: 'Loading lib...', weight: 16 }
];

const TOTAL_WEIGHT = STAGES.reduce((s, x) => s + x.weight, 0);

function stageBasePct(index) {
  let n = 0;
  for (let i = 0; i < index; i++) n += STAGES[i].weight;
  return Math.round((n / TOTAL_WEIGHT) * 100);
}

function emit(onProgress, client, stageId, localPct, label) {
  const idx = STAGES.findIndex((s) => s.id === stageId);
  const stage = STAGES[idx] || STAGES[0];
  const base = stageBasePct(Math.max(0, idx));
  const span = stage.weight / TOTAL_WEIGHT * 100;
  const pct = Math.min(99, Math.round(base + (span * Math.min(100, localPct)) / 100));
  onProgress?.({
    client,
    stage: stageId,
    pct,
    label: label || stage.label
  });
}

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

const TICK_STEPS = 10;
const TICK_DELAY_MS = 200;
const STAGE_PAUSE_MS = 300;

async function tick(localPct, onProgress, client, stageId, label, steps = TICK_STEPS) {
  for (let i = 1; i <= steps; i++) {
    emit(onProgress, client, stageId, (localPct / steps) * i, label);
    await new Promise((r) => setTimeout(r, TICK_DELAY_MS));
  }
}

async function pauseStage() {
  await new Promise((r) => setTimeout(r, STAGE_PAUSE_MS));
}

async function ensureAssetsStage(ctx, client) {
  const { installPath, resourcesRoot, projectRoot, bundledAssetsDir, onProgress } = ctx;
  emit(onProgress, client, 'assets', 5, 'Loading assets...');
  const src = bundledAssetsDir();
  const dst = path.join(installPath, 'assets');
  fs.mkdirSync(installPath, { recursive: true });
  if (!fs.existsSync(dst) && fs.existsSync(src)) {
    copyDir(src, dst);
  }
  const devAssets = path.join(projectRoot, 'assets');
  if (!fs.existsSync(path.join(dst, 'indexes')) && fs.existsSync(devAssets)) {
    copyDir(devAssets, dst);
  }
  const indexes = path.join(dst, 'indexes');
  if (!fs.existsSync(indexes)) {
    fs.mkdirSync(indexes, { recursive: true });
    fs.writeFileSync(path.join(indexes, '.magenta'), 'stub', 'utf8');
  }
  await tick(100, onProgress, client, 'assets', 'Loading assets...');
  await pauseStage();
}

async function ensureJvmStage(ctx, client, findJava) {
  const { onProgress } = ctx;
  emit(onProgress, client, 'jvm', 10, 'Loading JVM library...');
  findJava();
  await tick(100, onProgress, client, 'jvm', 'Loading JVM library...');
  await pauseStage();
}

async function ensureBinaryStage(ctx, client) {
  const { installPath, resourcesRoot, onProgress } = ctx;
  emit(onProgress, client, 'binary', 50, 'Loading binary...');
  await tick(100, onProgress, client, 'binary', 'Loading binary...');
  await pauseStage();
}

async function runPreparePipeline(kind, ctx) {
  const client = kind;
  const { onProgress } = ctx;

  await ensureAssetsStage(ctx, client);

  emit(onProgress, client, 'client', 0, 'Loading client...');
  await installClient(kind, {
    ...ctx,
    onProgress: (dlPct) => emit(onProgress, client, 'client', dlPct, 'Loading client...')
  });
  await pauseStage();

  await ensureJvmStage(ctx, client, ctx.findJava);
  await ensureBinaryStage(ctx, client);

  emit(onProgress, client, 'lib', 15, 'Loading lib...');
  if (kind === 'stable' && ctx.ensureNatives) {
    await ctx.ensureNatives(ctx.store);
  }
  await tick(100, onProgress, client, 'lib', 'Loading lib...');
  await pauseStage();
}

function finishLaunching(onProgress, client) {
  emit(onProgress, client, 'client', 100, 'Launching...');
  onProgress?.({ client, stage: 'launching', pct: 100, label: 'Launching...' });
}

module.exports = {
  STAGES,
  runPreparePipeline,
  finishLaunching,
  emit
};
