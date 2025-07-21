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

import {SkryptParserVisitor} from "../lib/SkryptParserVisitor.js";
import {FileContext, OptionContext, RuleTrContext, TemplateContext} from "../lib/SkryptParser.js";
import ExpressionVisitor from "./ExpressionVisitor.js";

export interface Rule {
    match: RegExp;
    replace: string;
    when: string | boolean;
}

export default class FileVisitor extends SkryptParserVisitor<void> {
    options = new Map<string, string>();
    rules: Rule[] = [];

    private exprVisitor = new ExpressionVisitor();

    visitFile = (ctx: FileContext) => {
        for (const c of ctx.children ?? []) this.visit(c);
    }

    visitOption = (ctx: OptionContext) => {
        const key = this.exprVisitor.visit(ctx._name!)!;
        const value = this.exprVisitor.visit(ctx._value!)!;
        this.options.set(key, value);
    }

    visitTemplate = (ctx: TemplateContext) => {
        const key = this.exprVisitor.visit(ctx._name!)!;
        const value = ctx._value!;
        this.exprVisitor.templates.set(key, value);
    }

    visitRuleTr = (ctx: RuleTrContext) => {
        const match = new RegExp( this.exprVisitor.visit(ctx.lhs())! , "giu");
        const replace = this.exprVisitor.visit(ctx.rhs())!;
        const when = ctx._when? this.exprVisitor.visit(ctx._when)! : true;

        this.rules.push({match, replace, when});
    }
}
