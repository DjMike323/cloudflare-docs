# 🚀 HERMES Trinity Starter Template

**Complete production-ready starter for HERMES Trinity autonomous systems**

## Quick Start (5 minutes)

```bash
# Clone this template
git clone https://github.com/yourusername/hermes-trinity-starter.git
cd hermes-trinity-starter

# Install dependencies
npm install

# Create Cloudflare project
npm create cloudflare -- .

# Set up environment
cp .env.example .env.local

# Deploy to staging
wrangler deploy --env staging

# Test
curl https://your-worker-staging.dev -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"Hello HERMES","userId":"test"}'
```

## What's Included

### 📁 Project Structure

```
hermes-trinity-starter/
├── src/
│   ├── index.ts              # Main Worker entry point
│   ├── conductor.ts          # HERMES Conductor (router)
│   ├── agents/               # Specialized worker agents
│   │   ├── writer.ts         # Content creation agent
│   │   ├── analyst.ts        # Analysis agent
│   │   └── executor.ts       # Task execution agent
│   ├── memory/               # Unidad Dos (memory system)
│   │   ├── episodic.ts       # What happened
│   │   ├── semantic.ts       # What we learned
│   │   ├── procedural.ts     # What works
│   │   └── taskState.ts      # In-progress work
│   ├── integration/          # External integrations
│   │   ├── telegram.ts       # Telegram bot
│   │   ├── kai.ts            # KAI workflow routing
│   │   └── webhooks.ts       # Generic webhooks
│   ├── monitoring/           # Observability
│   │   ├── metrics.ts        # Metrics collection
│   │   ├── logging.ts        # Structured logging
│   │   └── alerts.ts         # Alert sending
│   └── types.ts              # TypeScript types
├── db/
│   ├── schema.sql            # D1 database schema
│   └── migrations/           # Database migrations
├── tests/
│   ├── conductor.test.ts     # Conductor tests
│   ├── agents.test.ts        # Agent tests
│   └── integration.test.ts    # Integration tests
├── .github/
│   └── workflows/
│       ├── deploy.yml        # CI/CD pipeline
│       └── test.yml          # Test pipeline
├── docs/
│   ├── ARCHITECTURE.md       # System architecture
│   ├── DEPLOYMENT.md         # Deployment guide
│   └── OPERATIONS.md         # Operations runbook
├── wrangler.toml             # Cloudflare Workers config
├── tsconfig.json             # TypeScript config
├── package.json              # Dependencies
└── .env.example              # Environment variables template
```

### 🔧 Configuration

**wrangler.toml**:
```toml
name = "hermes-trinity-starter"
main = "src/index.ts"
compatibility_date = "2026-10-06"

[env.staging]
route = "https://hermes-staging.yourdomain.com/*"

[env.production]
route = "https://hermes.yourdomain.com/*"

[[d1_databases]]
binding = "DB"
database_name = "hermes-starter"

[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"

[[r2_buckets]]
binding = "R2"
bucket_name = "hermes-starter-archive"
```

**Environment Variables**:
```bash
# Copy to .env.local
HERMES_MODEL=@hf/nousresearch/hermes-2-pro-mistral-7b
LOG_LEVEL=info
MAX_TOKENS=2048
BATCH_SIZE=32
CACHE_TTL=3600
SLACK_WEBHOOK=https://hooks.slack.com/...
PAGERDUTY_KEY=your-pagerduty-key
```

## Core Components

### 1. Conductor Agent
Intelligently routes requests to the right agent.

```typescript
// src/conductor.ts
export async function conductorAgent(
  userRequest: string,
  context: Context,
  env: Env
): Promise<RoutingDecision> {
  // Uses Hermes 2 Pro to decide which agent to use
  // Returns: { agent, confidence, task }
}
```

### 2. Worker Agents
Specialized agents for different tasks.

```typescript
// src/agents/writer.ts
export async function writerAgent(
  prompt: string,
  env: Env
): Promise<string>

// src/agents/analyst.ts
export async function analystAgent(
  data: string,
  env: Env
): Promise<AnalysisResult>

// src/agents/executor.ts
export async function executorAgent(
  task: string,
  env: Env
): Promise<ExecutionResult>
```

### 3. Memory System (Unidad Dos)
Four-layer distributed memory for autonomous learning.

```typescript
// src/memory/episodic.ts - What happened
async function storeEpisode(episode: Episode, env: Env)

// src/memory/semantic.ts - What we learned
async function extractPatterns(episode: Episode, env: Env)

// src/memory/procedural.ts - What works
async function trackWorkflowSuccess(workflow: Workflow, env: Env)

// src/memory/taskState.ts - In progress
async function updateTaskState(task: Task, env: Env)
```

### 4. Integrations
Connect to external systems.

```typescript
// src/integration/telegram.ts - Telegram bot
async function handleTelegramMessage(message: TelegramMessage, env: Env)

// src/integration/kai.ts - KAI workflow routing
async function callKAIWorkflow(workflow: string, input: string, env: Env)

// src/integration/webhooks.ts - Generic webhooks
async function handleWebhook(event: WebhookEvent, env: Env)
```

### 5. Monitoring
Complete observability.

```typescript
// src/monitoring/metrics.ts
async function recordMetrics(metrics: Metrics, env: Env)

// src/monitoring/logging.ts
function logRequest(level: string, message: string, context: any)

// src/monitoring/alerts.ts
async function sendAlert(severity: string, message: string, env: Env)
```

## Database Schema

```sql
-- Episodic Memory (what happened)
CREATE TABLE episodes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  request_text TEXT NOT NULL,
  conductor_decision JSON NOT NULL,
  agents_executed TEXT NOT NULL,
  result TEXT,
  success BOOLEAN,
  user_rating INTEGER,
  cost_tokens INTEGER,
  latency_ms INTEGER,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Semantic Memory (what we learned)
CREATE TABLE semantic_memory (
  id TEXT PRIMARY KEY,
  concept TEXT NOT NULL UNIQUE,
  definition TEXT NOT NULL,
  confidence REAL DEFAULT 0.7,
  source TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Procedural Memory (what works)
CREATE TABLE procedures (
  id TEXT PRIMARY KEY,
  workflow_name TEXT NOT NULL,
  steps JSON NOT NULL,
  success_rate REAL,
  avg_cost_tokens INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Metrics (monitoring)
CREATE TABLE metrics (
  id TEXT PRIMARY KEY,
  p50_latency REAL,
  p95_latency REAL,
  p99_latency REAL,
  success_rate REAL,
  cache_hit_rate REAL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Development Workflow

### Local Development

```bash
# Start dev server with live reload
wrangler dev

# Run tests
npm run test

# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format
```

### Deployment

```bash
# Deploy to staging
wrangler deploy --env staging

# Run smoke tests
npm run test:smoke

# Deploy to production
wrangler deploy --env production

# Monitor logs
wrangler tail --env production
```

## Testing

Complete test suite included:

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Load tests
npm run test:load

# End-to-end tests
npm run test:e2e
```

Example test:

```typescript
import { describe, it, expect } from 'vitest';
import { conductorAgent } from '../src/conductor';

describe('Conductor Agent', () => {
  it('routes content creation to writer', async () => {
    const decision = await conductorAgent(
      'Write a blog post about AI',
      mockContext,
      mockEnv
    );

    expect(decision.agent).toBe('writer');
    expect(decision.confidence).toBeGreaterThan(0.8);
  });
});
```

## Monitoring & Alerts

### Metrics Dashboard

View at: `https://hermes.yourdomain.com/dashboard`

Key metrics:
- Request latency (P50, P95, P99)
- Success rate
- Token usage
- Cache hit rate
- Error rate

### Alerts

Automatic alerts for:
- High latency (P95 > 2000ms)
- Low success rate (< 95%)
- High error rate (> 1 error/sec)
- Token overages
- Database issues

## Production Deployment

### Pre-Launch Checklist

- [ ] Database created and indexed
- [ ] Environment variables configured
- [ ] Secrets set (API keys, webhooks)
- [ ] Monitoring enabled
- [ ] Alerts configured
- [ ] Runbook documented
- [ ] Rollback plan ready
- [ ] Load tested

### Deployment Steps

```bash
# 1. Verify staging
wrangler tail --env staging

# 2. Create backup
wrangler d1 backup hermes-prod

# 3. Run migrations
wrangler d1 execute hermes-prod --file db/migrations/latest.sql

# 4. Deploy
wrangler deploy --env production

# 5. Verify
wrangler tail --env production
curl https://hermes.yourdomain.com/health

# 6. Monitor for 30 minutes
# Check: latency, error rate, memory usage
```

## Documentation

Full documentation at:
- [Getting Started](/workers-ai/models/hermes-trinity-getting-started/)
- [Architecture](/workers-ai/models/hermes-trinity-architecture/)
- [Memory System](/workers-ai/models/hermes-trinity-memory-system/)
- [Production Operations](/workers-ai/models/hermes-trinity-production-ops/)
- [Advanced Patterns](/workers-ai/models/hermes-trinity-advanced-patterns/)

## Customization

### Add New Agent

```typescript
// 1. Create agent in src/agents/
export async function customAgent(
  input: string,
  env: Env
): Promise<string> {
  // Your agent logic
}

// 2. Register in conductor
if (routing.agent === 'custom') {
  result = await customAgent(routing.task, env);
}

// 3. Update conductor prompt to recognize the agent
```

### Add Integration

```typescript
// 1. Create integration in src/integration/
export async function myIntegration(
  event: MyEvent,
  env: Env
): Promise<void> {
  // Your integration logic
}

// 2. Hook into main handler
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/my-integration') {
      return handleMyIntegration(request, env);
    }
  }
}
```

## Performance Optimization

### Tips

1. **Enable caching**
   - Cache semantic patterns in Workers KV
   - TTL: 1 hour for patterns, 24 hours for workflows

2. **Batch requests**
   - Process similar requests together
   - Reduces latency by 40%

3. **Reduce tokens**
   - Lower max_tokens for less complex tasks
   - Use streaming for large responses

4. **Optimize prompts**
   - Clear system prompts → better routing
   - Examples in conductor prompt improve confidence

## Support & Community

- **Issues**: [GitHub Issues](https://github.com/yourorg/hermes-trinity-starter/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourorg/hermes-trinity-starter/discussions)
- **Documentation**: [Full Docs](https://developers.cloudflare.com/workers-ai/models/hermes-trinity-getting-started/)

## License

MIT

---

**Ready to build? Start with:**

```bash
npm create cloudflare -- my-hermes-system
cd my-hermes-system
npm install
wrangler dev
```

Then visit: http://localhost:8787

Happy building! 🚀
