package com.ironspot.gym;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.gym.dto.NaverPlaceResult;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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

    public List<NaverPlaceResult> search(String query) {
        URI uri = UriComponentsBuilder.fromUriString(NAVER_LOCAL_URL)
            .queryParam("query", query)
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

    private static String stripHtml(String value) {
        if (value == null) return "";
        return HTML_BOLD_TAG.matcher(value).replaceAll("");
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
