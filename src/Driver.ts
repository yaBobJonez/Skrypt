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
    for (const stage of func.stages) {
        if (stage.isEmpty()) continue;
        const options = func.options;
        const rules = stage.rules.filter(r => {
            const result = new Function(
                ...options.keys(),
                "return " + (r.when?.toRegex() ?? "true")
            )(...options.values());
            if (result === "false") return false;
            return Boolean(result);
        });
        const slots = collectMatches(text, rules);
        text = buildString(text, slots);
    }
    return text;
}
