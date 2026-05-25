package com.ironspot.gym;

import com.ironspot.common.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NaverSearchQuotaServiceTest {

    @Test
    void enforce_belowCap_increments() {
        NaverSearchQuotaService svc = new NaverSearchQuotaService(3);
        svc.enforce("u1");
        svc.enforce("u1");
        assertThat(svc.peek("u1")).isEqualTo(2);
    }

    @Test
    void enforce_atCap_stillAllowed() {
        NaverSearchQuotaService svc = new NaverSearchQuotaService(3);
        svc.enforce("u1");
        svc.enforce("u1");
        svc.enforce("u1");
        assertThat(svc.peek("u1")).isEqualTo(3);
    }

    @Test
    void enforce_overCap_throws429() {
        NaverSearchQuotaService svc = new NaverSearchQuotaService(2);
        svc.enforce("u1");
        svc.enforce("u1");
        assertThatThrownBy(() -> svc.enforce("u1"))
            .isInstanceOf(BusinessException.class)
            .matches(ex -> ((BusinessException) ex).getStatus() == HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    void enforce_isolatedPerUser() {
        NaverSearchQuotaService svc = new NaverSearchQuotaService(2);
        svc.enforce("u1");
        svc.enforce("u1");
        svc.enforce("u2");
        assertThat(svc.peek("u1")).isEqualTo(2);
        assertThat(svc.peek("u2")).isEqualTo(1);
    }

    @Test
    void enforce_nullUserId_throwsIllegalState() {
        NaverSearchQuotaService svc = new NaverSearchQuotaService(10);
        assertThatThrownBy(() -> svc.enforce(null))
            .isInstanceOf(IllegalStateException.class);
    }
}
