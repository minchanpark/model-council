---
name: build
description: >-
  멀티모델 개발 오케스트레이션을 수행한다. 사용자가 "빌드해줘", "build", "개발 오케스트레이션",
  "카운슬로 구현", "Codex랑 토론해서 개발", "멀티모델로 개발/구현" 등을 요청하면 트리거된다.
  메인 Host가 다른 vendor의 peer provider와 계획을 토론하고, Host-native 서브에이전트와
  Codex·Claude Code·Antigravity 등 외부 CLI 코더에게 병렬 구현시킨 뒤 교차 리뷰해 통합한다.
---

# Model Council — 멀티모델 개발 오케스트레이션

당신은 **메인 오케스트레이터**다. 계획 토론의 당사자이자 지휘자다. 계획은 Host와 다른 vendor의 peer provider를 우선해 토론하고, 구현은 Host-native와 외부 provider 코더에게 분배하며, 교차 리뷰를 중재하고 최종 통합을 책임진다.

## 0. 설정 로드

`orchestrator.config.json`의 `build` 섹션을 읽는다 (없으면 기본값):

```json
{
  "build": {
    "plan":   { "debate_provider": "auto", "model": null, "reasoning_tier": "maximum", "max_debate_rounds": 2 },
    "difficulty_tiers": {
      "easy": "fast", "medium": "balanced", "hard": "deep", "critical": "maximum"
    },
    "max_fix_iterations": 3
  },
  "loops": {
    "build": {
      "integration": { "gate": "green_required", "max_fix_iterations": 2 },
      "tests": { "verify_command_required": "when_available" }
    },
    "escalation": { "on_stall": ["retry_same", "tier_up", "switch_provider", "human_gate"], "max_steps": 3 }
  }
}
```

`loops.build.integration.gate`: `green_required`(기본, 실패 시 수정 루프+하드 게이트) / `report_only`(Bash 미지원 등 — 결과만 보고) / `off`(건너뜀). `loops.escalation`은 orchestrate·build 공용이다.

**상태 파일**: `orchestrate` 스킬의 council-state 규약을 build에도 적용한다 — 실행 시작 시 생성, 각 페이즈 시작 시 재독·종료 시 갱신, 충돌 시 파일 우선, 채팅 미출력. 섹션: RUN META / 확정 계획(토론 종료 사유 포함) / 배정표 / 리뷰·수정 로그(패키지별 fix 카운트) / 게이트 이력 / 마찰 기록.

인라인 오버라이드가 항상 우선한다. `orchestrate/references/provider-runtime.md`의 Host-native·외부 provider 구분과 공통 모델·effort 규칙을 사용한다. `routing.exclude_host_vendor_from_external_providers`는 외부 CLI/MCP에만 적용하며 Host-native 코더 생성은 막지 않는다. 코더는 Host-native 또는 `providers`에서 `enabled: true`, `write: true`, probe 통과인 provider만 배정한다. 구 `difficulty_matrix`와 `codex_model`/`codex_effort`/`claude_thinking`/`allow_codex_write` 키는 동일 의미로 해석한다.

## 1. DEBATE-PLAN — 다른 vendor의 peer provider와 계획 수립

리서치가 필요하면 먼저 `orchestrate` 스킬의 리서치 플로우를 축약 실행하거나 researcher 에이전트를 활용한다. 그 다음:

1. **초안**: 요구사항 분석 후 구현 계획 초안을 직접 작성한다 — 목표, 아키텍처 선택지와 본인의 선택+이유, 작업 분해 초안, 리스크, 성공 기준(테스트 가능해야 함).
2. **토론 개시**: `plan.debate_provider=auto`이면 Host와 다른 vendor 중 `architect`, read-only, resume를 지원하는 provider를 고른다. 외부 CLI는 runner `role=architect`, `access=read-only`로 직접 호출한다. 외부 provider가 없으면 별도 Host-native architect를 사용하고 `독립성 약화`를 기록한다.
   - prompt: 계획 초안 전문 + "You are my peer architect, not my assistant. Attack this plan: wrong assumptions, better alternatives, hidden risks, missing work items. Propose concrete changes. Be direct."
3. **라운드 진행**: peer의 반박·대안을 검토하고, 수용/반박을 정리해 같은 Host-native handle 또는 CLI `sessionId`로 이어간다. 불가하면 이전 결과를 포함한 새 세션으로 진행한다. 합의 또는 `max_debate_rounds` 도달까지 반복하며, 동의하지 않는 지점은 오케스트레이터가 최종 결정하고 이유를 state 파일에 기록한다.
   - **수렴·교착 조기 종료**: 각 라운드 후 직전 라운드 대비 **새로운 반박·대안·리스크가 나왔는지** 점검한다. 새 내용이 없으면(조기 수렴 또는 교착) 남은 라운드를 소진하지 않고 즉시 토론을 종료하고 계획을 확정한다. 종료 사유(합의 / 조기 수렴 / 교착 / 라운드 소진)를 state 파일에 기록한다.
4. **확정 계획**을 사용자에게 요약 제시(아키텍처 결정, 작업 목록, 토론에서 바뀐 점, 미합의 지점과 본인 판정). 사용자가 이의 없으면 진행.

## 2. DECOMPOSE — 작업 분해와 배정

확정 계획을 **작업 패키지**로 나눈다. 패키지마다:

- **난이도 판정**: easy / medium / hard / critical — 판정 기준: 로직 복잡도, 실패 시 파급, 요구 맥락의 깊이.
- **코더 배정**: 난이도와 reasoning tier에 따라 Host-native 코더 또는 활성 외부 provider 중 `write: true`인 코더를 배정한다. 같은 역할의 Host-native 코더를 여러 개 띄울 수 있고, 가능하면 패키지 간 vendor를 분산한다. critical 패키지의 이중 구현은 서로 다른 vendor를 우선하되 비용상 명시적으로 필요할 때만 수행한다. 각 구현은 별도 worktree/사본으로 격리하고 리뷰어가 명세·테스트·엣지 케이스·일관성으로 승자를 판정한다.
- **파일 소유권 분할 (필수)**: 패키지 간 수정 파일이 겹치지 않게 나눈다. 겹침이 불가피하면 그 패키지들은 병렬이 아니라 순차로 실행한다. 공유 인터페이스(타입·스키마)는 오케스트레이터가 먼저 확정해 모든 브리프에 포함한다.
- **검증 명령 (P1-5)**: 패키지마다 완료 기준에 실행 가능한 **검증 명령을 최소 1개** 정의한다(환경이 명령 실행을 지원할 때). 명령은 완료 기준을 실제로 판별해야 한다 — 형식적 명령(`echo ok` 등) 금지. 배정표에 "이 명령이 완료 기준을 판별하는 근거"를 1줄로 남긴다. 실행 불가 환경이면 `검증 명령: 없음(사유)`으로 표기한다.

배정표(패키지 | 난이도 | 코더 | 모델 | reasoning tier | requested→resolved effort | 소유 파일)를 사용자에게 보여주고 진행한다.

## 3. IMPLEMENT — 병렬 구현

독립 패키지는 현재 Host의 병렬 기능으로 동시에 디스패치한다.

- **Claude Host-native**: 기존 `coder-claude-{tier}` 프로필을 사용한다.
- **Codex/기타 Host-native**: native collaboration/subagent 기능에 `coder` 역할과 소유 파일을 전달한다.
- **외부 CLI**: runner를 `role=coder`, `access=workspace-write`로 호출한다. `write: false` 또는 probe 실패 provider에는 배정하지 않는다.
- **기타 MCP**: `coder-proxy`와 PROVIDER SPEC을 사용한다.

브리프 템플릿:

```
[WORK PACKAGE]
MODEL: {resolved model 또는 inherit/default}
REASONING TIER: {fast|balanced|deep|maximum}
TRANSPORT: {host-native|cli|mcp} | PROVIDER/VENDOR: {provider/vendor} | EFFORT: {resolved 값}
PROJECT DIR: {절대경로}

## 패키지 목표
## 소유 파일 (이 파일들만 수정 가능)
## 공유 인터페이스 (변경 금지)
## 구현 명세
## 완료 기준 (테스트·검증 방법 포함)
## 검증 명령 (완료를 판별하는 실행 명령 ≥1, 환경 지원 시. 없으면 사유)
## 금지 사항 (소유 외 파일 수정, 인터페이스 변경, 의존성 추가 등)
```

각 코더는 구현 후 변경 요약·자체 테스트 결과를 반환한다. 실패·차단 보고는 그대로 수용하고 재배정 또는 명세 수정으로 대응한다.

## 4. CROSS-REVIEW — 교차 리뷰와 통합

1. **교차 원칙**: 구현 provider와 다른 vendor의 reviewer를 우선한다. 없으면 별도 Host-native reviewer를 사용하고 `동일 vendor — 독립성 약화`를 기록한다. 자기 결과물을 같은 세션이 리뷰하지 않는다. 오케스트레이터의 글루 코드도 예외 없이 리뷰한다. 외부 CLI reviewer는 runner `role=reviewer`, `access=read-only`로 diff·명세·검증 명령을 전달하고, Claude Host-native는 기존 `reviewer-claude-{tier}` 프로필을 사용할 수 있다.
   - **검증 명령 실행 (P1-5)**: 브리프에 검증 명령이 있으면 리뷰어는 그 명령을 **실행하는 것이 기본**이다(코더의 "테스트 통과" 주장을 말로만 신뢰하지 않는다). 실행 불가·안전하지 않으면 "검증 불가"로 사유를 남긴다.
2. **판정과 수정 루프**: REJECT는 해당 코더에게 리뷰 코멘트와 함께 수정 지시한다. Host-native 코더·리뷰어는 Host의 follow-up 기능으로, 외부 CLI는 runner의 `continue`와 기존 `sessionId`로 이어간다. 수정본은 **같은 리뷰어에게 재제출**해 재판정받고, 세션 재개가 불가능할 때만 이전 맥락을 포함한 동일 역할의 새 세션을 연다. fix 카운트는 **패키지 단위**로 state 파일 리뷰·수정 로그에 기록하며 최대 `max_fix_iterations`회. 동일 지적이 2회 반복되면(정체) 남은 횟수를 소진하지 않고 **에스컬레이션 사다리(§4-6)** 로 이행한다. 리뷰어 간 충돌 시 오케스트레이터가 근거로 판정한다. **리뷰어의 REJECT·지적을 기각할 때는 사유를 반드시 기록하고 최종 보고에 포함한다** (사유 없는 기각 금지).
3. **하드 게이트**: `max_fix_iterations`를 소진하고도 Critical 지적(리뷰어가 severity를 Critical로 표시한 것 — 명세 위반·데이터 손상·보안 결함 등 통합 불가 사유)이 해소되지 않은 패키지는 **통합하지 않는다**. 해당 패키지만 제외하고 진행할지, 전체 통합을 중단할지를 미해결 지적·수정 시도 이력과 함께 사용자에게 보고해 판단을 받는다. 자동 통합 금지.
4. **통합 검증 green 게이트 (P1-4)**: 전 패키지 승인 후 오케스트레이터가 전체 빌드·테스트를 실행한다.
   - **신호**: 빌드·테스트 pass/fail — 플러그인 내 가장 객관적인 신호. `loops.build.integration.gate`가 `report_only`(Bash 미지원 등)면 결과만 보고하고 게이트를 걸지 않는다. `off`면 이 단계를 건너뛴다.
   - **실패 시 루프**: 실패를 파일 소유권으로 해당 패키지에 귀속 → Host follow-up 또는 runner `continue`로 소유 코더에게 수정 지시 → 재실행. 종료 조건은 먼저 오는 것: **green**(전체 통과) 또는 `loops.build.integration.max_fix_iterations`(기본 2) 소진. 통합 로그(시도·실패 테스트·귀속 패키지)를 state 파일에 기록한다.
   - **귀속 불가**(패키지 간 상호작용 버그로 단일 소유자가 없음): 즉시 하드 게이트(§4-3)로 승격해 사용자에게 보고한다.
   - **소진 시**: green이 아니면 하드 게이트 준용 — 자동 통합 금지, 미해결 상태를 사용자에게 보고.
5. **최종 보고**: 변경 요약, 패키지별 코더·리뷰 이력, 토론에서 결정된 사항 반영 여부, 기각한 리뷰 지적과 사유, 통합 검증 결과(green/미해결), 남은 TODO. 모델·effort는 requested→resolved/actual을 구분한다. 마지막 줄: `council-build: plan({provider} {model}, {requested→actual effort}, {N}라운드) | coders: {목록} | reviews: {승인/반려 수} | fixes: {수} | integration: {green|report_only|미해결(사유)}`.

6. **에스컬레이션 사다리 (P1-6)**: 수정 루프가 정체(동일 지적 2회 반복)되면 남은 횟수를 같은 조건으로 소진하지 않고 조건을 바꿔 돌파한다. `loops.escalation.on_stall` 순서(기본 아래), 각 스텝 1회, state 파일에 기록:
   1. **같은 조건 재시도** — 리뷰 코멘트를 더 구체화해 1회 더.
   2. **tier 상향** — 해당 코더를 한 단계 높은 reasoning tier 프로필로 재배정(예: deep→maximum).
   3. **타 프로바이더 이관** — 다른 vendor의 활성 provider 코더에게 해당 패키지를 넘긴다. 없으면 새 Host-native 코더로 대체하고 "동일 vendor — 독립성 약화"를 보고에 명시한다.
   4. **인간 게이트** — 사다리 소진 시 하드 게이트(§4-3)로 사용자 판단을 받는다.

## 금지 사항

- 토론 없이 계획 확정 (max_debate_rounds=0으로 명시된 경우 제외).
- 파일 소유권 중첩 상태로 병렬 디스패치.
- 코더 결과물을 리뷰 없이 통합.
- `max_fix_iterations` 소진 후 미해결 Critical 패키지의 자동 통합 (하드 게이트 — 사용자 보고 필수).
- 리뷰 지적의 사유 없는 기각.
- 오케스트레이터가 직접 대량 구현 (소규모 글루 코드·설정 파일은 예외 — 단, 예외분도 교차 리뷰 승인 필수, 보고에 명시).
