# newdawn-plugins

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
| model-council | 0.3.0 | 멀티모델 리서치(/orchestrate)·개발(/build) 오케스트레이터 + 프로바이더 셋업(/council-setup) |

## 업데이트 배포 (관리자)

플러그인 소스 수정 → `plugins/model-council/.claude-plugin/plugin.json`과 이 레포 `marketplace.json`의 version 동기화 → commit & push. 팀원은 `/plugin marketplace update`(Code) 또는 앱에서 업데이트.
