package com.ironspot.search;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.gym.NaverSearchService;
import com.ironspot.gym.dto.NaverPlaceResult;
import com.ironspot.search.dsl.Coordinates;
import com.ironspot.search.dsl.Location;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class LocationResolver {

    private final NaverSearchService naverSearchService;

    public ResolvedLocation resolve(Location location, double userLat, double userLng) {
        return switch (location) {
            case Location.Current c ->
                new ResolvedLocation(new Coordinates(userLat, userLng), c.radiusKm());
            case Location.NamedPlace np when np.coordinates() != null ->
                new ResolvedLocation(np.coordinates(), np.radiusKm());
            case Location.NamedPlace np ->
                geocode(np);
        };
    }

    private ResolvedLocation geocode(Location.NamedPlace place) {
        List<NaverPlaceResult> results = naverSearchService.search(place.name());
        if (results.isEmpty()) {
            throw new BusinessException(
                "'" + place.name() + "' 위치를 찾을 수 없어요. 정확한 지명을 입력해주세요.",
                HttpStatus.BAD_REQUEST);
        }
        NaverPlaceResult top = results.get(0);
        return new ResolvedLocation(
            new Coordinates(top.latitude(), top.longitude()),
            place.radiusKm()
        );
    }
}
