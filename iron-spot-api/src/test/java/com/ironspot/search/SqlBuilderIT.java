package com.ironspot.search;

import com.ironspot.common.IntegrationTestBase;
import com.ironspot.gym.dto.GymWithMachineCountResponse;
import com.ironspot.search.dsl.Coordinates;
import com.ironspot.search.dsl.SearchScope;
import org.jooq.DSLContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class SqlBuilderIT extends IntegrationTestBase {

    @Autowired
    private SqlBuilder sqlBuilder;

    @Autowired
    private DSLContext dsl;

    // Busan-area test data, far from the Seoul-area seed gym at (127.0276, 37.4979)
    private static final double CENTER_LNG = 129.0;
    private static final double CENTER_LAT = 35.1;

    private final UUID brandCybex = UUID.fromString("b9100001-0000-0000-0000-000000000001");
    private final UUID brandTechnogym = UUID.fromString("b9100002-0000-0000-0000-000000000002");
    private final UUID brandPrime = UUID.fromString("b9100003-0000-0000-0000-000000000003");
    private final UUID categoryChest = UUID.fromString("c9100001-0000-0000-0000-000000000001");
    private final UUID templateCybexHighRow = UUID.fromString("e9100001-0000-0000-0000-000000000001");
    private final UUID templateTechnogymChestPress = UUID.fromString("e9100002-0000-0000-0000-000000000002");
    private final UUID templatePrimeHackSquat = UUID.fromString("e9100003-0000-0000-0000-000000000003");
    private final UUID gymA = UUID.fromString("a9100001-0000-0000-0000-000000000001");
    private final UUID gymB = UUID.fromString("a9100002-0000-0000-0000-000000000002");
    private final UUID gymC = UUID.fromString("a9100003-0000-0000-0000-000000000003");
    private final UUID gymD = UUID.fromString("a9100004-0000-0000-0000-000000000004");

    @BeforeEach
    void seed() {
        dsl.execute(
            "INSERT INTO brands(id, name, name_ko) VALUES "
                + "(?, 'Cybex', '싸이벡스'), (?, 'Technogym', '테크노짐'), (?, 'Prime', '프라임')",
            brandCybex, brandTechnogym, brandPrime);
        dsl.execute("INSERT INTO categories(id, name) VALUES (?, 'Chest')", categoryChest);
        dsl.execute("INSERT INTO machine_templates(id, brand_id, category_id, name_en, name_ko, loading_type) VALUES " +
                "(?, ?, ?, 'High Row', '하이로우', 'pin'::loading_type), " +
                "(?, ?, ?, 'Chest Press', '체스트 프레스', 'plate'::loading_type), " +
                "(?, ?, ?, 'Hack Squat', '핵스쿼트', 'plate'::loading_type)",
            templateCybexHighRow, brandCybex, categoryChest,
            templateTechnogymChestPress, brandTechnogym, categoryChest,
            templatePrimeHackSquat, brandPrime, categoryChest);
        // gym A: at center
        insertGym(gymA, "Busan Gym A", CENTER_LNG, CENTER_LAT);
        // gym B: ~5km east of center
        insertGym(gymB, "Busan Gym B", CENTER_LNG + 0.055, CENTER_LAT);
        // gym C: ~1km north of center
        insertGym(gymC, "Busan Gym C", CENTER_LNG, CENTER_LAT + 0.009);
        // gym D: ~45km away (outside any reasonable radius)
        insertGym(gymD, "Busan Gym D Far", CENTER_LNG + 0.5, CENTER_LAT);

        // gym A inventory: 3 Cybex High Row
        dsl.execute("INSERT INTO gym_machines(id, gym_id, template_id, quantity) VALUES (?, ?, ?, 3)",
            UUID.fromString("f9100001-0000-0000-0000-000000000001"), gymA, templateCybexHighRow);
        // gym B inventory: 5 Technogym Chest Press
        dsl.execute("INSERT INTO gym_machines(id, gym_id, template_id, quantity) VALUES (?, ?, ?, 5)",
            UUID.fromString("f9100002-0000-0000-0000-000000000002"), gymB, templateTechnogymChestPress);
        // gym C inventory: 1 Cybex High Row + 4 Technogym Chest Press
        dsl.execute("INSERT INTO gym_machines(id, gym_id, template_id, quantity) VALUES (?, ?, ?, 1), (?, ?, ?, 4)",
            UUID.fromString("f9100003-0000-0000-0000-000000000003"), gymC, templateCybexHighRow,
            UUID.fromString("f9100004-0000-0000-0000-000000000004"), gymC, templateTechnogymChestPress);
        // gym D has no inventory
    }

    private void insertGym(UUID id, String name, double lng, double lat) {
        dsl.execute("INSERT INTO gyms(id, name, address, location, is_verified) VALUES " +
                "(?, ?, '주소', ST_GeographyFromText('SRID=4326;POINT(' || ? || ' ' || ? || ')'), TRUE)",
            id, name, lng, lat);
    }

    @AfterEach
    void cleanup() {
        dsl.execute("DELETE FROM gym_machines WHERE gym_id IN (?, ?, ?, ?)", gymA, gymB, gymC, gymD);
        dsl.execute("DELETE FROM gyms WHERE id IN (?, ?, ?, ?)", gymA, gymB, gymC, gymD);
        dsl.execute("DELETE FROM machine_templates WHERE id IN (?, ?, ?)",
            templateCybexHighRow, templateTechnogymChestPress, templatePrimeHackSquat);
        dsl.execute("DELETE FROM brands WHERE id IN (?, ?, ?)", brandCybex, brandTechnogym, brandPrime);
        dsl.execute("DELETE FROM categories WHERE id = ?", categoryChest);
    }

    @Test
    void spatialFilterExcludesFarGyms() {
        ResolvedLocation loc = new ResolvedLocation(new Coordinates(CENTER_LAT, CENTER_LNG), 2.0);

        List<GymWithMachineCountResponse> results = sqlBuilder.execute(loc, List.of());

        // gym A (center) and gym C (~1km) within 2km; gym B (~5km) and gym D (~50km) excluded
        assertThat(results).extracting(GymWithMachineCountResponse::id)
            .containsExactlyInAnyOrder(gymA, gymC);
    }

    @Test
    void eachSingleBrandFilterAppliesQuantitySum() {
        // brand=Cybex, minCount=2: gym A (3 Cybex) passes, gym C (1 Cybex) fails
        ResolvedLocation loc = new ResolvedLocation(new Coordinates(CENTER_LAT, CENTER_LNG), 10.0);
        ResolvedFilter cybex2 = new ResolvedFilter(brandCybex, null, List.of(), 2, SearchScope.EACH);

        List<GymWithMachineCountResponse> results = sqlBuilder.execute(loc, List.of(cybex2));

        assertThat(results).extracting(GymWithMachineCountResponse::id).containsExactly(gymA);
    }

    @Test
    void eachMultiFilterRequiresAllFiltersIndependentlyHit() {
        // Cybex>=1 AND Technogym>=1: only gym C has both
        ResolvedLocation loc = new ResolvedLocation(new Coordinates(CENTER_LAT, CENTER_LNG), 10.0);
        ResolvedFilter cybex1 = new ResolvedFilter(brandCybex, null, List.of(), 1, SearchScope.EACH);
        ResolvedFilter techno1 = new ResolvedFilter(brandTechnogym, null, List.of(), 1, SearchScope.EACH);

        List<GymWithMachineCountResponse> results = sqlBuilder.execute(loc, List.of(cybex1, techno1));

        assertThat(results).extracting(GymWithMachineCountResponse::id).containsExactly(gymC);
    }

    @Test
    void combinedFilterSumsQuantityAcrossFilterMatches() {
        // (Cybex OR Technogym) SUM >= 5:
        //   gym A: 3 Cybex = 3, fail
        //   gym B: 5 Technogym = 5, pass
        //   gym C: 1 Cybex + 4 Technogym = 5, pass
        ResolvedLocation loc = new ResolvedLocation(new Coordinates(CENTER_LAT, CENTER_LNG), 10.0);
        ResolvedFilter cybex5 = new ResolvedFilter(brandCybex, null, List.of(), 5, SearchScope.COMBINED);
        ResolvedFilter techno5 = new ResolvedFilter(brandTechnogym, null, List.of(), 5, SearchScope.COMBINED);

        List<GymWithMachineCountResponse> results = sqlBuilder.execute(loc, List.of(cybex5, techno5));

        assertThat(results).extracting(GymWithMachineCountResponse::id)
            .containsExactlyInAnyOrder(gymB, gymC);
    }

    @Test
    void templateIdsFilterNarrowsToSpecificTemplates() {
        // templateIds = [Cybex High Row]: gym A and gym C match
        ResolvedLocation loc = new ResolvedLocation(new Coordinates(CENTER_LAT, CENTER_LNG), 10.0);
        ResolvedFilter highRowOnly = new ResolvedFilter(
            null, null, List.of(templateCybexHighRow), 1, SearchScope.EACH);

        List<GymWithMachineCountResponse> results = sqlBuilder.execute(loc, List.of(highRowOnly));

        assertThat(results).extracting(GymWithMachineCountResponse::id)
            .containsExactlyInAnyOrder(gymA, gymC);
    }

    @Test
    void resultsOrderedByDistanceAscending() {
        ResolvedLocation loc = new ResolvedLocation(new Coordinates(CENTER_LAT, CENTER_LNG), 10.0);

        List<GymWithMachineCountResponse> results = sqlBuilder.execute(loc, List.of());

        // 10km radius: gym A (center), gym C (~1km), gym B (~5km) included; gym D (~45km) excluded
        assertThat(results).extracting(GymWithMachineCountResponse::id)
            .containsExactly(gymA, gymC, gymB);
    }
}
