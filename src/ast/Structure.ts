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

export interface Node {}
export interface ExprNode {}

export class FunctionDef implements Node {
    name: string;
    options = new Map<string, string>();
    stages: Stage[] = [];

    constructor(name: string) {
        this.name = name;
        this.stages.push(new Stage());
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
}

export class Rule implements Node {
    patterns: Pattern[];
    flags: string;
    replace: string;
    when: ExprNode | null;

    constructor(patterns: Pattern[], flags: string, replace: string, when: ExprNode | null) {
        this.patterns = patterns;
        this.flags = flags;
        this.replace = replace;
        this.when = when;
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
}
