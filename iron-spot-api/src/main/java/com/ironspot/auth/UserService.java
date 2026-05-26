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
        return userRepository.findById(principal.getUserId())
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

    @Transactional
    public void deleteAccount(String userId) {
        userRepository.anonymizePhotos(userId);
        userRepository.deleteVotes(userId);
        nlSearchLogRepository.anonymise(UUID.fromString(userId));
        int rows = userRepository.markDeleted(userId);
        if (rows == 0) {
            throw new BusinessException("사용자를 찾을 수 없습니다", HttpStatus.NOT_FOUND);
        }
    }
}
