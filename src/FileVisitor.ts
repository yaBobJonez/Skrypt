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
//
// noinspection JSUnusedGlobalSymbols

import {SkryptParserVisitor} from "../lib/SkryptParserVisitor.js";
import {
    FileContext,
    LineContext,
    OptionContext,
    RuleTrContext,
    TemplateContext,
    DirectiveContext,
    BlockContext
} from "../lib/SkryptParser.js";
import ExpressionVisitor from "./ExpressionVisitor.js";
import {FunctionDef} from "./Structures.ts";
import {ParserRuleContext} from "antlr4ng";

export default class FileVisitor extends SkryptParserVisitor<void> {
    functions = [new FunctionDef("transform")];
    blockOptions: string[] = [];

    private exprVisitor;
    private readonly onError;
    private flags = "giu";

    constructor(handler: (line: number, column: number, msg: string) => void) {
        super();
        this.onError = handler;
        this.exprVisitor = new ExpressionVisitor(handler);
    }
    currFunc = () => this.functions[this.functions.length - 1]!;
    error = (ctx: ParserRuleContext, msg: string) =>
        this.onError(ctx.start!.line, ctx.start!.column, msg);

    visitFile = (ctx: FileContext) => {
        for (const line of ctx.line()) this.visit(line);
    }
    visitLine = (ctx: LineContext) => {
        if (ctx.statement()) this.visit(ctx.statement()!);
    }

    visitDirective = (ctx: DirectiveContext) => {
        const name = this.exprVisitor.visit(ctx._name!)!;
        const values = ctx._values.map(v => this.exprVisitor.visit(v)!);
        if (/case[- ]?sensitive/.test(name))
            this.flags = "gu";
        else if (/case[- ]?insensitive/.test(name))
            this.flags = "giu";
        else if (name === "function") {
            if (values.length < 1) { this.error(ctx, `Function directive expects function name`); return; }
            if (this.currFunc().isEmpty())
                this.functions.pop();
            this.functions.push(new FunctionDef(values[0]));
            this.exprVisitor.templates.clear();
        }
        else if (name === "stage")
            this.currFunc().newStage();
        else this.error(ctx, `Unsupported directive: ${name}\n`);
    }

    visitOption = (ctx: OptionContext) => {
        const key = this.exprVisitor.visit(ctx._name!)!;
        const value = this.exprVisitor.visit(ctx._value!)!;
        this.currFunc().options.set(key, value);
    }

    visitTemplate = (ctx: TemplateContext) => {
        const key = this.exprVisitor.visit(ctx._name!)!;
        const value = ctx._value!;
        this.exprVisitor.templates.set(key, value);
    }

    visitRuleTr = (ctx: RuleTrContext) => {
        const match = new RegExp( this.exprVisitor.visit(ctx.lhs())! , this.flags);
        const replace = this.exprVisitor.visit(ctx.rhs())!;
        const whenClauses = [...this.blockOptions];
        if (ctx.when())
            whenClauses.push(this.exprVisitor.visit(ctx.when()!)!);
        const when = whenClauses.join(' && ') || true;
        this.currFunc().addRule({match, replace, when});
    }

    visitBlock = (ctx: BlockContext) => {
        if (ctx.when()) this.blockOptions.push(this.exprVisitor.visit(ctx.when()!)!);
        if (ctx.expr()) this.exprVisitor.blockExpr.push(ctx.expr()!);
        for (const line of ctx.line()) this.visit(line);
        if (ctx.expr()) this.exprVisitor.blockExpr.pop();
        if (ctx.when()) this.blockOptions.pop();
    }
}
