#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.dirname(scriptDir);
const runner = path.join(scriptDir, "council-cli-runner.mjs");

function invoke(args, input = "") {
  const output = execFileSync(process.execPath, [runner, ...args], {
    cwd: pluginRoot,
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "inherit"],
  });
  return JSON.parse(output);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const vendors = ["openai", "anthropic", "google"];
const expectedSameVendor = {
  openai: "codex-cli",
  anthropic: "claude-code-cli",
  google: "antigravity-cli",
};

const routeResults = [];
for (const vendor of vendors) {
  const result = invoke(["route", "--host-vendor", vendor]);
  assert(result.host.nativeAgents.enabled, `${vendor}: Host-native agents가 비활성화됨`);
  assert(
    result.host.nativeAgents.affectedByExternalVendorExclusion === false,
    `${vendor}: external vendor 제외가 Host-native에 영향을 줌`,
  );
  const sameVendor = result.routing.providers.find(
    (provider) => provider.provider === expectedSameVendor[vendor],
  );
  assert(sameVendor, `${vendor}: same-vendor provider를 찾지 못함`);
  if (sameVendor.installed) {
    assert(!sameVendor.eligible, `${vendor}: same-vendor external이 기본 포함됨`);
    assert(
      sameVendor.reason === "same-vendor-external-excluded",
      `${vendor}: same-vendor 제외 사유가 잘못됨`,
    );

    const allowed = invoke(["route", "--host-vendor", vendor, "--allow-same-vendor"]);
    const allowedSameVendor = allowed.routing.providers.find(
      (provider) => provider.provider === expectedSameVendor[vendor],
    );
    assert(allowedSameVendor.eligible, `${vendor}: same-vendor 명시 허용이 적용되지 않음`);
  }
  routeResults.push({ vendor, nativeAgents: true, excludedExternal: sameVendor.provider });
}

const dryRuns = [];
for (const provider of ["codex", "claude", "antigravity"]) {
  const result = invoke(
    [
      "run",
      "--provider",
      provider,
      "--role",
      "researcher",
      "--cwd",
      pluginRoot,
      "--access",
      "read-only",
      "--tier",
      "deep",
      "--dry-run",
    ],
    "Self-test prompt",
  );
  assert(result.dryRun === true, `${provider}: dry-run이 아님`);
  assert(result.actual.access !== "workspace-write", `${provider}: read-only dry-run이 write로 해석됨`);
  dryRuns.push({ provider: result.provider, access: result.actual.access });
}

process.stdout.write(`${JSON.stringify({
  status: "passed",
  routes: routeResults,
  dryRuns,
}, null, 2)}\n`);
