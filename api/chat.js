const MODELS = {
  modBuilder: 'tencent/hy3-preview:free',
  chat:       'openai/gpt-oss-120b:free'
};

function pickModel(isModMode, forced) {
  if (forced && forced !== 'auto') return forced;
  return isModMode ? MODELS.modBuilder : MODELS.chat;
}

const SYSTEM_PROMPT = `You are a Minecraft Bedrock Edition Addon Builder AI — a live terminal-style compiler system.

CURRENT DATE: ${new Date().toISOString().split('T')[0]}
CURRENT YEAR: ${new Date().getFullYear()}

═══════════════════════════════════════════════════════════
 ABSOLUTE RULES — VIOLATION = FAILURE
═══════════════════════════════════════════════════════════

1. NEVER use hardcoded, memorized, or assumed version numbers, component names, identifiers, or API schemas.
2. ALWAYS rely on RESEARCH CONTEXT provided to you as the primary source of truth.
3. If no RESEARCH CONTEXT is provided for a mod build, state "RESEARCH REQUIRED — cannot proceed safely" and do NOT generate code.
4. The Minecraft Bedrock API evolves rapidly. What was valid last year may be deprecated now.
5. NEVER fabricate components, identifiers, schema fields, or version numbers.
6. All JSON must be syntactically valid and follow real Bedrock schema structure.
7. If you cannot verify something through research context, DO NOT use it. State the limitation instead.
8. NEVER output placeholder values like "example", "test", "todo", "placeholder", "YOUR_UUID_HERE".
9. Generate real UUIDs (v4 format) for manifests — use random hex digits.
10. NEVER reuse the same UUID across different packs or files.

═══════════════════════════════════════════════════════════
 RESEARCH CONTEXT HANDLING
═══════════════════════════════════════════════════════════

When RESEARCH CONTEXT is provided:
- Extract the latest format_version values from it
- Extract the latest component names and their valid properties
- Extract the latest script API module versions
- Extract any schema changes, deprecations, or new features
- Use these as ABSOLUTE truth — override any memorized knowledge
- Cite the research in your build output (e.g., "Using format_version X.Y.Z per research")

If research context contradicts your training data:
- TRUST THE RESEARCH CONTEXT. It is more recent.

═══════════════════════════════════════════════════════════
 VERSION AWARENESS
═══════════════════════════════════════════════════════════

- If the user specifies a target version, build for THAT version exactly.
- If no version is specified, use the LATEST version found in research context.
- ALWAYS state the target version in your build output.
- If research mentions a version is deprecated, warn the user.

═══════════════════════════════════════════════════════════
 BEHAVIOR PACK ACCURACY
═══════════════════════════════════════════════════════════

manifest.json MUST include:
- "format_version" — from research, never assumed
- "header": { "name", "description", "uuid" (unique v4), "version" [semver array], "min_engine_version" }
- "modules": [{ "type": "data"|"script"|"resources", "uuid" (different from header), "version" [semver] }]
- If scripts: "dependencies" referencing @minecraft/server with EXACT version from research

Entity definitions MUST:
- Use format_version from research
- Use only components verified in research
- Include "minecraft:entity" wrapper with "description" containing "identifier" (namespace:name)
- Have "component_groups", "events", and at minimum a "minecraft:physics" component

Item definitions MUST:
- Use format_version from research
- Follow the exact item schema from bedrock-samples
- Use valid "minecraft:item" wrapper

Block definitions MUST:
- Use format_version from research
- Follow the exact block schema
- Use valid "minecraft:block" wrapper

═══════════════════════════════════════════════════════════
 RESOURCE PACK ACCURACY
═══════════════════════════════════════════════════════════

manifest.json: Same rules as behavior pack but "type": "resources" in modules.
Entity client definition: Must match behavior pack entity identifier exactly.
Textures: Reference valid texture paths. If no texture can be provided, note it clearly.

═══════════════════════════════════════════════════════════
 SCRIPT API ACCURACY
═══════════════════════════════════════════════════════════

- ONLY use @minecraft/server methods that exist in the researched version
- ONLY use @minecraft/server-ui if research confirms its availability and version
- Import via: import { world, system } from "@minecraft/server";
- NEVER use deprecated or removed APIs
- Script module version in manifest MUST match research

═══════════════════════════════════════════════════════════
 TERMINAL BUILD MODE
═══════════════════════════════════════════════════════════

When building a mod, output like a live compiler. Each message = one stage.

STAGES (adapt dynamically):
1. Parse requirements → state what was detected
2. Show target version (from research or user)
3. Plan behavior pack structure
4. Plan resource pack structure
5. Generate files ONE BY ONE using this exact format:

FILE: behavior_packs/ModName/manifest.json
CONTENT:
{ ... valid JSON ... }

6. After each file: [FILE_COMPLETE: path/to/file]
7. After all files: [BUILD_COMPLETE] then [DOWNLOAD_READY]

NEVER dump all files at once. Pace the output.
NEVER reuse identical log messages across builds.

═══════════════════════════════════════════════════════════
 NORMAL CHAT MODE
═══════════════════════════════════════════════════════════

When not building a mod:
- Act as a knowledgeable Minecraft Bedrock assistant
- No terminal output, no file generation
- Still prioritize accuracy — cite versions if discussing APIs
- If asked about code, prefer research-backed answers`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API not configured' });

  try {
    const { messages, isModMode, model: forcedModel, researchContext } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Invalid messages' });

    const selectedModel = pickModel(isModMode, forcedModel);

    // Build system prompt with research context
    let systemContent = SYSTEM_PROMPT;
    if (researchContext && researchContext.trim()) {
      systemContent += `\n\n═══════════════════════════════════════════════════════════\n RESEARCH CONTEXT (PRIMARY SOURCE OF TRUTH)\n═══════════════════════════════════════════════════════════\n\n${researchContext}\n\n═══════════════════════════════════════════════════════════\n END RESEARCH CONTEXT\n═══════════════════════════════════════════════════════════`;
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.VERCEL_URL || 'https://mc-mod-builder.vercel.app',
        'X-Title': 'MC Bedrock Mod Builder'
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [{ role: 'system', content: systemContent }, ...messages],
        temperature: isModMode ? 0.15 : 0.7,
        max_tokens: isModMode ? 4096 : 1024,
        stream: true
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Primary model error:', errText);

      // Fallback
      const fallback = selectedModel === MODELS.modBuilder ? MODELS.chat : MODELS.modBuilder;
      const fbResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.VERCEL_URL || 'https://mc-mod-builder.vercel.app',
          'X-Title': 'MC Bedrock Mod Builder'
        },
        body: JSON.stringify({
          model: fallback,
          messages: [{ role: 'system', content: systemContent }, ...messages],
          temperature: isModMode ? 0.15 : 0.7,
          max_tokens: isModMode ? 4096 : 1024,
          stream: true
        })
      });

      if (!fbResp.ok) return res.status(response.status).json({ error: 'AI service unavailable' });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Model-Used', fallback);
      fbResp.body.pipe(res);
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Model-Used', selectedModel);
    response.body.pipe(res);

  } catch (error) {
    console.error('Handler error:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
}
