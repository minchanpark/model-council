# orchestrator.config.json 레퍼런스 (v0.4)

작업 폴더 루트에 두면 플러그인 자체를 수정하지 않고 프로바이더, 서브 모델, 추론 강도와 편성을 바꿀 수 있다. 파일이 없으면 각 스킬의 기본값(Claude + Codex)이 적용된다. 인라인 요청이 항상 최우선이며 `/council-setup`으로 생성·병합할 수 있다.

## 전체 스키마

```json
{
  "providers": {
    "claude": {
      "type": "native", "enabled": true, "write": true,
      "model_policy": "orchestrator", "model": "inherit", "model_allowlist": [],
      "capabilities": { "per_call_model": true, "per_call_effort": false },
      "effort_ladder": ["low", "medium", "high", "xhigh", "max"]
    },
    "codex": {
      "type": "mcp", "enabled": true, "write": true, "split": true,
      "model_policy": "orchestrator", "model": null, "model_allowlist": [],
      "tools": { "call": "codex", "reply": "codex-reply" },
      "capabilities": { "per_call_model": true, "per_call_effort": true },
      "effort_ladder": ["minimal", "low", "medium", "high", "xhigh", "max"]
    },
    "gemini": {
      "type": "mcp", "enabled": false, "write": false,
      "model_policy": "orchestrator", "model": null, "model_allowlist": [],
      "tools": { "call": "<도구명>" },
      "arg_map": { "model": "model", "effort": "<effort 인자 경로>" },
      "capabilities": { "per_call_model": true, "per_call_effort": false },
      "effort_ladder": ["low", "medium", "high"]
    }
  },
  "routing": {
    "default_tier": "deep",
    "tier_map": {
      "fast":     { "claude": "low",    "codex": "low" },
      "balanced": { "claude": "medium", "codex": "medium" },
      "deep":     { "claude": "high",   "codex": "high" },
      "maximum":  { "claude": "xhigh",  "codex": "xhigh" }
    }
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
      "debate_provider": "codex", "model": null,
      "reasoning_tier": "maximum", "max_debate_rounds": 2
    },
    "difficulty_tiers": {
      "easy": "fast", "medium": "balanced", "hard": "deep", "critical": "maximum"
    },
    "max_fix_iterations": 3
  },
  "max_followups": 1,
  "mode": "research"
}
```

## 모델 선택

`model_policy`는 서브 에이전트의 모델을 누가 결정하는지 지정한다.

| 값 | 동작 |
|---|---|
| `orchestrator` | 역할·난이도에 맞춰 `model_allowlist`에서 고른다. 후보가 없으면 `model` 또는 inherit/default를 사용한다. |
| `fixed` | `model` 값을 고정 사용한다. |
| `inherit` | 호출별 model 인자를 생략하고 호스트·CLI 기본값을 상속한다. |

`model_allowlist`에는 사용자가 지정했거나 실제 도구에서 확인한 모델 ID·별칭만 넣는다. 빈 배열은 임의의 모델명을 생성하라는 뜻이 아니라, 안전한 후보가 없으면 `model` 또는 기본값을 쓰라는 뜻이다. 인라인 모델 요청은 우선하지만 호출이 거부되면 기본값으로 1회 폴백하고 그 사실을 보고한다.

- Claude native 서브 에이전트: 기본 `model: "inherit"`. 명시 모델은 Agent 호출의 model 인자로 전달할 수 있다.
- Codex: 기본 `model: null`. null이면 Codex CLI가 고른 기본 모델을 쓴다.
- 메인 오케스트레이터: 플러그인이 제어하지 않는다. Claude 앱·Code에서 사용자가 선택한 모델을 그대로 쓴다.

## reasoning tier와 effort 해석

오케스트레이터는 먼저 공급자 중립적인 `fast / balanced / deep / maximum` 중 하나를 결정한다. 그 다음 `routing.tier_map`으로 각 프로바이더의 실제 effort 어휘를 해석한다.

해석 순서:

1. 인라인 요청
2. 작업별 `reasoning_tier` 또는 명시 effort
3. 난이도의 `difficulty_tiers`
4. `routing.default_tier`
5. 프로바이더 `effort_ladder`의 중간값

해석된 effort가 대상 모델에서 지원되지 않으면 같은 사다리의 한 단계 낮은 값으로 1회 폴백한다. 안전한 매핑이 없으면 effort 인자를 생략한다. `effort_ladder`는 허용·폴백 순서를 뜻하며, 모든 모델이 모든 값을 지원한다는 보장은 아니다.

`ultra`처럼 특정 Codex 모델에서만 가능한 값은 확인된 모델의 명시 설정으로 추가할 수 있지만 기본 공통 tier에는 넣지 않는다. Claude의 오케스트레이션 프리셋이나 다른 프로바이더의 최고 단계와 같은 의미로 간주하지 않는다.

### 실제 제어 가능 범위

| 프로바이더 | 호출별 model | 호출별 effort | 보고 방식 |
|---|---:|---:|---|
| Claude native Agent | 가능 | 불가 | model은 resolved 값, effort는 `requested → inherited`로 표시 |
| Codex MCP | 가능 | 가능 | model·effort 모두 `requested → actual`로 표시 |
| 기타 MCP | `capabilities`·`arg_map`에 따름 | `capabilities`·`arg_map`에 따름 | 미지원 값은 `default/inherited`로 표시 |

Claude native Agent는 호출별 effort 인자를 제공하지 않는다. 따라서 `CLAUDE EFFORT INTENT`는 작업의 검토 범위를 안내할 뿐이며 실제 런타임 effort는 호스트 세션·에이전트 설정을 상속한다. 완전한 호출별 제어가 필요하면 Agent SDK 기반 어댑터가 별도로 필요하다.

## providers 필드

| 필드 | 설명 |
|---|---|
| `type` | `native`(Claude 서브 에이전트) 또는 `mcp` |
| `enabled` | 편성 후보 여부 |
| `write` | true면 build 코더 배정 가능. 리서치는 항상 읽기 전용 |
| `split` | 질문·구현 단계를 나눠 호출할지 여부 |
| `model_policy` | `orchestrator`, `fixed`, `inherit` |
| `model` | 기본 모델. Claude의 `inherit`, MCP의 null은 호출 인자 생략 |
| `model_allowlist` | 오케스트레이터가 고를 수 있는 검증된 모델 후보 |
| `capabilities.per_call_model` | 호출 도구가 model 인자를 받을 수 있는지 |
| `capabilities.per_call_effort` | 호출 도구가 effort 인자를 받을 수 있는지 |
| `tools.call` / `tools.reply` | MCP 호출 도구와 스레드 이어가기 도구 |
| `arg_map` | 모델·effort를 전달할 프로바이더별 인자 경로 |
| `effort_ladder` | 낮음→높음 순의 허용·폴백 어휘 |

## research / build 필드

| 필드 | 설명 |
|---|---|
| `research.max_tracks` | 리서치 트랙 최대 수 |
| `research.dual_from` | 이 난이도 이상은 서로 다른 프로바이더 둘로 교차 검증. `never`면 전부 싱글 |
| `*.difficulty_tiers` | 난이도 → 공통 reasoning tier |
| `build.plan` | 계획 토론 상대, 모델, reasoning tier, 최대 토론 라운드 |
| `build.max_fix_iterations` | 교차 리뷰 반려 시 수정 루프 상한 |
| `max_followups` | 리서처당 재질의 상한 |
| `mode` | `research`, `critique`, `consensus` |

## 인라인 오버라이드 예시

- "Codex는 기본 모델, reasoning tier는 balanced" → model 인자 생략, tier를 Codex effort로 해석
- "Claude 서브 모델은 sonnet으로" → 확인 가능한 별칭이면 native Agent 호출에 전달
- "이번 계획 토론만 Codex xhigh" → build plan의 resolved effort만 xhigh
- "이번엔 Gemini 빼고" → 해당 실행에서 Gemini 제외

## 구버전 호환

v0.3의 `difficulty_matrix`는 프로바이더별 effort의 명시 오버라이드로 해석한다. 최상위 `codex`/`claude` 블록, `claude_thinking`/`codex_effort`, `build.plan.codex_model`/`codex_effort`, `allow_codex_write`도 동일 의미로 읽는다. 저장할 때는 기존 키를 임의 삭제하지 말고 v0.4 구조를 병합한다.

## 빠른 확인 프리셋

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
  "max_followups": 0
}
```
