/**
 * Répartit les bonnes réponses sur les 4 positions dans les fichiers de données gamer.
 * Usage : node scripts/randomize-gamer-answers.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = ["gamer-quizzes-data.js", "gamer-games-extra.js", "gamer-wat-data.js"];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomizeQuestionBlock(block) {
  const optionsMatch = block.match(/options:\s*(\[[\s\S]*?\]),\s*correct:\s*(\d+)/);
  if (!optionsMatch) return block;

  let options;
  try {
    options = Function(`"use strict"; return (${optionsMatch[1]});`)();
  } catch {
    return block;
  }
  if (!Array.isArray(options) || options.length < 2) return block;

  const correctIdx = parseInt(optionsMatch[2], 10) || 0;
  const pairs = options.map((opt, i) => ({ opt, isCorrect: i === correctIdx }));
  const shuffled = shuffle(pairs);
  const newOptions = shuffled.map((p) => p.opt);
  const newCorrect = shuffled.findIndex((p) => p.isCorrect);

  const newOptionsStr = `[${newOptions.map((o) => JSON.stringify(o)).join(", ")}]`;
  return block.replace(
    /options:\s*\[[\s\S]*?\],\s*correct:\s*\d+/,
    `options: ${newOptionsStr}, correct: ${newCorrect}`
  );
}

let total = 0;
for (const file of files) {
  const path = join(root, file);
  let content = readFileSync(path, "utf8");
  const parts = content.split(/(\{ text:)/);
  let out = parts[0];
  for (let i = 1; i < parts.length; i += 2) {
    const marker = parts[i];
    let block = marker + parts[i + 1];
    const end = block.indexOf("},");
    if (end === -1) {
      out += block;
      continue;
    }
    const questionBlock = block.slice(0, end + 1);
    const rest = block.slice(end + 1);
    const updated = randomizeQuestionBlock(questionBlock);
    if (updated !== questionBlock) total += 1;
    out += updated + rest;
  }
  writeFileSync(path, out, "utf8");
  console.log(`OK ${file}`);
}
console.log(`Questions mélangées dans les données : ${total}`);
