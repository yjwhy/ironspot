package com.ironspot.photo;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.photo.dto.MachineTemplateSuggestion;
import com.ironspot.photo.dto.PhotoResponse;
import com.ironspot.photo.dto.PhotoUploadResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PhotoService {

    private final PhotoRepository photoRepository;
    private final OcrService ocrService;
    private final FuzzyMatchService fuzzyMatchService;
    private final StorageService storageService;

    public List<PhotoResponse> findByGymMachineId(UUID gymMachineId) {
        return photoRepository.findByGymMachineId(gymMachineId);
    }

    // Storage upload is intentionally not wrapped in @Transactional:
    // a DB rollback cannot undo a file already uploaded to Supabase Storage.
    // Orphaned files are removed by a periodic cleanup job (Phase 2 tradeoff).
    public PhotoUploadResponse upload(String userId, MultipartFile file, UUID gymMachineId) {
        validateImage(file);

        UUID photoId = UUID.randomUUID();
        String filename = photoId + ".webp";
        final byte[] imageBytes;
        try {
            imageBytes = file.getBytes();
        } catch (IOException e) {
            throw new BusinessException("이미지를 읽을 수 없습니다", HttpStatus.BAD_REQUEST);
        }

        String photoUrl;
        try {
            photoUrl = storageService.upload(imageBytes, gymMachineId, filename);
        } catch (Exception e) {
            log.error("Storage upload failed for photo {}: {}", photoId, e.getMessage());
            throw new BusinessException("사진 업로드에 실패했습니다", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        List<String> ocrTexts = List.of();
        boolean ocrSucceeded = false;
        try {
            ocrTexts = ocrService.extractText(imageBytes);
            ocrSucceeded = !ocrTexts.isEmpty();
        } catch (Exception e) {
            log.warn("OCR failed for photo {}: {}", photoId, e.getMessage());
        }

        List<MachineTemplateSuggestion> suggestions = fuzzyMatchService.findMatches(ocrTexts);
        photoRepository.insert(photoId, gymMachineId, userId, photoUrl);

        return new PhotoUploadResponse(photoId, photoUrl, suggestions, ocrSucceeded);
    }

    public void deleteOwn(String userId, UUID photoId) {
        PhotoResponse photo = photoRepository.findById(photoId)
            .orElseThrow(() -> new BusinessException("사진을 찾을 수 없습니다", HttpStatus.NOT_FOUND));
        if (!UUID.fromString(userId).equals(photo.userId())) {
            throw new BusinessException("본인의 사진만 삭제할 수 있습니다", HttpStatus.FORBIDDEN);
        }
        photoRepository.delete(photoId);
    }

    private void validateImage(MultipartFile file) {
        if (file.isEmpty()) {
            throw new BusinessException("이미지가 비어 있습니다", HttpStatus.BAD_REQUEST);
        }
        if (file.getSize() > 2 * 1024 * 1024) {
            throw new BusinessException("이미지는 2MB 이하여야 합니다", HttpStatus.BAD_REQUEST);
        }
        String ct = file.getContentType();
        if (ct == null || !ct.startsWith("image/")) {
            throw new BusinessException("이미지 파일만 업로드할 수 있습니다", HttpStatus.BAD_REQUEST);
        }
    }
}
