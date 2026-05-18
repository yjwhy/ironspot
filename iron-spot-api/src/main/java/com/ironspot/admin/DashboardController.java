package com.ironspot.admin;

import com.ironspot.admin.dto.ModerationAnalyticsResponse;
import com.ironspot.admin.dto.NlSearchAnalyticsResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Data endpoint for the operations dashboard at
 * {@code /admin/dashboard/index.html}. Aggregates D (NL search) and E
 * (moderation) analytics into a single response so the dashboard page makes
 * one network round trip per period change.
 *
 * <p>Auth comes from {@link DashboardSecurityConfig}'s separate chain (HTTP
 * Basic, env-keyed password) — not the JWT chain that protects {@code /api/**}.
 * Same-origin fetches from the dashboard HTML automatically include the
 * browser-cached Basic Auth credentials.
 *
 * <p>Period parameter:
 * <ul>
 *   <li>NL search uses period directly (7d/30d/90d). 'all' is normalised to
 *       '90d' since the underlying nl_search_log has a 90-day retention so
 *       'all' would equal '90d' anyway.</li>
 *   <li>Moderation accepts period as-is (7d/30d/all).</li>
 * </ul>
 */
@Tag(name = "dashboard")
@RestController
@RequestMapping("/admin/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final AdminService adminService;

    @GetMapping("/data")
    public DashboardData getDashboardData(@RequestParam(defaultValue = "30d") String period) {
        String nlSearchPeriod = "all".equals(period) ? "90d" : period;
        NlSearchAnalyticsResponse nlSearch = adminService.getNlSearchAnalytics(nlSearchPeriod);
        ModerationAnalyticsResponse moderation = adminService.getModerationAnalytics(period);
        return new DashboardData(period, nlSearch, moderation);
    }

    public record DashboardData(
        String period,
        NlSearchAnalyticsResponse nlSearch,
        ModerationAnalyticsResponse moderation
    ) {}
}
