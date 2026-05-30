package com.ironspot.machine;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.machine.MachineTemplateRepository.TemplateReference;
import com.ironspot.machine.dto.TemplatePhotosResponse;
import com.ironspot.photo.PhotoRepository;
import com.ironspot.photo.StorageService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
class TemplatePhotoServiceTest {

    private static final UUID TEMPLATE_ID = UUID.fromString("e0000001-0000-0000-0000-000000000001");

    @Mock private MachineTemplateRepository templateRepository;
    @Mock private PhotoRepository photoRepository;
    @Mock private StorageService storageService;
    @InjectMocks private TemplatePhotoService service;

    @Test
    void throws404WhenTemplateMissing() {
        given(templateRepository.findReference(TEMPLATE_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.getTemplatePhotos(TEMPLATE_ID, 5))
            .isInstanceOf(BusinessException.class);
    }

    @Test
    void clampsLimitToDefaultForZeroOrNegative() {
        givenTemplate(null, null);

        service.getTemplatePhotos(TEMPLATE_ID, 0);
        service.getTemplatePhotos(TEMPLATE_ID, -3);

        ArgumentCaptor<Integer> limit = ArgumentCaptor.forClass(Integer.class);
        org.mockito.Mockito.verify(photoRepository, org.mockito.Mockito.times(2))
            .findTemplatePhotos(eq(TEMPLATE_ID), limit.capture());
        assertThat(limit.getAllValues()).containsExactly(
            TemplatePhotoService.DEFAULT_LIMIT, TemplatePhotoService.DEFAULT_LIMIT);
    }

    @Test
    void clampsLimitToMaxWhenAboveCap() {
        givenTemplate(null, null);

        service.getTemplatePhotos(TEMPLATE_ID, 999);

        org.mockito.Mockito.verify(photoRepository)
            .findTemplatePhotos(TEMPLATE_ID, TemplatePhotoService.MAX_LIMIT);
    }

    @Test
    void treatsBlankReferenceFieldsAsAbsent() {
        givenTemplate("   ", "");

        TemplatePhotosResponse result = service.getTemplatePhotos(TEMPLATE_ID, 5);

        assertThat(result.officialImageUrl()).isNull();
        assertThat(result.officialUrl()).isNull();
        assertThat(result.hasAny()).isFalse();
    }

    @Test
    void buildsOfficialImageUrlFromPathAndReportsHasAny() {
        given(templateRepository.findReference(TEMPLATE_ID))
            .willReturn(Optional.of(new TemplateReference("brand/model.webp", "https://brand.example/m")));
        given(photoRepository.findTemplatePhotos(eq(TEMPLATE_ID), anyInt())).willReturn(List.of());
        given(storageService.templateReferenceUrl("brand/model.webp"))
            .willReturn("https://cdn.example/template-references/brand/model.webp");

        TemplatePhotosResponse result = service.getTemplatePhotos(TEMPLATE_ID, 5);

        assertThat(result.officialImageUrl()).isEqualTo("https://cdn.example/template-references/brand/model.webp");
        assertThat(result.officialUrl()).isEqualTo("https://brand.example/m");
        assertThat(result.hasAny()).isTrue();
    }

    private void givenTemplate(String referenceImagePath, String officialUrl) {
        given(templateRepository.findReference(TEMPLATE_ID))
            .willReturn(Optional.of(new TemplateReference(referenceImagePath, officialUrl)));
        given(photoRepository.findTemplatePhotos(eq(TEMPLATE_ID), anyInt())).willReturn(List.of());
    }
}
