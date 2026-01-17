-- AIDEV-NOTE: Template system migration
-- Creates entity_templates table for storing user-created and imported templates
-- Builtin templates are loaded from JSON files at runtime, not stored in DB

-- Templates table
CREATE TABLE IF NOT EXISTS entity_templates (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Template metadata
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT,
  tags JSONB DEFAULT '[]',

  -- Template type and data
  entity_type TEXT NOT NULL,  -- 'skill', 'database', 'table', 'agent', 'app', 'organization', 'org_section'
  template_data JSONB NOT NULL,  -- Full template content as JSON

  -- Versioning
  version TEXT DEFAULT '1.0.0',

  -- Source tracking
  is_builtin BOOLEAN DEFAULT FALSE,  -- True if created from a builtin template
  source_builtin_id TEXT,  -- Reference to builtin file ID if imported from builtin

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint: one template name per type per organization
  CONSTRAINT entity_templates_org_name_type_unique UNIQUE (organization_id, name, entity_type)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_entity_templates_org_type ON entity_templates(organization_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_templates_category ON entity_templates(organization_id, category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entity_templates_owner ON entity_templates(owner_id) WHERE owner_id IS NOT NULL;

-- Enable RLS
ALTER TABLE entity_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- Users can view templates in their organization
CREATE POLICY entity_templates_select_policy ON entity_templates
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organization_assignments
      WHERE user_id = auth.uid()
    )
  );

-- Users can insert templates in their organization
CREATE POLICY entity_templates_insert_policy ON entity_templates
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_organization_assignments
      WHERE user_id = auth.uid()
    )
  );

-- Users can update their own templates or templates in orgs they manage
CREATE POLICY entity_templates_update_policy ON entity_templates
  FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM user_organization_assignments
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Users can delete their own templates or templates in orgs they manage
CREATE POLICY entity_templates_delete_policy ON entity_templates
  FOR DELETE
  USING (
    owner_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM user_organization_assignments
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER entity_templates_updated_at
  BEFORE UPDATE ON entity_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comment on table
COMMENT ON TABLE entity_templates IS 'Stores user-created and imported templates for entities (skills, databases, agents, etc.)';
COMMENT ON COLUMN entity_templates.entity_type IS 'Type of entity: skill, database, table, agent, app, organization, org_section';
COMMENT ON COLUMN entity_templates.template_data IS 'Full template content as JSON, discriminated by type';
COMMENT ON COLUMN entity_templates.is_builtin IS 'True if this template was created by applying a builtin template';
COMMENT ON COLUMN entity_templates.source_builtin_id IS 'ID of the builtin template this was derived from (e.g., skill/table-operations)';
