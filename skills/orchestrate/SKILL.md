---
name: orchestrate
description: >-
  멀티모델 리서치 오케스트레이션을 수행한다. 사용자가 "오케스트레이트", "orchestrate", "멀티모델 리서치",
  "council", "카운슬", "교차 검증해서 조사", "Codex랑 Claude한테 시켜", "여러 모델로 리서치" 등을 요청하면 트리거된다.
  메인 모델이 리서치 계획을 수립하고, researcher-codex(Codex)와 researcher-claude(Claude)에게
  병렬 리서치를 분배한 뒤, 초기 계획 기준으로 심사·통합해 최종 답변을 생성한다.
---

# Model Council — 멀티모델 리서치 오케스트레이션

당신은 이 워크플로의 **오케스트레이터**다. 직접 리서치하지 않는다. 방향 수립 → 분배 → 심사 → 통합만 수행한다.

## 0. 설정 로드

1. 작업 폴더 루트에서 `orchestrator.config.json`을 찾아 읽는다. 없으면 아래 기본값을 사용한다:

```json
{
  "providers": {
    "claude": { "type": "native", "enabled": true, "write": true,
                "model_policy": "orchestrator", "model": "inherit", "model_allowlist": [],
                "capabilities": { "per_call_model": true, "per_call_effort": false },
                "effort_ladder": ["low", "medium", "high", "xhigh", "max"] },
    "codex":  { "type": "mcp", "enabled": true, "write": true, "split": true,
                "model_policy": "orchestrator", "model": null, "model_allowlist": [],
                "tools": { "call": "codex", "reply": "codex-reply" },
                "capabilities": { "per_call_model": true, "per_call_effort": true },
                "effort_ladder": ["minimal", "low", "medium", "high", "xhigh", "max"] }
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
  "max_followups": 1,
  "mode": "research"
}
```

**프로바이더 규칙**: 편성 후보는 `providers`에서 `enabled: true`인 것 전부다. 오케스트레이터는 먼저 난이도를 공통 `reasoning tier`(`fast`/`balanced`/`deep`/`maximum`)로 정하고, `routing.tier_map`에서 프로바이더별 effort로 해석한다. 새 프로바이더의 명시적 매핑이 없으면 `effort_ladder`를 네 구간에 균등 매핑한다. config가 없으면 위 기본값을 쓰되 첫 실행 시 "/council-setup으로 프로바이더를 설정할 수 있다"고 한 줄 알린다. 구 형식 config의 `difficulty_matrix`와 최상위 `codex`/`claude`, `claude_thinking`/`codex_effort` 키는 동일 의미로 해석한다.

**모델·effort 해석 규칙**:

1. 우선순위는 `인라인 요청 > 작업별 명시값 > model_policy와 model_allowlist에 따른 오케스트레이터 선택 > providers.<name>.model > inherit/default`다. `fixed`는 기본 모델을 고정하고, `inherit`는 호출 인자를 생략하며, `orchestrator`는 역할·난이도에 맞춰 허용 모델 중 고른다.
2. 모델 ID·별칭은 `model_allowlist`에 있거나 사용자가 제공했거나 현재 호스트·도구에서 확인된 값만 사용한다. 오케스트레이터가 최신 모델명을 추측해 만들지 않는다. 허용 후보가 없거나 검증할 수 없으면 `inherit` 또는 기본값으로 폴백한다.
3. effort가 대상 모델에서 지원되지 않으면 같은 프로바이더 사다리의 한 단계 낮은 값으로 폴백한다. 안전한 값이 없으면 effort 인자를 생략한다. 특정 모델 전용 effort(예: 일부 Codex의 `ultra`)와 오케스트레이션 프리셋(예: `ultracode`)을 서로 또는 다른 프로바이더 effort와 동일시하지 않는다.
4. Claude native Agent는 모델을 호출별로 지정할 수 있지만 effort 호출 인자가 없다. 따라서 `CLAUDE EFFORT INTENT`는 작업 범위를 안내하고 실제 런타임 effort는 호스트 세션·에이전트 설정을 상속한다. Codex는 `config.model_reasoning_effort`로 호출별 전달한다.
5. 계획표와 최종 보고에 `requested → resolved/actual`을 구분한다. 적용할 수 없는 값을 적용했다고 주장하지 않는다.

오케스트레이터 본인도 PLAN·REVIEW·SYNTHESIZE 단계에서 깊이 검토한다. 메인 모델·effort는 플러그인이 바꾸지 않고 호스트 앱의 선택을 따른다.

2. 사용자 요청에 포함된 인라인 오버라이드가 항상 config보다 우선한다 (예: "codex effort는 medium으로", "--mode critique"). 상세 스키마는 `references/config-reference.md` 참조.
3. 활성(enabled) 프로바이더의 MCP 도구가 보이지 않으면 시작 전에 알리고 `/council-setup` 재실행을 권한다. 남은 프로바이더만으로 진행할지 묻는다.

## 1. PLAN — 계획 수립 (오케스트레이터 본인)

리서치 계획을 작성한다:

- **목표 재정의**: 사용자 질문을 한 문장으로. 모호하면 이 단계에서만 1회 되묻는다.
- **핵심 질문 3~7개**: 답이 나오면 목표가 해결되는 하위 질문.
- **성공 기준**: 최종 답변이 반드시 포함해야 할 것 (수치·출처·비교·반론 등).
- **트랙 분해와 난이도 배정**: 핵심 질문들을 1~`research.max_tracks`개의 **리서치 트랙**(주제적으로 응집된 묶음)으로 나누고, 트랙별 난이도를 판정한다 — easy(단순 사실 확인) / medium(다출처 종합) / hard(상충 근거 판정·깊은 분석) / critical(결론이 의사결정을 좌우). `research.difficulty_tiers` → `routing.tier_map` 순서로 reasoning tier와 프로바이더별 effort를 해석한다.
- **리서처 편성**: 트랙마다 — `dual_from` 난이도 이상(기본 hard)은 **서로 다른 프로바이더 2개로 듀얼**(같은 트랙을 다른 렌즈로 교차 검증. 기본 페어는 claude+codex이며, 활성 프로바이더가 더 있으면 트랙 주제에 맞춰 선택: 예 — 기술·데이터=codex, 맥락·전략·반론=claude, 대안 시각=제3 프로바이더), 그 미만은 주제 적합성이 높은 프로바이더 **싱글**(수치·사실 확인형→codex류, 해석·전략형→claude). 같은 유형 리서처를 트랙 수만큼 여러 인스턴스 띄운다. 소형 질문은 1트랙 듀얼로 충분하다.
- **배정표**(트랙 | 난이도 | 리서처 | 모델 | reasoning tier | requested→resolved effort)와 계획 요약을 사용자에게 보여주고 **즉시 진행**한다 (승인 대기 없음. 단, 사용자가 방향을 지적하면 반영).

## 2. DISPATCH — 병렬 분배

**모든 트랙의 모든 리서처 Agent 호출을 하나의 메시지에서 동시에 실행한다** (순차 금지. 호스트가 이 도구를 `Task`로 표시하면 해당 별칭 사용):

- claude(native): `Agent(subagent_type: "researcher-claude")`. resolved model이 `inherit`이면 model 인자를 생략하고, 명시 모델이면 `model: "<resolved model>"`을 전달한다. native Agent는 호출별 effort를 받지 않는다.
- codex: `Agent(subagent_type: "researcher-codex")` — 분할 호출 최적화 내장
- 기타 MCP 프로바이더: `Agent(subagent_type: "researcher-proxy")` — 브리프 끝에 `[PROVIDER SPEC]` 블록(레지스트리 항목의 tools·arg_map·capabilities·split)을 그대로 포함시킨다

트랙별 별도 인스턴스로 스폰하며, 각 인스턴스에게 아래 브리프 템플릿을 채워 전달한다:

```
[RESEARCH BRIEF]
TRACK: {트랙 이름} ({난이도})
PROVIDER: {프로바이더명}
MODEL: {resolved model 또는 "inherit/default"}
REASONING TIER: {fast|balanced|deep|maximum}
CODEX MODEL: {model 또는 "default"}            ← codex 브리프에만
CODEX EFFORT: {resolved effort 또는 "default"} ← codex 브리프에만
EFFORT: {resolved effort 또는 "default"}       ← proxy 브리프에만
CLAUDE EFFORT INTENT: {requested effort}        ← claude 브리프에만(실제값은 inherit)

## 목표
{전체 목표 한 문장 + 이 트랙의 역할}

## 핵심 질문
{이 트랙에 배정된 질문만}

## 당신의 관점
{이 리서처의 렌즈. 듀얼 트랙이면 상대가 무엇을 맡는지 한 줄로 알려줌 — 중복 최소화}

## 성공 기준
{이 트랙 몫의 성공 기준}

## 출력 언어
{사용자 언어}
```

브리프 작성 규칙: **codex 브리프의 핵심 질문은 트랙당 3개 이하**로 유지한다 (프록시가 질문당 1회씩 분할 호출하므로). 질문이 많으면 트랙을 더 나누거나, codex에는 수치·사실 확인형 질문을 우선 배정하고 해석형 질문은 claude 리서처에 배정한다.

## 3. REVIEW — 심사 (계획 기준)

모든 트랙 결과를 받으면 `references/synthesis-rubric.md`의 루브릭으로 심사한다:

1. **커버리지**: 트랙·핵심 질문별로 결과가 답했는가? 표로 정리(내부용, 출력 안 함). 듀얼 트랙은 두 리서처 간 모순도 함께 본다.
2. **모순 식별**: 두 모델의 결론이 충돌하는 지점을 명시적으로 나열한다.
3. **근거 품질**: 출처 없는 단정, 오래된 정보, 확신도 낮은 핵심 주장을 표시한다.
4. **재질의**: 성공 기준 미달·중대 모순이 있으면 해당 리서처에게 후속 질문을 보낸다 (`SendMessage`로 기존 에이전트에 이어서). 최대 `max_followups`회. 그 이상 미달이면 한계를 최종 답변에 명시한다.

모순 해소 원칙: 다수결이 아니다. **근거의 질**(출처 신뢰도·최신성·직접성)로 판정하고, 판정 불가면 양론을 병기한다.

## 4. SYNTHESIZE — 통합 (오케스트레이터 본인)

최종 답변을 생성한다. 구조:

1. **결론** — 목표에 대한 직접 답변. 계획의 성공 기준을 모두 충족하도록.
2. **근거 종합** — 두 리서처의 근거를 주제별로 통합. 핵심 기여가 어느 프로바이더에서 왔는지 표시 `(Codex)` `(Claude)` `(양쪽 일치)`.
3. **모델 간 불일치와 판단** — 충돌 지점, 오케스트레이터의 판정과 이유. 없으면 생략.
4. **남은 불확실성** — 확인 못 한 것, 낮은 확신도 항목.
5. **출처** — 통합 목록.

마지막에 사용 구성 한 줄: `council: {트랙 수}트랙 | {provider ×n(model, requested→actual effort)} | followups: N회`.

## 모드 (mode)

- `research` (기본): 위 전체 플로우.
- `critique`: 사용자가 제시한 초안·계획을 두 리서처가 각자 공격(약점·반례·누락). 통합은 "치명적 문제 / 개선 제안 / 유지할 강점" 구조.
- `consensus`: 계획 단계 축소, 동일 질문을 두 모델에 그대로 전달, 통합은 "일치 / 불일치 / 판정"만 간결히.

## 금지 사항

- 오케스트레이터가 서브 결과 없이 직접 리서치·검색으로 답을 완성하는 것 (서브 전멸 시에만 예외, 그 사실 명시).
- 서브 결과에 없는 사실을 통합 단계에서 창작하는 것.
- 두 리서처에게 완전히 동일한 관점을 주는 것 (consensus 모드 제외).
