package com.ironspot.gym;

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
class GymDetailTest extends IntegrationTestBase {

    @Autowired
    private TestRestTemplate restTemplate;

    @MockitoBean
    private JwtValidator jwtValidator;

    private static final String KNOWN_GYM_ID = "a0000001-0000-0000-0000-000000000001";
    private static final String UNKNOWN_GYM_ID = "00000000-0000-0000-0000-000000000000";
    private static final String TEST_USER_ID = "d0000001-0000-0000-0000-000000000001";

    /**
     * Security task #20 — /api/gyms/** GET now requires auth. Attach a
     * bearer header to every request via the rest template's interceptor
     * list so existing test cases can keep their {@code getForEntity}
     * call sites unchanged. JwtValidator is mocked to return a fixed
     * principal so the interceptor's "fake-token" is accepted.
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
    void getGymByIdReturnsGym() {
        ResponseEntity<String> response =
            restTemplate.getForEntity("/api/gyms/" + KNOWN_GYM_ID, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("테스트 헬스장");
    }

    @Test
    void getGymByUnknownIdReturns404() {
        ResponseEntity<String> response =
            restTemplate.getForEntity("/api/gyms/" + UNKNOWN_GYM_ID, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
