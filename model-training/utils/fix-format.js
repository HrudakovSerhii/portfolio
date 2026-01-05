#!/usr/bin/env node

/**
 * JSONL Format Fixer
 *
 * Converts pretty-printed JSON objects to proper JSONL format.
 * Each training example should be on a single line for model training.
 *
 * Usage:
 *   node fix-jsonl-format.js input.jsonl output.jsonl
 *   node fix-jsonl-format.js input.jsonl (overwrites input file)
 */
import fs from 'fs';

// Get command line arguments
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
JSONL Format Fixer
==================

Converts pretty-printed JSON objects to proper JSONL format for model training.

Usage:
  node fix-jsonl-format.js <input-file> [output-file]

Arguments:
  input-file   Path to the input file with pretty-printed JSON objects
  output-file  (Optional) Path to the output file. If not provided, overwrites input file.

Options:
  --help, -h   Show this help message
  --validate   Validate the output after conversion

Examples:
  node fix-jsonl-format.js training-data.jsonl
  node fix-jsonl-format.js input.jsonl output.jsonl
  node fix-jsonl-format.js data.jsonl --validate
`);
    process.exit(0);
}

const inputFile = args[0];
const shouldValidate = args.includes('--validate');
const outputFile = args[1] && !args[1].startsWith('--') ? args[1] : inputFile;

// Validate input file exists
if (!fs.existsSync(inputFile)) {
    console.error(`❌ Error: Input file "${inputFile}" does not exist.`);
    process.exit(1);
}

console.log('🔧 JSONL Format Fixer');
console.log('=====================\n');
console.log(`📁 Input:  ${inputFile}`);
console.log(`📁 Output: ${outputFile}`);
if (outputFile === inputFile) {
    console.log('⚠️  Warning: Will overwrite input file\n');
} else {
    console.log('');
}

try {
    // Read the input file
    console.log('📖 Reading input file...');
    const content = fs.readFileSync(inputFile, 'utf8');

    // Parse JSON objects by matching brace depth
    console.log('🔍 Parsing JSON objects...');
    const objects = [];
    let depth = 0;
    let startIndex = null;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];

        // Handle string escape sequences
        if (escapeNext) {
            escapeNext = false;
            continue;
        }

        if (char === '\\') {
            escapeNext = true;
            continue;
        }

        // Track if we're inside a string
        if (char === '"') {
            inString = !inString;
            continue;
        }

        // Only count braces outside of strings
        if (!inString) {
            if (char === '{') {
                if (depth === 0) {
                    startIndex = i;
                }
                depth++;
            } else if (char === '}') {
                depth--;
                if (depth === 0 && startIndex !== null) {
                    // Extract and parse the complete JSON object
                    const jsonStr = content.substring(startIndex, i + 1);
                    try {
                        const obj = JSON.parse(jsonStr);
                        objects.push(obj);
                    } catch (e) {
                        console.error(`⚠️  Warning: Failed to parse object at position ${startIndex}: ${e.message}`);
                    }
                    startIndex = null;
                }
            }
        }
    }

    console.log(`✅ Found ${objects.length} JSON objects\n`);

    // Validate structure
    console.log('🔍 Validating structure...');
    let validCount = 0;
    let invalidCount = 0;

    objects.forEach((obj, index) => {
        if (!obj.messages || !Array.isArray(obj.messages)) {
            console.error(`⚠️  Object ${index + 1}: Missing or invalid 'messages' array`);
            invalidCount++;
        } else {
            const hasSystem = obj.messages.some(m => m.role === 'system');
            const hasUser = obj.messages.some(m => m.role === 'user');
            const hasAssistant = obj.messages.some(m => m.role === 'assistant');

            if (!hasSystem || !hasUser || !hasAssistant) {
                console.error(`⚠️  Object ${index + 1}: Missing required roles (system/user/assistant)`);
                invalidCount++;
            } else {
                validCount++;
            }
        }
    });

    console.log(`✅ Valid objects: ${validCount}`);
    if (invalidCount > 0) {
        console.log(`⚠️  Invalid objects: ${invalidCount}`);
    }
    console.log('');

    // Convert to JSONL format (one JSON object per line)
    console.log('📝 Converting to JSONL format...');
    const jsonlContent = objects.map(obj => JSON.stringify(obj)).join('\n');

    // Write output file
    console.log(`💾 Writing to ${outputFile}...`);
    fs.writeFileSync(outputFile, jsonlContent, 'utf8');

    // Get file stats
    const inputStats = fs.statSync(inputFile);
    const outputStats = fs.statSync(outputFile);

    console.log('\n✅ Conversion complete!\n');
    console.log('📊 Statistics:');
    console.log(`   Objects processed: ${objects.length}`);
    console.log(`   Input file size:   ${(inputStats.size / 1024).toFixed(2)} KB`);
    console.log(`   Output file size:  ${(outputStats.size / 1024).toFixed(2)} KB`);
    console.log(`   Space saved:       ${(((inputStats.size - outputStats.size) / inputStats.size) * 100).toFixed(1)}%`);

    // Validate output if requested
    if (shouldValidate) {
        console.log('\n🔍 Validating output file...');
        const outputContent = fs.readFileSync(outputFile, 'utf8');
        const lines = outputContent.split('\n').filter(line => line.trim());

        let parseErrors = 0;
        lines.forEach((line, index) => {
            try {
                JSON.parse(line);
            } catch (e) {
                console.error(`⚠️  Line ${index + 1}: Parse error - ${e.message}`);
                parseErrors++;
            }
        });

        if (parseErrors === 0) {
            console.log(`✅ All ${lines.length} lines are valid JSON`);
        } else {
            console.log(`⚠️  ${parseErrors} lines have parse errors`);
        }
    }

    console.log('\n✨ Done! Your file is now ready for model training.');

} catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
}
