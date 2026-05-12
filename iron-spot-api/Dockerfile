# syntax=docker/dockerfile:1.6

# JDK 25 staging image — used solely to expose /opt/java/openjdk for the builder stage
# to copy into the Gradle toolchain search path. We cannot use eclipse-temurin:25-jdk
# directly as the build base because Gradle 8.x's embedded Kotlin DSL compiler cannot
# parse Java 25 version strings (KT-67005 workaround), so the Gradle daemon must run
# on Java 24 while compilation uses Java 25 via the toolchain.
FROM eclipse-temurin:25-jdk-alpine AS jdk25

# Builder: Java 24 base for Gradle daemon, with JDK 25 mounted at /opt/jdk25 so the
# toolchain (configured in build.gradle.kts for Java 25) can find it.
FROM eclipse-temurin:24-jdk-alpine AS builder
WORKDIR /build

COPY --from=jdk25 /opt/java/openjdk /opt/jdk25

# Point Gradle's toolchain auto-detection at the pre-installed JDK 25.
# Disable auto-download so the build fails fast if /opt/jdk25 is missing.
ENV GRADLE_OPTS="-Dorg.gradle.java.installations.paths=/opt/jdk25 -Dorg.gradle.java.installations.auto-download=false"

# Dependency layer: copy build files only, fetch dependencies into the Gradle cache so
# this layer can be reused while only sources change. The dependency resolution can fail
# offline for some plugins; allow that to continue (next stage will redo what's needed).
COPY gradlew settings.gradle.kts build.gradle.kts gradle.properties ./
COPY gradle ./gradle
RUN chmod +x ./gradlew && ./gradlew --no-daemon dependencies > /dev/null 2>&1 || true

# Source layer: jOOQ generated code is committed under src/main/generated so generateJooq
# does not need to run in this build environment (see iron-spot-api/.gitignore rationale).
COPY src ./src

# Build the bootable JAR. Skip:
#   -x generateJooq — requires Docker socket via Testcontainers; not available in the
#     Railway build environment. Generated sources are committed.
#   -x test — tests run in CI (api-ci.yml), not in the deploy build path.
RUN ./gradlew --no-daemon bootJar -x generateJooq -x test

# Runtime: slim JRE-only image. Same target as the original Dockerfile.
FROM eclipse-temurin:25-jre-alpine AS runtime
WORKDIR /app
COPY --from=builder /build/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-Dspring.profiles.active=prod", "-jar", "app.jar"]
