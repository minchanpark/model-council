# orchestrator.config.json 레퍼런스 (v0.8)

작업 폴더 루트에 이미 존재하면 read-only 리서치의 Host, Host-native
researcher, 외부 CLI/MCP provider와 편성 규칙을 읽을 수 있다. 인라인 요청이
항상 최우선이며 `/council-setup`은 기존 파일을 바꾸지 않고 이번 세션의
병합 결과만 제안한다.

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
      "roles": ["researcher"],
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
      "write": false,
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
      "write": false,
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
      "write": false,
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
      "easy": "fast",
      "medium": "balanced",
      "hard": "deep",
      "critical": "maximum"
    }
  },
  "loops": {
    "state": { "storage": "session" },
    "research": {
      "followups": {
        "policy": "until_criteria",
        "progress_required": true,
        "max_rounds": 2,
        "per_track_max": 2
      }
    },
    "escalation": {
      "on_stall": ["retry_same", "tier_up", "switch_provider", "human_gate"],
      "max_steps": 3
    },
    "retro": {
      "enabled": true,
      "max_proposals_per_run": 3,
      "structural_change_min_runs": 5,
      "net_token_budget": 0,
      "provider_tags": true
    }
  },
  "mode": "research"
}
```

## Host와 외부 provider의 경계

`host`는 현재 대화를 소유하고 계획·심사·통합하는 메인 오케스트레이터다.
`host.native_agents`는 Host가 자체 기능으로 만드는 researcher pool이고,
`providers`는 별도 CLI/MCP 프로세스로 호출되는 외부 pool이다.

`exclude_host_vendor_from_external_providers: true`여도 Host-native researcher는
꺼지지 않는다. 같은 vendor의 외부 CLI를 명시적으로 허용해도 독립 vendor
수는 늘지 않는다.

| 현재 Host | 기본 Host-native | 기본 외부 후보 | 기본 제외 외부 |
|---|---|---|---|
| Codex/GPT | Codex researcher | Claude Code, Antigravity | Codex CLI |
| Claude | Claude researcher | Codex, Antigravity | Claude Code CLI |
| Antigravity | 노출된 native researcher | Codex, Claude Code | Antigravity CLI |
| 미상 | 현재 노출된 기능 | probe 통과 CLI | 없음 |

## provider와 모델

- 모든 provider의 역할은 `researcher`, access는 `read-only`, `write`는
  항상 `false`다. v0.7 이하 설정에 `write: true`가 있어도 v0.8 runtime은
  무시하고 쓰기 요청을 거부한다.
- 모델 선택 우선순위는 `인라인 요청 > model_policy > provider.model >
  inherit/default`다.
- 모델 ID는 사용자 제공, allowlist, 현재 도구 확인 중 하나가 아니면
  전달하지 않는다.
- 공통 tier는 `fast / balanced / deep / maximum`이며 adapter가 실제 effort로
  변환한다. 미지원이면 한 단계 낮추거나 인자를 생략한다.
- Antigravity read-only는 prompt+sandbox 수준이므로 이 한계를 결과에 남긴다.

## research와 loops

- `research.dual_from` 이상 난이도는 가능하면 서로 다른 vendor 둘로 검증한다.
- follow-up은 성공 기준 충족, 정체, cap 중 먼저 오는 조건에서 끝난다.
- 에스컬레이션은 같은 조건 재시도, tier 상향, 다른 vendor, human gate 순이다.
- `council-retro`는 research state만 분석하고 스킬 파일을 직접 수정하지 않는다.
- 실행 원장은 세션 메모리에만 유지하며 저장소 state 파일을 생성하지 않는다.

## 개발 설정의 처리

v0.7 이하의 `build`, `loops.build`, coder/reviewer 역할, `write: true`,
`allow_codex_write`, `loops.state_file`은 더 이상 실행 의미가 없다. setup은
파일을 변경하지 않으며 현재 runtime은 모두 무시하고 read-only와
session state만 허용한다. 문서 기반 구현과 교차 리뷰는
`document-driven-development` 플러그인으로 이전되었다.

## 빠른 실행 예시

```json
{
  "routing": { "default_tier": "fast" },
  "research": {
    "max_tracks": 2,
    "dual_from": "critical",
    "difficulty_tiers": {
      "easy": "fast",
      "medium": "fast",
      "hard": "balanced",
      "critical": "deep"
    }
  },
  "loops": { "research": { "followups": { "max_rounds": 0 } } }
}
```
