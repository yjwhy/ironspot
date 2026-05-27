package com.ironspot.auth;

import com.ironspot.auth.dto.NaverLoginResponse;
import com.ironspot.auth.dto.NaverProfile;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Orchestrates the Naver-login bridge: Naver OAuth code → Naver profile →
 * Supabase user → magic-link token the client redeems for a session. Exists
 * because Supabase Auth has no native Naver provider.
 *
 * @see NaverOAuthClient
 * @see SupabaseAuthAdminClient
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NaverLoginService {

    private final NaverOAuthClient naverOAuthClient;
    private final SupabaseAuthAdminClient supabaseAuthAdminClient;

    /** verifyOtp type the client passes alongside the returned token hash. */
    private static final String MAGIC_LINK_TYPE = "magiclink";

    /**
     * Domain for the synthetic identity email. Keyed on the stable Naver id so
     * the same Naver account always maps to the same Supabase user.
     */
    private static final String SYNTHETIC_EMAIL_DOMAIN = "@users.ironspot.app";

    public NaverLoginResponse login(String code, String state) {
        NaverProfile profile = naverOAuthClient.exchangeCodeForProfile(code, state);

        // Security: ALWAYS key the Supabase account on a synthetic, Naver-id
        // namespaced email — never on the real Naver email. Keying on the real
        // email would let a Naver account whose email equals an existing
        // Google/Kakao/Apple user's email merge onto (and take over) that
        // account via the email_exists idempotency below. Naver users live in
        // their own namespace; cross-provider linking, if ever wanted, must be
        // an explicit verified flow, not an implicit email match. The real
        // email (if Naver returned it) is kept in metadata for reference only.
        String email = syntheticEmail(profile.id());

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("provider", "naver");
        metadata.put("naver_id", profile.id());
        if (profile.name() != null) {
            metadata.put("full_name", profile.name());
        }
        if (profile.email() != null && !profile.email().isBlank()) {
            metadata.put("naver_email", profile.email());
        }

        supabaseAuthAdminClient.ensureUser(email, metadata);
        String tokenHash = supabaseAuthAdminClient.generateMagicLinkTokenHash(email);

        return new NaverLoginResponse(tokenHash, email, MAGIC_LINK_TYPE);
    }

    /**
     * Deterministic synthetic identity email for a Naver id. Never emailed —
     * the account is created with {@code email_confirm:true} and the session is
     * minted via {@code generate_link} (which does not send).
     */
    static String syntheticEmail(String naverId) {
        return "naver_" + naverId + SYNTHETIC_EMAIL_DOMAIN;
    }
}
