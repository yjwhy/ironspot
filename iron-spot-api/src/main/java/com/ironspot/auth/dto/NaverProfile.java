package com.ironspot.auth.dto;

/**
 * Identity fields extracted from Naver's {@code /v1/nid/me} response for the
 * Naver-login bridge (Supabase has no native Naver provider, so the Spring
 * backend exchanges the OAuth code and mints a Supabase session — see
 * {@code NaverOAuthClient} / {@code NaverLoginService}).
 *
 * <p>{@code email} is nullable: the email scope on Naver "네이버 아이디로
 * 로그인" requires app review (검수). Until that is granted, Naver omits the
 * field, so the bridge falls back to a synthetic address keyed on {@link #id}.
 * {@code id} is Naver's stable per-application unique user key and is always
 * present on a successful profile fetch.
 */
public record NaverProfile(String id, String email, String name) {}
