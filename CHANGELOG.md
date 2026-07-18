# Changelog

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
