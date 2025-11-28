import fs from 'fs';
import path from 'path';
import { describe, test, expect } from "vitest";
import {parseRules, transformText} from "../src/Driver.ts";

const rulesDir = path.join(__dirname, '../examples');
const inputDir = path.join(__dirname, 'inputs');
const outputDir = path.join(__dirname, 'outputs');

describe('Transformation tests', () => {
    const filenames = fs.readdirSync(inputDir).filter(file => file.endsWith('.txt'));
    filenames.forEach(name => {
        name = name.replace(/\.txt$/, '');

        test(name, async () => {
            const inputText = fs.readFileSync(path.join(inputDir, `${name}.txt`), 'utf-8');
            const expectedOutput = fs.readFileSync(path.join(outputDir, `${name}.txt`), 'utf-8');

            const skryptFile = fs.readFileSync(path.join(rulesDir, `${name}.skrypt`), 'utf-8');
            const functions = parseRules(skryptFile);
            if (functions.length === 0)
                throw new Error(`No functions parsed from ${name}.skrypt`);
            const factualOutput = transformText(functions[0], inputText);

            expect(factualOutput).toBe(expectedOutput);
        });

    });
});
