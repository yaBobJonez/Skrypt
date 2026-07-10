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
import {GroupNode, StringNode} from "./Expressions.ts";

export class WhenGroupNode extends GroupNode {}

export class WhenNotNode implements ExprNode {
    constructor(public inner: ExprNode) {}

    toRegex = () =>
        `!${this.inner.toRegex()}`;
}

export class WhenComparisonNode implements ExprNode {
    constructor(
        public left: ExprNode,
        public op: string,
        public right: ExprNode,
    ) {}

    toRegex = () =>
        `${this.left.toRegex()} ${this.op} ${this.right.toRegex()}`;
}

export class WhenAndNode implements ExprNode {
    constructor(
        public left: ExprNode,
        public right: ExprNode
    ) {}

    toRegex = () =>
        `${this.left.toRegex()} && ${this.right.toRegex()}`;
}

export class WhenOrNode implements ExprNode {
    constructor(
        public left: ExprNode,
        public right: ExprNode
    ) {}

    toRegex = () =>
        `${this.left.toRegex()} || ${this.right.toRegex()}`;
}

export class VariableNode extends StringNode {}
