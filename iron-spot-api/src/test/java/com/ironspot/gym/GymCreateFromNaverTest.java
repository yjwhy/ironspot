package com.ironspot.gym;

import com.ironspot.common.IntegrationTestBase;
import com.ironspot.gym.dto.CreateGymRequest;
import com.ironspot.gym.dto.GymDetailResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class GymCreateFromNaverTest extends IntegrationTestBase {

    // Seeded by init-test-db.sql.
    private static final UUID TEST_USER_ID =
        UUID.fromString("d0000001-0000-0000-0000-000000000001");

    @Autowired private GymService gymService;
    @Autowired private GymRepository gymRepository;

    @Test
    void createFromNaverPlacesInsertsNewGymWhenPlaceIdNotFound() {
        String uniquePlaceId = "naver-test-" + UUID.randomUUID();
        CreateGymRequest req = new CreateGymRequest(
            "에어짐 강남",
            "서울특별시 강남구 테헤란로 1",
            37.4979,
            127.0276,
            "02-1234-5678",
            uniquePlaceId
        );

        GymDetailResponse created = gymService.createFromNaverPlaces(req, TEST_USER_ID);

        assertThat(created.id()).isNotNull();
        assertThat(created.name()).isEqualTo("에어짐 강남");
        assertThat(created.address()).isEqualTo("서울특별시 강남구 테헤란로 1");
        assertThat(created.latitude()).isEqualTo(37.4979);
        assertThat(created.longitude()).isEqualTo(127.0276);
        assertThat(created.isVerified()).isFalse();
        assertThat(gymRepository.findIdByNaverPlaceId(uniquePlaceId)).contains(created.id());
    }

    @Test
    void createFromNaverPlacesReturnsExistingGymWhenPlaceIdAlreadyExists() {
        String reusedPlaceId = "naver-dedup-" + UUID.randomUUID();
        CreateGymRequest first = new CreateGymRequest(
            "동네짐",
            "서울특별시 어딘가 1",
            37.50,
            127.00,
            null,
            reusedPlaceId
        );
        GymDetailResponse firstResult = gymService.createFromNaverPlaces(first, TEST_USER_ID);

        // Same place id, slightly different name (e.g. user typed differently) — must dedup,
        // never insert a second row, and never override the originally stored name.
        CreateGymRequest second = new CreateGymRequest(
            "동네짐 (지점)",
            "서울특별시 어딘가 1",
            37.50,
            127.00,
            null,
            reusedPlaceId
        );
        GymDetailResponse secondResult = gymService.createFromNaverPlaces(second, TEST_USER_ID);

        assertThat(secondResult.id()).isEqualTo(firstResult.id());
        assertThat(secondResult.name()).isEqualTo("동네짐");
    }

    @Test
    void findIdByNaverPlaceIdReturnsEmptyForUnknownId() {
        assertThat(gymRepository.findIdByNaverPlaceId("definitely-not-a-place-id"))
            .isEmpty();
    }
}
