# model-council 설계

## 1. 실행 모델

model-council은 특정 메인 모델을 고정하지 않습니다.

- **Host**: 현재 대화를 소유하는 GPT/Codex, Claude, Antigravity 또는 기타 agent. 계획, 심사, 통합을 책임집니다.
- **Host-native agent**: Host가 자체 subagent/collaboration 기능으로 만드는 worker입니다. 같은 역할을 여러 개 병렬 생성할 수 있습니다.
- **External provider**: 별도 CLI/MCP 세션으로 호출되는 Codex CLI, Claude Code CLI, Antigravity CLI 또는 사용자 정의 provider입니다.

Host-native와 External provider를 분리한 이유는 “같은 vendor의 외부 호출을 제외한다”는 규칙이 Host의 자체 subagent 기능까지 꺼버리지 않게 하기 위해서입니다.

| Host vendor | native pool | 기본 external pool |
|---|---|---|
| OpenAI | Codex native subagents | Anthropic, Google |
| Anthropic | Claude native Agents | OpenAI, Google |
| Google | 노출된 Antigravity native agents | OpenAI, Anthropic |

같은 vendor의 외부 CLI를 명시적으로 허용할 수는 있지만 독립 교차검증 표를 추가하지는 않습니다.

## 2. 구성 요소

### 리서치 `/orchestrate`

PLAN → DISPATCH → REVIEW → SYNTHESIZE를 수행합니다. 난이도가 높은 트랙은 서로 다른 vendor 둘을 우선하고, 외부 provider가 부족하면 별도 Host-native researcher로 보완합니다. 성공 기준, 블라인드 사전 평결, 기준 충족 기반 follow-up, 정체 감지와 에스컬레이션을 유지합니다.

### 개발 `/build`

DEBATE-PLAN → DECOMPOSE → IMPLEMENT → CROSS-REVIEW를 수행합니다. 계획 토론 상대는 `auto`일 때 Host와 다른 vendor를 고릅니다. 구현 writer는 겹치지 않는 파일 소유권과 worktree/사본을 사용하고, reviewer는 가능하면 구현 vendor와 다르게 배정합니다. green gate를 통과하지 못한 Critical 패키지는 자동 통합하지 않습니다.

### 설정 `/council-setup`

Host와 native agent capability를 먼저 감지하고 외부 CLI를 probe합니다. 두 pool을 분리한 상태로 쓰기 권한과 same-vendor 정책을 `orchestrator.config.json`에 병합합니다.

### 회고 `/council-retro`

누적 `council-state-*.md`에서 반복 마찰을 찾아 제안 원장에 스테이징합니다. skill 파일을 자동 수정하지 않으며 사람+git 검토를 유지합니다.

## 3. CLI adapter runtime

동봉 runner는 shell 문자열이 아닌 명시적 args 배열로 provider를 실행하고 결과를 공통 JSON으로 정규화합니다.

```bash
node scripts/council-cli-runner.mjs probe
node scripts/council-cli-runner.mjs route --host-vendor openai
node scripts/council-cli-runner.mjs run --provider claude --role researcher --cwd "$PWD" --access read-only --tier deep
node scripts/council-cli-runner.mjs continue --provider claude --session-id <id> --role reviewer --cwd "$PWD" --access read-only --tier deep
```

반환 핵심 필드:

- `status`: completed / failed / timeout
- `sessionId`: 후속 호출에 사용할 ID, 없으면 null
- `result`: provider 결과
- `actual`: 실제 model / effort / access
- `warnings`, `diagnostics`: 권한 한계, 종료 코드, stderr, 시간

현재 adapter:

| adapter | structured | auto resume | read-only 강제 | write |
|---|---:|---:|---:|---:|
| Codex CLI | 예 | 예 | 예 | 예 |
| Claude Code CLI | 예 | 예 | 예 | 예 |
| Antigravity CLI | 아니오 | 제한적 | 아니오 | 예 |

Antigravity CLI는 plain text 출력이며 print mode session ID를 안정적으로 회수하지 못하면 새 세션에 이전 맥락을 포함해 이어갑니다.

## 4. agent definitions

- `researcher-claude-*`, `coder-claude-*`, `reviewer-claude-*`: Claude Host-native 호환 프로필
- `researcher-codex`, `coder-codex`: 기존 Codex MCP 호환 경로
- `researcher-proxy`, `coder-proxy`: CLI adapter와 사용자 정의 MCP 공통 프록시

Codex 등 다른 Host는 해당 Host의 native collaboration 기능에 동일 역할 브리프를 직접 전달합니다. Claude 전용 프로필은 호환 자산이지 공통 코어가 아닙니다.

## 5. 설정과 호환

상세 스키마는 `skills/orchestrate/references/config-reference.md`가 단일 기준입니다. v0.6 이하의 `providers.claude`, `providers.codex`, `routing.tier_map`, `difficulty_matrix`, `codex_effort`, `claude_thinking`, `allow_codex_write`는 읽기 호환을 유지하고 저장 시 새 구조를 병합합니다.

## 6. 패키징

- `.claude-plugin`: 기존 Claude Code/Cowork 설치 경로
- `.codex-plugin`: Codex plugin manifest
- `skills/`: Host-neutral orchestration instructions
- `agents/`: Claude profiles와 범용 proxy
- `scripts/`: provider-neutral runner와 vendor adapter
- `.mcp.json`: 기존 Codex MCP transport 호환

별도 “공통 코어 패키지”를 만들지 않고 현재 plugin 내부에서 Host와 provider 경계를 추상화했습니다.
