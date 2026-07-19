---
name: council-setup
description: >-
  model-council의 Host-native 서브에이전트와 외부 CLI/MCP provider 편성을 설정한다. 사용자가
  "카운슬 셋업", "council setup", "프로바이더 설정/연결/추가", "어떤 모델 연결돼 있어?" 등을
  요청하거나 플러그인 설치 직후 첫 오케스트레이션 전에 트리거된다. Host를 감지하고 Codex CLI,
  Claude Code CLI, Antigravity CLI 등을 probe한 뒤 orchestrator.config.json에 안전하게 병합한다.
---

# Council Setup — Host·provider 연결 마법사

당신은 설정 마법사다. 인증정보를 받거나 로그인을 대신하지 않는다. 재실행해도 기존 설정과 알 수 없는 키를 보존하고, 사용자가 명시하지 않은 provider를 삭제하지 않는다.

## 1. SCAN — Host와 실행 수단 감지

1. 작업 폴더 루트의 `orchestrator.config.json`을 읽는다. 없으면 신규 생성 예정으로 표시한다.
2. 현재 실행 표면을 `claude-code`, `claude-cowork`, `codex`, `other` 중 하나로, Host vendor를 `anthropic`, `openai`, `google`, `unknown` 중 하나로 판정한다. 불명확하면 둘 다 `auto`로 저장하고 현재 관찰값만 보고한다.
3. Host가 native subagent/collaboration 기능을 제공하면 이를 **Host-native agent pool**로 별도 표시한다. 이 pool은 외부 CLI provider와 다른 계층이며 기본 `enabled: true`다.
4. 플러그인 루트의 runner로 외부 CLI를 probe한다.

```bash
node "<plugin-root>/scripts/council-cli-runner.mjs" probe
node "<plugin-root>/scripts/council-cli-runner.mjs" route --host-vendor <판정한-vendor>
```

5. 현재 세션에 추가 AI MCP 도구가 보이면 `type: "mcp"` 후보로 함께 표시한다. CLI 감지 기준과 제한은 `references/known-providers.md`를 따른다.

## 2. ROUTE — 같은 vendor를 올바르게 분리

- 기본값 `exclude_host_vendor_from_external_providers: true`는 **외부 CLI/MCP provider만** 편성에서 제외한다.
- Host-native subagent 생성은 항상 별도다. 예: Codex Host는 Codex native subagent를 여러 개 만들 수 있고, 동시에 외부 `claude-code-cli`, `antigravity-cli`를 사용할 수 있다.
- 같은 vendor의 외부 CLI까지 쓰려면 사용자가 명시적으로 `allow_same_vendor_external_provider: true`를 선택해야 한다. 이 경우에도 Host-native와 외부 세션은 독립성 수준을 따로 기록한다.
- 교차 검증은 가능하면 서로 다른 vendor를 사용한다. 다른 vendor가 없으면 별도 Host-native 세션으로 진행하되 `독립성 약화`를 보고한다.

## 3. ASK — 편성 선택

다음 두 그룹을 분리한 표를 보여준다.

- Host: 표면/vendor/native agent 지원 여부와 활성 상태
- External providers: provider/vendor/설치·인증 상태/transport/쓰기 가능 여부/resume/구조화 출력/제한

그 다음 연결된 외부 provider 중 활성화할 항목, build 쓰기 권한, 검증된 기본 모델 ID를 확인한다. 모델을 확인할 수 없으면 `null`, allowlist는 `[]`로 둔다. 기본 권장은 Host-native 활성화 + Host와 다른 vendor의 설치된 CLI 활성화다.

## 4. VERIFY — 안전한 스모크 테스트

활성화할 외부 provider마다 runner를 `role=researcher`, `access=read-only`로 호출해 `Reply with exactly: <provider> smoke OK`를 보낸다. 먼저 `--dry-run`으로 인자를 확인하고 실제 실행한다.

- 통과: `enabled: true`
- 실패: 인증·버전·타임아웃 원문을 보고하고 `enabled: false`로 기록한다. 추측으로 통과 처리하지 않는다.
- Antigravity는 현재 강제 read-only가 아니라 prompt+CLI sandbox 수준이며 구조화 출력이 아니다. 스모크를 통과해도 이 제한을 설정·요약에 남긴다.

로그인이나 설치가 필요하면 `known-providers.md`의 명령만 안내하고 사용자가 직접 실행하게 한다. 계정 정보·API 키·비밀번호를 묻지 않는다.

## 5. WRITE — 설정 병합

다음 v0.7 구조를 기준으로 병합한다. 기존 다른 키는 보존한다.

```json
{
  "schema_version": 1,
  "host": {
    "surface": "auto",
    "vendor": "auto",
    "native_agents": {
      "enabled": true,
      "max_concurrency": 4,
      "roles": ["researcher", "architect", "coder", "reviewer"]
    }
  },
  "providers": {
    "codex-cli": {
      "type": "external",
      "vendor": "openai",
      "adapter": "codex",
      "transports": ["cli", "mcp"],
      "enabled": true,
      "write": true,
      "model_policy": "orchestrator",
      "model": null,
      "model_allowlist": [],
      "effort_ladder": ["minimal", "low", "medium", "high", "xhigh", "max"]
    },
    "claude-code-cli": {
      "type": "external",
      "vendor": "anthropic",
      "adapter": "claude-code",
      "transports": ["cli"],
      "enabled": true,
      "write": true,
      "model_policy": "orchestrator",
      "model": null,
      "model_allowlist": [],
      "effort_ladder": ["low", "medium", "high", "xhigh", "max"]
    },
    "antigravity-cli": {
      "type": "external",
      "vendor": "google",
      "adapter": "antigravity",
      "transports": ["cli"],
      "enabled": true,
      "write": true,
      "model_policy": "orchestrator",
      "model": null,
      "model_allowlist": [],
      "effort_ladder": []
    }
  },
  "routing": {
    "default_tier": "deep",
    "exclude_host_vendor_from_external_providers": true,
    "allow_same_vendor_external_provider": false,
    "count_host_native_as_independent_vendor": false
  }
}
```

구 `providers.claude` native 설정은 Host가 Claude일 때 `host.native_agents`로 해석한다. 구 `providers.codex`는 `providers.codex-cli`로 이관하되 기존 키를 삭제하지 않는다. 상세 호환 규칙은 `../orchestrate/references/config-reference.md`를 따른다.

## 6. 마무리

최종 표에 Host-native와 External providers를 분리하고 각 provider의 `enabled`, 역할, transport, 모델, effort, read-only 강제 여부를 표시한다. 마지막에 `/orchestrate`와 `/build`에서 새 편성이 사용되며, **Host 자신의 native subagent는 외부 same-vendor 제외와 무관하게 계속 사용 가능**하다고 명시한다.
