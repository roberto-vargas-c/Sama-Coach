# Sama Coach

Sama is a yoga app: a 160-pose library with reference figures, an on-device alignment check (MoveNet + BlazePose in TensorFlow.js), a practice planner and a guided-practice timer. This version adds a **Coach** tab, an AI layer over the planner, served through one tiny serverless function that holds the OpenAI key.

## What the Coach does

| Mode | What happens |
|---|---|
| **Plan with me** | The coach asks one question at a time (goal, time, experience, how the body feels, anything to go easy on) with follow-ups, then proposes **three different practices**. An independent judge call scores each one on safety, fit, sequencing and balance; the best is marked "Judge's pick". Start any of them, open it in the planner, or save it. Replies like "shorter" or "gentler" continue the same conversation. |
| **Review my checks** | Reads your recent alignment checks (scores, hold times, the corrections Sama found) and returns an overall score, strengths, weaknesses, concrete fixes and a suggested next practice. |
| **Review a routine** | Paste a sequence, pick a saved practice or use the current plan, say what it is for, and get a critique, what is missing, and a corrected version built from library poses. A second call judges the review itself (accuracy, relevance, actionability, completeness). |
| **Roadmap** | A week-by-week plan toward a goal pose (headstand, splits, crow…), built on Sama's pose ladders, your level and your checks; every session can be opened in the planner. |

Design rule: **the model never invents poses or timings.** It returns planner parameters (length, level, focus, body parts to go easy on, goal, poses to include or avoid) or lists of pose ids, and Sama's own planner builds the practice. Every id is validated against the library before anything is rendered. Photos and clips never leave the device; the coach only receives text.

## Project layout

```
index.html                 the whole app (page, styles, pose library, planner, coach)
api/coach.js               serverless proxy: adds OPENAI_API_KEY and forwards to OpenAI
dev.js                     local server that mimics Vercel (static files + /api/coach)
*.json, *.wasm             pose models and the TensorFlow.js WebAssembly backend
vercel.json                long cache headers for the model files
.env.example               environment variables
```

## Run locally

```bash
cp .env.example .env        # put your OpenAI key in it
node dev.js                 # http://localhost:3000
```

No dependencies to install; Node 18 or newer is enough.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, **Add New → Project**, import the repository, keep the defaults (no build step, framework "Other").
3. Under **Settings → Environment Variables** add `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`, default `gpt-4o-mini`).
4. Deploy. The page is served from the root and the function from `/api/coach`.

Or from the command line: `npm i -g vercel && vercel && vercel env add OPENAI_API_KEY && vercel --prod`.

### Environment variables

| Name | Purpose |
|---|---|
| `OPENAI_API_KEY` | required |
| `OPENAI_MODEL` | model used for every call (default `gpt-4o-mini`; `gpt-4o` coaches better and costs more) |
| `OPENAI_ALLOWED_MODELS` | comma-separated list the page may request (default: the gpt-4o and gpt-4.1 families) |
| `OPENAI_BASE_URL` | any OpenAI-compatible endpoint (default `https://api.openai.com/v1`) |
| `CORS_ORIGIN` | only needed if the page is hosted on another origin than the function |

The function caps request size and message count, uses JSON mode for structured replies, and times out after 55 s. There is no per-user rate limit; add one (for example Vercel's `@vercel/kv` or an edge rate limiter) before opening it to the public.

## Android app (APK)

`android/` is a small native wrapper: a full-screen WebView around the deployed site that gives the page the camera (live alignment checks), the photo and clip pickers, keep-awake and immersive mode during a guided practice, and a shortcut to the cast settings (`window.SamaNative`).

GitHub Actions builds it on every push that touches `android/` and attaches the APK to the **"latest" release**: https://github.com/roberto-vargas-c/Sama-Coach/releases/tag/latest. On the phone, download `sama.apk`, open it and allow installing from that source. It is signed with a debug key, which is fine for installing by hand; for the Play Store add your own keystore in `android/app/build.gradle`.

To point the app at another address: `./gradlew assembleRelease -PsamaUrl=https://your-deployment`.

## Using the Coach from the Android app

If the Android wrapper loads the deployed URL in its WebView, the Coach works as is. If it bundles `index.html` inside the APK, the page has no server of its own: set the deployment's address in the head of `index.html` before building the APK:

```html
<meta name="sama-coach-url" content="https://sama-coach.vercel.app">
```

The proxy already allows cross-origin requests, so a bundled page can call it.

## How the prompts are built

Every call sends a compact digest of the pose library (`id|name|difficulty|family|tags|hold|sided|load`, one line per pose) so the model can only name poses that exist. Structured answers are requested as JSON (`response_format: json_object`) and parsed tolerantly on the client. The judge calls use separate system prompts and a low temperature, so a plan or review is never graded by the prompt that produced it.

## Testing without spending tokens

Point the proxy at a mock: `OPENAI_BASE_URL=http://localhost:4010/v1 OPENAI_API_KEY=x node dev.js` with any server that answers `/chat/completions` in OpenAI's shape.
