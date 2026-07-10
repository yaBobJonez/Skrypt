// Copyright 2025–2026 Mykhailo Stetsiuk
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

import {CharStream, CommonTokenStream} from "antlr4ng";
import {SkryptLexer} from "../lib/SkryptLexer.ts";
import {SkryptParser} from "../lib/SkryptParser.ts";
// @ts-ignore
import {buildString, collectMatches} from "../public/Skrypt.js";
import type {FunctionDef} from "./ast/Structure.ts";
import ASTBuilder from "./ast/ASTBuilder.ts";
import EchoErrorListener, {SemanticError} from "./ErrorHandling.ts";

export function parseRules(
    code: string,
    errorListener: EchoErrorListener | null = null
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
    const visitor = new ASTBuilder();
    try {
        visitor.visit(tree);
        return visitor.functions;
    } catch (e: unknown) {
        if (e instanceof SemanticError)
            errorListener?.semanticError(e.start.line, e.start.start, e.end.stop, e.message);
        return [];
    }
}

export function transformText(func: FunctionDef, text: string) {
    const params = func.options.keys().toArray();
    const args = func.options.values().map(v => {
        if (v === "true") return true;
        if (v === "false") return false;
        if (!isNaN(Number(v))) return Number(v);
        return v;
    }).toArray();
    for (const stage of func.stages) {
        if (stage.isEmpty()) continue;
        const rules = stage.rules.filter(r => {
            const body = `return ${r.when?.toRegex() ?? "true"};`;
            const f = new Function(...params, body);
            return Boolean(f(...args));
        });
        const slots = collectMatches(text, rules);
        text = buildString(text, slots);
    }
    return text;
}
