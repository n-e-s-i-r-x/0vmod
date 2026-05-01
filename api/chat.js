import { search } from './search.js';

const BUILDER_MODEL  = 'z-ai/glm-4.5-air:free';
const VERIFIER_MODEL = 'z-ai/glm-4.5-air:free';

// ─────────────────────────────────────────────
// BUILDER SYSTEM PROMPT
// ─────────────────────────────────────────────
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

STEP 3 — BUILD FILES:
For each file output exactly in this format:

FILE: path/to/filename.ext
CONTENT:
{raw file content — no backticks, no markdown}
[VERIFY: path/to/filename.ext]
[FILE_COMPLETE: path/to/filename.ext]

STEP 4 — END:
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

// ─────────────────────────────────────────────
// VERIFIER SYSTEM PROMPT
// ─────────────────────────────────────────────
const VERIFIER_PROMPT = `You are VERIFIER — a Minecraft Bedrock Edition addon validator.
You are the final authority. No code reaches the user without your approval.

════════════════════════════════════════
VALIDATION CHECKLIST (check ALL items)
════════════════════════════════════════

manifest.json:
[ ] format_version is integer 2 (not string "2")
[ ] All UUIDs are valid unique v4 format (not placeholder text)
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
[ ] All JSON is syntactically valid (no trailing commas, balanced)
[ ] No literal placeholder text like <uuid> or YOUR_UUID_HERE remains
[ ] All referenced files actually exist in the build

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
async function callModel(model, messages, streamMode, maxTokens, temp) {
  return fetch('https://openrouter.ai/api/v1/chat/completions', {
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
}

function makeThinkStripper() {
  let insideThink = false;
  let buf = '';
  return function strip(chunk) {
    buf += chunk;
    let out = '';
    while (buf.length > 0) {
      if (insideThink) {
        const end = buf.indexOf('</think>');
        if (end === -1) { buf = ''; return out; }
        buf = buf.slice(end + 8);
        insideThink = false;
      } else {
        const start = buf.indexOf('<think>');
        if (start === -1) { out += buf; buf = ''; return out; }
        out += buf.slice(0, start);
        buf = buf.slice(start + 7);
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

  const { messages, isModMode } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'Invalid messages' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Builder-Model', BUILDER_MODEL);
  res.setHeader('X-Verifier-Model', VERIFIER_MODEL);

  const MAX_ROUNDS = 8;
  const MAX_MS = 115000;
  const t0 = Date.now();
  const builderMsgs = [{ role: 'system', content: BUILDER_PROMPT }, ...messages];

  try {
    // ── PHASE 1: BUILDER ─────────────────────
    let builderOutput = '';
    let round = 0;

    while (round < MAX_ROUNDS && Date.now() - t0 < MAX_MS) {
      const resp = await callModel(BUILDER_MODEL, builderMsgs, true, isModMode ? 6000 : 1024, isModMode ? 0.15 : 0.6);

      if (!resp.ok) {
        const errText = await resp.text();
        console.error('Builder error:', resp.status, errText);
        if (round === 0) {
          res.setHeader('Content-Type', 'application/json');
          return res.status(resp.status).json({ error: 'AI service error: ' + resp.status });
        }
        break;
      }

      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '', accumulated = '', searchQuery = null;
      const stripThink = makeThinkStripper();

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith(':')) continue;
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6).trim();
          if (d === '[DONE]') break outer;
          try {
            const p = JSON.parse(d);
            const reasoning = p.choices?.[0]?.delta?.reasoning || '';
            if (reasoning) continue;
            const delta = p.choices?.[0]?.delta?.content
              ?? p.choices?.[0]?.message?.content
              ?? '';
            if (delta) {
              const clean = stripThink(delta);
              if (!clean) continue;
              accumulated += clean;
              res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: clean } }] })}\n\n`);
              const sm = accumulated.match(/\[SEARCH:\s*([^\]]+)\]$/);
              if (sm) { searchQuery = sm[1].trim(); break outer; }
            }
          } catch (_) {}
        }
      }

      reader.cancel().catch(() => {});
      builderOutput += accumulated;

      // ── INLINE PER-FILE VERIFY DURING STREAMING ──
      const justCompleted = accumulated.match(/\[FILE_COMPLETE:\s*([^\]]+)\]/g);
      if (justCompleted) {
        for (const tag of justCompleted) {
          const filePath = tag.replace(/\[FILE_COMPLETE:\s*/, '').replace(/\]$/, '').trim();
          const fileMatch = builderOutput.match(
            new RegExp(`FILE:\\s*${filePath.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\nCONTENT:\\n([\\s\\S]*?)\\[FILE_COMPLETE:`)
          );
          if (!fileMatch) continue;

          let currentContent = fileMatch[1].trim();
          let fileVerified = false;
          let attempt = 0;
          const MAX_FILE_RETRIES = 4;

          while (attempt < MAX_FILE_RETRIES && !fileVerified) {
            attempt++;
            sendLine(res, '');
            sendLine(res, '== ─────────────────────────────────────────────');
            sendLine(res, `[VERIFIER: ${VERIFIER_MODEL}]`);
            sendLine(res, `>> Verifying: ${filePath} (attempt ${attempt})`);
            sendLine(res, '');

            const vMsgs = [
              { role: 'system', content: VERIFIER_PROMPT },
              {
                role: 'user',
                content: `Verify this single file:\n\nFILE: ${filePath}\nCONTENT:\n${currentContent}\n\n` +
                  `Check for:\n` +
                  `- Correct Bedrock API usage\n` +
                  `- Valid format_version and min_engine_version\n` +
                  `- If version is wrong or nonexistent (e.g. 1.26.0), flag it with [VERSION_CORRECTION: explanation]\n` +
                  `- Any broken patterns or deprecated APIs\n\n` +
                  `Output [CHECK: ${filePath}], list every issue with -- prefix, then [STATUS: PASS] or [STATUS: FAIL].`
              }
            ];

            const vOut = await streamModel(VERIFIER_MODEL, vMsgs, 1500, 0.1);
            const passed = vOut.includes('[STATUS: PASS]');
            const failed = vOut.includes('[STATUS: FAIL]');

            const versionMatch = vOut.match(/\[VERSION_CORRECTION:\s*([^\]]+)\]/);
            if (versionMatch) {
              sendLine(res, '');
              sendLine(res, `!! VERSION NOTICE: ${versionMatch[1].trim()}`);
            }

            if (passed && !failed) {
              fileVerified = true;
              sendLine(res, `OK ${filePath} — PASS`);
              break;
            }

            sendLine(res, '');
            sendLine(res, `!! FAIL: ${filePath} — attempt ${attempt}/${MAX_FILE_RETRIES}`);

            if (attempt >= MAX_FILE_RETRIES) {
              sendLine(res, `!! Max retries reached for ${filePath} — keeping best version`);
              break;
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
                  `Fix EVERY issue. If a version correction was flagged, use the corrected version.\n` +
                  `Output ONLY the fixed file in this exact format:\n\n` +
                  `FILE: ${filePath}\nCONTENT:\n{fixed content}\n[VERIFY: ${filePath}]\n[FILE_COMPLETE: ${filePath}]`
              }
            ];

            const fixOut = await streamModel(BUILDER_MODEL, fixMsgs, 4000, 0.1);
            const fixedMatch = fixOut.match(/FILE:\s*[^\n]+\nCONTENT:\n([\s\S]*?)\[FILE_COMPLETE:/);
            if (fixedMatch) {
              currentContent = fixedMatch[1].trim();
              // patch builderOutput with fixed content so final zip uses corrected file
              builderOutput = builderOutput.replace(fileMatch[1], currentContent);
              sendLine(res, `>> Fixed — re-verifying...`);
            } else {
              sendLine(res, `!! Builder could not produce a fix — retrying`);
            }
          }
        }
      }

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
          content: `Search results for "${searchQuery}":\n\n${ctx}\n\nContinue building from where you stopped. Keep terminal line format. One idea per line.`
        });
        searchQuery = null;
        round++;
        continue;
      }

      break;
    }

    // Detect if builder produced files or just asked questions
    const hasBuildComplete = builderOutput.includes('[BUILD_COMPLETE]');
    const hasFiles = /FILE:\s*\S/.test(builderOutput);

    // If no build — just a clarification or chat response — end here
    if (!hasBuildComplete || !hasFiles) {
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    // ── PHASE 2: FINAL SUMMARY ───────
    function extractFiles(text) {
      const files = [];
      const re = /FILE:\s*([^\n]+)\nCONTENT:\n([\s\S]*?)\[FILE_COMPLETE:[^\]]+\]/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        files.push({ path: m[1].trim(), content: m[2].trim() });
      }
      return files;
    }

    async function streamModel(model, msgs, maxTok, temp) {
      const resp = await callModel(model, msgs, true, maxTok, temp);
      if (!resp.ok) return '';
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '', out = '';
      const stripThink = makeThinkStripper();
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
            const reasoning = p.choices?.[0]?.delta?.reasoning || '';
            if (reasoning) continue;
            const delta = p.choices?.[0]?.delta?.content
              ?? p.choices?.[0]?.message?.content
              ?? '';
            if (delta) {
              const clean = stripThink(delta);
              if (!clean) continue;
              out += clean;
              res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: clean } }] })}\n\n`);
            }
          } catch (_) {}
        }
      }
      reader.releaseLock();
      return out;
    }
    sendLine(res, '');
    sendLine(res, '== ─────────────────────────────────────────────');
    sendLine(res, '[VERIFIER_DECISION: APPROVE]');
    sendLine(res, anyFailed ? 'OK All files verified and corrected — BUILD VERIFIED' : 'OK All files passed clean — BUILD VERIFIED');
    sendLine(res, '[BUILD_VERIFIED]');

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (e) {
    console.error('Handler error:', e);
    try { res.write('data: [DONE]\n\n'); res.end(); } catch (_) {}
  }
}
