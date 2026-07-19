const EFFORT = {
  fast: "low",
  balanced: "medium",
  deep: "high",
  maximum: "xhigh",
};

export const claudeCodeAdapter = {
  id: "claude-code-cli",
  vendor: "anthropic",
  command: process.env.MODEL_COUNCIL_CLAUDE_BIN || "claude",
  versionArgs: ["--version"],
  capabilities: {
    nonInteractive: true,
    structuredOutput: true,
    resume: true,
    capturesSessionId: true,
    enforcedReadOnly: true,
    workspaceWrite: false,
    perCallModel: true,
    perCallEffort: true,
  },

  buildInvocation({ operation, sessionId, cwd, access, model, tier }) {
    if (access !== "read-only") throw new Error("model-council supports read-only research only");
    const effort = EFFORT[tier] || null;
    const args = ["-p", "--output-format", "json"];
    if (operation === "continue") args.push("--resume", sessionId);
    if (model) args.push("--model", model);
    if (effort) args.push("--effort", effort);

    args.push(
      "--permission-mode",
      "plan",
      "--tools",
      "Read,Grep,Glob,WebSearch,WebFetch",
      "--disallowedTools",
      "Write,Edit,Bash,NotebookEdit",
    );

    return {
      args,
      cwd,
      stdin: true,
      actual: {
        model: model || "default",
        effort: effort || "default",
        access,
      },
      warnings: [],
    };
  },

  async parse({ stdout }) {
    try {
      const parsed = JSON.parse(stdout);
      return {
        sessionId: parsed.session_id || parsed.sessionId || null,
        result: typeof parsed.result === "string"
          ? parsed.result.trim()
          : JSON.stringify(parsed.result ?? parsed),
      };
    } catch {
      return { sessionId: null, result: stdout.trim() };
    }
  },
};
