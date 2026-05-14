package com.ironspot.search.llm;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Composes the two LLM providers into the single {@link LlmClient} bean that the
 * rest of the app consumes. Only the composite is exposed as a {@link LlmClient},
 * so {@code @Autowired LlmClient llm} resolves unambiguously without {@code @Qualifier}.
 */
@Configuration
public class LlmClientConfig {

    @Bean
    public GroqLlamaClient groqLlamaClient(
        WebClient webClient,
        @Value("${groq.api-key:}") String apiKey,
        @Value("classpath:prompts/search-dsl.md") Resource prompt
    ) {
        return new GroqLlamaClient(webClient, apiKey, prompt);
    }

    @Bean
    public GeminiFlashClient geminiFlashClient(
        WebClient webClient,
        @Value("${gemini.api-key:}") String apiKey,
        @Value("classpath:prompts/search-dsl.md") Resource prompt
    ) {
        return new GeminiFlashClient(webClient, apiKey, prompt);
    }

    @Bean
    public LlmClient llmClient(GroqLlamaClient primary, GeminiFlashClient fallback) {
        return new FallbackLlmClient(primary, fallback);
    }
}
