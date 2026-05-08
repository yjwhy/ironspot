buildscript {
    repositories {
        mavenCentral()
    }
    dependencies {
        classpath("org.jooq:jooq-codegen:3.19.23")
        classpath("org.testcontainers:testcontainers:1.20.4")
        classpath("org.testcontainers:postgresql:1.20.4")
        classpath("org.postgresql:postgresql:42.7.4")
        classpath("org.slf4j:slf4j-nop:2.0.13")
    }
}

plugins {
    java
    id("org.springframework.boot") version "4.0.6"
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

    // JOOQ — pin to match generated code version
    implementation("org.jooq:jooq:3.19.23")

    // OpenAPI (SpringDoc) — 3.x required for Spring Boot 4.x / Spring Framework 7.x
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:3.0.3")

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
    testImplementation("org.springframework.boot:spring-boot-resttestclient")
    testImplementation("org.springframework.boot:spring-boot-restclient")
    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("org.testcontainers:testcontainers-junit-jupiter")
    testImplementation("org.testcontainers:testcontainers-postgresql")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
    useJUnitPlatform()
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
