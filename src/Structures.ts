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

export class FunctionDef {
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

export class Stage {
    rules: Rule[] = [];

    isEmpty = () => this.rules.length === 0;
}

export interface Rule {
    match: RegExp;
    replace: string;
    when: string | boolean;
}
