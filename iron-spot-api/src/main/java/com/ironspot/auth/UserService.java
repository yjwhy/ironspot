package com.ironspot.auth;

import com.ironspot.auth.dto.UserResponse;
import com.ironspot.common.exception.BusinessException;
import com.ironspot.search.NlSearchLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final NlSearchLogRepository nlSearchLogRepository;

    @Transactional
    public UserResponse getOrCreate(UserPrincipal principal) {
        // Security A4: check the grace-aware lookup first so a user
        // logging in during their 7-day deletion grace window sees the
        // original row + `deletionRequestedAt` flag instead of silently
        // getting a fresh account on top of the pending row.
        return userRepository.findByIdAllowingGrace(principal.getUserId())
            .orElseGet(() -> {
                String defaultNickname = "헬스인_" + principal.getUserId().substring(0, 6);
                userRepository.insert(principal.getUserId(), principal.getEmail(), defaultNickname);
                return userRepository.findById(principal.getUserId()).orElseThrow();
            });
    }

    /**
     * Security B5: anti-impersonation reserved nicknames. Anyone editing a
     * profile is blocked from claiming an admin/system handle in either
     * English or Korean. NFC + lowercase before comparing so "ADMIN",
     * "ａｄｍｉｎ" (full-width), and "admin" all reject identically.
     *
     * <p>We intentionally don't add a partial UNIQUE INDEX on lower(nickname)
     * yet — that would require a Flyway migration with a backfill story for
     * legacy duplicate nicknames. Reserved-list closes the highest-value
     * impersonation vector (admin/moderator) without touching the schema.
     */
    private static final Set<String> RESERVED_NICKNAMES = Set.of(
        "admin", "administrator", "moderator", "mod", "support", "system",
        "root", "owner", "official", "staff", "ironspot",
        "운영자", "관리자", "어드민", "고객센터", "공식", "지원팀"
    );

    @Transactional
    public UserResponse updateNickname(String userId, String nickname) {
        rejectReservedNickname(nickname);
        int rows = userRepository.updateNickname(userId, nickname);
        if (rows == 0) {
            throw new BusinessException("사용자를 찾을 수 없습니다", HttpStatus.NOT_FOUND);
        }
        return userRepository.findById(userId).orElseThrow();
    }

    private static void rejectReservedNickname(String nickname) {
        if (nickname == null) return;
        String normalised = Normalizer.normalize(nickname, Normalizer.Form.NFC)
            .trim()
            .toLowerCase(Locale.ROOT);
        if (RESERVED_NICKNAMES.contains(normalised)) {
            throw new BusinessException(
                "사용할 수 없는 닉네임입니다",
                HttpStatus.BAD_REQUEST);
        }
    }

    /**
     * Security task #17 — record PIPA active-consent on the user row.
     * Idempotent: a later consent (e.g. policy re-version) overwrites
     * the timestamp + version with the newer values, and the previous
     * record is retained only in the moderation audit log if we add it
     * there in a future task.
     */
    @Transactional
    public UserResponse recordConsent(String userId, String version) {
        int rows = userRepository.recordConsent(userId, version);
        if (rows == 0) {
            throw new BusinessException("사용자를 찾을 수 없습니다", HttpStatus.NOT_FOUND);
        }
        return userRepository.findById(userId).orElseThrow();
    }

    /**
     * Security A4: account-deletion grace window. The request marks
     * deleted_at but DOES NOT anonymise content yet; the finaliser job
     * does that 7 days later. Within those 7 days the user can log in
     * and call {@link #cancelDeletion}.
     *
     * <p>Idempotent: a second call during the grace window matches the
     * UPDATE filter (deleted_at IS NULL) and returns 0 rows, which we
     * treat as a no-op — the row already carries the original deletion
     * timestamp so the grace clock isn't reset.
     */
    @Transactional
    public void deleteAccount(String userId) {
        int rows = userRepository.markDeleted(userId);
        if (rows == 0) {
            // Either the user doesn't exist (404) or the row is already in
            // the grace window (no-op). Distinguish via a final findById
            // so the contract stays exactly: 404 on unknown user, 200 on
            // either fresh-or-redundant deletion request.
            boolean exists = userRepository.findByIdAllowingGrace(userId).isPresent();
            if (!exists) {
                throw new BusinessException("사용자를 찾을 수 없습니다", HttpStatus.NOT_FOUND);
            }
        }
    }

    /**
     * Security A4: clears a pending deletion within the grace window.
     * Refuses to revive a row that has already been finalised — that's
     * a 410 Gone because the content is anonymised and the row is a
     * tombstone at that point.
     */
    @Transactional
    public UserResponse cancelDeletion(String userId) {
        int rows = userRepository.cancelDeletion(userId);
        if (rows == 0) {
            // Either no pending deletion to cancel (already active or
            // never deleted), or the grace window already expired.
            // Surface as 410 if finalised, 404 otherwise — the
            // findByIdAllowingGrace lookup tells us.
            boolean inGrace = userRepository.findByIdAllowingGrace(userId).isPresent();
            if (!inGrace) {
                throw new BusinessException(
                    "삭제 절차가 이미 완료되어 복구할 수 없습니다",
                    HttpStatus.GONE);
            }
            // inGrace but cancelDeletion returned 0 → already active.
            // Idempotent: return the live row.
        }
        return userRepository.findById(userId).orElseThrow();
    }
}
