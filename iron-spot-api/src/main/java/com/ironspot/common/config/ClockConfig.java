package com.ironspot.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * Provides a single {@link Clock} bean so time-sensitive services can be unit-tested
 * with a fixed clock without resorting to static {@code System.currentTimeMillis()}
 * calls. Currently consumed by {@code NlSearchEmptyResultReporter}.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
