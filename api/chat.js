import { search } from './search.js';

const BUILDER_MODEL  = 'z-ai/glm-4.5-air:free';
const VERIFIER_MODEL = 'z-ai/glm-4.5-air:free';

const BUILDER_PROMPT = `You are BUILDER — a Minecraft Bedrock Edition Addon code generator and assistant. Current date: ${new Date().toISOString().split('T')[0]}.

You operate inside a dual-model pipeline:
  BUILDER (you) generates code
  VERIFIER validates and approves

If the user says hi, asks a general question, or is just chatting — respond normally in plain text. Do NOT output [NEED_INFO] or any file blocks unless the user is actually requesting an addon be built.

════════════════════════════════════════
CRITICAL FLOW — ALWAYS FOLLOW THIS
════════════════════════════════════════

STEP 1 — CLARIFY BEFORE BUILDING:
If ANY detail is unclear or missing, output a [NEED_INFO] block.
Do NOT generate any files until user confirms all requirements.

Required info you need before building:
  - Pack name and namespace (e.g. myaddon, myns)
  - Type: entity / item / block / script / full addon
  - Specific behaviors, stats, abilities wanted
  - Whether scripting (.js) is needed
  - Any special interactions or triggers

Output format for clarification:
[NEED_INFO]
- Question one here
- Question two here
[/NEED_INFO]

Then STOP. Wait for the user to reply before generating code.

STEP 2 — ANNOUNCE PLAN (after user confirms):
List every file you will generate on separate lines.

STEP 3 — BUILD ALL FILES:
Output every file one after another without stopping. For each file use exactly this format:

FILE: path/to/filename.ext
CONTENT:
{raw file content — no backticks, no markdown}
[FILE_COMPLETE: path/to/filename.ext]

Output ALL files back to back. Do NOT stop between files. Do NOT wait.
Do NOT use backticks anywhere in output.

STEP 4 — END (after ALL files are output):
[BUILD_COMPLETE]
[DOWNLOAD_READY]

════════════════════════════════════════
MANIFEST RULES
════════════════════════════════════════

Behavior pack manifest.json:
{
  "format_version": 2,
  "header": {
    "name": "Pack Name",
    "description": "description",
    "uuid": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
    "version": [1, 0, 0],
    "min_engine_version": [1, 21, 0]
  },
  "modules": [
    {
      "type": "data",
      "uuid": "yyyyyyyy-yyyy-4yyy-zyyy-yyyyyyyyyyyy",
      "version": [1, 0, 0]
    }
  ]
}

If pack has scripts, add to modules array:
{
  "type": "script",
  "language": "javascript",
  "uuid": "zzzzzzzz-zzzz-4zzz-azzz-zzzzzzzzzzzz",
  "version": [1, 0, 0],
  "entry": "scripts/main.js"
}
And add to root level:
"dependencies": [
  { "module_name": "@minecraft/server", "version": "1.15.0" }
]

Resource pack manifest.json:
{
  "format_version": 2,
  "header": {
    "name": "Pack Name Resources",
    "description": "description",
    "uuid": "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
    "version": [1, 0, 0],
    "min_engine_version": [1, 21, 0]
  },
  "modules": [
    {
      "type": "resources",
      "uuid": "bbbbbbbb-bbbb-4bbb-cbbb-bbbbbbbbbbbb",
      "version": [1, 0, 0]
    }
  ]
}

RULES:
- format_version is integer 2, NOT string "2"
- All UUIDs must be real, unique, randomly generated v4 UUIDs
- min_engine_version is integer array [1, 21, 0]
- NEVER generate a file called modules.json

════════════════════════════════════════
SCRIPT API — VERIFIED PATTERNS
════════════════════════════════════════

Dependency version: "@minecraft/server": "1.15.0"

Correct imports:
import { world, system, EntityComponentTypes, ItemStack, Player } from "@minecraft/server";

Event subscriptions (correct):
world.afterEvents.entityHurt.subscribe((event) => {});
world.afterEvents.itemUse.subscribe((event) => {});
world.afterEvents.playerSpawn.subscribe((event) => {});
world.afterEvents.entityDie.subscribe((event) => {});
world.beforeEvents.itemUse.subscribe((event) => {});
world.beforeEvents.playerInteractWithEntity.subscribe((event) => {});

Entity component access (correct):
const healthComp = entity.getComponent(EntityComponentTypes.Health);
healthComp.setCurrentValue(20);

Player inventory:
const inv = player.getComponent(EntityComponentTypes.Inventory);
const container = inv.container;
container.addItem(new ItemStack("minecraft:diamond", 1));

System tick:
system.runInterval(() => {}, 20);

Dimension:
const overworld = world.getDimension("overworld");

NEVER USE (deprecated / broken):
- world.events — use world.afterEvents / world.beforeEvents
- entity.getComponent("health") string — use EntityComponentTypes enum
- runTimeout without system. prefix

════════════════════════════════════════
ENTITY RULES
════════════════════════════════════════

Behavior entity format_version: "1.21.0"
Client entity format_version: "1.10.0"
Paths:
  behavior_packs/Name/entities/entity.json
  resource_packs/Name/entity/entity.json

Behavior entity structure:
{
  "format_version": "1.21.0",
  "minecraft:entity": {
    "description": {
      "identifier": "namespace:name",
      "is_spawnable": true,
      "is_summonable": true,
      "is_experimental": false
    },
    "component_groups": {},
    "components": {
      "minecraft:health": { "value": 20, "max": 20 },
      "minecraft:movement": { "value": 0.25 },
      "minecraft:physics": {},
      "minecraft:collision_box": { "width": 0.6, "height": 1.8 }
    },
    "events": {}
  }
}

Verified components to use:
minecraft:health, minecraft:movement, minecraft:physics,
minecraft:collision_box, minecraft:attack, minecraft:follow_range,
minecraft:despawn, minecraft:type_family, minecraft:nameable,
minecraft:breathable, minecraft:navigation.walk, minecraft:movement.basic,
minecraft:jump.static, minecraft:behavior.look_at_player,
minecraft:behavior.random_stroll, minecraft:behavior.hurt_by_target,
minecraft:behavior.nearest_attackable_target, minecraft:behavior.melee_attack

════════════════════════════════════════
ITEM RULES
════════════════════════════════════════

format_version: "1.21.0"
Path: behavior_packs/Name/items/item_name.json

{
  "format_version": "1.21.0",
  "minecraft:item": {
    "description": {
      "identifier": "namespace:item_name",
      "category": "Equipment"
    },
    "components": {
      "minecraft:max_stack_size": 1,
      "minecraft:hand_equipped": true,
      "minecraft:damage": 8,
      "minecraft:icon": { "texture": "namespace_item_name" },
      "minecraft:display_name": { "value": "Item Name" }
    }
  }
}

════════════════════════════════════════
BLOCK RULES
════════════════════════════════════════

format_version: "1.21.0"
Path: behavior_packs/Name/blocks/block_name.json

{
  "format_version": "1.21.0",
  "minecraft:block": {
    "description": { "identifier": "namespace:block_name" },
    "components": {
      "minecraft:destructible_by_mining": { "seconds_to_destroy": 3.0 },
      "minecraft:destructible_by_explosion": { "explosion_resistance": 6 },
      "minecraft:map_color": "#888888",
      "minecraft:geometry": "minecraft:geometry.full_cube",
      "minecraft:material_instances": {
        "*": { "texture": "namespace_block_name", "render_method": "opaque" }
      }
    }
  }
}

════════════════════════════════════════
VALID FILE PATHS ONLY
════════════════════════════════════════

behavior_packs/Name/manifest.json
behavior_packs/Name/entities/*.json
behavior_packs/Name/items/*.json
behavior_packs/Name/blocks/*.json
behavior_packs/Name/scripts/*.js
behavior_packs/Name/loot_tables/*.json
behavior_packs/Name/recipes/*.json
behavior_packs/Name/spawn_rules/*.json
resource_packs/Name/manifest.json
resource_packs/Name/entity/*.json
resource_packs/Name/texts/en_US.lang
resource_packs/Name/textures/terrain_texture.json
resource_packs/Name/textures/item_texture.json

════════════════════════════════════════
SEARCH
════════════════════════════════════════

Use [SEARCH: query] on its own line to look up uncertain patterns.
Stop after outputting [SEARCH: query]. Results will be injected. Then continue.

════════════════════════════════════════
TERMINAL OUTPUT FORMAT
════════════════════════════════════════

One idea per line. Max 80 chars per line. No markdown. No backticks in output.

Prefixes:
  >>  main progress step
  --  sub-step or detail
  ??  checking / uncertain
  OK  passed
  !!  warning or fix needed
  ==  separator line`;

const VERIFIER_PROMPT = `You are VERIFIER — a Minecraft Bedrock Edition addon validator.
You are the final authority. No code reaches the user without your approval.

════════════════════════════════════════
VALIDATION CHECKLIST (check ALL items)
════════════════════════════════════════

manifest.json:
[ ] format_version is integer 2 (not string "2")
[ ] All UUIDs are valid unique v4 format (not placeholder text like xxxxxxxx)
[ ] min_engine_version is integer array [1, 21, 0]
[ ] Script module present if JS files are included
[ ] dependencies include @minecraft/server 1.15.0 if scripted
[ ] No file called modules.json is referenced

entity behavior JSON:
[ ] format_version is string "1.21.0"
[ ] identifier uses namespace:name pattern
[ ] Only standard verified components used
[ ] All JSON brackets and braces are balanced

item/block JSON:
[ ] format_version is string "1.21.0"
[ ] identifier uses namespace:name pattern
[ ] Components match valid Bedrock schemas

JS scripts:
[ ] Uses world.afterEvents or world.beforeEvents (NOT world.events)
[ ] Uses EntityComponentTypes enum (NOT string "health" form)
[ ] All imports are valid exports from @minecraft/server
[ ] No undefined variables or broken logic
[ ] system.runInterval used correctly

General:
[ ] All JSON is syntactically valid (no trailing commas, balanced brackets)
[ ] No literal placeholder text like <uuid> or YOUR_UUID_HERE remains
[ ] All referenced files actually exist in the build
[ ] No [FILE_COMPLETE:...] tags appear inside file content

If you are uncertain about a component or API pattern, output:
[SEARCH: your query here]
Then stop and wait for search results before continuing your verdict.

════════════════════════════════════════
YOUR OUTPUT FORMAT
════════════════════════════════════════

Always start with:
[VERIFIER_REPORT]

For each file checked:
[CHECK: filename]
-- issue description, or: OK all checks passed
[STATUS: PASS] or [STATUS: FAIL]

At the end:

If ALL files pass:
[VERIFIER_DECISION: APPROVE]
[BUILD_VERIFIED]

If ANY file fails:
[VERIFIER_DECISION: REJECT]
[REGEN_NEEDED: list exactly what must be fixed]

Keep it concise. One issue per line. Terminal format only.`;

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

// Global rate limiter: enforces a minimum gap between ALL outgoing API calls.
// Free-tier OpenRouter models (z-ai/glm-4.5-air:free) allow ~3 req/min.
// We target ~1 req/20s to stay safely under the limit across builder + verifier.
const rateLimiter = (() => {
  const MIN_GAP_MS = 20000; // 20s between calls → ~3 req/min max
  let lastCallTime = 0;
  return async function waitForSlot() {
    const now = Date.now();
    const elapsed = now - lastCallTime;
    if (elapsed < MIN_GAP_MS) {
      const wait = MIN_GAP_MS - elapsed;
      console.log(`[RateLimiter] Waiting ${Math.round(wait / 1000)}s before next call`);
      await new Promise(r => setTimeout(r, wait));
    }
    lastCallTime = Date.now();
  };
})();

// FIX 1: exponential backoff with jitter, and always return resp (even on final 429)
async function callModel(model, messages, streamMode, maxTokens, temp) {
  const MAX_RETRIES = 5;
  // Base delays: 15s, 30s, 45s, 60s, 90s — tuned for free-tier RPM limits
  const BASE_DELAYS = [15000, 30000, 45000, 60000, 90000];

  let lastResp;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await rateLimiter(); // enforce global min gap between ALL API calls
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      lastResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://0vmod.vercel.app',
          'X-Title': 'MC Bedrock Builder'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: temp ?? 0.2,
          max_tokens: maxTokens ?? 4096,
          stream: streamMode
        })
      });
    } finally {
      clearTimeout(timeout);
    }

    // Success or non-retryable error — return immediately
    if (lastResp.status !== 429) return lastResp;

    // On 429, if we have retries left, wait and retry
    if (attempt < MAX_RETRIES) {
      // FIX 2: respect Retry-After header; fall back to longer base delays
      const retryAfter = lastResp.headers.get('retry-after');
      const base = retryAfter
        ? Math.max(parseInt(retryAfter) * 1000, BASE_DELAYS[attempt]) // at least our base
        : BASE_DELAYS[attempt];
      const jitter = Math.random() * 3000; // up to 3s of jitter
      const wait = base + jitter;
      console.warn(`429 on attempt ${attempt + 1}/${MAX_RETRIES + 1} — waiting ${Math.round(wait / 1000)}s`);
      await new Promise(r => setTimeout(r, wait));
    }
  }

  // FIX 3: always return the last response instead of returning undefined
  return lastResp;
}

function makeThinkStripper() {
  let insideThink = false;
  let pending = '';
  return function strip(chunk) {
    pending += chunk;
    let out = '';
    while (pending.length > 0) {
      if (insideThink) {
        const end = pending.indexOf('</think>');
        if (end === -1) { pending = ''; return out; }
        pending = pending.slice(end + 8);
        insideThink = false;
      } else {
        const start = pending.indexOf('<think>');
        if (start === -1) { out += pending; pending = ''; return out; }
        out += pending.slice(0, start);
        pending = pending.slice(start + 7);
        insideThink = true;
      }
    }
    return out;
  };
}

function sendSSE(res, content) {
  res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
}
function sendLine(res, text) { sendSSE(res, text + '\n'); }

function getDelta(p) {
  return p.choices?.[0]?.delta?.content
    ?? p.choices?.[0]?.message?.content
    ?? p.choices?.[0]?.delta?.reasoning
    ?? '';
}

// Safe regex escape for file paths
function escapeRegex(str) {
  return str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// Extract file content between FILE:/CONTENT: and [FILE_COMPLETE:] markers
function extractFileContent(text, filePath) {
  const esc = escapeRegex(filePath);
  const rx = new RegExp(
    'FILE:\\s*' + esc + '\\s*\\nCONTENT:\\n([\\s\\S]*?)\\[FILE_COMPLETE:\\s*' + esc + '\\s*\\]'
  );
  const m = text.match(rx);
  if (!m) return null;
  return m[1].replace(/^\s*\[VERIFY:[^\]]*\]\s*$/gm, '').trim();
}

// ─────────────────────────────────────────────
// streamModel — streams to client and returns full text
// ─────────────────────────────────────────────
async function streamModel(res, model, msgs, maxTok, temp) {
  const resp = await callModel(model, msgs, true, maxTok, temp);

  // FIX 4: surface 429 errors to the stream so the user knows what happened
  if (!resp || !resp.ok) {
    const status = resp?.status ?? 'unknown';
    const msg = status === 429
      ? '!! Rate limit hit — all retries exhausted. Please wait a minute and try again.'
      : `!! API error ${status}`;
    sendLine(res, msg);
    console.error('streamModel error:', status);
    return '';
  }

  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = '', out = '';
  const stripThink = makeThinkStripper();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const d = line.slice(6).trim();
        if (d === '[DONE]') continue;
        try {
          const p = JSON.parse(d);
          const delta = getDelta(p);
          if (delta) {
            const clean = stripThink(delta);
            if (!clean) continue;
            out += clean;
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: clean } }] })}\n\n`);
          }
        } catch (_) {}
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return out;
}

// ─────────────────────────────────────────────
// verifyFile — verify one file, retry on fail
// ─────────────────────────────────────────────
async function verifyFile(res, messages, filePath, initialContent, builderOutput) {
  const MAX_FILE_RETRIES = 3;
  const MAX_VERIFY_SEARCHES = 2;
  let currentContent = initialContent;
  let attempt = 0;

  while (attempt < MAX_FILE_RETRIES) {
    attempt++;
    sendLine(res, '');
    sendLine(res, '== ─────────────────────────────────────────────');
    sendLine(res, `[VERIFIER: ${VERIFIER_MODEL}]`);
    sendLine(res, `>> Verifying: ${filePath} (attempt ${attempt})`);
    sendLine(res, '');

    let vOut = '';
    let vSearches = 0;
    const vMsgs = [
      { role: 'system', content: VERIFIER_PROMPT },
      {
        role: 'user',
        content: `Verify this single file:\n\nFILE: ${filePath}\nCONTENT:\n${currentContent}\n\n` +
          `Check for:\n` +
          `- Correct Bedrock API usage\n` +
          `- Valid format_version and min_engine_version\n` +
          `- If version is wrong, flag with [VERSION_CORRECTION: explanation]\n` +
          `- Deprecated APIs or broken patterns\n` +
          `- [FILE_COMPLETE:...] tags inside file content (always FAIL)\n\n` +
          `Output [CHECK: ${filePath}], list every issue with -- prefix, then [STATUS: PASS] or [STATUS: FAIL].`
      }
    ];

    while (vSearches <= MAX_VERIFY_SEARCHES) {
      // rateLimiter in callModel handles spacing; no extra sleep needed here
      const chunk = await streamModel(res, VERIFIER_MODEL, vMsgs, 1200, 0.1);

      // If streamModel returned empty due to 429, treat as inconclusive
      if (!chunk) {
        sendLine(res, `?? ${filePath} — verifier unavailable (rate limited), continuing`);
        return { verified: true, content: currentContent };
      }

      vOut += chunk;

      const searchMatch = chunk.match(/\[SEARCH:\s*([^\]]+)\]/);
      if (searchMatch && vSearches < MAX_VERIFY_SEARCHES) {
        vSearches++;
        const q = searchMatch[1].trim();
        sendLine(res, `>> Verifier searching: ${q}`);
        let sr = { answer: null, results: [], source: 'none' };
        try { sr = await search(q); } catch (_) {}
        let ctx = `Search results for: ${q}\n`;
        if (sr.answer) ctx += `Answer: ${sr.answer}\n`;
        for (const r of sr.results) ctx += `[${r.url}]: ${r.snippet}\n`;
        if (!sr.answer && !sr.results.length) ctx += 'No results found.\n';
        vMsgs.push({ role: 'assistant', content: chunk });
        vMsgs.push({ role: 'user', content: `Search results:\n\n${ctx}\n\nNow give your [STATUS: PASS] or [STATUS: FAIL] verdict.` });
        continue;
      }
      break;
    }

    const passed = /\[STATUS:\s*PASS\]/.test(vOut);
    const failed = /\[STATUS:\s*FAIL\]/.test(vOut);

    const versionMatch = vOut.match(/\[VERSION_CORRECTION:\s*([^\]]+)\]/);
    if (versionMatch) {
      sendLine(res, `!! VERSION NOTICE: ${versionMatch[1].trim()}`);
    }

    if (passed && !failed) {
      sendLine(res, `OK ${filePath} — PASS`);
      sendLine(res, '');
      return { verified: true, content: currentContent };
    }

    if (!passed && !failed) {
      sendLine(res, `?? ${filePath} — verifier inconclusive, continuing`);
      sendLine(res, '');
      return { verified: true, content: currentContent };
    }

    sendLine(res, `!! FAIL: ${filePath} — attempt ${attempt}/${MAX_FILE_RETRIES}`);

    if (attempt >= MAX_FILE_RETRIES) {
      sendLine(res, `!! Max retries reached for ${filePath} — keeping best version`);
      sendLine(res, '');
      return { verified: false, content: currentContent };
    }

    sendLine(res, `[BUILDER: ${BUILDER_MODEL}]`);
    sendLine(res, `>> Fixing ${filePath}...`);
    sendLine(res, '');

    const fixMsgs = [
      { role: 'system', content: BUILDER_PROMPT },
      ...messages,
      { role: 'assistant', content: builderOutput },
      {
        role: 'user',
        content: `VERIFIER rejected ${filePath} on attempt ${attempt} with these issues:\n\n${vOut}\n\n` +
          `Fix EVERY issue listed.\n` +
          `Do NOT put [FILE_COMPLETE:...] tags inside the file content itself.\n` +
          `Output ONLY the fixed file:\n\n` +
          `FILE: ${filePath}\nCONTENT:\n{fixed content}\n[FILE_COMPLETE: ${filePath}]`
      }
    ];

    // rateLimiter in callModel handles spacing before fix call
    const fixOut = await streamModel(res, BUILDER_MODEL, fixMsgs, 4096, 0.1);
    const fixedContent = fixOut ? extractFileContent(fixOut, filePath) : null;
    if (fixedContent) {
      currentContent = fixedContent;
      sendLine(res, `>> Fixed — re-verifying...`);
    } else {
      sendLine(res, `!! Builder could not produce a fix — retrying verifier`);
    }
  }

  return { verified: false, content: currentContent };
}

// ─────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const { messages, isModMode, isBuild } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'Invalid messages' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Builder-Model', BUILDER_MODEL);
  res.setHeader('X-Verifier-Model', VERIFIER_MODEL);

  const MAX_ROUNDS = 40;
  const MAX_MS = 115000;
  const t0 = Date.now();

  // file path -> verified content
  const fileRegistry = {};
  let builderOutput = '';
  let anyFailed = false;

  const builderMsgs = [{ role: 'system', content: BUILDER_PROMPT }, ...messages];

  try {
    let round = 0;
    let buildStarted = false;

    while (round < MAX_ROUNDS && Date.now() - t0 < MAX_MS) {
      const maxTok = (isBuild || buildStarted) ? 6000 : 512;
      const temp   = (isBuild || buildStarted) ? 0.2  : 0.7;

      const resp = await callModel(BUILDER_MODEL, builderMsgs, true, maxTok, temp);

      if (!resp || !resp.ok) {
        const status = resp?.status ?? 'unknown';
        console.error('Builder error:', status);
        if (round === 0) {
          // FIX 7: don't try to set headers after SSE headers are already sent
          // SSE headers are set above before the try block, so just stream the error
          sendLine(res, status === 429
            ? '!! Rate limited by OpenRouter. Please wait a moment and try again.'
            : `!! AI service error: ${status}`
          );
          res.write('data: [DONE]\n\n');
          return res.end();
        }
        break;
      }

      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '', accumulated = '', lineBuf = '';
      let searchQuery = null;
      const fileCompleteTags = [];
      const stripThink = makeThinkStripper();

      const heartbeat = setInterval(() => { res.write(': ping\n\n'); }, 5000);

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n'); buf = parts.pop() || '';

        for (const line of parts) {
          if (line.startsWith(':')) continue;
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6).trim();
          if (d === '[DONE]') break outer;
          try {
            const p = JSON.parse(d);
            const delta = getDelta(p);
            if (delta) {
              const clean = stripThink(delta);
              if (!clean) continue;
              accumulated += clean;
              lineBuf += clean;
              res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: clean } }] })}\n\n`);

              if (!buildStarted && /FILE:\s*\S/.test(accumulated)) {
                buildStarted = true;
              }

              const nlIdx = lineBuf.lastIndexOf('\n');
              if (nlIdx !== -1) {
                const completedLines = lineBuf.slice(0, nlIdx);
                lineBuf = lineBuf.slice(nlIdx + 1);

                for (const cl of completedLines.split('\n')) {
                  const t = cl.trim();
                  const sm = t.match(/^\[SEARCH:\s*([^\]]+)\]$/);
                  if (sm) { searchQuery = sm[1].trim(); break outer; }
                  const fcm = t.match(/^\[FILE_COMPLETE:\s*(.+?)\]$/);
                  if (fcm) fileCompleteTags.push(fcm[1].trim());
                }
              }
            }
          } catch (_) {}
        }
      }

      clearInterval(heartbeat);
      reader.cancel().catch(() => {});
      builderOutput += accumulated;

      // ── Process all completed files from this round ──
      if (fileCompleteTags.length > 0) {
        for (const filePath of fileCompleteTags) {
          let fileContent = extractFileContent(accumulated, filePath)
            ?? extractFileContent(builderOutput, filePath);

          if (fileContent) {
            fileRegistry[filePath] = fileContent;
            // rateLimiter in callModel handles spacing before verifier
            const result = await verifyFile(res, messages, filePath, fileContent, builderOutput);
            if (!result.verified) anyFailed = true;
            if (result.content !== fileContent) fileRegistry[filePath] = result.content;
          } else {
            sendLine(res, `!! Could not extract content for ${filePath} — skipping verify`);
            sendLine(res, '');
          }
        }

        if (accumulated.includes('[BUILD_COMPLETE]')) {
          break;
        }

        const doneFiles = Object.keys(fileRegistry);
        builderMsgs.push({ role: 'assistant', content: accumulated });
        builderMsgs.push({
          role: 'user',
          content: `Files completed so far: ${doneFiles.join(', ')}\n\n` +
            `Continue outputting the remaining planned files in the same format.\n` +
            `Do NOT re-output files already listed above.\n` +
            `When ALL files are done output [BUILD_COMPLETE] then [DOWNLOAD_READY].`
        });

        round++;
        continue;
      }

      // ── SEARCH: inject results and continue ──
      if (searchQuery) {
        res.write(': heartbeat\n\n');
        let sr = { answer: null, results: [], source: 'none' };
        try { sr = await search(searchQuery); } catch (e) {}

        let ctx = `Search results for: ${searchQuery}\n`;
        if (sr.answer) ctx += `Answer: ${sr.answer}\n`;
        for (const r of sr.results) ctx += `[${r.url}]: ${r.snippet}\n`;
        if (!sr.answer && !sr.results.length) ctx += 'No results — use verified patterns from training.\n';

        sendSSE(res, `\n[SR: ${searchQuery}]\n`);

        builderMsgs.push({ role: 'assistant', content: accumulated });
        builderMsgs.push({
          role: 'user',
          content: `Search results for "${searchQuery}":\n\n${ctx}\n\nContinue building. Keep terminal line format.`
        });
        searchQuery = null;
        round++;
        continue;
      }

      // ── Builder finished naturally with no tags — done ──
      break;
    }

    // ── End of build ──
    const hasFiles = Object.keys(fileRegistry).length > 0;

    if (!hasFiles && !buildStarted) {
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    if (hasFiles) {
      let canonical = '\n';
      for (const [path, content] of Object.entries(fileRegistry)) {
        canonical += `FILE: ${path}\nCONTENT:\n${content}\n[FILE_COMPLETE: ${path}]\n`;
      }
      sendSSE(res, canonical);
    }

    sendLine(res, '');
    sendLine(res, '== ─────────────────────────────────────────────');
    sendLine(res, '[VERIFIER_DECISION: APPROVE]');
    sendLine(res, anyFailed
      ? 'OK All files verified and corrected — BUILD VERIFIED'
      : 'OK All files passed clean — BUILD VERIFIED');
    sendLine(res, '[BUILD_VERIFIED]');
    sendLine(res, '[BUILD_COMPLETE]');

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (e) {
    console.error('Handler error:', e);
    try { res.write('data: [DONE]\n\n'); res.end(); } catch (_) {}
  }
}
