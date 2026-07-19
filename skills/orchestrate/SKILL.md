---
name: orchestrate
description: >-
  멀티모델 리서치 오케스트레이션을 수행한다. 사용자가 "오케스트레이트", "orchestrate", "멀티모델 리서치",
  "council", "카운슬", "교차 검증해서 조사", "Codex랑 Claude한테 시켜", "여러 모델로 리서치" 등을 요청하면 트리거된다.
  메인 모델이 리서치 계획을 수립하고, researcher-codex(Codex)와 researcher-claude-* 프로필(Claude)에게
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
                "effort_mode": "profile", "agent_template": "{role}-claude-{tier}",
                "capabilities": { "per_call_model": true, "per_call_effort": false, "profile_effort": true },
                "effort_ladder": ["low", "medium", "high", "xhigh"] },
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
  "loops": {
    "state_file": "council-state-{run}.md",
    "research": {
      "followups": { "policy": "until_criteria", "progress_required": true,
                     "max_rounds": 2, "per_track_max": 2 }
    }
  },
  "mode": "research"
}
```

**프로바이더 규칙**: 편성 후보는 `providers`에서 `enabled: true`인 것 전부다. 오케스트레이터는 먼저 난이도를 공통 `reasoning tier`(`fast`/`balanced`/`deep`/`maximum`)로 정하고, `routing.tier_map`에서 프로바이더별 effort로 해석한다. 새 프로바이더의 명시적 매핑이 없으면 `effort_ladder`를 네 구간에 균등 매핑한다. config가 없으면 위 기본값을 쓰되 첫 실행 시 "/council-setup으로 프로바이더를 설정할 수 있다"고 한 줄 알린다. 구 형식 config의 `difficulty_matrix`와 최상위 `codex`/`claude`, `claude_thinking`/`codex_effort` 키는 동일 의미로 해석하며, 구 `max_followups`는 `loops.research.followups.max_rounds`의 별칭이다.

**모델·effort 해석 규칙**:

1. 우선순위는 `인라인 요청 > 작업별 명시값 > model_policy와 model_allowlist에 따른 오케스트레이터 선택 > providers.<name>.model > inherit/default`다. `fixed`는 기본 모델을 고정하고, `inherit`는 호출 인자를 생략하며, `orchestrator`는 역할·난이도에 맞춰 허용 모델 중 고른다.
2. 모델 ID·별칭은 `model_allowlist`에 있거나 사용자가 제공했거나 현재 호스트·도구에서 확인된 값만 사용한다. 오케스트레이터가 최신 모델명을 추측해 만들지 않는다. 허용 후보가 없거나 검증할 수 없으면 `inherit` 또는 기본값으로 폴백한다.
3. effort가 대상 모델에서 지원되지 않으면 같은 프로바이더 사다리의 한 단계 낮은 값으로 폴백한다. 안전한 값이 없으면 effort 인자를 생략한다. 특정 모델 전용 effort(예: 일부 Codex의 `ultra`)와 오케스트레이션 프리셋(예: `ultracode`)을 서로 또는 다른 프로바이더 effort와 동일시하지 않는다.
4. Claude native Agent는 모델을 호출별로 지정할 수 있지만 effort 호출 인자는 없다. Claude effort는 `{role}-claude-{tier}` 프로필의 frontmatter(`low`/`medium`/`high`/`xhigh`)로 실제 설정한다. frontmatter는 세션 effort를 덮어쓰지만 `CLAUDE_CODE_EFFORT_LEVEL` 환경변수가 있으면 환경변수가 우선한다. Codex는 `config.model_reasoning_effort`로 호출별 전달한다.
5. 계획표와 최종 보고에 `requested → resolved/actual`을 구분한다. 적용할 수 없는 값을 적용했다고 주장하지 않는다.

오케스트레이터 본인도 PLAN·REVIEW·SYNTHESIZE 단계에서 깊이 검토한다. 메인 모델·effort는 플러그인이 바꾸지 않고 호스트 앱의 선택을 따른다.

2. 사용자 요청에 포함된 인라인 오버라이드가 항상 config보다 우선한다 (예: "codex effort는 medium으로", "--mode critique"). 상세 스키마는 `references/config-reference.md` 참조.
3. 활성(enabled) 프로바이더의 MCP 도구가 보이지 않으면 시작 전에 알리고 `/council-setup` 재실행을 권한다. 남은 프로바이더만으로 진행할지 묻는다.

## 상태 파일 — council-state (모든 페이즈 공통)

`loops.state_file`이 `false`가 아니면 실행 시작 시 작업 폴더에 `council-state-{날짜-주제슬러그}.md`를 생성한다. **각 페이즈 시작 시 재독하고 종료 시 갱신한다.** 파일과 세션 기억이 충돌하면 파일이 진실이며, 그 사실을 사용자에게 알린다. 기록은 채팅에 출력하지 않는다(소음 방지) — 파일에만 남긴다. 고정 헤딩:

```
# COUNCIL STATE — {run}
## RUN META            (일시 · 모드 · config 해석 requested→resolved)
## 성공 기준 (동결)     (C1, C2, … — §1 형식. DISPATCH 후 래칫: 추가·분할만 허용, 완화·삭제 금지 — 수정 시 사유 기재)
## 블라인드 사전 평결   (기준별 사전 예상 1줄 — 결과 열람 전 기록)
## 디스패치 원장        (호출 1건 = 1줄: 트랙 | 에이전트 | model | effort | 상태)
## 평결표              (기준 ID × 트랙 — rubric §1 형식)
## 루프 로그           (라운드별: 미충족 기준 수 · 조치 · 종료 사유)
## 마찰 기록           (재질의 사유 · 정체 지점 · effort 미스매치 — 향후 스킬 개선의 원료)
## 최종               (결론 요약 · 기각한 서브 결론과 사유 · 미검증 라벨 항목)
```

## 1. PLAN — 계획 수립 (오케스트레이터 본인)

리서치 계획을 작성한다:

- **목표 재정의**: 사용자 질문을 한 문장으로. 모호하면 이 단계에서만 1회 되묻는다.
- **핵심 질문 3~7개**: 답이 나오면 목표가 해결되는 하위 질문.
- **성공 기준**: 기준 ID를 붙인 형식으로 작성한다 — `C{n} | 이진 판정 가능한 문장 | 판정 방법`. 판정 방법은 기계적 확인(출처 URL 존재, 수치·비교·반론 포함 여부 등)을 우선하고, 불가피하게 정성적이면 "오케스트레이터 정성 판정"으로 표시한다(판정 시 사유 1줄 의무). 결론을 좌우하는 기준은 critical로 표시한다.
- **트랙 분해와 난이도 배정**: 핵심 질문들을 1~`research.max_tracks`개의 **리서치 트랙**(주제적으로 응집된 묶음)으로 나누고, 트랙별 난이도를 판정한다 — easy(단순 사실 확인) / medium(다출처 종합) / hard(상충 근거 판정·깊은 분석) / critical(결론이 의사결정을 좌우). `research.difficulty_tiers` → `routing.tier_map` 순서로 reasoning tier와 프로바이더별 effort를 해석한다.
- **리서처 편성**: 트랙마다 — `dual_from` 난이도 이상(기본 hard)은 **서로 다른 프로바이더 2개로 듀얼**(같은 트랙을 다른 렌즈로 교차 검증. 기본 페어는 claude+codex이며, 활성 프로바이더가 더 있으면 트랙 주제에 맞춰 선택: 예 — 기술·데이터=codex, 맥락·전략·반론=claude, 대안 시각=제3 프로바이더), 그 미만은 주제 적합성이 높은 프로바이더 **싱글**(수치·사실 확인형→codex류, 해석·전략형→claude). 같은 유형 리서처를 트랙 수만큼 여러 인스턴스 띄운다. 소형 질문은 1트랙 듀얼로 충분하다.
- **입장 배정 (stance steering)**: 결론이 갈릴 수 있는 **판단형 트랙**(예: "A로 전환해야 하나", 대안 비교)의 듀얼 편성에는 리서처별 입장을 명시 배정한다 — `찬성`(해당 방향의 가장 강한 근거 구축) / `반대`(치명적 약점·반례 탐색) / `중립`(판정 렌즈). **사실확인형 트랙에는 배정하지 않는다**(`해당없음` — 사실 질문에 입장을 강제하면 근거를 왜곡한다). 같은 프로바이더로만 편성될 때(예: Codex 부재) 입장 배정을 우선 적용해 관점 수렴을 막는다. 사용자 인라인 지시가 항상 우선. 입장은 논거 생성 장치일 뿐 결론이 아니다 — 최종 판정은 REVIEW에서 근거의 질로 한다.
- **배정표**(트랙 | 난이도 | 리서처 | 모델 | reasoning tier | requested→resolved effort | 입장)와 계획 요약을 사용자에게 보여주고 **즉시 진행**한다 (승인 대기 없음. 단, 사용자가 방향을 지적하면 반영).

## 2. DISPATCH — 병렬 분배

**모든 트랙의 모든 리서처 Agent 호출을 하나의 메시지에서 동시에 실행한다** (순차 금지. 호스트가 이 도구를 `Task`로 표시하면 해당 별칭 사용):

- claude(native): reasoning tier에 맞춰 `Agent(subagent_type: "researcher-claude-{tier}")`를 선택한다. resolved model이 `inherit`이면 model 인자를 생략하고, 명시 모델이면 `model: "<resolved model>"`을 전달한다. 프로필은 `fast=low`, `balanced=medium`, `deep=high`, `maximum=xhigh` effort를 frontmatter로 설정한다.
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
CLAUDE PROFILE: researcher-claude-{tier} ({resolved effort}) ← claude 브리프에만

## 목표
{전체 목표 한 문장 + 이 트랙의 역할}

## 핵심 질문
{이 트랙에 배정된 질문만}

## 당신의 관점
{이 리서처의 렌즈. 듀얼 트랙이면 상대가 무엇을 맡는지 한 줄로 알려줌 — 중복 최소화}
{입장 배정 시: "입장: 찬성|반대|중립 — 이 입장에서 가장 강한 논거를 만들되, 근거 없는 주장은 금지(출처 규칙 동일 적용)". 미배정 트랙은 이 줄 생략}

## 성공 기준
{이 트랙 몫의 성공 기준}

## 출력 언어
{사용자 언어}
```

브리프 작성 규칙: **codex 브리프의 핵심 질문은 트랙당 3개 이하**로 유지한다 (프록시가 질문당 1회씩 분할 호출하므로). 질문이 많으면 트랙을 더 나누거나, codex에는 수치·사실 확인형 질문을 우선 배정하고 해석형 질문은 claude 리서처에 배정한다. 브리프의 성공 기준에는 해당 트랙 몫의 기준 ID(C{n})를 그대로 사용한다.

**트랙 부분 실패 처리**: 일부 리서처만 실패(오류·무응답)하면 해당 트랙을 1회 재스폰한다. 재실패 시 그 트랙 없이 축소 진행하되, 한계를 state 파일과 최종 답변에 명시한다 (서브 전멸 예외와 구분).

## 3. REVIEW — 심사 (계획 기준)

**블라인드 사전 평결 (열람 전 필수)**: 트랙 결과를 열람하기 **전에** 기준별 자신의 사전 예상을 한 줄씩 state 파일 "블라인드 사전 평결" 섹션에 기록한다(채팅 미출력). 결과 열람 후에는 동결된 성공 기준을 완화·수정하지 않는다 — 서브 결과에 휩쓸리는 것을 막는 장치다. 사전 예상과 서브 결과가 크게 다른 지점은 우선 검증 대상으로 삼는다.

모든 트랙 결과를 받으면 `references/synthesis-rubric.md`의 루브릭으로 심사한다:

1. **평결표 작성**: 기준 ID × 트랙 판정(충족/부분/미충족 + 근거 포인터)을 state 파일에 기록한다(채팅 미출력). 서브에이전트의 자가 채점표는 사전 필터로만 쓰고, "충족" 주장도 근거 포인터를 확인해 번복할 수 있다. 듀얼 트랙은 두 리서처 간 모순도 함께 본다.
2. **모순 식별**: 두 모델의 결론이 충돌하는 지점을 명시적으로 나열한다.
3. **근거 품질**: 출처 없는 단정, 오래된 정보, 확신도 낮은 핵심 주장을 표시한다.
4. **재질의 루프**: 평결표의 미충족 기준 수가 신호다. 미충족이 있으면 해당 리서처에게 그 기준만 겨냥한 후속 질문을 보낸다 (`SendMessage`로 기존 에이전트에 이어서 — 호스트가 이어가기를 지원하지 않으면 동일 브리프 + 이전 결과 요약으로 재스폰). 라운드 종료 조건은 먼저 오는 것: ① **충족** — 미충족 critical 기준 0 ② **정체** — 직전 라운드 대비 미충족 수 미감소 ③ **캡** — `loops.research.followups.max_rounds`(기본 2, 트랙당 `per_track_max`). 라운드마다 루프 로그에 기록하고 종료 사유를 남긴다. **정체 시 에스컬레이션(P1-6)**: 같은 조건 재질의로 미충족 수가 줄지 않으면 캡을 같은 조건으로 소진하지 않고 조건을 바꾼다 — `loops.escalation.on_stall` 순서(각 스텝 1회, 루프 로그 기록): ① 같은 조건 재질의 → ② 해당 트랙 리서처를 한 단계 높은 tier 프로필로 재스폰 → ③ 타 프로바이더로 그 질문 이관(Codex 미연결 등 불가 시 다른 Claude 프로필로 대체하고 "독립성 약화" 명시) → ④ 인간 게이트(한계를 최종 답변에 명시). 캡·정체·사다리 소진으로 종료된 미충족 기준의 결론은 확신도를 강등하고 최종 답변에 "미검증" 라벨을 붙인다.

모순 해소 원칙: 다수결이 아니다. **근거의 질**(출처 신뢰도·최신성·직접성)로 판정하고, 판정 불가면 양론을 병기한다.

**기각 사유 의무화**: 리서처의 핵심 결론·반론을 채택하지 않고 기각할 때는 그 사유를 반드시 기록하고, 최종 보고의 "모델 간 불일치와 판단"에 포함한다. 사유 없는 기각 금지.

## 4. SYNTHESIZE — 통합 (오케스트레이터 본인)

최종 답변을 생성한다. 구조:

1. **결론** — 목표에 대한 직접 답변. 계획의 성공 기준을 모두 충족하도록.
2. **근거 종합** — 두 리서처의 근거를 주제별로 통합. 핵심 기여가 어느 프로바이더에서 왔는지 표시 `(Codex)` `(Claude)` `(양쪽 일치)`.
3. **모델 간 불일치와 판단** — 충돌 지점, 오케스트레이터의 판정과 이유(기각한 서브 결론과 그 사유 포함). 없으면 생략.
4. **남은 불확실성** — 확인 못 한 것, 낮은 확신도 항목.
5. **출처** — 통합 목록.

마지막에 사용 구성 한 줄: `council: {트랙 수}트랙 | {provider ×n(model, requested→actual effort)} | followups: N회({종료 사유: 충족|정체|캡})`.

## 모드 (mode)

- `research` (기본): 위 전체 플로우.
- `critique`: 사용자가 제시한 초안·계획을 두 리서처가 각자 공격(약점·반례·누락). 통합은 "치명적 문제 / 개선 제안 / 유지할 강점" 구조. 입장 배정 응용: 한 명은 `반대`(공격), 한 명은 `찬성`(스틸맨 — 초안의 가장 강한 방어 구축)으로 나누면 공격의 질이 올라간다(선택).
- `consensus`: 계획 단계 축소, 동일 질문을 두 모델에 그대로 전달, 통합은 "일치 / 불일치 / 판정"만 간결히.

세 모드 모두 상태 파일·블라인드 사전 평결·평결표를 적용한다. 재질의 루프는 `research` 모드에서만 돈다.

## 금지 사항

- 오케스트레이터가 서브 결과 없이 직접 리서치·검색으로 답을 완성하는 것 (서브 전멸 시에만 예외, 그 사실 명시).
- 서브 결과에 없는 사실을 통합 단계에서 창작하는 것.
- 두 리서처에게 완전히 동일한 관점을 주는 것 (consensus 모드 제외).
- 결과 열람 후 심사 체크리스트를 완화하는 것, 사유 없는 서브 결론 기각.
