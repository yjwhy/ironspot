package com.ironspot.admin;

import com.ironspot.auth.JwtValidator;
import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.IntegrationTestBase;
import com.ironspot.common.notification.AdminNotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

/**
 * Phase 5 item 11 sub-task 4 — controller IT for the admin pending-contribution
 * endpoints. Walks each promote kind (existing / newTemplate / newBrandAndTemplate)
 * plus the merge branch, plus reject + auth gates.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminPendingContributionIT extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JdbcTemplate jdbc;
    @MockitoBean private JwtValidator jwtValidator;
    @MockitoBean private AdminNotificationService notifier;

    private static final String ADMIN_ID = "d0000088-0000-0000-0000-000000000088";
    private static final String REGULAR_ID = "d0000077-0000-0000-0000-000000000077";
    private static final UUID GYM_ID = UUID.fromString("a0000001-0000-0000-0000-000000000001");
    private static final UUID TEMPLATE_ID = UUID.fromString("e0000001-0000-0000-0000-000000000001");
    private static final UUID BRAND_ID = UUID.fromString("b0000001-0000-0000-0000-000000000001");
    private static final UUID CATEGORY_ID = UUID.fromString("c0000001-0000-0000-0000-000000000001");

    @BeforeEach
    void setUp() {
        jdbc.update(
            "INSERT INTO users(id, email, nickname, role) VALUES (?, ?, ?, 'admin') "
                + "ON CONFLICT (id) DO UPDATE SET role = 'admin', banned_at = NULL",
            UUID.fromString(ADMIN_ID), "admin-pending@example.com", "관리자");
        jdbc.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) "
                + "ON CONFLICT (id) DO UPDATE SET role = 'user', banned_at = NULL",
            UUID.fromString(REGULAR_ID), "regular-pending@example.com", "일반유저");

        // Cleanup order matters: gym_machines references machine_templates which
        // references brands. Cascading promote tests leave gym_machines rows
        // pointing at IT- templates (no longer pending), so deleting templates
        // first violates the FK. Walk the chain in reverse-dependency order.
        jdbc.update("DELETE FROM machine_photos WHERE photo_url LIKE 'https://test.example/it/%'");
        jdbc.update(
            "DELETE FROM gym_machines WHERE pending_review = true OR is_custom = true "
                + "OR template_id IN (SELECT id FROM machine_templates WHERE name_en LIKE 'IT-%')");
        jdbc.update("DELETE FROM machine_templates WHERE name_en LIKE 'IT-%'");
        jdbc.update("DELETE FROM brands WHERE name LIKE 'IT-%'");
    }

    @Test
    void listPending_requiresAuth() {
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/contributions/pending",
            HttpMethod.GET,
            new HttpEntity<>(new HttpHeaders()),
            String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void listPending_403WhenNotAdmin() {
        mockPrincipal(REGULAR_ID, "user");
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/contributions/pending",
            HttpMethod.GET, bearer(),
            String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void listPending_returnsPendingRowsForAdmin() {
        mockPrincipal(ADMIN_ID, "admin");
        UUID pending = seedPending("Hammer Lat Pulldown");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/contributions/pending",
            HttpMethod.GET, bearer(),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains(pending.toString());
        assertThat(response.getBody()).contains("Hammer Lat Pulldown");
    }

    @Test
    void promote_existingTemplate_mergesIntoApprovedRowAtSameGym() {
        mockPrincipal(ADMIN_ID, "admin");
        UUID pending = seedPending("Duplicate Lat Pulldown");
        UUID photoId = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO machine_photos(id, gym_machine_id, user_id, photo_url) VALUES (?, ?, ?, ?)",
            photoId, pending, UUID.fromString(ADMIN_ID),
            "https://test.example/it/dup.jpg");

        UUID existingApproved = jdbc.queryForObject(
            "SELECT id FROM gym_machines WHERE gym_id = ? AND template_id = ? AND pending_review = false LIMIT 1",
            UUID.class, GYM_ID, TEMPLATE_ID);
        Integer beforeQty = jdbc.queryForObject(
            "SELECT quantity FROM gym_machines WHERE id = ?", Integer.class, existingApproved);

        String body = "{\"kind\":\"existingTemplate\",\"templateId\":\"" + TEMPLATE_ID + "\"}";
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/gym-machines/" + pending + "/promote",
            HttpMethod.POST, json(body),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"mergedIntoGymMachineId\":\"" + existingApproved + "\"");

        Integer afterQty = jdbc.queryForObject(
            "SELECT quantity FROM gym_machines WHERE id = ?", Integer.class, existingApproved);
        UUID photoBoundTo = jdbc.queryForObject(
            "SELECT gym_machine_id FROM machine_photos WHERE id = ?", UUID.class, photoId);
        Boolean pendingDeleted = jdbc.queryForObject(
            "SELECT deleted_at IS NOT NULL FROM gym_machines WHERE id = ?", Boolean.class, pending);

        assertThat(afterQty).isEqualTo(beforeQty + 1);
        assertThat(photoBoundTo).isEqualTo(existingApproved);
        assertThat(pendingDeleted).isTrue();

        // Restore for other tests.
        jdbc.update("UPDATE gym_machines SET quantity = ? WHERE id = ?", beforeQty, existingApproved);
    }

    @Test
    void promote_existingTemplate_noMergePromotesPendingRow() {
        mockPrincipal(ADMIN_ID, "admin");
        // Both seed templates already have a gym_machines row at GYM_ID, which
        // would force the merge branch. Insert a fresh approved template with
        // the IT- prefix so @BeforeEach's cleanup chain picks it up next run.
        UUID freeTemplate = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO machine_templates(id, brand_id, category_id, name_en, name_ko, loading_type, is_approved) "
                + "VALUES (?, ?, ?, 'IT-NoMergeTpl', 'IT 병합 없음 템플릿', 'pin', true)",
            freeTemplate, BRAND_ID, CATEGORY_ID);
        UUID pending = seedPending("To Be Promoted");

        String body = "{\"kind\":\"existingTemplate\",\"templateId\":\"" + freeTemplate + "\"}";
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/gym-machines/" + pending + "/promote",
            HttpMethod.POST, json(body),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"mergedIntoGymMachineId\":null");
        Boolean pendingFlag = jdbc.queryForObject(
            "SELECT pending_review FROM gym_machines WHERE id = ?", Boolean.class, pending);
        UUID newTemplate = jdbc.queryForObject(
            "SELECT template_id FROM gym_machines WHERE id = ?", UUID.class, pending);
        assertThat(pendingFlag).isFalse();
        assertThat(newTemplate).isEqualTo(freeTemplate);
    }

    @Test
    void promote_newTemplate_createsTemplateAndPromotes() {
        mockPrincipal(ADMIN_ID, "admin");
        UUID pending = seedPending("Brand-New Template Row");

        String body = "{"
            + "\"kind\":\"newTemplate\","
            + "\"brandId\":\"" + BRAND_ID + "\","
            + "\"nameEn\":\"IT-NewTpl\","
            + "\"nameKo\":\"IT 신규 템플릿\","
            + "\"loadingType\":\"plate\","
            + "\"categoryId\":\"" + CATEGORY_ID + "\""
            + "}";
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/gym-machines/" + pending + "/promote",
            HttpMethod.POST, json(body),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        UUID created = jdbc.queryForObject(
            "SELECT id FROM machine_templates WHERE name_en = 'IT-NewTpl'", UUID.class);
        assertThat(created).isNotNull();
        UUID rowTemplate = jdbc.queryForObject(
            "SELECT template_id FROM gym_machines WHERE id = ?", UUID.class, pending);
        assertThat(rowTemplate).isEqualTo(created);
    }

    @Test
    void promote_newBrandAndTemplate_createsBothAndPromotes() {
        mockPrincipal(ADMIN_ID, "admin");
        UUID pending = seedPending("New Brand Row");

        String body = "{"
            + "\"kind\":\"newBrandAndTemplate\","
            + "\"newBrandName\":\"IT-NewBrand\","
            + "\"newBrandNameKo\":\"IT 신규 브랜드\","
            + "\"nameEn\":\"IT-NewBrandTpl\","
            + "\"nameKo\":\"IT 신규 브랜드 템플릿\","
            + "\"loadingType\":\"pin\","
            + "\"categoryId\":\"" + CATEGORY_ID + "\""
            + "}";
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/gym-machines/" + pending + "/promote",
            HttpMethod.POST, json(body),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        UUID brandId = jdbc.queryForObject(
            "SELECT id FROM brands WHERE name = 'IT-NewBrand'", UUID.class);
        String storedNameKo = jdbc.queryForObject(
            "SELECT name_ko FROM brands WHERE name = 'IT-NewBrand'", String.class);
        UUID templateId = jdbc.queryForObject(
            "SELECT id FROM machine_templates WHERE name_en = 'IT-NewBrandTpl'", UUID.class);
        assertThat(brandId).isNotNull();
        assertThat(storedNameKo).isEqualTo("IT 신규 브랜드");
        assertThat(templateId).isNotNull();
        UUID rowTemplate = jdbc.queryForObject(
            "SELECT template_id FROM gym_machines WHERE id = ?", UUID.class, pending);
        assertThat(rowTemplate).isEqualTo(templateId);
    }

    @Test
    void promote_400OnUnknownTemplate() {
        mockPrincipal(ADMIN_ID, "admin");
        UUID pending = seedPending("Unknown Tpl");

        String body = "{\"kind\":\"existingTemplate\",\"templateId\":\"00000000-0000-0000-0000-000000000000\"}";
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/gym-machines/" + pending + "/promote",
            HttpMethod.POST, json(body),
            String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void promote_404OnUnknownPendingRow() {
        mockPrincipal(ADMIN_ID, "admin");
        UUID unknown = UUID.randomUUID();
        String body = "{\"kind\":\"existingTemplate\",\"templateId\":\"" + TEMPLATE_ID + "\"}";
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/gym-machines/" + unknown + "/promote",
            HttpMethod.POST, json(body),
            String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void reject_204AndSoftDeletesRow() {
        mockPrincipal(ADMIN_ID, "admin");
        UUID pending = seedPending("To Reject");

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/admin/contributions/" + pending,
            HttpMethod.DELETE, bearer(),
            Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        Boolean deleted = jdbc.queryForObject(
            "SELECT deleted_at IS NOT NULL FROM gym_machines WHERE id = ?", Boolean.class, pending);
        assertThat(deleted).isTrue();
    }

    @Test
    void reject_404OnAlreadyPromoted() {
        mockPrincipal(ADMIN_ID, "admin");
        UUID pending = seedPending("Already Promoted");
        jdbc.update(
            "UPDATE gym_machines SET pending_review = false, is_custom = false, custom_name = NULL WHERE id = ?",
            pending);

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/contributions/" + pending,
            HttpMethod.DELETE, bearer(),
            String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    private UUID seedPending(String customName) {
        UUID id = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO gym_machines(id, gym_id, template_id, quantity, is_custom, custom_name, pending_review) "
                + "VALUES (?, ?, NULL, 1, true, ?, true)",
            id, GYM_ID, customName);
        return id;
    }

    private void mockPrincipal(String userId, String role) {
        UserPrincipal principal = UserPrincipal.builder()
            .userId(userId)
            .email(userId + "@example.com")
            .role(role)
            .build();
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal));
    }

    private HttpEntity<Void> bearer() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("token");
        return new HttpEntity<>(headers);
    }

    private HttpEntity<String> json(String body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth("token");
        return new HttpEntity<>(body, headers);
    }
}
