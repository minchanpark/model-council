# 알려진 프로바이더 카탈로그

"쉽게 연결 가능"의 기준: 구독 OAuth·계정 로그인·로컬 실행 중 하나로 인증되고(API 키 직접 관리 불필요), MCP/CLI로 호출 가능한 것. 각 항목의 정보는 시점에 따라 달라질 수 있으므로 스모크 테스트로 최종 확정한다.

## claude (native) — 항상 사용 가능
- 연결: 없음 (호스트의 Claude 구독. Agent 도구로 스폰)
- 모델: 기본 `inherit`. 확인된 Claude 모델 별칭·ID는 호출별 model로 지정 가능
- effort_ladder: low/medium/high/xhigh/max. 단, native Agent 도구는 호출별 effort 인자를 받지 않으므로 실제 effort는 호스트 세션·에이전트 설정을 상속
- capabilities: `per_call_model: true`, `per_call_effort: false`
- write: true (coder-claude)

## codex (OpenAI) — 플러그인 동봉
- 감지 패턴: 도구 이름에 `codex`
- 연결: ChatGPT 계정 OAuth. 터미널에서:
  ```bash
  npm i -g @openai/codex@latest
  codex login
  ```
  MCP 서버는 플러그인 `.mcp.json`에 동봉(`codex mcp-server`) — 별도 등록 불필요. 도구가 안 보이면 앱 재시작, 그래도 안 되면 `.mcp.json`의 command를 `which codex` 절대경로로.
- 기본 모델: null = Codex CLI 기본 모델. 특정 모델명은 확인 없이 하드코딩하지 않음
- effort_ladder: minimal/low/medium/high/xhigh/max (모델별 상이). 특정 모델에서 확인된 `ultra` 등은 명시 설정으로만 추가
- capabilities: `per_call_model: true`, `per_call_effort: true`
- write: true (coder-codex, workspace-write) / split: true (호출당 ~180초 제한 → 질문·단계 분할)
- 스모크: `codex` 도구, prompt "Reply with exactly: codex smoke OK", sandbox read-only

## gemini (Google)
- 감지 패턴: 도구 이름에 `gemini` 또는 `antigravity`/`agy`
- 연결: Google 계정 OAuth CLI + 커뮤니티 MCP 래퍼. ⚠️ 주의: Gemini CLI는 2026-06 무료·Pro 사용자 대상 종료, 후속 Antigravity CLI(`agy`)로 세대교체 중 — 래퍼가 신·구 혼재하므로 연결 전 래퍼의 최신 지원 여부 확인 필요.
- 안내: ① 해당 CLI 설치 후 Google 계정 로그인 ② 래퍼 MCP(예: gemini-mcp-tool 계열)를 Cowork 설정 > 커넥터 또는 `claude mcp add`로 등록 ③ /council-setup 재실행
- effort_ladder: 래퍼별 상이 (미지정 시 effort 인자 생략) / write: false 권장 (검증 전)

## qwen (Alibaba)
- 감지 패턴: 도구 이름에 `qwen`
- 연결: Qwen Code CLI (Qwen 계정 OAuth, 무료 쿼터) + MCP 래퍼 등록
- effort_ladder: 래퍼별 상이 / write: false 권장 (검증 전)

## ollama (로컬)
- 감지 패턴: 도구 이름에 `ollama`
- 연결: 로컬 실행(인증 불필요) + Ollama MCP 서버 등록. 모델 품질은 로컬 모델에 의존 — easy 트랙 전용 권장
- write: false

## 사용자 정의 프로바이더
카탈로그에 없는 AI MCP 도구도 등록 가능. 레지스트리에 직접 기입:
```json
{
  "providers": {
    "myprovider": {
      "type": "mcp", "enabled": true, "write": false,
      "model_policy": "orchestrator", "model": null, "model_allowlist": [],
      "tools": { "call": "<도구 이름>", "reply": "<후속 도구, 없으면 생략>" },
      "arg_map": { "model": "<모델 인자명>", "effort": "<effort 인자 경로>" },
      "capabilities": { "per_call_model": true, "per_call_effort": true },
      "effort_ladder": ["low", "medium", "high"]
    }
  }
}
```
스모크 테스트 통과 후 사용. 인자 스키마를 모르면 arg_map을 비워두고 프록시가 prompt만으로 호출하게 한다.

## 카탈로그 밖 (연결 비권장/불가)
- DeepSeek: 구독 OAuth CLI 없음 — API 키 방식뿐이라 이 플러그인의 기준(키 없는 연결) 미충족.
- Grok/Perplexity 등: API 키 또는 유료 전용 — 동일 사유로 기본 카탈로그 제외. 필요 시 사용자 정의로 등록은 가능하나 키 관리는 사용자 책임.
