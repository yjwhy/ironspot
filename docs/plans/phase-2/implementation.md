# Phase 2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Phase:** 2 (Spring Boot + Auth + Upload + OCR)
**Version:** 1.0
**Date:** 2026-05-06
**Author:** YJ (builtByYJ)

## Goal

Introduce Spring Boot 4 as the API layer (initial setup in Task 16 used Spring Boot 3.5.0; pivoted to 4 in Task 31 due to the Sentry starter incompatibility with SB4's removed `WebClientCustomizer`). Add social authentication (Google/Kakao via Supabase Auth), build the photo upload pipeline with Google Vision OCR, activate upvote/report, implement My Page, and migrate the frontend data source from Supabase direct to Spring Boot API.

## Phase 1 → Phase 2 Transition Strategy

Phase 1 reads from Supabase directly via `supabase-js` in `src/features/*/services/`. Phase 2 swaps those service internals to use Orval-generated ky clients pointing at Spring Boot. **Components, hooks, and query key factories stay unchanged** — only the service implementations are replaced.

```
Phase 1:  useGymSearch → searchGymsInBounds() → supabase.rpc()
Phase 2:  useGymSearch → searchGymsInBounds() → gymsApi.getApiGymsSearch()
                                                  ↑ Orval-generated
```

This means all existing unit tests continue to pass without modification after migration (they mock at the service boundary, not the transport layer).

## Architecture

```
[Expo RN App]
     |
     |— ky HTTP client (with JWT Bearer header, 10s timeout)
     |
[Spring Boot API — localhost:8080 dev / Render prod]
     |
     |— Spring Security (validates Supabase-issued JWT, never issues tokens)
     |— Controllers → Services → Repositories (JdbcTemplate)
     |
[Supabase]
     |— Auth: issues JWT on Google/Kakao OAuth
     |— DB: PostgreSQL + PostGIS (schema unchanged from Phase 1)
     |— Storage: machine-photos bucket (unchanged)
```

## Confirmed Decisions (from ADRs)

| #                     | Choice                                                                 | ADR               |
| --------------------- | ---------------------------------------------------------------------- | ----------------- |
| API server            | Spring Boot 4 + Java 25 (LTS)                                          | 0004, 0005        |
| API client generation | Orval                                                                  | 0012              |
| OCR                   | Google Vision API (1,000 free/month, fallback to manual)               | 0010              |
| Auth                  | Supabase Auth JWT — Spring Boot only validates, never issues           | 0003              |
| Build tool            | Gradle Kotlin DSL                                                      |                   |
| DB tests              | Testcontainers + real PostgreSQL + PostGIS (no mocks)                  | phase-2 CLAUDE.md |
| OpenAPI               | SpringDoc OpenAPI 2.x (auto-generated from annotations)                |                   |
| DB connection         | JDBC direct (not Supabase REST) — required for PostGIS spatial queries |                   |
| Service migration     | Feature-by-feature (never break the running app mid-migration)         |                   |
| Repo structure        | `iron-spot-api/` inside the same git repo — easier CI, Orval pipeline  |                   |
| Upvote / report auth  | Requires login — `useRequireAuth()` redirects to login if no session   |                   |
| My Page (anonymous)   | Empty-state with "로그인하기" CTA — no hard redirect on tab press      |                   |
| OCR failure UX        | Show "다시 시도" + "직접 입력" — user chooses, not a silent fallback   |                   |
| Naver Places proxy    | Proxied through Spring Boot — API key never exposed to client bundle   |                   |

## Pre-requisites (gates — note which task each blocks)

- [x] Docker Desktop installed — Testcontainers requirement (confirmed)
- [x] Java 25 LTS (Temurin 25.0.3) installed — confirmed 2026-05-07
- [ ] Google Cloud project + Vision API key — blocks Task 24
- [ ] Google OAuth app configured in Supabase Dashboard → Auth → Providers — blocks Task 20
- [ ] Kakao OAuth app configured in Supabase Dashboard → Auth → Providers — blocks Task 20
- [ ] Naver Places API key (separate from Maps key — apply at ncloud.biz) — blocks Task 28
- [ ] Render account for deployment — blocks Task 32 (Task 32 decision #7: free Web Service tier on Render; UptimeRobot 5-minute keep-warm ping for the 15-minute idle sleep)
- [ ] `.env` updated with `EXPO_PUBLIC_API_URL` — blocks Task 21

---

## Task 16: Spring Boot Project Setup

**Goal:** Runnable Spring Boot 3 server, Docker, Testcontainers test harness, GitHub Actions CI, health endpoint. No business logic yet — just the skeleton every subsequent task builds on.

**What must be complete before calling this task done:**

- `./gradlew test` passes (HealthCheckTest green)
- `docker-compose up` brings up API + local Postgres
- CI pipeline triggers on changes to `iron-spot-api/**`

**Files to create:**

```
iron-spot-api/
├── build.gradle.kts
├── settings.gradle.kts
├── gradlew + gradlew.bat (generated by Gradle wrapper)
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── src/main/java/com/ironspot/
│   ├── IronSpotApplication.java
│   └── common/
│       ├── config/OpenApiConfig.java
│       ├── dto/ApiResponse.java
│       └── exception/
│           ├── BusinessException.java
│           └── GlobalExceptionHandler.java
├── src/main/resources/
│   ├── application.yml
│   └── application-prod.yml
└── src/test/java/com/ironspot/
    ├── common/IntegrationTestBase.java
    └── HealthCheckTest.java
src/test/resources/init-test-db.sql
.github/workflows/api-ci.yml
```

### Step 1: Generate Spring Boot project

Download from https://start.spring.io with:

- Project: Gradle - Kotlin
- Language: Java
- Spring Boot: 3.4.x (latest stable)
- Java: 27
- Group: `com.ironspot`, Artifact: `iron-spot-api`
- Dependencies: Spring Web, Spring Security, Validation, Spring Boot Actuator, Lombok

Unzip into `iron-spot-api/` at the repo root.

### Step 2: `build.gradle.kts`

```kotlin
plugins {
    java
    id("org.springframework.boot") version "3.4.5"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.ironspot"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(25)
    }
}

configurations {
    compileOnly { extendsFrom(configurations.annotationProcessor.get()) }
}

repositories {
    mavenCentral()
}

dependencies {
    // Spring
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-jdbc")

    // OpenAPI (SpringDoc)
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.8")

    // JWT — Supabase Auth token validation
    implementation("io.jsonwebtoken:jjwt-api:0.12.6")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:0.12.6")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.12.6")

    // PostgreSQL / PostGIS
    runtimeOnly("org.postgresql:postgresql")

    // HTTP client — for Google Vision API + Naver Places proxy
    implementation("org.springframework.boot:spring-boot-starter-webflux")

    // Lombok
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")

    // Test
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("org.testcontainers:junit-jupiter")
    testImplementation("org.testcontainers:postgresql")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
    useJUnitPlatform()
}
```

### Step 3: `src/main/resources/application.yml`

```yaml
spring:
  application:
    name: iron-spot-api
  datasource:
    url: ${DATABASE_URL}
    driver-class-name: org.postgresql.Driver
    username: ${DATABASE_USERNAME:}
    password: ${DATABASE_PASSWORD:}

security:
  supabase-jwt-secret: ${SUPABASE_JWT_SECRET}

supabase:
  url: ${SUPABASE_URL}
  service-role-key: ${SUPABASE_SERVICE_ROLE_KEY}

google:
  vision:
    api-key: ${GOOGLE_VISION_API_KEY:}

naver:
  search:
    client-id: ${NAVER_SEARCH_CLIENT_ID}
    client-secret: ${NAVER_SEARCH_CLIENT_SECRET}

server:
  port: 8080

springdoc:
  api-docs:
    path: /api-docs
  swagger-ui:
    path: /swagger-ui.html

management:
  endpoints:
    web:
      exposure:
        include: health,info
  info:
    env:
      enabled: true

info:
  app:
    version: '@project.version@'
```

`application-prod.yml` overrides logging format to JSON for the hosting platform's log viewer (Render log streams per Task 32 decision #7).

### Step 4: `.env.example` (inside `iron-spot-api/`)

```bash
DATABASE_URL=jdbc:postgresql://localhost:5433/ironspot
DATABASE_USERNAME=ironspot
DATABASE_PASSWORD=ironspot
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GOOGLE_VISION_API_KEY=
NAVER_SEARCH_CLIENT_ID=
NAVER_SEARCH_CLIENT_SECRET=
```

### Step 5: Common DTOs + Exception handling

```java
// common/dto/ApiResponse.java
@Getter
@Builder
public class ApiResponse<T> {
    private final boolean success;
    private final T data;
    private final String error;

    public static <T> ApiResponse<T> ok(T data) {
        return ApiResponse.<T>builder().success(true).data(data).build();
    }

    public static <T> ApiResponse<T> error(String message) {
        return ApiResponse.<T>builder().success(false).error(message).build();
    }
}
```

```java
// common/exception/BusinessException.java
@Getter
public class BusinessException extends RuntimeException {
    private final HttpStatus status;

    public BusinessException(String message, HttpStatus status) {
        super(message);
        this.status = status;
    }
}
```

```java
// common/exception/GlobalExceptionHandler.java
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusiness(BusinessException e) {
        return ResponseEntity.status(e.getStatus()).body(ApiResponse.error(e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
            .map(f -> f.getField() + ": " + f.getDefaultMessage())
            .collect(Collectors.joining(", "));
        return ApiResponse.error(message);
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> handleUnexpected(Exception e) {
        log.error("Unexpected error", e);
        return ApiResponse.error("서버 오류가 발생했습니다");
    }
}
```

### Step 6: Testcontainers base class

```java
// src/test/java/com/ironspot/common/IntegrationTestBase.java
@Testcontainers
public abstract class IntegrationTestBase {

    @Container
    static final PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>("postgis/postgis:17-3.5")
            .withDatabaseName("ironspot_test")
            .withUsername("test")
            .withPassword("test")
            .withInitScript("init-test-db.sql");

    @DynamicPropertySource
    static void configureDatabase(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
}
```

```sql
-- src/test/resources/init-test-db.sql
-- Mirror of supabase/migrations/ schema, stripped for test speed.
-- PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS gyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  location GEOGRAPHY(POINT) NOT NULL,
  phone TEXT,
  operating_hours TEXT,
  day_pass_price INTEGER,
  is_verified BOOLEAN DEFAULT FALSE,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);

CREATE TYPE loading_type AS ENUM ('pin', 'plate');

CREATE TABLE IF NOT EXISTS machine_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id),
  category_id UUID REFERENCES categories(id),
  name TEXT NOT NULL,
  loading_type loading_type NOT NULL,
  is_approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gym_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID REFERENCES gyms(id),
  template_id UUID REFERENCES machine_templates(id),
  quantity INTEGER DEFAULT 1,
  is_custom BOOLEAN DEFAULT FALSE,
  custom_name TEXT,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  nickname TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS machine_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_machine_id UUID REFERENCES gym_machines(id),
  user_id UUID REFERENCES users(id),
  photo_url TEXT NOT NULL,
  upvote_count INTEGER DEFAULT 0,
  is_blinded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS photo_votes (
  user_id UUID REFERENCES users(id),
  photo_id UUID REFERENCES machine_photos(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, photo_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Minimal seed for tests
INSERT INTO brands(id, name) VALUES ('b0000001-0000-0000-0000-000000000001', 'Panatta');
INSERT INTO categories(id, name) VALUES ('c0000001-0000-0000-0000-000000000001', '등');
INSERT INTO gyms(id, name, address, location, is_verified)
  VALUES (
    'g0000001-0000-0000-0000-000000000001',
    '테스트 헬스장',
    '서울 강남구 역삼동 1',
    ST_GeographyFromText('SRID=4326;POINT(127.0276 37.4979)'),
    TRUE
  );
```

### Step 7: HealthCheckTest

```java
// src/test/java/com/ironspot/HealthCheckTest.java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class HealthCheckTest extends IntegrationTestBase {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void actuatorHealthReturnsUp() {
        ResponseEntity<String> response = restTemplate.getForEntity("/actuator/health", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"status\":\"UP\"");
    }
}
```

### Step 8: Dockerfile

```dockerfile
FROM eclipse-temurin:25-jre-alpine AS runtime

WORKDIR /app

COPY build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-Dspring.profiles.active=prod", "-jar", "app.jar"]
```

### Step 9: `docker-compose.yml` (local dev)

```yaml
version: '3.9'
services:
  api:
    build: .
    ports:
      - '8080:8080'
    env_file: .env
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgis/postgis:17-3.5
    environment:
      POSTGRES_DB: ironspot
      POSTGRES_USER: ironspot
      POSTGRES_PASSWORD: ironspot
    ports:
      - '5433:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ironspot']
      interval: 5s
      timeout: 5s
      retries: 5
```

### Step 10: GitHub Actions CI

```yaml
# .github/workflows/api-ci.yml
name: API CI

on:
  push:
    paths: ['iron-spot-api/**']
  pull_request:
    paths: ['iron-spot-api/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '25'
          distribution: 'temurin'
      - uses: gradle/actions/setup-gradle@v4
      - name: Run tests
        working-directory: iron-spot-api
        run: ./gradlew test
      - name: Build JAR
        working-directory: iron-spot-api
        run: ./gradlew bootJar
```

### Step 11: Verify

```bash
cd iron-spot-api
./gradlew test
```

Expected: HealthCheckTest green, Docker build succeeds.

### Commit

```bash
git add iron-spot-api/ .github/workflows/api-ci.yml
git commit -m "feat(api): spring boot 3 project setup with docker + testcontainers"
```

---

## Task 17: JWT Auth Infrastructure

**Goal:** Spring Security validates Supabase-issued JWTs on every request. Protected endpoints return 401 without a valid token. `GET /api/users/me` returns the authenticated user, creating the user record on first visit.

**What must be complete before calling this task done:**

- `GET /api/users/me` returns 401 without token
- `GET /api/users/me` returns user data with a valid Supabase JWT
- `GET /api/gyms/search` still returns 200 without a token (public endpoint)

**Files to create:**

```
com/ironspot/auth/
├── JwtAuthenticationFilter.java
├── JwtValidator.java
├── SecurityConfig.java
├── UserPrincipal.java
├── UserController.java
├── UserService.java
├── UserRepository.java
└── dto/
    ├── UserResponse.java
    └── UpdateUserRequest.java
src/test/java/com/ironspot/auth/
├── UserControllerTest.java
└── JwtValidatorTest.java
```

### Step 1: Write tests first

```java
// UserControllerTest.java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class UserControllerTest extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;

    @Test
    void getMeReturns401WithoutToken() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/users/me", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void getMeReturns401WithInvalidToken() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("not-a-real-jwt");
        HttpEntity<Void> entity = new HttpEntity<>(headers);
        ResponseEntity<String> response = restTemplate.exchange("/api/users/me", HttpMethod.GET, entity, String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // Note: full happy-path test requires a real Supabase JWT — tested manually
    // or via a @MockBean JwtValidator in a separate WebMvcTest
}
```

```java
// JwtValidatorTest.java
class JwtValidatorTest {
    // Tests JWT parsing with a known-good HMAC secret + crafted test token
    // Verifies: userId extracted from `sub`, email from claims, expired token rejected
}
```

### Step 2: `UserPrincipal.java`

```java
@Getter
@Builder
public class UserPrincipal implements UserDetails {
    private final String userId;   // Supabase auth.users.id (UUID as string)
    private final String email;
    private final String nickname; // may be null on first login

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_USER"));
    }

    @Override public String getPassword() { return null; }
    @Override public String getUsername() { return userId; }
}
```

### Step 3: `JwtValidator.java`

Supabase uses HMAC-SHA256 with the JWT secret from Dashboard → Settings → API → JWT Settings.

```java
@Component
@Slf4j
public class JwtValidator {

    @Value("${security.supabase-jwt-secret}")
    private String jwtSecret;

    public Optional<UserPrincipal> validate(String token) {
        try {
            Claims claims = Jwts.parser()
                .verifyWith(Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8)))
                .build()
                .parseSignedClaims(token)
                .getPayload();

            return Optional.of(UserPrincipal.builder()
                .userId(claims.getSubject())
                .email(claims.get("email", String.class))
                .build());
        } catch (JwtException e) {
            log.debug("Invalid JWT: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
```

### Step 4: `JwtAuthenticationFilter.java`

```java
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtValidator jwtValidator;

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain chain
    ) throws ServletException, IOException {
        extractBearerToken(request)
            .flatMap(jwtValidator::validate)
            .ifPresent(principal -> {
                UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
                SecurityContextHolder.getContext().setAuthentication(auth);
            });
        chain.doFilter(request, response);
    }

    private Optional<String> extractBearerToken(HttpServletRequest request) {
        return Optional.ofNullable(request.getHeader("Authorization"))
            .filter(h -> h.startsWith("Bearer "))
            .map(h -> h.substring(7));
    }
}
```

### Step 5: `SecurityConfig.java`

```java
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Public read endpoints
                .requestMatchers(HttpMethod.GET, "/api/gyms/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/brands").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/categories").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/machines/*/photos").permitAll()
                // Infrastructure
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                .requestMatchers("/api-docs/**", "/swagger-ui/**").permitAll()
                // Everything else requires auth
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
```

### Step 6: `UserService.java` + `UserRepository.java`

```java
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    // Called on every authenticated request — creates user if first visit.
    // Supabase Auth already validated the token; we just sync user to our DB.
    public UserResponse getOrCreate(UserPrincipal principal) {
        return userRepository.findById(principal.getUserId())
            .orElseGet(() -> {
                String defaultNickname = "헬스인_" + principal.getUserId().substring(0, 6);
                userRepository.insert(principal.getUserId(), principal.getEmail(), defaultNickname);
                return userRepository.findById(principal.getUserId()).orElseThrow();
            });
    }

    public UserResponse updateNickname(String userId, String nickname) {
        userRepository.updateNickname(userId, nickname);
        return userRepository.findById(userId).orElseThrow();
    }

    @Transactional
    public void deleteAccount(String userId) {
        userRepository.anonymizePhotos(userId);       // set user_id = NULL on machine_photos
        userRepository.deleteVotes(userId);            // remove all votes
        userRepository.markDeleted(userId);            // set deleted_at = NOW()
        // Permanent hard-delete scheduled by a DB job at deleted_at + 32 days
    }
}
```

```java
@Repository
@RequiredArgsConstructor
public class UserRepository {

    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate namedJdbc;

    public Optional<UserResponse> findById(String id) {
        try {
            return Optional.of(
                jdbc.queryForObject(
                    "SELECT id, email, nickname, created_at FROM users WHERE id = ?::uuid AND deleted_at IS NULL",
                    UserRowMapper.INSTANCE, id
                )
            );
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public void insert(String id, String email, String nickname) {
        jdbc.update(
            "INSERT INTO users (id, email, nickname) VALUES (?::uuid, ?, ?)",
            id, email, nickname
        );
    }

    public void updateNickname(String userId, String nickname) {
        jdbc.update(
            "UPDATE users SET nickname = ?, updated_at = NOW() WHERE id = ?::uuid",
            nickname, userId
        );
    }

    public void anonymizePhotos(String userId) {
        jdbc.update(
            "UPDATE machine_photos SET user_id = NULL WHERE user_id = ?::uuid",
            userId
        );
    }

    public void deleteVotes(String userId) {
        jdbc.update("DELETE FROM photo_votes WHERE user_id = ?::uuid", userId);
    }

    public void markDeleted(String userId) {
        jdbc.update(
            "UPDATE users SET deleted_at = NOW() WHERE id = ?::uuid",
            userId
        );
    }
}
```

### Step 7: `UserController.java`

```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ApiResponse<UserResponse> getMe(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(userService.getOrCreate(principal));
    }

    @PutMapping("/me")
    public ApiResponse<UserResponse> updateMe(
        @AuthenticationPrincipal UserPrincipal principal,
        @Valid @RequestBody UpdateUserRequest request
    ) {
        return ApiResponse.ok(userService.updateNickname(principal.getUserId(), request.getNickname()));
    }

    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMe(@AuthenticationPrincipal UserPrincipal principal) {
        userService.deleteAccount(principal.getUserId());
    }
}
```

### DTOs

```java
@Getter @Builder
public class UserResponse {
    private String id;
    private String email;
    private String nickname;
    private String createdAt;
}

@Getter
public class UpdateUserRequest {
    @NotBlank(message = "닉네임을 입력해주세요")
    @Size(min = 2, max = 20, message = "닉네임은 2~20자여야 합니다")
    private String nickname;
}
```

### Commit

```bash
git commit -m "feat(api): JWT auth filter + spring security + /api/users/me"
```

---

## Task 18: Core Read Endpoints

**Goal:** All GET endpoints the frontend currently fetches from Supabase. Spring Boot becomes the single data access point for the app. All endpoints must have Testcontainers integration tests.

**Endpoints to implement:**

- `GET /api/gyms/search?minLat&maxLat&minLng&maxLng&brandId&categoryId&loadingType`
- `GET /api/gyms/:id`
- `GET /api/gyms/:id/machines`
- `GET /api/machines/:gymMachineId/photos`
- `GET /api/brands`
- `GET /api/categories`

**What must be complete before calling this task done:**

- All 6 endpoints return correct data against the Testcontainers seed DB
- Invalid parameters (missing bounds, out-of-range coords) return 400
- PostGIS spatial query returns only gyms within the given bounds

**Files to create:**

```
com/ironspot/
├── gym/
│   ├── GymController.java
│   ├── GymService.java
│   ├── GymRepository.java
│   └── dto/
│       ├── GymSearchRequest.java
│       ├── GymResponse.java
│       ├── GymWithMachineCountResponse.java
│       └── GymDetailResponse.java
├── machine/
│   ├── MachineController.java
│   ├── MachineService.java
│   ├── MachineRepository.java
│   └── dto/
│       ├── GymMachineResponse.java
│       └── MachineTemplateResponse.java
├── photo/
│   ├── PhotoController.java (read path only — upload in Task 22)
│   ├── PhotoService.java
│   ├── PhotoRepository.java
│   └── dto/PhotoResponse.java
└── common/
    ├── BrandController.java
    └── CategoryController.java
src/test/java/com/ironspot/
├── gym/GymSearchTest.java
├── gym/GymDetailTest.java
├── machine/MachineListTest.java
└── photo/PhotoListTest.java
```

### `GymSearchRequest.java`

```java
@Getter
public class GymSearchRequest {
    @NotNull
    @DecimalMin(value = "-90") @DecimalMax(value = "90")
    private Double minLat;

    @NotNull
    @DecimalMin(value = "-90") @DecimalMax(value = "90")
    private Double maxLat;

    @NotNull
    @DecimalMin(value = "-180") @DecimalMax(value = "180")
    private Double minLng;

    @NotNull
    @DecimalMin(value = "-180") @DecimalMax(value = "180")
    private Double maxLng;

    private String brandId;      // nullable
    private String categoryId;   // nullable
    private String loadingType;  // nullable: "pin" | "plate"
}
```

### `GymRepository.java` — PostGIS query

```java
@Repository
@RequiredArgsConstructor
public class GymRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public List<GymWithMachineCountResponse> searchInBounds(GymSearchRequest req) {
        String sql = """
            SELECT
                g.id, g.name, g.address,
                ST_Y(g.location::geometry) AS latitude,
                ST_X(g.location::geometry) AS longitude,
                g.phone, g.operating_hours, g.day_pass_price,
                g.is_verified, g.last_verified_at,
                g.created_at, g.updated_at,
                COUNT(DISTINCT gm.id) AS machine_count
            FROM gyms g
            LEFT JOIN gym_machines gm ON gm.gym_id = g.id
            LEFT JOIN machine_templates mt ON mt.id = gm.template_id
            WHERE ST_Within(
                g.location::geometry,
                ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326)
            )
            AND (:brandId IS NULL OR mt.brand_id::text = :brandId)
            AND (:categoryId IS NULL OR mt.category_id::text = :categoryId)
            AND (:loadingType IS NULL OR mt.loading_type::text = :loadingType)
            GROUP BY g.id
            ORDER BY machine_count DESC
            """;

        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("minLat", req.getMinLat())
            .addValue("maxLat", req.getMaxLat())
            .addValue("minLng", req.getMinLng())
            .addValue("maxLng", req.getMaxLng())
            .addValue("brandId", req.getBrandId())
            .addValue("categoryId", req.getCategoryId())
            .addValue("loadingType", req.getLoadingType());

        return jdbc.query(sql, params, GymRowMappers.WITH_MACHINE_COUNT);
    }

    public Optional<GymDetailResponse> findById(UUID id) { /* SELECT all fields */ }
}
```

### `MachineRepository.java` — grouped machine list

```java
public List<GymMachineResponse> findByGymId(UUID gymId) {
    String sql = """
        SELECT
            gm.id, gm.quantity, gm.is_custom, gm.custom_name, gm.last_verified_at,
            mt.id AS template_id, mt.name AS machine_name, mt.loading_type,
            b.id AS brand_id, b.name AS brand_name,
            c.id AS category_id, c.name AS category_name,
            COUNT(mp.id) AS photo_count
        FROM gym_machines gm
        JOIN machine_templates mt ON mt.id = gm.template_id
        JOIN brands b ON b.id = mt.brand_id
        JOIN categories c ON c.id = mt.category_id
        LEFT JOIN machine_photos mp ON mp.gym_machine_id = gm.id AND mp.is_blinded = FALSE
        WHERE gm.gym_id = ?::uuid
        GROUP BY gm.id, mt.id, b.id, c.id
        ORDER BY b.name, c.name, mt.name
        """;
    return jdbc.query(sql, MachineRowMappers.GYM_MACHINE, gymId);
}
```

### Integration test pattern

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class GymSearchTest extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;

    @Test
    void searchReturnsGymsWithinBounds() {
        // init-test-db.sql seeds a gym at (37.4979, 127.0276)
        String url = "/api/gyms/search?minLat=37.49&minLng=127.02&maxLat=37.50&maxLng=127.03";
        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("테스트 헬스장");
    }

    @Test
    void searchReturnsBadRequestWithoutBounds() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/gyms/search", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void searchDoesNotReturnGymOutsideBounds() {
        // Bounds centered on Hongdae — Gangnam gym should not appear
        String url = "/api/gyms/search?minLat=37.55&minLng=126.92&maxLat=37.56&maxLng=126.93";
        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
        assertThat(response.getBody()).doesNotContain("테스트 헬스장");
    }
}
```

### Step: OpenAPI annotations on all controllers

Every endpoint must have `@Operation(summary = ...)` and `@ApiResponse(responseCode = ...)` annotations. These are the source of truth for the Orval client generation in Task 19.

```java
// Example on GymController
@Operation(summary = "Search gyms within map bounds", tags = {"gyms"})
@ApiResponse(responseCode = "200", description = "List of gyms with machine counts")
@ApiResponse(responseCode = "400", description = "Missing or invalid bounds parameters")
@GetMapping("/search")
public ApiResponse<List<GymWithMachineCountResponse>> search(@Valid GymSearchRequest request) { ... }
```

### Commit

```bash
git commit -m "feat(api): gym/machine/photo read endpoints with PostGIS integration tests"
```

---

## Task 19: OpenAPI Spec + Orval Client Generation

**Goal:** SpringDoc auto-generates an OpenAPI 3.0 spec from annotations. Orval reads the spec and generates TypeScript service functions + TanStack Query hooks. The generated client replaces all hand-written Supabase service code in Task 21.

**What must be complete before calling this task done:**

- `pnpm generate:api` runs without error against a running API server
- Generated files compile (`pnpm exec tsc --noEmit`)
- Response types in generated code match the existing `database.ts` types (no type mismatches that would break hooks)

**Files to create/modify:**

```
orval.config.ts                          (project root)
src/shared/lib/api-client.ts             (ky instance with JWT interceptor)
src/shared/generated/                    (auto-generated — committed to git)
package.json                             (add generate:api script)
.env.example                             (add EXPO_PUBLIC_API_URL)
src/shared/lib/env.ts                    (add API_URL validation)
```

### Step 1: Install Orval

```bash
pnpm add -D orval
```

### Step 2: `orval.config.ts`

```typescript
import { defineConfig } from 'orval';

export default defineConfig({
  ironspot: {
    input: 'http://localhost:8080/api-docs',
    output: {
      mode: 'tags-split',
      target: 'src/shared/generated/api.ts',
      schemas: 'src/shared/generated/model',
      client: 'react-query',
      httpClient: 'ky',
      override: {
        mutator: {
          path: 'src/shared/lib/api-client.ts',
          name: 'apiClient',
        },
        query: {
          useQuery: true,
          useMutation: true,
        },
      },
    },
  },
});
```

### Step 3: `src/shared/lib/api-client.ts`

```typescript
import ky from 'ky';

import { env } from './env';
import { supabase } from './supabase';

// Ky instance used by all Orval-generated clients.
// Attaches the Supabase session JWT before every request.
// On 401 response: attempts one token refresh, then gives up.
export const apiClient = ky.create({
  prefixUrl: env.EXPO_PUBLIC_API_URL,
  timeout: 10_000,
  hooks: {
    beforeRequest: [
      async (request) => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`);
        }
      },
    ],
    afterResponse: [
      async (_request, _options, response) => {
        if (response.status === 401) {
          await supabase.auth.refreshSession();
        }
        return response;
      },
    ],
  },
});
```

### Step 4: Update `env.ts`

```typescript
const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  EXPO_PUBLIC_NAVER_MAP_CLIENT_ID: z.string().min(1),
  EXPO_PUBLIC_API_URL: z.string().url(), // add this
});
```

### Step 5: `package.json` scripts

```json
{
  "scripts": {
    "generate:api": "orval --config orval.config.ts"
  }
}
```

### Step 6: Generate the client

```bash
# Start API server locally first
cd iron-spot-api && ./gradlew bootRun &
sleep 15
cd ..
pnpm generate:api
```

**Commit generated files** — the app must build without requiring a running API server at build time.

### Step 7: CI check — generated files must be up to date

Add to existing app CI:

```yaml
- name: Check generated API client is up-to-date
  run: |
    docker-compose -f iron-spot-api/docker-compose.yml up -d api
    sleep 15
    pnpm generate:api
    git diff --exit-code src/shared/generated/
```

### Commit

```bash
git add orval.config.ts src/shared/lib/api-client.ts src/shared/generated/
git commit -m "feat(api): springdoc openapi + orval typescript client generation"
```

---

## Task 20: Frontend Auth

**Goal:** Login screen with Google/Kakao social buttons. `useAuth` hook for session state. `useRequireAuth` hook for gating write actions. Auth callback deep link handler.

**Pre-requisite from Task 19:** Remove the `filters.exclude` in `orval.config.ts` and add `@Operation(summary = ..., tags = {"users"})` to `UserController` methods so that `/api/users/me` is included in the generated client.

**What must be complete before calling this task done:**

- Login screen renders correctly with Google + Kakao buttons
- "로그인 없이 둘러보기" works — map tab accessible without login
- All 8 tests pass
- `useRequireAuth` correctly redirects unauthenticated users to login on write actions

**Files to create:**

```
src/features/auth/
├── hooks/
│   ├── useAuth.ts
│   └── useRequireAuth.ts
├── components/
│   ├── LoginScreen.tsx
│   └── __tests__/LoginScreen.test.tsx
app/(auth)/
├── _layout.tsx
├── login.tsx
└── callback.tsx
src/shared/hooks/useCurrentUser.ts      (fetches /api/users/me)
```

### Step 1: Write tests first

```tsx
// src/features/auth/components/__tests__/LoginScreen.test.tsx
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { signInWithOAuth: jest.fn().mockResolvedValue({ error: null }) },
  })),
}));

describe('LoginScreen', () => {
  it('renders Google and Kakao login buttons', () => {
    const { getByRole } = render(<LoginScreen onBrowseAsGuest={() => undefined} />);
    expect(getByRole('button', { name: 'Google로 계속하기' })).toBeTruthy();
    expect(getByRole('button', { name: 'Kakao로 계속하기' })).toBeTruthy();
  });

  it('renders "로그인 없이 둘러보기" button', () => {
    const { getByRole } = render(<LoginScreen onBrowseAsGuest={() => undefined} />);
    expect(getByRole('button', { name: '로그인 없이 둘러보기' })).toBeTruthy();
  });

  it('calls onBrowseAsGuest when the guest button is pressed', () => {
    const onBrowseAsGuest = jest.fn();
    const { getByRole } = render(<LoginScreen onBrowseAsGuest={onBrowseAsGuest} />);
    fireEvent.press(getByRole('button', { name: '로그인 없이 둘러보기' }));
    expect(onBrowseAsGuest).toHaveBeenCalledTimes(1);
  });
});
```

### Step 2: `useAuth.ts`

```typescript
// Returns auth state — never triggers navigation.
// Navigation decisions live in screens/hooks that consume this.
export type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; session: Session }
  | { status: 'anonymous' };

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(function subscribeToAuthChanges() {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setState(session ? { status: 'authenticated', session } : { status: 'anonymous' });
    });
    return () => subscription.unsubscribe();
  }, []);

  return state;
}
```

### Step 3: `useRequireAuth.ts`

```typescript
// Returns a function that runs `action` only if user is logged in.
// If not logged in, redirects to the login screen instead.
export function useRequireAuth() {
  const router = useRouter();

  return function requireAuth(action: () => void): void {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session) {
          action();
        } else {
          router.push('/(auth)/login');
        }
      })
      .catch(() => router.push('/(auth)/login'));
  };
}
```

### Step 4: `LoginScreen.tsx`

```tsx
interface LoginScreenProps {
  onBrowseAsGuest: () => void;
}

export function LoginScreen({ onBrowseAsGuest }: LoginScreenProps) {
  const [loading, setLoading] = useState<'google' | 'kakao' | null>(null);

  async function handleGoogleLogin() {
    setLoading('google');
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'ironspot://auth/callback' },
      });
    } catch {
      burnt.toast({ title: '로그인에 실패했습니다', preset: 'error' });
    } finally {
      setLoading(null);
    }
  }

  async function handleKakaoLogin() {
    setLoading('kakao');
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: { redirectTo: 'ironspot://auth/callback' },
      });
    } catch {
      burnt.toast({ title: '로그인에 실패했습니다', preset: 'error' });
    } finally {
      setLoading(null);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base justify-between px-6 py-12">
      <View className="flex-1 items-center justify-center gap-4">
        <MaterialIcons name="fitness-center" size={48} color={colors.accent.DEFAULT} />
        <AppText className="text-display font-bold text-text-primary">IronSpot</AppText>
        <AppText className="text-body text-text-secondary text-center">
          내 주변 헬스장 기구를 찾아보세요
        </AppText>
      </View>

      <View className="gap-3">
        <Button
          label="Google로 계속하기"
          onPress={() => {
            void handleGoogleLogin();
          }}
          loading={loading === 'google'}
        />
        <Button
          label="Kakao로 계속하기"
          onPress={() => {
            void handleKakaoLogin();
          }}
          loading={loading === 'kakao'}
          variant="secondary"
        />
        <Pressable
          onPress={onBrowseAsGuest}
          accessibilityRole="button"
          accessibilityLabel="로그인 없이 둘러보기"
          className="items-center py-3"
          style={pressedOpacity}
        >
          <AppText className="text-body-sm text-text-tertiary">로그인 없이 둘러보기 →</AppText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
```

### Step 5: `app/(auth)/callback.tsx`

OAuth redirects to `ironspot://auth/callback`. Supabase-js parses the URL fragment automatically.

```tsx
export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(
    function waitForSessionAndRedirect() {
      // Supabase processes the OAuth response from the URL automatically.
      // Wait briefly for the session to settle, then navigate home.
      const id = setTimeout(() => {
        router.replace('/(tabs)');
      }, 500);
      return () => clearTimeout(id);
    },
    [router],
  );

  return (
    <View className="flex-1 items-center justify-center bg-bg-base">
      <ActivityIndicator color={colors.accent.DEFAULT} />
    </View>
  );
}
```

### Step 6: `useCurrentUser.ts`

```typescript
// src/shared/hooks/useCurrentUser.ts
export function useCurrentUser() {
  const auth = useAuth();
  const isAuthenticated = auth.status === 'authenticated';

  return useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => getApiUsersMe(), // Orval-generated
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });
}
```

### Step 7: Register callback route in `app/_layout.tsx`

```tsx
<Stack.Screen name="(auth)" options={{ headerShown: false }} />
```

And add `app/(auth)/_layout.tsx` as a simple `<Stack>` wrapper.

### Commit

```bash
git commit -m "feat(auth): login screen, useAuth hook, useRequireAuth, OAuth callback"
```

---

## Task 21: Migrate Frontend Services to Spring Boot API

**Goal:** Swap each service's internals from Supabase direct → Orval-generated API client. All 295+ existing tests must still pass.

**What must be complete before calling this task done:**

- `pnpm jest` — all tests still pass (service interface unchanged)
- `pnpm e2e:smoke` passes against a running Spring Boot server
- `EXPO_PUBLIC_API_URL` set in `.env`

### Step 1: Verify service interface contracts

Before touching any service file, confirm the function signatures that hooks depend on:

```typescript
// These signatures MUST NOT change:
searchGymsInBounds(bounds: MapBounds, filters: SearchFilters): Promise<GymWithMachineCount[]>
getGymById(gymId: string): Promise<Gym>
getGymMachines(gymId: string): Promise<GymMachineWithDetails[]>
getMachinePhotos(gymMachineId: string): Promise<MachinePhoto[]>
fetchBrands(): Promise<Brand[]>
fetchCategories(): Promise<Category[]>
```

### Step 2: Swap each service one by one

**`src/features/map/services/gym-search.ts`**

```typescript
import { getApiGymsSearch } from '@/shared/generated/api';

export async function searchGymsInBounds(
  bounds: MapBounds,
  filters: SearchFilters,
): Promise<GymWithMachineCount[]> {
  const response = await getApiGymsSearch({
    minLat: bounds.minLat,
    maxLat: bounds.maxLat,
    minLng: bounds.minLng,
    maxLng: bounds.maxLng,
    brandId: filters.brandId ?? undefined,
    categoryId: filters.categoryId ?? undefined,
    loadingType: filters.loadingType ?? undefined,
  });
  return response.data;
}
```

**`src/features/gym/services/gym-detail.ts`**

```typescript
import { getApiGymsId, getApiGymsIdMachines } from '@/shared/generated/api';

export async function getGymById(gymId: string): Promise<Gym> {
  const response = await getApiGymsId(gymId);
  return response.data;
}

export async function getGymMachines(gymId: string): Promise<GymMachineWithDetails[]> {
  const response = await getApiGymsIdMachines(gymId);
  return response.data;
}
```

**`src/features/photo/services/photo-list.ts`**

```typescript
import { getApiMachinesGymMachineIdPhotos } from '@/shared/generated/api';

export async function getMachinePhotos(gymMachineId: string): Promise<MachinePhoto[]> {
  const response = await getApiMachinesGymMachineIdPhotos(gymMachineId);
  return response.data;
}
```

**`src/features/map/services/brands.ts`** and **`categories.ts`** — same pattern.

### Step 3: Run full test suite

```bash
pnpm jest
```

All tests must still pass without modification. If any fail, the service interface was inadvertently changed — fix the service, not the test.

### Step 4: E2E smoke

```bash
pnpm e2e:smoke
```

Must pass against `EXPO_PUBLIC_API_URL=http://localhost:8080`.

### Commit

```bash
git commit -m "feat(services): migrate data source from supabase direct to spring boot api"
```

---

## Task 22: JOOQ Migration

**Goal:** Replace all `NamedParameterJdbcTemplate` raw SQL strings with JOOQ's type-safe DSL. All repository interfaces and service signatures stay unchanged — only the internals swap. Result: compile-time column/table validation, no raw SQL strings anywhere in the codebase.

### Why now

Task 24 onward adds write paths (photo upload, upvote, report). Starting those on JOOQ avoids having to migrate write queries later.

### Scope

- Add `jooq` + `jooq-codegen` to `build.gradle.kts`
- Run code generation against the Supabase schema (via Testcontainers in a `generateJooq` Gradle task)
- Migrate all repositories: `GymRepository`, `MachineRepository`, `PhotoRepository`, `BrandRepository`, `CategoryRepository`, `UserRepository`
- PostGIS spatial operators (`ST_Within`, `ST_DWithin`) expressed as JOOQ `DSL.field()` custom conditions
- Delete `NamedParameterJdbcTemplate` injection everywhere

### Verification

- All existing integration tests pass unchanged (same SQL semantics, different authoring)
- No raw SQL strings remain in `src/main/java`
- `./gradlew generateJooq` runs cleanly in CI

### Commit

```bash
git commit -m "refactor(persistence): replace JdbcTemplate raw SQL with JOOQ DSL"
```

---

## Task 23: Orval Type Alignment

**Goal:** Eliminate all `as unknown as` casts in the frontend service layer. The casts exist because Orval generates envelope types (`{ data: T, status: 200 } | { data: ErrorResponse, status: 500 }`) but `apiClient` returns the raw JSON body (`T`) directly via `ky.json()`. Fix the mismatch at the source so TypeScript types reflect runtime reality.

### Root cause

```
Orval-generated: listBrands() → Promise<{ data: BrandResponse[], status: 200 } | { data: ErrorResponse, status: 500 }>
apiClient actual: ky.json<T>() → T (raw body; ky throws on non-2xx)
```

Orval generates envelope types when the OpenAPI spec defines both 200 and error responses. `apiClient` never surfaces the envelope — it either returns the body or throws.

### Fix options (pick one)

**A. Orval config — `override.response`** (minimal change): configure Orval to treat the mutator as returning `T` directly. Regenerate; all `as unknown as` casts become unnecessary.

**B. apiClient wraps response**: change `apiClient` to return `{ data: T, status: number }` matching the envelope. Then service layer accesses `result.data` — no casts needed, but services change slightly.

Option A is preferred (no service layer change).

### Scope

- Investigate and apply the Orval config option that aligns generated types with `apiClient` return type
- Regenerate all Orval files (`pnpm orval`)
- Remove all `as unknown as` casts from `src/features/*/services/*.ts`
- Verify TypeScript still passes with no casts

### Verification

- `grep -r "as unknown as" src/features` returns nothing
- `pnpm exec tsc --noEmit` passes
- All 300+ tests pass

### Commit

```bash
git commit -m "refactor(orval): align generated types with apiClient, remove as-unknown-as casts"
```

---

## Task 24: Photo Upload Pipeline (Backend)

**Goal:** `POST /api/photos/upload` accepts compressed image + gymMachineId, runs Google Vision OCR, fuzzy-matches to `machine_templates`, uploads to Supabase Storage, and saves photo record to DB. OCR failure silently falls back — the endpoint always returns a result.

**What must be complete before calling this task done:**

- File type/size validation rejects invalid uploads (400)
- Unauthenticated upload rejected (401)
- Happy-path: photo saved to Storage, record in `machine_photos`, top OCR suggestions returned
- OCR failure: `ocrSucceeded: false`, `suggestions: []` returned — client shows "다시 시도" + "직접 입력", no server error
- Own-photo deletion works (`DELETE /api/photos/:id`)
- All tests pass

**Files to create:**

```
com/ironspot/photo/
├── PhotoController.java       (upload + delete)
├── PhotoService.java
├── PhotoRepository.java
├── OcrService.java            (Google Vision API)
├── FuzzyMatchService.java     (Levenshtein-based template matching)
├── StorageService.java        (Supabase Storage REST upload)
└── dto/
    ├── PhotoUploadResponse.java
    ├── MachineTemplateSuggestion.java
    └── PhotoResponse.java
src/test/java/com/ironspot/photo/
├── PhotoUploadTest.java
├── OcrServiceTest.java
└── FuzzyMatchServiceTest.java
```

### `PhotoController.java`

```java
@RestController
@RequestMapping("/api/photos")
@RequiredArgsConstructor
public class PhotoController {

    private final PhotoService photoService;

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<PhotoUploadResponse> upload(
        @AuthenticationPrincipal UserPrincipal principal,
        @RequestParam("image") MultipartFile image,
        @RequestParam("gymMachineId") UUID gymMachineId
    ) {
        return ApiResponse.ok(photoService.upload(principal.getUserId(), image, gymMachineId));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
        @AuthenticationPrincipal UserPrincipal principal,
        @PathVariable UUID id
    ) {
        photoService.deleteOwn(principal.getUserId(), id);
    }
}
```

### `PhotoService.java`

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class PhotoService {

    private final PhotoRepository photoRepository;
    private final OcrService ocrService;
    private final FuzzyMatchService fuzzyMatchService;
    private final StorageService storageService;

    @Transactional
    public PhotoUploadResponse upload(String userId, MultipartFile file, UUID gymMachineId) {
        validateImage(file);

        // Upload to Supabase Storage
        UUID photoId = UUID.randomUUID();
        String filename = photoId + ".webp";
        String photoUrl = storageService.upload(file.getBytes(), gymMachineId, filename);

        // OCR — failure returns ocrSucceeded:false + empty suggestions.
        // The client shows "다시 시도" / "직접 입력" options when ocrSucceeded is false.
        List<String> ocrTexts = List.of();
        boolean ocrSucceeded = false;
        try {
            ocrTexts = ocrService.extractText(file.getBytes());
            ocrSucceeded = !ocrTexts.isEmpty();
        } catch (Exception e) {
            log.warn("OCR failed for photo {}: {}", photoId, e.getMessage());
        }

        // Fuzzy match against machine templates
        List<MachineTemplateSuggestion> suggestions = fuzzyMatchService.findMatches(ocrTexts);

        // Save photo record
        photoRepository.insert(photoId, gymMachineId, userId, photoUrl);

        return PhotoUploadResponse.builder()
            .photoId(photoId)
            .photoUrl(photoUrl)
            .suggestions(suggestions)
            .ocrSucceeded(ocrSucceeded)
            .build();
    }

    private void validateImage(MultipartFile file) {
        if (file.isEmpty()) {
            throw new BusinessException("이미지가 비어 있습니다", HttpStatus.BAD_REQUEST);
        }
        if (file.getSize() > 2 * 1024 * 1024) {
            throw new BusinessException("이미지는 2MB 이하여야 합니다", HttpStatus.BAD_REQUEST);
        }
        String ct = file.getContentType();
        if (ct == null || !ct.startsWith("image/")) {
            throw new BusinessException("이미지 파일만 업로드할 수 있습니다", HttpStatus.BAD_REQUEST);
        }
    }

    public void deleteOwn(String userId, UUID photoId) {
        photoRepository.findById(photoId).ifPresent(photo -> {
            if (!userId.equals(photo.getUserId())) {
                throw new BusinessException("본인의 사진만 삭제할 수 있습니다", HttpStatus.FORBIDDEN);
            }
            photoRepository.delete(photoId);
            // Note: Supabase Storage file is soft-orphaned.
            // A periodic cleanup job removes orphaned files. Acceptable Phase 2 tradeoff.
        });
    }
}
```

### `OcrService.java`

```java
@Service
@RequiredArgsConstructor
public class OcrService {

    @Value("${google.vision.api-key}")
    private String apiKey;

    private final WebClient webClient;

    // Returns list of detected text strings from the image.
    // Throws on HTTP error or timeout — caller handles fallback.
    public List<String> extractText(byte[] imageBytes) {
        String base64 = Base64.getEncoder().encodeToString(imageBytes);
        // POST https://vision.googleapis.com/v1/images:annotate?key=...
        // body: { requests: [{ image: { content: base64 }, features: [{ type: "TEXT_DETECTION" }] }] }
        // Parse response.responses[0].textAnnotations[].description
        // Return as List<String>
    }
}
```

### `FuzzyMatchService.java`

Uses Jaccard similarity on word tokens. No external library needed.

```java
@Service
@RequiredArgsConstructor
public class FuzzyMatchService {

    private final MachineTemplateRepository templateRepository;

    public List<MachineTemplateSuggestion> findMatches(List<String> ocrTexts) {
        if (ocrTexts.isEmpty()) return List.of();

        String normalizedInput = String.join(" ", ocrTexts).toLowerCase();
        Set<String> inputTokens = tokenize(normalizedInput);

        return templateRepository.findAllApproved().stream()
            .map(t -> {
                String target = (t.getBrandName() + " " + t.getName()).toLowerCase();
                double score = jaccardSimilarity(inputTokens, tokenize(target));
                return new MachineTemplateSuggestion(t.getId(), t.getBrandName(), t.getName(), score);
            })
            .filter(s -> s.getScore() > 0.25)
            .sorted(Comparator.comparing(MachineTemplateSuggestion::getScore).reversed())
            .limit(3)
            .toList();
    }

    private Set<String> tokenize(String text) {
        return Set.of(text.split("\\s+"));
    }

    private double jaccardSimilarity(Set<String> a, Set<String> b) {
        Set<String> intersection = new HashSet<>(a);
        intersection.retainAll(b);
        Set<String> union = new HashSet<>(a);
        union.addAll(b);
        return union.isEmpty() ? 0 : (double) intersection.size() / union.size();
    }
}
```

### `FuzzyMatchServiceTest.java`

```java
class FuzzyMatchServiceTest {

    @Test
    void matchesPanattaHighRowExactly() {
        List<String> ocrTexts = List.of("PANATTA", "HIGH", "ROW");
        // Mock templateRepository to return [Panatta High Row, Panatta Low Row, ...]
        List<MachineTemplateSuggestion> results = service.findMatches(ocrTexts);
        assertThat(results.get(0).getName()).isEqualTo("High Row");
        assertThat(results.get(0).getScore()).isGreaterThan(0.5);
    }

    @Test
    void returnsEmptyListWhenOcrTextsAreEmpty() {
        assertThat(service.findMatches(List.of())).isEmpty();
    }

    @Test
    void filtersOutLowScoreMatches() {
        // OCR reads completely unrelated text
        List<String> ocrTexts = List.of("WATER", "BOTTLE");
        assertThat(service.findMatches(ocrTexts)).isEmpty();
    }
}
```

### `StorageService.java`

```java
@Service
@RequiredArgsConstructor
public class StorageService {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.service-role-key}")
    private String serviceRoleKey;

    private final WebClient webClient;

    // Upload to Supabase Storage via REST API. Returns public URL.
    public String upload(byte[] imageBytes, UUID gymMachineId, String filename) {
        String path = gymMachineId + "/" + filename;
        webClient.put()
            .uri(supabaseUrl + "/storage/v1/object/machine-photos/" + path)
            .header("Authorization", "Bearer " + serviceRoleKey)
            .header("Content-Type", "image/webp")
            .bodyValue(imageBytes)
            .retrieve()
            .bodyToMono(String.class)
            .block(Duration.ofSeconds(15));
        return supabaseUrl + "/storage/v1/object/public/machine-photos/" + path;
    }
}
```

### Commit

```bash
git commit -m "feat(api): photo upload pipeline with google vision OCR + fuzzy match"
```

---

## Task 25: Photo Upload UI (Frontend)

**Goal:** 3-step upload flow: gym select → camera/gallery → OCR confirm. Client-side compression before upload. Animations for OCR scan + upload progress. FAB button in PhotoGrid activated.

**What must be complete before calling this task done:**

- All 3 screens render and navigate correctly
- FAB in PhotoGrid navigates unauthenticated users to login, authenticated users to upload flow
- Photo compressed to < 500KB before sending (verified with logged file size in dev)
- OCR scan animation plays during upload
- Upload progress animation plays
- Success toast shown after registration
- Maestro `upload-flow.yaml` passes

**New dependencies:**

```bash
pnpm expo install expo-camera expo-image-picker
pnpm add react-native-image-resizer
```

**Files to create:**

```
src/features/upload/
├── hooks/
│   ├── usePhotoUpload.ts
│   └── useNaverPlacesSearch.ts     (placeholder for Task 26)
├── components/
│   ├── UploadGymSelectScreen.tsx
│   ├── UploadPhotoScreen.tsx
│   ├── UploadConfirmScreen.tsx
│   ├── OcrScanAnimation.tsx        (scan line reanimated)
│   ├── UploadProgressBar.tsx       (withTiming progress)
│   └── __tests__/
│       ├── UploadGymSelectScreen.test.tsx
│       └── UploadConfirmScreen.test.tsx
app/(upload)/
├── _layout.tsx
├── gym-select.tsx
├── photo.tsx
└── confirm.tsx
.maestro/flows/upload-flow.yaml
```

### Upload state machine (`usePhotoUpload.ts`)

```typescript
export type UploadStep = 'gym-select' | 'photo' | 'confirm';

interface UploadState {
  selectedGymId: string | null;
  selectedGymMachineId: string | null;
  photoUri: string | null;
  compressedBase64: string | null;
  ocrSuggestions: MachineTemplateSuggestion[];
  isUploading: boolean;
  uploadProgress: number; // 0–1
}
```

### `UploadGymSelectScreen.tsx`

```tsx
// Step 1: Select gym, then select machine within that gym.
// Renders useGymSearch results with current location + wide bounds (5km radius).
// Search field for gym name filter.
// "헬스장이 없어요?" section triggers Naver Places search (wired in Task 28 — stub here).
// On machine selection → navigate to /(upload)/photo
```

### `UploadPhotoScreen.tsx`

```tsx
// Step 2: Camera view (expo-camera) OR gallery picker (expo-image-picker).
// On capture/selection → compress with react-native-image-resizer:
//   maxWidth: 1200, maxHeight: 1200, compressFormat: 'WEBP', quality: 80
// Log compressed file size in __DEV__ to verify < 500KB
// Navigate to /(upload)/confirm with compressedUri
```

### `UploadConfirmScreen.tsx`

```tsx
// Step 3: Photo preview + OCR suggestions.
// On mount → POST /api/photos/upload
// While uploading: OcrScanAnimation over photo preview + UploadProgressBar
// On response (ocrSucceeded: true): show top 3 suggestions as radio buttons + "직접 입력" option
// On response (ocrSucceeded: false): show "다시 시도" (re-trigger upload) + "직접 입력" as the two options
// Register button → confirm selection → navigate back to gym detail
```

### `OcrScanAnimation.tsx`

```tsx
// Animated scan line using reanimated withRepeat + withTiming
export function OcrScanAnimation() {
  const translateY = useSharedValue(0);

  useEffect(
    function startScanLoop() {
      translateY.value = withRepeat(
        withTiming(200, { duration: 1500, easing: Easing.linear }),
        -1,
        true,
      );
      return () => cancelAnimation(translateY);
    },
    [translateY],
  );

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[style, { height: 2, backgroundColor: colors.accent.DEFAULT, opacity: 0.8 }]}
    />
  );
}
```

### `UploadProgressBar.tsx`

```tsx
// Animated progress bar: width from 0 → 100% via withTiming
export function UploadProgressBar({ progress }: { progress: number }) {
  const width = useSharedValue(0);

  useEffect(
    function animateProgress() {
      width.value = withTiming(progress, { duration: 300 });
    },
    [progress, width],
  );

  const style = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  return (
    <View className="h-1 bg-bg-muted rounded-full overflow-hidden">
      <Animated.View style={[style, { height: '100%', backgroundColor: colors.accent.DEFAULT }]} />
    </View>
  );
}
```

### Activate FAB in PhotoGrid

```tsx
// src/features/photo/components/PhotoGrid.tsx
// Replace Phase 1 stub:
const requireAuth = useRequireAuth();

function handleFabPress() {
  requireAuth(() => router.push('/(upload)/gym-select'));
}
```

### Maestro E2E

```yaml
# .maestro/flows/upload-flow.yaml
appId: com.ironspot.app
---
- launchApp
# Login first
- tapOn:
    id: tab-bar-my
- tapOn:
    accessibilityLabel: '로그인하기'
- assertVisible: 'Google로 계속하기'
# (Manual step: social login can't be automated in Maestro; test with test account)
# Assume logged in from here
- tapOn:
    id: tab-bar-map
- extendedWaitUntil:
    visible:
      id: gym-card-피트니스-팩토리
    timeout: 15000
- tapOn:
    id: gym-card-피트니스-팩토리
- tapOn:
    id: machine-row-low-row
- tapOn:
    id: upload-fab
- assertVisible: '어느 헬스장인가요?'
```

### Commit

```bash
git commit -m "feat(upload): 3-step photo upload flow with OCR confirm + animations"
```

---

## Task 26: Upvote System

**Goal:** Users can upvote/un-upvote photos. `@Transactional` on backend ensures count consistency. Optimistic update on frontend with rollback on error. Heart bounce animation.

**What must be complete before calling this task done:**

- Double-upvote is idempotent (UNIQUE constraint, no count change)
- Upvote → undo → count back to original (verified in test)
- Optimistic update shows immediately; rolls back on 5xx
- Heart animation plays on upvote tap

### Backend

```java
@RestController
@RequestMapping("/api/photos/{photoId}/upvote")
@RequiredArgsConstructor
public class VoteController {

    private final VoteService voteService;

    @PostMapping
    public ApiResponse<UpvoteResponse> upvote(
        @AuthenticationPrincipal UserPrincipal principal,
        @PathVariable UUID photoId
    ) {
        return ApiResponse.ok(voteService.upvote(principal.getUserId(), photoId));
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeUpvote(
        @AuthenticationPrincipal UserPrincipal principal,
        @PathVariable UUID photoId
    ) {
        voteService.removeUpvote(principal.getUserId(), photoId);
    }
}
```

```java
@Service
@RequiredArgsConstructor
public class VoteService {

    private final VoteRepository voteRepository;

    @Transactional
    public UpvoteResponse upvote(String userId, UUID photoId) {
        // Returns false if UNIQUE violation (already voted)
        boolean inserted = voteRepository.insertVote(userId, photoId);
        if (inserted) {
            voteRepository.incrementCount(photoId);
        }
        int newCount = voteRepository.getCount(photoId);
        return new UpvoteResponse(newCount, true);
    }

    @Transactional
    public void removeUpvote(String userId, UUID photoId) {
        boolean deleted = voteRepository.deleteVote(userId, photoId);
        if (deleted) {
            voteRepository.decrementCount(photoId);
        }
    }
}
```

```java
@Repository
@RequiredArgsConstructor
public class VoteRepository {

    private final JdbcTemplate jdbc;

    public boolean insertVote(String userId, UUID photoId) {
        try {
            jdbc.update(
                "INSERT INTO photo_votes (user_id, photo_id) VALUES (?::uuid, ?::uuid)",
                userId, photoId
            );
            return true;
        } catch (DataIntegrityViolationException e) {
            return false; // UNIQUE violation — already voted
        }
    }

    public boolean deleteVote(String userId, UUID photoId) {
        int rows = jdbc.update(
            "DELETE FROM photo_votes WHERE user_id = ?::uuid AND photo_id = ?::uuid",
            userId, photoId
        );
        return rows > 0;
    }

    public void incrementCount(UUID photoId) {
        jdbc.update("UPDATE machine_photos SET upvote_count = upvote_count + 1 WHERE id = ?::uuid", photoId);
    }

    public void decrementCount(UUID photoId) {
        jdbc.update(
            "UPDATE machine_photos SET upvote_count = GREATEST(0, upvote_count - 1) WHERE id = ?::uuid",
            photoId
        );
    }

    public int getCount(UUID photoId) {
        Integer count = jdbc.queryForObject(
            "SELECT upvote_count FROM machine_photos WHERE id = ?::uuid",
            Integer.class, photoId
        );
        return count != null ? count : 0;
    }
}
```

### Integration test

```java
@Test
void upvoteIsIdempotent() {
    // Insert test user + photo in DB
    voteService.upvote(userId, photoId);
    voteService.upvote(userId, photoId); // second call — no-op
    assertThat(voteRepository.getCount(photoId)).isEqualTo(1);
}

@Test
void upvoteThenRemoveRestoresCount() {
    voteService.upvote(userId, photoId);
    assertThat(voteRepository.getCount(photoId)).isEqualTo(1);
    voteService.removeUpvote(userId, photoId);
    assertThat(voteRepository.getCount(photoId)).isEqualTo(0);
}
```

### Frontend hook (`useUpvote.ts`)

```typescript
export function useUpvote(photoId: string) {
  const requireAuth = useRequireAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (isUpvoting: boolean) =>
      isUpvoting ? postApiPhotosPhotoIdUpvote(photoId) : deleteApiPhotosPhotoIdUpvote(photoId),

    onMutate: async (isUpvoting) => {
      await queryClient.cancelQueries({ queryKey: photoKeys.detail(photoId) });
      const previous = queryClient.getQueryData(photoKeys.detail(photoId));
      queryClient.setQueryData(photoKeys.detail(photoId), (old: PhotoDetail) => ({
        ...old,
        upvoteCount: old.upvoteCount + (isUpvoting ? 1 : -1),
        isUpvotedByMe: isUpvoting,
      }));
      return { previous };
    },

    onError: (_err, _vars, context) => {
      queryClient.setQueryData(photoKeys.detail(photoId), context?.previous);
      burnt.toast({ title: '오류가 발생했습니다', preset: 'error' });
    },
  });

  function handleUpvote(currentlyUpvoted: boolean) {
    requireAuth(() => mutation.mutate(!currentlyUpvoted));
  }

  return { handleUpvote, isPending: mutation.isPending };
}
```

### Heart animation in `PhotoDetailScreen`

```typescript
const heartScale = useSharedValue(1);

function triggerHeartBounce() {
  heartScale.value = withSequence(
    withSpring(1.5, { damping: 4, stiffness: 400 }),
    withSpring(1.0, { damping: 8, stiffness: 200 }),
  );
}
```

### Activate upvote button

```tsx
// PhotoDetailScreen.tsx
// Before (Phase 1 stub): non-interactive View with opacity 0.4
// After (Phase 2): wire useUpvote
const { handleUpvote, isPending } = useUpvote(photoId);

<Pressable
  onPress={() => {
    triggerHeartBounce();
    handleUpvote(isUpvotedByMe);
  }}
  disabled={isPending}
  accessibilityRole="button"
  accessibilityLabel={isUpvotedByMe ? '추천 취소' : `추천 ${upvoteCount}`}
  style={pressedOpacity}
>
  <Animated.View style={{ transform: [{ scale: heartScale }] }}>
    <MaterialIcons
      name={isUpvotedByMe ? 'favorite' : 'favorite-border'}
      size={24}
      color={colors.error}
    />
  </Animated.View>
  <AppText className="text-body-sm">{upvoteCount}</AppText>
</Pressable>;
```

### Commit

```bash
git commit -m "feat(vote): upvote system with @Transactional + optimistic update + heart animation"
```

---

## Task 27: Report System

**Goal:** Defense-in-depth content moderation. Three composing layers:

- **L1 (사전 차단)**: Vision SafeSearch at upload rejects obvious NSFW/violence; borderline content is published with `is_blinded=TRUE` and queued for admin
- **L2 (사용자 신고)**: 4 일반 사유는 3건 누적 시 자동 차단, 1 긴급 사유(본인/법적)는 1건 즉시 admin Slack 알림 (자동 차단은 안 함)
- **L3 (관리자 큐)**: `reports.status` 기반 + Slack webhook 알림. 정식 admin 도구는 Phase 3.

**What must be complete before calling this task done:**

- Vision SafeSearch enforced on every upload (reject `VERY_LIKELY` adult/violence, queue `LIKELY` for review)
- `POST /api/photos/{photoId}/reports` saves report with reason enum + optional 자유 입력
- 일반 사유 3건 누적 → `machine_photos.is_blinded = TRUE` + Slack 알림
- 긴급 사유(본인/법적) 1건 → Slack 즉시 알림 (자동 차단 X, 어뷰즈 방어)
- `(user_id, target_id)` UNIQUE 제약 — 같은 사용자가 같은 사진 중복 신고 불가
- 자기 사진 신고 시 400
- 일일 신고 한도 10건/유저 초과 시 429
- Blinded 사진은 `GET /api/machines/:id/photos`와 `findByGymMachineIds` 양쪽에서 제외
- PhotoDetailScreen 신고 버튼이 reason 선택 시트로 진입 (Option C 레이아웃, "기타" 선택 시 textarea 노출)

### Locked-in design decisions (이 task 시작 전 확정 — 재논의 X)

- **범위**: photo target만. `gym_machine` 신고는 Phase 3로 미룸 (정책/UI 정의 안 됨)
- **임계값**: 일반 3건 / 긴급 1건 (instant alert only, NOT instant blind)
- **계정 나이 게이트 없음** (OAuth-only로 Sybil 비용 이미 있음)
- **Abuse 이메일 채널 없음** — 본인/법적 신고는 인앱 카테고리로 흡수
- **신뢰 점수 / 자동 ban**: Phase 3
- **API 경로**: Task 26 컨벤션 따라 `/api/photos/{photoId}/reports` (path-based, body는 reason만)
- **응답 wrapper 없음** (Task 19에서 `ApiResponse<T>` 제거됨)

### Backend

#### Layer 1: Vision SafeSearch (OcrService 확장)

기존 OCR 호출에 feature 한 줄 추가. 별도 호출 없음.

```java
// OcrService — 기존 annotateImage 호출에 SAFE_SEARCH_DETECTION 추가
List<Feature> features = List.of(
    Feature.newBuilder().setType(Type.TEXT_DETECTION).build(),
    Feature.newBuilder().setType(Type.SAFE_SEARCH_DETECTION).build()
);

// 응답 처리
SafeSearchAnnotation safeSearch = response.getSafeSearchAnnotation();
SafeSearchVerdict verdict = SafeSearchVerdict.from(safeSearch);
// verdict ∈ { ALLOW, QUEUE_FOR_ADMIN, REJECT }
```

```java
public enum SafeSearchVerdict {
    ALLOW,            // 통과
    QUEUE_FOR_ADMIN,  // adult/violence == LIKELY → 게시하되 is_blinded=TRUE + admin 큐
    REJECT;           // adult/violence >= VERY_LIKELY → 400 거부

    public static SafeSearchVerdict from(SafeSearchAnnotation s) {
        Likelihood adult = s.getAdult();
        Likelihood violence = s.getViolence();
        if (adult == VERY_LIKELY || violence == VERY_LIKELY) return REJECT;
        if (adult == LIKELY || violence == LIKELY) return QUEUE_FOR_ADMIN;
        return ALLOW;
        // racy/medical/spoof는 헬스장 도메인 false positive가 많아 무시
    }
}
```

`PhotoService.upload()`:

- `REJECT` → `BusinessException("부적절한 콘텐츠로 감지되었습니다", 400)`
- `QUEUE_FOR_ADMIN` → `is_blinded=TRUE`로 INSERT + Slack 알림
- `ALLOW` → 정상 게시

#### Layer 2: Report endpoint

```java
@RestController
@RequestMapping(value = "/api/photos/{photoId}/reports", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(operationId = "reportPhoto")
    public void report(
        @AuthenticationPrincipal UserPrincipal principal,
        @PathVariable UUID photoId,
        @Valid @RequestBody CreateReportRequest request
    ) {
        reportService.createReport(principal.getUserId(), photoId, request);
    }
}
```

```java
public enum ReportReason {
    INAPPROPRIATE,    // 부적절한 사진 (NSFW/폭력)
    WRONG_MACHINE,    // 잘못된 기구 정보
    DUPLICATE,        // 중복 사진
    OTHER,            // 기타
    LEGAL_PERSONAL;   // 본인이 찍혔거나 법적 문제 (긴급)

    public boolean isUrgent() { return this == LEGAL_PERSONAL; }
}
```

```java
@Getter
public class CreateReportRequest {
    @NotNull private ReportReason reason;
    @Size(max = 500) private String detail;  // "기타" 선택 시 자유 입력, 그 외엔 null/비어있음 OK
}
```

```java
@Service
@RequiredArgsConstructor
public class ReportService {

    private static final int GENERAL_AUTO_BLIND_THRESHOLD = 3;
    private static final int DAILY_REPORT_CAP = 10;

    private final ReportRepository reportRepository;
    private final PhotoRepository photoRepository;
    private final AdminNotificationService adminNotifier;

    @Transactional
    public void createReport(String userId, UUID photoId, CreateReportRequest req) {
        UUID userUuid = parseUuid(userId);

        // 1. self-report guard
        if (photoRepository.isOwner(photoId, userUuid)) {
            throw new BusinessException("자신의 사진은 신고할 수 없습니다", HttpStatus.BAD_REQUEST);
        }

        // 2. daily cap
        int todayCount = reportRepository.countByReporterToday(userUuid);
        if (todayCount >= DAILY_REPORT_CAP) {
            throw new BusinessException("일일 신고 한도를 초과했습니다", HttpStatus.TOO_MANY_REQUESTS);
        }

        // 3. insert (UNIQUE on (user_id, target_id) — 중복 시 idempotent)
        boolean inserted = reportRepository.insertIfAbsent(userUuid, photoId, req.getReason(), req.getDetail());
        if (!inserted) {
            return;  // already reported — silent no-op (idempotent)
        }

        // 4. 분기: 긴급 vs 일반
        if (req.getReason().isUrgent()) {
            adminNotifier.notifyUrgentReport(photoId, userUuid, req);
            // 자동 차단 안 함 — 어뷰즈 방어
        } else {
            int pending = reportRepository.countPending(photoId);
            if (pending >= GENERAL_AUTO_BLIND_THRESHOLD) {
                photoRepository.setBlinded(photoId, true);
                adminNotifier.notifyAutoBlind(photoId, pending);
            }
        }
    }
}
```

#### Layer 3: Admin Slack webhook

```java
@Service
@RequiredArgsConstructor
public class AdminNotificationService {
    private final WebClient slackWebClient;
    @Value("${ironspot.slack.admin-webhook-url:}") private String webhookUrl;

    public void notifyUrgentReport(UUID photoId, UUID reporterId, CreateReportRequest req) {
        post(":rotating_light: URGENT report — photo " + photoId + " by " + reporterId
             + " (" + req.getReason() + ")");
    }

    public void notifyAutoBlind(UUID photoId, int reportCount) {
        post(":warning: Photo auto-blinded — " + photoId + " (" + reportCount + " reports)");
    }

    public void notifySafeSearchQueue(UUID photoId, String verdict) {
        post(":mag: SafeSearch queue — photo " + photoId + " (" + verdict + ")");
    }

    private void post(String text) {
        if (webhookUrl == null || webhookUrl.isBlank()) return;  // dev/test 환경에서 무동작
        slackWebClient.post().uri(webhookUrl)
            .bodyValue(Map.of("text", text))
            .retrieve().toBodilessEntity()
            .subscribe();  // fire-and-forget
    }
}
```

`application.yml`:

```yaml
ironspot:
  slack:
    admin-webhook-url: ${SLACK_ADMIN_WEBHOOK_URL:}
```

#### Repository (JOOQ)

- `insertIfAbsent`: `onConflictDoNothing()` on `(user_id, target_id)` UNIQUE
- `countPending(photoId)`: `WHERE target_id = ? AND status = 'pending'`
- `countByReporterToday(userId)`: `WHERE user_id = ? AND created_at >= NOW() - INTERVAL '24 hours'`
- `PhotoRepository.isOwner(photoId, userId)`
- `PhotoRepository.setBlinded(photoId, true)`

#### DB schema 변경

`reports` 테이블에 UNIQUE 제약 추가 + 인덱스. Supabase 프로덕션 마이그레이션 + `iron-spot-api/src/test/resources/init-test-db.sql` 양쪽 갱신.

```sql
ALTER TABLE reports
  ADD CONSTRAINT reports_unique_reporter_target UNIQUE (user_id, target_id);

CREATE INDEX IF NOT EXISTS reports_target_pending_idx
  ON reports (target_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS reports_reporter_recent_idx
  ON reports (user_id, created_at DESC);
```

#### Photo 쿼리에서 blinded 제외

`PhotoRepository.findByGymMachineId` **그리고** `findByGymMachineIds` 둘 다 갱신 (Task 21에서 batch fetch 도입됨).

```java
// JOOQ
.where(MACHINE_PHOTOS.GYM_MACHINE_ID.eq(gymMachineId))
.and(MACHINE_PHOTOS.IS_BLINDED.eq(false))
```

### Frontend

#### REPORT_REASONS

```ts
// src/features/photo/lib/reportReasons.ts
export type ReportReasonId =
  | 'INAPPROPRIATE'
  | 'WRONG_MACHINE'
  | 'DUPLICATE'
  | 'OTHER'
  | 'LEGAL_PERSONAL';

export const GENERAL_REASONS = [
  { id: 'INAPPROPRIATE', label: '부적절한 사진 (NSFW / 폭력)' },
  { id: 'WRONG_MACHINE', label: '잘못된 기구 정보' },
  { id: 'DUPLICATE', label: '중복 사진' },
  { id: 'OTHER', label: '기타' },
] as const satisfies ReadonlyArray<{ id: ReportReasonId; label: string }>;

export const URGENT_REASONS = [
  { id: 'LEGAL_PERSONAL', label: '본인이 찍혔거나 법적 문제' },
] as const satisfies ReadonlyArray<{ id: ReportReasonId; label: string }>;
```

#### ReportReasonSheet (Option C 레이아웃)

`@gorhom/bottom-sheet` 사용. 시각 그룹 분리(divider + section header), 라디오 단일 선택, "기타" 선택 시 textarea 노출, 제출 버튼.

```tsx
// 골격 (모든 props/handlers는 구현 시 채움)
<BottomSheet>
  <Section title="일반 사유">
    {GENERAL_REASONS.map(r => <RadioRow key={r.id} ... />)}
    {selected === 'OTHER' && (
      <TextInput
        multiline
        maxLength={500}
        placeholder="신고 사유를 입력해주세요"
        value={detail}
        onChangeText={setDetail}
        ...
      />
    )}
  </Section>
  <Divider />
  <Section title="긴급 (즉시 검토)">
    {URGENT_REASONS.map(r => <RadioRow key={r.id} ... />)}
  </Section>
  <SubmitButton disabled={!selected || submitting} onPress={handleSubmit} />
</BottomSheet>
```

#### useReport 훅

```ts
export function useReport(photoId: string) {
  const queryClient = useQueryClient();
  return useReportPhoto({
    // Orval-generated
    mutation: {
      onSuccess: () => {
        Toast.success('신고가 접수되었습니다');
        // 사용자 본인이 더 못 신고하게 cache 표시 (선택). 다른 사용자 view엔 영향 없음.
      },
      onError: (err) => {
        if (err.status === 429) Toast.error('일일 신고 한도를 초과했습니다');
        else if (err.status === 400) Toast.error('신고할 수 없는 사진입니다');
        else Toast.error('신고에 실패했습니다');
      },
    },
  });
}
```

#### PhotoDetailScreen 통합

기존 `ReportButtonDisabled` (View) → 활성 `Pressable`:

```tsx
const requireAuth = useRequireAuth();
const [sheetVisible, setSheetVisible] = useState(false);

function handleReport() {
  requireAuth(() => setSheetVisible(true));
}

<Pressable
  onPress={handleReport}
  accessibilityRole="button"
  accessibilityLabel="신고하기"
  style={pressedOpacity}
  className="h-10 w-10 items-center justify-center rounded-full bg-black/50"
>
  <MaterialIcons name="flag" size={20} color="#fff" />
</Pressable>

<ReportReasonSheet
  visible={sheetVisible}
  photoId={photo.id}
  onClose={() => setSheetVisible(false)}
/>
```

### Anti-abuse safeguards (요약)

| 위협                      | 방어                                                |
| ------------------------- | --------------------------------------------------- |
| 1인이 같은 사진 도배 신고 | `(user_id, target_id)` UNIQUE                       |
| 1인이 다수 사진 도배 신고 | 일일 한도 10건 (`countByReporterToday`)             |
| 자기 사진 신고            | `isOwner` 체크 → 400                                |
| 긴급 카테고리 어뷰즈      | 자동 차단 안 함, admin 알림만. admin이 dismiss 가능 |
| 5건 모일 때까지 노출      | 임계값 3 + Vision L1로 단축                         |

### Testing

- **Backend integration tests** (Testcontainers, 실 DB):
  - 일반 사유 1/2/3건 시 blind 상태 변화
  - 긴급 사유 1건 → blind 안 됨, AdminNotificationService.notifyUrgent 호출 검증 (mock)
  - UNIQUE 위반 시 idempotent (200 OK, 두 번째 insert 무시)
  - 자기 사진 신고 400
  - 일일 한도 초과 429
  - blinded 사진이 `GET /api/machines/:id/photos`에서 제외
- **Frontend tests**:
  - `useReport` mutation: success / 429 / 400 분기 toast
  - `ReportReasonSheet`: "기타" 선택 시 textarea 노출, 다른 선택 시 숨김
  - PhotoDetailScreen: 신고 버튼 비로그인 시 로그인 시트 → 로그인 후 신고 시트
- **Vision SafeSearch unit test**:
  - `SafeSearchVerdict.from`에 5단계 likelihood 조합으로 expected verdict 검증

### Slack webhook 설정

- `SLACK_ADMIN_WEBHOOK_URL` 환경변수 (운영자 워크스페이스)
- 미설정 시 `AdminNotificationService.post`가 no-op (개발/테스트 환경)

### OpenAPI / Orval 재생성

```bash
cd iron-spot-api && ./gradlew specExport
pnpm orval
```

신규 operationId: `reportPhoto`.

### Commit

```bash
git commit -m "feat(report): defense-in-depth content moderation (Vision + 3-count + Slack)"
```

---

## Task 28: New Gym Registration (Naver Places API)

**Goal:** When a gym isn't in the DB, the user can search Naver Places and auto-create a gym record. Prevents duplicate gyms. New gyms start unverified.

**What must be complete before calling this task done:**

- `/api/gyms/places-search` proxies Naver Places API correctly
- `POST /api/gyms` creates a new gym with `is_verified: false`
- Duplicate prevention: if `naverPlaceId` already exists in DB, returns the existing gym
- "헬스장이 없어요?" section in UploadGymSelectScreen is functional

**Note:** Requires Naver 지역검색 API credentials from developers.naver.com (separate from Maps SDK on NCloud). Gate: `NAVER_SEARCH_CLIENT_ID`, `NAVER_SEARCH_CLIENT_SECRET`. Naver auth uses `X-Naver-Client-Id` / `X-Naver-Client-Secret` headers (not Bearer).

### Backend

```java
// Proxy endpoint — never expose Naver API keys to client
@GetMapping("/api/gyms/places-search")
public ApiResponse<List<NaverPlaceResult>> searchPlaces(
    @RequestParam @NotBlank String query,
    @RequestParam @NotNull Double lat,
    @RequestParam @NotNull Double lng
) {
    return ApiResponse.ok(gymService.searchNaverPlaces(query, lat, lng));
}

@PostMapping("/api/gyms")
public ApiResponse<GymResponse> createGym(
    @AuthenticationPrincipal UserPrincipal principal,
    @Valid @RequestBody CreateGymRequest request
) {
    return ApiResponse.ok(gymService.createFromNaverPlaces(principal.getUserId(), request));
}
```

```java
@Getter
public class CreateGymRequest {
    @NotBlank private String name;
    @NotBlank private String address;
    @NotNull @DecimalMin("-90") @DecimalMax("90") private Double latitude;
    @NotNull @DecimalMin("-180") @DecimalMax("180") private Double longitude;
    private String phone;
    @NotBlank private String naverPlaceId;  // for dedup
}
```

```java
// GymService.createFromNaverPlaces — dedup logic
public GymResponse createFromNaverPlaces(String userId, CreateGymRequest req) {
    return gymRepository.findByNaverPlaceId(req.getNaverPlaceId())
        .orElseGet(() -> {
            UUID gymId = UUID.randomUUID();
            gymRepository.insertFromNaverPlaces(gymId, req); // is_verified = false
            return gymRepository.findById(gymId).orElseThrow();
        });
}
```

### Frontend (UploadGymSelectScreen stub → full)

```tsx
// "헬스장이 없어요?" section
function GymNotFoundSection({ onGymCreated }: { onGymCreated: (gymId: string) => void }) {
  const [query, setQuery] = useState('');
  const { location } = useCurrentLocation();
  const { data: places, isPending } = useNaverPlacesSearch(query, location);

  return (
    <View className="mt-4 border-t border-border-DEFAULT pt-4">
      <AppText className="text-body-sm text-text-secondary mb-2">찾는 헬스장이 없나요?</AppText>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="헬스장 이름 검색"
        className="border border-border-DEFAULT rounded-md px-3 py-2 text-body mb-2"
      />
      {isPending && <ActivityIndicator />}
      {places?.map((place) => (
        <Pressable
          key={place.id}
          onPress={() => handleSelectNaverPlace(place, onGymCreated)}
          style={pressedOpacity}
          className="py-3 border-b border-border-subtle"
        >
          <AppText className="text-body">{place.name}</AppText>
          <AppText className="text-body-sm text-text-tertiary">{place.address}</AppText>
        </Pressable>
      ))}
    </View>
  );
}
```

### Commit

```bash
git commit -m "feat(gym): new gym registration via naver places api proxy"
```

---

## Task 29: My Page

**Goal:** Full My Page replacing the Phase 1 "Phase 2에서 제공 예정" stub. Shows profile, my uploads, my upvoted photos, logout. Non-authenticated users see a login prompt empty state.

**What must be complete before calling this task done:**

- Non-logged-in user sees "로그인이 필요해요" empty state with "로그인하기" CTA
- Logged-in user sees nickname, join date, my-photos count, my-votes count
- My photos list → tap → navigates to that photo's gallery (same path as Phase 1 map flow)
- Logout clears session and shows login prompt

### Backend endpoints

```java
@GetMapping("/api/users/me/photos")
public ApiResponse<List<PhotoResponse>> getMyPhotos(
    @AuthenticationPrincipal UserPrincipal principal
) {
    return ApiResponse.ok(photoService.findByUserId(principal.getUserId()));
}

@GetMapping("/api/users/me/votes")
public ApiResponse<List<PhotoResponse>> getMyVotes(
    @AuthenticationPrincipal UserPrincipal principal
) {
    return ApiResponse.ok(voteService.getUpvotedPhotos(principal.getUserId()));
}
```

### `ProfileScreen.tsx`

```tsx
export function ProfileScreen() {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return <ProfileSkeleton />;
  }

  if (auth.status === 'anonymous') {
    return <LoginPromptEmptyState />;
  }

  return <AuthenticatedProfile />;
}

function LoginPromptEmptyState() {
  return (
    <EmptyState
      icon="person-off"
      title="로그인이 필요해요"
      description="내 사진과 추천 목록을 보려면 로그인하세요"
      action={<Button label="로그인하기" onPress={() => router.push('/(auth)/login')} />}
    />
  );
}

function AuthenticatedProfile() {
  const { data: user } = useCurrentUser();
  const { data: myPhotos } = useMyPhotos();
  const { data: myVotes } = useMyVotes();

  async function handleLogout() {
    await supabase.auth.signOut();
    queryClient.clear();
    burnt.toast({ title: '로그아웃했습니다', preset: 'done' });
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      {/* Profile header */}
      <View className="items-center py-6 gap-2 border-b border-border-DEFAULT">
        <View className="w-16 h-16 rounded-full bg-bg-muted items-center justify-center">
          <MaterialIcons name="person" size={32} color={colors.text.tertiary} />
        </View>
        <AppText className="text-heading-sm font-semibold text-text-primary">
          {user?.nickname}
        </AppText>
        <AppText className="text-body-sm text-text-tertiary">
          가입일: {user ? formatVerifiedDate(user.createdAt) : ''}
        </AppText>
      </View>

      {/* Menu rows */}
      <ProfileMenuRow
        icon="photo-library"
        label="내가 올린 사진"
        badge={`${myPhotos?.length ?? 0}장`}
        onPress={() => router.push('/my-photos')}
      />
      <ProfileMenuRow
        icon="favorite"
        label="내가 추천한 사진"
        badge={`${myVotes?.length ?? 0}장`}
        onPress={() => router.push('/my-votes')}
      />

      <View className="border-t border-border-DEFAULT mt-4" />

      <ProfileMenuRow
        icon="settings"
        label="계정 설정"
        onPress={() => router.push('/account-settings')}
      />
      <ProfileMenuRow
        icon="logout"
        label="로그아웃"
        onPress={() => {
          void handleLogout();
        }}
      />
    </SafeAreaView>
  );
}
```

### `ProfileSkeleton.tsx`

```tsx
// Matches AuthenticatedProfile layout: avatar circle + 2 text lines + 4 menu rows
```

### Commit

```bash
git commit -m "feat(profile): my page with photos, votes, logout, login prompt"
```

---

## Task 30: Account Settings

**Goal:** 닉네임 편집 + 계정 삭제 (App Store 요구사항). 백엔드의 `DELETE /api/users/me`는 익명화 + tombstone (`anonymizePhotos` + `deleteVotes` + `markDeleted(deleted_at)`) 만 수행한다. 사진 파일과 row는 그대로 유지되며 `user_id`만 NULL이 된다. 복구 경로/스케줄 hard-delete 없음.

### Decisions (entry grilling, 2026-05-11)

Task 30 시작 전 spec과 실제 코드 사이 8건 mismatch + 사진 정책 1건을 정리한 결과:

| #   | 항목             | 결정                                                                                                                                   | Why                                                                                                            |
| --- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | 다이얼로그 카피  | 백엔드 동작에 정합. "30일 복구" 문구 제거. 사진 익명화 명시                                                                            | spec의 "30/32일 후 영구 삭제"는 백엔드에 미구현 → 거짓 약속 회피                                               |
| 2   | Mutation 패턴    | Orval `useUpdateMe` / `useDeleteMe` raw inline. wrapper hook 없음                                                                      | nickname/delete 모두 단일 화면 사용 + 비자명 로직 없음. CLAUDE.md "no abstractions for single-use code"        |
| 3   | 헤더             | `ScreenHeader` 공용 컴포넌트 만들지 않음. `AccountSettingsScreen` 안 internal `Header` function                                        | 즉시 재사용처 1곳뿐. 3번째 사용처 생기면 그때 추출 (참고: `MyPhotoListView.Header` 와 유사 형태)               |
| 4   | 진입 동선        | `AuthenticatedProfile`에 `ProfileMenuRow icon="settings" label="계정 설정"` 추가 (로그아웃 위). `PROFILE_ROUTES.accountSettings` 추가  | Task 29에서 deferred로 명시된 항목. 메뉴 행 없이는 화면 접근 불가                                              |
| 5   | Delete 후 흐름   | `useDeleteMe.onSuccess`에서 inline `supabase.auth.signOut()` + `queryClient.clear()` + 삭제 토스트 + `router.replace('/(auth)/login')` | `useLogout`은 토스트 메시지가 "로그아웃했습니다"로 하드코딩 → delete 흐름에 부정확. inline 처리                |
| 6   | Query key 무효화 | `userKeys.me(userId)` factory 사용                                                                                                     | `useCurrentUser`가 동일 키로 등록 → factory 미사용 시 key 불일치로 invalidate no-op 위험                       |
| 7   | 닉네임 검증      | 클라(trim 후 2–20자) + 서버(`@Size(min=2, max=20)`) 이중                                                                               | 즉시 피드백 + 단일 메시지("닉네임은 2~20자여야 합니다") 양쪽 동일 → drift 위험 작음                            |
| 8   | Confirmation     | `Alert.alert` (RN 기본). 코드베이스 최초 사용                                                                                          | destructive confirmation에 표준 UX                                                                             |
| 9   | 사진 정책        | 익명화 유지 (현재 백엔드 동작 그대로). 백엔드 변경 0                                                                                   | IronSpot 핵심 가치 = 헬스장 기구 정보. 1명 탈퇴로 헬스장 데이터 깎이면 앱 가치 하락. Reddit/StackOverflow 패턴 |

**Phase 3 백로그 추가 권장:** 머신 사진 PII 검열 (얼굴/문신 등). 현재 SafeSearch는 adult/violence만 검출 → 익명화 정책의 전제 조건 미구현. `docs/plans/phase-3/README.md` Carried-over 섹션 참조.

### What must be complete before calling this task done

- 닉네임 편집: 2–20자 trim 검증, `PUT /api/users/me` 호출 (Orval `useUpdateMe`), 성공 토스트, `userKeys.me(userId)` invalidate
- 계정 삭제: `Alert.alert` 확인 → `DELETE /api/users/me` (Orval `useDeleteMe`) → `signOut` + `queryClient.clear()` + 토스트 + `router.replace('/(auth)/login')`
- 연결된 계정 이메일 표시 (`useCurrentUser().data.email`)
- `AuthenticatedProfile`에서 `/account-settings`로 진입 가능 (메뉴 행 추가됨)

### Files to create / modify

```
NEW  src/features/profile/components/AccountSettingsScreen.tsx
NEW  src/features/profile/components/__tests__/AccountSettingsScreen.test.tsx
NEW  app/account-settings.tsx
MOD  src/features/profile/routes.ts                                  # accountSettings 추가
MOD  src/features/profile/components/AuthenticatedProfile.tsx        # ProfileMenuRow 추가
MOD  src/features/profile/components/__tests__/AuthenticatedProfile.test.tsx
```

### `AccountSettingsScreen.tsx`

```tsx
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as burnt from 'burnt';

import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useAuthenticatedUserId } from '@/features/auth/hooks/useAuthenticatedUserId';
import { userKeys } from '@/features/auth/query-keys';
import { AppText } from '@/shared/components/AppText';
import { Button } from '@/shared/components/Button';
import { useDeleteMe, useUpdateMe } from '@/shared/generated/users/users';
import { pressedOpacity } from '@/shared/lib/pressable';
import { supabase } from '@/shared/lib/supabase';
import { colors } from '@/shared/theme/tokens';

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 20;
const HEADER_ICON_SIZE = 24;

export function AccountSettingsScreen() {
  const userId = useAuthenticatedUserId();
  const userQuery = useCurrentUser();
  const queryClient = useQueryClient();
  const user = userQuery.data;

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const updateMutation = useUpdateMe({
    mutation: {
      onSuccess: () => {
        if (userId !== null) {
          void queryClient.invalidateQueries({ queryKey: userKeys.me(userId) });
        }
        setIsEditing(false);
        burnt.toast({ title: '닉네임이 변경되었습니다', preset: 'done' });
      },
      onError: () => burnt.toast({ title: '변경에 실패했습니다', preset: 'error' }),
    },
  });

  const deleteMutation = useDeleteMe({
    mutation: {
      onSuccess: async () => {
        await supabase.auth.signOut();
        queryClient.clear();
        burnt.toast({ title: '계정이 삭제되었습니다', preset: 'done' });
        router.replace('/(auth)/login');
      },
      onError: () => burnt.toast({ title: '삭제에 실패했습니다', preset: 'error' }),
    },
  });

  function handleStartEdit() {
    setDraft(user?.nickname ?? '');
    setIsEditing(true);
  }

  function handleSaveNickname() {
    const trimmed = draft.trim();
    if (trimmed.length < NICKNAME_MIN || trimmed.length > NICKNAME_MAX) {
      burnt.toast({ title: '닉네임은 2~20자여야 합니다', preset: 'error' });
      return;
    }
    updateMutation.mutate({ data: { nickname: trimmed } });
  }

  function handleDeleteAccount() {
    Alert.alert(
      '계정을 삭제하시겠어요?',
      '계정과 추천 기록이 영구 삭제됩니다.\n업로드한 사진은 익명으로 헬스장 데이터에 남습니다.\n되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(undefined),
        },
      ],
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <Header title="계정 설정" onBack={router.back} />

      {/* Nickname row */}
      <View className="px-4 py-4 border-b border-border-DEFAULT">
        <AppText className="text-body-sm text-text-secondary mb-2">닉네임</AppText>
        {isEditing ? (
          <View className="flex-row items-center gap-2">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              className="flex-1 border border-border-focus rounded-md px-3 py-2 text-body"
              maxLength={NICKNAME_MAX}
              autoFocus
              accessibilityLabel="닉네임 입력"
            />
            <Button
              label="저장"
              size="sm"
              onPress={handleSaveNickname}
              loading={updateMutation.isPending}
            />
            <Button label="취소" size="sm" variant="ghost" onPress={() => setIsEditing(false)} />
          </View>
        ) : (
          <View className="flex-row items-center justify-between">
            <AppText className="text-body">{user?.nickname ?? ''}</AppText>
            <Pressable
              onPress={handleStartEdit}
              accessibilityRole="button"
              accessibilityLabel="닉네임 수정"
              style={pressedOpacity}
            >
              <AppText className="text-body-sm text-accent">수정</AppText>
            </Pressable>
          </View>
        )}
      </View>

      {/* Connected account row */}
      <View className="px-4 py-4 border-b border-border-DEFAULT">
        <AppText className="text-body-sm text-text-secondary mb-2">연결된 계정</AppText>
        <AppText className="text-body">{user?.email ?? ''}</AppText>
      </View>

      {/* Delete account, pushed to bottom */}
      <View className="flex-1 justify-end px-4 pb-8">
        <Pressable
          onPress={handleDeleteAccount}
          accessibilityRole="button"
          accessibilityLabel="계정 삭제"
          style={pressedOpacity}
          className="items-center py-3"
          disabled={deleteMutation.isPending}
        >
          <AppText className="text-body text-error">계정 삭제</AppText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View className="flex-row items-center px-4 py-3 border-b border-border-DEFAULT">
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="뒤로 가기"
        style={pressedOpacity}
        className="pr-3"
      >
        <MaterialIcons
          name="arrow-back"
          size={HEADER_ICON_SIZE}
          color={colors.text.primary}
          importantForAccessibility="no"
          accessibilityElementsHidden={true}
        />
      </Pressable>
      <AppText accessibilityRole="header" className="text-heading-sm text-text-primary">
        {title}
      </AppText>
    </View>
  );
}
```

### `AuthenticatedProfile.tsx` 수정

`PROFILE_ROUTES`에 `accountSettings` 추가 후 로그아웃 메뉴 행 **위**에 새 행을 끼워 넣는다.

```tsx
// src/features/profile/routes.ts
export const PROFILE_ROUTES = {
  myPhotos: '/my-photos',
  myVotes: '/my-votes',
  accountSettings: '/account-settings', // NEW
} as const;

// AuthenticatedProfile.tsx — 로그아웃 위에 한 행 추가
function navigateToAccountSettings() {
  router.push(PROFILE_ROUTES.accountSettings);
}

// JSX 안 (border-t mt-4 다음, 로그아웃 위)
<ProfileMenuRow
  testID="profile-menu-account-settings"
  icon="settings"
  label="계정 설정"
  onPress={navigateToAccountSettings}
/>;
```

### `app/account-settings.tsx`

```tsx
import { AccountSettingsScreen } from '@/features/profile/components/AccountSettingsScreen';

export default function AccountSettingsRoute() {
  return <AccountSettingsScreen />;
}
```

### Tests (RED 단계)

`AccountSettingsScreen.test.tsx` 최소 케이스:

- 닉네임을 `user?.nickname`으로 표시 + "수정" 버튼 렌더
- "수정" 누르면 `TextInput`이 현재 닉네임으로 채워져 노출
- 저장 시 trim 후 1자 / 21자면 에러 토스트 + mutation 미호출
- 정상 길이 저장 시 `useUpdateMe`의 mutationFn 호출됨 (Orval 모킹) + 성공 시 invalidate
- 연결된 이메일 (`user?.email`) 표시
- "계정 삭제" 버튼 렌더 + 누르면 `Alert.alert` 호출됨 (Alert을 spy)
- 확인 → `useDeleteMe` 호출 → signOut + queryClient.clear + router.replace

`AuthenticatedProfile.test.tsx` 보강:

- "계정 설정" 메뉴 행 렌더 + 클릭 시 `router.push('/account-settings')` 호출

### Workflow

1. RED: 위 테스트 작성, 실패 확인
2. GREEN: AccountSettingsScreen + 라우트 + AuthenticatedProfile 메뉴 행
3. REFACTOR: 매직 넘버 분리(`NICKNAME_MIN/MAX`), pressable handler named function
4. `code-reviewer` 디스패치 → `ff-review:review`
5. 피드백 반영
6. Quick verify (`pnpm lint && pnpm exec tsc --noEmit && pnpm test`)
7. Task 경계: `/verify` (FE 변경 → FF review 필수) → `/commit-task 30`
8. PROGRESS.md 업데이트

### Commit

```bash
git commit -m "feat(account): nickname edit + account deletion (app store requirement)"
```

---

## Task 31: Monitoring + Sentry + Admin Alerts

**Goal:** Sentry error tracking in app and API (DSN-gated, fail-open). Structured JSON logging via Logback in prod profile. Slack admin webhook operations playbook + repeatable smoke endpoint. Code + local verification only — live "in production" verification of all three paths moves to Task 32 (post-Railway deploy).

### Pre-Task decisions (2026-05-11)

Resolved via grill before implementation. Recorded here so the rationale survives the PR.

1. **"in production" verification splits to Task 32.** Spec's "actuator/health UP in production", "logs JSON in prod profile (live)", "Slack 3-path live delivery" all require Railway deployment which prereqs Task 32. Task 31 scope: code + settings + local verification + operations playbook. Live prod verification: Task 32 done criteria.
2. **Sentry SDK pins (exact, no caret).**
   - App: `@sentry/react-native@8.9.2`. Latest is 8.11.0 but 8.10+ has an iOS crash with `AVAssetDownloadURLSession` (upstream `getsentry/sentry-react-native#7886`). 8.9.2 ships sentry-cocoa 9.11.0 which is the safe baseline. Bump when fix lands.
   - Server: `io.sentry:sentry:8.41.0` (core SDK only). The Spring Boot starter `sentry-spring-boot-starter-jakarta:8.41.0` still references Spring Boot 3.x's `WebClientCustomizer` in its auto-config, which Spring Boot 4 reorganised away. Initialise manually in `SentryConfig` and bridge unhandled exceptions through `GlobalExceptionHandler`. Revisit when Sentry ships a Spring Boot 4 starter.
   - Logstash encoder: `net.logstash.logback:logstash-logback-encoder:9.0` (latest stable 2025-10-26).
3. **DSN-missing → fail-open, never throw.** App: skip `Sentry.init` when `EXPO_PUBLIC_SENTRY_DSN` is empty/undefined, log one debug line. Server: `SentryConfig.initSentry` skips `Sentry.init` entirely when `sentry.dsn` is empty/blank — no separate `enabled` flag, the empty-DSN contract is the single source of truth. Result: dev environments emit zero Sentry traffic without manual setup.
4. **Single external-setup checkpoint = PR merge.** All code lands with empty env defaults. User provisions Sentry org + 2 projects (app/server), Slack webhook, and EAS sourcemap auth token after merge. Operational smoke (Task 32) consumes these.
5. **Two Sentry projects, not one.** App and server use different SDKs and have different release cadences. Separate projects keep dashboards readable. `EXPO_PUBLIC_SENTRY_DSN` (app) ≠ `SENTRY_DSN` (server).
6. **Logging strategy = `logback-spring.xml` with profile split.** Remove the manual `logging.pattern.console` JSON from `application-prod.yml` (manual JSON breaks on stack traces and multi-line messages; was prod-only already so dev was unaffected). Prod profile → `LogstashEncoder` via logback xml. Non-prod → Spring Boot default (`base.xml`, human-readable colour console). `application-prod.yml` holds Sentry prod overrides; logging stays in xml.
7. **Slack smoke = gated admin endpoint, not 4-account flow.** Reproducing all 3 webhook paths via real reports needs 4 distinct Google accounts + a SafeSearch `LIKELY` borderline image (sourcing problem). Instead ship `POST /api/_admin/slack-smoke/{path}` with two gates: JWT-authenticated AND `IRONSPOT_SLACK_SMOKE_ENABLED=true` env. Toggle env in Railway for the 5-minute smoke window in Task 32, then untoggle. Business-logic correctness of report flow is covered by existing IT tests; the smoke endpoint exists only to verify webhook reachability post-deploy.
8. **Sentry RN integration = full (plugin + sourcemaps), not JS-only.** JS-only `Sentry.init` misses native crashes (`NSException`, JVM `NoSuchMethodError`). Add `@sentry/react-native/expo` Expo config plugin so iOS/Android native layers are instrumented. Wire sourcemap upload via `@sentry/expo-upload-sourcemaps` (already bundled in 8.9.2) so prod Hermes stack traces are readable.
9. **TanStack Query errors → Sentry only on 5xx + network.** Configure `QueryCache`/`MutationCache` global `onError`. Filter: HTTPError with `response.status >= 500` OR `TypeError` (network failure) → `Sentry.captureException`. 4xx (validation, auth) is user-impact noise and goes to toast only. Component-level `onError` handlers continue to receive everything.
10. **Sentry user context = id only on auth, cleared on logout.** `Sentry.setUser({ id: session.user.id })` after `useAuth` resolves authenticated, `Sentry.setUser(null)` on `signOut`. No email/nickname (PII minimisation).
11. **Sentry environment + release + sample rates.**
    - App: `environment: __DEV__ ? 'development' : 'production'`. Release auto-derived by Expo plugin. `tracesSampleRate: __DEV__ ? 1.0 : 0.1`.
    - Server: prod profile `environment: production` + `traces-sample-rate: 0.05`. Dev profile `environment: development` + `traces-sample-rate: 0.5` (cheap signal during integration testing). Release derives from build info if available, else SDK-inferred.
12. **Coverage rule waived for SDK-wiring code.** `Sentry.init` is mock-mirror-only if tested; same for `application-prod.yml` and `logback-spring.xml`. Per `~/.claude/rules/testing.md` anti-patterns: do not mock the SDK to assert its own surface. Two real tests instead:
    - Frontend: extend `ErrorBoundary.test.tsx` with one case mocking `@sentry/react-native`'s `captureException` only (not `init`) and asserting the onError path invokes it once.
    - Backend: `LogbackProdProfileIT` boots with `@ActiveProfiles("prod")` + `OutputCaptureExtension`, emits one log line, asserts the stdout line parses as JSON via `ObjectMapper.readTree` and includes LogstashEncoder-specific fields (`@version`, `thread_name`) so a regression to the old manual `logging.pattern.console` JSON would fail.
    - Backend: `SlackSmokeControllerIT` + `SlackSmokeControllerDisabledIT` — unauthenticated → 401; authenticated + env disabled → 404 (controller bean not registered); authenticated + env enabled → 204 + mocked `AdminNotificationService` invoked with the sentinel UUIDs.
    - Backend: `GlobalExceptionHandler` is touched (Sentry.captureException on 5xx BusinessException + 5xx unexpected; NoResourceFoundException → 404). Existing handler tests still pass; the Sentry call is intentionally not asserted (would be a mock-mirror) — it no-ops on empty DSN which is the test default.

### What must be complete before calling this task done (Task 31 scope)

Local + code-level only. Anything labelled "(prod)" moves to Task 32.

- `@sentry/react-native@8.9.2` exact-pinned in `package.json`. Expo config plugin registered in `app.config.ts`.
- App: `Sentry.init` wired in `app/_layout.tsx` with DSN-empty fail-open.
- App: `ErrorBoundary` `onError` → `Sentry.captureException(error, { extra: { componentStack } })`.
- App: `queryClient` has `QueryCache`/`MutationCache` `onError` reporting 5xx + network errors to Sentry.
- App: `useAuth` state change → `Sentry.setUser({ id })` or `setUser(null)`. Single hook entry, not scattered.
- Server: `io.sentry:sentry:8.41.0` (core SDK) added; `SentryConfig` reads `sentry.dsn` / `sentry.environment` / `sentry.traces-sample-rate` and calls `Sentry.init` manually, skipping when DSN is blank. `application.yml` holds dev defaults, `application-prod.yml` overrides to prod values.
- Server: `logstash-logback-encoder:9.0` added; `logback-spring.xml` profiles prod (LogstashEncoder) vs `!prod` (`base.xml`).
- Server: `logging.pattern.console` removed from `application-prod.yml` (Logback xml owns the prod format now).
- Server: `application-prod.yml` populated with Sentry env wiring + `spring.profiles.active=prod` documentation.
- Server: `POST /api/_admin/slack-smoke/{path}` controller behind two gates (JWT + `IRONSPOT_SLACK_SMOKE_ENABLED`).
- `.env.example` (app) adds `EXPO_PUBLIC_SENTRY_DSN=` and `SENTRY_AUTH_TOKEN=` (empty placeholders, comments explaining purpose + how to obtain).
- `iron-spot-api/.env.example` adds `SENTRY_DSN=`, `SLACK_ADMIN_WEBHOOK_URL=`, `IRONSPOT_SLACK_SMOKE_ENABLED=false`.
- `docs/harness/operations.md` created: Sentry org/project setup, Slack workspace + webhook, EAS sourcemap auth token, env var checklist for Railway, smoke endpoint usage procedure, webhook rotation cadence.
- Tests above (12 in decisions): `ErrorBoundary` Sentry case, `LogbackProdProfileIT`, `SlackSmokeControllerIT`. All existing tests still green.
- Local verification captured in PR description: `curl localhost:8080/actuator/health` → `{"status":"UP"}`; `SPRING_PROFILES_ACTIVE=prod ./gradlew bootRun` stdout line parses as JSON.

### Deferred to Task 32 (Phase 2 Final Verification, post-Railway)

- Live `GET /actuator/health` → UP on Railway URL.
- Live `SPRING_PROFILES_ACTIVE=prod` log line shape verified in Railway logs.
- Slack 3-path smoke via toggle: set `IRONSPOT_SLACK_SMOKE_ENABLED=true` → 3× `curl POST /api/_admin/slack-smoke/{urgent,autoblind,safesearch}` → confirm 3 Slack messages → untoggle.
- Sentry app + server: intentional throw in prod build, verify event reaches each dashboard with readable symbolicated stack.

### Subtask order

1. **Backend monitoring base** — Sentry starter + Logback profile split + `application-prod.yml` + remove manual JSON pattern from `application.yml`. Local verify: prod profile boot emits parseable JSON.
2. **Slack smoke endpoint** — controller + two-gate security + `IRONSPOT_SLACK_SMOKE_ENABLED` env binding + IT. Local verify: env disabled → 404, env enabled + auth → 200.
3. **Frontend Sentry wiring** — `pnpm expo install @sentry/react-native` (pin downgraded to 8.9.2 after install), Expo plugin in `app.config.ts`, `Sentry.init` in `_layout.tsx` with fail-open, `ErrorBoundary` onError, `queryClient` cache onError filters, `useAuth` user context wiring, sourcemap upload script.
4. **Env examples** — both `.env.example` files updated.
5. **Operations playbook** — `docs/harness/operations.md` written with all setup steps and the smoke procedure.
6. **Decisions log + Java fix** — append Task 31 decisions to this file, fix Java 27 → 25 strays (already done pre-implementation).

### Commit

```bash
git commit -m "feat(monitoring): sentry + actuator + structured JSON logging + slack smoke"
```

---

## Task 32: Phase 2 Final Verification

**Goal:** All E2E flows pass. Security, performance, and App Store code-level checks complete. Live verification of Render-hosted Spring Boot, Sentry (app + api), and Slack moderation alerts. Phase 2 locked and ready to hand off to Phase 3 / Pre-Launch Backlog work.

### Pre-Task decisions (2026-05-12)

Resolved via grill before implementation. Recorded here so the rationale survives the split PRs.

1. **Task 32 splits into 32a (code/docs prep) and 32b (post-provisioning live verify).** Hosting provisioning is a user-side external action (account, env vars, first deploy) that Claude cannot perform. Splitting avoids a long-open 32a PR blocked on external work and mirrors the Task 31 pattern of "code now, live later". 32a lands first; 32b begins after the user signals the service is up.
2. **Spring Boot connects to Supabase Postgres, not a separate managed Postgres on the hosting platform.** Reason: zero data migration, single schema source of truth (Supabase migrations), Auth/Storage/DB stay in one place. Trade-off: hosting-platform-to-Supabase network hop. Mitigation: conservative HikariCP `maximum-pool-size` in `application-prod.yml`. Phase 3 may revisit if Supabase pricing or latency becomes a constraint.
3. **Sentry server-side throw verification uses a smoke endpoint, not add-then-revert.** Mirror the Task 31 Slack smoke pattern: `POST /api/_admin/sentry-smoke` is permanent code behind `@ConditionalOnProperty(ironspot.sentry.smoke.enabled=true)` plus JWT auth gate, env toggle for the 5-minute verify window, then untoggle. Avoids two extra deploys and the "forget to revert" failure mode of `/api/_admin/throw add-then-revert`. Avoids the prod-degradation risk of `unset DATABASE_URL`.
4. **Sentry app verification uses an iOS Simulator preview build, not TestFlight or APK.** The plan's "TestFlight or APK" wording targets "non-dev build with sourcemap symbolication". `eas build --platform ios --profile preview --simulator` produces a `.app` that runs on the already-working iOS Simulator (`pnpm snap` workflow evidence) without code signing, no Apple Developer enrolment fee required at this stage. Trade-off: native-side crash reproducibility requires a physical device, deferred to pre-App-Store-submission verification. Android route declined because user has no Android device and emulator setup adds Android Studio installation time.
5. **`login-flow.yaml` covers entry path only, not authenticated state.** Supabase OAuth uses the system browser so Maestro cannot drive it. The plan's `(manual: authenticate)` step is removed; the flow asserts "My Page entry, unauthenticated empty state, CTA tap, /(auth)/login renders Google + Kakao buttons". Authenticated-state regression is covered by the existing `AuthenticatedProfile` unit tests from Task 29. A test-only dev-login endpoint was rejected per `testing-anti-patterns` (production pollution).
6. **Apple Sign In stays in the Pre-Launch Backlog, not Task 32.** Task 32 is Phase 2 feature verification. Apple Sign In is new feature work with external dependencies (Apple Developer enrolment, Service ID, Supabase Apple provider config). Folding it in would expand scope, force premature $99 spend, and gate the PR on multi-day Apple review. PROGRESS.md notes "Phase 2 complete is not App Store submittable" explicitly.
7. **Backend hosting: Render free, not Railway.** 32b started on Railway trial credit but the choice was re-evaluated mid-execution under the user constraint of "free hosting + reasonable performance + low operational overhead". Comparison covered Oracle Cloud Free Tier ARM VM (truly free + best performance, but 4~8h manual VM setup and ARM capacity scarcity in Seoul region), Cloud Run min=0 (free at low traffic, 2~5s Java cold start), Fly.io (free tier removed October 2024), Northflank free (memory too tight at 320MB-ish for Spring Boot 4), and Render free web service. Render won on "free + same deploy ergonomics as Railway": Dockerfile-based + GitHub auto-deploy, $0/month indefinitely, 512MB RAM + 0.1 vCPU sufficient with JVM heap tuning (`MaxRAMPercentage=70`, `UseSerialGC`, `ExitOnOutOfMemoryError`). Trade-off: 15-minute idle sleep + 30~90s cold start, mitigated by an external 5-minute keep-warm ping (UptimeRobot free monitor, fallback to GitHub Actions cron). Apple App Store $99/year + Google Play $25 one-time remain unavoidable for production app distribution regardless of backend host choice.

### Task 32a — code/docs prep (this session, no hosting-platform dependency)

**Code**

- [ ] `.maestro/flows/login-flow.yaml` entry-path-only flow (decision #5).
- [ ] `.maestro/flows/upvote-flow.yaml` photo detail to upvote toggle.
- [ ] `.maestro/config.yaml` lists both new flows.
- [ ] `SentrySmokeController` (Spring Boot) permanent gated endpoint per decision #3. `application.yml` adds `ironspot.sentry.smoke.enabled: ${IRONSPOT_SENTRY_SMOKE_ENABLED:false}`. `SentrySmokeControllerIT` + `SentrySmokeControllerDisabledIT` mirror the Slack-smoke IT pair.
- [ ] FilterPanel empty + error states (UX polish backlog item).
- [ ] GymBottomSheet cross-tab leak fix (UX polish backlog item).
- [ ] UX polish audit with a 30-minute cap. Grep `useQuery` / `useInfiniteQuery` consumers for empty/error branch gaps beyond the two known items. Findings appended to the backlog or deferred to Phase 3.
- [ ] App Store code items: `app.json` `NSCameraUsageDescription` + `NSPhotoLibraryUsageDescription` verified or added.
- [ ] HikariCP pool config in `application-prod.yml` per decision #2.

**Local verification (32a)**

- [ ] `pnpm jest` all tests pass.
- [ ] `pnpm exec tsc --noEmit` no type errors.
- [ ] `pnpm lint` no issues.
- [ ] `./gradlew test` all Java tests pass.
- [ ] `pnpm e2e:all` all Maestro flows pass (6 existing + login + upvote = 8).
- [ ] FF review applied.

**Code audits (32a, report findings in PR description)**

- [ ] Performance: `staleTime` per-endpoint actual values match plan (brands/categories Infinity, gym search 5min, photos 1min). Report and correct any drift.
- [ ] Performance: photo upload compression. Sample dev log confirms compressed file < 500KB.
- [ ] Performance: `getGymMachines` N+1. JOIN structure inspection (live EXPLAIN deferred to 32b).
- [ ] Security: Spring Boot CORS. Confirm prod config allows only `ironspot://` scheme.
- [ ] Security: `DELETE /api/users/me` cascade. Confirm photos anonymised + votes deleted via existing IT (Task 30 work).
- [ ] Security: report rate limit. Bucket4j or equivalent presence check; document if gap.
- [ ] Security: file upload server-side validation. Confirm `PhotoController.upload` enforces MIME + size.

**Docs**

- [ ] `docs/harness/operations.md` hosting env table: `DATABASE_URL` / `DATABASE_USERNAME` / `DATABASE_PASSWORD` source column updated to "Supabase Postgres (pooler URL)" per decision #2.
- [ ] `docs/harness/operations.md` "Sentry server" smoke section: rewritten to `IRONSPOT_SENTRY_SMOKE_ENABLED` toggle pattern per decision #3.
- [ ] `docs/harness/operations.md` env table: `IRONSPOT_SENTRY_SMOKE_ENABLED` row added.
- [ ] `docs/harness/operations.md` Sentry app section: iOS Simulator preview build route per decision #4 + native-crash deferral note.
- [ ] `grep -rni "spring boot 3" docs/` sweep. Fix all current-state references. Leave historical PROGRESS and ADR entries untouched.

**32a is done when** the above lands on `task/32-final-verification` branch via PR. `PROGRESS.md` Completed Tasks Log is NOT updated yet; the entry is written once at the end of 32b.

### Task 32b — post-Render live verification (next session)

**User external work (Claude guides step-by-step)**

- [ ] Render account created, new Web Service connected to the `ironspot` GitHub repo with Root Directory `iron-spot-api`, Dockerfile builder, Free instance.
- [ ] `DATABASE_URL` set to the Supabase pooler URL; `DATABASE_USERNAME` and `DATABASE_PASSWORD` set from Supabase credentials.
- [ ] Remaining env vars set per `docs/harness/operations.md` Render env table.
- [ ] `IRONSPOT_SLACK_SMOKE_ENABLED=false` and `IRONSPOT_SENTRY_SMOKE_ENABLED=false` at deploy time.
- [ ] First deploy green; `/actuator/health` UP. Render auto-assigned URL captured (form: `https://<service>.onrender.com`).
- [ ] UptimeRobot monitor pointing at `/actuator/health` on a 5-minute interval to prevent the 15-minute idle sleep.
- [ ] EAS account ready, `pnpm dlx eas-cli login` successful, `eas secret:create` populated with `EXPO_PUBLIC_API_URL` = Render service URL plus the other secrets listed in `operations.md`.

**Live verification (Claude executes once Render is up)**

- [ ] `curl https://<service>.onrender.com/actuator/health` returns `{"status":"UP"}` from outside the Render network.
- [ ] Render log viewer: one INFO line during request handling parses as JSON with LogstashEncoder fields (`@timestamp`, `@version`, `thread_name`, `level_value`).
- [ ] Sentry server: toggle `IRONSPOT_SENTRY_SMOKE_ENABLED=true` and redeploy, then `curl -X POST -H "Authorization: Bearer $JWT" $URL/api/_admin/sentry-smoke`. Event arrives in the `ironspot-api` Sentry project with `environment: production` and readable stack. Toggle false, redeploy, confirm 404.
- [ ] Slack 3-path: toggle `IRONSPOT_SLACK_SMOKE_ENABLED=true`, run 3 curls, 3 messages arrive in `#ironspot-moderation`. Toggle false, confirm 404.
- [ ] Sentry app: `eas.json` preview profile with `simulator: true` created. `eas build --platform ios --profile preview --simulator`. `.app` installed on iOS Simulator. Open Profile tab, tap "Sentry smoke test (ops only)". Event arrives in the `ironspot-app` Sentry project with a symbolicated stack.

**Docs (32b)**

- [ ] `PROGRESS.md` Completed Tasks Log: Task 32 entry written (covers 32a + 32b commits, decisions reference).
- [ ] PROGRESS.md status: "Phase 2 complete. Pre-Launch Backlog remains for App Store submission readiness (Apple Sign In, Privacy + ToS URLs)."

### Out-of-scope reminders

- **Apple Sign In** stays in the Pre-Launch Backlog per decision #6.
- **Privacy policy + Terms of service URLs** are content/legal items, not Task 32 code work. Tracked in App Store submission checklist (Phase 3 launch prep).
- **Native-side crash reproducibility on a physical iOS device** deferred per decision #4 to pre-App-Store-submission verification.

### UX polish backlog (carry-over from earlier tasks)

Empty, loading, and error states across screens that were left implicit during feature builds.

- **FilterPanel** (`src/features/map/components/FilterPanel.tsx`): when `brands` or `categories` returns `[]`, the panel renders an empty rounded card with no message. Add empty + error states. Surfaced during Task 29 manual testing.
- **GymBottomSheet cross-tab leak**: the map tab's `GymBottomSheet` remains visible on other tabs. Either move the sheet provider under the Map route or collapse via `useFocusEffect` on blur. Surfaced during Task 29 manual testing.
- (32a audit appends further findings here.)

### Commits

```bash
# 32a (this session)
git commit -m "feat(phase-2): 32a final verification code+docs prep (maestro, smoke endpoint, ux polish, doc drift)"

# 32b (next session, after Render is up)
git commit -m "feat(phase-2): 32b live verify on render + simulator sentry app smoke; phase 2 closed"
```

---

## Pre-Launch Backlog (post-Task 30, before App Store submission)

Items that are not in the Task 16~32 numbered flow but **must land before iOS App Store submission**. Tracked separately because they don't fit the per-feature task model: they are App Store / store-policy gates rather than product features.

### Apple Sign In

**Trigger:** required by App Store Review Guideline 4.8 because the app already offers third-party social login (Google + Kakao via Task 20). Without it iOS submission will be rejected.

**Why deferred from Task 20:** Task 20 focused on Google + Kakao OAuth to unblock Phase 2 photo upload + voting flows; Apple Sign In is iOS-store-only and doesn't unblock product work. The gap was identified post-Task 30 when reviewing the auth surface end-to-end.

**Scope:**

1. Supabase Auth dashboard — enable Apple provider, register Apple Service ID + return URL.
2. Apple Developer Console — create Service ID + Sign in with Apple capability + return URL pointing to Supabase callback.
3. Frontend `LoginScreen` — add Apple button (iOS only; hide on Android via `Platform.OS === 'ios'`). Reuse the existing `signInWithOAuth({ provider: 'apple' })` pattern.
4. iOS native config — `app.config.ts` `ios.usesAppleSignIn: true`; entitlements via Expo's `expo-apple-authentication` plugin (or Supabase Web OAuth fallback if native plugin friction is high — decide at implementation time).
5. UserService — confirm new Apple-issued JWTs carry email claim (Apple's "Hide my email" relay address is acceptable; `getOrCreate` already tolerates any unique email).
6. E2E — Maestro flow on iOS: tap Apple button → system sheet → return to app authenticated. Android: Apple button hidden.

**Out of scope:**

- Migrating existing Google/Kakao users to Apple
- Apple Sign In on web (we have no web target)

**Acceptance:** iOS device renders Apple button; tapping it produces a successful Supabase session; backend `getOrCreate` creates a user row on first Apple sign-in; logout works.

**Effort estimate:** S~M (mostly config + UI plumbing; the Supabase Auth abstraction does the heavy OAuth work as it does for Google/Kakao).

---

## Out of Phase 2 Scope (Reference)

- Natural Language Search (Phase 3)
- Push notifications (post-launch: expo-server-sdk-java in Spring Boot)
- Image CDN (post-launch: Supabase Pro CDN or Cloudflare R2)
- Dark mode (post-launch)
- Multi-select machine filter search (ADR 0020 — deferred from Phase 1)
- Analytics / PostHog (post-launch)
- Offline photo upload queue (post-launch)

---

## Task Summary

| Task | Description                                          | Track        | Blocks     |
| ---- | ---------------------------------------------------- | ------------ | ---------- |
| 16   | Spring Boot setup + Docker + Testcontainers CI       | Backend      | 17, 18     |
| 17   | JWT auth filter + Spring Security + /api/users/me    | Backend      | 18, 20, 22 |
| 18   | Core read endpoints + PostGIS integration tests      | Backend      | 19         |
| 19   | OpenAPI spec + Orval TypeScript client generation    | Cross        | 21         |
| 20   | Frontend auth — Login screen, useAuth, callback      | Frontend     | 21         |
| 21   | Migrate frontend services Supabase → Spring Boot API | Frontend     | —          |
| 22   | JOOQ migration — replace JdbcTemplate raw SQL        | Backend      | 23         |
| 23   | Orval type alignment — eliminate as-unknown-as casts | Frontend     | 24         |
| 24   | Photo upload pipeline (OCR + fuzzy match + storage)  | Backend      | 25         |
| 25   | Photo upload UI — 3-step flow + animations + FAB     | Frontend     | —          |
| 26   | Upvote system — @Transactional + optimistic update   | Full-stack   | —          |
| 27   | Report system — auto-blind at 5 pending reports      | Full-stack   | —          |
| 28   | New gym registration via Naver Places API proxy      | Full-stack   | —          |
| 29   | My Page — profile, photos, votes, logout             | Frontend     | 30         |
| 30   | Account settings — nickname edit + account deletion  | Full-stack   | —          |
| 31   | Sentry + Actuator + structured logging               | Cross        | 32         |
| 32   | Phase 2 final verification + App Store checklist     | Verification | —          |

## User Review Checkpoints

| Checkpoint | After Tasks | Reviews                                                                    |
| ---------- | ----------- | -------------------------------------------------------------------------- |
| 6          | 16–19       | Backend foundation, API client generated, Spring Boot serves all read data |
| 7          | 20–23       | Auth, migration, JOOQ, Orval types all clean — solid foundation            |
| 8          | 24–25       | Photo upload end-to-end working                                            |
| 9          | 26–28       | Upvote, report, new gym registration                                       |
| 10         | 29–32       | My Page, account settings, final verification                              |
