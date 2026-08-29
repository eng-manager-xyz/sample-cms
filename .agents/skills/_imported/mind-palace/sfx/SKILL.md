---
name: sfx
description: "Use when asked to generate a sound effect via the ElevenLabs MCP and save it to disk. Pairs with the `sound-design` skill: that skill authors the six-slot prompt using `docs/sound-design/CONSOLIDATED.md`, and this skill executes one generation. Recreates the old /sfx command as a Codex skill."
---

<objective>
Generate a single sound effect by calling `mcp__elevenlabs__text_to_sound_effects`, save the file to a project-local directory, and return the saved path. This command is the executor; the `sound-design` skill is the brain that authors the prompt.
</objective>

<when_to_use>
- Invoked by the `sound-design` skill after it has authored a six-slot prompt.
- Invoked directly by the user with `/sfx <prompt>` when they already know the prompt they want.
- NOT for batch generation, NOT for multi-event scenes (those split into multiple `/sfx` calls), NOT for clips longer than 5 seconds (use the public ElevenLabs UI for those).
</when_to_use>

<arguments>
The user's invocation may take any of these shapes; parse accordingly.

- `/sfx "<prompt>"` — minimum form. Defaults: 2s, no loop, `apps/web/public/sfx/misc/`, `mp3_44100_128`.
- `/sfx <class> "<prompt>"` — class drives the output subdirectory. Valid: `ui`, `foley`, `cinematic`, `mechanical`, `ambience`, `event`, `misc`. Path becomes `apps/web/public/sfx/<class>/`.
- `/sfx <class> <name> "<prompt>"` — name becomes the filename stem (`<name>.mp3`). Without a name, the MCP picks one.
- `/sfx <class> <name> <duration>s "<prompt>"` — explicit duration in seconds (0.5–5).
- `/sfx <class> <name> <duration>s loop "<prompt>"` — loop ON.

If invoked with no prompt at all, ask the user for one or hand off to the `sound-design` skill to author one.
</arguments>

<steps>

If the ElevenLabs MCP tools are not available in the current session, stop and tell the user this environment cannot generate the audio directly. Do not fake a generated file.

### 1. Validate

- **Prompt length**: warn if < 10 words (likely too generic) or > 60 words (likely contradictions). Don't block — warn and proceed.
- **Duration**: clamp to `[0.5, 5]`. The MCP rejects values outside this range. If the user requested > 5s, tell them and proceed at 5s, OR ask if they want to chain calls / switch to the public UI.
- **Loop sanity check**: if `loop: true` and the prompt looks event-shaped (contains "slam", "click", "hit", "impact", "shot", "drop", "snap"), warn the user — looping makes no sense for transient events. Ask before flipping it off.
- **Multi-event sanity check**: if the prompt contains commas-then-conjunctions like "then", "followed by", "and then", "after that" implying a sequence of distinct events, stop and route to the `sound-design` skill — the consolidated framework's load-bearing rule is "one event per generation".

### 2. Resolve the output path

- Class → subdirectory: `apps/web/public/sfx/<class>/` (default `misc`).
- Create the directory if it doesn't exist (`mkdir -p`).
- Filename: if the user provided one, use `<name>.mp3` (or matching extension for chosen `output_format`). If not, let the MCP name it.
- **Never** save outside `apps/web/public/sfx/` without explicit user override — that directory is the project convention for static SFX served by Vite.
- Confirm the path back to the user before generating, so they can redirect if needed.

### 3. Call the MCP

```
mcp__elevenlabs__text_to_sound_effects(
  text:              "<the six-slot prompt>",
  duration_seconds:  <0.5–5, default 2>,
  loop:              <true|false, default false>,
  output_directory:  "<absolute path to apps/web/public/sfx/<class>/>",
  output_format:     "mp3_44100_128",  // override only on user request
)
```

**This is a paid API call.** The MCP tool's own description carries a cost warning. Each call generates ONE file (the MCP returns one variation, not the four the public UI returns). If the user might iterate, warn them up front: "I'll generate one variation. If it misses, we re-prompt — each call has a credit cost."

### 4. After the MCP returns

- Surface the saved file path to the user — exact, copyable.
- Show the prompt, duration, and loop flag that produced it (so the user has the recipe).
- DO NOT auto-play. If the user asks, call `mcp__elevenlabs__play_audio` with the returned path.
- DO NOT auto-`git add`. Tell the user the file is on disk; they decide whether to track it.

### 5. If iteration is needed

If the user is dissatisfied, do NOT immediately call `/sfx` again with the same prompt. Hand off to the `sound-design` skill which owns the iteration protocol (change one slot, simplify, add naturalism cues, etc. — see `docs/sound-design/CONSOLIDATED.md`). One regen with the same prompt is a coin flip; the framework gets you to "right" in 2–3 deliberate iterations.

</steps>

<defaults>
- Output directory root: `apps/web/public/sfx/`
- Class subdirectories (created on demand): `ui/`, `foley/`, `cinematic/`, `mechanical/`, `ambience/`, `event/`, `misc/`
- Duration: 2s
- Loop: false
- Output format: `mp3_44100_128` (MP3 44.1 kHz, 128 kbps — fine for game-asset prototyping; PCM/WAV needs Pro tier on ElevenLabs)
</defaults>

<constraints>
- **Duration MUST be 0.5–5 seconds.** The MCP enforces this; sending anything outside that range is a hard error.
- **One file per call.** The MCP does not return four variations like the public UI. If the user wants variations, that's N calls.
- **No prompt-influence parameter** is exposed on the MCP. To control adherence, write the prompt more or less technically (see `CONSOLIDATED.md` § "Prompt influence — the most misunderstood control"); don't tell the user a parameter exists that they can't control here.
- **No SSML, no audio tags inside SFX prompts.** `[whispering]`, `<break>`, `<emphasis>` are TTS-only. They will be ignored or produce artifacts here.
- **Path discipline.** Never save outside `apps/web/public/sfx/` unless the user names a different absolute path. The Vite dev server and PWA precache assume that root.
- **Cost transparency.** Always tell the user "this is a paid ElevenLabs API call" before the FIRST call in a session. After they've acknowledged, don't repeat for follow-ups.
</constraints>

<output>
After a successful generation, return one block:

```
SAVED:    <absolute path>
DURATION: <Ns>
LOOP:     <true|false>
PROMPT:   "<the prompt that produced it>"

Play it?  Say "play" — I'll call mcp__elevenlabs__play_audio.
Iterate?  Tell me what's off; I'll route to the sound-design skill for round 2.
```
</output>

<verification>
- Confirm the returned file path actually exists (`ls -la <path>`) before reporting success.
- If the MCP returns an error, surface the exact error to the user — do not retry silently.
- If the file is suspiciously small (< 5 KB for a ≥1s clip), warn that the generation may be empty/silent and offer to regenerate.
</verification>
