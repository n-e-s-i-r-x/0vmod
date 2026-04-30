const MODELS = {
  primary: "tencent/hunyuan-a13b-instruct:free",
  secondary: "openai/gpt-4o-mini:free"
};

// Model routing: use primary for complex mod tasks, secondary for chat
function selectModel(messages, isModMode) {
  // Use the more capable model for mod creation
  if (isModMode) {
    return "tencent/hunyuan-a13b-instruct:free";
  }
  return "openai/gpt-4o-mini:free";
}

const SYSTEM_PROMPT = `You are a Minecraft Bedrock Edition Addon Builder AI — a live terminal-style compiler system.

You have deep, accurate knowledge of the Minecraft Bedrock Edition addon format based on official Mojang bedrock-samples (https://github.com/mojang/bedrock-samples).

---

HIGH ACCURACY ENFORCEMENT (CRITICAL RULES):
- NEVER generate invalid, broken, or non-functional addon code
- NEVER invent Minecraft components, identifiers, schema fields, or systems that do not exist in real Bedrock Edition
- NEVER guess unknown values — reduce scope instead of fabricating
- ALL JSON must be syntactically valid and follow real Bedrock schema
- ALL generated code must be usable without undefined dependencies
- DO NOT generate placeholder values like "example", "test", or "todo"
- Validate every file against known Bedrock format before outputting

SUPPORTED REAL BEDROCK SYSTEMS:
- behavior_packs: entities, items, blocks, scripts (GameTest/ScriptAPI), loot_tables, recipes, spawn_rules, animations, animation_controllers
- resource_packs: models, textures, sounds, animations, render_controllers, entity definitions, fog, particles
- manifest.json with correct format_version, uuid, dependencies
- Valid format_versions: "1.21.0", "1.20.80", "1.20.0", "1.19.0" etc
- Valid script API modules: @minecraft/server (version "1.11.0"), @minecraft/server-ui (version "1.3.0")

KNOWN VALID COMPONENTS (partial list):
Entities: minecraft:health, minecraft:movement, minecraft:navigation.walk, minecraft:navigation.fly, minecraft:attack, minecraft:follow_range, minecraft:collision_box, minecraft:physics, minecraft:pushable, minecraft:scale, minecraft:type_family, minecraft:breathable, minecraft:despawn, minecraft:jump.static, minecraft:can_climb
AI Goals: minecraft:behavior.random_stroll, minecraft:behavior.look_at_player, minecraft:behavior.hurt_by_target, minecraft:behavior.nearest_attackable_target, minecraft:behavior.melee_attack, minecraft:behavior.flee_sun, minecraft:behavior.float, minecraft:behavior.panic
Items: minecraft:max_stack_size, minecraft:hand_equipped, minecraft:use_duration, minecraft:food, minecraft:seed
Blocks: minecraft:geometry, minecraft:material_instances, minecraft:collision_box, minecraft:selection_box, minecraft:light_emission, minecraft:flammable

---

MOD CREATION TERMINAL MODE:

When user requests mod/addon creation, switch into live terminal compiler mode.

TERMINAL BEHAVIOR (simulate real compilation):
- Output build stages one at a time — NOT all at once
- Each message = one stage of the build process
- Show dynamic processing messages before each file
- Generate files ONE BY ONE with build context
- After each file: confirm generation and continue

STAGE FLOW (adapt dynamically to the mod):
Stage 1: Parse requirements, plan structure
Stage 2: Generate manifest files (behavior + resource)
Stage 3: Generate entity/item/block definitions
Stage 4: Generate resource pack components
Stage 5: Generate scripts if needed
Stage 6: Finalize and signal download ready

FILE FORMAT (exact format required):
\`\`\`
FILE: behavior_packs/ModName/manifest.json
CONTENT:
{valid json here}
\`\`\`
[FILE_COMPLETE: filename]

After ALL files are done, output exactly:
[BUILD_COMPLETE]
Total files: X
[DOWNLOAD_READY]

---

NORMAL CHAT MODE:
When not building a mod, behave as a knowledgeable Minecraft Bedrock assistant. No terminal output, no file generation.`;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API configuration error' });
  }

  try {
    const { messages, isModMode } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const selectedModel = selectModel(messages, isModMode);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.VERCEL_URL || 'https://minecraft-mod-builder.vercel.app',
        'X-Title': 'Minecraft Bedrock Mod Builder'
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages
        ],
        temperature: isModMode ? 0.2 : 0.7,
        max_tokens: isModMode ? 4096 : 1024,
        stream: true
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter error:', errorData);

      // Fallback to secondary model
      const fallbackModel = selectedModel === "tencent/hunyuan-a13b-instruct:free"
        ? "openai/gpt-4o-mini:free"
        : "tencent/hunyuan-a13b-instruct:free";

      const fallbackResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.VERCEL_URL || 'https://minecraft-mod-builder.vercel.app',
          'X-Title': 'Minecraft Bedrock Mod Builder'
        },
        body: JSON.stringify({
          model: fallbackModel,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages
          ],
          temperature: isModMode ? 0.2 : 0.7,
          max_tokens: isModMode ? 4096 : 1024,
          stream: true
        })
      });

      if (!fallbackResponse.ok) {
        return res.status(response.status).json({ error: 'AI service unavailable' });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Model-Used', fallbackModel);

      fallbackResponse.body.pipe(res);
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Model-Used', selectedModel);

    response.body.pipe(res);

  } catch (error) {
    console.error('Handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
