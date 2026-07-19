# Host-native · 외부 CLI Provider 런타임

model-council은 read-only 리서치 실행 주체를 두 계층으로 구분한다.

- **Host**: 현재 대화를 소유하고 PLAN·REVIEW·SYNTHESIZE를 수행한다.
- **Host-native researcher**: Host가 자체 서브에이전트 기능으로 생성한다.
- **External researcher**: 별도 CLI 또는 MCP 세션으로 호출한다. vendor가
  Host와 다를 때 독립 교차검증 1표로 센다.

같은 vendor의 외부 provider를 제외하더라도 Host-native researcher는 계속
사용할 수 있다. 모델 이름만으로 Host vendor를 추측하지 않는다.

## CLI runner

```bash
node scripts/council-cli-runner.mjs probe
node scripts/council-cli-runner.mjs route --host-vendor <vendor>
node scripts/council-cli-runner.mjs run --provider <provider> \
  --role researcher --cwd <dir> --access read-only --tier <tier>
node scripts/council-cli-runner.mjs continue --provider <provider> \
  --session-id <id> --role researcher --cwd <dir> --access read-only --tier <tier>
```

`run`과 `continue` prompt는 stdin으로 전달한다. Antigravity는 runner가 shell
없이 인자 배열로 전달한다. `--dry-run`은 실제 호출 없이 command shape와
권한을 검사한다.

지원 역할은 `researcher`, 지원 access는 `read-only` 하나뿐이다. 다른 역할과
`workspace-write`는 runner가 실행 전에 거부한다. Codex와 Claude Code는
read-only를 CLI 권한으로 제한한다. Antigravity는 prompt+sandbox 수준이므로
완전한 기술적 차단으로 주장하지 않는다.

## 인증과 라우팅

- version probe는 OAuth 성공을 보장하지 않으므로 실제 read-only smoke로
  확인한다.
- 플러그인은 Host sandbox를 완화하거나 인증정보를 받지 않는다.
- model ID는 사용자 제공, allowlist, probe 확인값만 전달한다.
- 서로 다른 vendor 둘을 우선하고, 없으면 Host-native 세션을 추가하되
  `독립성 약화`를 기록한다.
- 같은 vendor 외부 CLI를 명시적으로 허용해도 독립 vendor 수는 늘지 않는다.
- `status != completed`는 성공이 아니다.

## 실행 안전

- 프롬프트를 셸 문자열에 보간하지 않는다.
- 위험한 bypass 또는 YOLO 플래그를 사용하지 않는다.
- 모든 researcher에게 파일 수정 금지를 명시한다.
- 세션 재개가 불가능하면 이전 결과 요약과 후속 질문으로 새 read-only
  세션을 실행한다.
- 개발, 코드 수정, 마이그레이션, 인프라 변경은 이 runtime의 책임이 아니다.
  해당 작업은 `document-driven-development`를 사용한다.
