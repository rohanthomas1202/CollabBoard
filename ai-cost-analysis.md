# AI Cost Analysis — CollabBoard

## Development & Testing Costs (Actual Spend)

### LLM API Costs

| Service | Cost |
|---|---|
| Anthropic API (Claude Sonnet 4 — in-app AI agent) | ~$15 |
| Claude Max subscription (Claude Code for development) | ~$100 |
| Firebase (Spark/free plan) | $0 |
| Vercel (Hobby/free plan) | $0 |
| **Total development cost** | **~$115** |

### Token Consumption (In-App AI Agent)

| Metric | Estimate |
|---|---|
| Total input tokens | ~2M |
| Total output tokens | ~300K |
| Total API calls | ~200 |
| Average input tokens per request | ~10,000 |
| Average output tokens per request | ~1,500 |
| Average tool-use steps per request | 2-3 |

### Breakdown by Request Type

The AI agent uses `claude-sonnet-4-20250514` with 11 tools and a ~2,000-token system prompt. Tool schemas add ~3,500 tokens to every request. Multi-step tool use accumulates input tokens across rounds.

| Command Type | Input Tokens | Output Tokens | Steps | Cost/Request |
|---|---|---|---|---|
| Simple creation ("add a sticky note") | ~7,000 | ~200 | 1-2 | ~$0.024 |
| Manipulation ("move all pink notes right") | ~14,000 | ~500 | 2-3 | ~$0.050 |
| Template ("create a SWOT analysis") | ~20,000 | ~1,200 | 3-5 | ~$0.078 |
| Organize ("cluster these by theme") | ~22,000 | ~1,500 | 3-5 | ~$0.089 |

---

## Production Cost Projections

### Assumptions

| Parameter | Value |
|---|---|
| AI commands per user per session | 5 |
| Sessions per user per month | 8 |
| AI commands per user per month | 40 |
| Command mix: simple creation | 40% |
| Command mix: manipulation | 25% |
| Command mix: template/complex | 20% |
| Command mix: organize/layout | 15% |

### Weighted Average Cost Per AI Command

| Command Type | % of Requests | Cost/Request | Weighted |
|---|---|---|---|
| Simple creation | 40% | $0.024 | $0.0096 |
| Manipulation | 25% | $0.050 | $0.0125 |
| Template/complex | 20% | $0.078 | $0.0156 |
| Organize/layout | 15% | $0.089 | $0.0134 |
| **Weighted average** | | | **$0.051** |

### Cost Per User Per Month

40 commands x $0.051 = **$2.04/user/month** (AI only)

### Monthly Projections

| | 100 Users | 1,000 Users | 10,000 Users | 100,000 Users |
|---|---|---|---|---|
| **Anthropic API** | $204 | $2,040 | $20,400 | $204,000 |
| **Firebase (Firestore + RTDB)** | $0 (free tier) | $25 | $200 | $2,500 |
| **Vercel Hosting** | $0 (free tier) | $20 | $150 | $500 |
| **Total estimated** | **$204/mo** | **$2,085/mo** | **$20,750/mo** | **$207,000/mo** |

### Firebase Cost Notes

- **Firestore:** Free tier covers 50K reads/day, 20K writes/day. At 1,000+ users, writes from real-time object sync (drag, resize, edit) are the main cost driver. Each object move = 1 write. Estimated 500 writes/user/session.
- **Realtime Database:** Free tier covers 100 simultaneous connections. At 1,000+ concurrent users, the Blaze plan is required ($5/GB stored, $1/GB transferred). Cursor data is ephemeral and lightweight (~100 bytes/update).
- **Authentication:** Free for all tiers (Firebase Auth has no per-user cost).

### Cost Optimization Strategies

1. **Prompt caching:** Anthropic supports prompt caching for the system prompt + tool schemas (~5,500 tokens). At scale this could reduce input costs by ~30-40% on repeated requests.
2. **Model tiering:** Use Claude Haiku for simple creation commands (90% cheaper) and reserve Sonnet for complex/template commands. Could reduce AI costs by ~50%.
3. **Rate limiting:** Cap AI commands per user per session (e.g., 20/session) to prevent abuse and control costs.
4. **Batch operations:** The `createObjects` and `batchMutate` tools already reduce API calls by handling multiple operations in a single tool execution.
5. **Response caching:** Cache common template requests (SWOT, retro, etc.) to avoid redundant LLM calls for identical commands.

### Anthropic Pricing Reference (Claude Sonnet 4)

| | Rate |
|---|---|
| Input tokens | $3.00 / 1M tokens |
| Output tokens | $15.00 / 1M tokens |
| Prompt caching (write) | $3.75 / 1M tokens |
| Prompt caching (read) | $0.30 / 1M tokens |
