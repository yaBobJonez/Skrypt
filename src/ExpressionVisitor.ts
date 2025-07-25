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
import {
    NotContext,
    GroupContext,
    OrContext,
    OrGroupContext,
    QuantificationContext,
    SubstitutionContext,
    LhsStringContext,
    NothingContext,
    RhsStringContext,
    AnyLetterContext,
    LhsContext,
    SkryptParser,
    ExprContext,
    Lhs_charsContext,
    Rhs_charsContext,
    PatternContext, TermContext, TermsContext
} from "../lib/SkryptParser.js";

export default class ExpressionVisitor extends SkryptParserVisitor<string> {
    templates = new Map<string, ExprContext>();

    collectChars = (ctx: Lhs_charsContext): string[] =>
        ctx.Lhs_CHAR().map(c => {
            const text = c.getText();
            if (/^\\[^urntvdDsS0(){}[\]|/?+*\-\\]$/.test(text)) return text.slice(1);
            if (/^[.\-^$]$/.test(text)) return `\\${text}`;
            return text;
        });
    visitLhs_chars = (ctx: Lhs_charsContext) =>
        this.collectChars(ctx).join('');

    visitRhs_chars = (ctx: Rhs_charsContext) => {
        return ctx.Rhs_CHAR().map(c => {
            const text = c.getText();
            if (/^\\u[0-9a-fA-F]{4}$/.test(text))
                return String.fromCharCode(parseInt(text.slice(2), 16));
            if (text === "\\r") return "\r";
            if (text === "\\n") return "\n";
            if (text === "\\t") return "\t";
            if (text === "\\0") return "\0";
            if (text === "\\\\") return "\\";
            if (/^\\/.test(text)) return text.slice(1);
            return text;
        }).join('');
    }

    visitLhs = (ctx: LhsContext) =>
        ctx.pattern().map(e => this.visit(e)).join('|');

    visitPattern = (ctx: PatternContext) => {
        let match = "";
        if (ctx._pre) match += `(?<=`;
        if (ctx._start) match += `(?<!${this.getAnyLetter()})`;
        if (ctx._pre) match += `${this.visit(ctx._pre)})`;
        match += this.visit(ctx._inner!);
        if (ctx._post) match += `(?=${this.visit(ctx._post)}`;
        if (ctx._end) match += `(?!${this.getAnyLetter()})`;
        if (ctx._post) match += `)`;
        return match;
    }

    visitTerms = (ctx: TermsContext) =>
        ctx.term().map(t => this.visit(t)).join('');

    visitOr = (ctx: OrContext) => {
        const charset = this.collectCharsetExpr(ctx);
        if (charset)
            return `[${this.buildSet(charset)}]` ;
        if (ctx.parent instanceof OrContext || ctx.parent instanceof GroupContext)
            return `${this.visit(ctx._l!)}|${this.visit(ctx._r!)}` ;
        else
            return `(?:${this.visit(ctx._l!)}|${this.visit(ctx._r!)})` ;
    }

    visitGroup = (ctx: GroupContext) =>
        `(?:${this.visit(ctx.expr())})` ;

    negateExpr = (c: ExprContext): string => {
        if (c instanceof TermsContext)
            return c.term().map(t => this.negateTerm(t)).join('');
        if (c instanceof OrContext) {
            const charset = this.collectCharsetExpr(c);
            if (charset)
                return `[^${this.buildSet(charset)}]` ;
            if (c.parent instanceof OrContext || c.parent instanceof GroupContext)
                return `${this.negateExpr(c._l!)}|${this.negateExpr(c._r!)}` ;
            else
                return `(?:${this.negateExpr(c._l!)}|${this.negateExpr(c._r!)})` ;
        }
        throw new Error(`Negating ${c.getText()} is unsupported.`);
    }
    negateTerm = (c: TermContext): string => {
        if (c instanceof GroupContext)
            return `(?:${this.negateExpr(c.expr())})`;
        if (c instanceof NotContext)
            return this.visit(c.term())!;
        if (c instanceof OrGroupContext)
            return `[^${this.buildSet(this.collectCharsetTerm(c)!)}]`;
        if (c instanceof SubstitutionContext) {
            const template = this.getTemplate(c);
            return this.negateExpr(template);
        }
        if (c instanceof AnyLetterContext) {
            if (this.templates.has("letters")) {
                const letters = this.templates.get("letters")!;
                return this.negateExpr(letters);
            } else return "\\P{L}";
        }
        if (c instanceof LhsStringContext)
            return [...this.visit(c)!].map(ch => `[^${ch}]`).join('');
        throw new Error(`Negating ${c.getText()} is unsupported.`);
    };
    visitNot = (ctx: NotContext) =>
        this.negateTerm(ctx.term());

    visitQuantification = (ctx: QuantificationContext) => {
        let op = {
            [SkryptParser.QUESTION]: '?',
            [SkryptParser.PLUS]: '+',
            [SkryptParser.ASTERISK]: '*'
        }[ctx._q?.type ?? -1] ?? '';
        if (ctx.term() instanceof QuantificationContext)
            return this.visit(ctx.term()) + op;
        else
            return `(?:${this.visit(ctx.term())})${op}`;
    }

    collectCharsetExpr = (ctx: ExprContext): Set<string> | null => {
        if (ctx instanceof TermsContext && ctx.term().length === 1)
            return this.collectCharsetTerm(ctx.term()[0]);
        if (ctx instanceof OrContext) {
            const left = this.collectCharsetExpr(ctx._l!);
            const right = this.collectCharsetExpr(ctx._r!);
            if (left && right) return left.union(right);
        }
        return null;
    }
    collectCharsetTerm = (ctx: TermContext): Set<string> | null => {
        if (ctx instanceof GroupContext)
            return this.collectCharsetExpr(ctx.expr());
        if (ctx instanceof OrGroupContext)
            return new Set(this.collectChars(ctx.lhs_chars()));
        if (ctx instanceof LhsStringContext && ctx.lhs_chars().Lhs_CHAR().length === 1)
            return new Set([this.visit(ctx)!]);
        if (ctx instanceof SubstitutionContext)
            return this.collectCharsetExpr(this.getTemplate(ctx));
        return null;
    }
    buildSet = (set: Set<string>) =>
        Array.from(set).join('');

    visitOrGroup = (ctx: OrGroupContext) =>
        `[${this.buildSet(this.collectCharsetTerm(ctx)!)}]` ;

    getTemplate = (ctx: SubstitutionContext): ExprContext => {
        const name = this.visit(ctx.lhs_chars())!;
        if (this.templates.has(name)) return this.templates.get(name)!;
        else throw new Error(`Template ${name} is not defined.`);
    }
    visitSubstitution = (ctx: SubstitutionContext) =>
        this.visit(this.getTemplate(ctx))!;

    getAnyLetter = () =>
        this.templates.has("letters")
            ? this.visit(this.templates.get("letters")!)!
            : "\\p{L}" ;
    visitAnyLetter = (ctx: AnyLetterContext) =>
        this.getAnyLetter();

    visitLhsString = (ctx: LhsStringContext) =>
        this.visit(ctx.lhs_chars())!;

    visitNothing = (ctx: NothingContext) =>
        "";

    visitRhsString = (ctx: RhsStringContext) =>
        this.visit(ctx.rhs_chars())!;
}
