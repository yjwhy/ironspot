package com.ironspot.admin;

import com.ironspot.admin.dto.AdminReportResponse;
import com.ironspot.auth.UserRepository;
import com.ironspot.common.exception.BusinessException;
import com.ironspot.photo.PhotoRepository;
import com.ironspot.photo.ReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final ReportRepository reportRepository;
    private final PhotoRepository photoRepository;
    private final UserRepository userRepository;

    public List<AdminReportResponse> listReports(String status, int limit) {
        return reportRepository.findByStatusOrderByCreatedAtDesc(status, limit);
    }

    @Transactional
    public AdminReportResponse disposeReport(UUID reportId, String disposition, String adminUserId) {
        int rows = reportRepository.updateDisposition(reportId, disposition, UUID.fromString(adminUserId));
        if (rows == 0) {
            boolean exists = reportRepository.existsById(reportId);
            if (!exists) {
                throw new BusinessException("리포트를 찾을 수 없습니다", HttpStatus.NOT_FOUND);
            }
            throw new BusinessException("이미 처리된 리포트입니다", HttpStatus.CONFLICT);
        }
        return reportRepository.findById(reportId)
            .orElseThrow(() -> new BusinessException("리포트를 찾을 수 없습니다", HttpStatus.NOT_FOUND));
    }

    @Transactional
    public void restorePhoto(UUID photoId) {
        boolean exists = photoRepository.findById(photoId).isPresent();
        if (!exists) {
            throw new BusinessException("사진을 찾을 수 없습니다", HttpStatus.NOT_FOUND);
        }
        photoRepository.setBlinded(photoId, false);
    }

    @Transactional
    public void banUser(String userId) {
        int rows = userRepository.markBanned(userId);
        if (rows == 0) {
            boolean exists = userRepository.findById(userId).isPresent();
            if (!exists) {
                throw new BusinessException("사용자를 찾을 수 없습니다", HttpStatus.NOT_FOUND);
            }
            throw new BusinessException("이미 차단된 사용자입니다", HttpStatus.CONFLICT);
        }
    }
}
