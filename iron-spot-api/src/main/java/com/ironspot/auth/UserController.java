package com.ironspot.auth;

import com.ironspot.auth.dto.RecordConsentRequest;
import com.ironspot.auth.dto.UpdateUserRequest;
import com.ironspot.auth.dto.UserResponse;
import com.ironspot.photo.PhotoService;
import com.ironspot.photo.VoteService;
import com.ironspot.photo.dto.PhotoResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "users")
@SecurityRequirement(name = "Bearer")
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final PhotoService photoService;
    private final VoteService voteService;

    @Operation(summary = "Get current user profile")
    @GetMapping(value = "/me", produces = MediaType.APPLICATION_JSON_VALUE)
    public UserResponse getMe(@AuthenticationPrincipal UserPrincipal principal) {
        return userService.getOrCreate(principal);
    }

    @Operation(summary = "Update current user nickname")
    @PutMapping(value = "/me", produces = MediaType.APPLICATION_JSON_VALUE)
    public UserResponse updateMe(
        @AuthenticationPrincipal UserPrincipal principal,
        @Valid @RequestBody UpdateUserRequest request
    ) {
        return userService.updateNickname(principal.getUserId(), request.nickname());
    }

    @Operation(
        summary = "Request account deletion (starts 7-day grace window)",
        description = "Security A4: marks the account as pending deletion. The grace window "
            + "(default 7 days, configurable via ironspot.account-deletion.grace-window-days) "
            + "lets the user log back in and POST /api/users/me/cancel-deletion to abort. "
            + "Content anonymisation runs at the end of the grace window via "
            + "AccountDeletionFinaliserJob — not immediately, so a stolen-token attacker "
            + "cannot nuke the account before the real user notices."
    )
    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMe(@AuthenticationPrincipal UserPrincipal principal) {
        userService.deleteAccount(principal.getUserId());
    }

    @Operation(
        summary = "Cancel a pending account deletion (within the grace window)",
        description = "Security A4: clears users.deleted_at so the account becomes fully "
            + "active again. Returns 410 Gone if the grace window has already expired "
            + "and the row has been finalised — the content is anonymised at that point "
            + "and there is nothing left to revive."
    )
    @PostMapping(value = "/me/cancel-deletion", produces = MediaType.APPLICATION_JSON_VALUE)
    public UserResponse cancelMyDeletion(@AuthenticationPrincipal UserPrincipal principal) {
        return userService.cancelDeletion(principal.getUserId());
    }

    @Operation(
        summary = "Record PIPA active-consent (security #17)",
        description = "Called by the app right after OAuth success when the user has actively "
            + "checked the consent boxes on LoginScreen. Writes the policy version + timestamp "
            + "to users.consent_accepted_at / consent_version. Idempotent: a later call "
            + "overwrites with the newer version."
    )
    @PostMapping(value = "/me/consent", produces = MediaType.APPLICATION_JSON_VALUE)
    public UserResponse recordConsent(
        @AuthenticationPrincipal UserPrincipal principal,
        @Valid @RequestBody RecordConsentRequest request
    ) {
        return userService.recordConsent(principal.getUserId(), request.version());
    }

    @Operation(summary = "List photos uploaded by the current user (newest first, excludes blinded)")
    @GetMapping(value = "/me/photos", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<PhotoResponse> getMyPhotos(@AuthenticationPrincipal UserPrincipal principal) {
        return photoService.findByUserId(principal.getUserId());
    }

    @Operation(summary = "List photos the current user has upvoted (most recently voted first)")
    @GetMapping(value = "/me/votes", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<PhotoResponse> getMyVotes(@AuthenticationPrincipal UserPrincipal principal) {
        return voteService.findUpvotedByUser(principal.getUserId());
    }
}
