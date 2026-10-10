-- =============================================================================
-- Hali e-shop: durable application state for serverless hosting (Vercel)
--
-- The API server keeps the whole operations database as one versioned JSON
-- document. Every save is a compare-and-swap on `version`, so two serverless
-- instances can never overwrite each other's changes (the loser gets HTTP 409
-- and the staff member retries).
--
-- Only the server's SUPABASE_SERVICE_ROLE_KEY can read or write this table:
-- RLS is enabled with no policies, so the public anon/publishable key that
-- ships to browsers gets nothing.
-- =============================================================================

CREATE TABLE IF NOT EXISTS app_state (
  id          TEXT PRIMARY KEY,
  data        JSONB NOT NULL,
  version     BIGINT NOT NULL DEFAULT 1,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

-- Belt and braces: make sure browser-facing roles have no direct grants.
REVOKE ALL ON TABLE app_state FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- Public bucket for product photos (uploaded by the server with the service key)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;
