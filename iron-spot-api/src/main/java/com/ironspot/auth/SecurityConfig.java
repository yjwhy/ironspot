package com.ironspot.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;

    @Bean
    public AuthenticationEntryPoint unauthorizedEntryPoint() {
        return new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // Security task #32: make the default Spring Security response
            // headers explicit. Without `.headers(...)` the defaults are still
            // applied, but they're invisible to a reviewer skimming
            // SecurityConfig and disappear silently if a future migration
            // changes the chain. The four we care about:
            //   - X-Content-Type-Options: nosniff
            //     Browsers can't override our Content-Type with their MIME-
            //     sniffer. Hardens any image / JSON response that flows
            //     through the BE (signed-URL photos go direct to Supabase,
            //     which sets nosniff itself).
            //   - X-Frame-Options: DENY
            //     We never embed our API responses in an iframe; deny stops
            //     a clickjacking attempt that wraps our JSON or any future
            //     HTML surface.
            //   - Strict-Transport-Security
            //     Render serves TLS on every path; HSTS pins the browser to
            //     HTTPS for a year.
            //   - Cache-Control: no-store on authenticated responses
            //     Default Spring Security policy. Keeps JWT-derived data
            //     out of shared HTTP caches.
            .headers(h -> h
                .contentTypeOptions(c -> {})
                .frameOptions(f -> f.deny())
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true)
                    .maxAgeInSeconds(31_536_000L))
                .cacheControl(c -> {}))
            .exceptionHandling(eh -> eh.authenticationEntryPoint(unauthorizedEntryPoint()))
            .authorizeHttpRequests(auth -> auth
                // Security task #20: every GET under /api/gyms requires auth so
                // anonymous scraping cannot pull the full gym dataset (name,
                // address, phone, price, location). places-search line is now
                // redundant with the wildcard but kept explicit for review-time
                // discoverability — matches the pattern below for /api/_admin
                // and /api/search/natural.
                .requestMatchers(HttpMethod.GET, "/api/gyms/places-search").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/gyms/**").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/brands").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/categories").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/machine-templates").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/machines/*/photos").permitAll()
                // Task 46: gym_machine 신고는 인증 사용자만 가능. anyRequest 가
                // 어차피 authenticated 라 redundant 하지만, 사진 신고 endpoint 와
                // 대칭으로 명시해 review-time 발견성 ↑.
                .requestMatchers(HttpMethod.POST, "/api/gym-machines/*/reports").authenticated()
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                .requestMatchers("/api-docs/**", "/swagger-ui/**").permitAll()
                // Explicit so a future permitAll for actuator-like admin tools cannot
                // accidentally widen the surface that exposes any /api/_admin smoke
                // endpoint (Slack smoke, Sentry smoke, and any future ops verifiers).
                .requestMatchers("/api/_admin/**").authenticated()
                // Defensive: NL Search is already covered by anyRequest.authenticated
                // (asserted by NlSearchControllerIT.anonymousRequestReturns401 since
                // Task 36), but listing it explicitly prevents a future permitAll
                // widening from accidentally exposing the LLM endpoint to unauthed
                // callers and bypassing the per-user quota gate (Task 37b/c).
                .requestMatchers("/api/search/natural").authenticated()
                // /api/admin/** falls through to anyRequest().authenticated() — role gate
                // is enforced at the controller via @PreAuthorize("hasRole('ADMIN')").
                // Filter-chain hasRole() was tried but routes denials through
                // AuthenticationEntryPoint (401) instead of the AccessDeniedHandler (403),
                // which conflicts with @PreAuthorize's 403 semantics.
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
