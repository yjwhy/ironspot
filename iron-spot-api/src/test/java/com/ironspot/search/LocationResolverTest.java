package com.ironspot.search;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.gym.NaverSearchService;
import com.ironspot.gym.dto.NaverPlaceResult;
import com.ironspot.search.dsl.Coordinates;
import com.ironspot.search.dsl.Location;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LocationResolverTest {

    @Mock
    private NaverSearchService naverSearchService;

    @InjectMocks
    private LocationResolver resolver;

    @Test
    void currentLocationUsesUserCoordinates() {
        ResolvedLocation result = resolver.resolve(new Location.Current(1.5), 37.5, 127.0);

        assertThat(result.coordinates()).isEqualTo(new Coordinates(37.5, 127.0));
        assertThat(result.radiusKm()).isEqualTo(1.5);
        verify(naverSearchService, never()).search(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void namedPlaceWithCoordsBypassesNaver() {
        Coordinates seeded = new Coordinates(37.498, 127.027);
        Location.NamedPlace place = new Location.NamedPlace("강남역", seeded, 2.0);

        ResolvedLocation result = resolver.resolve(place, 0.0, 0.0);

        assertThat(result.coordinates()).isEqualTo(seeded);
        assertThat(result.radiusKm()).isEqualTo(2.0);
        verify(naverSearchService, never()).search(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void namedPlaceWithoutCoordsUsesNaverTopOne() {
        when(naverSearchService.search("강남역")).thenReturn(List.of(
            new NaverPlaceResult("place1", "강남역", "road", "addr", 37.498, 127.027, null, null),
            new NaverPlaceResult("place2", "강남역 2번", "road", "addr", 37.499, 127.028, null, null)
        ));

        Location.NamedPlace place = new Location.NamedPlace("강남역", null, 1.0);

        ResolvedLocation result = resolver.resolve(place, 0.0, 0.0);

        assertThat(result.coordinates()).isEqualTo(new Coordinates(37.498, 127.027));
        assertThat(result.radiusKm()).isEqualTo(1.0);
    }

    @Test
    void namedPlaceWithEmptyNaverResultsThrows400() {
        when(naverSearchService.search("랑가")).thenReturn(List.of());

        Location.NamedPlace place = new Location.NamedPlace("랑가", null, 1.0);

        assertThatThrownBy(() -> resolver.resolve(place, 0.0, 0.0))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("랑가");
    }
}
