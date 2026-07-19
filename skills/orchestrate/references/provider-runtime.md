# Host-native · 외부 CLI Provider 런타임

model-council은 실행 주체를 두 계층으로 구분한다.

- **Host**: 현재 대화를 소유하고 PLAN·REVIEW·SYNTHESIZE 또는 최종 통합을 수행하는 메인 오케스트레이터.
- **Host-native agent**: Host가 자체 서브에이전트 기능으로 생성하는 worker. 외부 vendor로 세지 않지만 병렬 조사·구현·리뷰에 사용할 수 있다.
- **External provider**: 별도 CLI 또는 MCP 세션으로 호출되는 에이전트. vendor가 Host와 다를 때 독립 교차검증 1표로 센다.

`routing.exclude_host_vendor_from_external_providers: true`는 외부 provider에만 적용한다. `host.native_agents.enabled`와는 무관하다. 따라서 Codex/GPT Host는 Codex CLI를 외부 provider에서 제외해도 Codex native 서브에이전트를 계속 스폰할 수 있고, Claude Host도 Claude native Agent를 계속 사용할 수 있다.

## 기본 Host 감지

현재 세션의 도구와 surface를 확인해 아래처럼 해석한다. 모델 이름만으로 추측하지 않는다.

| surface | vendor | native agent |
|---|---|---|
| Codex 앱·CLI·IDE | `openai` | Codex collaboration/subagent |
| Claude Code·Cowork | `anthropic` | Agent/Task + SendMessage |
| Antigravity | `google` | Antigravity subagent |
| 불명 | `unknown` | 현재 노출된 기능으로만 판정 |

Host 감지가 불확실하고 외부 동일-vendor 제외 결과가 편성을 바꾸면 사용자에게 한 번 확인한다.

## CLI runner

플러그인 루트에서 다음 runner를 사용한다.

```bash
node scripts/council-cli-runner.mjs probe
node scripts/council-cli-runner.mjs run --provider <provider> --role <role> --cwd <dir> --access <mode> --tier <tier>
node scripts/council-cli-runner.mjs continue --provider <provider> --session-id <id> --role <role> --cwd <dir> --access <mode> --tier <tier>
```

`run`과 `continue`의 prompt는 stdin으로 전달한다. Antigravity는 설치된 CLI가 stdin headless 입력을 지원하지 않아 runner 내부에서 shell 없이 인자 배열로 전달한다. `--dry-run`은 실제 provider 호출 없이 command shape와 권한을 검증한다.

지원 역할: `researcher`, `architect`, `coder`, `reviewer`.

지원 access:

- `read-only`: 조사·계획·리뷰. Codex와 Claude Code는 기술적으로 쓰기를 제한한다.
- `workspace-write`: build 구현에만 사용한다.
- Antigravity의 `read-only`는 현재 CLI 1.0 계열에서 프롬프트 규율이며 강제 차단이 아니다. 이 경고가 있는 실행은 쓰기 위험이 없는 승인된 작업 폴더에서만 사용한다.

runner 결과의 `status`, `sessionId`, `result`, `actual`, `warnings`, `diagnostics`를 state 파일에 기록한다. `status != completed`를 성공으로 처리하지 않는다.

## 라우팅과 독립성

1. Host-native worker는 항상 편성 후보지만 Host와 같은 vendor다.
2. 외부 provider는 `enabled: true`이고 probe가 통과한 것만 후보로 삼는다.
3. `exclude_host_vendor_from_external_providers: true`이면 Host와 같은 vendor의 외부 CLI/MCP를 기본 제외한다.
4. `allow_same_vendor_external_provider: true` 또는 사용자 인라인 요청이 있으면 예외적으로 허용할 수 있으나 독립 vendor 수를 늘리지 않는다.
5. 듀얼 검증은 가능하면 서로 다른 vendor 둘을 사용한다. 없으면 Host-native 인스턴스를 추가하고 `독립성 약화`를 기록한다.
6. 외부 CLI가 내부에서 여러 subagent를 사용해도 vendor 표는 하나로 센다.

## 실행 안전

- 프롬프트를 셸 문자열에 보간하지 않는다.
- model ID는 사용자 제공·allowlist·probe 확인값만 전달한다.
- 리서치·계획·리뷰는 `read-only`, 구현만 `workspace-write`다.
- 위험한 bypass/YOLO 플래그를 기본 사용하지 않는다.
- 병렬 writer의 소유 파일은 겹치지 않게 하고, 같은 파일을 다루는 비교 구현은 worktree/사본으로 격리한다.
- 세션 재개가 지원되지 않거나 `sessionId`가 없으면 이전 결과 요약과 후속 질문으로 새 세션을 실행한다.
