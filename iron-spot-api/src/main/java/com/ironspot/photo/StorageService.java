package com.ironspot.photo;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StorageService {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.service-role-key}")
    private String serviceRoleKey;

    private final WebClient webClient;

    private static final String BUCKET = "machine-photos";

    public String upload(byte[] imageBytes, UUID gymMachineId, String filename) {
        String path = gymMachineId + "/" + filename;
        webClient.put()
            .uri(supabaseUrl + "/storage/v1/object/" + BUCKET + "/" + path)
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceRoleKey)
            .header(HttpHeaders.CONTENT_TYPE, "image/webp")
            .bodyValue(imageBytes)
            .retrieve()
            .bodyToMono(String.class)
            .block(Duration.ofSeconds(15));
        return supabaseUrl + "/storage/v1/object/public/" + BUCKET + "/" + path;
    }
}
