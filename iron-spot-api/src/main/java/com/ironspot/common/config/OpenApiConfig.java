package com.ironspot.common.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("IronSpot API")
                        .description("헬스장 머신 정보 플랫폼 API")
                        .version("v1"))
                .addSecurityItem(new SecurityRequirement().addList("Bearer"))
                .components(new Components()
                        .addSecuritySchemes("Bearer", new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")));
    }

    // Replace any */* content-type entries with application/json so the generated
    // TypeScript client always uses the correct media type.
    @Bean
    public OpenApiCustomizer jsonContentTypeCustomizer() {
        return openApi -> openApi.getPaths().values().forEach(pathItem ->
            pathItem.readOperations().forEach(operation ->
                operation.getResponses().values().forEach(response -> {
                    Content content = response.getContent();
                    if (content != null && content.containsKey("*/*")) {
                        MediaType mediaType = content.get("*/*");
                        content.remove("*/*");
                        content.addMediaType(org.springframework.http.MediaType.APPLICATION_JSON_VALUE, mediaType);
                    }
                })
            )
        );
    }

    // Remove all non-2xx responses from all operations so Orval generates the raw
    // success body type directly (e.g. BrandResponse[]) instead of a success|error
    // union envelope. apiClient throws on non-2xx, so error types are never returned.
    @Bean
    public OpenApiCustomizer removeErrorResponsesCustomizer() {
        return openApi -> openApi.getPaths().values().forEach(pathItem ->
            pathItem.readOperations().forEach(operation ->
                operation.getResponses().keySet().removeIf(code -> !code.startsWith("2"))
            )
        );
    }
}
