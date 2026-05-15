export const RECENT_HISTORY_MAX = 10;

export const MIC_SILENCE_TIMEOUT_MS = 1000;

// Hard cap protects against the "silent input" failure mode where partial
// results never arrive (mic blocked, ambient noise too low for the endpointer
// to detect speech onset). Without it, recognizer stays open until the iOS
// 60s system limit. 8s matches user patience while leaving room for slow
// starters who pause before speaking.
export const MIC_HARD_CAP_TIMEOUT_MS = 8000;

export const EXAMPLE_QUERIES = [
  '강남역 1km 안 파나타 머신 3개',
  '내 위치 500m 안 케이블 머신 있는 곳',
  '테크노짐 + 프라임 둘 다 있는 헬스장',
] as const;
