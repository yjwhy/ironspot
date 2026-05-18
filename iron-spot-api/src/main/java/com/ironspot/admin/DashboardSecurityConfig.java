package com.ironspot.admin;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;

/**
 * Separate Spring Security chain for the operations dashboard at
 * {@code /admin/dashboard/**}. HTTP Basic Auth backed by an in-memory user
 * keyed off the {@code DASHBOARD_PASSWORD} env var. Fails fast at startup
 * when the env is missing so the dashboard route can never accidentally land
 * unauthenticated.
 *
 * <p>Ordered before {@link com.ironspot.auth.SecurityConfig} via
 * {@link Order} so the dashboard chain claims its paths before the JWT chain
 * sees them. Spring Security 6 chains are evaluated in ascending {@code @Order}.
 *
 * <p>Auth choice rationale (locked via grill 2026-05-19, decision C1):
 * Basic Auth beats JWT-paste on ease (browser password manager saves once vs
 * paste-per-session) and on security surface (no JS-accessible credential
 * vs sessionStorage exposure to XSS). HTTPS-only delivery via Render protects
 * in transit. Phase 5 standalone web UI (Next.js) replaces this with proper
 * OAuth when moderation queue volume justifies it.
 */
@Configuration
public class DashboardSecurityConfig {

    static final String DASHBOARD_ROLE = "DASHBOARD";
    private static final String DASHBOARD_USERNAME = "admin";

    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    public SecurityFilterChain dashboardFilterChain(HttpSecurity http) throws Exception {
        http
            .securityMatcher("/admin/dashboard.html", "/admin/dashboard/**")
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(eh -> eh
                .authenticationEntryPoint((req, res, ex) -> {
                    // Explicit WWW-Authenticate so browsers show the Basic prompt
                    // even when other chains have set a default 401 entry point.
                    res.setHeader("WWW-Authenticate", "Basic realm=\"IronSpot Admin Dashboard\"");
                    res.setStatus(HttpStatus.UNAUTHORIZED.value());
                })
            )
            .authorizeHttpRequests(auth -> auth.anyRequest().hasRole(DASHBOARD_ROLE))
            .httpBasic(Customizer.withDefaults());
        return http.build();
    }

    @Bean
    public PasswordEncoder dashboardPasswordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public UserDetailsService dashboardUserDetailsService(
        @Value("${dashboard.password:}") String password,
        PasswordEncoder encoder
    ) {
        if (password == null || password.isBlank()) {
            throw new IllegalStateException(
                "DASHBOARD_PASSWORD env var is required to run IronSpot. "
                + "The /admin/dashboard route would otherwise be unauthenticated. "
                + "Set it in Render dashboard env or local .env.");
        }
        UserDetails admin = User.withUsername(DASHBOARD_USERNAME)
            .password(encoder.encode(password))
            .roles(DASHBOARD_ROLE)
            .build();
        return new InMemoryUserDetailsManager(admin);
    }
}
