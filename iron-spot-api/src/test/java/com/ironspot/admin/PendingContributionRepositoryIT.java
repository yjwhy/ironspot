package com.ironspot.admin;

import com.ironspot.admin.dto.AdminPendingContribution;
import com.ironspot.brand.BrandRepository;
import com.ironspot.common.IntegrationTestBase;
import com.ironspot.machine.MachineRepository;
import com.ironspot.machine.MachineTemplateRepository;
import com.ironspot.photo.PhotoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Phase 5 item 11 sub-task 4 — repository-level coverage for the admin
 * pending-contribution queue. Exercises the new methods on
 * {@link MachineRepository}, {@link BrandRepository},
 * {@link MachineTemplateRepository}, and {@link PhotoRepository} directly so
 * SQL regressions surface here rather than in the slice d controller IT.
 */
@SpringBootTest
class PendingContributionRepositoryIT extends IntegrationTestBase {

    @Autowired private MachineRepository machineRepository;
    @Autowired private BrandRepository brandRepository;
    @Autowired private MachineTemplateRepository templateRepository;
    @Autowired private PhotoRepository photoRepository;
    @Autowired private JdbcTemplate jdbc;

    private static final UUID GYM_ID = UUID.fromString("a0000001-0000-0000-0000-000000000001");
    private static final UUID TEMPLATE_ID = UUID.fromString("e0000001-0000-0000-0000-000000000001");
    private static final UUID BRAND_ID = UUID.fromString("b0000001-0000-0000-0000-000000000001");
    private static final UUID CATEGORY_ID = UUID.fromString("c0000001-0000-0000-0000-000000000001");
    private static final UUID USER_ID = UUID.fromString("d0000001-0000-0000-0000-000000000001");

    @BeforeEach
    void wipePendingFixtures() {
        // Photos first — gym_machines FK has no cascade.
        jdbc.update("DELETE FROM machine_photos WHERE photo_url LIKE 'https://test.example/pending/%'");
        jdbc.update("DELETE FROM gym_machines WHERE pending_review = true OR is_custom = true");
        // Wipe admin-created templates / brands so the create tests can re-run.
        jdbc.update("DELETE FROM machine_templates WHERE name_en LIKE 'IT-pending-%'");
        jdbc.update("DELETE FROM brands WHERE name LIKE 'IT-pending-%'");
    }

    @Test
    void listPendingContributions_returnsOnlyPendingNotSoftDeletedSortedByCreatedAtDesc() {
        UUID older = seedPending("Older Contribution", null, OffsetDateTime.now().minus(2, ChronoUnit.HOURS));
        UUID newer = seedPending("Newer Contribution", null, OffsetDateTime.now().minus(5, ChronoUnit.MINUTES));
        UUID softDeleted = seedPending("Rejected Contribution", null, OffsetDateTime.now().minus(1, ChronoUnit.HOURS));
        jdbc.update("UPDATE gym_machines SET deleted_at = NOW() WHERE id = ?", softDeleted);

        List<AdminPendingContribution> list = machineRepository.listPendingContributions(50);

        assertThat(list).extracting(AdminPendingContribution::gymMachineId)
            .containsExactly(newer, older)
            .doesNotContain(softDeleted);
        assertThat(list.get(0).gymName()).isNotBlank();
        assertThat(list.get(0).freeFormName()).isEqualTo("Newer Contribution");
    }

    @Test
    void listPendingContributions_includesPhotoUrlSubquery() {
        UUID pendingId = seedPending("Photo Bound", null, OffsetDateTime.now());
        UUID photoId = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO machine_photos(id, gym_machine_id, user_id, photo_url) VALUES (?, ?, ?, ?)",
            photoId, pendingId, USER_ID, "https://test.example/pending/photo.jpg");

        AdminPendingContribution row = machineRepository.listPendingContributions(50).get(0);

        assertThat(row.gymMachineId()).isEqualTo(pendingId);
        assertThat(row.photoUrl()).isEqualTo("https://test.example/pending/photo.jpg");
    }

    @Test
    void listPendingContributions_respectsLimit() {
        seedPending("A", null, OffsetDateTime.now().minus(3, ChronoUnit.MINUTES));
        seedPending("B", null, OffsetDateTime.now().minus(2, ChronoUnit.MINUTES));
        seedPending("C", null, OffsetDateTime.now().minus(1, ChronoUnit.MINUTES));

        assertThat(machineRepository.listPendingContributions(2)).hasSize(2);
    }

    @Test
    void findPendingForPromote_returnsGymIdAndQuantity_orEmptyWhenUnknown() {
        UUID pendingId = seedPending("Pending Promote", null, OffsetDateTime.now());

        Optional<MachineRepository.PendingContributionForPromote> hit =
            machineRepository.findPendingForPromote(pendingId);
        assertThat(hit).isPresent();
        assertThat(hit.get().gymId()).isEqualTo(GYM_ID);
        assertThat(hit.get().quantity()).isEqualTo(1);

        assertThat(machineRepository.findPendingForPromote(UUID.randomUUID())).isEmpty();
    }

    @Test
    void findExistingApprovedAtGym_findsApprovedExcludesPendingAndSoftDeleted() {
        Optional<UUID> approved = machineRepository.findExistingApprovedAtGym(GYM_ID, TEMPLATE_ID);
        assertThat(approved).isPresent();

        Optional<UUID> nope = machineRepository.findExistingApprovedAtGym(GYM_ID, UUID.randomUUID());
        assertThat(nope).isEmpty();

        UUID pendingAtSameTemplate = seedPending("Pending duplicate", TEMPLATE_ID, OffsetDateTime.now());
        Optional<UUID> stillFindsApproved = machineRepository.findExistingApprovedAtGym(GYM_ID, TEMPLATE_ID);
        assertThat(stillFindsApproved).isPresent().contains(approved.get());
        assertThat(stillFindsApproved.get()).isNotEqualTo(pendingAtSameTemplate);
    }

    @Test
    void promoteToTemplate_clearsCustomFieldsAndIsIdempotent() {
        UUID pendingId = seedPending("Will Promote", null, OffsetDateTime.now());

        int first = machineRepository.promoteToTemplate(pendingId, TEMPLATE_ID);
        assertThat(first).isEqualTo(1);

        UUID templateAfter = jdbc.queryForObject(
            "SELECT template_id FROM gym_machines WHERE id = ?", UUID.class, pendingId);
        Boolean pendingAfter = jdbc.queryForObject(
            "SELECT pending_review FROM gym_machines WHERE id = ?", Boolean.class, pendingId);
        Boolean customAfter = jdbc.queryForObject(
            "SELECT is_custom FROM gym_machines WHERE id = ?", Boolean.class, pendingId);
        String customNameAfter = jdbc.queryForObject(
            "SELECT custom_name FROM gym_machines WHERE id = ?", String.class, pendingId);

        assertThat(templateAfter).isEqualTo(TEMPLATE_ID);
        assertThat(pendingAfter).isFalse();
        assertThat(customAfter).isFalse();
        assertThat(customNameAfter).isNull();

        // Calling again must not double-apply.
        int second = machineRepository.promoteToTemplate(pendingId, TEMPLATE_ID);
        assertThat(second).isZero();
    }

    @Test
    void incrementQuantity_addsDelta() {
        UUID existing = jdbc.queryForObject(
            "SELECT id FROM gym_machines WHERE gym_id = ? AND template_id = ? AND pending_review = false LIMIT 1",
            UUID.class, GYM_ID, TEMPLATE_ID);
        Integer before = jdbc.queryForObject(
            "SELECT quantity FROM gym_machines WHERE id = ?", Integer.class, existing);

        int rows = machineRepository.incrementQuantity(existing, 3);

        Integer after = jdbc.queryForObject(
            "SELECT quantity FROM gym_machines WHERE id = ?", Integer.class, existing);
        assertThat(rows).isEqualTo(1);
        assertThat(after).isEqualTo(before + 3);

        // Restore so other tests are not affected.
        jdbc.update("UPDATE gym_machines SET quantity = ? WHERE id = ?", before, existing);
    }

    @Test
    void countPendingContributionsByWeek_groupsByWeek() {
        OffsetDateTime now = OffsetDateTime.now();
        seedPending("Wk-0 A", null, now);
        seedPending("Wk-0 B", null, now);
        seedPending("Wk-1", null, now.minus(8, ChronoUnit.DAYS));

        List<MachineRepository.PendingContributionWeekBucket> buckets =
            machineRepository.countPendingContributionsByWeek();

        assertThat(buckets).hasSizeGreaterThanOrEqualTo(2);
        assertThat(buckets.get(0).submissionCount()).isGreaterThanOrEqualTo(2);
    }

    @Test
    void brandCreate_returnsIdAndExistsById() {
        UUID newId = brandRepository.create("IT-pending-brand-A", "IT 보류 브랜드 A");
        assertThat(newId).isNotNull();
        assertThat(brandRepository.existsById(newId)).isTrue();
        assertThat(brandRepository.existsById(UUID.randomUUID())).isFalse();
    }

    @Test
    void templateCreate_insertsApprovedRow() {
        UUID brandId = brandRepository.create("IT-pending-brand-B", "IT 보류 브랜드 B");
        UUID templateId = templateRepository.create(
            brandId, CATEGORY_ID,
            "IT-pending-template", "한국어 머신명", "pin", null);

        Boolean approved = jdbc.queryForObject(
            "SELECT is_approved FROM machine_templates WHERE id = ?", Boolean.class, templateId);
        String loading = jdbc.queryForObject(
            "SELECT loading_type::text FROM machine_templates WHERE id = ?", String.class, templateId);
        UUID resolvedBrand = jdbc.queryForObject(
            "SELECT brand_id FROM machine_templates WHERE id = ?", UUID.class, templateId);

        assertThat(approved).isTrue();
        assertThat(loading).isEqualTo("pin");
        assertThat(resolvedBrand).isEqualTo(brandId);
    }

    @Test
    void photoRebindGymMachineId_movesAllPhotos() {
        UUID source = seedPending("Source", null, OffsetDateTime.now());
        UUID photo1 = UUID.randomUUID();
        UUID photo2 = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO machine_photos(id, gym_machine_id, user_id, photo_url) VALUES (?, ?, ?, ?)",
            photo1, source, USER_ID, "https://test.example/pending/move-1.jpg");
        jdbc.update(
            "INSERT INTO machine_photos(id, gym_machine_id, user_id, photo_url) VALUES (?, ?, ?, ?)",
            photo2, source, USER_ID, "https://test.example/pending/move-2.jpg");
        UUID target = jdbc.queryForObject(
            "SELECT id FROM gym_machines WHERE gym_id = ? AND pending_review = false LIMIT 1",
            UUID.class, GYM_ID);

        int moved = photoRepository.rebindGymMachineId(source, target);

        assertThat(moved).isEqualTo(2);
        UUID p1Bound = jdbc.queryForObject(
            "SELECT gym_machine_id FROM machine_photos WHERE id = ?", UUID.class, photo1);
        UUID p2Bound = jdbc.queryForObject(
            "SELECT gym_machine_id FROM machine_photos WHERE id = ?", UUID.class, photo2);
        assertThat(p1Bound).isEqualTo(target);
        assertThat(p2Bound).isEqualTo(target);
    }

    private UUID seedPending(String customName, UUID templateId, OffsetDateTime createdAt) {
        UUID id = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO gym_machines(id, gym_id, template_id, quantity, is_custom, custom_name, pending_review, created_at) "
                + "VALUES (?, ?, ?, 1, true, ?, true, ?)",
            id, GYM_ID, templateId, customName, createdAt);
        return id;
    }
}
