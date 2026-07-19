import { readFile } from "node:fs/promises";
import path from "node:path";

const EFFORT = {
  fast: "low",
  balanced: "medium",
  deep: "high",
  maximum: "xhigh",
};

function findSessionId(value) {
  if (!value || typeof value !== "object") return null;
  for (const key of ["thread_id", "threadId", "session_id", "sessionId"]) {
    if (typeof value[key] === "string" && value[key]) return value[key];
  }
  for (const nested of Object.values(value)) {
    const found = findSessionId(nested);
    if (found) return found;
  }
  return null;
}

export const codexAdapter = {
  id: "codex-cli",
  vendor: "openai",
  command: process.env.MODEL_COUNCIL_CODEX_BIN || "codex",
  versionArgs: ["--version"],
  capabilities: {
    nonInteractive: true,
    structuredOutput: true,
    resume: true,
    capturesSessionId: true,
    enforcedReadOnly: true,
    workspaceWrite: true,
    perCallModel: true,
    perCallEffort: true,
  },

  buildInvocation({ operation, sessionId, cwd, access, model, tier, tempDir }) {
    const outputPath = path.join(tempDir, "last-message.txt");
    const effort = EFFORT[tier] || null;
    const common = ["--json", "-o", outputPath];
    if (model) common.push("-m", model);
    if (effort) common.push("-c", `model_reasoning_effort=${JSON.stringify(effort)}`);
    common.push("-c", 'approval_policy="never"');

    let args;
    if (operation === "continue") {
      args = ["exec", "resume", ...common, sessionId, "-"];
    } else {
      args = [
        "exec",
        ...common,
        "--color",
        "never",
        "-C",
        cwd,
        "-s",
        access,
        "-",
      ];
    }

    return {
      args,
      cwd,
      stdin: true,
      outputPath,
      actual: { model: model || "default", effort: effort || "default", access },
      warnings: operation === "continue"
        ? ["Codex resume는 최초 세션의 cwd와 sandbox 설정을 상속한다."]
        : [],
    };
  },

  async parse({ stdout, outputPath }) {
    const events = [];
    for (const line of stdout.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line));
      } catch {
        // Codex JSONL 외의 진단 행은 원문 결과 대신 stderr에서 다룬다.
      }
    }
    let result = "";
    try {
      result = await readFile(outputPath, "utf8");
    } catch {
      const last = events.at(-1);
      result = typeof last?.message === "string" ? last.message : "";
    }
    return {
      sessionId: events.map(findSessionId).find(Boolean) || null,
      result: result.trim(),
    };
  },
};
