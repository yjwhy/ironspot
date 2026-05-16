package com.ironspot.search.eval;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.ironspot.search.dsl.SearchDsl;
import com.ironspot.search.llm.GroqLlamaClient;
import com.ironspot.search.llm.LlmException;
import io.netty.channel.ChannelOption;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Path-filtered eval suite for the NL Search LLM prompt. Calls the real Groq API for
 * every case in {@code src/test/resources/eval/queries.yaml}, compares the parsed
 * {@link SearchDsl} against the curated expected DSL via {@link SemanticMatcher}, and
 * writes any mismatches to {@code build/reports/eval/failures.json}.
 *
 * <p>Disabled unless {@code EVAL_RUN=true}. Locally:
 * {@code EVAL_RUN=true GROQ_API_KEY=... ./gradlew test --tests "*EvalSuiteTest"}.
 * In CI: triggered by {@code .github/workflows/llm-eval.yml} on PRs that touch
 * prompts, the LLM client, the DSL package, {@code SqlBuilder}, or {@code DslValidator}.
 *
 * <p>Throttle/retry: 15s between calls + 60s back-off with a single retry on Groq
 * RATE_LIMIT.
 *
 * <p>Run budget: 6 product-value cases × ~2.5K tokens ≈ 15K tokens, well within
 * Groq free-tier TPD (100K/day) and TPM (12K/min). Task 41 trimmed from the
 * original 30-case suite (75K = 75% of TPD) after Task 40's main retry exposed
 * the structural cost issue.
 */
@EnabledIfEnvironmentVariable(named = "EVAL_RUN", matches = "true")
class EvalSuiteTest {

    // 15s throttle bounds the per-minute burst: 4 calls/min × ~2.5K tokens ≈ 10K
    // tokens/min, under Groq TPM 12K. With 6 cases the entire run finishes in
    // ~90s wallclock, and cumulative spend (15K) stays well under TPD 100K so
    // multiple PR force-pushes on the same day do not exhaust the daily bucket.
    private static final Duration THROTTLE = Duration.ofSeconds(15);
    private static final Duration RATE_LIMIT_BACKOFF = Duration.ofSeconds(60);
    private static final Path FAILURES_PATH = Paths.get("build/reports/eval/failures.json");

    private static GroqLlamaClient client;
    private static final AtomicBoolean firstCall = new AtomicBoolean(true);
    private static final List<Failure> failures = new ArrayList<>();

    @BeforeAll
    static void setup() {
        String apiKey = System.getenv("GROQ_API_KEY");
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException(
                "GROQ_API_KEY required for EvalSuiteTest. Set it via env or iron-spot-api/.env.");
        }
        client = buildClient(apiKey);
    }

    @ParameterizedTest(name = "[{index}] {0}")
    @MethodSource("cases")
    void evalCase(Case c) throws InterruptedException {
        if (!firstCall.compareAndSet(true, false)) {
            Thread.sleep(THROTTLE.toMillis());
        }

        SearchDsl actual;
        try {
            actual = callWithRateLimitRetry(c.input());
        } catch (LlmException e) {
            failures.add(new Failure(c.input(), c.expected(), null,
                "llm_exception:" + e.kind() + ":" + e.getMessage()));
            assertThat(false)
                .as("LLM call failed for query=%s: %s", c.input(), e.getMessage())
                .isTrue();
            return;
        }

        SemanticMatcher.MatchResult result = SemanticMatcher.match(c.expected(), actual);
        if (!result.matches()) {
            failures.add(new Failure(c.input(), c.expected(), actual, result.mismatchField()));
        }
        assertThat(result.matches())
            .as("query=%s, mismatchField=%s, actual=%s",
                c.input(), result.mismatchField(), actual)
            .isTrue();
    }

    @AfterAll
    static void dumpFailures() throws IOException {
        Files.createDirectories(FAILURES_PATH.getParent());
        new ObjectMapper()
            .enable(SerializationFeature.INDENT_OUTPUT)
            .writeValue(FAILURES_PATH.toFile(), failures);
    }

    static Stream<Case> cases() {
        ObjectMapper yaml = new ObjectMapper(new YAMLFactory());
        try (var in = EvalSuiteTest.class.getResourceAsStream("/eval/queries.yaml")) {
            if (in == null) {
                throw new IllegalStateException("eval/queries.yaml not on test classpath");
            }
            Suite suite = yaml.readValue(in, Suite.class);
            return suite.cases().stream();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static SearchDsl callWithRateLimitRetry(String query) throws InterruptedException {
        try {
            return client.parse(query);
        } catch (LlmException e) {
            if (e.kind() != LlmException.Kind.RATE_LIMIT) throw e;
            Thread.sleep(RATE_LIMIT_BACKOFF.toMillis());
            return client.parse(query);
        }
    }

    private static GroqLlamaClient buildClient(String apiKey) {
        HttpClient httpClient = HttpClient.create()
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 10_000)
            .responseTimeout(Duration.ofSeconds(15));
        WebClient webClient = WebClient.builder()
            .clientConnector(new ReactorClientHttpConnector(httpClient))
            .build();
        GroqLlamaClient client = new GroqLlamaClient(
            webClient, apiKey, new ClassPathResource("prompts/search-dsl.md"));
        try {
            client.init();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return client;
    }

    public record Case(String input, SearchDsl expected) {

        @Override
        public String toString() {
            return input;
        }
    }

    public record Failure(String input, SearchDsl expected, SearchDsl actual, String mismatchField) {}

    public record Suite(List<Case> cases) {}
}
