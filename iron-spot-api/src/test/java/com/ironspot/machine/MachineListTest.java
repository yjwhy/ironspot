package com.ironspot.machine;

import com.ironspot.common.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class MachineListTest extends IntegrationTestBase {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void listMachinesReturnsGymMachines() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/gyms/a0000001-0000-0000-0000-000000000001/machines", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("High Row");
        assertThat(response.getBody()).contains("Panatta");
    }

    @Test
    void listMachinesReturnsEmptyForUnknownGym() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/gyms/00000000-0000-0000-0000-000000000000/machines", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("[]");
    }
}
