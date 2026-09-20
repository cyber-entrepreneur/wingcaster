-- Wave 1A — backfill campaigns → journeys + forward-sync trigger.
-- Expand-contract: campaigns table remains; canonical rows live in journeys.

-- Helper: convert legacy linear steps[] to a journey graph (wait→send pairs).
CREATE OR REPLACE FUNCTION public.journey_graph_from_campaign_steps(
  p_steps JSONB,
  p_target_channel TEXT DEFAULT 'email'
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  nodes JSONB := '[]'::jsonb;
  edges JSONB := '[]'::jsonb;
  step JSONB;
  prev_id TEXT := 'n_trigger';
  node_id TEXT;
  i INTEGER := 0;
  channel TEXT;
  delay_h NUMERIC;
BEGIN
  nodes := nodes || jsonb_build_array(jsonb_build_object(
    'id', 'n_trigger',
    'type', 'trigger',
    'config', '{}'::jsonb
  ));

  IF p_steps IS NULL OR jsonb_array_length(p_steps) = 0 THEN
    nodes := nodes || jsonb_build_array(jsonb_build_object(
      'id', 'n_exit',
      'type', 'exit',
      'config', '{}'::jsonb
    ));
    edges := edges || jsonb_build_array(jsonb_build_object('from', 'n_trigger', 'to', 'n_exit'));
    RETURN jsonb_build_object('nodes', nodes, 'edges', edges);
  END IF;

  FOR step IN SELECT * FROM jsonb_array_elements(p_steps)
  LOOP
    delay_h := coalesce((step->>'delay_hours')::numeric, 0);
    channel := coalesce(step->>'channel', p_target_channel, 'email');

    node_id := 'n_wait_' || i;
    nodes := nodes || jsonb_build_array(jsonb_build_object(
      'id', node_id,
      'type', 'wait',
      'config', jsonb_build_object('hours', delay_h)
    ));
    edges := edges || jsonb_build_array(jsonb_build_object('from', prev_id, 'to', node_id));

    prev_id := node_id;
    node_id := 'n_send_' || i;
    nodes := nodes || jsonb_build_array(jsonb_build_object(
      'id', node_id,
      'type', 'send',
      'config', jsonb_build_object(
        'channel', channel,
        'subject', coalesce(step->>'subject', ''),
        'body', coalesce(step->>'body', ''),
        'template_id', step->>'template_id',
        'creative_id', step->>'creative_id'
      )
    ));
    edges := edges || jsonb_build_array(jsonb_build_object('from', prev_id, 'to', node_id));
    prev_id := node_id;
    i := i + 1;
  END LOOP;

  nodes := nodes || jsonb_build_array(jsonb_build_object(
    'id', 'n_exit',
    'type', 'exit',
    'config', '{}'::jsonb
  ));
  edges := edges || jsonb_build_array(jsonb_build_object('from', prev_id, 'to', 'n_exit'));

  RETURN jsonb_build_object('nodes', nodes, 'edges', edges);
END;
$$;

-- Backfill existing campaigns into journeys (deterministic ids).
INSERT INTO public.journeys (
  id, agency_id, agent_id, name, description, status, trigger,
  legacy_campaign_id, tags_filter, target_channel, audience_rules,
  created_by, created_at, updated_at, data
)
SELECT
  'jrn_' || c.id,
  c.agency_id,
  c.agent_id,
  c.name,
  coalesce(c.data->>'description', ''),
  coalesce(c.status, 'draft'),
  c.trigger,
  c.id,
  coalesce(
    CASE WHEN c.data ? 'tags_filter' THEN c.data->'tags_filter' ELSE c.tags END,
    '[]'::jsonb
  ),
  coalesce(c.data->>'target_channel', 'email'),
  coalesce(c.data->'audience_rules', '[]'::jsonb),
  coalesce(c.data->>'created_by', c.agent_id),
  coalesce(c.created_at, CURRENT_TIMESTAMP),
  coalesce(c.updated_at, CURRENT_TIMESTAMP),
  jsonb_build_object(
    'legacy_source', jsonb_build_object('table', 'campaigns', 'id', c.id)
  )
FROM public.campaigns c
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  trigger = EXCLUDED.trigger,
  tags_filter = EXCLUDED.tags_filter,
  target_channel = EXCLUDED.target_channel,
  audience_rules = EXCLUDED.audience_rules,
  updated_at = CURRENT_TIMESTAMP,
  data = public.journeys.data || EXCLUDED.data;

INSERT INTO public.journey_versions (
  id, journey_id, version, graph, published_at, created_at, updated_at, data
)
SELECT
  'jrv_' || c.id || '_v1',
  'jrn_' || c.id,
  1,
  public.journey_graph_from_campaign_steps(
    c.steps,
    coalesce(c.data->>'target_channel', 'email')
  ),
  CASE WHEN coalesce(c.status, 'draft') = 'active' THEN coalesce(c.updated_at, CURRENT_TIMESTAMP) ELSE NULL END,
  coalesce(c.created_at, CURRENT_TIMESTAMP),
  coalesce(c.updated_at, CURRENT_TIMESTAMP),
  jsonb_build_object('legacy_source', jsonb_build_object('table', 'campaigns', 'id', c.id))
FROM public.campaigns c
ON CONFLICT (id) DO UPDATE SET
  graph = EXCLUDED.graph,
  published_at = EXCLUDED.published_at,
  updated_at = CURRENT_TIMESTAMP;

-- Forward-sync: legacy campaigns writes → canonical journeys.
CREATE OR REPLACE FUNCTION public.journey_sync_from_campaign()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  j_id TEXT;
  graph JSONB;
BEGIN
  j_id := 'jrn_' || NEW.id;
  graph := public.journey_graph_from_campaign_steps(
    NEW.steps,
    coalesce(NEW.data->>'target_channel', 'email')
  );

  INSERT INTO public.journeys (
    id, agency_id, agent_id, name, description, status, trigger,
    legacy_campaign_id, tags_filter, target_channel, audience_rules,
    created_by, created_at, updated_at, data
  ) VALUES (
    j_id,
    NEW.agency_id,
    NEW.agent_id,
    NEW.name,
    coalesce(NEW.data->>'description', ''),
    coalesce(NEW.status, 'draft'),
    NEW.trigger,
    NEW.id,
    coalesce(
      CASE WHEN NEW.data ? 'tags_filter' THEN NEW.data->'tags_filter' ELSE NEW.tags END,
      '[]'::jsonb
    ),
    coalesce(NEW.data->>'target_channel', 'email'),
    coalesce(NEW.data->'audience_rules', '[]'::jsonb),
    coalesce(NEW.data->>'created_by', NEW.agent_id),
    coalesce(NEW.created_at, CURRENT_TIMESTAMP),
    coalesce(NEW.updated_at, CURRENT_TIMESTAMP),
    jsonb_build_object('legacy_source', jsonb_build_object('table', 'campaigns', 'id', NEW.id))
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    trigger = EXCLUDED.trigger,
    tags_filter = EXCLUDED.tags_filter,
    target_channel = EXCLUDED.target_channel,
    audience_rules = EXCLUDED.audience_rules,
    updated_at = CURRENT_TIMESTAMP,
    data = public.journeys.data || EXCLUDED.data;

  INSERT INTO public.journey_versions (
    id, journey_id, version, graph, published_at, created_at, updated_at, data
  ) VALUES (
    'jrv_' || NEW.id || '_v1',
    j_id,
    1,
    graph,
    CASE WHEN coalesce(NEW.status, 'draft') = 'active' THEN coalesce(NEW.updated_at, CURRENT_TIMESTAMP) ELSE NULL END,
    coalesce(NEW.created_at, CURRENT_TIMESTAMP),
    coalesce(NEW.updated_at, CURRENT_TIMESTAMP),
    jsonb_build_object('legacy_source', jsonb_build_object('table', 'campaigns', 'id', NEW.id))
  )
  ON CONFLICT (id) DO UPDATE SET
    graph = EXCLUDED.graph,
    published_at = EXCLUDED.published_at,
    updated_at = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_journey_sync_from_campaign ON public.campaigns;
CREATE TRIGGER trg_journey_sync_from_campaign
  AFTER INSERT OR UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.journey_sync_from_campaign();

-- Compatibility view: legacy code can SELECT campaigns-shaped rows from journeys.
CREATE OR REPLACE VIEW public.campaigns_from_journeys AS
SELECT
  j.legacy_campaign_id AS id,
  j.agent_id,
  j.agency_id,
  j.name,
  j.status,
  j.trigger,
  j.tags_filter AS tags,
  (
    SELECT jv.graph->'nodes'
    FROM public.journey_versions jv
    WHERE jv.journey_id = j.id
    ORDER BY jv.version DESC
    LIMIT 1
  ) AS steps,
  j.created_at,
  j.updated_at,
  j.data || jsonb_build_object(
    'description', j.description,
    'target_channel', j.target_channel,
    'tags_filter', j.tags_filter,
    'audience_rules', j.audience_rules
  ) AS data
FROM public.journeys j
WHERE j.legacy_campaign_id IS NOT NULL;
