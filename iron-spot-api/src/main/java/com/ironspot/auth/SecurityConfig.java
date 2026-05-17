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
            .exceptionHandling(eh -> eh.authenticationEntryPoint(unauthorizedEntryPoint()))
            .authorizeHttpRequests(auth -> auth
                // Order matters: specific authenticated routes must precede the public wildcard.
                .requestMatchers(HttpMethod.GET, "/api/gyms/places-search").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/gyms/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/brands").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/categories").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/machine-templates").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/machines/*/photos").permitAll()
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
