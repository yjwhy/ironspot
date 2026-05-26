package com.ironspot.admin;

import com.ironspot.admin.dto.AdminPendingContribution;
import com.ironspot.admin.dto.PromoteContributionRequest;
import com.ironspot.admin.dto.PromoteContributionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Phase 5 item 11 sub-task 4 — admin surface for pending machine contributions
 * (gym_machines rows with {@code pending_review = true} that have not been
 * reported, so they never appear in {@code GET /api/admin/queue}). Lives at
 * the {@code /api/admin/contributions} namespace except for {@code promote}
 * which mutates a gym_machines row and therefore reads more naturally under
 * {@code /api/admin/gym-machines/{id}/promote}.
 */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Tag(name = "admin-contributions", description = "Admin moderation surface for pending machine contributions")
// Security A8: @Validated enables @Min/@Max on @RequestParam.
@Validated
public class AdminPendingContributionController {

    private final AdminPendingContributionService service;

    @GetMapping("/contributions/pending")
    @Operation(summary = "List pending machine contributions awaiting admin review")
    public List<AdminPendingContribution> listPending(
        @RequestParam(defaultValue = "50") @Min(1) @Max(200) int limit
    ) {
        return service.list(limit);
    }

    @PostMapping("/gym-machines/{id}/promote")
    @Operation(summary = "Promote a pending contribution by mapping or creating a template")
    public PromoteContributionResponse promote(
        @PathVariable UUID id,
        @Valid @RequestBody PromoteContributionRequest body
    ) {
        return service.promote(id, body);
    }

    @DeleteMapping("/contributions/{id}")
    @Operation(summary = "Reject a pending contribution (soft-deletes the gym_machines row)")
    public ResponseEntity<Void> reject(@PathVariable UUID id) {
        service.reject(id);
        return ResponseEntity.noContent().build();
    }
}
