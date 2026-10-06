/**
 * KAI D1 Database Schema and Setup
 * Complete SQL schema for workflow persistence and state management
 */

export const KAI_DB_SCHEMA = `
-- Workflows (workflow definitions)
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'published', 'archived'
  definition TEXT NOT NULL, -- JSON string
  created_by TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at DESC);

-- Triggers (what starts workflows)
CREATE TABLE IF NOT EXISTS triggers (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'webhook', 'schedule', 'event', 'manual'
  config TEXT NOT NULL, -- JSON string
  enabled BOOLEAN NOT NULL DEFAULT 1,
  last_fired DATETIME,
  fire_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);

CREATE INDEX IF NOT EXISTS idx_triggers_workflow ON triggers(workflow_id);
CREATE INDEX IF NOT EXISTS idx_triggers_type ON triggers(type);
CREATE INDEX IF NOT EXISTS idx_triggers_enabled ON triggers(enabled);

-- Workflow Executions (workflow run history)
CREATE TABLE IF NOT EXISTS workflow_executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  trigger_id TEXT,
  status TEXT NOT NULL, -- 'pending', 'running', 'success', 'failed', 'paused'
  started_at DATETIME NOT NULL,
  ended_at DATETIME,
  context_json TEXT NOT NULL, -- Full execution context as JSON
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id),
  FOREIGN KEY (trigger_id) REFERENCES triggers(id)
);

CREATE INDEX IF NOT EXISTS idx_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_started ON workflow_executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_executions_trigger ON workflow_executions(trigger_id);

-- Step Executions (individual step history)
CREATE TABLE IF NOT EXISTS step_executions (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  status TEXT NOT NULL, -- 'pending', 'running', 'success', 'failed', 'skipped'
  input_json TEXT, -- JSON
  output_json TEXT, -- JSON
  error_message TEXT,
  duration_ms INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  started_at DATETIME NOT NULL,
  ended_at DATETIME,
  FOREIGN KEY (execution_id) REFERENCES workflow_executions(id)
);

CREATE INDEX IF NOT EXISTS idx_steps_execution ON step_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_steps_status ON step_executions(status);
CREATE INDEX IF NOT EXISTS idx_steps_started ON step_executions(started_at DESC);

-- Connectors (available integrations registry)
CREATE TABLE IF NOT EXISTS connectors (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL, -- 'http', 'database', 'messaging', 'storage', 'service'
  description TEXT,
  auth_type TEXT, -- 'apikey', 'oauth', 'basic', 'none'
  config_schema TEXT, -- JSON
  actions TEXT, -- JSON array
  icon_url TEXT,
  documentation_url TEXT,
  version TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_connectors_name ON connectors(name);
CREATE INDEX IF NOT EXISTS idx_connectors_type ON connectors(type);

-- Connector Instances (configured/authenticated connectors)
CREATE TABLE IF NOT EXISTS connector_instances (
  id TEXT PRIMARY KEY,
  connector_id TEXT NOT NULL,
  name TEXT NOT NULL,
  config_encrypted TEXT, -- Encrypted JSON
  encryption_key_id TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME,
  last_used DATETIME,
  FOREIGN KEY (connector_id) REFERENCES connectors(id)
);

CREATE INDEX IF NOT EXISTS idx_connector_instances_connector ON connector_instances(connector_id);
CREATE INDEX IF NOT EXISTS idx_connector_instances_name ON connector_instances(name);

-- Execution Correlations (link HERMES and KAI)
CREATE TABLE IF NOT EXISTS execution_correlations (
  id TEXT PRIMARY KEY,
  hermes_episode_id TEXT,
  kai_workflow_execution_id TEXT NOT NULL,
  request_text TEXT,
  hermes_decision TEXT,
  kai_result TEXT,
  outcome_rating REAL, -- 0-1, success score
  execution_time_ms INTEGER,
  learned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (kai_workflow_execution_id) REFERENCES workflow_executions(id)
);

CREATE INDEX IF NOT EXISTS idx_execution_correlations_kai ON execution_correlations(kai_workflow_execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_correlations_hermes ON execution_correlations(hermes_episode_id);
CREATE INDEX IF NOT EXISTS idx_execution_correlations_learned ON execution_correlations(learned_at DESC);

-- Unified Patterns (patterns discovered across both systems)
CREATE TABLE IF NOT EXISTS unified_patterns (
  id TEXT PRIMARY KEY,
  pattern_name TEXT UNIQUE NOT NULL,
  triggers TEXT, -- JSON array
  best_system TEXT, -- 'hermes' or 'kai'
  success_rate REAL,
  average_time_ms INTEGER,
  use_count INTEGER NOT NULL DEFAULT 0,
  confidence REAL,
  source TEXT, -- 'hermes_learning' or 'kai_analysis'
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON unified_patterns(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_patterns_system ON unified_patterns(best_system);
CREATE INDEX IF NOT EXISTS idx_patterns_updated ON unified_patterns(updated_at DESC);

-- Workflow Variables (execution-time variables)
CREATE TABLE IF NOT EXISTS workflow_variables (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  name TEXT NOT NULL,
  value_type TEXT NOT NULL, -- 'string', 'number', 'boolean', 'object', 'array'
  value_json TEXT, -- JSON serialized
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (execution_id) REFERENCES workflow_executions(id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_vars_execution ON workflow_variables(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_vars_name ON workflow_variables(name);

-- Metrics and Audit Log
CREATE TABLE IF NOT EXISTS execution_metrics (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  total_duration_ms INTEGER NOT NULL,
  steps_executed INTEGER NOT NULL,
  steps_failed INTEGER NOT NULL,
  error_count INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (execution_id) REFERENCES workflow_executions(id),
  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);

CREATE INDEX IF NOT EXISTS idx_metrics_workflow ON execution_metrics(workflow_id);
CREATE INDEX IF NOT EXISTS idx_metrics_success ON execution_metrics(success);
CREATE INDEX IF NOT EXISTS idx_metrics_created ON execution_metrics(created_at DESC);
`;

/**
 * Initialize KAI database schema
 */
export async function initializeKaiDatabase(db: D1Database): Promise<void> {
	const statements = KAI_DB_SCHEMA.split(";").filter((s) => s.trim());

	for (const statement of statements) {
		if (statement.trim()) {
			await db.prepare(statement.trim()).run();
		}
	}
}

/**
 * Helper to safely store JSON in D1 (SQLite has TEXT)
 */
export function jsonToText(obj: any): string {
	return JSON.stringify(obj);
}

/**
 * Helper to safely retrieve JSON from D1
 */
export function textToJson(text: string): any {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}
