# AGENTS.md

EMD (`emd-minecraft`) is a Node CLI plus skills and presets for AI-assisted Minecraft development. Strict TypeScript, ESM, Node 22 or newer.

## Commands

```bash
npm ci
npm run typecheck
npm test              # unit tests against recorded fixtures, no network
npm run test:live     # hits the real version APIs
npm run record-fixtures
npm run build
npm run prove         # after build: generate every preset and build it with Gradle (needs JDK 25 and a current Gradle)
```

## Layout

- `src/cli.ts`: the `emd` entry point.
- `src/versions/`: one module per version source, plus the resolver that combines them.
- `test/`: Vitest tests. `test/fixtures/` holds recorded API responses. `test/live/` hits the network and is excluded from `npm test`.
- `scripts/`: maintenance scripts, such as the fixture recorder.

## Rules

- Never hard-code a Minecraft, Java, Paper, Fabric, NeoForge or Forge version. Ask the resolver in `src/versions/`.
- Each version source is a pure parser plus a thin fetcher. Test the parser against a recorded fixture.
- Write the test first.
- A preset may copy files only from MIT, Apache-2.0 or CC0 projects. It records the source repo, commit and license in `preset.json`. GPL and custom-licensed projects are reference reading only.
- Treat every string from an upstream API as hostile. It must pass `isVersionToken` (`src/util/json.ts`) before it is used, printed or written into a generated file.
- Network access goes through `src/versions/http.ts`, which only fetches https URLs on `ALLOWED_HOSTS` and validates a body before caching it. Never call `fetch` directly.
