# 알려진 Host·provider 카탈로그

최종 상태는 항상 로컬 `probe`와 read-only 스모크 테스트로 판정한다. 아래 CLI 동작은 2026-07-19 기준이며 버전 변경 시 실제 `--help`가 우선한다.

## Host-native agent — 외부 provider가 아님

- 감지: 현재 Host가 제공하는 Agent/Task/collaboration/subagent 기능
- 역할: researcher, architect, coder, reviewer
- 연결: Host 로그인·구독을 그대로 사용하며 별도 CLI 설치가 없다.
- 핵심 규칙: `exclude_host_vendor_from_external_providers`의 영향을 받지 않는다. Codex Host는 Codex native subagent를, Claude Host는 Claude Agent를 계속 여러 개 사용할 수 있다.
- 독립성: Host와 같은 vendor이므로 다른 vendor의 교차검증 1표로 세지 않는다.

## codex-cli (OpenAI)

- adapter: `codex`; 명령: `codex`
- 감지: `codex --version`
- 설치·로그인:

```bash
npm i -g @openai/codex@latest
codex login
```

- noninteractive: `codex exec`; structured output: JSONL; resume: 지원
- model/effort: 호출별 지정 가능. 모델 ID는 확인된 값만 사용
- access: `read-only`, `workspace-write`를 sandbox로 강제 가능
- transport: CLI 기본. 기존 `.mcp.json`의 `codex mcp-server`도 호환
- same-vendor: OpenAI Host에서는 외부 후보에서 기본 제외되지만 Codex native subagent는 계속 사용 가능

## claude-code-cli (Anthropic)

- adapter: `claude-code`; 명령: `claude`
- 감지: `claude --version`
- 설치·로그인: Claude Code 공식 설치 후 `claude`에서 계정 로그인
- noninteractive: `claude -p --output-format json`; resume: session ID로 지원
- model/effort: 호출별 지정 가능. 현재 effort 어휘는 low/medium/high/xhigh/max
- access: read-only 호출은 plan mode와 Read/Grep/Glob/WebSearch/WebFetch allowlist, Write/Edit/Bash/NotebookEdit denylist를 함께 적용
- same-vendor: Anthropic Host에서는 외부 후보에서 기본 제외되지만 Claude native Agent는 계속 사용 가능

## antigravity-cli (Google)

- adapter: `antigravity`; 명령: `agy`
- 감지: `agy --version`
- 설치·로그인: Antigravity CLI 설치 후 Google 계정으로 로그인
- noninteractive: `agy --print`; model 지정 가능; 직접 effort tier 인자 없음
- resume: CLI는 `--conversation <id>`를 지원하지만 print 출력에서 session ID를 안정적으로 회수하지 못하면 runner는 새 세션+이전 맥락 폴백을 사용한다.
- output: 현재 구조화 JSON이 아닌 plain text
- access: `--sandbox`를 사용하지만 read-only를 완전히 강제하지 못한다. 리서치·리뷰는 승인된 작업 폴더에서만 실행하고 prompt-only read-only 경고를 남긴다.
- same-vendor: Google Host에서는 외부 후보에서 기본 제외되며 native subagent와는 별도다.

## 공통 확인 명령

플러그인 루트에서:

```bash
node scripts/council-cli-runner.mjs probe
node scripts/council-cli-runner.mjs route --host-vendor openai
node scripts/council-cli-runner.mjs route --host-vendor anthropic
node scripts/council-cli-runner.mjs route --host-vendor google
```

스모크 테스트는 먼저 `--dry-run`, 다음에 `role=researcher`, `access=read-only` 실제 호출 순서로 진행한다.

## 사용자 정의 MCP provider

현재 Host 세션에 호출 도구가 노출되어 있다면 다음처럼 등록할 수 있다.

```json
{
  "providers": {
    "my-provider": {
      "type": "mcp",
      "vendor": "my-vendor",
      "enabled": true,
      "write": false,
      "model_policy": "inherit",
      "model": null,
      "model_allowlist": [],
      "tools": { "call": "<도구 이름>", "reply": "<후속 도구, 없으면 생략>" },
      "arg_map": { "model": "<모델 인자명>", "effort": "<effort 인자 경로>" },
      "capabilities": {
        "per_call_model": false,
        "per_call_effort": false,
        "resume": false,
        "enforced_read_only": false
      },
      "effort_ladder": []
    }
  }
}
```

도구 스키마를 확인한 값만 `arg_map`과 capability에 기록한다. 스모크 통과 전에는 `enabled: false`, 쓰기 검증 전에는 `write: false`가 기본이다.

## 사용자 정의 CLI adapter

임의 명령 문자열을 설정에서 셸로 실행하지 않는다. `scripts/adapters/`에 다음 계약을 구현한 모듈을 추가하고 runner의 명시적 allowlist에 등록한다.

- id, vendor, command, versionArgs, capabilities
- `buildInvocation(...)`: shell 없는 args 배열과 stdin 사용 여부 반환
- `parse(...)`: `sessionId`, `result` 정규화

API 키·비밀번호를 config나 prompt에 넣지 않는다. 각 CLI의 공식 로그인 저장소를 사용한다.
