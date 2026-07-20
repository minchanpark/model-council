# model-council 설계

## 1. 책임 경계

model-council은 read-only 리서치만 담당합니다.

- **Host**: 현재 대화를 소유하고 PLAN, REVIEW, SYNTHESIZE를 수행합니다.
- **Host-native researcher**: Host의 collaboration 기능으로 생성합니다.
- **External researcher**: 별도 Codex, Claude Code, Antigravity CLI/MCP 세션입니다.

구현 계획 토론, 작업 패키지 분해, writer, cross-review, integration gate는
`document-driven-development`로 이전되었습니다. 이 플러그인은 개발 역할이나
쓰기 권한을 노출하지 않습니다.

## 2. 리서치 `/orchestrate`

PLAN → DISPATCH → REVIEW → SYNTHESIZE를 수행합니다. 난이도가 높은 트랙은
서로 다른 vendor 둘을 우선하고, 외부 provider가 부족하면 별도 Host-native
researcher로 보완합니다. 성공 기준, 블라인드 사전 평결, 기준 충족 follow-up,
정체 감지, 에스컬레이션을 유지합니다.

## 3. 설정과 회고

- `/council-setup`: Host와 native capability를 감지하고 외부 CLI를 probe한
  뒤 read-only routing을 채팅으로 제안합니다. 파일을 수정하지 않습니다.
- `/council-retro`: 사용자가 제공한 research 기록의 반복 마찰을 읽고 제안을
  채팅으로 반환합니다. state, proposal, skill 파일을 수정하지 않습니다.

## 4. CLI adapter runtime

runner는 shell 문자열 대신 args 배열로 provider를 실행하고 결과를 공통 JSON으로
정규화합니다.

```bash
node scripts/council-cli-runner.mjs probe
node scripts/council-cli-runner.mjs route --host-vendor openai
node scripts/council-cli-runner.mjs run --provider claude \
  --role researcher --cwd "$PWD" --access read-only --tier deep
node scripts/council-cli-runner.mjs continue --provider claude \
  --session-id <id> --role researcher --cwd "$PWD" --access read-only --tier deep
```

지원 역할은 `researcher`, access는 `read-only`뿐입니다. Codex와 Claude Code는
CLI 권한으로 쓰기를 제한하고 Antigravity는 prompt+sandbox 한계를 경고합니다.

| adapter | structured | resume | read-only 강제 | write |
|---|---:|---:|---:|---:|
| Codex CLI | 예 | 예 | 예 | 아니오 |
| Claude Code CLI | 예 | 예 | 예 | 아니오 |
| Antigravity CLI | 아니오 | 제한적 | 아니오 | 아니오 |

## 5. agent definitions

- `researcher-claude-*`: Claude Host-native research profiles
- `researcher-codex`: Codex read-only proxy profile when the Host already exposes a compatible tool
- `researcher-proxy`: external CLI and custom MCP proxy

다른 Host는 native collaboration 기능에 동일 RESEARCH BRIEF를 전달합니다.

## 6. 설정과 호환

`skills/orchestrate/references/config-reference.md`가 설정의 단일 기준입니다.
v0.7 이하의 build, coder/reviewer, `write: true`, `workspace-write` 설정은
실행 의미가 없으며 runner가 거부합니다. 알 수 없는 과거 키는 setup 병합에서
보존될 수 있지만 활성화되지 않습니다.

## 7. 패키징

- `.claude-plugin`: Claude Code/Cowork marketplace
- `.mcp.json`: Claude Host에 read-only 기본값의 Codex MCP 등록
- `.codex-plugin`: Codex plugin manifest
- `.agents/plugins/marketplace.json`: Codex GitHub marketplace entry
- `skills/`: Host-neutral research workflow
- `agents/`: researcher profiles and proxies
- `scripts/`: read-only provider runner and adapters
