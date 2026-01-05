#!/usr/bin/env node

import fs from 'fs';

const readFile = (path) => fs.readFileSync(path, 'utf8');

const writeFile = (path, content) => fs.writeFileSync(path, content, 'utf8');

const parseJSON = (content) => {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
};

const extractJSONObjects = (content) => {
  const objects = [];
  let depth = 0;
  let startIndex = null;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') {
        if (depth === 0) startIndex = i;
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0 && startIndex !== null) {
          const jsonStr = content.substring(startIndex, i + 1);
          const obj = parseJSON(jsonStr);
          if (obj) objects.push(obj);
          startIndex = null;
        }
      }
    }
  }

  return objects;
};

const parseContent = (content) => {
  const parsed = parseJSON(content);
  return Array.isArray(parsed) ? parsed : extractJSONObjects(content);
};

const validateDPOObject = (obj) => {
  return obj.prompt && obj.chosen && obj.rejected;
};

const filterValidObjects = (objects) => {
  return objects.filter(validateDPOObject);
};

const convertToJSONL = (objects) => {
  return objects.map(obj => JSON.stringify(obj)).join('\n');
};

const getFileSize = (path) => {
  return fs.statSync(path).size;
};

const formatBytes = (bytes) => {
  return (bytes / 1024).toFixed(2);
};

const calculateStats = (inputPath, outputPath, objectCount) => {
  const inputSize = getFileSize(inputPath);
  const outputSize = getFileSize(outputPath);
  const savedPercent = (((inputSize - outputSize) / inputSize) * 100).toFixed(1);

  return {
    objects: objectCount,
    inputSize: formatBytes(inputSize),
    outputSize: formatBytes(outputSize),
    saved: savedPercent
  };
};

const printStats = (stats) => {
  console.log(`Objects: ${stats.objects}`);
  console.log(`Input: ${stats.inputSize} KB`);
  console.log(`Output: ${stats.outputSize} KB`);
  console.log(`Saved: ${stats.saved}%`);
};

const main = () => {
  const [inputPath, outputPath] = process.argv.slice(2);

  if (!inputPath) {
    console.error('Usage: node fix-dpo-format.js <input> [output]');
    process.exit(1);
  }

  const output = outputPath || inputPath;
  const content = readFile(inputPath);
  const objects = parseContent(content);
  const validObjects = filterValidObjects(objects);
  const jsonl = convertToJSONL(validObjects);

  writeFile(output, jsonl);

  const stats = calculateStats(inputPath, output, validObjects.length);
  printStats(stats);
};

main();
