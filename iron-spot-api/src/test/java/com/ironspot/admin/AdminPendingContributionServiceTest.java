package com.ironspot.admin;

import com.ironspot.admin.dto.PromoteContributionRequest;
import com.ironspot.admin.dto.PromoteContributionResponse;
import com.ironspot.brand.BrandRepository;
import com.ironspot.common.exception.BusinessException;
import com.ironspot.machine.MachineRepository;
import com.ironspot.machine.MachineTemplateRepository;
import com.ironspot.photo.PhotoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminPendingContributionServiceTest {

    @Mock private MachineRepository machineRepository;
    @Mock private MachineTemplateRepository templateRepository;
    @Mock private BrandRepository brandRepository;
    @Mock private PhotoRepository photoRepository;

    @InjectMocks private AdminPendingContributionService service;

    private final UUID gymMachineId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID gymId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID templateId = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private final UUID brandId = UUID.fromString("44444444-4444-4444-4444-444444444444");
    private final UUID categoryId = UUID.fromString("55555555-5555-5555-5555-555555555555");

    @Test
    void promote_existingTemplate_noMerge_flipsPendingReview() {
        givenPendingExists();
        when(machineRepository.templateExistsAndApproved(templateId)).thenReturn(true);
        when(machineRepository.findExistingApprovedAtGym(gymId, templateId)).thenReturn(Optional.empty());
        when(machineRepository.promoteToTemplate(gymMachineId, templateId)).thenReturn(1);

        PromoteContributionResponse out = service.promote(gymMachineId, existingTemplateRequest(templateId));

        assertThat(out.gymMachineId()).isEqualTo(gymMachineId);
        assertThat(out.templateId()).isEqualTo(templateId);
        assertThat(out.mergedIntoGymMachineId()).isNull();
        verify(machineRepository, never()).incrementQuantity(any(), anyInt());
        verify(photoRepository, never()).rebindGymMachineId(any(), any());
    }

    @Test
    void promote_existingTemplate_mergeWhenApprovedRowExistsAtGym() {
        UUID existingApproved = UUID.fromString("66666666-6666-6666-6666-666666666666");
        givenPendingExists(2);
        when(machineRepository.templateExistsAndApproved(templateId)).thenReturn(true);
        when(machineRepository.findExistingApprovedAtGym(gymId, templateId))
            .thenReturn(Optional.of(existingApproved));

        PromoteContributionResponse out = service.promote(gymMachineId, existingTemplateRequest(templateId));

        assertThat(out.gymMachineId()).isEqualTo(existingApproved);
        assertThat(out.mergedIntoGymMachineId()).isEqualTo(existingApproved);
        verify(machineRepository).incrementQuantity(existingApproved, 2);
        verify(photoRepository).rebindGymMachineId(gymMachineId, existingApproved);
        verify(machineRepository).softDeleteById(gymMachineId);
        verify(machineRepository, never()).promoteToTemplate(any(), any());
    }

    @Test
    void promote_existingTemplate_400WhenTemplateIdMissing() {
        givenPendingExists();
        PromoteContributionRequest req = new PromoteContributionRequest(
            "existingTemplate", null, null, null, null, null, null, null, null);
        assertBadRequest(() -> service.promote(gymMachineId, req));
    }

    @Test
    void promote_existingTemplate_400WhenTemplateUnknownOrUnapproved() {
        givenPendingExists();
        when(machineRepository.templateExistsAndApproved(templateId)).thenReturn(false);
        assertBadRequest(() -> service.promote(gymMachineId, existingTemplateRequest(templateId)));
        verify(machineRepository, never()).promoteToTemplate(any(), any());
    }

    @Test
    void promote_newTemplate_createsTemplateThenPromotes() {
        UUID createdTemplate = UUID.fromString("77777777-7777-7777-7777-777777777777");
        givenPendingExists();
        when(brandRepository.existsById(brandId)).thenReturn(true);
        when(templateRepository.create(brandId, categoryId, "Lat Pulldown", "랫 풀다운", "pin"))
            .thenReturn(createdTemplate);
        when(machineRepository.findExistingApprovedAtGym(gymId, createdTemplate)).thenReturn(Optional.empty());
        when(machineRepository.promoteToTemplate(gymMachineId, createdTemplate)).thenReturn(1);

        PromoteContributionResponse out = service.promote(gymMachineId, newTemplateRequest());

        assertThat(out.templateId()).isEqualTo(createdTemplate);
        assertThat(out.mergedIntoGymMachineId()).isNull();
    }

    @Test
    void promote_newTemplate_400WhenBrandUnknown() {
        givenPendingExists();
        when(brandRepository.existsById(brandId)).thenReturn(false);

        assertBadRequest(() -> service.promote(gymMachineId, newTemplateRequest()));
        verify(templateRepository, never()).create(any(), any(), any(), any(), any());
    }

    @Test
    void promote_newTemplate_400WhenRequiredFieldMissing() {
        givenPendingExists();
        PromoteContributionRequest missingNameEn = new PromoteContributionRequest(
            "newTemplate", null, brandId, null, null, null, "랫", "pin", categoryId);
        assertBadRequest(() -> service.promote(gymMachineId, missingNameEn));
    }

    @Test
    void promote_newBrandAndTemplate_createsBothThenPromotes() {
        UUID createdBrand = UUID.fromString("88888888-8888-8888-8888-888888888888");
        UUID createdTemplate = UUID.fromString("99999999-9999-9999-9999-999999999999");
        givenPendingExists();
        when(brandRepository.create("NewBrand", "신규 브랜드")).thenReturn(createdBrand);
        when(templateRepository.create(createdBrand, categoryId, "Custom Press", "커스텀 프레스", "plate"))
            .thenReturn(createdTemplate);
        when(machineRepository.findExistingApprovedAtGym(gymId, createdTemplate)).thenReturn(Optional.empty());
        when(machineRepository.promoteToTemplate(gymMachineId, createdTemplate)).thenReturn(1);

        PromoteContributionResponse out = service.promote(gymMachineId, newBrandAndTemplateRequest());

        assertThat(out.templateId()).isEqualTo(createdTemplate);
        assertThat(out.mergedIntoGymMachineId()).isNull();
    }

    @Test
    void promote_newBrandAndTemplate_409WhenBrandNameDuplicates() {
        givenPendingExists();
        when(brandRepository.create("NewBrand", "신규 브랜드"))
            .thenThrow(new DuplicateKeyException("brands_name_key"));

        assertThatThrownBy(() -> service.promote(gymMachineId, newBrandAndTemplateRequest()))
            .isInstanceOf(BusinessException.class)
            .matches(ex -> ((BusinessException) ex).getStatus() == HttpStatus.CONFLICT);
        verify(templateRepository, never()).create(any(), any(), any(), any(), any());
    }

    @Test
    void promote_existingTemplate_400WhenExtraneousFieldPresent() {
        // Security task #27: existingTemplate must only carry templateId. A
        // payload that *also* sets a new brand name signals the client picked
        // the wrong kind — refuse rather than silently dropping the field.
        givenPendingExists();
        PromoteContributionRequest extraNewBrand = new PromoteContributionRequest(
            "existingTemplate", templateId, null, "Stray Brand", null, null, null, null, null);
        assertBadRequest(() -> service.promote(gymMachineId, extraNewBrand));
        verify(machineRepository, never()).templateExistsAndApproved(any());
    }

    @Test
    void promote_newTemplate_400WhenTemplateIdAlsoPresent() {
        givenPendingExists();
        PromoteContributionRequest extraTemplateId = new PromoteContributionRequest(
            "newTemplate", templateId, brandId, null, null, "Lat Pulldown", "랫 풀다운", "pin", categoryId);
        assertBadRequest(() -> service.promote(gymMachineId, extraTemplateId));
        verify(brandRepository, never()).existsById(any());
    }

    @Test
    void promote_newBrandAndTemplate_400WhenBrandIdAlsoPresent() {
        givenPendingExists();
        PromoteContributionRequest extraBrandId = new PromoteContributionRequest(
            "newBrandAndTemplate", null, brandId, "NewBrand", "신규 브랜드",
            "Custom Press", "커스텀 프레스", "plate", categoryId);
        assertBadRequest(() -> service.promote(gymMachineId, extraBrandId));
        verify(brandRepository, never()).create(any(), any());
    }

    @Test
    void promote_400WhenKindUnknown() {
        givenPendingExists();
        PromoteContributionRequest req = new PromoteContributionRequest(
            "garbage", null, null, null, null, null, null, null, null);
        assertBadRequest(() -> service.promote(gymMachineId, req));
    }

    @Test
    void promote_404WhenPendingRowMissing() {
        when(machineRepository.findPendingForPromote(gymMachineId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.promote(gymMachineId, existingTemplateRequest(templateId)))
            .isInstanceOf(BusinessException.class)
            .matches(ex -> ((BusinessException) ex).getStatus() == HttpStatus.NOT_FOUND);
    }

    @Test
    void promote_409WhenConcurrentPromoteRacedAheadAfterFindCheck() {
        givenPendingExists();
        when(machineRepository.templateExistsAndApproved(templateId)).thenReturn(true);
        when(machineRepository.findExistingApprovedAtGym(gymId, templateId)).thenReturn(Optional.empty());
        when(machineRepository.promoteToTemplate(gymMachineId, templateId)).thenReturn(0);

        assertThatThrownBy(() -> service.promote(gymMachineId, existingTemplateRequest(templateId)))
            .isInstanceOf(BusinessException.class)
            .matches(ex -> ((BusinessException) ex).getStatus() == HttpStatus.CONFLICT);
    }

    @Test
    void reject_softDeletesPendingRow() {
        givenPendingExists();
        service.reject(gymMachineId);
        verify(machineRepository).softDeleteById(gymMachineId);
    }

    @Test
    void reject_404WhenPendingMissing() {
        when(machineRepository.findPendingForPromote(gymMachineId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.reject(gymMachineId))
            .isInstanceOf(BusinessException.class)
            .matches(ex -> ((BusinessException) ex).getStatus() == HttpStatus.NOT_FOUND);
        verify(machineRepository, never()).softDeleteById(any());
    }

    @Test
    void list_delegatesWithLimit() {
        when(machineRepository.listPendingContributions(25)).thenReturn(java.util.List.of());
        service.list(25);
        verify(machineRepository).listPendingContributions(eq(25));
    }

    private PromoteContributionRequest existingTemplateRequest(UUID templateId) {
        return new PromoteContributionRequest(
            "existingTemplate", templateId, null, null, null, null, null, null, null);
    }

    private PromoteContributionRequest newTemplateRequest() {
        return new PromoteContributionRequest(
            "newTemplate", null, brandId, null, null, "Lat Pulldown", "랫 풀다운", "pin", categoryId);
    }

    private PromoteContributionRequest newBrandAndTemplateRequest() {
        return new PromoteContributionRequest(
            "newBrandAndTemplate", null, null, "NewBrand", "신규 브랜드",
            "Custom Press", "커스텀 프레스", "plate", categoryId);
    }

    private void assertBadRequest(Runnable run) {
        assertThatThrownBy(run::run)
            .isInstanceOf(BusinessException.class)
            .matches(ex -> ((BusinessException) ex).getStatus() == HttpStatus.BAD_REQUEST);
    }

    private void givenPendingExists() {
        givenPendingExists(1);
    }

    private void givenPendingExists(int quantity) {
        when(machineRepository.findPendingForPromote(gymMachineId)).thenReturn(
            Optional.of(new MachineRepository.PendingContributionForPromote(gymId, quantity)));
    }
}
