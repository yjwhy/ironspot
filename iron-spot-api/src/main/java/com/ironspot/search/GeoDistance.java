package com.ironspot.search;

/**
 * Great-circle distance helper for client-side (Java) geo filtering. The
 * registered-gym search filters by distance in SQL (PostGIS ST_DWithin), but
 * the Naver merge gets back plain lat/lng pairs that must be filtered against
 * the resolved search centre in application code — that is what this covers.
 */
public final class GeoDistance {

    private static final double EARTH_RADIUS_KM = 6371.0088;

    private GeoDistance() {
    }

    public static double haversineKm(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double sinLat = Math.sin(dLat / 2);
        double sinLng = Math.sin(dLng / 2);
        double a = sinLat * sinLat
            + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * sinLng * sinLng;
        return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
