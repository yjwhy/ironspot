package com.ironspot.photo;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.photo.dto.UpvoteResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class VoteService {

    private final VoteRepository voteRepository;

    @Transactional
    public UpvoteResponse upvote(String userId, UUID photoId) {
        UUID userUuid = parseUserId(userId);
        boolean inserted = voteRepository.insertVote(userUuid, photoId);
        if (inserted) {
            voteRepository.incrementCount(photoId);
        }
        // isUpvotedByMe is always true: duplicate upvote (inserted=false) means the user
        // already voted, so the photo is still upvoted by them.
        int newCount = voteRepository.getCount(photoId);
        return new UpvoteResponse(newCount, true);
    }

    @Transactional
    public void removeUpvote(String userId, UUID photoId) {
        UUID userUuid = parseUserId(userId);
        boolean deleted = voteRepository.deleteVote(userUuid, photoId);
        if (deleted) {
            voteRepository.decrementCount(photoId);
        }
    }

    private UUID parseUserId(String userId) {
        try {
            return UUID.fromString(userId);
        } catch (IllegalArgumentException e) {
            log.warn("Invalid userId format in upvote request: {}", userId);
            throw new BusinessException("유효하지 않은 사용자 ID입니다", HttpStatus.BAD_REQUEST);
        }
    }
}
