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

export interface Node {
    emitJS(): string[];
}
export interface ExprNode {
    toRegex(): string;
}

export class FunctionDef implements Node {
    name: string;
    options = new Map<string, string>();
    stages: Stage[] = [];

    constructor(name: string) {
        this.name = name;
        this.stages.push(new Stage());
    }

    emitJS(): string[] {
        const result: string[] = [];
        if (this.isEmpty())
            return result;
        const options = [...this.options]
            .map(([name, value]) => `, ${name} = ${value}`)
            .join('');
        result.push(`export function ${this.name}(text${options}) {`);
        result.push(`\tlet rules, slots;`);
        this.stages.forEach(s =>
            result.push(...s.emitJS().map(line => '\t' + line))
        );
        result.push(`\treturn text;`);
        result.push(`}`);
        return result;
    }

    isEmpty = () => this.stages.length < 2 && this.currStage().rules.length === 0;
    currStage = () => this.stages[this.stages.length - 1];

    newStage() {
        if (this.currStage().rules.length === 0)
            this.stages.pop();
        this.stages.push(new Stage());
    }
    addRule(rule: Rule){
        this.currStage().rules.push(rule);
    }
}

export class Stage implements Node {
    rules: Rule[] = [];

    isEmpty = () => this.rules.length === 0;

    emitJS() {
        const result: string[] = [];
        if (this.isEmpty())
            return result;
        if (this.rules.length === 1) {
            const r = this.rules[0];
            const match = r.patterns.map(p => p.toRegex()).join('|');
            const replace = JSON.stringify(r.replace).slice(1, -1);
            if (r.when) {
                result.push(`if (${r.when.toRegex()})`);
                result.push(`\ttext = text.replace(/${match}/${r.flags}, "${replace}");`);
            } else
                result.push(`text = text.replace(/${match}/${r.flags}, "${replace}");`);
        } else {
            result.push(`rules = [`);
            result.push(...this.rules.map(r =>
                '\t' + r.emitJS()[0] + ','
            ));
            result.push(`];`);
            result.push(`rules = rules.filter(r => r.when);`);
            result.push(`slots = collectMatches(text, rules);`);
            result.push(`text = buildString(text, slots);`);
        }
        return result;
    }
}

export class Rule implements Node {
    patterns: Pattern[];
    flags: string;

    match: RegExp;
    replace: string;
    when: ExprNode | null;

    constructor(patterns: Pattern[], flags: string, replace: string, when: ExprNode | null) {
        this.patterns = patterns;
        this.flags = flags;
        this.match = this.compileRegex();
        this.replace = replace;
        this.when = when;
    }

    emitJS() {
        const replace = JSON.stringify(this.replace).slice(1, -1);
        const when = this.when?.toRegex() ?? "true";
        return [`{"match": ${this.compileRegex()}, "replace": "${replace}", "when": ${when}}`];
    }

    private compileRegex() {
        const match = this.patterns.map(p => p.toRegex()).join('|');
        return new RegExp(match, this.flags);
    }
}

export class Pattern implements ExprNode {
    lookbehind: ExprNode[];
    lookahead: ExprNode[];
    inner: ExprNode;

    constructor(lookbehind: ExprNode[], inner: ExprNode, lookahead: ExprNode[]) {
        this.lookbehind = lookbehind;
        this.lookahead = lookahead;
        this.inner = inner;
    }

    toRegex() {
        let match = "";
        if (this.lookbehind.length > 0)
            match += `(?<=${ this.lookbehind.map(e => e.toRegex()).join('') })`;
        match += this.inner.toRegex();
        if (this.lookahead.length > 0)
            match += `(?=${ this.lookahead.map(e => e.toRegex()).join('') })`;
        return match;
    }
}
