package com.ironspot.series;

import com.ironspot.series.dto.SeriesResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SeriesService {

    private final SeriesRepository seriesRepository;

    public List<SeriesResponse> listAll() {
        return seriesRepository.findAll();
    }
}
