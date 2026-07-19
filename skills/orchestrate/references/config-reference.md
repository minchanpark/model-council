# orchestrator.config.json 레퍼런스 (v0.7)

작업 폴더 루트에 두면 Host, Host-native agent pool, 외부 CLI/MCP provider와 편성 규칙을 바꿀 수 있다. 인라인 요청이 항상 최우선이며 `/council-setup`은 기존 키를 보존하며 이 파일을 병합한다.

## 핵심 구조

```json
{
  "schema_version": 1,
  "host": {
    "surface": "auto",
    "vendor": "auto",
    "native_agents": {
      "enabled": true,
      "max_concurrency": 4,
      "roles": ["researcher", "architect", "coder", "reviewer"],
      "allow_parallel": true,
      "allow_followup": true
    }
  },
  "providers": {
    "codex-cli": {
      "vendor": "openai",
      "type": "external",
      "adapter": "codex",
      "transports": ["mcp", "cli"],
      "enabled": true,
      "write": true,
      "model_policy": "orchestrator",
      "model": null,
      "model_allowlist": [],
      "effort_ladder": ["minimal", "low", "medium", "high", "xhigh", "max"]
    },
    "claude-code-cli": {
      "vendor": "anthropic",
      "type": "external",
      "adapter": "claude-code",
      "transports": ["cli"],
      "enabled": true,
      "write": true,
      "model_policy": "orchestrator",
      "model": null,
      "model_allowlist": [],
      "effort_ladder": ["low", "medium", "high", "xhigh", "max"]
    },
    "antigravity-cli": {
      "vendor": "google",
      "type": "external",
      "adapter": "antigravity",
      "transports": ["cli"],
      "enabled": true,
      "write": true,
      "model_policy": "orchestrator",
      "model": null,
      "model_allowlist": [],
      "effort_ladder": []
    }
  },
  "routing": {
    "default_tier": "deep",
    "exclude_host_vendor_from_external_providers": true,
    "allow_same_vendor_external_provider": false,
    "count_host_native_as_independent_vendor": false
  },
  "research": {
    "max_tracks": 4,
    "dual_from": "hard",
    "difficulty_tiers": {
      "easy": "fast", "medium": "balanced", "hard": "deep", "critical": "maximum"
    }
  },
  "build": {
    "plan": {
      "debate_provider": "auto", "model": null,
      "reasoning_tier": "maximum", "max_debate_rounds": 2
    },
    "difficulty_tiers": {
      "easy": "fast", "medium": "balanced", "hard": "deep", "critical": "maximum"
    },
    "max_fix_iterations": 3
  },
  "loops": {
    "state_file": "council-state-{run}.md",
    "research": {
      "followups": {
        "policy": "until_criteria", "progress_required": true,
        "max_rounds": 2, "per_track_max": 2
      }
    },
    "build": {
      "integration": { "gate": "green_required", "max_fix_iterations": 2 },
      "tests": { "verify_command_required": "when_available" }
    },
    "escalation": {
      "on_stall": ["retry_same", "tier_up", "switch_provider", "human_gate"],
      "max_steps": 3
    },
    "retro": {
      "enabled": true, "max_proposals_per_run": 3,
      "structural_change_min_runs": 5, "net_token_budget": 0,
      "provider_tags": true
    }
  },
  "mode": "research"
}
```

## Host와 외부 provider의 경계

`host`는 현재 대화를 소유하고 계획·심사·통합하는 메인 오케스트레이터다. `host.native_agents`는 그 Host가 자체 기능으로 만드는 worker pool이다. `providers`는 별도 CLI/MCP 프로세스로 호출되는 외부 pool이다.

이 구분 때문에 `exclude_host_vendor_from_external_providers: true`여도 Host-native agent는 꺼지지 않는다.

| 현재 Host | 기본 Host-native | 기본 외부 후보 | 기본 제외되는 외부 provider |
|---|---|---|---|
| Codex/GPT (`openai`) | Codex native subagent | Claude Code CLI, Antigravity CLI | Codex CLI |
| Claude (`anthropic`) | Claude Agent | Codex CLI, Antigravity CLI | Claude Code CLI |
| Antigravity (`google`) | 노출된 native subagent | Codex CLI, Claude Code CLI | Antigravity CLI |
| 미상 (`unknown`) | 현재 노출된 기능 | probe를 통과한 모든 외부 CLI | 없음 |

`allow_same_vendor_external_provider: true`는 같은 vendor의 외부 CLI도 명시적으로 허용한다. 그래도 독립 vendor 수는 늘지 않는다. `count_host_native_as_independent_vendor`는 기본 `false`를 유지한다.

## host 필드

| 필드 | 설명 |
|---|---|
| `surface` | `auto`, `codex`, `claude-code`, `claude-cowork`, `antigravity`, `other` |
| `vendor` | `auto`, `openai`, `anthropic`, `google`, `unknown` |
| `native_agents.enabled` | Host 자체 서브에이전트 사용 여부. 기본 true |
| `native_agents.max_concurrency` | Host 제한 안에서 동시에 사용할 native worker 상한 |
| `native_agents.roles` | native worker에게 배정 가능한 역할 |
| `allow_parallel` / `allow_followup` | Host가 해당 기능을 지원할 때만 true로 해석 |

`auto`는 현재 surface와 도구로 감지한다. 모델 이름만으로 Host vendor를 추측하지 않는다.

## provider 필드

| 필드 | 설명 |
|---|---|
| `vendor` | 독립성 계산용 vendor ID |
| `type` | `external` 또는 `mcp`. Host-native는 이 레지스트리에 넣지 않는다. |
| `adapter` | 동봉 runner adapter: `codex`, `claude-code`, `antigravity` |
| `transports` | 선호 순서와 사용 가능한 `cli`/`mcp` |
| `enabled` | probe 통과 후 편성 후보인지 |
| `write` | build의 coder 배정 허용 여부. 리서치·계획·리뷰는 항상 read-only |
| `model_policy` | `orchestrator`, `fixed`, `inherit` |
| `model` | 검증된 기본 모델. `null`이면 provider 기본값 |
| `model_allowlist` | 사용자 지정·도구 확인을 거친 모델 ID만 기입 |
| `effort_ladder` | 낮음→높음 순의 허용·폴백 어휘. 비어 있으면 effort를 상속 |

사용자 정의 MCP provider는 `tools.call`, 선택적인 `tools.reply`, `arg_map`, `capabilities`를 추가한다. 사용자 정의 CLI는 runner에 adapter 모듈을 구현한 뒤 등록해야 하며 명령 문자열을 설정에서 그대로 셸 실행하지 않는다.

## 모델과 reasoning tier

선택 우선순위는 `인라인 요청 > 작업별 값 > model_policy > provider.model > inherit/default`다. 모델 ID는 사용자 제공, allowlist, 현재 도구 확인 중 하나가 아니면 전달하지 않는다.

공통 tier는 `fast / balanced / deep / maximum`이다. CLI adapter가 provider별 실제 effort로 바꾼다. 미지원 값은 같은 provider 사다리에서 한 단계 낮추고, 안전한 값이 없으면 인자를 생략해 `inherited/default`로 보고한다. 서로 다른 provider의 최고 effort가 같은 계산량이나 품질을 뜻한다고 가정하지 않는다.

| 실행 수단 | model | effort | resume | read-only 강제 |
|---|---:|---:|---:|---:|
| Host-native | Host 기능에 따름 | Host 기능·프로필에 따름 | Host 기능에 따름 | Host 기능에 따름 |
| Codex CLI | 가능 | 가능 | 가능 | 가능 |
| Claude Code CLI | 가능 | 가능 | 가능 | 가능 |
| Antigravity CLI | 가능 | 직접 tier 제어 없음 | 가능 | 제한적(prompt+sandbox) |
| 사용자 MCP | capability/arg_map에 따름 | 동일 | reply 도구에 따름 | 도구에 따름 |

계획표와 최종 보고는 항상 `requested → resolved/actual`을 구분한다.

## research / build / loops

- `research.dual_from`: 이 난이도 이상은 서로 다른 vendor 둘을 우선해 교차검증한다.
- `build.plan.debate_provider: "auto"`: Host와 다른 vendor 중 architect/read-only/resume가 가능한 provider를 고른다. 없으면 새 Host-native architect로 대체하고 독립성 약화를 기록한다.
- `*.difficulty_tiers`: 작업 난이도를 공통 reasoning tier로 바꾼다.
- follow-up 종료 조건은 성공 기준 충족, 정체, cap 중 먼저 오는 것이다.
- build 통합 gate가 green이 아니면 미해결 Critical 패키지를 자동 통합하지 않는다.
- 에스컬레이션은 같은 조건 재시도 → tier 상향 → 다른 vendor → human gate 순서다.

## 구버전 호환

v0.6 이하 설정은 읽을 때 다음처럼 해석하고, 저장할 때 새 키를 병합하되 구 키와 알 수 없는 키를 삭제하지 않는다.

- `providers.claude.type: native` → 현재 Host가 Anthropic이면 `host.native_agents`; 다른 Host에서는 자동으로 외부 Claude Code CLI로 승격하지 말고 setup probe 후 제안한다.
- `providers.codex` → `providers.codex-cli`.
- `routing.tier_map` → adapter 기본 tier 해석의 명시 오버라이드.
- `build.plan.debate_provider: codex` → 설치된 `codex-cli`; 같은 vendor Host라 기본 제외되면 `auto`.
- `difficulty_matrix`, `codex_effort`, `claude_thinking`, `allow_codex_write`, `max_followups`는 기존 의미의 별칭으로 읽는다.

## 빠른 실행 예시

```json
{
  "routing": { "default_tier": "fast" },
  "research": {
    "max_tracks": 2,
    "dual_from": "critical",
    "difficulty_tiers": {
      "easy": "fast", "medium": "fast", "hard": "balanced", "critical": "deep"
    }
  },
  "loops": { "research": { "followups": { "max_rounds": 0 } } }
}
```
