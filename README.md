# model-council

Host에 종속되지 않는 멀티모델 리서치·개발 오케스트레이터입니다. 메인 오케스트레이터는 현재 앱의 Host가 맡고, **Host 자체 서브에이전트**와 다른 vendor의 **외부 CLI/MCP 에이전트**를 함께 편성합니다.

```text
Current Host (plan / judge / synthesize)
├─ Host-native agents (항상 별도 pool, 병렬 생성 가능)
└─ External providers
   ├─ Codex CLI        — OpenAI
   ├─ Claude Code CLI  — Anthropic
   └─ Antigravity CLI  — Google
```

핵심 규칙은 단순합니다.

- Codex/GPT Host: Codex native subagent + 외부 Claude Code/Antigravity CLI
- Claude Host: Claude native Agent + 외부 Codex/Antigravity CLI
- 같은 vendor의 **외부 CLI만** 기본 제외합니다. Host 자신의 native subagent는 계속 사용할 수 있습니다.
- 다른 vendor가 없을 때는 여러 native 세션으로 축소 진행하되 교차검증 독립성 약화를 표시합니다.

스킬: `/orchestrate`(리서치) · `/build`(개발) · `/council-setup`(Host/provider 설정) · `/council-retro`(회고)

상세 설계와 설정은 [PLUGIN.md](./PLUGIN.md), [config-reference.md](./skills/orchestrate/references/config-reference.md)를 참고하세요.

## 지원 표면

| Host | native worker | 외부 CLI 호출 | 패키지 상태 |
|---|---|---:|---|
| Claude Code / Cowork | Claude Agent profiles | Codex, Antigravity | `.claude-plugin` 유지 |
| Codex 앱 / CLI / IDE | Codex native subagents | Claude Code, Antigravity | `.codex-plugin` 추가 |
| 기타 agent host | Host가 제공하는 기능 | runner 실행 가능한 CLI | 스킬·runner 경로로 사용 |

외부 CLI adapter는 설치·로그인이 되어 있어야 합니다. plugin은 비밀번호나 API key를 받지 않으며 각 CLI의 공식 인증을 그대로 사용합니다.

## 설치

### Claude Code

```text
/plugin marketplace add https://github.com/minchanpark/model-council.git
/plugin install model-council@newdawn-plugins
```

Cowork에서는 설정 → 기능(Capabilities) → 플러그인 → 마켓플레이스 추가에서 이 저장소 URL을 등록합니다.

### Codex

저장소에 Codex용 `.codex-plugin/plugin.json`이 포함되어 있습니다. 현재 beta branch를 소스 체크아웃으로 시험할 때는 저장소를 Codex 작업공간으로 열고 `council-setup` 스킬을 실행합니다. Codex marketplace 배포는 main 승격 시 별도 marketplace 레이아웃으로 고정합니다.

### 외부 CLI 준비

필요한 provider만 설치하고 각 CLI에서 로그인합니다. Codex CLI 예시:

```bash
npm i -g @openai/codex@latest
codex login
```

Claude Code와 Antigravity는 각 공식 설치·로그인 절차를 사용합니다. 이후 다음 명령으로 감지할 수 있습니다.

```bash
node scripts/council-cli-runner.mjs probe
```

## 첫 설정

채팅에서 `council setup 해줘`를 실행합니다. 마법사는 다음을 분리해서 보여줍니다.

1. 현재 Host와 native subagent 사용 가능 여부
2. 설치·인증된 외부 CLI/MCP provider
3. same-vendor 외부 제외 결과와 쓰기 권한
4. read-only 스모크 테스트 결과

생성되는 `orchestrator.config.json`의 핵심은 다음과 같습니다.

```json
{
  "host": {
    "surface": "auto",
    "vendor": "auto",
    "native_agents": { "enabled": true, "max_concurrency": 4 }
  },
  "routing": {
    "exclude_host_vendor_from_external_providers": true,
    "allow_same_vendor_external_provider": false,
    "count_host_native_as_independent_vendor": false
  }
}
```

## 사용 예

- `orchestrate: 이 시장 가설을 여러 vendor로 교차 검증해줘`
- `critique 모드로 이 계획의 약점과 가장 강한 방어를 만들어줘`
- `build: 다른 에이전트와 계획을 토론한 뒤 이 기능을 구현해줘`
- `이번에는 외부 Codex CLI도 포함해줘` — same-vendor 외부 사용의 인라인 예외

## 안전과 제한

- 리서치·계획·리뷰는 read-only, 구현만 workspace-write입니다.
- Codex CLI와 Claude Code CLI는 runner가 read-only를 기술적으로 제한합니다.
- Antigravity CLI의 read-only는 현재 prompt+sandbox 수준이고 구조화 출력·자동 session ID 회수가 제한적입니다.
- Host sandbox가 외부 CLI의 OAuth/Keychain 저장소를 읽지 못하면 version probe는 통과해도 실제 호출은 `Not logged in`으로 실패할 수 있습니다. 플러그인은 Host 권한을 자동 완화하지 않으며, Host 접근 권한과 nested worker의 `read-only`는 별도로 관리합니다.
- 모델 ID는 사용자 지정·allowlist·현재 도구 확인값만 전달합니다.
- 병렬 writer는 파일 소유권과 worktree/사본을 분리합니다.
- 실행 중인 세션은 plugin 정의를 캐시할 수 있으므로 업데이트 뒤 앱/세션을 재시작합니다.

## 배포

현재 일반화 작업은 `generalize-version` beta에서 검증합니다. Claude와 Codex 매니페스트 버전을 함께 올리고 테스트가 통과한 뒤 main 승격 여부를 결정합니다.

main 승격 전 정적·라우팅 검사는 다음으로 다시 실행할 수 있습니다.

```bash
node scripts/self-test.mjs
```
