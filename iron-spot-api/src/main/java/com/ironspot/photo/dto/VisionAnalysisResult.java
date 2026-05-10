package com.ironspot.photo.dto;

import com.ironspot.photo.SafeSearchVerdict;

import java.util.List;

public record VisionAnalysisResult(List<String> texts, SafeSearchVerdict verdict) {
    public static final VisionAnalysisResult EMPTY =
        new VisionAnalysisResult(List.of(), SafeSearchVerdict.ALLOW);
}
