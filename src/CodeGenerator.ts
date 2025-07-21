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
// @ts-ignore
import templatetxt from "./template.txt?raw"

export default class CodeGenerator {
    private readonly template: string;

    constructor() {
        this.template = templatetxt;
    }

    render(function_name: string, visitor: FileVisitor) {
        let text = this.template;
        text = text.replace("{{function}}", function_name);
        text = text.replace("{{options}}", this.options(visitor));
        text = text.replace("{{rules}}", this.rules(visitor));
        return text;
    }

    options(visitor: FileVisitor) {
        return Array.from(visitor.options)
            .map(([name, value]) => `${name} = ${value}`)
            .join(", ");
    }
    rules(visitor: FileVisitor) {
        const il = ' '.repeat(8);
        const is = ' '.repeat(4);

        let res = "[\n";
        res += visitor.rules
            .map(r => `${il}{"match": ${r.match}, "replace": "${r.replace}", "when": ${r.when}}`)
            .join(',\n');
        res += `\n${is}]`;

        return res;
    }
}
