export const antigravityAdapter = {
  id: "antigravity-cli",
  vendor: "google",
  command: process.env.MODEL_COUNCIL_ANTIGRAVITY_BIN || "agy",
  versionArgs: ["--version"],
  capabilities: {
    nonInteractive: true,
    structuredOutput: false,
    resume: true,
    capturesSessionId: false,
    enforcedReadOnly: false,
    workspaceWrite: true,
    perCallModel: true,
    perCallEffort: false,
  },

  buildInvocation({ operation, sessionId, cwd, access, model, timeoutSeconds, prompt }) {
    const args = [];
    if (operation === "continue") args.push("--conversation", sessionId);
    if (model) args.push("--model", model);
    args.push("--sandbox", "--print-timeout", `${timeoutSeconds}s`, "--print", prompt);

    const warnings = [
      "Antigravity print mode는 현재 구조화 JSON 출력을 제공하지 않아 텍스트 결과를 정규화한다.",
    ];
    if (access === "read-only") {
      warnings.push(
        "Antigravity CLI의 read-only는 프롬프트 규율이며 파일 쓰기를 기술적으로 완전히 차단하지 못한다.",
      );
    }

    return {
      args,
      cwd,
      stdin: false,
      actual: {
        model: model || "default",
        effort: "inherited",
        access: access === "read-only" ? "prompt-only-read-only" : "workspace-write",
      },
      warnings,
    };
  },

  async parse({ stdout }) {
    return { sessionId: null, result: stdout.trim() };
  },
};
