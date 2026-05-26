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
     * Domain for the synthetic email used when Naver does not return the user's
     * real email (the email scope requires 검수). Keyed on the stable Naver id
     * so the same Naver account always maps to the same Supabase user.
     */
    private static final String SYNTHETIC_EMAIL_DOMAIN = "@users.ironspot.app";

    public NaverLoginResponse login(String code, String state) {
        NaverProfile profile = naverOAuthClient.exchangeCodeForProfile(code, state);
        String email = resolveEmail(profile);

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("provider", "naver");
        metadata.put("naver_id", profile.id());
        if (profile.name() != null) {
            metadata.put("full_name", profile.name());
        }

        supabaseAuthAdminClient.ensureUser(email, metadata);
        String tokenHash = supabaseAuthAdminClient.generateMagicLinkTokenHash(email);

        return new NaverLoginResponse(tokenHash, email, MAGIC_LINK_TYPE);
    }

    /**
     * Real Naver email when present, otherwise a deterministic synthetic
     * address keyed on the Naver id. Synthetic addresses are never emailed —
     * the account is created with {@code email_confirm:true} and the session
     * is minted via {@code generate_link} (which does not send).
     */
    static String resolveEmail(NaverProfile profile) {
        if (profile.email() != null && !profile.email().isBlank()) {
            return profile.email();
        }
        return "naver_" + profile.id() + SYNTHETIC_EMAIL_DOMAIN;
    }
}
