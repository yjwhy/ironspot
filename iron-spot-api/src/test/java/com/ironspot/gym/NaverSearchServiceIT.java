package com.ironspot.gym;

import com.ironspot.gym.dto.NaverPlaceResult;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Real Naver 지역검색 API contract test. Skips locally and in CI when credentials are missing,
 * runs whenever NAVER_SEARCH_CLIENT_ID/SECRET are present so stale fixtures cannot mask breakage.
 */
@EnabledIfEnvironmentVariable(named = "NAVER_SEARCH_CLIENT_ID", matches = ".+")
@EnabledIfEnvironmentVariable(named = "NAVER_SEARCH_CLIENT_SECRET", matches = ".+")
class NaverSearchServiceIT {

    @Test
    void realApiReturnsValidPlacesForKoreanQuery() {
        WebClient webClient = WebClient.builder().build();
        NaverSearchService service = new NaverSearchService(webClient);
        ReflectionTestUtils.setField(service, "clientId", System.getenv("NAVER_SEARCH_CLIENT_ID"));
        ReflectionTestUtils.setField(service, "clientSecret", System.getenv("NAVER_SEARCH_CLIENT_SECRET"));

        List<NaverPlaceResult> results = service.search("헬스장");

        assertThat(results).isNotEmpty();
        assertThat(results).allSatisfy(place -> {
            assertThat(place.id()).isNotBlank();
            assertThat(place.name()).isNotBlank();
            assertThat(place.roadAddress()).isNotBlank();
            assertThat(place.latitude()).isBetween(33.0, 39.0);
            assertThat(place.longitude()).isBetween(124.0, 132.0);
        });
    }
}
