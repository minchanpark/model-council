# model-council

Host에 종속되지 않는 **read-only 멀티모델 리서치 오케스트레이터**입니다.
현재 앱의 Host가 Main Orchestrator를 맡고, Host-native researcher와 다른
vendor의 외부 Codex·Claude Code·Antigravity researcher를 함께 편성합니다.

```text
Current Host (plan / judge / synthesize)
├─ Host-native researchers
└─ External read-only researchers
   ├─ Codex CLI        — OpenAI
   ├─ Claude Code CLI  — Anthropic
   └─ Antigravity CLI  — Google
```

model-council은 코드, 테스트, 마이그레이션, 인프라를 수정하지 않습니다.
기존 build 철학과 실행 흐름은
[`document-driven-development`](https://github.com/minchanpark/document-driven-development)
로 이전되었습니다.

## 핵심 규칙

- 같은 vendor의 외부 CLI만 기본 제외합니다. Host-native researcher는 계속
  사용할 수 있습니다.
- 다른 vendor가 없으면 여러 Host-native 세션으로 축소하되 독립성 약화를
  표시합니다.
- 지원 역할은 `researcher`, 지원 권한은 `read-only`뿐입니다.
- runner는 `workspace-write`, coder, reviewer, architect 역할을 거부합니다.
- Antigravity read-only는 prompt+sandbox 수준이라 기술적 한계를 명시합니다.

스킬은 `/orchestrate`(리서치), `/council-setup`(provider 설정),
`/council-retro`(리서치 회고) 세 개입니다.

## 설치

### Claude Code

```text
/plugin marketplace add https://github.com/minchanpark/model-council.git
/plugin install model-council@newdawn-plugins
```

Cowork에서는 설정 → 기능(Capabilities) → 플러그인 → 마켓플레이스 추가에서
저장소 URL을 등록합니다.

### Codex

```bash
codex plugin marketplace add minchanpark/model-council --ref main
codex plugin add model-council@newdawn-plugins
```

설치 후 새 Codex task를 시작해야 갱신된 스킬을 읽습니다.

## 첫 설정

`council setup 해줘`를 실행하면 Host/native capability, 설치된 외부 CLI,
same-vendor 제외 결과, read-only smoke 결과를 분리해 보여줍니다. 인증정보는
받거나 저장하지 않고 각 CLI의 공식 로그인 상태를 사용합니다.

```bash
node scripts/council-cli-runner.mjs probe
node scripts/council-cli-runner.mjs route --host-vendor openai
node scripts/self-test.mjs
```

제안되는 모든 provider는 `write: false`, 역할은 `researcher`입니다. 설정 마법사도
파일을 만들지 않고 이번 세션에 적용할 routing만 보여줍니다. 과거 설정에 build나
write 키가 남아 있어도 v0.8 runtime은 무시하고 쓰기 요청을 거부합니다.

## 사용 예

- `orchestrate: 이 시장 가설을 여러 vendor로 교차 검증해줘`
- `critique 모드로 이 계획의 약점과 가장 강한 방어를 만들어줘`
- `consensus 모드로 두 모델의 일치와 불일치만 정리해줘`
- `이번에는 외부 Codex CLI도 포함해줘`

개발이 필요하면 `document-driven-development`에서 승인 문서, Task Lock,
Package Lock, 독립 리뷰, green gate를 거쳐 실행합니다.

## 안전과 제한

- Codex와 Claude Code는 runner가 read-only를 기술적으로 제한합니다.
- Antigravity는 구조화 출력과 강제 read-only가 제한적입니다.
- Host sandbox가 외부 CLI 인증 저장소를 읽지 못하면 probe 후 실제 호출이
  실패할 수 있습니다. 플러그인은 Host 권한을 자동 완화하지 않습니다.
- 모델 ID는 사용자 지정, allowlist, 현재 도구 확인값만 전달합니다.
- 업데이트 뒤 앱이나 세션을 재시작합니다.

상세 설계는 [PLUGIN.md](./PLUGIN.md), 설정은
[config-reference.md](./skills/orchestrate/references/config-reference.md)를
참고하세요.
