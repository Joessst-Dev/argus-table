#!/usr/bin/env node
// Turns a theme draft (JSON) into a link that opens the argus-table theme
// creator with it, or reads a link back into a draft.
//
//   node theme-link.mjs draft.json            print the link
//   node theme-link.mjs - < draft.json        read the draft from stdin
//   node theme-link.mjs draft.json --base-url http://localhost:6006/
//   node theme-link.mjs --decode '<link>'     print the draft in a link
//
// Problems with the draft go to stderr and exit with 1; warnings go to
// stderr too, the link alone to stdout.
import { readFile } from 'node:fs/promises';
import { decodeLink, themeLink, validateDraft } from './draft.mjs';

const USAGE = `Usage:
  node theme-link.mjs <draft.json | -> [--base-url <storybook url>]
  node theme-link.mjs --decode <link>`;

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function main(args) {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return args.length === 0 ? 1 : 0;
  }

  const decodeAt = args.indexOf('--decode');
  if (decodeAt !== -1) {
    const link = args[decodeAt + 1];
    const draft = link ? await decodeLink(link) : undefined;
    if (!draft) {
      console.error('No theme draft could be read from that link.');
      return 1;
    }
    // A draft on a preset leaves its base out; one on imported CSS keeps it.
    console.log(JSON.stringify(draft, null, 2));
    return 0;
  }

  const baseAt = args.indexOf('--base-url');
  const baseUrl = baseAt === -1 ? undefined : args[baseAt + 1];
  if (baseAt !== -1 && !baseUrl) {
    console.error('--base-url needs a URL.');
    return 1;
  }
  const file = args.find((a, i) => !a.startsWith('--') && (baseAt === -1 || i !== baseAt + 1));
  if (!file) {
    console.error(USAGE);
    return 1;
  }

  let input;
  try {
    input = JSON.parse(file === '-' ? await readStdin() : await readFile(file, 'utf8'));
  } catch (error) {
    console.error(
      `Couldn't read the draft: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }

  const { draft, errors, warnings } = validateDraft(input);
  for (const warning of warnings) console.error(`warning: ${warning}`);
  if (!draft) {
    console.error(`The draft has ${String(errors.length)} problem(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    return 1;
  }
  console.log(await themeLink(draft, baseUrl));
  return 0;
}

process.exitCode = await main(process.argv.slice(2));
