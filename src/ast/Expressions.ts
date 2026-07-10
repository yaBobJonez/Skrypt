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

import type {ExprNode} from "./Structure.ts";

export const is = (obj: any, classes: Function[]) =>
    classes.some(cls => obj instanceof cls);

export class TermsNode implements ExprNode {
    constructor(public terms: ExprNode[]) {}

    toRegex = () =>
        this.terms.map(t => {
            if (t instanceof OrNode)
                return `(${t.toRegex()})`;
            return t.toRegex();
        }).join('');
}

export class OrNode implements ExprNode {
    constructor(
        public left: ExprNode,
        public right: ExprNode
    ) {}

    toRegex = () =>
        `${this.left.toRegex()}|${this.right.toRegex()}`;
}

export class GroupNode implements ExprNode {
    constructor(public inner: ExprNode) {}

    toRegex = () =>
        `(${this.inner.toRegex()})`;
}

export class NotNode implements ExprNode {
    constructor(public inner: ExprNode) {}

    toRegex(){
        if (this.inner instanceof CharsetNode)
            return `[^${this.inner.toString()}]`;
        if (this.inner instanceof StringNode) {
            const s = this.inner.value;
            if (s === "\\d")
                return "\\D";
            if (s === "\\D")
                return "\\d";
            if (s === "\\s")
                return "\\S";
            if (s === "\\S")
                return "\\s";
            if (/^\\p\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(s))
                return s.replace("\\p{", "\\P{");
            if (/^\\P\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(s))
                return s.replace("\\P{", "\\p{");
            return [...this.inner.value].map(c => `[^${c}]`).join('');
        }
        return this.inner.toRegex();
    }
}

export class QuantificationNode implements ExprNode {
    constructor(
        public inner: ExprNode,
        public from: number,
        public to?: number
    ) {}

    toRegex() {
        let term = this.inner.toRegex();
        if (is(this.inner, [TermsNode, OrNode, NotNode, StringNode]))
            term = `(${term})`;
        const f = this.from, t = this.to;
        if (f == 0 && t == 1)
            return `${term}?`;
        if (f == 1 && t == undefined)
            return `${term}+`;
        if (f == 0 && t == undefined)
            return `${term}*`;
        if (f == t)
            return `${term}{${f}}`;
        if (t == undefined)
            return `${term}{${f},}`;
        return `${term}{${f},${t}}`;
    }
}

interface Range {from: number, to: number}
export class CharsetNode implements ExprNode {
    ranges: Range[] = [];

    constructor(...values: (string | {from: number, to: number})[]) {
        for (const value of values) {
            if (typeof value === "string") {
                const c = value.charCodeAt(0);
                this.ranges.push({from: c, to: c + 1});
            } else {
                this.ranges.push({from: value.from, to: value.to + 1});
            }
        }
        this.normalize();
    }
    private static of(...ranges: Range[]) {
        const node = new CharsetNode();
        node.ranges = structuredClone(ranges);
        node.normalize();
        return node;
    }

    toRegex = () => {
        const s = this.toString();
        return s.length <= 1
            ? s
            : `[${s}]`;
    }
    toString() {
        return this.ranges
            .map(r => ({from: String.fromCharCode(r.from), to: String.fromCharCode(r.to - 1)}))
            .map(r => r.from === r.to? r.from : `${r.from}-${r.to}`)
            .join('');
    }

    union(right: CharsetNode) {
        return CharsetNode.of(...this.ranges, ...right.ranges);
    }
    difference(right: CharsetNode) {
        const events = this.ranges
            .flatMap(r => [{pos: r.from, d: +1}, {pos: r.to, d: -1}])
            .concat(right.ranges
                .flatMap(r => [{pos: r.from, d: -1}, {pos: r.to, d: +1}])
            );
        events.sort((a, b) =>
            a.pos - b.pos || a.d - b.d);
        const result: Range[] = [];
        let score: number = 0;
        let lastStart: number = 0;
        events.forEach(e => {
            score += e.d;
            if (score === 1)
                lastStart = e.pos;
            else if (score === 0 && e.d === -1)
                result.push({from: lastStart, to: e.pos});
        });
        return CharsetNode.of(...result);
    }

    private normalize() {
        let result: Range[] = [];
        let last: Range;
        this.ranges.sort((a, b) =>
            a.from - b.from || a.to - b.to);
        this.ranges.forEach(r => {
            if (!last || r.from > last.to)
                result.push(last = r);
            else if (r.to > last.to)
                last.to = r.to;
        });
        this.ranges = result;
    }
}

export class StringNode implements ExprNode {
    constructor(public value: string) {}

    toRegex = () =>
        this.value;
}
