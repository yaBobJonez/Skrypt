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

import {SkryptParserVisitor} from "../../lib/SkryptParserVisitor.js";
import {
    FileContext,
    OptionContext,
    RuleTrContext,
    TemplateContext,
    DirectiveContext,
    BlockContext,
    AnyLetterContext,
    GroupContext,
    LhsRawStringContext,
    LhsStringContext,
    LhsCharsContext,
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
    RhsRawStringContext,
    RhsStringContext,
    RhsCharsContext,
    SubstitutionContext,
    AnchorContext,
    TermsContext,
    WhenGroupContext,
    WhenNotContext,
    WhenComparisonContext,
    WhenEqualityContext,
    WhenAndContext,
    WhenOrContext,
    WhenCharsContext
} from "../../lib/SkryptParser.js";
import {type ExprNode, FunctionDef, Pattern, Rule} from "./Structure.ts";
import {
    CharsetNode,
    GroupNode, is,
    NotNode,
    OrNode,
    QuantificationNode,
    StringNode,
    TermsNode
} from "./Expressions.ts";
import {
    VariableNode,
    WhenAndNode,
    WhenComparisonNode,
    WhenGroupNode,
    WhenNotNode,
    WhenOrNode
} from "./WhenExpressions.ts";
import {SemanticError} from "../ErrorHandling.ts";

export default class ASTBuilder extends SkryptParserVisitor<ExprNode | null> {
    functions = [new FunctionDef("transform")];
    templates = new Map<string, ExprNode>();
    blockExprStack: ExprNode[] = [];
    blockOptionStack: ExprNode[] = [];
    flags = "giu";


    visitFile = (ctx: FileContext) => {
        for (const line of ctx.line())
            if (line.statement())
                this.visit(line.statement()!);
        return null;
    }
    visitDirective = (ctx: DirectiveContext) => {
        const name = this.visit(ctx._name!)!.toRegex();
        const values = ctx._values.map(v => this.visit(v)!.toRegex());

        if (/case[- ]?sensitive/.test(name))
            this.flags = "gu";
        else if (/case[- ]?insensitive/.test(name))
            this.flags = "giu";
        else if (name === "function") {
            if (values.length < 1)
                throw new SemanticError(ctx.start!, ctx.stop!,
                    `Function directive expects function name`);
            if (this.currFunc().isEmpty())
                this.functions.pop();
            this.functions.push(new FunctionDef(values[0]));
            this.templates.clear();
        }
        else if (name === "stage")
            this.currFunc().newStage();
        else throw new SemanticError(ctx.start!, ctx.stop!,
            `Unsupported directive: ${name}\n`);

        return null;
    }
    visitOption = (ctx: OptionContext) => {
        const key = this.visit(ctx._name!)!.toRegex();
        const value = this.visit(ctx._value!)!.toRegex();
        this.currFunc().options.set(key, value);
        return null;
    }
    visitTemplate = (ctx: TemplateContext) => {
        const key = this.visit(ctx._name!)!.toRegex();
        const value = this.visit(ctx._value!)!;
        this.templates.set(key, value);
        return null;
    }
    visitRuleTr = (ctx: RuleTrContext) => {
        const patterns = ctx.lhs().pattern()
            .map(e => this.visit(e) as Pattern);
        const replace = this.visit(ctx.rhs())!;
        const when = ctx.when()
            ? this.visit(ctx.when()!)
            : null;
        const rule = new Rule(patterns, this.flags, replace.toRegex(), when);
        this.currFunc().addRule(rule);
        return null;
    }
    visitBlock = (ctx: BlockContext) => {
        if (ctx.when()) this.blockOptionStack.push(this.visit(ctx.when()!)!);
        if (ctx.expr()) this.blockExprStack.push(this.visit(ctx.expr()!)!);
        for (const line of ctx.line())
            if (line.statement())
                this.visit(line.statement()!);
        if (ctx.expr()) this.blockExprStack.pop();
        if (ctx.when()) this.blockOptionStack.pop();
        return null;
    }


    currFunc = () => this.functions[this.functions.length - 1]!;

    normalizeChar(text: string) {
        if (/^\\u[0-9a-fA-F]{4}$/.test(text)) return text;
        if (/^\\[rntvdDsS0^$.(){}[\]|/?+*\\]$/.test(text)) return text;
        if (/^\\/.test(text)) return text.slice(1);
        return text;
    }
    normalizeRawChar(text: string) {
        if (/^\\[rnt]$/.test(text)) return text;
        if (text === "\\`") return text.slice(1);
        if (/^[.^$(){}[\]|/?+*\\]$/.test(text)) return `\\${text}`;
        return text;
    }
    renderChar(text: string) {
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
    renderRawChar(text: string) {
        if (text === "\\r") return "\r";
        if (text === "\\n") return "\n";
        if (text === "\\t") return "\t";
        if (text === "\\`") return text.slice(1);
        return text;
    }
    getNumber = (ctx: NumberContext) =>
        parseInt(ctx.getText(), 10);


    visitLhsRawString = (ctx: LhsRawStringContext) => {
        const chars = ctx.String_CHAR()
            .map(c => this.normalizeRawChar(c.getText()))
            .join('');
        if (chars.length === 1)
            return new CharsetNode(chars);
        return new StringNode(chars);
    }
    visitLhsString = (ctx: LhsStringContext) => {
        const chars = ctx._chars
            .map(c => this.normalizeChar(c.text!))
            .join('');
        if (chars.length === 1)
            return new CharsetNode(chars);
        return new StringNode(chars);
    }
    visitRhsRawString = (ctx: RhsRawStringContext) => new StringNode(
        ctx.String_CHAR()
            .map(c => this.renderRawChar(c.getText()))
            .join('')
    );
    visitRhsString = (ctx: RhsStringContext) => new StringNode(
        ctx.Rhs_CHAR()
            .map(c => this.renderChar(c.getText()))
            .join('')
    );


    visitPattern = (ctx: PatternContext) => {
        const inner = this.visit(ctx._inner!)!;
        const lookbehind = ctx._behind.map(e => this.visit(e)!);
        const lookahead = ctx._ahead.map(e => this.visit(e)!);
        return new Pattern(lookbehind, inner, lookahead);
    }
    visitLookaround = (ctx: LookaroundContext) => {
        if (ctx.SLASH()) {
            if (this.templates.has("letters"))
                return new NotNode(this.templates.get("letters")!);
            else return new StringNode("\\P{L}");
        } else return this.visit(ctx.expr()!)!;
    }


    visitTerms = (ctx: TermsContext) => {
        const terms = ctx.term().map(e => this.visit(e)!);
        if (terms.length === 1)
            return terms[0];
        return new TermsNode(terms);
    }
    visitOr = (ctx: OrContext) => {
        const left = this.visit(ctx._l!)!;
        const right = this.visit(ctx._r!)!;
        if (left instanceof CharsetNode && right instanceof CharsetNode)
            return left.union(right);
        return new OrNode(left, right);
    }


    visitGroup = (ctx: GroupContext) => { //TODO node needed?
        const inner = this.visit(ctx.expr())!;
        if (inner instanceof CharsetNode)
            return inner;
        return new GroupNode(inner);
    }
    visitDifference = (ctx: DifferenceContext) => {
        const left = this.visit(ctx._l!)!;
        const right = this.visit(ctx._r!)!;
        if (left instanceof CharsetNode && right instanceof CharsetNode)
            return left.difference(right);
        throw new SemanticError(ctx.start!, ctx.stop!,
            "Cannot resolve difference of non-charset terms.");
    }
    descendingNegation = (node: ExprNode, ctx: NotContext): ExprNode => {
        if (node instanceof TermsNode)
            return new TermsNode(node.terms.map(t => this.descendingNegation(t, ctx)));
        if (node instanceof OrNode)
            return new OrNode(this.descendingNegation(node.left, ctx), this.descendingNegation(node.right, ctx));
        if (node instanceof GroupNode)
            return new GroupNode(this.descendingNegation(node.inner, ctx));
        if (node instanceof NotNode)
            return this.descendingNegation(node.inner, ctx);
        if (is(node, [CharsetNode, StringNode]))
            return new NotNode(node);
        throw new SemanticError(ctx.start!, ctx.stop!,
            `Negating ${node.toRegex()} is unsupported.`);
    }
    visitNot = (ctx: NotContext) => {
        const inner = this.visit(ctx.term())!;
        return this.descendingNegation(inner, ctx);
    }
    visitQuantification = (ctx: QuantificationContext) => {
        const inner = this.visit(ctx.term())!;
        const q = ctx.quantifier();
        if (q instanceof QuantNtoMContext) {
            const from = this.getNumber(q._from_!);
            const to = this.getNumber(q._to!);
            if (from > to)
                throw new SemanticError(q.start!, q.stop!,
                    "Numbers out of order in quantifier range.");
            return new QuantificationNode(inner, from, to);
        }
        if (q instanceof QuantNOrMoreContext) {
            const from = this.getNumber(q.number());
            return new QuantificationNode(inner, from);
        }
        if (q instanceof QuantExactlyNContext) {
            const from = this.getNumber(q.number());
            return new QuantificationNode(inner, from, from);
        }
        switch((q as QuantSimpleContext).getText()) {
            case '?': return new QuantificationNode(inner, 0, 1);
            case '+': return new QuantificationNode(inner, 1);
            case '*': return new QuantificationNode(inner, 0);
        }
        throw new SemanticError(q.start!, q.stop!, "Unrecognized quantifier.");
    }
    visitOrGroup = (ctx: OrGroupContext) => {
        const set: {from: number, to: number}[] = [];
        ctx.charset().forEach(el => {
            if (el.HYPHEN()) {
                const from = this.renderChar(el._l!.text!).charCodeAt(0);
                const to = this.renderChar(el._r!.text!).charCodeAt(0);
                if (from > to)
                    throw new SemanticError(ctx.start!, ctx.stop!,
                        "Range characters are not in order.");
                set.push({from, to});
            } else el._chars.map(t => {
                const code = this.renderChar(t.text!).charCodeAt(0);
                set.push({from: code, to: code});
            });
        });
        return new CharsetNode(...set);
    }
    visitSubstitution = (ctx: SubstitutionContext) => {
        const name = this.visit(ctx.lhs_chars())!.toRegex();
        if (this.templates.has(name))
            return this.templates.get(name)!;
        throw new SemanticError(ctx.start!, ctx.stop!,
            `Template ${name} is not defined.`);
    }
    visitAnyLetter = (ctx: AnyLetterContext) => {
        if (this.templates.has("letters"))
            return this.templates.get("letters")!;
        return new StringNode("\\p{L}");
    }
    visitAnchor = (ctx: AnchorContext) => {
        if (this.blockExprStack.length > 0)
            return this.blockExprStack.at(-1)!;
        throw new SemanticError(ctx.start!, ctx.stop!,
            "Illegal use of anchor outside block.");
    }
    visitLhsChars = (ctx: LhsCharsContext) =>
        this.visit(ctx.lhs_chars())!;


    visitNothing = (ctx: NothingContext) =>
        new StringNode("");
    visitRhsChars = (ctx: RhsCharsContext) =>
        this.visit(ctx.rhs_chars())!;


    visitWhenGroup = (ctx: WhenGroupContext) => new WhenGroupNode(
        this.visit(ctx.when())!
    );
    visitWhenNot = (ctx: WhenNotContext) => new WhenNotNode(
        this.visit(ctx.when())!
    );
    visitWhenComparison = (ctx: WhenComparisonContext) => new WhenComparisonNode(
        this.visit(ctx._l!)!,
        (ctx.LT()? '<' : '>') + (ctx.EQ()? '=' : ''),
        this.visit(ctx._r!)!
    );
    visitWhenEquality = (ctx: WhenEqualityContext) => new WhenComparisonNode(
        this.visit(ctx._l!)!,
        ctx.TILDE()? "!=": "==",
        this.visit(ctx._r!)!
    );
    visitWhenAnd = (ctx: WhenAndContext) => new WhenAndNode(
        this.visit(ctx._l!)!,
        this.visit(ctx._r!)!
    );
    visitWhenOr = (ctx: WhenOrContext) => new WhenOrNode(
        this.visit(ctx._l!)!,
        this.visit(ctx._r!)!
    );
    visitWhenChars = (ctx: WhenCharsContext) => new VariableNode(
        this.visit(ctx.lhs_chars())!.toRegex()
    );
}