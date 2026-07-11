package com.ironspot.search;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class GeoDistanceTest {

    @Test
    void zeroForIdenticalPoint() {
        assertThat(GeoDistance.haversineKm(37.4979, 127.0276, 37.4979, 127.0276)).isCloseTo(0.0, org.assertj.core.data.Offset.offset(1e-6));
    }

    @Test
    void oneDegreeOfLatitudeIsAboutOneHundredEleventhKm() {
        // 0.01 deg latitude ~= 1.11 km anywhere on the globe.
        double d = GeoDistance.haversineKm(37.5, 127.0, 37.51, 127.0);
        assertThat(d).isCloseTo(1.11, org.assertj.core.data.Offset.offset(0.02));
    }

    @Test
    void symmetricAcrossArgumentOrder() {
        double ab = GeoDistance.haversineKm(37.4979, 127.0276, 37.5547, 126.9707);
        double ba = GeoDistance.haversineKm(37.5547, 126.9707, 37.4979, 127.0276);
        assertThat(ab).isCloseTo(ba, org.assertj.core.data.Offset.offset(1e-9));
        // Gangnam → Hongdae is roughly 8 km.
        assertThat(ab).isBetween(7.5, 8.5);
    }
}
