package com.ironspot.search.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * A Naver 지역검색 result for a gym that is not yet registered in IronSpot.
 *
 * <p>Returned alongside {@code NlSearchResponse.gyms} (which only carries
 * IronSpot-registered gyms with machine info) so the search bar can render a
 * combined results list. The frontend distinguishes the two card types by
 * which array the item came from — registered gyms link to the gym detail
 * screen, unregistered places link to the upload flow with {@code naverPlaceId}
 * pre-filled so the user can become the first registrant.
 *
 * <p>The list is filtered server-side to exclude Naver places whose
 * {@code naverPlaceId} is already registered as an IronSpot gym (dedup by
 * {@code gyms.naver_place_id}). Only emitted when the NL query is generic
 * (no brand / category / machine-template filter) — Naver has no machine
 * metadata so a filtered query cannot meaningfully match Naver results.
 */
public record UnregisteredPlace(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
        description = "Stable Naver place identifier; idempotent key for "
            + "POST /api/gyms registration.")
    String naverPlaceId,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    String name,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
        description = "Road-name address from Naver; falls back to jibun when "
            + "the road address is empty for the place (산간/구주소 cases).")
    String address,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    double latitude,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    double longitude
) {}
