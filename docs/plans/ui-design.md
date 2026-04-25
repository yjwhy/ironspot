# IronSpot UI Design

- Version: 2.0
- Date: 2026-04-17
- Author: YJ (builtByYJ)

## 1. Design Tokens

### Color Palette

```
[Primary / Accent]
accent-DEFAULT:  #F59E0B  (amber-500)  — CTA buttons, active filters, selected states
accent-light:    #FCD34D  (amber-300)  — hover/focus backgrounds, badges
accent-dark:     #D97706  (amber-600)  — pressed state, active tab indicator
accent-50:       #FFFBEB             — subtle tinted backgrounds (brand chips, highlights)

[Text]
text-primary:    #0F172A  (slate-900)  — headings, primary content
text-secondary:  #475569  (slate-600)  — descriptions, metadata
text-tertiary:   #94A3B8  (slate-400)  — placeholders, timestamps, disabled
text-inverse:    #FFFFFF              — text on accent/dark backgrounds

[Background]
bg-base:         #FFFFFF              — main background
bg-elevated:     #FFFFFF              — cards, bottom sheet (with shadow for separation)
bg-subtle:       #F8FAFC  (slate-50)  — section backgrounds, skeleton base
bg-muted:        #F1F5F9  (slate-100) — input fields, inactive chips, divider areas

[Border]
border-default:  #E2E8F0  (slate-200) — card borders, dividers
border-subtle:   #F1F5F9  (slate-100) — light separators
border-focus:    #F59E0B  (amber-500) — focused input border

[Semantic]
success:         #22C55E  (green-500) — verified badge, upload complete
error:           #EF4444  (red-500)   — report button, error states, delete
warning:         #F59E0B  (amber-500) — reuses accent (stale data indicator)
info:            #3B82F6  (blue-500)  — tips, helper text

[Map Specific]
marker-default:  #F59E0B  (amber-500) — gym markers
marker-selected: #D97706  (amber-600) — selected marker (larger + darker)
marker-badge:    #FFFFFF              — count text on marker
```

### Typography

```
Font Family: Pretendard
Fallback: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif

[Scale]                    Size   Weight   Line Height   Usage
display:                   28px   700      1.2           — (unused in app, reserved)
heading-lg:                22px   700      1.3           — gym name in detail view
heading-md:                18px   600      1.3           — section headers, screen titles
heading-sm:                16px   600      1.4           — brand group headers, card titles
body:                      15px   400      1.5           — primary content, descriptions
body-sm:                   13px   400      1.5           — metadata, secondary info
caption:                   11px   500      1.4           — timestamps, badges, filter chips
```

### Spacing

```
4px base unit (Tailwind default):
xs:    4px   (p-1)   — icon inner padding
sm:    8px   (p-2)   — chip padding, tight gaps
md:    12px  (p-3)   — card inner padding, list item gap
lg:    16px  (p-4)   — section padding, card padding
xl:    24px  (p-6)   — section gaps, screen horizontal margin
2xl:   32px  (p-8)   — major section separators
3xl:   48px  (p-12)  — screen top/bottom safe padding
```

### Border Radius

```
sm:    8px   (rounded-lg)    — input fields, chips
md:    12px  (rounded-xl)    — buttons, small cards
lg:    16px  (rounded-2xl)   — cards, bottom sheet, photo thumbnails
xl:    24px  (rounded-3xl)   — FAB button, modals
full:  9999px (rounded-full) — filter chips, avatar, circular buttons
```

### Shadows

```
sm:    0 1px 2px rgba(0,0,0,0.05)              — subtle lift (chips, inputs)
md:    0 4px 6px -1px rgba(0,0,0,0.07)         — cards, gym cards
lg:    0 10px 15px -3px rgba(0,0,0,0.08)        — bottom sheet, floating buttons
xl:    0 20px 25px -5px rgba(0,0,0,0.10)        — modals, overlays
```

### Touch Targets

```
Minimum: 44 x 44pt (iOS) / 48 x 48dp (Android)
Button height: 48px minimum
Input height: 48px minimum
Filter chip height: 36px (with hitSlop extending to 44px)
Tab bar icon: 24px icon + 44px tap area
```

### Design Direction

- **Theme:** Light minimal (white base + clean cards + amber accent)
- **Pattern:** Map-centric + Bottom Sheet (Naver Maps/KakaoMap style)
- **Density:** Comfortable (not cramped) — utility app, quick scanning
- **Dark Mode:** Future addition (system theme support)

## 2. Navigation Structure

**Bottom Tab Navigation (2 tabs):**

```
[Tab 1: Map]        [Tab 2: My Page]
```

- Map tab = main experience (map + search + browse)
- My Page tab = profile, uploads, votes, settings
- Bottom tab always visible (except during full-screen overlays: photo detail, upload flow, NL search)

**Why 2 tabs (not more):**

- Phase 1 has only map functionality, 1 tab is enough
- Phase 2 adds My Page, 2 tabs
- Keeps it minimal. More tabs = more cognitive load for a focused utility app

## 3. Screen Map

| Screen                 | Phase | Type          | Description                                            |
| ---------------------- | ----- | ------------- | ------------------------------------------------------ |
| Splash                 | 1     | Launch        | App logo + amber gradient, auto-dismiss after load     |
| Location Permission    | 1     | Modal         | Pre-permission prompt before system dialog             |
| Main Map               | 1     | Tab (Map)     | Map + filter chips + "Search this area" + Bottom Sheet |
| Bottom Sheet (list)    | 1     | Sheet         | Gym cards with distance, brand summary, thumbnail      |
| Bottom Sheet (detail)  | 1     | Sheet         | Gym info + machines grouped by brand                   |
| Photo Gallery          | 1     | Stack         | Best cut pinned + grid view + upload date              |
| Photo Detail           | 1     | Full-screen   | Full photo + upvote + report                           |
| Login                  | 2     | Stack         | Social login (Google/Kakao) + browse without login     |
| Photo Upload (3 steps) | 2     | Stack         | Gym select -> photo -> OCR confirm                     |
| My Page                | 2     | Tab (My Page) | My photos, my votes, settings, account                 |
| Account Settings       | 2     | Stack         | Edit nickname, delete account                          |
| NL Search              | 3     | Full-screen   | Search with examples + recent history                  |

## 4. Splash Screen

```
+------------------------------------------+
|                                          |
|                                          |
|                                          |
|           🔶 IronSpot                    |
|                                          |
|                                          |
|                                          |
+------------------------------------------+
```

- Amber gradient background (light amber -> white)
- App logo centered
- Auto-dismiss when app is ready (data loaded, location obtained or defaulted)
- No manual interaction needed
- Duration: max 2 seconds (if app loads faster, dismiss immediately)

## 5. Main Map Screen

```
+------------------------------------------+
|  [Top Bar]                               |
|  +--------------------------------------+|
|  | Search bar (placeholder text)        ||
|  +--------------------------------------+|
|  | [Brand] [Category] [Loading] (chips) ||
|  +--------------------------------------+|
|                                          |
|              [Map Area]                  |
|          Markers with machine count      |
|                                          |
|     +--[Search this area]--+            |
|                                          |
|  +--------------------------------------+|
|  | [Bottom Sheet - collapsed]           ||
|  | "12 gyms nearby"            handle   ||
|  +--------------------------------------+|
+------------------------------------------+
```

- Filter chips: horizontal scroll, orange/amber when active
- Map markers: show matching machine count per gym
- No auto-search on map move -> "Search this area" button only (API cost $0)
- Phase 1-2: search bar opens filter screen
- Phase 3: search bar accepts natural language input

## 6. Bottom Sheet States

### Collapsed (default)

```
+--------------------------------------+
| "12 gyms nearby"            handle   |
+--------------------------------------+
```

### Half expanded (gym list)

```
+--------------------------------------+
|                handle                |
|                                      |
| +----------------------------------+ |
| | Fitness Factory          0.3km   | |
| | Panatta 4  Hammer 2  Life 3     | |
| | [Best photo thumbnail]          | |
| +----------------------------------+ |
| +----------------------------------+ |
| | Strength Gym             0.7km   | |
| | Panatta 7  Technogym 5         | |
| | [Best photo thumbnail]          | |
| +----------------------------------+ |
|              ...                     |
+--------------------------------------+
```

- Gym card: name, distance, brand summary chips, best photo thumbnail
- Sorted by distance from current location

### Fully expanded (gym detail)

```
+--------------------------------------+
|  <-  Fitness Factory         handle  |
|  Seoul Gangnam-gu Yeoksam 123-4     |
|  Last verified: 2026.03.15          |
|                                      |
|  [Machines by Brand]                 |
|  +- Panatta --------------------+   |
|  | * High Row            photo 3 |   |
|  | * Low Row             photo 5 |   |
|  | * Chest Press         photo 2 |   |
|  +-------------------------------+   |
|  +- Hammer Strength -------------+   |
|  | * Lat Pull Down       photo 4 |   |
|  | * Seated Row          photo 1 |   |
|  +-------------------------------+   |
+--------------------------------------+
```

- last_verified_at displayed as freshness indicator
- Machines grouped by brand (1st level), sorted by category within brand (2nd level)
- Each machine row: name + quantity badge (if >1, show "x2") + photo count -> tap for gallery
- Quantity badge only shown when quantity >= 2 (single machine = no badge, cleaner)

> Note: this mockup is a design target, not a snapshot of current seed data. As of 2026-04-25, Fitness Factory's seed has two repointed gym_machine rows (`Panatta Low Row` and `Hammer Strength Lat Pull Down` were both repointed to a new `Hammer Strength Low Row` template by `docs/plans/phase-1/task-5-seed-photos.sql`). Other rows in this mockup are illustrative.

## 7. Photo Gallery

```
+------------------------------------------+
|  <-  Panatta High Row                    |
|  Fitness Factory                         |
|                                          |
|  [Best Cut - large display]              |
|  +--------------------------------------+|
|  |                                      ||
|  |        (Top voted photo)             ||
|  |                                      ||
|  |  heart 12    Shot: 2026.03.10        ||
|  +--------------------------------------+|
|                                          |
|  [All Photos - grid]                     |
|  +--------+  +--------+  +--------+     |
|  |        |  |        |  |        |     |
|  | heart 8|  | heart 5|  | heart 3|     |
|  +--------+  +--------+  +--------+     |
|  +--------+  +--------+                 |
|  |        |  |        |                 |
|  | heart 2|  | heart 1|                 |
|  +--------+  +--------+                 |
|                                          |
|       [Add Photo]  (FAB button)          |
+------------------------------------------+
```

- Best cut (highest upvotes) displayed large at top
- Remaining photos in grid (newest first)
- Each photo shows: upvote count, upload date
- FAB button: "Add photo" (Phase 2, requires login)

### Photo Detail (on tap)

```
+------------------------------------------+
|  <-                          Flag/Report |
|                                          |
|  +--------------------------------------+|
|  |                                      ||
|  |         (Full photo view)            ||
|  |      pinch to zoom supported         ||
|  +--------------------------------------+|
|                                          |
|  heart Upvote 12       Uploaded 2026.03.10|
|  By: GymFanatic123                       |
+------------------------------------------+
```

- Pinch to zoom on photo
- Swipe left/right to navigate between photos of same machine
- Dark background (dimmed) to focus on photo
- Double-tap to zoom in/out

## 8. Login Screen (Phase 2)

```
+------------------------------------------+
|                                          |
|                                          |
|           IronSpot (logo)                |
|     "Find gym equipment near you"        |
|                                          |
|                                          |
|  +--------------------------------------+|
|  |   G  Continue with Google            ||
|  +--------------------------------------+|
|  +--------------------------------------+|
|  |   K  Continue with Kakao             ||
|  +--------------------------------------+|
|                                          |
|       Browse without login ->            |
|                                          |
+------------------------------------------+
```

- Social login only (no email/password — simpler implementation)
- "Browse without login" keeps Phase 1 read features accessible
- Login required only for: photo upload, upvote, report

## 9. Photo Upload Flow (Phase 2)

### Step 1: Select gym

```
+------------------------------------------+
|  <-  Upload Photo                        |
|                                          |
|  Which gym?                              |
|  +--------------------------------------+|
|  | Search gyms                          ||
|  +--------------------------------------+|
|                                          |
|  Nearby                                  |
|  +----------------------------------+    |
|  | Fitness Factory       0.3km      |    |
|  +----------------------------------+    |
|  | Strength Gym          0.7km      |    |
|  +----------------------------------+    |
+------------------------------------------+
```

### Step 2: Take/select photo

```
+------------------------------------------+
|  <-  Fitness Factory                     |
|                                          |
|  Take a photo of the machine            |
|  Brand logo visible = better detection   |
|                                          |
|  +--------------------------------------+|
|  |                                      ||
|  |          [Camera View]               ||
|  |                                      ||
|  +--------------------------------------+|
|                                          |
|  [Take Photo]       [Pick from Gallery]  |
+------------------------------------------+
```

### Step 3: OCR result + confirm

```
+------------------------------------------+
|  <-  Confirm Machine                     |
|                                          |
|  +--------------------------------------+|
|  |       (Photo preview)               ||
|  +--------------------------------------+|
|                                          |
|  Is this the machine?                    |
|                                          |
|  +----------------------------------+    |
|  | * Panatta High Row        check  |    |
|  +----------------------------------+    |
|  | o Panatta Low Row               |    |
|  +----------------------------------+    |
|  | o Enter manually                |    |
|  +----------------------------------+    |
|                                          |
|       [Register]  (orange CTA)           |
+------------------------------------------+
```

- 3-step flow: gym -> photo -> confirm
- Nearby gyms first (most users tap once)
- Gym not found path: search field → queries Naver Places API → user selects → auto-creates gym in our DB (is_verified: false)
- OCR processes in 1-3 sec (loading spinner)
- Top suggestion auto-selected
- "Enter manually" fallback (is_custom: true)

## 10. Natural Language Search (Phase 3)

### Search screen (full screen on tap)

```
+------------------------------------------+
|  <-  +----------------------------------+|
|      | Type your search                 ||
|      +----------------------------------+|
|                                          |
|  Try searching like this:                |
|                                          |
|  "Panatta 5+ within 1km"                |
|  "Plate loaded back machines in Gangnam" |
|  "Hammer Strength leg press nearby"      |
|                                          |
|  ---                                     |
|                                          |
|  Recent                                  |
|  "Yeoksam Panatta High Row"             |
|  "Seolleung Hammer Strength"            |
+------------------------------------------+
```

### Results (back to map)

```
+------------------------------------------+
|  +--------------------------------------+|
|  | "Panatta 5+ within 1km"      X      ||
|  +--------------------------------------+|
|  | Parsed: 1km radius, Panatta, 5+ ea  ||
|                                          |
|              [Map Area]                  |
|           marker    marker               |
|                 marker                   |
|                                          |
|  +--------------------------------------+|
|  | 3 gyms found                         ||
|  +--------------------------------------+|
+------------------------------------------+
```

- Example queries as tappable suggestions
- Recent search history
- Shows parsed interpretation below search bar
- X button to clear and re-search

## 11. My Page (Phase 2)

```
+------------------------------------------+
|  My Page                      [Tab 2]    |
|                                          |
|  👤 GymFanatic123                        |
|  가입일: 2026.03.01                      |
|                                          |
|  ─────────────────────────               |
|  📷 내가 올린 사진        12장 →         |
|  ♡ 내가 추천한 사진        8장 →         |
|  ─────────────────────────               |
|  ⚙ 계정 설정                    →       |
|  📤 로그아웃                              |
+------------------------------------------+
```

### Account Settings Screen

```
+------------------------------------------+
|  ←  계정 설정                            |
|                                          |
|  닉네임                                  |
|  +--------------------------------------+|
|  | GymFanatic123              [수정]    ||
|  +--------------------------------------+|
|                                          |
|  연결된 계정                              |
|  Google: yyou17@gmail.com               |
|                                          |
|  ─────────────────────────               |
|                                          |
|  [계정 삭제]  (빨간 텍스트, 하단 배치)    |
|                                          |
+------------------------------------------+
```

- 닉네임 수정: 인라인 수정 → PUT /api/users/me
- 계정 삭제: 확인 다이얼로그 → "30일 내 복구 가능" 안내 → DELETE /api/users/me
- 계정 삭제는 Apple App Store 필수 요구사항

## 12. Animation Design

### Library

- **react-native-reanimated** + **react-native-gesture-handler** (both included in Expo)
- Single library covers all animation needs

### Phase 1 Animations

| Element       | Animation                             | Implementation                                |
| ------------- | ------------------------------------- | --------------------------------------------- |
| Map markers   | Stagger entrance (sequential pop-in)  | `withDelay` + `withSpring` per marker         |
| Bottom Sheet  | Spring physics swipe                  | `react-native-gesture-handler` + `withSpring` |
| Filter chips  | Background color transition on select | `withTiming` on backgroundColor               |
| Gym cards     | Fade + slide up on list appear        | `FadeInUp` entering layout animation          |
| Photo gallery | Grid items stagger in                 | `withDelay` + `FadeIn`                        |

### Phase 2 Animations

| Element         | Animation                   | Implementation                              |
| --------------- | --------------------------- | ------------------------------------------- |
| OCR scan        | Scan line moving over photo | `withRepeat` + `withTiming` translateY      |
| Upload progress | Animated progress bar       | `withTiming` on width                       |
| Upload complete | Check mark draw animation   | SVG path animation with `withTiming`        |
| Photo expand    | Shared element transition   | `SharedTransition` (photo tap -> full view) |
| Upvote          | Heart scale bounce          | `withSequence` + `withSpring`               |

### Phase 3 Animations

| Element           | Animation                              | Implementation                            |
| ----------------- | -------------------------------------- | ----------------------------------------- |
| NL interpretation | Typing effect for parsed result        | `withTiming` on text width + cursor blink |
| Search transition | Old markers fade out -> new stagger in | `FadeOut` + `withDelay` + `FadeIn`        |
| Example queries   | Stagger fade in on search screen open  | `withDelay` + `FadeInDown`                |

### Screen Transitions

| From → To                   | Transition                            | Implementation               |
| --------------------------- | ------------------------------------- | ---------------------------- |
| Gym card → Gym detail       | Bottom Sheet expand (spring)          | Sheet snap point change      |
| Machine row → Photo gallery | Stack push (slide from right)         | React Navigation default     |
| Photo grid → Photo detail   | Hero/shared element (photo scales up) | `SharedTransition`           |
| Map → NL Search             | Full-screen slide up (modal)          | `presentationStyle: 'modal'` |
| Map → Upload flow           | Stack push                            | React Navigation             |
| Any → Login                 | Modal slide up                        | `presentationStyle: 'modal'` |

### Animation Principles

- Spring physics over linear timing (feels natural)
- Stagger delays: 50-80ms between items (fast enough to feel connected)
- Duration: 200-400ms for micro-interactions, 400-600ms for transitions
- Never block user interaction — animations are interruptible
- Exit animations 60-70% of enter duration (feels responsive)

## 13. UX Improvements (from mockup review)

### Search bar empty state (Phase 1)

- Phase 1 has no NL search, but search bar is visible
- Show contextual placeholder: "필터로 장비를 찾아보세요" (Phase 1-2)
- Phase 3: switch to "강남역 파나타 하이로우..." NL placeholder

### Empty state handling

- When filter combination returns 0 results:
  - Show: "조건에 맞는 헬스장이 없습니다"
  - Show: "필터 초기화" button to clear all filters
- When photo gallery has 0 photos:
  - Show: "아직 사진이 없어요. 첫 번째 사진을 올려보세요!"
- When My Page has 0 uploads:
  - Show: illustration + "아직 올린 사진이 없어요" + "사진 올리러 가기" CTA

## 14. Loading States

### Skeleton screens (preferred over spinners)

```
[Gym card skeleton]
+----------------------------------+
| [░░░░░░░]            [░░]       |
| [░░░░░░░░░░]                    |
| [░░] [░░] [░░]                  |
+----------------------------------+

[Photo gallery skeleton]
+--------------------------------------+
| [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]  |  <- best cut placeholder
| [░░░░░] [░░░░░] [░░░░░]            |  <- grid placeholders
+--------------------------------------+
```

- Use animated skeleton (shimmer effect) via reanimated
- Show skeleton immediately, replace with real data when loaded
- Never show blank screen — always skeleton or cached data
- Map: show map immediately (loads fast), skeleton for Bottom Sheet content
- Photo upload: progress bar (not spinner) during OCR processing

## 15. Permission Request Flow

```
[Location Permission]
When: App first launch, before showing map
Flow:
  -> Show pre-permission screen: "주변 헬스장을 찾기 위해 위치 정보가 필요합니다"
  -> User taps "허용하기" -> system permission dialog
  -> Denied: fallback to manual area selection (default: 강남역)
  -> Never ask again: show "설정에서 위치 권한을 켜주세요" with settings deep link

[Camera Permission] (Phase 2)
When: First time user taps "사진 촬영" in upload flow
Flow:
  -> System permission dialog (no pre-permission screen needed, context is obvious)
  -> Denied: hide camera button, show "갤러리에서 선택" only

[Photo Library Permission] (Phase 2)
When: First time user taps "갤러리에서 선택"
Flow:
  -> System permission dialog
  -> Denied: show "설정에서 사진 접근을 허용해주세요"
```

## 16. Map Marker Design

```
[Default Marker]
+-------+
| amber |  <- rounded rectangle, amber-500 background
|   3   |  <- white text, machine count
+---+---+
    V      <- small triangle pointer

[Selected Marker]
+--------+
| amber  |  <- larger, amber-600 (darker), slight scale up
|   3    |
+---+----+
    V
```

- Default: 32x28px, amber-500 bg, white bold count text, rounded-lg
- Selected: 40x34px, amber-600 bg, scale(1.15) transition
- Count = number of machines matching current filter (or total if no filter)
- 0 count gyms: show gray marker (slate-300) — filter doesn't match
- Cluster: when markers overlap at zoom level, show cluster circle with total count

## 17. Interaction Details

### Pull-to-refresh

- Gym list (Bottom Sheet half state): pull down to refresh search results
- Photo gallery: pull down to refresh photos
- My Page: pull down to refresh upload/vote counts
- Use native RefreshControl with amber spinner color

### Keyboard handling

- Search bar focus: keyboard pushes content up (KeyboardAvoidingView)
- Manual machine input (upload Step 3): keyboard pushes input into view
- Tap outside input to dismiss keyboard
- "Done" / "Search" keyboard button to submit

### Haptic feedback

- Filter chip toggle: light impact
- Upvote tap: medium impact
- Photo upload complete: success notification
- Pull-to-refresh trigger: light impact
- Implementation: expo-haptics (Expo built-in)

### Safe area

- Top: status bar + notch clearance on all screens
- Bottom: home indicator clearance on bottom tab bar + Bottom Sheet
- Bottom Sheet handle: above home indicator area
- FAB button: 16px above bottom safe area
- Implementation: react-native-safe-area-context (Expo built-in)

## 18. Portfolio Presentation

- **README:** Project intro + tech stack + architecture diagram
- **Screenshots/GIF:** Key flow demonstrations
- **Demo Video:** 30sec-1min (AI feature highlight)
- **API Docs:** Swagger (SpringDoc auto-generated)
- **Security Section:** List of applied security measures in README
