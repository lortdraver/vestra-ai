# 05 — AI Architecture: Current State and Proposal

## Current AI integrations (verified)

| Task                    | Service                                                                | Code                                   | Sync?                                               | Timeout               | Quota enforced      |
| ----------------------- | ---------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------- | --------------------- | ------------------- |
| Background removal      | remove.bg API (`api.remove.bg/v1.0/removebg`) or a generic API adapter | `lib/background-removal/*`             | Inside the upload request                           | 15 s                  | No                  |
| Clothing analysis       | OpenRouter `chat/completions` with `AI_MODEL_ID`                       | `lib/ai/openai-compatible-provider.ts` | Separate request started by the client after upload | **None**              | No                  |
| Outfit generation       | OpenRouter, `STYLIST_AI_MODEL_ID` falling back to `AI_MODEL_ID`        | `lib/stylist/api-provider.ts`          | In request                                          | Clamped, configurable | Yes (7-day rolling) |
| Colour hints            | Deterministic, in the browser                                          | `lib/wardrobe/image-compression.ts`    | Client                                              | —                     | —                   |
| Quality post-processing | Deterministic rules                                                    | `lib/ai/quality.ts`                    | Server                                              | —                     | —                   |
| Weather                 | Open-Meteo (not AI)                                                    | `lib/weather/open-meteo-provider.ts`   | In request                                          | Configurable          | —                   |

**Model in use.** `.env.local` sets `AI_MODEL_ID=nex-agi/nex-n2-mini`. According to OpenRouter's listing it accepts image input, but it is described as an _agentic and coding_ MoE model with reasoning, not a vision-specialist model. The production model could not be verified. The database cannot tell you either, because of finding H1: the stored `analysisModelId` is whatever the model claims, and the DB shows names like `gpt-4o-mini`, `gpt-4.1-mini` and dozens of invented IDs.

## What is good

1. **A provider abstraction for every AI task.** Mock providers throw in production, so the system cannot silently fake AI.
2. **Strict JSON schema plus Zod.** Enum-constrained taxonomy (`lib/wardrobe/taxonomy.ts`), a `json_object` fallback, and per-field confidences with `needsReviewFields`. This is the right pattern for "allow users to correct AI metadata".
3. **AI output and user corrections are stored separately** (`aiAnalysis` vs `userCorrections`), so corrections are never overwritten and can later become training or eval data.
4. **The stylist is grounded.** It ranks deterministically first (`scoring.ts`, `fashion-rules.ts`) so the LLM only picks among pre-filtered real items. Every returned ID is validated against ownership, with one strict retry that carries validation feedback. This prevents the "imaginary products" failure mode the brief worries about. It is the strongest part of the AI design.
5. **Ops scripts** (`ai:diagnose:openrouter`, `background-removal:diagnose`).

## What is wrong

| Problem                                                  | Why it matters                                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| No timeout on analysis, plus a claim lock with no expiry | 15% of items are permanently stuck (doc 04 C1)                                                                                             |
| Model provenance is model-reported                       | You cannot evaluate, A/B test or regress models                                                                                            |
| No cost controls on analysis or background removal       | One abusive or buggy client can burn OpenRouter and remove.bg credit                                                                       |
| Full-resolution image sent to the vision model           | More image tokens, higher latency, no accuracy gain for tagging                                                                            |
| Everything runs inside HTTP requests                     | Fragile on serverless; you cannot retry or batch, and failures surface as stuck UI states                                                  |
| No evaluation set                                        | "Accuracy" is unmeasured. `PROJECT_STATUS.md` admits "live provider accuracy still needs visual QA"                                        |
| A general reasoning model for structured vision tagging  | Reasoning tokens add latency and cost for a classification task                                                                            |
| Fixed brand-specific few-shot examples in the prompt     | Biases `brandGuess`                                                                                                                        |
| Stylist only generates outfits                           | Questions like "How can I style these trousers?" or "What goes with X?" get forced into outfit generation; there is no conversational mode |

## Proposed AI architecture

### 1. Move AI work into a job pipeline

```
Upload request (fast, < 2 s)
  ├─ validate + re-encode with sharp (strip EXIF/GPS, verify magic bytes)
  ├─ PUT original to R2
  ├─ INSERT wardrobe_item (status: processing)
  └─ enqueue job: process_item(itemId)
          ↓ worker (Inngest / Trigger.dev / QStash → route handler, or a Postgres-backed queue)
  step 1  background removal  → PUT processed, PUT thumbnail     (retry ×3, idempotent per step)
  step 2  vision analysis on the 512 px thumbnail                (timeout 30 s, retry ×2)
  step 3  write aiAnalysis + real modelId + promptVersion + cost
  step 4  record usage (subscription_usage) atomically
Client polls GET /items/:id or subscribes (SSE) for status
```

Why: it removes C1 and H2 outright, makes retries free, and gives one place to meter cost. For the current single-monolith codebase, **Inngest or Trigger.dev** is the lowest-friction fit with Next.js on Vercel. A Postgres `job` table with `SELECT … FOR UPDATE SKIP LOCKED` plus a cron also works and adds no vendor.

### 2. Use different models for different tasks

| Task               | Recommendation                                                                                                                                          | Rationale                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Background removal | Keep remove.bg for now. Evaluate self-hosted **BiRefNet / RMBG-class** segmentation (for example on Replicate or fal) when volume justifies it          | remove.bg quality is proven in the DB. Per-image pricing gets expensive at scale. Licences differ per model, so check commercial terms before adopting. |
| Clothing tagging   | A **fast non-reasoning vision model** with good structured output (a small Gemini Flash-class or GPT-4o-mini-class model). Choose by eval, not by name. | A classification task needs JSON-schema adherence, not reasoning.                                                                                       |
| Stylist            | A mid-tier text model (vision not required, since items are already tagged), with prompt caching for the static taxonomy block                          | Its input is structured item JSON                                                                                                                       |
| Embeddings (later) | Image embeddings (a CLIP-class model) stored in `pgvector`                                                                                              | "Similar items", duplicate detection, "what goes with this" retrieval, and gap analysis. All of it runs inside Postgres.                                |

Keep everything behind OpenRouter for now (one key, easy switching), but **record the actual `model` from the response** and the token usage per call.

### 3. Build an evaluation harness before changing models

- Export 100–200 items where `userCorrections` exist. These are free labelled data, since a user's correction is ground truth.
- Add a script `ai:eval` that runs candidate models on the eval set and reports per-field accuracy, cost and latency.
- Gate model changes on it. This one tool makes every later AI decision evidence-based.

### 4. Cost controls

- Enforce `ai_analyses_monthly` and `background_removals_monthly` in the job enqueue step. Write `subscription_usage` with an atomic `INSERT … ON CONFLICT DO UPDATE SET used = used + 1 WHERE used < limit`.
- Allow re-analysis at most N times per item.
- Add an AI spend kill-switch env var and a daily spend alert (OpenRouter has usage APIs).
- Send thumbnails, not full images.

### 5. Privacy

- Strip EXIF (including GPS) on upload. Today originals are stored as uploaded (the client compression may drop EXIF, but the server does not guarantee it).
- Disclose in the privacy policy that images go to OpenRouter and its upstream model providers, and to remove.bg. Check each provider's data retention terms.
- Prefer providers or routes with zero data retention where OpenRouter offers them.

### 6. 3D clothing generation: recommendation

**Do not build it now.** Rationale:

- **Cost.** Third-party comparisons put textured image-to-3D at roughly **$0.20–$0.60 per model** on Meshy or Tripo, with Rodin at the premium end. These are secondary-source estimates; confirm with vendors. That is several times more than tagging an item.
- **Quality.** Image-to-3D from a single flat-lay photo of a _soft garment_ produces stiff, toy-like meshes. These services are tuned for rigid objects and characters. The user would see a sculpture of a shirt, not a garment.
- **Latency.** Typically tens of seconds to minutes, which requires the job pipeline above first.
- **Value.** None of the core jobs (what do I own, what should I wear) needs 3D.

If and when it is pursued, the shape should be: a premium-only, credit-based, opt-in button on a single item; a job in the pipeline; the GLB stored in R2; a `wardrobe_item_3d` table (status, provider, cost, GLB key); and a separate viewer route using `<model-viewer>` or `three` with `@react-three/fiber`, lazy-loaded so normal pages are unaffected. Start with one provider through a provider interface, as the codebase already does for everything else.

A better near-term "visual wow" for less money: **flat-lay outfit collages** made by compositing the background-removed PNGs with `sharp`. This is cheap, deterministic, shareable, and fits the editorial brand.
