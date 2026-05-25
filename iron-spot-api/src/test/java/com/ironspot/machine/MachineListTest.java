package com.ironspot.machine;

import com.ironspot.auth.JwtValidator;
import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.IntegrationTestBase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class MachineListTest extends IntegrationTestBase {

    @Autowired
    private TestRestTemplate restTemplate;

    @MockitoBean
    private JwtValidator jwtValidator;

    private static final String TEST_USER_ID = "d0000001-0000-0000-0000-000000000001";

    /**
     * Security task #20 — /api/gyms/** GET now requires auth. Attach a
     * bearer header via interceptor so existing call sites stay untouched.
     */
    @BeforeEach
    void setUp() {
        given(jwtValidator.validate(anyString()))
            .willReturn(Optional.of(UserPrincipal.builder()
                .userId(TEST_USER_ID)
                .email("test@example.com")
                .nickname("테스트유저")
                .build()));
        restTemplate.getRestTemplate().setInterceptors(List.of(
            (request, body, execution) -> {
                request.getHeaders().setBearerAuth("fake-token");
                return execution.execute(request, body);
            }
        ));
    }

    @Test
    void listMachinesReturnsGymMachines() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/gyms/a0000001-0000-0000-0000-000000000001/machines", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("High Row");
        assertThat(response.getBody()).contains("Panatta");
    }

    @Test
    void listMachinesReturnsEmptyForUnknownGym() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/gyms/00000000-0000-0000-0000-000000000000/machines", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("[]");
    }
}
