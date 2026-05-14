package com.ironspot.common;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

public abstract class IntegrationTestBase {

    static final PostgreSQLContainer<?> postgres;

    static {
        // JVM-wide singleton: one container for all test classes in the same JVM.
        // @Testcontainers + @Container would stop the container after each test class,
        // causing the cached Spring context to point to a dead datasource URL.
        postgres = new PostgreSQLContainer<>(
                DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"))
                .withDatabaseName("ironspot_test")
                .withUsername("test")
                .withPassword("test")
                .withInitScript("init-test-db.sql");
        postgres.start();
    }

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        // NimbusJwtDecoder lazily fetches the JWKS on first decode, so a dummy
        // URL is fine here — every IT mocks JwtValidator so the decoder is never
        // called. Only Spring bean construction needs the property to be present.
        registry.add("security.supabase-jwks-url",
            () -> "http://127.0.0.1:1/jwks-not-used-in-tests");
    }
}
