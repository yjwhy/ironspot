# syntax=docker/dockerfile:1.6

# JDK 25 staging image — used solely to expose /opt/java/openjdk for the builder stage
# to copy into the Gradle toolchain search path. We cannot use eclipse-temurin:25-jdk
# directly as the build base because Gradle 8.x's embedded Kotlin DSL compiler cannot
# parse Java 25 version strings (KT-67005 workaround), so the Gradle daemon must run
# on Java 24 while compilation uses Java 25 via the toolchain.
# Security K5: pin base images to OCI index digests. Floating tags
# (`:25-jdk-alpine`) let upstream re-roll the underlying layers
# silently — a malicious or buggy push would land on the next deploy.
# Dependabot's `docker` ecosystem (added in K6) keeps these digests
# current with weekly PRs.
FROM eclipse-temurin:25-jdk-alpine@sha256:bd1e37b1c62835d617d40bcf6932d6cd5f65993a331ababd5481296640bd42bc AS jdk25

# Builder: Java 24 base for Gradle daemon, with JDK 25 mounted at /opt/jdk25 so the
# toolchain (configured in build.gradle.kts for Java 25) can find it.
FROM eclipse-temurin:24-jdk-alpine@sha256:9dc3c4de908aa35846266d775e171c6061583bb9a33c47bdb01d98e122c15078 AS builder
WORKDIR /build

COPY --from=jdk25 /opt/java/openjdk /opt/jdk25

# Fail fast if the JDK 25 copy is missing or broken (avoids a confusing toolchain error
# later in the build).
RUN test -x /opt/jdk25/bin/java && /opt/jdk25/bin/java -version

# Dependency layer: copy build files only, fetch dependencies into the Gradle cache so
# this layer can be reused while only sources change. The dependency resolution can fail
# offline for some plugins; allow that to continue (next stage will redo what's needed).
COPY gradlew settings.gradle.kts build.gradle.kts gradle.properties ./
COPY gradle ./gradle

# Append the toolchain configuration to the committed gradle.properties. We write to the
# file (rather than relying on GRADLE_OPTS or -D flags) because Gradle's toolchain
# resolver reads installations.paths consistently from gradle.properties on every entry
# point (daemon, --no-daemon, init scripts) while environment-variable propagation has
# proven unreliable inside the Render build sandbox.
RUN printf "\n# --- Render build sandbox toolchain config (Task 32 decision #7) ---\norg.gradle.java.installations.paths=/opt/jdk25\norg.gradle.java.installations.auto-download=false\n" >> gradle.properties

RUN chmod +x ./gradlew && ./gradlew --no-daemon dependencies > /dev/null 2>&1 || true

# Source layer: jOOQ generated code is committed under src/main/generated so generateJooq
# does not need to run in this build environment (see iron-spot-api/.gitignore rationale).
COPY src ./src

# Build the bootable JAR. Skip:
#   -x generateJooq — requires Docker socket via Testcontainers; not available in the
#     Render build sandbox. Generated sources are committed.
#   -x test — tests run in CI (api-ci.yml), not in the deploy build path.
RUN ./gradlew --no-daemon bootJar -x generateJooq -x test

# Runtime: slim JRE-only image. Same target as the original Dockerfile.
FROM eclipse-temurin:25-jre-alpine@sha256:609c3d5184aeabe15c1a077af6d1c53d0ba65df18347c67043d00195267c4f7d AS runtime
WORKDIR /app

# Security task #18: run as a non-root user. eclipse-temurin alpine images default
# to root, which makes any RCE or jar-loading exploit a host-namespace escape risk.
# Use a fixed numeric UID (10001) so platform-side filesystem ACLs and Render's audit
# logs see a stable, non-privileged identity. wget exists in alpine base for the
# HEALTHCHECK so we do not need to apk-add anything.
RUN addgroup -S app && adduser -S -G app -u 10001 -h /app app

COPY --from=builder --chown=app:app /build/build/libs/*.jar app.jar
USER app

EXPOSE 8080

# Container-level liveness probe. Render uses its own HTTP health check at the
# platform layer, but the Docker HEALTHCHECK is the source of truth for local
# docker-compose, any future Kubernetes / Nomad migration, and `docker ps` status.
# /actuator/health is permitAll in SecurityConfig and returns 200 once Spring is
# ready. 30s interval × 5s timeout × 3 retries × 60s start-period covers JVM warm-up
# on the Render free tier (cold-pool to ready ~30-45s).
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/actuator/health || exit 1

# JVM flags tuned for Render free web service (512MB container, 0.1 vCPU shared).
#   MaxRAMPercentage=70 — leave headroom for Tomcat / Netty / native memory, glibc
#     allocator overhead, and Render's own sidecar processes inside the 512MB cap.
#   SerialGC — lowest CPU overhead GC, best fit for single-core constrained workloads
#     where pause time is preferable to throughput tuning.
#   ExitOnOutOfMemoryError — fail fast on OOM so the platform restarts the container
#     instead of degrading silently into a swap-thrash spiral.
ENTRYPOINT ["java", \
  "-Dspring.profiles.active=prod", \
  "-XX:MaxRAMPercentage=70.0", \
  "-XX:+UseSerialGC", \
  "-XX:+ExitOnOutOfMemoryError", \
  "-jar", "app.jar"]
