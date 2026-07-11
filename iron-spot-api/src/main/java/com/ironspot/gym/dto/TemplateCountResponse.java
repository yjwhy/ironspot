package com.ironspot.gym.dto;

import java.util.UUID;

/**
 * Map filter badge: how many distinct gyms within the searched bbox have a
 * given machine template (active gym_machines only). Templates with no gym in
 * bounds are omitted from the response; the client treats a missing id as 0.
 */
public record TemplateCountResponse(UUID templateId, long gymCount) {}
