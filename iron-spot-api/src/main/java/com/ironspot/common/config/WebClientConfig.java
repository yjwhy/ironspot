package com.ironspot.common.config;

import io.netty.channel.ChannelOption;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;

@Configuration
public class WebClientConfig {

    // Spring WebFlux defaults `maxInMemorySize` to 256 KiB. Google Vision
    // returns SafeSearch + Face landmarks (35 landmarks per face, each with
    // a 3D vertex) + textAnnotations in a single response, which routinely
    // exceeds 256 KiB on photos with even moderate text or multiple faces.
    // The 2026-05-22 OCR outage was a textbook DataBufferLimitException on
    // photo b1141662 (HAMMER STRENGTH LEG EXTENSION). 4 MiB is generous
    // headroom for any realistic Vision payload while bounding memory
    // pressure under abuse.
    private static final int MAX_RESPONSE_BUFFER_BYTES = 4 * 1024 * 1024;

    @Bean
    public WebClient webClient() {
        HttpClient httpClient = HttpClient.create()
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 10_000)
            .responseTimeout(Duration.ofSeconds(15));
        ExchangeStrategies strategies = ExchangeStrategies.builder()
            .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(MAX_RESPONSE_BUFFER_BYTES))
            .build();
        return WebClient.builder()
            .clientConnector(new ReactorClientHttpConnector(httpClient))
            .exchangeStrategies(strategies)
            .build();
    }
}
