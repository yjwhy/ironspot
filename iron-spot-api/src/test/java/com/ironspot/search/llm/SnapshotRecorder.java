package com.ironspot.search.llm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.ironspot.search.dsl.SearchDsl;
import io.netty.channel.ChannelOption;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.regex.Pattern;

/**
 * One-time fixture recorder. Invokes the real Groq API for every uncommented line in
 * {@code src/test/resources/llm-snapshots/queries.txt} and writes the parsed SearchDsl
 * to a per-query JSON file in the same directory.
 *
 * <p>Run via {@code ./gradlew recordEvalSnapshots} from {@code iron-spot-api/}. Requires
 * {@code GROQ_API_KEY} in env or {@code iron-spot-api/.env}. Throttled to 1 request every
 * 2 seconds to stay under the Groq free-tier 30 RPM ceiling.
 *
 * <p>On per-query failure, the response file is replaced by {@code <name>.error.txt} with
 * the error message so the human reviewer can inspect what the LLM rejected. A subsequent
 * successful re-run replaces the error file with the JSON snapshot.
 */
public final class SnapshotRecorder {

    private static final Path QUERIES_PATH = Paths.get("src/test/resources/llm-snapshots/queries.txt");
    private static final Path OUTPUT_DIR = Paths.get("src/test/resources/llm-snapshots");
    private static final Pattern UNSAFE_CHARS = Pattern.compile("[\\\\/:*?\"<>|\\s]+");
    private static final Duration THROTTLE = Duration.ofSeconds(2);
    private static final ObjectMapper PRETTY = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

    private SnapshotRecorder() {}

    public static void main(String[] args) throws IOException, InterruptedException {
        String apiKey = System.getenv("GROQ_API_KEY");
        if (apiKey == null || apiKey.isBlank()) {
            System.err.println("GROQ_API_KEY env var required (pipe from iron-spot-api/.env via Gradle).");
            System.exit(1);
        }

        GroqLlamaClient client = buildClient(apiKey);

        Files.createDirectories(OUTPUT_DIR);

        int ok = 0;
        int err = 0;
        boolean first = true;
        for (String line : Files.readAllLines(QUERIES_PATH, StandardCharsets.UTF_8)) {
            String query = line.trim();
            if (query.isEmpty() || query.startsWith("#")) continue;

            if (!first) Thread.sleep(THROTTLE.toMillis());
            first = false;

            String base = sanitize(query);
            Path jsonOut = OUTPUT_DIR.resolve(base + ".json");
            Path errOut = OUTPUT_DIR.resolve(base + ".error.txt");
            try {
                SearchDsl dsl = client.parse(query);
                PRETTY.writeValue(jsonOut.toFile(), dsl);
                Files.deleteIfExists(errOut);
                System.out.println("OK   " + query + "  →  " + jsonOut.getFileName());
                ok++;
            } catch (Exception e) {
                Files.deleteIfExists(jsonOut);
                Files.writeString(
                    errOut,
                    "query: " + query + System.lineSeparator()
                        + "error: " + e.getClass().getSimpleName() + ": " + e.getMessage() + System.lineSeparator(),
                    StandardCharsets.UTF_8);
                System.err.println("ERR  " + query + "  →  " + e.getMessage());
                err++;
            }
        }

        System.out.println();
        System.out.println("=== SnapshotRecorder done: " + ok + " ok, " + err + " errors ===");
        if (err > 0) System.exit(2);
    }

    private static GroqLlamaClient buildClient(String apiKey) throws IOException {
        HttpClient httpClient = HttpClient.create()
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 10_000)
            .responseTimeout(Duration.ofSeconds(15));
        WebClient webClient = WebClient.builder()
            .clientConnector(new ReactorClientHttpConnector(httpClient))
            .build();
        GroqLlamaClient client = new GroqLlamaClient(
            webClient, apiKey, new ClassPathResource("prompts/search-dsl.md"));
        client.init();
        return client;
    }

    static String sanitize(String query) {
        String collapsed = UNSAFE_CHARS.matcher(query).replaceAll("_");
        return collapsed.length() <= 80 ? collapsed : collapsed.substring(0, 80);
    }
}
