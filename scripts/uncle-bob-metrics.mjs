#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const sourceRoot = join(root, 'apps/api/src');
const reportPath = join(root, 'docs/quality/UNCLE_BOB_METRICS.md');
const strict = process.argv.includes('--strict');

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(fullPath));
    else if (['.ts', '.tsx'].includes(extname(entry.name)) && !entry.name.endsWith('.spec.ts')) files.push(fullPath);
  }
  return files;
}

function sourceLines(text) {
  return text.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*')).length;
}

function complexity(text) {
  const decisions = (text.match(/\b(if|for|while|catch|case)\b|\?|&&|\|\||\?\?/g) ?? []).length;
  return 1 + decisions;
}

function functionMetrics(text) {
  const lines = text.split(/\r?\n/);
  const starts = [];
  lines.forEach((line, index) => {
    if (/\b(?:async\s+)?function\s+\w+|\b(?:async\s+)?\w+\s*\([^)]*\)\s*\{|=>\s*\{/.test(line)) starts.push(index);
  });
  return starts.map((start) => {
    let depth = 0;
    let end = start;
    for (; end < lines.length; end += 1) {
      const line = lines[end];
      depth += (line.match(/\{/g) ?? []).length;
      depth -= (line.match(/\}/g) ?? []).length;
      if (end > start && depth <= 0) break;
    }
    const body = lines.slice(start, end + 1).join('\n');
    return { line: start + 1, size: end - start + 1, complexity: complexity(body) };
  });
}

function dependencyGraph(files) {
  const graph = new Map(files.map((file) => [file, []]));
  for (const file of files) {
    const text = texts.get(file) ?? '';
    const imports = [...text.matchAll(/(?:from|import)\s*['"](\.[^'"]+)['"]/g)].map((match) => match[1]);
    for (const imported of imports) {
      const base = resolve(dirname(file), imported);
      const target = files.find((candidate) => candidate === `${base}.ts` || candidate === `${base}.tsx` || candidate === join(base, 'index.ts'));
      if (target) graph.get(file).push(target);
    }
  }
  return graph;
}

function cycles(graph) {
  const active = new Set();
  const visited = new Set();
  const found = [];
  function visit(node, path) {
    if (active.has(node)) {
      const index = path.indexOf(node);
      found.push(path.slice(index).concat(node));
      return;
    }
    if (visited.has(node)) return;
    active.add(node);
    for (const next of graph.get(node) ?? []) visit(next, [...path, next]);
    active.delete(node);
    visited.add(node);
  }
  for (const node of graph.keys()) visit(node, [node]);
  return found;
}

async function readJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

const files = await filesUnder(sourceRoot);
const texts = new Map();
for (const file of files) texts.set(file, await readFile(file, 'utf8'));
const sizes = files.map((file) => ({ file: relative(root, file), lines: sourceLines(texts.get(file) ?? '') })).sort((a, b) => b.lines - a.lines);
const functions = files.flatMap((file) => functionMetrics(texts.get(file) ?? '').map((metric) => ({ file: relative(root, file), ...metric })));
const graph = dependencyGraph(files);
const cycleList = cycles(graph);
const coverage = await readJson(join(root, 'apps/api/coverage/coverage-summary.json'));
const mutation = await readJson(join(root, 'reports/mutation/mutation.json'));
const coverageTotals = coverage?.total ?? null;
const mutants = mutation ? Object.values(mutation.files ?? {}).flatMap((file) => file.mutants ?? []) : [];
const scoredMutants = mutants.filter((mutant) => ['Killed', 'Survived', 'Timeout', 'RuntimeError', 'NoCoverage'].includes(mutant.status));
const killedMutants = scoredMutants.filter((mutant) => mutant.status === 'Killed').length;
const mutationScore = scoredMutants.length ? Math.round((killedMutants / scoredMutants.length) * 10000) / 100 : null;
const coverageLine = coverageTotals ? `${coverageTotals.lines.pct}% lines / ${coverageTotals.branches.pct}% branches` : 'artifact missing';
const maxComplexity = Math.max(0, ...functions.map((item) => item.complexity));
const maxFunction = Math.max(0, ...functions.map((item) => item.size));
const maxFile = sizes[0]?.lines ?? 0;
const status = (ok) => ok ? '✅' : '⚠️';
const gateFailures = [];
if (!coverageTotals || Number(coverageTotals.lines.pct) < 80 || Number(coverageTotals.branches.pct) < 80) gateFailures.push('coverage');
if (mutationScore === null || Number(mutationScore) < 70) gateFailures.push('mutation');
if (cycleList.length > 0) gateFailures.push('dependencies');

const report = `## Uncle Bob Metrics Report\n\n**Target**: apps/api/src (V0 backend)\n**Language**: TypeScript\n**Agent / Environment**: WB Modular Monolith\n\n| Metric | Result | Threshold | Status | Notes |\n|---|---:|---:|:---:|---|\n| Test Coverage | ${coverageLine} | ≥ 80% lines / branches | ${status(coverageTotals && Number(coverageTotals.lines.pct) >= 80 && Number(coverageTotals.branches.pct) >= 80)} | Vitest v8 report |\n| Cyclomatic Complexity | max = ${maxComplexity} | ≤ 10 | ${status(maxComplexity <= 10)} | Approximation from decision tokens; inspect high-complexity services |\n| Module / Function Sizes | max file = ${maxFile} LOC; max function = ${maxFunction} LOC | ≤ 300 / ≤ 40 | ${status(maxFile <= 300 && maxFunction <= 40)} | Large legacy service modules remain candidates for extraction |\n| Dependency Structure | ${cycleList.length} cycle(s) | 0 cycles | ${status(cycleList.length === 0)} | Relative imports only |\n| Mutation Score | ${mutationScore === null ? 'artifact missing' : `${mutationScore}%`} | ≥ 70% | ${status(mutationScore !== null && Number(mutationScore) >= 70)} | Stryker on V0 rules |\n\n### Key Findings\n\nThe V0 boundary rules now have direct tests for password, phone, content, visibility, membership, and registration behavior. The metrics report deliberately separates hard gates from refactoring signals: coverage, mutation, and dependency cycles gate CI; large service files and high complexity produce actionable warnings rather than hiding existing technical debt.\n\n${cycleList.length ? `Detected cycles:\n\n${cycleList.map((cycle) => `- ${cycle.map((item) => relative(root, item)).join(' → ')}`).join('\\n')}\n` : 'No circular relative dependencies were detected.\n'}\n### Recommended Actions\n\n1. Keep mutation score above 70% whenever V0 rules change.\n2. Split service modules above 300 LOC when the next feature touches them.\n3. Add integration tests around database transactions and authorization as the test database harness is introduced.\n\n### Gate Result\n\n${gateFailures.length ? `❌ Failed gates: ${gateFailures.join(', ')}` : '✅ All hard quality gates passed.'}\n`;

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, report);
console.log(report);
if (strict && gateFailures.length) process.exitCode = 1;
