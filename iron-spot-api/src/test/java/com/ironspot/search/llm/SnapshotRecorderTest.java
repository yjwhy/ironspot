package com.ironspot.search.llm;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SnapshotRecorderTest {

    @Test
    void sanitizeReplacesSpacesWithUnderscores() {
        assertThat(SnapshotRecorder.sanitize("강남역 근처 헬스장"))
            .isEqualTo("강남역_근처_헬스장");
    }

    @Test
    void sanitizeCollapsesMultipleSpacesIntoOneUnderscore() {
        assertThat(SnapshotRecorder.sanitize("강남역   근처    헬스장"))
            .isEqualTo("강남역_근처_헬스장");
    }

    @Test
    void sanitizeReplacesFilesystemUnsafeChars() {
        assertThat(SnapshotRecorder.sanitize("DROP TABLE users; --"))
            .isEqualTo("DROP_TABLE_users;_--");
        assertThat(SnapshotRecorder.sanitize("query/with:slash*and?stars"))
            .isEqualTo("query_with_slash_and_stars");
    }

    @Test
    void sanitizeTruncatesAt80Chars() {
        String longQuery = "강남역 근처 파나타 하이로우 2개랑 해머스트렝스 시티드로우 2개랑 라이프피트니스 로우 머신 3개랑 테크노짐 머신도 4개 있는 곳";

        String result = SnapshotRecorder.sanitize(longQuery);

        assertThat(result.length()).isLessThanOrEqualTo(80);
    }
}
