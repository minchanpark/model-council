---
name: orchestrate
description: >-
  멀티모델 리서치 오케스트레이션을 수행한다. 사용자가 "오케스트레이트", "orchestrate", "멀티모델 리서치",
  "council", "카운슬", "교차 검증해서 조사", "Codex랑 Opus한테 시켜", "여러 모델로 리서치" 등을 요청하면 트리거된다.
  메인 모델이 리서치 계획을 수립하고, researcher-codex(Codex)와 researcher-opus(Claude Opus)에게
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
                "effort_ladder": ["normal", "deep", "extra", "max"] },
    "codex":  { "type": "mcp", "enabled": true, "write": true, "split": true, "model": null,
                "tools": { "call": "codex", "reply": "codex-reply" },
                "effort_ladder": ["minimal", "low", "medium", "high", "xhigh", "ultra"] }
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
  "max_followups": 1,
  "mode": "research"
}
```

**프로바이더 규칙**: 편성 후보는 `providers`에서 `enabled: true`인 것 전부다. 매트릭스의 값은 해당 프로바이더의 effort(프로바이더별 `effort_ladder` 어휘를 그대로 사용, claude는 thinking 깊이). 매트릭스에 열이 없는 프로바이더는 effort_ladder를 4구간에 균등 매핑해 쓴다. 프로바이더 추가·변경은 `/council-setup`으로 안내한다. config가 아예 없으면 위 기본값(claude+codex)을 쓰되 첫 실행 시 "/council-setup으로 프로바이더를 설정할 수 있다"고 한 줄 알린다. 구 형식 config(최상위 `codex`/`claude`, `claude_thinking`/`codex_effort` 키)를 만나면 동일 의미로 해석한다.

기본 철학: 서브 에이전트 effort는 **최대 단계 바로 아래**가 기준선 — 트랙 난이도에 따라 매트릭스로 가감한다. **Claude 서브에이전트의 모델은 Opus 4.8 고정**(에이전트 정의에 내장) — 조절 대상은 thinking(effort)뿐이며, MCP 프로바이더의 모델은 레지스트리의 `model` 값(null=해당 CLI 기본 플래그십)으로 오케스트레이터가 지정한다. 오케스트레이터 본인도 PLAN·REVIEW·SYNTHESIZE 단계에서 깊이 검토하며 사고한다 — 계획의 허점과 결과의 모순을 찾는 것이 본인의 핵심 가치다.

2. 사용자 요청에 포함된 인라인 오버라이드가 항상 config보다 우선한다 (예: "codex effort는 medium으로", "--mode critique"). 상세 스키마는 `references/config-reference.md` 참조.
3. 활성(enabled) 프로바이더의 MCP 도구가 보이지 않으면 시작 전에 알리고 `/council-setup` 재실행을 권한다. 남은 프로바이더만으로 진행할지 묻는다.

## 1. PLAN — 계획 수립 (오케스트레이터 본인)

리서치 계획을 작성한다:

- **목표 재정의**: 사용자 질문을 한 문장으로. 모호하면 이 단계에서만 1회 되묻는다.
- **핵심 질문 3~7개**: 답이 나오면 목표가 해결되는 하위 질문.
- **성공 기준**: 최종 답변이 반드시 포함해야 할 것 (수치·출처·비교·반론 등).
- **트랙 분해와 난이도 배정**: 핵심 질문들을 1~`research.max_tracks`개의 **리서치 트랙**(주제적으로 응집된 묶음)으로 나누고, 트랙별 난이도를 판정한다 — easy(단순 사실 확인) / medium(다출처 종합) / hard(상충 근거 판정·깊은 분석) / critical(결론이 의사결정을 좌우). `research.difficulty_matrix`로 트랙별 모델·effort를 배정한다.
- **리서처 편성**: 트랙마다 — `dual_from` 난이도 이상(기본 hard)은 **서로 다른 프로바이더 2개로 듀얼**(같은 트랙을 다른 렌즈로 교차 검증. 기본 페어는 claude+codex이며, 활성 프로바이더가 더 있으면 트랙 주제에 맞춰 선택: 예 — 기술·데이터=codex, 맥락·전략·반론=claude, 대안 시각=제3 프로바이더), 그 미만은 주제 적합성이 높은 프로바이더 **싱글**(수치·사실 확인형→codex류, 해석·전략형→claude). 같은 유형 리서처를 트랙 수만큼 여러 인스턴스 띄운다. 소형 질문은 1트랙 듀얼로 충분하다.
- **배정표**(트랙 | 난이도 | 리서처 | effort)와 계획 요약을 사용자에게 보여주고 **즉시 진행**한다 (승인 대기 없음. 단, 사용자가 방향을 지적하면 반영).

## 2. DISPATCH — 병렬 분배

**모든 트랙의 모든 리서처 Task를 하나의 메시지에서 동시에 실행한다** (순차 금지):

- claude(native): `Task(subagent_type: "researcher-opus")` — 모델은 Opus 4.8 고정(에이전트 정의)
- codex: `Task(subagent_type: "researcher-codex")` — 분할 호출 최적화 내장
- 기타 MCP 프로바이더: `Task(subagent_type: "researcher-proxy")` — 브리프 끝에 `[PROVIDER SPEC]` 블록(레지스트리 항목의 tools·arg_map·split)을 그대로 포함시킨다

트랙별 별도 인스턴스로 스폰하며, 각 인스턴스에게 아래 브리프 템플릿을 채워 전달한다:

```
[RESEARCH BRIEF]
TRACK: {트랙 이름} ({난이도})
PROVIDER: {프로바이더명}
CODEX MODEL: {model 또는 "default"}            ← codex 브리프에만
CODEX EFFORT: {트랙 배정 effort}               ← codex 브리프에만
EFFORT: {트랙 배정 effort}                      ← proxy 브리프에만
THINKING: {트랙 배정 thinking}                 ← claude 브리프에만

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
2. **근거 종합** — 두 리서처의 근거를 주제별로 통합. 핵심 기여가 어느 모델에서 왔는지 표시 `(Codex)` `(Opus)` `(양쪽 일치)`.
3. **모델 간 불일치와 판단** — 충돌 지점, 오케스트레이터의 판정과 이유. 없으면 생략.
4. **남은 불확실성** — 확인 못 한 것, 낮은 확신도 항목.
5. **출처** — 통합 목록.

마지막에 사용 구성 한 줄: `council: {트랙 수}트랙 | codex ×{n}({efforts}) + opus ×{m}({thinkings}) | followups: N회`.

## 모드 (mode)

- `research` (기본): 위 전체 플로우.
- `critique`: 사용자가 제시한 초안·계획을 두 리서처가 각자 공격(약점·반례·누락). 통합은 "치명적 문제 / 개선 제안 / 유지할 강점" 구조.
- `consensus`: 계획 단계 축소, 동일 질문을 두 모델에 그대로 전달, 통합은 "일치 / 불일치 / 판정"만 간결히.

## 금지 사항

- 오케스트레이터가 서브 결과 없이 직접 리서치·검색으로 답을 완성하는 것 (서브 전멸 시에만 예외, 그 사실 명시).
- 서브 결과에 없는 사실을 통합 단계에서 창작하는 것.
- 두 리서처에게 완전히 동일한 관점을 주는 것 (consensus 모드 제외).
