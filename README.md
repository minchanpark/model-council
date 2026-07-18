# model-council

멀티모델 리서치·개발 오케스트레이터 플러그인 — 메인 오케스트레이터는 호스트의 Claude로 유지하고, Claude·Codex 등 서브 에이전트의 모델과 추론 강도는 설정·작업 난이도에 따라 해석합니다. 병렬 리서치/구현 뒤 초기 계획 기준으로 심사·통합합니다. 기본 구성은 구독 OAuth를 사용합니다. 스킬: `/orchestrate`(리서치) · `/build`(개발) · `/council-setup`(프로바이더 설정).

상세 문서: [PLUGIN.md](./PLUGIN.md) · 이 레포는 플러그인(루트)이자 팀 마켓플레이스(newdawn-plugins)입니다.

Claude 플러그인 마켓플레이스.

## 설치 (팀원용, 1회)

**전제**: 터미널에서 `npm i -g @openai/codex@latest && codex login` (본인 ChatGPT 계정 OAuth)

**Claude Code**
```
/plugin marketplace add https://github.com/minchanpark/model-council.git
/plugin install model-council@newdawn-plugins
```

**Cowork (데스크탑 앱)**
설정 > 기능(Capabilities) > 플러그인 > 마켓플레이스 추가 → https://github.com/minchanpark/model-council 입력 → model-council 설치

**설치 후**: 채팅에서 "council setup 해줘" 실행 → 프로바이더 감지·편성 저장.

## 수록 플러그인

| 플러그인 | 버전 | 설명 |
|---|---|---|
| model-council | 0.5.0 | 멀티모델 리서치(/orchestrate)·개발(/build) 오케스트레이터 + 프로바이더 셋업(/council-setup) · v0.5: 루프 엔지니어링(상태 파일·평결 루프·자가 채점) |

## 업데이트 배포 (관리자)

플러그인 소스 수정 → `.claude-plugin/plugin.json`과 `.claude-plugin/marketplace.json`의 플러그인 version 동기화 → commit & push. 팀원은 `/plugin marketplace update`(Code) 또는 앱에서 업데이트.
