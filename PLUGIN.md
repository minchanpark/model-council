# model-council

멀티모델 리서치 오케스트레이터. 메인 Claude(Fable/Opus — 앱의 모델 선택기에서 지정)가 지휘하고, **Codex(ChatGPT OAuth)** 와 **Claude Opus** 서브 리서처가 병렬 리서치를 수행하며, 초기 기획 기준으로 심사·통합해 최종 답변을 만든다. API 키 불필요 — 전부 구독 OAuth.

## 구성

**리서치** (`/orchestrate`)
- `skills/orchestrate` — PLAN → DISPATCH → REVIEW → SYNTHESIZE + 모드(research/critique/consensus)
- `agents/researcher-opus` — Claude Opus 독립 리서처
- `agents/researcher-codex` — Codex 프록시 리서처 (read-only, 질문 단위 분할 호출)

**개발** (`/build`)
- `skills/build` — DEBATE-PLAN(오케스트레이터 ↔ Codex ultra 동급 토론) → DECOMPOSE(난이도별 모델·effort 배정 + 파일 소유권 분할) → IMPLEMENT(Claude·Codex 코더 다중 병렬) → CROSS-REVIEW(교차 리뷰·수정 루프·통합)
- `agents/coder-claude` — Claude 구현 코더 (소유 파일 범위 내 구현·자체 검증)
- `agents/coder-codex` — Codex 구현 프록시 (workspace-write, 소유 범위 검수)
- `agents/reviewer-opus` — 교차 리뷰어 (APPROVE/REJECT 판정 전담)

**셋업** (`/council-setup`)
- `skills/council-setup` — 프로바이더 연결 마법사: 사용 가능한 도구 스캔 → 사용자 선택 → 스모크 테스트 → `orchestrator.config.json` 레지스트리 저장. 미연결 프로바이더는 연결 방법 안내(설치·OAuth는 사용자 직접). 카탈로그: `references/known-providers.md`
- `agents/researcher-proxy` · `agents/coder-proxy` — codex·claude 외 프로바이더용 범용 프록시 (레지스트리의 tools·arg_map으로 호출)

**공통**
- `.mcp.json` — `codex mcp-server` 등록 (리서치·개발 공용, 서버 1개). 추가 프로바이더의 MCP는 사용자가 앱 설정에 등록하면 서브에이전트가 자동 상속

안전 규칙: 리서치 경로의 Codex는 항상 read-only. 쓰기(workspace-write)는 `/build`의 coder-codex만 가능하며, `build.allow_codex_write: false`로 끌 수 있다.

## 사전 준비 (1회)

```bash
npm i -g @openai/codex
codex login        # ChatGPT 계정 OAuth
```

## 사용법

- **설치 후 첫 실행: "council setup 해줘"** — 연결된 프로바이더를 감지하고 편성을 설정 (건너뛰면 기본 claude+codex)
- "orchestrate: 폐쇄형 SNS 시장성 리서치해줘"
- "critique 모드로 이 IR 덱 공격해봐"
- "consensus로: PIN의 첫 유료 고객은 누구여야 하나"
- "build: 이슈 상태 워크플로(FR-06) 구현해줘" — Codex와 계획 토론 → 병렬 구현 → 교차 리뷰
- "build인데 토론 없이 바로" → `max_debate_rounds: 0`

## 모델·effort 변경

작업 폴더 루트에 `orchestrator.config.json` 생성 (스키마: `skills/orchestrate/references/config-reference.md`):

```json
{
  "codex":  { "enabled": true, "model": null, "reasoning_effort": "xhigh" },
  "claude": { "enabled": true, "thinking": "extra" }
}
```

모델 정책: Claude 서브에이전트는 **Opus 4.8 고정**(effort만 조절), Codex는 `codex.model`(null=CLI 기본 플래그십, 현재 gpt-5.6-sol), 메인 오케스트레이터는 앱 모델 선택기에서 지정.

기본 정책: 서브 에이전트 effort는 **최대 단계 바로 아래**(codex `xhigh`, claude `extra`). **메인 오케스트레이터는 앱의 모델 선택기에서 최고 모델 + 최고 effort(확장 사고)로 설정할 것을 권장** — 플러그인은 메인 모델을 제어할 수 없다.

또는 요청에 인라인으로: "codex는 medium으로, opus 대신 sonnet".

## 트러블슈팅

- **codex 도구가 안 보임**: GUI 앱은 PATH가 제한적이다. `.mcp.json`의 `"command": "codex"`를 `which codex` 결과의 절대경로(예: `/opt/homebrew/bin/codex`)로 바꿔 재설치하거나, 데스크탑 설정의 MCP 등록에서 절대경로를 사용.
- **인증 오류**: 터미널에서 `codex login` 재실행.
- **effort 값 오류**: 플랜·모델별 지원 값이 다르다. 프록시가 인자 없이 1회 재시도하며, config에서 `reasoning_effort`를 `high` 등으로 낮춰볼 것.
- **codex 타임아웃**: MCP 호출당 약 180초 제한. 프록시가 질문당 분할 호출하도록 설계돼 있으나, 그래도 걸리면 effort를 낮추거나 질문을 좁힐 것.
- **모델 버전 오류** ("requires a newer version of Codex"): `npm i -g @openai/codex@latest` 후 데스크탑 앱 완전 재시작.

## 다른 모델 추가 (옵션)

플러그인 수정 불필요. ① 해당 프로바이더의 CLI 설치·OAuth 로그인(사용자 직접) ② MCP를 앱에 등록(Cowork: 설정 > 커넥터 / Code: `claude mcp add`) ③ `/council-setup` 재실행 → 감지·스모크 테스트·레지스트리 등록까지 자동. 지원 후보와 주의사항은 `skills/council-setup/references/known-providers.md` 참조 (Gemini: CLI 세대교체 주의 / Qwen: 무료 쿼터 / DeepSeek: OAuth CLI 없음 — 불가).

## 제한

- Claude Cowork·Claude Code에서 동작. claude.ai 웹 챗은 로컬 MCP·서브에이전트 미지원으로 불가.
- 메인(오케스트레이터) 모델은 플러그인이 아니라 앱의 모델 선택기에서 정한다.
