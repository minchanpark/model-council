# Changelog

## 0.8.0 — 2026-07-19

- **research-only 책임 분리**: `/build`, coder, reviewer agent를 제거하고
  `/orchestrate`, `/council-setup`, `/council-retro`만 유지했다.
- **쓰기 권한 제거**: provider runner가 `researcher`와 `read-only`만 허용하며
  `workspace-write`와 개발 역할을 실행 전에 거부한다. 모든 adapter의
  `workspaceWrite` capability를 false로 고정했다.
- **DDD 이관**: locked-plan debate, package decomposition, isolated
  implementation, cross-review, fix/escalation, green integration 흐름은
  `document-driven-development`로 독립 이식했다.
- **main marketplace**: Claude와 Codex용 GitHub marketplace가 모두 main을
  가리키도록 정리했다.
- **호환**: 과거 config의 build/write 키는 보존될 수 있지만 v0.8 runtime에서
  무시되며 활성화되지 않는다.

## 0.7.0-beta.1 — 2026-07-19

- **Host 일반화**: 메인 오케스트레이터를 Claude로 고정하지 않고 Codex/GPT, Claude, Antigravity, 기타 Host로 추상화했다.
- **native/external 분리**: Host-native agent pool과 외부 CLI/MCP provider pool을 분리했다. same-vendor 제외는 외부 provider에만 적용되어 Codex Host의 Codex subagent, Claude Host의 Claude Agent는 계속 병렬 생성할 수 있다.
- **CLI adapter runtime**: `scripts/council-cli-runner.mjs`와 Codex CLI, Claude Code CLI, Antigravity CLI adapter를 추가했다. probe, Host vendor별 route, read-only/workspace-write, model/effort, session resume, dry-run, 공통 JSON 결과를 지원한다.
- **provider routing**: Codex Host는 외부 Claude Code·Antigravity, Claude Host는 외부 Codex·Antigravity를 기본 후보로 사용한다. 같은 vendor의 외부 CLI는 명시적 예외로만 허용하고 독립 vendor 수를 늘리지 않는다.
- **스킬·프록시 갱신**: `/orchestrate`, `/build`, `/council-setup`, 범용 researcher/coder proxy와 config reference를 Host-neutral 구조로 개편했다.
- **Codex 패키징**: 기존 `.claude-plugin`을 유지하면서 `.codex-plugin/plugin.json`을 추가했다. 별도 공통 코어 패키지는 만들지 않았다.
- **제약 명시**: Antigravity CLI의 plain-text 출력, 제한적 자동 resume, 강제되지 않는 read-only를 경고와 문서에 반영했다.
- **Codex read-only Host 호환**: runner의 불필요한 임시 디렉터리 생성을 제거하고 Codex JSONL에서 결과를 직접 추출해, 바깥 Host sandbox가 파일 생성을 막아도 외부 Claude Code·Antigravity CLI를 호출할 수 있게 했다.

## 0.6.1 — 2026-07-18

- **입장 배정 (stance steering)**: 판단형 트랙의 듀얼 편성에서 리서처별 입장(찬성/반대/중립)을 오케스트레이터가 명시 배정 — 관점 수렴(같은 오답 동의)을 구조적으로 방지. 사실확인형 트랙은 배정 금지(근거 왜곡 방지). 같은 프로바이더 단독 편성 시 우선 적용. 배정표에 `입장` 열 추가, 브리프 "당신의 관점"에 입장 줄. critique 모드에 공격/스틸맨 분담 옵션. rubric에 판정 안전장치 추가(입장은 논거 생성 장치 — 판정은 논거의 질로만, 배정 입장과 반대로 기운 결론은 강한 신호). zen-mcp consensus의 검증된 패턴을 지시문으로 번안. 인라인 지시 항상 우선.

## 0.6.0 — 2026-07-18

루프 엔지니어링 2단계 (설계: 「model-council 개선안 최종」 P1). build 객관 신호 강화 + 스킬 자기개선 루프 신설.

- **P1-4 통합 검증 green 게이트**: build 최종 통합 검증에 실패 간선 신설 — 실패를 파일 소유권으로 패키지에 귀속 → 소유 코더 수정 → 재실행, green 또는 캡(`loops.build.integration.max_fix_iterations` 기본 2) 소진 시 하드 게이트. 귀속 불가 시 즉시 하드 게이트 승격. `gate: report_only`(Bash 미지원 환경) 폴백. 최종 보고에 `integration:` 표기.
- **P1-5 검증 명령**: WORK PACKAGE에 `## 검증 명령` 필드 신설(완료를 판별하는 실행 명령 ≥1, 형식적 명령 금지). 리뷰어는 검증 명령이 있으면 **실행이 기본**(코더의 "테스트 통과" 주장을 말로만 신뢰하지 않음). reviewer-claude 정의에 반영.
- **P1-6 에스컬레이션 사다리**: 정체(재질의·수정 루프에서 진전 없음) 시 남은 캡을 같은 조건으로 소진하지 않고 상향 — `retry_same → tier_up → switch_provider → human_gate`(`loops.escalation`, orchestrate·build 공용). Codex 미연결 시 다른 Claude 프로필로 대체하고 독립성 약화 명시.
- **P1-7 `/council-retro` 스킬 신설**: 누적된 council-state 파일을 읽어 반복 마찰을 채굴하고 스킬 문서 편집안을 제안·스테이징하는 회고 루프(LOAD→HARVEST→MINE→PROPOSE→STAGE). SkillOpt 규율 번안 — 편집 예산(런당 ≤3건·순증 토큰 0 목표), 검증 게이트(사람 PR+사후 지표), 기각 편집 버퍼, 느린 업데이트(구조 변경은 ≥5런 근거). **스킬 파일 직접 수정 금지 — 제안 원장만 작성, 채택은 사람+git.** 자기 완화(캡 상향·게이트 완화 등) 제안 자동 플래그·격리.
- **config v0.6**: `loops`에 `build.integration`, `build.tests`, `escalation`, `retro` 블록 추가.
- **문서**: README/PLUGIN에 v0.6 반영 + **세션 중 플러그인 갱신 시 재로드 안내**(하네스가 스킬 정의를 캐시하므로 마켓플레이스 업데이트 후 앱/세션 재시작 필요).

## 0.5.0 — 2026-07-18

루프 엔지니어링 1단계 (설계: 「model-council 개선안 최종」 P0). 원칙: 모든 반복에 캡 · 사람 게이트 불가침 · 스킬 수정은 사람+git.

- **P0-1 상태 파일**: 모든 실행이 작업 폴더에 `council-state-{run}.md`를 생성하고 페이즈마다 재독·갱신한다 (성공 기준 동결·래칫, 블라인드 사전 평결, 디스패치 원장, 평결표, 루프 로그, 마찰 기록). 세션 기억과 충돌 시 파일 우선. `loops.state_file: false`로 끌 수 있음. orchestrate·build 공통.
- **P0-2 평결 루프**: 성공 기준을 `C{n} | 이진 판정 문장 | 판정 방법` 형식으로 강제하고, REVIEW에서 기준 ID × 트랙 평결표를 작성. 재질의가 "최대 1회 고정"에서 **충족(미충족 critical 0) / 정체(진전 없음) / 캡(기본 2)** 3중 종료 조건의 루프로 변경. 종료 사유를 state 파일과 `council:` 라인에 기록. 캡·정체 종료된 미충족 기준의 결론은 확신도 강등 + "미검증" 라벨.
- **P0-3 자가 채점표**: researcher 계열(claude·codex·proxy) 반환 형식에 `## 성공 기준 자가 채점`(근거 포인터 필수) + 미충족 항목 내부 보강 1회. 자가 채점은 사전 필터일 뿐 오케스트레이터 최종 판정을 대체하지 않음. coder 계열은 자체 검증에 실행 명령·결과 요약 의무.
- **P0-4 명세 공백 보수**: 수정본은 같은 리뷰어에게 재제출·fix 카운트는 패키지 단위(#2) · 리뷰어 반려 사유에 severity(Critical/Major/Minor) 도입, 하드 게이트의 Critical 정의 명확화(#3) · critical 이중 구현의 격리(별도 브랜치/사본)와 패자 diff 폐기 절차(#4) · 트랙 부분 실패 시 1회 재스폰 후 축소 진행(#6) · critique/consensus 모드에도 상태 파일·사전 평결·평결표 적용 명시(#8) · 수정 루프 정체(동일 지적 2회) 시 조기 하드 게이트 이행.
- **config v0.5**: `loops` 블록 신설 (`state_file`, `research.followups.{policy, progress_required, max_rounds, per_track_max}`). 구 `max_followups`는 `loops.research.followups.max_rounds`의 별칭으로 해석 (하위 호환).
- **문서 위생**: effort 폴백 규칙을 config-reference 단일 출처로 통일 (PLUGIN.md 트러블슈팅은 링크).

## 0.4.2 이하

git 히스토리 참조.
