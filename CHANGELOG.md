# Changelog

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
