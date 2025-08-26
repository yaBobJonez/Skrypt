// Copyright 2025 Mykhailo Stetsiuk
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import FileVisitor from "./FileVisitor.js";
import {type FunctionDef, Stage} from "./Structures.ts";

export default class CodeGenerator {
    render(visitor: FileVisitor) {
        let result = `import {collectMatches, buildString} from "./Skrypt.js"\n`;
        for (const func of visitor.functions) {
            if (func.isEmpty()) continue;
            result += `\nexport function ${func.name}(text${this.options(func)}) {\n`;
            result += `\tlet rules, slots;\n`;
            for (const stage of func.stages) {
                if (stage.isEmpty()) continue;
                if (stage.rules.length === 1) {
                    const r = stage.rules[0];
                    if (r.when !== true)
                        result += `\tif (${r.when})\n\t`;
                    result += `\ttext = text.replace(${r.match}, "${JSON.stringify(r.replace).slice(1, -1)}");\n`;
                    continue;
                }
                result += `\trules = ${this.rules(stage)};\n`;
                result += `\trules = rules.filter(r => r.when);\n`;
                result += `\tslots = collectMatches(text, rules);\n`;
                result += `\ttext = buildString(text, slots);\n`;
            }
            result += `\treturn text;\n`;
            result += `}\n`;
        }
        return result;
    }

    options(func: FunctionDef) {
        return Array.from(func.options)
            .map(([name, value]) => `, ${name} = ${value}`)
            .join('');
    }
    rules(stage: Stage) {
        let res = "[\n";
        res += stage.rules
            .map(r => `\t\t{"match": ${r.match}, "replace": "${JSON.stringify(r.replace).slice(1, -1)}", "when": ${r.when}}`)
            .join(',\n');
        res += `\n\t]`;
        return res;
    }
}
