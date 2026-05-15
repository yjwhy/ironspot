package com.ironspot.search;

import com.ironspot.auth.UserPrincipal;
import com.ironspot.search.dto.NlSearchRequest;
import com.ironspot.search.dto.NlSearchResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {

    private final NlSearchService nlSearchService;

    @PostMapping("/natural")
    public NlSearchResponse searchNatural(
        @Valid @RequestBody NlSearchRequest request,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        return nlSearchService.search(request, principal);
    }
}
