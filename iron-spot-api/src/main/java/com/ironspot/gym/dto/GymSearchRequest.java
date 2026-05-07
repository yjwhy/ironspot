package com.ironspot.gym.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class GymSearchRequest {

    @NotNull
    @DecimalMin("-90")
    @DecimalMax("90")
    private Double minLat;

    @NotNull
    @DecimalMin("-90")
    @DecimalMax("90")
    private Double maxLat;

    @NotNull
    @DecimalMin("-180")
    @DecimalMax("180")
    private Double minLng;

    @NotNull
    @DecimalMin("-180")
    @DecimalMax("180")
    private Double maxLng;

    private String brandId;

    private String categoryId;

    private String loadingType;
}
