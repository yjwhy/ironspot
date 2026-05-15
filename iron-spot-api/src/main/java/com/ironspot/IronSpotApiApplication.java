package com.ironspot;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class IronSpotApiApplication {

	public static void main(String[] args) {
		SpringApplication.run(IronSpotApiApplication.class, args);
	}

}
