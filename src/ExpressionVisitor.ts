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
// noinspection JSUnusedGlobalSymbols,JSUnusedLocalSymbols

import {SkryptParserVisitor} from "../lib/SkryptParserVisitor.js";
import {
    AnyLetterContext,
    ExprContext,
    GroupContext,
    Lhs_charsContext,
    LhsRawStringContext,
    LhsStringContext,
    LhsCharsContext,
    LhsContext,
    NumberContext,
    LookaroundContext,
    NotContext,
    NothingContext,
    OrContext,
    OrGroupContext,
    DifferenceContext,
    PatternContext,
    QuantificationContext,
    QuantSimpleContext,
    QuantNtoMContext,
    QuantNOrMoreContext,
    QuantExactlyNContext,
    Rhs_charsContext,
    RhsRawStringContext,
    RhsStringContext,
    RhsCharsContext,
    SubstitutionContext,
    AnchorContext,
    TermContext,
    TermsContext,
    WhenGroupContext,
    WhenNotContext,
    WhenComparisonContext,
    WhenEqualityContext,
    WhenAndContext,
    WhenOrContext,
    WhenCharsContext
} from "../lib/SkryptParser.js";
import {ParserRuleContext, Token} from "antlr4ng";

export default class ExpressionVisitor extends SkryptParserVisitor<string> {
    templates = new Map<string, ExprContext>();
    blockExpr: ExprContext[] = [];

    private readonly onError;

    constructor(handler: (line: number, column: number, msg: string) => void) {
        super();
        this.onError = handler;
    }
    error = (ctx: ParserRuleContext, msg: string) => {
        this.onError(ctx.start!.line, ctx.start!.column, msg);
        return "!PARSE ERROR!";
    }

    collectLhsString = (tokens: Token[]) =>
        tokens.map(t => {
            const text = t.text!;
            if (/^\\u[0-9a-fA-F]{4}$/.test(text)) return text;
            if (/^\\[^rntvdDsS0^$.(){}[\]|/?+*\\]$/.test(text)) return text.slice(1);
            return text;
        });
    renderChar = (text: string) => {
        if (/^\\u[0-9a-fA-F]{4}$/.test(text))
            return String.fromCharCode(parseInt(text.slice(2), 16));
        if (text === "\\r") return "\r";
        if (text === "\\n") return "\n";
        if (text === "\\t") return "\t";
        if (text === "\\0") return "\0";
        if (text === "\\\\") return "\\";
        if (/^\\/.test(text)) return text.slice(1);
        return text;
    }
    collectChars = (ctx: Lhs_charsContext | Rhs_charsContext) => {
        if (ctx instanceof LhsRawStringContext) {
            return ctx.String_CHAR().map(t => {
                const text = t.getText();
                if (/^\\[rnt]$/.test(text)) return text;
                if (text === "\\`") return text.slice(1);
                if (/^[.^$(){}[\]|/?+*\\]$/.test(text)) return `\\${text}`;
                return text;
            });
        } else if (ctx instanceof LhsStringContext) {
            return this.collectLhsString(ctx._chars);
        } else if (ctx instanceof RhsRawStringContext) {
            return ctx.String_CHAR().map(t => {
                const text = t.getText();
                if (text === "\\r") return "\r";
                if (text === "\\n") return "\n";
                if (text === "\\t") return "\t";
                if (text === "\\`") return text.slice(1);
                return text;
            });
        } else if (ctx instanceof RhsStringContext) {
            return ctx.Rhs_CHAR().map(t => this.renderChar(t.getText()));
        } else return [];
    }
    visitLhsRawString = (ctx: LhsRawStringContext) =>
        this.collectChars(ctx).join('');
    visitLhsString = (ctx: LhsStringContext) =>
        this.collectChars(ctx).join('');
    visitRhsRawString = (ctx: RhsRawStringContext) =>
        this.collectChars(ctx).join('');
    visitRhsString = (ctx: RhsStringContext) =>
        this.collectChars(ctx).join('');
    visitNumber = (ctx: NumberContext) =>
        ctx.getText();

    visitLhs = (ctx: LhsContext) =>
        ctx.pattern().map(e => this.visit(e)).join('|');

    visitPattern = (ctx: PatternContext) => {
        let match = "";
        if (ctx._behind.length > 0)
            match += `(?<=${ ctx._behind.map(e => this.visit(e)).join('') })`;
        match += this.visit(ctx._inner!);
        if (ctx._ahead.length > 0)
            match += `(?=${ ctx._ahead.map(e => this.visit(e)).join('') })`;
        return match;
    }
    visitLookaround = (ctx: LookaroundContext) => {
        if (ctx.SLASH()) {
            if (this.templates.has("letters"))
                return this.negateExpr(this.templates.get("letters")!);
            else return "\\P{L}";
        } else return this.visit(ctx.expr()!)!;
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
        return this.error(c, `Negating ${c.getText()} is unsupported.`);
    }
    negateTerm = (c: TermContext): string => {
        if (c instanceof GroupContext)
            return `(?:${this.negateExpr(c.expr())})`;
        if (c instanceof NotContext)
            return this.visit(c.term())!;
        if (c instanceof DifferenceContext) {
            const charset = this.collectCharsetTerm(c);
            if (charset)
                return `[^${this.buildSet(charset)}]`;
            else
                return this.error(c, `Cannot resolve difference of non-charset terms.`);
        }
        if (c instanceof OrGroupContext)
            return `[^${this.buildSet(this.collectCharsetTerm(c)!)}]` ;
        if (c instanceof SubstitutionContext) {
            const template = this.getTemplate(c);
            if (template) return this.negateExpr(template);
            else return "";
        }
        if (c instanceof AnchorContext)
            return this.negateExpr(this.blockExpr.at(-1)!);
        if (c instanceof AnyLetterContext) {
            if (this.templates.has("letters")) {
                const letters = this.templates.get("letters")!;
                return this.negateExpr(letters);
            } else return "\\P{L}";
        }
        if (c instanceof LhsCharsContext)
            return [...this.visit(c)!].map(ch => `[^${ch}]`).join('');
        return this.error(c, `Negating ${c.getText()} is unsupported.`);
    };
    visitNot = (ctx: NotContext) =>
        this.negateTerm(ctx.term());

    visitQuantification = (ctx: QuantificationContext) => {
        const term = this.visit(ctx.term())!;
        const quantifier = this.visit(ctx.quantifier())!;
        return (ctx.term() instanceof QuantificationContext || ctx.term() instanceof GroupContext)
            ? term + quantifier
            : `(?:${term})${quantifier}` ;
    }
    visitQuantSimple = (ctx: QuantSimpleContext) =>
        ctx.getText();
    visitQuantNtoM = (ctx: QuantNtoMContext) => {
        const from = this.visit(ctx._from_!)!;
        const to = this.visit(ctx._to!)!;
        if (parseInt(from, 10) > parseInt(to, 10))
            return this.error(ctx, "Numbers out of order in quantifier range.");
        return `{${from},${to}}`;
    }
    visitQuantNOrMore = (ctx: QuantNOrMoreContext) =>
        `{${this.visit(ctx.number())},}` ;
    visitQuantExactlyN = (ctx: QuantExactlyNContext) =>
        `{${this.visit(ctx.number())}}` ;

    collectRange = (ctx: ParserRuleContext, l: Token, r: Token): Set<string> | null => {
        const left = this.renderChar(l.text!).charCodeAt(0);
        const right = this.renderChar(r.text!).charCodeAt(0);
        if (left > right) {
            this.error(ctx, `Range characters ${l.text} and ${r.text} are not in order.`);
            return null;
        }
        const set = new Set<string>();
        for (let code = left; code <= right; code++)
            set.add(String.fromCharCode(code));
        return set;
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
        if (ctx instanceof DifferenceContext) {
            const left = this.collectCharsetTerm(ctx._l!);
            const right = this.collectCharsetTerm(ctx._r!);
            if (left && right) return left.difference(right);
        }
        if (ctx instanceof OrGroupContext) {
            let set = new Set<string>();
            ctx.charset().forEach(charset => {
                if (charset.HYPHEN()) {
                    const range = this.collectRange(ctx, charset._l!, charset._r!);
                    if (range) set = set.union(range);
                } else {
                    const chars = new Set(this.collectLhsString(charset._chars));
                    set = set.union(chars);
                }
            });
            return set;
        }
        if (ctx instanceof LhsCharsContext) {
            const set = this.collectChars(ctx.lhs_chars());
            if (set.length === 1) return new Set(set);
        }
        if (ctx instanceof SubstitutionContext) {
            const template = this.getTemplate(ctx);
            if (template) return this.collectCharsetExpr(template);
        }
        if (ctx instanceof AnchorContext)
            return this.collectCharsetExpr(this.blockExpr.at(-1)!);
        return null;
    }
    buildSet = (set: Set<string>) =>
        Array.from(set).join('');

    visitOrGroup = (ctx: OrGroupContext) =>
        `[${this.buildSet(this.collectCharsetTerm(ctx)!)}]` ;

    visitDifference = (ctx: DifferenceContext) => {
        const charset = this.collectCharsetTerm(ctx);
        if (charset)
            return `[${this.buildSet(charset)}]`;
        else
            return this.error(ctx, `Cannot resolve difference of non-charset terms.`);
    }

    getTemplate = (ctx: SubstitutionContext): ExprContext | undefined => {
        const name = this.visit(ctx.lhs_chars())!;
        if (this.templates.has(name)) return this.templates.get(name)!;
        this.error(ctx, `Template ${name} is not defined.`);
        return undefined;
    }
    visitSubstitution = (ctx: SubstitutionContext) => {
        const template = this.getTemplate(ctx);
        if (template) return this.visit(template)!;
        else return "";
    }

    getAnyLetter = () =>
        this.templates.has("letters")
            ? this.visit(this.templates.get("letters")!)!
            : "\\p{L}" ;
    visitAnyLetter = (ctx: AnyLetterContext) =>
        this.getAnyLetter();

    visitAnchor = (ctx: AnchorContext) => {
        if (this.blockExpr.length > 0)
            return this.visit(this.blockExpr.at(-1)!)!;
        else throw new Error(`Illegal use of anchor outside block.`);
    }

    visitLhsChars = (ctx: LhsCharsContext) =>
        this.visit(ctx.lhs_chars())!;

    visitNothing = (ctx: NothingContext) =>
        "";

    visitRhsChars = (ctx: RhsCharsContext) =>
        this.visit(ctx.rhs_chars())!;

    visitWhenGroup = (ctx: WhenGroupContext) =>
        `(${this.visit(ctx.when())})`;

    visitWhenNot = (ctx: WhenNotContext) =>
        `!${this.visit(ctx.when())}`;

    visitWhenComparison = (ctx: WhenComparisonContext) => {
        const op = ctx.LT()? '<' : '>';
        const strict = ctx.EQ()? '=' : '';
        return `${this.visit(ctx._l!)} ${op}${strict} ${this.visit(ctx._r!)}` ;
    }

    visitWhenEquality = (ctx: WhenEqualityContext) => {
        const op = ctx.TILDE()? "!=": "==";
        return `${this.visit(ctx._l!)} ${op} ${this.visit(ctx._r!)}` ;
    }

    visitWhenAnd = (ctx: WhenAndContext) =>
        `${this.visit(ctx._l!)} && ${this.visit(ctx._r!)}`

    visitWhenOr = (ctx: WhenOrContext) =>
        `${this.visit(ctx._l!)} || ${this.visit(ctx._r!)}`

    visitWhenChars = (ctx: WhenCharsContext) =>
        this.visit(ctx.lhs_chars())!;
}
