package com.ironspot.auth;

import com.ironspot.auth.dto.NaverLoginResponse;
import com.ironspot.auth.dto.NaverProfile;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NaverLoginServiceTest {

    @Mock NaverOAuthClient naverOAuthClient;
    @Mock SupabaseAuthAdminClient supabaseAuthAdminClient;
    @InjectMocks NaverLoginService service;

    @Test
    void alwaysUsesSyntheticEmailEvenWhenNaverProvidesReal() {
        // Security: real email must NOT key the account (cross-provider
        // takeover). It is kept in metadata only.
        when(naverOAuthClient.exchangeCodeForProfile("code", "state"))
            .thenReturn(new NaverProfile("nid-1", "real@naver.com", "홍길동"));
        String synthetic = "naver_nid-1@users.ironspot.app";
        when(supabaseAuthAdminClient.generateMagicLinkTokenHash(synthetic))
            .thenReturn("token-hash-1");

        NaverLoginResponse response = service.login("code", "state");

        assertThat(response.email()).isEqualTo(synthetic);
        assertThat(response.tokenHash()).isEqualTo("token-hash-1");
        assertThat(response.type()).isEqualTo("magiclink");
        verify(supabaseAuthAdminClient).ensureUser(eq(synthetic), any());
    }

    @Test
    void keepsRealEmailInMetadataOnly() {
        when(naverOAuthClient.exchangeCodeForProfile(any(), any()))
            .thenReturn(new NaverProfile("nid-1", "real@naver.com", "홍길동"));
        when(supabaseAuthAdminClient.generateMagicLinkTokenHash(any())).thenReturn("t");

        service.login("code", "state");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> metadata = ArgumentCaptor.forClass(Map.class);
        verify(supabaseAuthAdminClient).ensureUser(any(), metadata.capture());
        assertThat(metadata.getValue()).containsEntry("naver_email", "real@naver.com");
    }

    @Test
    void usesSyntheticEmailWhenNaverOmitsEmail() {
        when(naverOAuthClient.exchangeCodeForProfile("c", "s"))
            .thenReturn(new NaverProfile("nid-789", null, "이름"));
        String synthetic = "naver_nid-789@users.ironspot.app";
        when(supabaseAuthAdminClient.generateMagicLinkTokenHash(synthetic))
            .thenReturn("token-hash-2");

        NaverLoginResponse response = service.login("c", "s");

        assertThat(response.email()).isEqualTo(synthetic);
        assertThat(response.tokenHash()).isEqualTo("token-hash-2");
        verify(supabaseAuthAdminClient).ensureUser(eq(synthetic), any());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> metadata = ArgumentCaptor.forClass(Map.class);
        verify(supabaseAuthAdminClient).ensureUser(eq(synthetic), metadata.capture());
        assertThat(metadata.getValue()).doesNotContainKey("naver_email");
    }

    @Test
    void ensuresUserBeforeGeneratingLink() {
        when(naverOAuthClient.exchangeCodeForProfile(any(), any()))
            .thenReturn(new NaverProfile("nid-2", "a@b.com", "n"));
        when(supabaseAuthAdminClient.generateMagicLinkTokenHash(any())).thenReturn("t");

        service.login("c", "s");

        String synthetic = "naver_nid-2@users.ironspot.app";
        var ordered = inOrder(supabaseAuthAdminClient);
        ordered.verify(supabaseAuthAdminClient).ensureUser(eq(synthetic), any());
        ordered.verify(supabaseAuthAdminClient).generateMagicLinkTokenHash(synthetic);
    }

    @Test
    void passesNaverIdAndProviderInUserMetadata() {
        when(naverOAuthClient.exchangeCodeForProfile(any(), any()))
            .thenReturn(new NaverProfile("nid-meta", "m@n.com", "메타"));
        when(supabaseAuthAdminClient.generateMagicLinkTokenHash(any())).thenReturn("t");

        service.login("c", "s");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> metadata = ArgumentCaptor.forClass(Map.class);
        verify(supabaseAuthAdminClient)
            .ensureUser(eq("naver_nid-meta@users.ironspot.app"), metadata.capture());
        assertThat(metadata.getValue())
            .containsEntry("provider", "naver")
            .containsEntry("naver_id", "nid-meta")
            .containsEntry("full_name", "메타");
    }

    @Test
    void omitsFullNameFromMetadataWhenNaverOmitsName() {
        when(naverOAuthClient.exchangeCodeForProfile(any(), any()))
            .thenReturn(new NaverProfile("nid-noname", "x@y.com", null));
        when(supabaseAuthAdminClient.generateMagicLinkTokenHash(any())).thenReturn("t");

        service.login("c", "s");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> metadata = ArgumentCaptor.forClass(Map.class);
        verify(supabaseAuthAdminClient).ensureUser(any(), metadata.capture());
        assertThat(metadata.getValue()).doesNotContainKey("full_name");
    }
}
