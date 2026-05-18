# App Store Connect Content Drafts

Submission-day copy for every App Store Connect field. Drafts pinned here so day-of submission is paste-only. Tone is intentionally functional rather than aspirational. Marketing polish is open to the user; treat each section as a starting point, not a final.

Char counts include spaces, measured against Apple's hard limits.

## App name

- **Field**: App name (30 chars max, primary language)
- **Draft (KR primary)**: `IronSpot` (8 chars)
- **Rationale**: bundle id is `com.ironspot.app`, app.json `name: "IronSpot"`, brand already consistent across login screen + privacy policy. No need to localise.

## Subtitle

- **Field**: Subtitle (30 chars max)
- **Draft (KR)**: `내 주변 헬스장 머신 검색` (14 chars)
- **Alternative (KR)**: `헬스장 머신 사진과 정보` (13 chars)
- **Alternative (KR)**: `내 주변 헬스장의 머신과 사진` (16 chars)
- **Pick rationale**: first option leads with the core verb (검색) and the value prop (내 주변 + 머신). Subtitle is a Search ranking input on iOS so verbs matter.

## Promotional text

- **Field**: Promotional text (170 chars max, editable post-launch without resubmission)
- **Draft (KR)** (167 chars):

```
헬스장 갈 때마다 어떤 머신이 있을지 궁금하지 않으셨나요? IronSpot은 내 주변 헬스장의 머신 정보와 사진을 보여줍니다. 출장이나 여행 중 임시 헬스장을 찾을 때, 특정 머신 (예: 파나타 하이로우)을 보유한 헬스장을 찾을 때 유용합니다.
```

- **Rationale**: hook question + 두 사용 시나리오. 자연어 검색 같은 고급 기능은 description 본문으로 미룸. 본 필드는 post-launch에 자주 갈아끼울 수 있어서 시즌성 메시지에도 적합.

## Description

- **Field**: Description (4000 chars max, primary language locked at submission, additional locales settable)
- **Draft (KR)** (1700 chars):

```
IronSpot은 내 주변 헬스장에 어떤 운동기구가 있는지 보여주는 앱입니다.

[주요 기능]

* 지도로 헬스장 찾기 — 현재 위치 또는 검색한 지역 주변의 헬스장을 지도에 표시합니다. 마커를 누르면 헬스장 상세 정보와 보유 머신 목록을 볼 수 있습니다.

* 머신으로 필터링 — 운동 부위 (가슴/등/다리/어깨/팔), 브랜드 (Panatta, Hammer Strength, Technogym, 그 외), 머신 종류 (Chest Press, Seated Row, Smith Machine 등)로 헬스장을 좁힐 수 있습니다. 두 개 이상 선택 시 AND 조건도 지원합니다.

* 사진으로 머신 확인 — 다른 사용자가 올린 머신 사진을 통해 실제 보유 여부와 상태를 확인할 수 있습니다. 사용자가 직접 사진을 업로드해 다른 이용자에게 도움을 줄 수도 있습니다.

* 자연어 검색 — "강남역 파나타 하이로우 있는 헬스장", "1km 안에 케이블 크로스오버 있는 곳" 같은 자연스러운 한국어 질문으로 검색할 수 있습니다.

* 음성 입력 — 검색창 옆 마이크 버튼으로 음성으로도 검색할 수 있습니다. 운동 중에 휴대폰을 들고 타이핑하기 번거로울 때 유용합니다.

[안전과 정확성]

* 사용자가 올린 사진에 얼굴이 인식되면 자동으로 업로드를 거부합니다 (개인정보보호법 준수).
* 잘못된 머신 정보나 부적절한 사진은 신고할 수 있으며, 운영자가 검토 후 처리합니다.
* 헬스장 운영자는 직접 자신의 헬스장 머신 정보를 관리하고, 업로드된 사진을 검증할 수 있습니다.

[향후 계획]

* 한국 출시 이후 영어 지원 + 다른 국가 확대 예정
* 푸시 알림, 다크 모드 등 사용자 피드백 기반 추가 예정

문의: yyou017@gmail.com
개인정보처리방침: https://yjwhy.github.io/ironspot/privacy-policy.ko.html
이용약관: https://yjwhy.github.io/ironspot/terms-of-service.ko.html
```

- **Rationale**: 5개의 [bracketed] 섹션. 첫 4개가 기능, 나머지가 신뢰 + 로드맵 + 연락처. Korean-only 명시 (App Review에서 reject 리스크 회피).
- **Open**: EN description은 한국 출시 이후에 추가 (Apple은 primary language만 강제). 영어 description은 별도 PR로 추가 가능.

## Keywords

- **Field**: Keywords (100 chars max, comma-separated, **no spaces**)
- **Draft (KR)** (97 chars):

```
헬스장,머신,운동기구,파나타,핀로딩,플레이트,헬스,피트니스,gym,fitness,equipment,헬스장찾기,머신찾기
```

- **Rationale**: 영문 키워드 (gym/fitness/equipment) 도 같이 들어가야 Spotlight + 영문 검색에서 잡힘. 브랜드명 (Panatta) 은 fair use 가능한 한도에서 1개만. 카테고리 (가슴/등) 는 description에 있고 keywords는 brand-agnostic 차별점에 우선 할당.

## Categories

- **Primary**: `Health & Fitness`
- **Secondary**: `Lifestyle`
- **Rationale**: 1차는 명확. 2차는 Sports vs Lifestyle 사이 갈리는데 Lifestyle이 검색 노출이 넓음 (운동 외에 "내 동네" 류 검색 잡힘). Sports는 스포츠 경기/리그/팀 중심이라 잘 안 맞음.

## Age rating

- **Field**: Age Rating questionnaire (다단계 질문)
- **Expected outcome**: `12+`
- **Why**: User Generated Content 항목 (사용자가 사진/리포트 업로드) 에서 "Infrequent/Mild" 선택 시 자동으로 12+ 됨. Phase 4 Task 42 (face PII rejection) + Task 33/34 (admin moderation + auto-ban) 가 "Moderate"로 escalate 되는 걸 막음.
- **Confirm at submission**: 다른 escalation 항목 (Violence/Drugs/Gambling/Sexual content) 전부 None.

## App Store Connect URLs

- **Privacy Policy URL**: `https://yjwhy.github.io/ironspot/privacy-policy.ko.html`
- **Terms of Use URL** (선택): `https://yjwhy.github.io/ironspot/terms-of-service.ko.html`
- **Support URL** (필수): `https://yjwhy.github.io/ironspot/`
- **Marketing URL** (선택): same as Support URL or skip
- **Copyright**: `(C) 2026 YJ You`
- **App Review contact email**: `yyou017@gmail.com`
- **App Review phone number**: optional, skip unless requested

## Screenshots plan

iPhone 6.7" (1290x2796) 기준 3장 ~ 10장. Apple은 첫 3장만 검색 결과에 노출하므로 첫 3장에 가장 강한 메시지.

### 권장 6장 (Phase 4 기능 셋 반영)

1. **Map screen** with gym markers in Seoul. 줌 레벨은 강남역 ±1km 정도. 5개 이상 핀이 보이도록. Caption overlay 후보: "내 주변 헬스장을 한 눈에"
2. **Gym detail bottom sheet** with machine list. 매치된 머신 (예: "Panatta High Row · 핀") 가 prefix로 보이도록. Caption: "보유 머신과 사진까지"
3. **NL search result with interpretation chip**. Search bar에 "강남역 파나타 하이로우 있는 헬스장" 입력 후 결과. Caption: "자연어로 검색하기"
4. **Filter sheet** with 운동 부위 + 브랜드 + 머신 sections expanded. Active filter chip 1~2개 보이도록. Caption: "원하는 조건으로 좁히기"
5. **Photo gallery** for a specific machine. Caption: "사진으로 실제 확인"
6. **Voice search** mid-recording. Mic button highlighted. Caption: "운동 중에도 음성으로"

### 캡처 절차 (submission day)

1. EAS preview build on iPhone 15 Pro Max simulator (iOS 18+, 1290x2796 native)
2. Features > Location > Custom → 강남역 좌표 입력 (37.4979, 127.0276)
3. Maestro 또는 manual driving으로 각 화면 도달
4. `xcrun simctl io booted screenshot ~/Desktop/screenshot-<N>.png`
5. (선택) [Marketing tool](https://www.appscreens.com/) 또는 Figma로 caption overlay 추가

### 다른 디바이스 사이즈

- iPhone 6.5" (1242x2688): 필요 시 추가, Apple은 6.7"만 있어도 자동 다운스케일
- iPad: `ios.supportsTablet=false` (`app.json`) 이라 불필요

## App Preview videos

- **Recommendation**: skip for v1. 비디오 제작 비용 vs 효과 비대칭, 출시 후 retention 데이터 보고 결정 (Phase 5 item 7 PostHog와 함께).

## App Icon

- **Field**: 1024x1024 PNG, no alpha channel, no rounded corners (Apple adds them)
- **Current**: `assets/icon.png` (Expo가 빌드 시 자동 리사이즈)
- **Submission day check**:
  - `sips -g pixelWidth -g pixelHeight assets/icon.png` → 1024x1024 확인
  - `sips -g hasAlpha assets/icon.png` → no
  - 모서리에 자체 라운드 처리가 없는지 시각 확인
- **Decision deferred**: 현재 아이콘이 v1으로 적절한지는 시각적 판단. 변경 필요 시 별도 디자인 작업 (Phase 5 후보).

## App Privacy questionnaire

Section 5.1.1 declarations (already in `pre-submission-checklist.md` Section 5):

- **Contact Info > Email Address**: linked to user identity (auth via OAuth)
- **User Content > Photos**: linked to user identity (uploaded photos)
- **User Content > Other User Content**: linked to user identity (NL search queries, reports)
- **Identifiers > User ID**: linked to user identity
- **Diagnostics > Crash Data**: not linked (Sentry uses anonymised user IDs)
- **Diagnostics > Performance Data**: not linked
- **Location > Precise Location**: linked to user identity (used for search proximity)
- **Location > Coarse Location**: linked to user identity (fallback when Precise denied)

Each category: data used for App Functionality only. No tracking, no third-party advertising, no data sold.

## Pricing and availability

- **Price**: Free (no IAP, no subscription)
- **Availability**: 대한민국 (Republic of Korea) only at launch
- **Volume Purchase Program**: skip
- **App Distribution Methods**: App Store only

## Open decisions for submission day

1. **App icon refresh** yes/no (현재 `assets/icon.png` 사용 시각 판단)
2. **EN description** include / defer (default: defer, Korean-only 출시 명확하게 표시)
3. **App Preview video** include / skip (default: skip per recommendation above)
4. **Marketing URL** include / skip (default: skip, Support URL이 동일하면 중복)
5. **Subtitle** 옵션 1/2/3 중 선택 (default: 옵션 1 `내 주변 헬스장 머신 검색`)
6. **Promotional text** 시즌성 메시지로 갈아끼울지 (default: draft as-is)

## Related documents

- `docs/launch/pre-submission-checklist.md` for the full submission audit
- `docs/legal/privacy-policy.ko.md` for the canonical legal copy referenced in description
- `docs/plans/phase-5/README.md` for post-launch items mentioned in description (PostHog analytics, dark mode, push)
