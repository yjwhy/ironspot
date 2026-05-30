-- Template reference photos: let a machine template (model) carry a curated
-- official product image and an official manufacturer page URL, so the app can
-- show "this is what the model looks like" next to its name.
--
-- Both columns are nullable and start empty. The representative-photo endpoint
-- falls back to user-contributed photos when reference_image_path is null, so
-- this migration adds capacity without changing any current behaviour.
--
-- reference_image_path: bucket-relative key in the PUBLIC `template-references`
--   Storage bucket (curated, licence-cleared brand images). Path only, not a
--   URL. Unlike private user photos (machine-photos bucket, short-TTL signed
--   proxy), these are public-display assets served as a stable public CDN URL
--   built by StorageService.templateReferenceUrl.
-- official_url: manufacturer's official page for this model, opened in an
--   external browser. Used only as a fallback when no image is available.
ALTER TABLE machine_templates
    ADD COLUMN reference_image_path text,
    ADD COLUMN official_url text;

-- Supports the reference-photo query (machine_photos -> gym_machines on
-- template_id). The existing gym_machines indexes key on gym_id only.
CREATE INDEX idx_gym_machines_template
    ON gym_machines (template_id) WHERE deleted_at IS NULL;

-- The join's other leg + the existing per-gym-machine photo list both filter
-- machine_photos by gym_machine_id, which had no supporting index.
CREATE INDEX idx_machine_photos_gym_machine
    ON machine_photos (gym_machine_id);
