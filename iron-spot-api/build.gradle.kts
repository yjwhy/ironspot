buildscript {
    repositories {
        mavenCentral()
    }
    dependencies {
        classpath("org.jooq:jooq-codegen:3.21.7")
        classpath("org.testcontainers:testcontainers:1.21.4")
        classpath("org.testcontainers:postgresql:1.21.4")
        classpath("org.postgresql:postgresql:42.7.11")
        classpath("org.slf4j:slf4j-nop:2.0.18")
    }
}

plugins {
    java
    id("org.springframework.boot") version "4.1.0"
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

sourceSets {
    main {
        java {
            srcDir("src/main/generated")
        }
    }
}

dependencies {
    // Spring
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-jooq")

    // Caffeine — in-memory LRU cache for Naver 지역검색 results (F7 NL search
    // Naver merge). Spring-boot-starter-cache adapts Caffeine to @Cacheable.
    // 60s TTL protects the Naver free-tier quota (25K/day) from being burned
    // by repeated identical queries when users iterate on the search bar.
    implementation("org.springframework.boot:spring-boot-starter-cache")
    implementation("com.github.ben-manes.caffeine:caffeine")

    // JOOQ — pin to match generated code version
    implementation("org.jooq:jooq:3.21.7")

    // OpenAPI (SpringDoc) — 3.x required for Spring Boot 4.x / Spring Framework 7.x
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:3.0.3")

    // JWT — Supabase Auth token validation via JWKS (ES256 asymmetric keys).
    // Supabase auto-migrated all projects from legacy HS256 shared secret to ECC P-256
    // signing keys (as of 2026-04). spring-boot-starter-oauth2-resource-server pulls
    // NimbusJwtDecoder which handles JWKS fetch + cache + ES256/RS256 verification.
    implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")

    // PostgreSQL / PostGIS
    runtimeOnly("org.postgresql:postgresql")

    // Flyway — DB schema migrations (Task 47 / ADR 0023)
    // Community edition (Apache 2.0, free). flyway-database-postgresql plugin is required
    // for PostgreSQL 14+ since Flyway 9.22+ (it's a separate jar from core).
    //
    // Spring Boot 4 BREAKING: FlywayAutoConfiguration is no longer triggered just by
    // having org.flywaydb:flyway-core on the classpath. The 4.0 migration guide
    // requires the dedicated starter — "you now need to replace that with
    // spring-boot-starter-flyway". Without the starter, Spring Boot silently skips
    // Flyway entirely at boot (zero log lines, no error). That bit prod on V10 +
    // V11 (2026-05-22) — see [[lesson-prod-flyway-never-ran]] memory; recovered by
    // running the Flyway CLI manually, then this dep change makes future Vn
    // migrations apply automatically on the next deploy.
    //
    // Tests still disable Flyway via src/test/resources/application.yml so
    // Testcontainers init-test-db.sql stays the authoritative IT schema source.
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    implementation("org.flywaydb:flyway-database-postgresql")

    // HTTP client — for Google Vision API + Naver Places proxy
    implementation("org.springframework.boot:spring-boot-starter-webflux")
    // macOS-native DNS resolver — without this Netty falls back to JDK resolver
    // and external HTTPS calls (LLM APIs, Naver) can hang on local dev. Pull
    // both arm64 + x86_64 classifiers so Apple Silicon and Intel both work.
    runtimeOnly("io.netty:netty-resolver-dns-native-macos:4.2.12.Final:osx-aarch_64")
    runtimeOnly("io.netty:netty-resolver-dns-native-macos:4.2.12.Final:osx-x86_64")

    // Monitoring (Task 31)
    // Sentry core SDK only — sentry-spring-boot-starter-jakarta 8.41.0 (latest) still references
    // Spring Boot 3.x's `WebClientCustomizer` in its auto-config, which Spring Boot 4 reorganised
    // away. We init Sentry manually in SentryConfig and bridge unhandled exceptions through
    // GlobalExceptionHandler. Revisit when Sentry ships a Spring Boot 4 starter.
    implementation("io.sentry:sentry:8.48.0")
    // Structured JSON encoder for Logback — used in prod profile via logback-spring.xml.
    implementation("net.logstash.logback:logstash-logback-encoder:9.0")

    // Lombok
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")

    // Test
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-resttestclient")
    testImplementation("org.springframework.boot:spring-boot-restclient")
    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("org.testcontainers:testcontainers-junit-jupiter")
    testImplementation("org.testcontainers:testcontainers-postgresql")
    // YAML parser for EvalSuiteTest reading src/test/resources/eval/queries.yaml.
    testImplementation("com.fasterxml.jackson.dataformat:jackson-dataformat-yaml")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

// Load `.env` into a map so we can pipe selected keys into both bootRun and test tasks.
val dotEnv: Map<String, String> = file(".env").let { f ->
    if (!f.exists()) emptyMap()
    else f.readLines()
        .filter { it.isNotBlank() && !it.startsWith("#") && it.contains("=") }
        .associate {
            val (k, v) = it.split("=", limit = 2)
            k.trim() to v.trim()
        }
}

tasks.withType<Test> {
    useJUnitPlatform()
    // Pipe Naver Search keys from .env (or CI env) to JUnit @EnabledIfEnvironmentVariable so the
    // real-API integration test runs locally and in CI without manual setup. Other secrets stay
    // out unless added explicitly — minimises blast radius if a test prints env.
    // Naver keys gate NaverSearchServiceIT (@EnabledIfEnvironmentVariable).
    // Groq/Gemini keys gate EvalSuiteTest. EVAL_RUN itself is intentionally NOT piped from
    // .env — only the GH workflow (and explicit local `EVAL_RUN=true ./gradlew test`) should
    // turn the eval on; otherwise plain `./gradlew test` would burn Groq quota.
    listOf(
        "NAVER_SEARCH_CLIENT_ID",
        "NAVER_SEARCH_CLIENT_SECRET",
        "GROQ_API_KEY",
        "GEMINI_API_KEY",
    ).forEach { key ->
        val value = System.getenv(key) ?: dotEnv[key]
        if (!value.isNullOrBlank()) environment(key, value)
    }
    // EVAL_RUN must come from process env only.
    System.getenv("EVAL_RUN")?.let { environment("EVAL_RUN", it) }
}

tasks.named<org.springframework.boot.gradle.tasks.run.BootRun>("bootRun") {
    dotEnv.forEach { (k, v) -> environment(k, v) }
}

tasks.named("compileJava") {
    dependsOn("generateJooq")
}

tasks.register<JavaExec>("recordEvalSnapshots") {
    group = "verification"
    description = "One-time: calls real Groq for every line in queries.txt and writes JSON snapshots. " +
        "Re-run after any prompt change. Throttled to 30 RPM (free-tier safe)."
    mainClass.set("com.ironspot.search.llm.SnapshotRecorder")
    classpath = sourceSets["test"].runtimeClasspath
    workingDir = projectDir
    // Pin to the project's Java 25 toolchain — JavaExec otherwise picks up the system
    // default JRE (often older) and fails with UnsupportedClassVersionError on class
    // files compiled by the toolchain.
    javaLauncher.set(javaToolchains.launcherFor(java.toolchain))
    val apiKey = System.getenv("GROQ_API_KEY") ?: dotEnv["GROQ_API_KEY"]
    if (!apiKey.isNullOrBlank()) environment("GROQ_API_KEY", apiKey)
}

tasks.register("generateJooq") {
    group = "jooq"
    description = "Generate JOOQ classes from schema via Testcontainers — re-run when schema changes"
    inputs.file("src/test/resources/init-test-db.sql")
    outputs.dir("$projectDir/src/main/generated")

    doLast {
        @Suppress("UNCHECKED_CAST")
        val container = org.testcontainers.containers.PostgreSQLContainer(
            org.testcontainers.utility.DockerImageName
                .parse("postgis/postgis:17-3.5")
                .asCompatibleSubstituteFor("postgres")
        ) as org.testcontainers.containers.PostgreSQLContainer<*>

        container.withDatabaseName("ironspot_gen")
        container.withUsername("gen")
        container.withPassword("gen")
        container.withCopyFileToContainer(
            org.testcontainers.utility.MountableFile.forHostPath(
                file("src/test/resources/init-test-db.sql").absolutePath
            ),
            "/docker-entrypoint-initdb.d/init.sql"
        )

        container.start()
        try {
            org.jooq.codegen.GenerationTool.generate(
                org.jooq.meta.jaxb.Configuration()
                    .withJdbc(
                        org.jooq.meta.jaxb.Jdbc()
                            .withDriver("org.postgresql.Driver")
                            .withUrl(container.jdbcUrl)
                            .withUser(container.username)
                            .withPassword(container.password)
                    )
                    .withGenerator(
                        org.jooq.meta.jaxb.Generator()
                            .withName("org.jooq.codegen.JavaGenerator")
                            .withDatabase(
                                org.jooq.meta.jaxb.Database()
                                    .withName("org.jooq.meta.postgres.PostgresDatabase")
                                    .withIncludes(".*")
                                    .withExcludes(
                                        "spatial_ref_sys|geography_columns|geometry_columns|" +
                                        "raster_columns|raster_overviews"
                                    )
                                    .withInputSchema("public")
                                    .withIncludeSequences(false)
                                    .withIncludeRoutines(false)
                                    .withIncludePackages(false)
                                    .withIncludePackageRoutines(false)
                                    .withIncludePackageUDTs(false)
                                    .withIncludePackageConstants(false)
                            )
                            .withGenerate(
                                org.jooq.meta.jaxb.Generate()
                                    .withDeprecated(false)
                                    .withRecords(false)
                                    .withDaos(false)
                                    .withPojos(false)
                            )
                            .withTarget(
                                org.jooq.meta.jaxb.Target()
                                    .withPackageName("com.ironspot.jooq")
                                    .withDirectory("$projectDir/src/main/generated")
                            )
                    )
            )
            println("JOOQ code generation complete: $projectDir/src/main/generated")
        } finally {
            container.stop()
        }
    }
}
