package com.ironspot.photo;

import java.util.UUID;

/**
 * Security A3 Phase 2c: the relative API path for the photo proxy
 * endpoint. RN clients fetch {@code apiBaseUrl + contentPath} with a
 * Bearer header; the proxy 302-redirects to a freshly-minted 5-minute
 * signed URL ({@code PhotoContentController}).
 *
 * <p>Single source of truth for the path format so every response DTO
 * emits an identical {@code contentPath}. The BE doesn't know its own
 * externally-visible base URL, so we emit a relative path and let RN
 * prefix with {@code API_URL}.
 */
public final class PhotoProxyPath {

    private PhotoProxyPath() {}

    public static String forPhoto(UUID photoId) {
        return "/api/photos/" + photoId + "/content";
    }
}
