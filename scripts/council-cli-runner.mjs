#!/usr/bin/env node

import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { codexAdapter } from "./adapters/codex.mjs";
import { claudeCodeAdapter } from "./adapters/claude-code.mjs";
import { antigravityAdapter } from "./adapters/antigravity.mjs";

const adapters = new Map([
  [codexAdapter.id, codexAdapter],
  [claudeCodeAdapter.id, claudeCodeAdapter],
  [antigravityAdapter.id, antigravityAdapter],
  ["codex", codexAdapter],
  ["claude", claudeCodeAdapter],
  ["antigravity", antigravityAdapter],
  ["agy", antigravityAdapter],
]);

const ROLES = new Set(["researcher", "architect", "coder", "reviewer"]);
const ACCESS = new Set(["read-only", "workspace-write"]);
const TIERS = new Set(["fast", "balanced", "deep", "maximum"]);
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      parsed._.push(token);
      continue;
    }
    const key = token.slice(2);
    if (["dry-run", "help", "allow-same-vendor"].includes(key)) {
      parsed[key] = true;
      continue;
    }
    if (i + 1 >= argv.length || argv[i + 1].startsWith("--")) {
      throw new Error(`--${key} 값이 필요하다.`);
    }
    parsed[key] = argv[i + 1];
    i += 1;
  }
  return parsed;
}

function bounded(text) {
  if (Buffer.byteLength(text) <= MAX_OUTPUT_BYTES) return text;
  return `${text.slice(0, MAX_OUTPUT_BYTES)}\n[model-council: output truncated]`;
}

function runProcess(command, args, { cwd, input = "", timeoutMs = 15_000 } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      if (Buffer.byteLength(stdout) < MAX_OUTPUT_BYTES) stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      if (Buffer.byteLength(stderr) < MAX_OUTPUT_BYTES) stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        exitCode: null,
        signal: null,
        stdout: bounded(stdout),
        stderr: bounded(`${stderr}${error.message}`),
        timedOut,
        durationMs: Date.now() - started,
      });
    });
    child.on("close", (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        exitCode,
        signal,
        stdout: bounded(stdout),
        stderr: bounded(stderr),
        timedOut,
        durationMs: Date.now() - started,
      });
    });

    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

function usage() {
  return `model-council CLI provider runner

Usage:
  node scripts/council-cli-runner.mjs probe [--provider all|codex|claude|antigravity]
  node scripts/council-cli-runner.mjs route --host-vendor <openai|anthropic|google|unknown> [--allow-same-vendor]
  node scripts/council-cli-runner.mjs run --provider <id> --role <role> --cwd <dir> [options]
  node scripts/council-cli-runner.mjs continue --provider <id> --session-id <id> --role <role> --cwd <dir> [options]

Options:
  --access read-only|workspace-write
  --tier fast|balanced|deep|maximum
  --model <verified-model-id>
  --prompt-file <path>      Otherwise read the prompt from stdin
  --timeout-seconds <30..3600>
  --dry-run                 Build and validate the invocation without starting the provider
`;
}

function getAdapter(id) {
  const adapter = adapters.get(id);
  if (!adapter) throw new Error(`지원하지 않는 provider: ${id}`);
  return adapter;
}

async function readPrompt(args) {
  if (args["prompt-file"]) return readFile(path.resolve(args["prompt-file"]), "utf8");
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function roleEnvelope(role, access, prompt) {
  const constraint = access === "read-only"
    ? "파일을 수정하지 말고 읽기·분석·검증만 수행한다."
    : "명시된 작업 범위와 소유 파일만 수정하고 검증 결과를 보고한다.";
  return `[MODEL COUNCIL TASK]\nROLE: ${role}\nACCESS: ${access}\n${constraint}\n\n${prompt.trim()}\n\n[RETURN]\n결론/변경 요약, 근거 또는 변경 파일, 검증 결과, 미해결 항목을 명확히 구분해 반환한다.`;
}

async function probeOne(adapter) {
  const result = await runProcess(adapter.command, adapter.versionArgs, { timeoutMs: 10_000 });
  return {
    provider: adapter.id,
    vendor: adapter.vendor,
    command: adapter.command,
    installed: result.exitCode === 0,
    version: result.exitCode === 0 ? (result.stdout || result.stderr).trim() : null,
    capabilities: adapter.capabilities,
    error: result.exitCode === 0 ? null : result.stderr.trim() || "command unavailable",
  };
}

async function main() {
  const [operation, ...rest] = process.argv.slice(2);
  if (operation === "--help" || operation === "-h") {
    process.stdout.write(usage());
    return;
  }
  const args = parseArgs(rest);
  if (!operation || args.help) {
    process.stdout.write(usage());
    return;
  }

  if (operation === "probe") {
    const requested = args.provider || "all";
    const targets = requested === "all"
      ? [codexAdapter, claudeCodeAdapter, antigravityAdapter]
      : [getAdapter(requested)];
    const results = [];
    for (const adapter of targets) results.push(await probeOne(adapter));
    process.stdout.write(`${JSON.stringify({ schemaVersion: 1, providers: results }, null, 2)}\n`);
    return;
  }

  if (operation === "route") {
    const hostVendor = args["host-vendor"] || "unknown";
    if (!["openai", "anthropic", "google", "unknown"].includes(hostVendor)) {
      throw new Error(`지원하지 않는 host vendor: ${hostVendor}`);
    }
    const allowSameVendor = Boolean(args["allow-same-vendor"]);
    const results = [];
    for (const adapter of [codexAdapter, claudeCodeAdapter, antigravityAdapter]) {
      const probed = await probeOne(adapter);
      const sameVendor = hostVendor !== "unknown" && adapter.vendor === hostVendor;
      const eligible = probed.installed && (allowSameVendor || !sameVendor);
      results.push({
        ...probed,
        sameVendorAsHost: sameVendor,
        eligible,
        reason: !probed.installed
          ? "command-unavailable"
          : sameVendor && !allowSameVendor
            ? "same-vendor-external-excluded"
            : "eligible",
      });
    }
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      host: {
        vendor: hostVendor,
        nativeAgents: { enabled: true, affectedByExternalVendorExclusion: false },
      },
      routing: {
        allowSameVendorExternal: allowSameVendor,
        providers: results,
      },
    }, null, 2)}\n`);
    return;
  }

  if (!["run", "continue"].includes(operation)) throw new Error(`지원하지 않는 동작: ${operation}`);
  const adapter = getAdapter(args.provider);
  const role = args.role || "researcher";
  const access = args.access || "read-only";
  const tier = args.tier || "deep";
  if (!ROLES.has(role)) throw new Error(`지원하지 않는 역할: ${role}`);
  if (!ACCESS.has(access)) throw new Error(`지원하지 않는 access: ${access}`);
  if (!TIERS.has(tier)) throw new Error(`지원하지 않는 tier: ${tier}`);
  if (operation === "continue" && !args["session-id"]) throw new Error("continue에는 --session-id가 필요하다.");

  const cwd = path.resolve(args.cwd || process.cwd());
  const info = await stat(cwd);
  if (!info.isDirectory()) throw new Error(`cwd가 디렉터리가 아니다: ${cwd}`);
  const requestedTimeout = Number(args["timeout-seconds"] || 600);
  if (!Number.isFinite(requestedTimeout) || requestedTimeout <= 0) {
    throw new Error("--timeout-seconds는 양수여야 한다.");
  }
  const timeoutSeconds = Math.max(30, Math.min(3600, requestedTimeout));
  const rawPrompt = await readPrompt(args);
  if (!rawPrompt.trim()) throw new Error("prompt가 비어 있다.");
  const prompt = roleEnvelope(role, access, rawPrompt);

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "model-council-"));
  try {
    const invocation = adapter.buildInvocation({
      operation,
      sessionId: args["session-id"] || null,
      cwd,
      access,
      model: args.model || null,
      tier,
      timeoutSeconds,
      prompt,
      tempDir,
    });

    if (args["dry-run"]) {
      const safeArgs = invocation.args.map((value) => value === prompt ? "<prompt>" : value);
      process.stdout.write(`${JSON.stringify({
        schemaVersion: 1,
        dryRun: true,
        provider: adapter.id,
        vendor: adapter.vendor,
        command: adapter.command,
        args: safeArgs,
        cwd: invocation.cwd,
        actual: invocation.actual,
        warnings: invocation.warnings,
      }, null, 2)}\n`);
      return;
    }

    const processResult = await runProcess(adapter.command, invocation.args, {
      cwd: invocation.cwd,
      input: invocation.stdin ? prompt : "",
      timeoutMs: timeoutSeconds * 1000,
    });
    const parsed = await adapter.parse({
      stdout: processResult.stdout,
      stderr: processResult.stderr,
      outputPath: invocation.outputPath,
    });
    const status = processResult.timedOut
      ? "timeout"
      : processResult.exitCode === 0 && parsed.result
        ? "completed"
        : "failed";
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      provider: adapter.id,
      vendor: adapter.vendor,
      operation,
      role,
      status,
      sessionId: parsed.sessionId,
      result: parsed.result,
      actual: invocation.actual,
      warnings: invocation.warnings,
      diagnostics: {
        exitCode: processResult.exitCode,
        signal: processResult.signal,
        timedOut: processResult.timedOut,
        durationMs: processResult.durationMs,
        stderr: processResult.stderr.trim(),
      },
    }, null, 2)}\n`);
    if (status !== "completed") process.exitCode = 1;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stdout.write(`${JSON.stringify({ schemaVersion: 1, status: "failed", error: error.message }, null, 2)}\n`);
  process.exitCode = 1;
});
