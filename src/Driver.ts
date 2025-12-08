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

import {BaseErrorListener, CharStream, CommonTokenStream} from "antlr4ng";
import {SkryptLexer} from "../lib/SkryptLexer.ts";
import {SkryptParser} from "../lib/SkryptParser.ts";
import FileVisitor from "./FileVisitor.ts";
import type {FunctionDef} from "./Structures.ts";
// @ts-ignore
import {buildString, collectMatches} from "../public/Skrypt.js";

export function parseRules(
    code: string,
    errorListener: BaseErrorListener | null = null,
    handler: (line: number, column: number, msg: string) => void = () => {}
) {
    const chars = CharStream.fromString(code);
    const lexer = new SkryptLexer(chars);
    const tokens = new CommonTokenStream(lexer);
    const parser = new SkryptParser(tokens);

    if (errorListener !== null) {
        lexer.removeErrorListeners();
        parser.removeErrorListeners();
        lexer.addErrorListener(errorListener);
        parser.addErrorListener(errorListener);
    }

    const tree = parser.file();
    const visitor = new FileVisitor(handler);
    visitor.visit(tree);
    return visitor.functions;
}

export function transformText(func: FunctionDef, text: string) {
    for (const stage of func.stages) {
        if (stage.isEmpty()) continue;
        const options = func.options;
        const rules = stage.rules.filter(r => {
            if (typeof r.when === "boolean")
                return r.when;
            const evaluator = new Function(...options.keys(), "return " + r.when);
            const result = evaluator(...options.values());
            if (result === "false") return false;
            return Boolean(result);
        });
        const slots = collectMatches(text, rules);
        text = buildString(text, slots);
    }
    return text;
}
