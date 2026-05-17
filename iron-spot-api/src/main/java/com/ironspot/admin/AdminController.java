package com.ironspot.admin;

import com.ironspot.admin.dto.AdminPhotoDetailResponse;
import com.ironspot.admin.dto.AdminQueuePhotoSummary;
import com.ironspot.admin.dto.AdminReportResponse;
import com.ironspot.admin.dto.DispositionRequest;
import com.ironspot.auth.UserPrincipal;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Tag(name = "admin", description = "Admin-only moderation surface")
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/reports")
    public List<AdminReportResponse> listReports(
        @RequestParam(defaultValue = "pending") String status,
        @RequestParam(defaultValue = "50") int limit
    ) {
        return adminService.listReports(status, limit);
    }

    @PatchMapping("/reports/{id}")
    public AdminReportResponse disposition(
        @PathVariable UUID id,
        @Valid @RequestBody DispositionRequest body,
        @AuthenticationPrincipal UserPrincipal admin
    ) {
        return adminService.disposeReport(id, body, admin.getUserId());
    }

    @GetMapping("/photos")
    public List<AdminQueuePhotoSummary> listPendingPhotos(
        @RequestParam(defaultValue = "pending_review") String status,
        @RequestParam(defaultValue = "50") int limit
    ) {
        return adminService.listPendingPhotos(limit);
    }

    /**
     * ADR 0022 follow-up (Task 46): unified admin queue (photo + gym_machine).
     * Replaces {@code GET /admin/photos} as the queue source. Frontend migrates
     * to this endpoint in Slice 46h; the photo-only endpoint remains for
     * one-release backwards compatibility.
     */
    @GetMapping("/queue")
    public List<com.ironspot.admin.dto.AdminQueueItem> listPendingQueue(
        @RequestParam(defaultValue = "50") int limit
    ) {
        return adminService.listPendingQueue(limit);
    }

    @GetMapping("/photos/{id}")
    public AdminPhotoDetailResponse getPhoto(@PathVariable UUID id) {
        return adminService.getPhotoDetail(id);
    }

    /**
     * ADR 0022 follow-up (Task 46) Slice 46h: gym_machine admin detail. Driven
     * by {@code AdminGymMachineScreen} on the frontend.
     */
    @GetMapping("/gym-machines/{id}")
    public com.ironspot.admin.dto.AdminGymMachineDetailResponse getGymMachine(@PathVariable UUID id) {
        return adminService.getGymMachineDetail(id);
    }

    @PatchMapping("/photos/{id}/restore")
    public ResponseEntity<Void> restorePhoto(@PathVariable UUID id) {
        adminService.restorePhoto(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/users/{id}/ban")
    public ResponseEntity<Void> banUser(@PathVariable UUID id) {
        adminService.banUser(id.toString());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/users/{id}/unban")
    public ResponseEntity<Void> unbanUser(@PathVariable UUID id) {
        adminService.unbanUser(id.toString());
        return ResponseEntity.noContent().build();
    }
}
