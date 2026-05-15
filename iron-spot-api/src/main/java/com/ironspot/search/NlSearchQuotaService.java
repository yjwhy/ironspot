package com.ironspot.search;

import com.ironspot.auth.UserPrincipal;
import com.ironspot.auth.UserService;
import com.ironspot.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static com.ironspot.jooq.Tables.USERS;

@Service
@RequiredArgsConstructor
public class NlSearchQuotaService {

    private static final int MONTHLY_LIMIT = 100;

    private final DSLContext dsl;
    private final UserService userService;

    /**
     * Atomically increments the caller's NL search counter, or throws 429 if already at limit.
     *
     * REQUIRES_NEW so the increment commits independently of the caller's @Transactional(readOnly=true)
     * search context — a downstream LLM/SQL failure does not roll back the count, matching the
     * "no refund on failure" anti-abuse policy.
     *
     * userService.getOrCreate runs on a separate bean's REQUIRED proxy, so it joins this REQUIRES_NEW
     * tx (insert + UPDATE commit together). Inlining getOrCreate would break this — keep it as a proxy
     * call.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void checkAndIncrement(UserPrincipal principal) {
        userService.getOrCreate(principal);

        int updated = dsl.update(USERS)
            .set(USERS.NL_SEARCH_COUNT_MONTH, USERS.NL_SEARCH_COUNT_MONTH.plus(1))
            .where(USERS.ID.eq(UUID.fromString(principal.getUserId())))
            .and(USERS.NL_SEARCH_COUNT_MONTH.lt(MONTHLY_LIMIT))
            .execute();

        if (updated == 0) {
            throw new BusinessException(
                "이번 달 자연어 검색 한도를 모두 사용했어요. 다음 달 1일에 초기화됩니다.",
                HttpStatus.TOO_MANY_REQUESTS);
        }
    }
}
