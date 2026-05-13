package com.ironspot.auth;

import lombok.Builder;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Locale;

@Getter
@Builder
public class UserPrincipal implements UserDetails {
    private final String userId;
    private final String email;
    private final String nickname;

    @Builder.Default
    private final String role = "user";
    private final OffsetDateTime bannedAt;

    public boolean isBanned() {
        return bannedAt != null;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        String normalized = role == null ? "USER" : role.toUpperCase(Locale.ROOT);
        return List.of(new SimpleGrantedAuthority("ROLE_" + normalized));
    }

    @Override public String getPassword() { return null; }
    @Override public String getUsername() { return userId; }
}
