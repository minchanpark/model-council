# model-council

멀티모델 리서치·개발 오케스트레이터. 메인 오케스트레이터는 앱에서 선택한 **호스트 Claude**가 맡고, **Codex(ChatGPT OAuth)** 와 **Claude 서브 에이전트** 등이 병렬 작업을 수행한다. 서브 모델과 추론 강도는 설정·난이도에 따라 해석하며, 초기 기획 기준으로 심사·통합한다.

## 구성

**리서치** (`/orchestrate`)
- `skills/orchestrate` — PLAN → DISPATCH → REVIEW → SYNTHESIZE + 모드(research/critique/consensus)
- `agents/researcher-claude-{fast|balanced|deep|maximum}` — 지정 모델 + tier별 effort로 실행되는 Claude 독립 리서처
- `agents/researcher-codex` — Codex 프록시 리서처 (read-only, 질문 단위 분할 호출)

**개발** (`/build`)
- `skills/build` — DEBATE-PLAN(오케스트레이터 ↔ Codex 동급 토론) → DECOMPOSE(난이도별 모델·effort 배정 + 파일 소유권 분할) → IMPLEMENT(Claude·Codex 코더 다중 병렬) → CROSS-REVIEW(교차 리뷰·수정 루프·통합)
- `agents/coder-claude-{fast|balanced|deep|maximum}` — tier별 effort가 설정된 Claude 구현 코더
- `agents/coder-codex` — Codex 구현 프록시 (workspace-write, 소유 범위 검수)
- `agents/reviewer-claude-{fast|balanced|deep|maximum}` — tier별 effort가 설정된 Claude 교차 리뷰어

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
  "providers": {
    "claude": { "enabled": true, "model_policy": "orchestrator", "model": "inherit", "model_allowlist": [] },
    "codex":  { "enabled": true, "model_policy": "orchestrator", "model": null, "model_allowlist": [] }
  },
  "routing": {
    "default_tier": "deep"
  }
}
```

모델 정책: Claude 서브 에이전트는 기본적으로 호스트 모델을 `inherit`하며, 오케스트레이터가 검증된 모델 별칭·ID를 Agent 호출에 지정할 수 있다. Codex의 `model: null`은 Codex CLI 기본 모델을 뜻한다. 플러그인은 메인 오케스트레이터 모델을 바꾸지 않는다.

추론 정책: 오케스트레이터는 `fast / balanced / deep / maximum`의 공통 reasoning tier를 정하고 프로바이더별 effort로 해석한다. Codex는 호출별 effort를 전달한다. Claude는 native Agent 호출에 effort 인자가 없으므로 `fast=low`, `balanced=medium`, `deep=high`, `maximum=xhigh` frontmatter를 가진 역할별 프로필을 선택한다. 모델은 같은 Agent 호출의 model 인자로 별도 지정한다.

또는 요청에 인라인으로: "Codex 모델은 기본값, reasoning tier는 balanced", "Claude 서브 모델은 sonnet으로".

## 트러블슈팅

- **codex 도구가 안 보임**: GUI 앱은 PATH가 제한적이다. `.mcp.json`의 `"command": "codex"`를 `which codex` 결과의 절대경로(예: `/opt/homebrew/bin/codex`)로 바꿔 재설치하거나, 데스크탑 설정의 MCP 등록에서 절대경로를 사용.
- **인증 오류**: 터미널에서 `codex login` 재실행.
- **effort 값 오류**: 플랜·모델별 지원 값이 다르다. Codex는 한 단계 낮은 effort로 재시도하고, Claude는 한 단계 낮은 프로필로 재시도한다. 안전한 매핑이 없으면 기본값을 상속한다.
- **codex 타임아웃**: MCP 호출당 약 180초 제한. 프록시가 질문당 분할 호출하도록 설계돼 있으나, 그래도 걸리면 effort를 낮추거나 질문을 좁힐 것.
- **모델 버전 오류** ("requires a newer version of Codex"): `npm i -g @openai/codex@latest` 후 데스크탑 앱 완전 재시작.

## 다른 모델 추가 (옵션)

플러그인 수정 불필요. ① 해당 프로바이더의 CLI 설치·OAuth 로그인(사용자 직접) ② MCP를 앱에 등록(Cowork: 설정 > 커넥터 / Code: `claude mcp add`) ③ `/council-setup` 재실행 → 감지·스모크 테스트·레지스트리 등록까지 자동. 지원 후보와 주의사항은 `skills/council-setup/references/known-providers.md` 참조 (Gemini: CLI 세대교체 주의 / Qwen: 무료 쿼터 / DeepSeek: OAuth CLI 없음 — 불가).

## 제한

- Claude Cowork·Claude Code에서 동작. claude.ai 웹 챗은 로컬 MCP·서브에이전트 미지원으로 불가.
- 메인(오케스트레이터) 모델은 플러그인이 아니라 앱의 모델 선택기에서 정한다.
- Claude native Agent는 effort를 호출 인자로 받지 않지만, 이 플러그인은 effort별 에이전트 프로필 선택으로 실행마다 추론 강도를 제어한다. `CLAUDE_CODE_EFFORT_LEVEL` 환경변수가 설정된 환경에서는 그 값이 프로필 frontmatter보다 우선한다.
