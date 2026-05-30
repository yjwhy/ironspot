package com.ironspot.machine;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.machine.MachineTemplateRepository.TemplateReference;
import com.ironspot.machine.dto.TemplatePhotosResponse;
import com.ironspot.photo.PhotoRepository;
import com.ironspot.photo.StorageService;
import com.ironspot.photo.dto.PhotoResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Assembles the reference-photo payload for a template: a curated official
 * image (if any) + manufacturer link + the top user-contributed photos.
 */
@Service
@RequiredArgsConstructor
public class TemplatePhotoService {

    static final int DEFAULT_LIMIT = 5;
    static final int MAX_LIMIT = 10;

    private final MachineTemplateRepository templateRepository;
    private final PhotoRepository photoRepository;
    private final StorageService storageService;

    public TemplatePhotosResponse getTemplatePhotos(UUID templateId, int requestedLimit) {
        TemplateReference reference = templateRepository.findReference(templateId)
            .orElseThrow(() -> new BusinessException("머신을 찾을 수 없어요.", HttpStatus.NOT_FOUND));

        int limit = clampLimit(requestedLimit);
        String officialImageUrl = toOfficialImageUrl(reference.referenceImagePath());
        String officialUrl = blankToNull(reference.officialUrl());
        List<PhotoResponse> userPhotos = photoRepository.findTemplatePhotos(templateId, limit);

        boolean hasAny = officialImageUrl != null || officialUrl != null || !userPhotos.isEmpty();
        return new TemplatePhotosResponse(templateId, officialImageUrl, officialUrl, userPhotos, hasAny);
    }

    private String toOfficialImageUrl(String referenceImagePath) {
        String path = blankToNull(referenceImagePath);
        return path == null ? null : storageService.templateReferenceUrl(path);
    }

    private static int clampLimit(int requestedLimit) {
        if (requestedLimit < 1) return DEFAULT_LIMIT;
        return Math.min(requestedLimit, MAX_LIMIT);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
