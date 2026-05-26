package com.ironspot.photo;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.common.ratelimit.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UploadRateGateTest {

    private static final ClientIpResolver RESOLVER = new ClientIpResolver(1);

    @Test
    void enforce_belowCap_doesNotThrow() {
        UploadRateGate gate = new UploadRateGate(3, RESOLVER);
        HttpServletRequest req = mockRequest("1.2.3.4", null);
        gate.enforce(req);
        gate.enforce(req);
        gate.enforce(req);
        assertThat(gate.peek("1.2.3.4")).isEqualTo(3);
    }

    @Test
    void enforce_overCap_throws429() {
        UploadRateGate gate = new UploadRateGate(2, RESOLVER);
        HttpServletRequest req = mockRequest("1.2.3.4", null);
        gate.enforce(req);
        gate.enforce(req);
        assertThatThrownBy(() -> gate.enforce(req))
            .isInstanceOf(BusinessException.class)
            .matches(ex -> ((BusinessException) ex).getStatus() == HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    void enforce_isolatedPerIp() {
        UploadRateGate gate = new UploadRateGate(2, RESOLVER);
        gate.enforce(mockRequest("1.1.1.1", null));
        gate.enforce(mockRequest("1.1.1.1", null));
        gate.enforce(mockRequest("2.2.2.2", null));
        assertThat(gate.peek("1.1.1.1")).isEqualTo(2);
        assertThat(gate.peek("2.2.2.2")).isEqualTo(1);
    }

    private static HttpServletRequest mockRequest(String remoteAddr, String forwarded) {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRemoteAddr(remoteAddr);
        if (forwarded != null) {
            req.addHeader("X-Forwarded-For", forwarded);
        }
        return req;
    }
}
