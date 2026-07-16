# orchestrator.config.json 레퍼런스 (v0.3)

작업 폴더(프로젝트) 루트에 두면 플러그인 수정 없이 프로바이더·effort를 바꿀 수 있다. 파일이 없으면 SKILL.md의 기본값(claude+codex)이 적용된다. 인라인 요청("codex는 medium으로")이 항상 최우선. 이 파일은 직접 편집해도 되고 `/council-setup`이 관리해도 된다.

## 전체 스키마

```json
{
  "providers": {
    "claude": { "type": "native", "enabled": true, "write": true,
                "effort_ladder": ["normal", "deep", "extra", "max"] },
    "codex":  { "type": "mcp", "enabled": true, "write": true, "split": true, "model": null,
                "tools": { "call": "codex", "reply": "codex-reply" },
                "effort_ladder": ["minimal", "low", "medium", "high", "xhigh", "ultra"] },
    "gemini": { "type": "mcp", "enabled": false, "write": false,
                "tools": { "call": "<도구명>" },
                "arg_map": { "model": "model", "effort": "<effort 인자 경로>" },
                "effort_ladder": ["low", "medium", "high"] }
  },
  "research": {
    "max_tracks": 4,
    "dual_from": "hard",
    "difficulty_matrix": {
      "easy":     { "claude": "normal", "codex": "medium" },
      "medium":   { "claude": "deep",   "codex": "high" },
      "hard":     { "claude": "extra",  "codex": "xhigh" },
      "critical": { "claude": "max",    "codex": "ultra" }
    }
  },
  "build": {
    "plan":   { "debate_provider": "codex", "model": null, "effort": "ultra", "max_debate_rounds": 2 },
    "difficulty_matrix": {
      "easy":     { "claude": "normal", "codex": "medium" },
      "medium":   { "claude": "deep",   "codex": "high" },
      "hard":     { "claude": "extra",  "codex": "xhigh" },
      "critical": { "claude": "max",    "codex": "ultra" }
    },
    "max_fix_iterations": 3
  },
  "max_followups": 1,
  "mode": "research"
}
```

> **모델 정책**: Claude 서브에이전트(researcher/coder/reviewer)는 **Opus 4.8 고정** — 에이전트 정의(frontmatter)에 내장. 조절 대상은 effort(thinking)뿐. MCP 프로바이더의 모델은 각 항목의 `model`(null=해당 CLI 기본 플래그십, codex는 현재 gpt-5.6-sol). 메인 오케스트레이터의 모델은 플러그인이 제어하지 않는다 — 앱 모델 선택기에서 지정.

## providers 필드

| 필드 | 설명 |
|---|---|
| `type` | `native`(Claude 구독 서브에이전트) 또는 `mcp`(MCP 도구 호출) |
| `enabled` | 편성 후보 여부. `/council-setup`이 감지·스모크 테스트 후 기록 |
| `write` | true면 build에서 코더로 배정 가능. 리서치는 항상 읽기 전용으로 호출 |
| `split` | true면 프록시가 질문·단계를 나눠 호출 (타임아웃 대비, codex는 호출당 ~180초) |
| `model` | 프로바이더에 전달할 모델명. null=CLI 기본. 검증 없이 그대로 전달 |
| `tools.call` / `tools.reply` | 호출할 MCP 도구 이름 / 스레드 이어가기 도구(선택) |
| `arg_map` | 모델·effort를 어떤 인자로 전달할지 매핑 (codex·claude는 내장이라 불필요) |
| `effort_ladder` | 낮음→높음 순 effort 어휘. 매트릭스 값은 이 어휘를 사용 |

## research / build 필드

| 필드 | 설명 |
|---|---|
| `research.max_tracks` | 리서치 트랙 최대 수 (기본 4). 트랙마다 리서처 인스턴스 별도 스폰 |
| `research.dual_from` | 이 난이도 이상 트랙은 서로 다른 프로바이더 2개로 듀얼 교차 검증. `never`면 전 트랙 싱글 |
| `*.difficulty_matrix` | 난이도 → {프로바이더명: effort}. 열이 없는 프로바이더는 effort_ladder 균등 매핑 |
| `build.plan` | 계획 토론 상대(`debate_provider`, 기본 codex)와 그 model/effort(기본 ultra — 미지원 시 한 단계 폴백), 토론 라운드 수 |
| `build.max_fix_iterations` | 교차 리뷰 반려 시 코더당 수정 루프 상한 |
| `max_followups` | 리서처당 재질의 상한. 0이면 1회 응답으로 종료 |
| `mode` | `research` `critique` `consensus` (orchestrate 기본 모드) |

## 인라인 오버라이드 예시

- "codex effort는 medium, 팔로업 없이" → 해당 실행에서 `codex effort=medium`, `max_followups=0`
- "critique 모드로 이 IR 덱 공격해봐" → `mode: "critique"`
- "opus 생각 깊이는 normal로 빠르게" → `claude effort=normal` (모델은 Opus 4.8 고정 — 변경 불가)
- "이번엔 gemini 빼고" → 해당 실행에서 gemini 제외

## 구버전(v0.2) 호환

최상위 `codex`/`claude` 블록, 매트릭스의 `claude_thinking`/`codex_effort` 키, `build.plan.codex_model`/`codex_effort`, `allow_codex_write`를 만나면 동일 의미로 해석한다 (`allow_codex_write: false` = `providers.codex.write: false`).

## 프리셋

**기본 (최대 바로 아래 티어 — 권장)**: 위 전체 스키마의 값 그대로.

**빠른 확인용**
```json
{ "research": { "max_tracks": 2, "dual_from": "critical",
    "difficulty_matrix": { "easy": {"claude": "normal", "codex": "low"},
                           "medium": {"claude": "normal", "codex": "medium"},
                           "hard": {"claude": "deep", "codex": "high"},
                           "critical": {"claude": "extra", "codex": "xhigh"} } },
  "max_followups": 0 }
```
