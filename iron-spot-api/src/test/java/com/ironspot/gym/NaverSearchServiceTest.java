package com.ironspot.gym;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.gym.dto.NaverPlaceResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NaverSearchServiceTest {

    @Mock WebClient webClient;
    @SuppressWarnings("rawtypes")
    @Mock WebClient.RequestHeadersUriSpec uriSpec;
    @SuppressWarnings("rawtypes")
    @Mock WebClient.RequestHeadersSpec headersSpec;
    @Mock WebClient.ResponseSpec responseSpec;
    @SuppressWarnings("rawtypes")
    @Mock Mono<Map> monoResponse;

    @InjectMocks NaverSearchService service;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setup() {
        ReflectionTestUtils.setField(service, "clientId", "test-id");
        ReflectionTestUtils.setField(service, "clientSecret", "test-secret");
        when(webClient.get()).thenReturn(uriSpec);
        when(uriSpec.uri(any(URI.class))).thenReturn(headersSpec);
        when(headersSpec.headers(any())).thenReturn(headersSpec);
        when(headersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(Map.class)).thenReturn(monoResponse);
    }

    @Test
    void parsesNaverItemAndExtractsPlaceIdFromLink() {
        Map<String, Object> item = Map.of(
            "title", "에어<b>짐</b>",
            "link", "https://map.naver.com/v5/entry/place/12345",
            "address", "서울 강남구 1",
            "roadAddress", "서울특별시 강남대로 1",
            "telephone", "02-1234-5678",
            "category", "스포츠,레저>스포츠시설>헬스클럽",
            "mapx", "1270315234",
            "mapy", "374875432"
        );
        when(monoResponse.block(any())).thenReturn(Map.of("items", List.of(item)));

        List<NaverPlaceResult> results = service.search("에어짐");

        assertThat(results).hasSize(1);
        NaverPlaceResult place = results.get(0);
        assertThat(place.id()).isEqualTo("12345");
        assertThat(place.name()).isEqualTo("에어짐");
        assertThat(place.roadAddress()).isEqualTo("서울특별시 강남대로 1");
        assertThat(place.address()).isEqualTo("서울 강남구 1");
        assertThat(place.longitude()).isEqualTo(127.0315234);
        assertThat(place.latitude()).isEqualTo(37.4875432);
        assertThat(place.phone()).isEqualTo("02-1234-5678");
        assertThat(place.category()).isEqualTo("스포츠,레저>스포츠시설>헬스클럽");
    }

    @Test
    void synthesizesIdWhenLinkLacksPlaceId() {
        Map<String, Object> item = Map.of(
            "title", "동네짐",
            "link", "https://example.com/gym",
            "address", "서울 강남구 어딘가",
            "roadAddress", "서울특별시 어딘가 1",
            "telephone", "",
            "category", "",
            "mapx", "1270000000",
            "mapy", "375000000"
        );
        when(monoResponse.block(any())).thenReturn(Map.of("items", List.of(item)));

        List<NaverPlaceResult> results = service.search("동네짐");

        assertThat(results).hasSize(1);
        NaverPlaceResult place = results.get(0);
        assertThat(place.id()).startsWith("synthetic_");
        assertThat(place.phone()).isNull();
        assertThat(place.category()).isNull();
    }

    @Test
    void synthesizedIdIsDeterministicForSameRoadAddressAndName() {
        Map<String, Object> item = Map.of(
            "title", "동네짐",
            "link", "",
            "address", "주소",
            "roadAddress", "서울 도로명",
            "telephone", "",
            "category", "",
            "mapx", "1270000000",
            "mapy", "375000000"
        );
        when(monoResponse.block(any()))
            .thenReturn(Map.of("items", List.of(item)))
            .thenReturn(Map.of("items", List.of(item)));

        String firstId = service.search("동네짐").get(0).id();
        String secondId = service.search("동네짐").get(0).id();

        assertThat(firstId).isEqualTo(secondId);
    }

    @Test
    void returnsEmptyListWhenItemsAreEmpty() {
        when(monoResponse.block(any())).thenReturn(Map.of("items", List.of()));
        assertThat(service.search("nothing")).isEmpty();
    }

    @Test
    void returnsEmptyListWhenResponseIsNull() {
        when(monoResponse.block(any())).thenReturn(null);
        assertThat(service.search("nothing")).isEmpty();
    }

    @Test
    void skipsItemsMissingRequiredFields() {
        Map<String, Object> incomplete = Map.of(
            "title", "",
            "link", "",
            "address", "",
            "roadAddress", "",
            "telephone", "",
            "category", "",
            "mapx", "",
            "mapy", ""
        );
        when(monoResponse.block(any())).thenReturn(Map.of("items", List.of(incomplete)));
        assertThat(service.search("garbage")).isEmpty();
    }

    @Test
    void wrapsTransportFailureAsBusinessException() {
        when(monoResponse.block(any())).thenThrow(new RuntimeException("network down"));
        assertThatThrownBy(() -> service.search("anything"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Naver");
    }
}
