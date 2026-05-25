package com.ironspot.auth;

import com.ironspot.auth.dto.UserResponse;
import com.ironspot.common.exception.BusinessException;
import com.ironspot.search.NlSearchLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Transactional
    public UserResponse updateNickname(String userId, String nickname) {
        int rows = userRepository.updateNickname(userId, nickname);
        if (rows == 0) {
            throw new BusinessException("사용자를 찾을 수 없습니다", HttpStatus.NOT_FOUND);
        }
        return userRepository.findById(userId).orElseThrow();
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
