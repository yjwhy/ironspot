package com.ironspot.gym;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.gym.dto.NaverPlaceResult;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class NaverSearchService {

    @Value("${naver.search.client-id}")
    private String clientId;
    @Value("${naver.search.client-secret}")
    private String clientSecret;

    private final WebClient webClient;

    private static final String NAVER_LOCAL_URL = "https://openapi.naver.com/v1/search/local.json";
    private static final int DEFAULT_DISPLAY = 5;
    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final Pattern HTML_BOLD_TAG = Pattern.compile("</?b>");
    private static final Pattern PLACE_ID_IN_LINK = Pattern.compile("/place/(\\d+)");
    private static final double NAVER_COORD_SCALE = 10_000_000.0;

    @PostConstruct
    void validateConfig() {
        if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank()) {
            log.warn("NAVER_SEARCH_CLIENT_ID/SECRET not configured — Naver search will fail at runtime");
        }
    }

    /**
     * Naver 지역검색 API proxy. Cached 60s per (normalised) query string via
     * Caffeine — see application.yml `spring.cache.caffeine.spec`. The cache
     * protects the Naver free-tier 25K/day quota from being burned by repeated
     * identical search bar typings and by the NL search Naver merge path (F7).
     */
    @Cacheable("naverPlaces")
    public List<NaverPlaceResult> search(String query) {
        // Security task #76: sanitise the query before it leaves our process.
        // Two reasons:
        //   1. The LLM-produced Location.NamedPlace.name lands here, so a
        //      prompt-injected control / bidi / zero-width payload would
        //      otherwise reach Naver's audit log verbatim.
        //   2. The cache key is the (cleaned) query string; sanitisation also
        //      improves @Cacheable hit rate by collapsing zero-width variants.
        // Length cap mirrors Location.NamedPlace.MAX_NAME_LENGTH.
        String safeQuery = sanitiseQuery(query);

        URI uri = UriComponentsBuilder.fromUriString(NAVER_LOCAL_URL)
            .queryParam("query", safeQuery)
            .queryParam("display", DEFAULT_DISPLAY)
            .queryParam("start", 1)
            .queryParam("sort", "random")
            .build()
            .encode()
            .toUri();

        Map<?, ?> response;
        try {
            response = webClient.get()
                .uri(uri)
                .headers(h -> {
                    h.set("X-Naver-Client-Id", clientId);
                    h.set("X-Naver-Client-Secret", clientSecret);
                    h.set("Accept", "application/json");
                    h.set("User-Agent", "Mozilla/5.0 IronSpot");
                })
                .retrieve()
                .bodyToMono(Map.class)
                .block(TIMEOUT);
        } catch (RuntimeException e) {
            log.warn("Naver 지역검색 API call failed for query='{}': {}", query, e.getMessage());
            throw new BusinessException("Naver 지역검색 API 호출에 실패했습니다", HttpStatus.BAD_GATEWAY);
        }

        if (response == null) return List.of();
        List<?> items = (List<?>) response.get("items");
        if (items == null || items.isEmpty()) return List.of();

        return items.stream()
            .map(raw -> mapItem((Map<?, ?>) raw))
            .filter(Objects::nonNull)
            .toList();
    }

    private NaverPlaceResult mapItem(Map<?, ?> item) {
        String name = stripHtml(asString(item.get("title")));
        String roadAddress = asString(item.get("roadAddress"));
        String address = asString(item.get("address"));
        Double longitude = parseCoord(item.get("mapx"));
        Double latitude = parseCoord(item.get("mapy"));

        // roadAddress is empty for places without a road-name address (e.g. 산간/구주소).
        // Fall back to jibun address rather than dropping the result.
        String displayRoadAddress = roadAddress.isBlank() ? address : roadAddress;
        String dedupKeyPart = roadAddress.isBlank() ? address : roadAddress;

        if (name.isBlank() || displayRoadAddress.isBlank() || latitude == null || longitude == null) {
            log.debug("Skipping Naver item with missing required fields: {}", item);
            return null;
        }

        String id = extractPlaceId(asString(item.get("link")))
            .orElseGet(() -> synthesizeId(dedupKeyPart, name));

        String phone = blankToNull(asString(item.get("telephone")));
        String category = blankToNull(asString(item.get("category")));

        return new NaverPlaceResult(id, name, displayRoadAddress, address, latitude, longitude, phone, category);
    }

    /**
     * Security task #76: replace the previous "&lt;/?b&gt;-only" stripper. Naver
     * Local API mostly returns &lt;b&gt; for query highlights but is not
     * contractually limited to that tag; a stray &lt;script&gt; or javascript:
     * URI in a vendor-submitted name field would survive the old regex and
     * land in the dashboard (admin web UI). htmlUnescape covers HTML entity
     * decoding so {@code &amp;#x3C;script&amp;#x3E;} cannot smuggle a tag past
     * the strip.
     */
    private static String stripHtml(String value) {
        if (value == null) return "";
        String unescaped = org.springframework.web.util.HtmlUtils.htmlUnescape(value);
        return unescaped.replaceAll("<[^>]+>", "");
    }

    /**
     * NFC-normalise + {@code \p{C}} strip + 60-char cap. Matches the
     * {@link com.ironspot.search.dsl.Location} NamedPlace bounds so the LLM
     * cannot smuggle anything outbound that the DSL layer already rejected.
     */
    static String sanitiseQuery(String query) {
        if (query == null) return "";
        String stripped = java.text.Normalizer
            .normalize(query, java.text.Normalizer.Form.NFC)
            .replaceAll("\\p{C}", "")
            .trim();
        return stripped.length() > 60 ? stripped.substring(0, 60) : stripped;
    }

    private static String asString(Object value) {
        return value == null ? "" : value.toString();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static Double parseCoord(Object raw) {
        if (raw == null) return null;
        try {
            double scaled = Double.parseDouble(raw.toString());
            return scaled / NAVER_COORD_SCALE;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Optional<String> extractPlaceId(String link) {
        if (link == null || link.isBlank()) return Optional.empty();
        Matcher m = PLACE_ID_IN_LINK.matcher(link);
        return m.find() ? Optional.of(m.group(1)) : Optional.empty();
    }

    private static String synthesizeId(String roadAddress, String name) {
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            byte[] digest = sha.digest((roadAddress + "|" + name).getBytes(StandardCharsets.UTF_8));
            return "synthetic_" + HexFormat.of().formatHex(digest).substring(0, 16);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
