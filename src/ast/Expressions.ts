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

export class TermsNode implements ExprNode {
    constructor(public terms: ExprNode[]) {}
}

export class AndNode implements ExprNode {
    constructor(
        public left: ExprNode,
        public right: ExprNode
    ) {}
}

export class OrNode implements ExprNode {
    constructor(
        public left: ExprNode,
        public right: ExprNode
    ) {}
}

export class ComparisonNode implements ExprNode {
    constructor(
        public left: ExprNode,
        public op: string,
        public right: ExprNode,
    ) {}
}

export class GroupNode implements ExprNode {
    constructor(public inner: ExprNode) {}
}

export class NotNode implements ExprNode {
    constructor(public inner: ExprNode) {}
}

export class QuantificationNode implements ExprNode {
    constructor(
        public inner: ExprNode,
        public from: number,
        public to?: number
    ) {}
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
                value.to += 1;
                this.ranges.push(value);
            }
        }
        this.normalize();
    }

    toRegex() {
        return this.ranges
            .map(r => ({from: String.fromCharCode(r.from), to: String.fromCharCode(r.to - 1)}))
            .map(r => r.from === r.to? r.from : `${r.from}-${r.to}`)
            .join('');
    }

    union(right: CharsetNode) {
        this.ranges = this.ranges.concat(right.ranges);
        this.normalize();
        return this;
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
        this.ranges = result;
        return this;
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
}
