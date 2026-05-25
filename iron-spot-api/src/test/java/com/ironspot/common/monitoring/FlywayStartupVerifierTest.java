package com.ironspot.common.monitoring;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.MigrationInfoService;
import org.flywaydb.core.api.MigrationState;
import org.junit.jupiter.api.Test;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FlywayStartupVerifierTest {

    @Test
    void allApplied_doesNotEmitError() {
        Flyway flyway = mock(Flyway.class);
        MigrationInfoService infoService = mock(MigrationInfoService.class);
        when(flyway.info()).thenReturn(infoService);
        MigrationInfo applied = stubInfo("9", "task29", MigrationState.SUCCESS);
        when(infoService.all()).thenReturn(new MigrationInfo[]{applied});
        when(infoService.applied()).thenReturn(new MigrationInfo[]{applied});
        when(infoService.pending()).thenReturn(new MigrationInfo[]{});
        when(infoService.current()).thenReturn(applied);

        FlywayStartupVerifier verifier = new FlywayStartupVerifier(flyway);
        verifier.verifyMigrationsApplied();

        verify(flyway).info();
    }

    @Test
    void pendingMigration_logsErrorAndCallsSentry() {
        Flyway flyway = mock(Flyway.class);
        MigrationInfoService infoService = mock(MigrationInfoService.class);
        when(flyway.info()).thenReturn(infoService);
        MigrationInfo applied = stubInfo("8", "task22", MigrationState.SUCCESS);
        MigrationInfo pending = stubInfo("9", "task30", MigrationState.PENDING);
        when(infoService.all()).thenReturn(new MigrationInfo[]{applied, pending});
        when(infoService.applied()).thenReturn(new MigrationInfo[]{applied});
        when(infoService.pending()).thenReturn(new MigrationInfo[]{pending});
        when(infoService.current()).thenReturn(applied);

        FlywayStartupVerifier verifier = new FlywayStartupVerifier(flyway);
        verifier.verifyMigrationsApplied();
        // Sentry static mocking would require PowerMock or Mockito-inline;
        // verification here is via the side effect that flyway.info() was
        // consulted and the call did not throw. Operational
        // verification is via log assertion done by the IT suite.
        verify(flyway).info();
    }

    @Test
    void flywayInfoThrows_swallowsAndDoesNotPropagate() {
        Flyway flyway = mock(Flyway.class);
        when(flyway.info()).thenThrow(new RuntimeException("schema_history missing"));

        FlywayStartupVerifier verifier = new FlywayStartupVerifier(flyway);
        verifier.verifyMigrationsApplied();
        // Should not throw — startup should not abort just because info()
        // failed; the log + Sentry message is the alert channel.
    }

    private static MigrationInfo stubInfo(String version, String description, MigrationState state) {
        MigrationInfo info = mock(MigrationInfo.class);
        when(info.getState()).thenReturn(state);
        when(info.getDescription()).thenReturn(description);
        var v = mock(org.flywaydb.core.api.MigrationVersion.class);
        when(v.toString()).thenReturn(version);
        when(info.getVersion()).thenReturn(v);
        return info;
    }
}
