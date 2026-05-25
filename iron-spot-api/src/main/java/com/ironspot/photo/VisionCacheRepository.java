package com.ironspot.photo;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ironspot.photo.dto.VisionAnalysisResult;
import lombok.extern.slf4j.Slf4j;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Repository;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

import static com.ironspot.jooq.Tables.VISION_CACHE;

/**
 * Phase 5 cost safety net (Layer C): SHA-256-keyed cache of Vision API
 * responses. The second + upload of the same image bytes hits the cache
 * and skips the Vision call entirely, protecting the free tier from
 * retry-loop / duplicate abuse without changing observable behaviour for
 * normal users.
 *
 * <p>{@code hit_count} is bumped on each cache hit so the cache effectiveness
 * is observable via an admin query (e.g. "what fraction of uploads hit").
 * The cache is intentionally TTL-less — Vision's output is effectively
 * deterministic per image, and the table is keyed by a 64-char SHA-256 so
 * collision risk is astronomically low (2^256).
 *
 * <p>Failed Vision calls (fail-open path) are NOT cached: an empty result is
 * a transient artefact of an outage, not a real Vision verdict, so we want
 * the next upload of the same image to retry against a (hopefully) healthy
 * Vision endpoint.
 */
@Slf4j
@Repository
public class VisionCacheRepository {

    // Stateless mapper for List<String> serialisation; no Spring-Boot-managed
    // ObjectMapper dependency so this repo loads cleanly in slim test contexts.
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final DSLContext dsl;

    public VisionCacheRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public static String sha256(byte[] imageBytes) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(imageBytes));
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is mandatory in every JDK 8+; this branch is unreachable.
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    public Optional<VisionAnalysisResult> findBySha256(String sha256) {
        return dsl.select(VISION_CACHE.VERDICT, VISION_CACHE.HAS_PII, VISION_CACHE.TEXTS_JSON)
            .from(VISION_CACHE)
            .where(VISION_CACHE.SHA256.eq(sha256))
            .fetchOptional()
            .map(r -> new VisionAnalysisResult(
                parseTexts(r.get(VISION_CACHE.TEXTS_JSON)),
                SafeSearchVerdict.valueOf(r.get(VISION_CACHE.VERDICT)),
                r.get(VISION_CACHE.HAS_PII)
            ));
    }

    public void insert(String sha256, VisionAnalysisResult result) {
        // ON CONFLICT DO NOTHING: two concurrent first-time uploads of the
        // same bytes will race to insert. Either insert wins, the other
        // becomes a no-op. Returns to the caller without retry needed.
        dsl.insertInto(VISION_CACHE)
            .set(VISION_CACHE.SHA256, sha256)
            .set(VISION_CACHE.VERDICT, result.verdict().name())
            .set(VISION_CACHE.HAS_PII, result.hasPii())
            .set(VISION_CACHE.TEXTS_JSON, JSONB.valueOf(serialiseTexts(result.texts())))
            .onConflictDoNothing()
            .execute();
    }

    public void bumpHitCount(String sha256) {
        dsl.update(VISION_CACHE)
            .set(VISION_CACHE.HIT_COUNT, VISION_CACHE.HIT_COUNT.plus(1))
            .where(VISION_CACHE.SHA256.eq(sha256))
            .execute();
    }

    private String serialiseTexts(List<String> texts) {
        // Security task #75: sanitise + cap each OCR token before it lands
        // in the cache. Without this a hostile label crafted with control /
        // bidi / zero-width characters survives in vision_cache.texts_json
        // forever (cached by sha256) and gets re-served on every dedup hit,
        // turning a one-shot stored prompt injection into an ambient sink.
        // Cap per token at 100 chars + max 100 tokens — real OCR plates are
        // well under these limits, so genuine cache content is unaffected.
        List<String> safe = texts == null ? List.of() : texts.stream()
            .filter(java.util.Objects::nonNull)
            .map(t -> java.text.Normalizer
                .normalize(t, java.text.Normalizer.Form.NFC)
                .replaceAll("\\p{C}", ""))
            .filter(t -> !t.isBlank())
            .map(t -> t.length() > 100 ? t.substring(0, 100) : t)
            .limit(100)
            .toList();
        try {
            return OBJECT_MAPPER.writeValueAsString(safe);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialise OCR texts for cache; falling back to empty array", e);
            return "[]";
        }
    }

    private List<String> parseTexts(JSONB jsonb) {
        try {
            return OBJECT_MAPPER.readValue(jsonb.data(), new TypeReference<List<String>>() {});
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse cached OCR texts; returning empty list", e);
            return List.of();
        }
    }
}
