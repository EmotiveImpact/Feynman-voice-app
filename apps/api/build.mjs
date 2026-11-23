// Bundles the functions into Vercel's Build Output API layout:
//   .vercel/output/functions/api/turn.func/index.mjs
//   .vercel/output/functions/api/live-turn.func/index.mjs (streams its response)
//   .vercel/output/functions/api/analyse.func, show-me.func (after the call)
// One self-contained file, so workspace packages written in TypeScript and
// the eSpeak build inside `phonemizer` all come along without extra config.
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { build } from "esbuild";
import { writePhononBundle } from "./scripts/phonon-bundle.mjs";

const out = ".vercel/output";
const fn = `${out}/functions/api/turn.func`;
rmSync(out, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });

await build({
  entryPoints: ["src/node-handler.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: `${fn}/index.mjs`,
  // Some dependencies use require(); give ESM output a working one.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});

const config = { runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs", maxDuration: 30 };
writeFileSync(`${fn}/.vc-config.json`, JSON.stringify(config, null, 2));

// The same bundle serves the live turn; it routes on the path. Streaming lets
// the first sentence reach the phone before the brain has finished.
const live = `${out}/functions/api/live-turn.func`;
cpSync(fn, live, { recursive: true });
writeFileSync(`${live}/.vc-config.json`, JSON.stringify({ ...config, supportsResponseStreaming: true }, null, 2));
// Lessons take longer to write, so they get their own function with more time.
const lesson = `${out}/functions/api/lesson.func`;
cpSync(fn, lesson, { recursive: true });
writeFileSync(`${lesson}/.vc-config.json`, JSON.stringify({ ...config, maxDuration: 60 }, null, 2));
// One line spoken on its own (the call's opening question, a lesson bite).
const speak = `${out}/functions/api/speak.func`;
cpSync(fn, speak, { recursive: true });
// Teach me this thing: one photo in, what it is and Fenny's question out.
cpSync(fn, `${out}/functions/api/look.func`, { recursive: true });
// One scanned page of notes, read by a vision model. Handwriting can take a while.
const readPage = `${out}/functions/api/read-page.func`;
cpSync(fn, readPage, { recursive: true });
writeFileSync(`${readPage}/.vc-config.json`, JSON.stringify({ ...config, maxDuration: 60 }, null, 2));
// After the call: gap analysis and "Show me". Same bundle again.
for (const name of ["analyse", "show-me"]) cpSync(fn, `${out}/functions/api/${name}.func`, { recursive: true });
// The iPhone voice model, served as static files for the app to download.
if (process.env.SKIP_PHONON_BUNDLE !== "1") {
  const { out: dir, files } = await writePhononBundle(`${out}/static`);
  console.log(`Phonon bundle: ${files} files in ${dir}`);
}
writeFileSync(`${out}/config.json`, JSON.stringify({ version: 3 }, null, 2));
console.log(`Built ${fn} and ${live}`);
