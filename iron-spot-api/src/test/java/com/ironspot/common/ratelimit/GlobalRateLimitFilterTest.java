package com.ironspot.common.ratelimit;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

class GlobalRateLimitFilterTest {

    private GlobalRateLimitFilter filter;
    private FilterChain chain;

    @BeforeEach
    void setup() {
        filter = new GlobalRateLimitFilter(3, new ClientIpResolver(1));
        chain = mock(FilterChain.class);
    }

    private MockHttpServletRequest apiReq(String ip) {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRequestURI("/api/gyms/search");
        req.setRemoteAddr(ip);
        return req;
    }

    @Test
    void underCap_callsChain() throws Exception {
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(apiReq("1.1.1.1"), res, chain);
        verify(chain).doFilter(any(HttpServletRequest.class), any(HttpServletResponse.class));
        assertThat(res.getStatus()).isEqualTo(HttpStatus.OK.value());
    }

    @Test
    void atCap_stillAllowed() throws Exception {
        for (int i = 0; i < 3; i++) {
            filter.doFilter(apiReq("1.1.1.1"), new MockHttpServletResponse(), chain);
        }
        verify(chain, times(3)).doFilter(any(HttpServletRequest.class), any(HttpServletResponse.class));
    }

    @Test
    void overCap_returns429AndShortCircuits() throws Exception {
        for (int i = 0; i < 3; i++) {
            filter.doFilter(apiReq("1.1.1.1"), new MockHttpServletResponse(), chain);
        }
        MockHttpServletResponse blocked = new MockHttpServletResponse();
        filter.doFilter(apiReq("1.1.1.1"), blocked, chain);

        assertThat(blocked.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
        assertThat(blocked.getHeader("Retry-After")).isEqualTo("60");
        assertThat(blocked.getContentAsString()).contains("rate_limited");
        verify(chain, times(3)).doFilter(any(HttpServletRequest.class), any(HttpServletResponse.class));
    }

    @Test
    void isolatedPerIp() throws Exception {
        for (int i = 0; i < 3; i++) {
            filter.doFilter(apiReq("1.1.1.1"), new MockHttpServletResponse(), chain);
        }
        // u2 starts fresh
        MockHttpServletResponse u2 = new MockHttpServletResponse();
        filter.doFilter(apiReq("2.2.2.2"), u2, chain);
        assertThat(u2.getStatus()).isEqualTo(HttpStatus.OK.value());
    }

    @Test
    void actuatorPath_bypasses() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRequestURI("/actuator/health");
        req.setRemoteAddr("1.1.1.1");
        MockHttpServletResponse res = new MockHttpServletResponse();
        // shouldNotFilter returns true → chain runs unconditionally
        for (int i = 0; i < 10; i++) {
            filter.doFilter(req, res, chain);
        }
        verify(chain, times(10)).doFilter(any(HttpServletRequest.class), any(HttpServletResponse.class));
    }

    @Test
    void nonApiPath_bypasses() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRequestURI("/admin/dashboard.html");
        req.setRemoteAddr("1.1.1.1");
        for (int i = 0; i < 10; i++) {
            filter.doFilter(req, new MockHttpServletResponse(), chain);
        }
        verify(chain, times(10)).doFilter(any(HttpServletRequest.class), any(HttpServletResponse.class));
    }

    @Test
    void forwardedForHeader_spoofedChainFallsBackToRemoteAddr() throws Exception {
        // Security A2: chain length 2 with trustedProxyHops=1 means the
        // leftmost entry is attacker-controlled. The filter now distrusts
        // the header and keys on the socket peer instead, so a rotating
        // X-Forwarded-For can't bypass the per-IP RPM cap.
        MockHttpServletRequest req = apiReq("10.0.0.1");
        req.addHeader("X-Forwarded-For", "8.8.8.8, 10.0.0.1");
        for (int i = 0; i < 3; i++) {
            filter.doFilter(req, new MockHttpServletResponse(), chain);
        }
        assertThat(filter.peek("8.8.8.8")).isEqualTo(0);
        assertThat(filter.peek("10.0.0.1")).isEqualTo(3);
    }

    @Test
    void forwardedForHeader_singleHopTrusted() throws Exception {
        // Legitimate Render-only request: edge proxy sets X-Forwarded-For
        // with a single entry → trust it as the real client IP.
        MockHttpServletRequest req = apiReq("10.0.0.1");
        req.addHeader("X-Forwarded-For", "8.8.8.8");
        for (int i = 0; i < 3; i++) {
            filter.doFilter(req, new MockHttpServletResponse(), chain);
        }
        assertThat(filter.peek("8.8.8.8")).isEqualTo(3);
        assertThat(filter.peek("10.0.0.1")).isEqualTo(0);
    }
}
