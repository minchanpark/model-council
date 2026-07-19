---
name: orchestrate
description: >-
  멀티모델 리서치 오케스트레이션을 수행한다. 사용자가 "오케스트레이트", "orchestrate", "멀티모델 리서치",
  "council", "카운슬", "교차 검증해서 조사", "Codex랑 Claude한테 시켜", "여러 모델로 리서치" 등을 요청하면 트리거된다.
  현재 Host가 리서치 계획을 수립하고 Host-native 서브에이전트와 Codex·Claude Code·Antigravity 등
  외부 CLI provider에 병렬 리서치를 분배한 뒤, 초기 계획 기준으로 심사·통합해 최종 답변을 생성한다.
---

# Model Council — 멀티모델 리서치 오케스트레이션

당신은 이 워크플로의 **오케스트레이터**다. 직접 리서치하지 않는다. 방향 수립 → 분배 → 심사 → 통합만 수행한다.

## 0. 설정 로드

1. 작업 폴더 루트에서 `orchestrator.config.json`을 찾아 읽는다. 없으면 아래 기본값을 사용한다:

```json
{
  "schema_version": 1,
  "host": {
    "surface": "auto", "vendor": "auto",
    "native_agents": { "enabled": true, "max_concurrency": 4,
                       "roles": ["researcher", "architect", "coder", "reviewer"],
                       "allow_parallel": true, "allow_followup": true }
  },
  "providers": {
    "codex-cli": { "vendor": "openai", "type": "external", "adapter": "codex",
                   "transports": ["mcp", "cli"], "enabled": true, "write": true,
                   "model_policy": "orchestrator", "model": null, "model_allowlist": [],
                   "effort_ladder": ["minimal", "low", "medium", "high", "xhigh", "max"] },
    "claude-code-cli": { "vendor": "anthropic", "type": "external", "adapter": "claude-code",
                         "transports": ["cli"], "enabled": true, "write": true,
                         "model_policy": "orchestrator", "model": null, "model_allowlist": [],
                         "effort_ladder": ["low", "medium", "high", "xhigh", "max"] },
    "antigravity-cli": { "vendor": "google", "type": "external", "adapter": "antigravity",
                         "transports": ["cli"], "enabled": true, "write": true,
                         "model_policy": "orchestrator", "model": null, "model_allowlist": [],
                         "effort_ladder": [] }
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

**Host·프로바이더 규칙**: `references/provider-runtime.md`를 읽고 적용한다. Host-native 서브에이전트 풀과 외부 CLI/MCP provider 풀을 분리한다. Host와 같은 vendor의 외부 provider를 제외하더라도 Host-native 서브에이전트 생성은 계속 허용한다. 외부 편성 후보는 `providers`에서 `enabled: true`이고 probe가 통과한 항목이며, 서로 다른 vendor를 독립 교차검증 단위로 센다. config가 없으면 위 기본값을 쓰되 첫 실행 시 "/council-setup으로 Host와 CLI provider를 설정할 수 있다"고 한 줄 알린다.

**모델·effort 해석 규칙**:

1. 우선순위는 `인라인 요청 > 작업별 명시값 > model_policy와 model_allowlist에 따른 오케스트레이터 선택 > providers.<name>.model > inherit/default`다. `fixed`는 기본 모델을 고정하고, `inherit`는 호출 인자를 생략하며, `orchestrator`는 역할·난이도에 맞춰 허용 모델 중 고른다.
2. 모델 ID·별칭은 `model_allowlist`에 있거나 사용자가 제공했거나 현재 호스트·도구에서 확인된 값만 사용한다. 오케스트레이터가 최신 모델명을 추측해 만들지 않는다. 허용 후보가 없거나 검증할 수 없으면 `inherit` 또는 기본값으로 폴백한다.
3. effort가 대상 모델에서 지원되지 않으면 같은 프로바이더 사다리의 한 단계 낮은 값으로 폴백한다. 안전한 값이 없으면 effort 인자를 생략한다. 특정 모델 전용 effort(예: 일부 Codex의 `ultra`)와 오케스트레이션 프리셋(예: `ultracode`)을 서로 또는 다른 프로바이더 effort와 동일시하지 않는다.
4. Host-native effort는 현재 Host가 제공하는 제어만 사용한다. Claude Host에서는 기존 `{role}-claude-{tier}` 프로필을 사용할 수 있고, Codex Host에서는 native subagent 설정을 사용한다. 외부 CLI는 runner adapter가 tier를 실제 effort로 해석하며 미지원 값은 `inherited/default`로 보고한다.
5. 계획표와 최종 보고에 `requested → resolved/actual`을 구분한다. 적용할 수 없는 값을 적용했다고 주장하지 않는다.

오케스트레이터 본인도 PLAN·REVIEW·SYNTHESIZE 단계에서 깊이 검토한다. 메인 모델·effort는 플러그인이 바꾸지 않고 호스트 앱의 선택을 따른다.

2. 사용자 요청에 포함된 인라인 오버라이드가 항상 config보다 우선한다 (예: "codex effort는 medium으로", "--mode critique"). 상세 스키마는 `references/config-reference.md` 참조.
3. 활성 provider의 CLI/MCP가 probe에 실패하면 `/council-setup` 재실행을 권하고, 성공한 외부 provider와 Host-native 풀로 축소 진행한다. 외부 provider가 전멸했으면 독립성 약화를 먼저 알린다.

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
- **트랙 분해와 난이도 배정**: 핵심 질문들을 1~`research.max_tracks`개의 **리서치 트랙**으로 나누고 난이도를 판정한다 — easy / medium / hard / critical. `research.difficulty_tiers`로 reasoning tier를 정한 뒤 Host 또는 provider adapter가 실제 effort로 해석한다.
- **리서처 편성**: 트랙마다 — `dual_from` 난이도 이상(기본 hard)은 가능하면 **서로 다른 vendor 2개로 듀얼**한다. 외부 provider 선택 시 Host와 같은 vendor는 기본 제외한다. 외부 vendor가 부족하면 Host-native researcher를 하나 이상 생성해 보완하되 `독립성 약화`를 기록한다. 동일 역할의 Host-native 인스턴스는 트랙 수만큼 병렬 생성할 수 있지만 독립 vendor 수를 늘리지는 않는다.
- **입장 배정 (stance steering)**: 결론이 갈릴 수 있는 판단형 듀얼 트랙에는 `찬성` / `반대` / `중립`을 명시 배정한다. 사실확인형에는 배정하지 않는다. 같은 vendor로만 편성될 때 입장 배정을 우선 적용해 관점 수렴을 막는다. 입장은 논거 생성 장치일 뿐 결론이 아니며 최종 판정은 REVIEW에서 근거의 질로 한다.
- **배정표**(트랙 | 난이도 | 리서처 | 모델 | reasoning tier | requested→resolved effort | 입장)와 계획 요약을 사용자에게 보여주고 **즉시 진행**한다 (승인 대기 없음. 단, 사용자가 방향을 지적하면 반영).

## 2. DISPATCH — 병렬 분배

독립 트랙은 현재 Host가 지원하는 병렬 기능으로 동시에 실행한다. Host-native와 외부 provider 호출을 한 편성에 섞을 수 있다.

- **Claude Host-native**: 기존 `researcher-claude-{tier}` Agent 프로필을 사용한다.
- **Codex/기타 Host-native**: 현재 Host의 native collaboration/subagent 기능으로 `researcher` 역할과 브리프를 전달한다.
- **외부 CLI**: `references/provider-runtime.md`의 runner를 `role=researcher`, `access=read-only`로 호출한다. 기존 Codex MCP transport가 더 안정적이면 `researcher-codex` 호환 경로를 사용할 수 있다.
- **기타 MCP**: `researcher-proxy`에 PROVIDER SPEC을 전달한다.

트랙별 별도 인스턴스로 스폰하며, 각 인스턴스에게 아래 브리프 템플릿을 채워 전달한다:

```
[RESEARCH BRIEF]
TRACK: {트랙 이름} ({난이도})
PROVIDER: {프로바이더명}
MODEL: {resolved model 또는 "inherit/default"}
REASONING TIER: {fast|balanced|deep|maximum}
TRANSPORT: {host-native|cli|mcp}
EFFORT: {resolved effort 또는 "default/inherited"}
HOST/VENDOR: {host surface/vendor} → {provider vendor}

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

브리프 작성 규칙: 분할 실행 provider의 핵심 질문은 트랙당 3개 이하로 유지한다. 질문이 많으면 트랙을 더 나눈다. 성공 기준에는 해당 트랙 몫의 기준 ID(C{n})를 그대로 사용한다.

**트랙 부분 실패 처리**: 일부 리서처만 실패(오류·무응답)하면 해당 트랙을 1회 재스폰한다. 재실패 시 그 트랙 없이 축소 진행하되, 한계를 state 파일과 최종 답변에 명시한다 (서브 전멸 예외와 구분).

## 3. REVIEW — 심사 (계획 기준)

**블라인드 사전 평결 (열람 전 필수)**: 트랙 결과를 열람하기 **전에** 기준별 자신의 사전 예상을 한 줄씩 state 파일 "블라인드 사전 평결" 섹션에 기록한다(채팅 미출력). 결과 열람 후에는 동결된 성공 기준을 완화·수정하지 않는다 — 서브 결과에 휩쓸리는 것을 막는 장치다. 사전 예상과 서브 결과가 크게 다른 지점은 우선 검증 대상으로 삼는다.

모든 트랙 결과를 받으면 `references/synthesis-rubric.md`의 루브릭으로 심사한다:

1. **평결표 작성**: 기준 ID × 트랙 판정(충족/부분/미충족 + 근거 포인터)을 state 파일에 기록한다(채팅 미출력). 서브에이전트의 자가 채점표는 사전 필터로만 쓰고, "충족" 주장도 근거 포인터를 확인해 번복할 수 있다. 듀얼 트랙은 두 리서처 간 모순도 함께 본다.
2. **모순 식별**: 두 모델의 결론이 충돌하는 지점을 명시적으로 나열한다.
3. **근거 품질**: 출처 없는 단정, 오래된 정보, 확신도 낮은 핵심 주장을 표시한다.
4. **재질의 루프**: 미충족 기준이 있으면 그 기준만 겨냥해 후속 질문을 보낸다. Host-native는 현재 Host의 follow-up 기능을, 외부 CLI는 runner `continue`와 `sessionId`를 사용한다. 이어가기가 불가능하면 동일 브리프 + 이전 결과 요약으로 새 세션을 실행한다. 종료 조건은 충족 / 정체 / `loops.research.followups.max_rounds` 캡 중 먼저 오는 것이다. 정체 시 같은 조건 재시도 → tier 상향 → 다른 vendor provider 이관 → 인간 게이트 순으로 에스컬레이션한다. 다른 vendor가 없어 Host-native로 대체하면 `독립성 약화`를 기록한다. 미충족 결론은 확신도를 강등하고 `미검증` 라벨을 붙인다.

모순 해소 원칙: 다수결이 아니다. **근거의 질**(출처 신뢰도·최신성·직접성)로 판정하고, 판정 불가면 양론을 병기한다.

**기각 사유 의무화**: 리서처의 핵심 결론·반론을 채택하지 않고 기각할 때는 그 사유를 반드시 기록하고, 최종 보고의 "모델 간 불일치와 판단"에 포함한다. 사유 없는 기각 금지.

## 4. SYNTHESIZE — 통합 (오케스트레이터 본인)

최종 답변을 생성한다. 구조:

1. **결론** — 목표에 대한 직접 답변. 계획의 성공 기준을 모두 충족하도록.
2. **근거 종합** — 리서처의 근거를 주제별로 통합. 핵심 기여를 provider 이름과 vendor로 표시하고, 서로 다른 vendor의 일치와 동일 vendor 내부 일치를 구분한다.
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
