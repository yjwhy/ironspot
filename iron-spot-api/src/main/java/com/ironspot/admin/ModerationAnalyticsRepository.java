package com.ironspot.admin;

import com.ironspot.admin.dto.ModerationAnalyticsResponse;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import static com.ironspot.jooq.Tables.MACHINE_PHOTOS;
import static com.ironspot.jooq.Tables.REPORTS;
import static com.ironspot.jooq.Tables.USERS;

/**
 * Aggregations over {@code reports} + {@code machine_photos} + {@code users}
 * for Phase 5 hypothesis H1 measurement. Schema-free — no new tables — so
 * Phase 4 ship cost is repository + endpoint only.
 *
 * <p>{@code periodDays} convention: a positive value scopes via
 * {@code reports.disposed_at >= NOW() - INTERVAL 'N days'}; null/0 means
 * "all time" (no cutoff applied to dispositions; ban events still scope by
 * {@code users.banned_at} which is always cumulative).
 */
@Repository
@RequiredArgsConstructor
public class ModerationAnalyticsRepository {

    /** Buckets for the disposition-count histogram. Mirrors the auto-ban
     *  thresholds (3 actioned, 5 dismissed) so the row split visualises how
     *  close active users are to the threshold. */
    private static final int[] BUCKET_UPPER = {0, 1, 2, 4, 9, Integer.MAX_VALUE};
    private static final String[] BUCKET_LABEL = {"0", "1", "2", "3-4", "5-9", "10+"};

    private final DSLContext dsl;

    public List<ModerationAnalyticsResponse.HistogramBucket> uploaderActionedHistogram(Integer periodDays) {
        Map<Integer, Integer> userToCount = uploaderActionedPerUser(periodDays);
        return histogramFrom(userToCount);
    }

    public List<ModerationAnalyticsResponse.HistogramBucket> reporterDismissedHistogram(Integer periodDays) {
        Map<Integer, Integer> userToCount = reporterDismissedPerUser(periodDays);
        return histogramFrom(userToCount);
    }

    public List<ModerationAnalyticsResponse.TopReporter> topReporters(Integer periodDays, int limit) {
        var disposedAtCutoff = cutoff(periodDays);

        // ORDER BY COUNT(*) because the WHERE clause restricts to actioned +
        // dismissed only, so COUNT(*) equals the sum of the two SUM expressions.
        // Avoids the "column actioned does not exist" Postgres error from
        // referencing aliases in arithmetic ORDER BY clauses.
        return dsl.select(
                REPORTS.USER_ID,
                DSL.sum(DSL.case_()
                    .when(REPORTS.STATUS.eq("actioned"), 1)
                    .otherwise(0)).as("actioned"),
                DSL.sum(DSL.case_()
                    .when(REPORTS.STATUS.eq("dismissed"), 1)
                    .otherwise(0)).as("dismissed")
            )
            .from(REPORTS)
            .where(REPORTS.STATUS.in("actioned", "dismissed"))
            .and(REPORTS.USER_ID.isNotNull())
            .and(disposedAtCutoff != null
                ? REPORTS.DISPOSED_AT.greaterOrEqual(disposedAtCutoff)
                : DSL.trueCondition())
            .groupBy(REPORTS.USER_ID)
            .orderBy(DSL.count().desc())
            .limit(limit)
            .fetch(r -> {
                long actioned = r.get("actioned", java.math.BigDecimal.class).longValue();
                long dismissed = r.get("dismissed", java.math.BigDecimal.class).longValue();
                long total = actioned + dismissed;
                double accuracy = total == 0 ? 0.0 : (double) actioned / total;
                return new ModerationAnalyticsResponse.TopReporter(
                    r.get(REPORTS.USER_ID),
                    actioned,
                    dismissed,
                    accuracy
                );
            });
    }

    public List<ModerationAnalyticsResponse.BanEvent> banEvents(Integer periodDays) {
        var bannedAtCutoff = cutoff(periodDays);

        return dsl.select(USERS.ID, USERS.BANNED_AT, USERS.ROLE)
            .from(USERS)
            .where(USERS.BANNED_AT.isNotNull())
            .and(USERS.DELETED_AT.isNull())
            .and(bannedAtCutoff != null
                ? USERS.BANNED_AT.greaterOrEqual(bannedAtCutoff)
                : DSL.trueCondition())
            .orderBy(USERS.BANNED_AT.desc())
            .fetch(r -> new ModerationAnalyticsResponse.BanEvent(
                r.get(USERS.ID),
                r.get(USERS.BANNED_AT),
                r.get(USERS.ROLE)
            ));
    }

    public long totalDispositions(Integer periodDays) {
        var disposedAtCutoff = cutoff(periodDays);
        Long count = dsl.selectCount()
            .from(REPORTS)
            .where(REPORTS.STATUS.in("actioned", "dismissed"))
            .and(disposedAtCutoff != null
                ? REPORTS.DISPOSED_AT.greaterOrEqual(disposedAtCutoff)
                : DSL.trueCondition())
            .fetchOneInto(Long.class);
        return count != null ? count : 0L;
    }

    private Map<Integer, Integer> uploaderActionedPerUser(Integer periodDays) {
        var cutoff = cutoff(periodDays);
        return dsl.select(MACHINE_PHOTOS.USER_ID, DSL.count().as("cnt"))
            .from(REPORTS)
            .join(MACHINE_PHOTOS).on(MACHINE_PHOTOS.ID.eq(REPORTS.TARGET_ID))
            .where(REPORTS.STATUS.eq("actioned"))
            .and(REPORTS.TARGET_TYPE.eq("photo"))
            .and(MACHINE_PHOTOS.USER_ID.isNotNull())
            .and(cutoff != null
                ? REPORTS.DISPOSED_AT.greaterOrEqual(cutoff)
                : DSL.trueCondition())
            .groupBy(MACHINE_PHOTOS.USER_ID)
            .fetchMap(r -> r.get(MACHINE_PHOTOS.USER_ID).hashCode(),
                r -> r.get("cnt", Integer.class));
    }

    private Map<Integer, Integer> reporterDismissedPerUser(Integer periodDays) {
        var cutoff = cutoff(periodDays);
        return dsl.select(REPORTS.USER_ID, DSL.count().as("cnt"))
            .from(REPORTS)
            .where(REPORTS.STATUS.eq("dismissed"))
            .and(REPORTS.USER_ID.isNotNull())
            .and(cutoff != null
                ? REPORTS.DISPOSED_AT.greaterOrEqual(cutoff)
                : DSL.trueCondition())
            .groupBy(REPORTS.USER_ID)
            .fetchMap(r -> r.get(REPORTS.USER_ID).hashCode(),
                r -> r.get("cnt", Integer.class));
    }

    private List<ModerationAnalyticsResponse.HistogramBucket> histogramFrom(Map<Integer, Integer> userCounts) {
        int[] bucketUserCounts = new int[BUCKET_LABEL.length];
        for (int count : userCounts.values()) {
            for (int i = 0; i < BUCKET_UPPER.length; i++) {
                if (count <= BUCKET_UPPER[i]) {
                    bucketUserCounts[i]++;
                    break;
                }
            }
        }
        return java.util.stream.IntStream.range(0, BUCKET_LABEL.length)
            .mapToObj(i -> new ModerationAnalyticsResponse.HistogramBucket(
                BUCKET_LABEL[i], bucketUserCounts[i]))
            .toList();
    }

    private OffsetDateTime cutoff(Integer periodDays) {
        if (periodDays == null || periodDays <= 0) return null;
        return OffsetDateTime.now().minusDays(periodDays);
    }
}
