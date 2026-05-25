package com.ironspot.search;

import com.ironspot.brand.BrandRepository;
import com.ironspot.category.CategoryRepository;
import com.ironspot.common.exception.BusinessException;
import com.ironspot.common.text.SafeEcho;
import com.ironspot.photo.FuzzyMatchService;
import com.ironspot.search.dsl.MachineFilter;
import com.ironspot.search.dsl.SearchDsl;
import com.ironspot.search.dsl.SearchScope;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DslValidator {

    private final BrandRepository brandRepository;
    private final CategoryRepository categoryRepository;
    private final FuzzyMatchService fuzzyMatchService;

    public ValidatedSearch validate(SearchDsl dsl) {
        List<ResolvedFilter> resolved = dsl.machineFilters().stream()
            .map(this::resolveFilter)
            .toList();

        validateScopeConsistency(resolved);

        return new ValidatedSearch(dsl.location(), resolved);
    }

    private ResolvedFilter resolveFilter(MachineFilter f) {
        UUID brandId = f.brand() != null
            ? brandRepository.findIdByNameOrKoFuzzy(f.brand())
                .orElseThrow(() -> new BusinessException(
                    "'" + SafeEcho.sanitise(f.brand()) + "' 브랜드는 등록되지 않았어요. (예: Panatta, Technogym, Cybex)",
                    HttpStatus.BAD_REQUEST))
            : null;

        UUID categoryId = f.category() != null
            ? categoryRepository.findIdByNameIgnoreCase(f.category())
                .orElseThrow(() -> new BusinessException(
                    "'" + SafeEcho.sanitise(f.category()) + "' 카테고리는 등록되지 않았어요. (예: Chest, Back, Legs, Shoulders)",
                    HttpStatus.BAD_REQUEST))
            : null;

        List<UUID> templateIds = f.machineName() != null
            ? requireTemplates(f.machineName(), brandId, categoryId)
            : List.of();

        return new ResolvedFilter(brandId, categoryId, templateIds, f.minCount(), f.scope());
    }

    private List<UUID> requireTemplates(String machineName, UUID brandId, UUID categoryId) {
        List<UUID> ids = fuzzyMatchService.findTemplateIds(machineName, brandId, categoryId);
        if (ids.isEmpty()) {
            throw new BusinessException(
                "'" + SafeEcho.sanitise(machineName) + "' 머신을 찾지 못했어요. 다른 이름으로 시도해주세요.",
                HttpStatus.BAD_REQUEST);
        }
        return ids;
    }

    private void validateScopeConsistency(List<ResolvedFilter> filters) {
        if (filters.size() <= 1) return;

        long combinedCount = filters.stream().filter(f -> f.scope() == SearchScope.COMBINED).count();
        if (combinedCount > 0 && combinedCount != filters.size()) {
            throw new BusinessException(
                "검색을 처리할 수 없어요. 다시 시도해주세요.",
                HttpStatus.BAD_REQUEST);
        }

        if (combinedCount == filters.size()) {
            int firstMinCount = filters.get(0).minCount();
            boolean allSame = filters.stream().allMatch(f -> f.minCount() == firstMinCount);
            if (!allSame) {
                throw new BusinessException(
                    "검색을 처리할 수 없어요. 다시 시도해주세요.",
                    HttpStatus.BAD_REQUEST);
            }
        }
    }
}
