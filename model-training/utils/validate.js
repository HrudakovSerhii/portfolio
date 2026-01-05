import fs from 'fs';
import readline from 'readline';

// CONFIGURATION: Ensure this matches your data filename
const FILENAME = 'training-set.jsonl';

async function validateData() {
    console.log(`Reading file: ${FILENAME}...`);

    if (!fs.existsSync(FILENAME)) {
        console.error(`❌ Error: File '${FILENAME}' not found.`);
        process.exit(1);
    }

    const fileStream = fs.createReadStream(FILENAME);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let lineNum = 0;
    const stats = { HR: 0, Engineer: 0, Friend: 0, Total: 0 };
    const errors = [];
    const uniqueResponses = new Set(); // To check for duplicates

    for await (const line of rl) {
        lineNum++;
        if (!line.trim()) continue; // Skip empty whitespace lines

        try {
            const data = JSON.parse(line);
            stats.Total++;

            // CHECK 1: Structure (Must have 'messages' array of length 3)
            if (!data.messages || !Array.isArray(data.messages)) {
                errors.push(`Line ${lineNum}: Missing 'messages' array.`);
                continue;
            }
            if (data.messages.length !== 3) {
                errors.push(`Line ${lineNum}: Invalid message count (Found: ${data.messages.length}, Expected: 3).`);
            }

            // CHECK 2: Role Distribution (Based on System Prompt)
            const systemContent = data.messages[0].content || "";
            if (systemContent.includes("Recruiter")) {
                stats.HR++;
            } else if (systemContent.includes("Senior Engineer")) {
                stats.Engineer++;
            } else if (systemContent.includes("Friend")) {
                stats.Friend++;
            } else {
                errors.push(`Line ${lineNum}: System prompt does not match known personas.`);
            }

            // CHECK 3: Duplicate Detection (Based on the first 50 chars of the answer)
            const assistantResponse = data.messages[2].content || "";
            const fingerprint = assistantResponse.substring(0, 50);

            if (uniqueResponses.has(fingerprint)) {
                // Warning only, usually doesn't break training but causes overfitting
                console.warn(`⚠️  Line ${lineNum}: Potential duplicate answer detected starting with: "${fingerprint}..."`);
            } else {
                uniqueResponses.add(fingerprint);
            }

        } catch (error) {
            errors.push(`Line ${lineNum}: Invalid JSON syntax.`);
        }
    }

    // --- REPORTING ---
    console.log(`\n====== VALIDATION REPORT ======`);
    console.log(`Total Entries: ${stats.Total}`);
    console.log(`-----------------------------`);
    console.log(`Distribution:`);
    console.log(`  - HR (Recruiter):  ${stats.HR} (${((stats.HR / stats.Total) * 100).toFixed(1)}%)`);
    console.log(`  - Senior Engineer: ${stats.Engineer} (${((stats.Engineer / stats.Total) * 100).toFixed(1)}%)`);
    console.log(`  - Friend:          ${stats.Friend} (${((stats.Friend / stats.Total) * 100).toFixed(1)}%)`);
    console.log(`-----------------------------`);

    if (errors.length > 0) {
        console.error(`❌ FAILED: Found ${errors.length} critical errors.`);
        errors.forEach(err => console.error(err));
        process.exit(1);
    } else {
        console.log(`✅ SUCCESS: Data is valid and ready for fine-tuning.`);
        process.exit(0);
    }
}

validateData().catch(err => console.error(err));
