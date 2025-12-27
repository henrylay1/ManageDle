-- Fix empty 'scores' objects inside metadata.shareTexts in game_records
-- BACKUP your DB before running this.

-- 1) Set any empty object {} in metadata.shareTexts[].scores to JSON null
WITH targets AS (
  SELECT record_id, (idx - 1) AS idx0
  FROM public.game_records,
       jsonb_array_elements(metadata->'shareTexts') WITH ORDINALITY arr(elem, idx)
  WHERE metadata ? 'shareTexts'
    AND (arr.elem->'scores') = '{}'::jsonb
)
UPDATE public.game_records g
SET metadata = jsonb_set(g.metadata, ARRAY['shareTexts', targets.idx0::text, 'scores'], 'null'::jsonb, true)
FROM targets
WHERE g.record_id = targets.record_id;

-- 2) (Optional) Also normalize top-level scores where it's an empty object
UPDATE public.game_records
SET scores = NULL
WHERE scores = '{}'::jsonb;

-- Verify results: list records that still have empty objects
SELECT record_id, metadata->'shareTexts' AS shareTexts
FROM public.game_records
WHERE metadata ? 'shareTexts'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(metadata->'shareTexts') arr(elem)
    WHERE (elem->'scores') = '{}'::jsonb
  );
