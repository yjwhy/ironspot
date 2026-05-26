package com.ironspot.common.ratelimit;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ClientIpResolverTest {

    @Test
    void singleHop_returnsForwardedAddress() {
        // Render-only deployment: edge proxy sets X-Forwarded-For with
        // a single entry → trust it.
        ClientIpResolver resolver = new ClientIpResolver(1);
        HttpServletRequest req = mockRequest("10.0.0.1", "8.8.8.8");
        assertThat(resolver.resolve(req)).isEqualTo("8.8.8.8");
    }

    @Test
    void singleHop_chainOfTwo_fallsBackToRemoteAddr() {
        // Attacker prepends a spoof entry; Render's edge appends the real
        // socket peer → chain length 2 ≠ trustedHops 1 → distrust.
        ClientIpResolver resolver = new ClientIpResolver(1);
        HttpServletRequest req = mockRequest("10.0.0.1", "evil.spoof, 8.8.8.8");
        assertThat(resolver.resolve(req)).isEqualTo("10.0.0.1");
    }

    @Test
    void singleHop_blankHeader_fallsBack() {
        ClientIpResolver resolver = new ClientIpResolver(1);
        HttpServletRequest req = mockRequest("10.0.0.1", "  ");
        assertThat(resolver.resolve(req)).isEqualTo("10.0.0.1");
    }

    @Test
    void singleHop_missingHeader_usesRemoteAddr() {
        ClientIpResolver resolver = new ClientIpResolver(1);
        HttpServletRequest req = mockRequest("10.0.0.1", null);
        assertThat(resolver.resolve(req)).isEqualTo("10.0.0.1");
    }

    @Test
    void singleHop_emptyFirstToken_fallsBack() {
        // " , 8.8.8.8" — chain length 2 anyway, but if a future regex
        // change collapses it to length 1 with empty first token, the
        // ".trim().isEmpty()" branch keeps us on the fallback.
        ClientIpResolver resolver = new ClientIpResolver(1);
        HttpServletRequest req = mockRequest("10.0.0.1", "");
        assertThat(resolver.resolve(req)).isEqualTo("10.0.0.1");
    }

    @Test
    void twoHops_returnsLeftmostOfTwo() {
        // Future Cloudflare-in-front-of-Render: trustedHops=2 lets a
        // CDN-set XFF (length 2) through; chain length 3+ still rejects.
        ClientIpResolver resolver = new ClientIpResolver(2);
        HttpServletRequest req = mockRequest("172.16.0.1", "203.0.113.5, 10.0.0.1");
        assertThat(resolver.resolve(req)).isEqualTo("203.0.113.5");
    }

    @Test
    void twoHops_chainOfThree_fallsBack() {
        ClientIpResolver resolver = new ClientIpResolver(2);
        HttpServletRequest req = mockRequest("172.16.0.1", "evil, 203.0.113.5, 10.0.0.1");
        assertThat(resolver.resolve(req)).isEqualTo("172.16.0.1");
    }

    @Test
    void zeroHops_rejected() {
        assertThatThrownBy(() -> new ClientIpResolver(0))
            .isInstanceOf(IllegalArgumentException.class);
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
