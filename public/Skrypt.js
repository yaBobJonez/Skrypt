/*
 * This file is part of the Skrypt runtime library.
 *
 * Copyright (c) 2025 Mykhailo Stetsiuk
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl/
 */

function rotateFallbacks(root, node) {
    root.fallback.push(node);
    const unblockedNodes = [];
    const queue = [node];
    while (queue.length !== 0) {
        const current = queue.shift();
        for (let i = current.fallback.length - 1; i >= 0; i--) {
            const upperNode = current.fallback[i];
            if (upperNode.start >= root.end)
                unblockedNodes.push(current.fallback.pop());
            else
                queue.push(upperNode);
        }
    }
    return unblockedNodes;
}

export function collectMatches(input, rules) {
    const slots = new Array(input.length).fill(undefined);
    for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex++) {
        const rule = rules[ruleIndex];
        let match;
        while (match = rule.match.exec(input)) {
            const start = match.index;
            const end = start + match[0].length;
            const current = {start, end, fallback: [], match: match[0], replace: rule.replace, ruleIndex};
            if (typeof slots[start] === "number") {
                const oldMatch = slots[slots[start]];
                rotateFallbacks(oldMatch, current);
                continue;
            }
            if (typeof slots[start] === "object") {
                const oldMatch = slots[start];
                if (oldMatch.end - oldMatch.start >= match[0].length)
                    continue;
            }
            slots[start] = current;
            for (let i = start + 1; i < end; i++) {
                if (typeof slots[i] === "object") {
                    for (let j = end; j < slots[i].end; j++)
                        slots[j] = undefined;
                    for (const node of rotateFallbacks(current, slots[i])) {
                        slots[node.start] = node;
                        for (let j = node.start + 1; j < node.end; j++)
                            slots[j] = node.start;
                    }
                }
                slots[i] = start;
            }
        }
    }
    return slots;
}

export function buildString(input, slots) {
    let output = "";
    for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (typeof slot === "number") continue;
        if (slot === undefined) output += input[i];
        else {
            const {end, match, replace} = slot;
            if (match === match.toLowerCase())
                output += replace;
            else if (replace.length < 2)
                output += replace.toUpperCase();
            else {
                const next = input[end];
                if (next && next === next.toLowerCase())
                    output += replace[0].toUpperCase() + replace.slice(1);
                else
                    output += replace.toUpperCase();
            }
        }
    }
    return output;
}
