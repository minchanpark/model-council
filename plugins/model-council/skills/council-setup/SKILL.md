---
name: council-setup
description: >-
  model-council의 프로바이더(서브 에이전트로 쓸 외부 AI) 연결을 설정한다. 사용자가 "카운슬 셋업",
  "council setup", "프로바이더 설정/연결/추가", "오케스트레이터 에이전트 설정", "어떤 모델 연결돼 있어?"
  등을 요청하거나, 플러그인 설치 직후 첫 오케스트레이션 전에 트리거된다. 사용 가능한 도구를 스캔해
  연결된 프로바이더를 감지하고, 사용자 선택을 받아 orchestrator.config.json 레지스트리에 저장하며,
  미연결 프로바이더는 연결 방법을 안내한다.
---

# Council Setup — 프로바이더 연결 마법사

당신은 설정 마법사다. 프로바이더를 **대신 설치하지 않는다** — 감지·검증·기록·안내만 한다. 재실행해도 안전해야 한다(기존 설정 병합, 삭제 금지).

## 1. SCAN — 감지

1. 작업 폴더 루트의 `orchestrator.config.json`을 읽는다 (없으면 신규 생성 예정으로 표시).
2. 현재 세션에서 **자신이 호출할 수 있는 도구 목록**을 확인하고, `references/known-providers.md`의 감지 패턴과 대조해 후보를 분류한다:
   - **연결됨**: 해당 프로바이더의 MCP 도구가 보임 (예: 이름에 `codex`가 포함된 도구)
   - **미연결**: 카탈로그에 있으나 도구가 안 보임
   - `claude`(native)는 항상 연결됨 — Claude 구독의 서브에이전트라 별도 연결이 없다.
3. 카탈로그에 없는 낯선 AI 계열 MCP 도구가 보이면 "사용자 정의 후보"로 함께 표시한다.

## 2. ASK — 선택

감지 결과를 표(프로바이더 | 상태 | 연결 방식 | 역할 가능 범위)로 보여주고 묻는다:

- **연결된 프로바이더 중 무엇을 활성화할지** (복수 선택. Cowork에서는 선택지 UI, Claude Code에서는 텍스트로)
- **미연결 프로바이더 중 연결 안내를 원하는 것**이 있는지 — 반드시 미연결 목록도 보여줘서 "이런 것도 붙일 수 있다"를 알린다
- 활성화 대상의 **쓰기 권한**(build에서 코더로 쓸지, 리서치 전용일지)

기본 권장: claude + codex 활성화, 나머지는 사용자 선택.

## 3. VERIFY — 스모크 테스트

활성화하기로 한 각 MCP 프로바이더에 대해 1줄 스모크 테스트를 실행한다 (해당 도구로 "Reply with exactly: <프로바이더명> smoke OK" 전송, 읽기 전용 인자 사용 가능 시 적용). 결과:

- 통과 → 레지스트리에 `enabled: true`
- 실패 → 오류 원인 그대로 보고 (인증 만료/버전/타임아웃), `enabled: false`로 기록할지 확인하고, known-providers의 해결 힌트를 출력한다. **추측으로 통과 처리하지 않는다.**

## 4. GUIDE — 미연결 안내

사용자가 원한 미연결 프로바이더마다 `references/known-providers.md`의 셋업 안내를 출력한다:

- 터미널 명령(CLI 설치·OAuth 로그인)은 **사용자가 직접 실행** — 로그인은 본인 브라우저에서만 가능하다
- MCP 등록 위치: Cowork = 설정 > 커넥터(로컬 MCP) 또는 데스크탑 config / Claude Code = `claude mcp add ...` 또는 프로젝트 `.mcp.json`
- 마지막 줄: "연결을 마치면 `/council-setup`을 다시 실행하세요."

계정 정보·API 키·비밀번호를 묻거나 받지 않는다.

## 5. WRITE — 레지스트리 저장

`orchestrator.config.json`에 병합 저장한다 (사용자의 기존 다른 키는 보존):

```json
{
  "providers": {
    "claude": { "type": "native", "enabled": true, "write": true,
                "effort_ladder": ["normal", "deep", "extra", "max"] },
    "codex":  { "type": "mcp", "enabled": true, "write": true, "split": true, "model": null,
                "tools": { "call": "codex", "reply": "codex-reply" },
                "effort_ladder": ["minimal", "low", "medium", "high", "xhigh", "ultra"] }
  }
}
```

새 프로바이더를 추가할 때는 known-providers.md의 항목(또는 사용자 정의 값)으로 `tools`·`arg_map`·`effort_ladder`·`write`·`split`을 채운다. 난이도 매트릭스에 새 프로바이더 열이 없으면 effort_ladder를 4구간(easy→critical)에 균등 매핑한 기본값을 제안해 추가한다.

## 6. 마무리 요약

최종 상태 표(프로바이더 | enabled | 역할: 리서치/코딩 | effort 사다리)와 함께: "이제 `/orchestrate` 또는 `/build`에서 이 편성이 사용됩니다. 프로바이더를 더 붙이려면 연결 후 `/council-setup`을 재실행하세요."
