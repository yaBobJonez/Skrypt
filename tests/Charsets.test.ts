import { describe, test, expect } from "vitest";
import {CharsetNode} from "../src/ast/Expressions.ts";

describe('Character set tests', () => {
    const r = (a: string, b: string) =>
        ({from: a.charCodeAt(0), to: b.charCodeAt(0)});

    test.for([
        [
            "<0-5> | <3-9> -> <0-9>",
            [r('0', '5')],
            [r('3', '9')],
            [r('0', '9')]
        ],
        [
            "a | <b-d> -> <a-d>",
            ['a'],
            [r('b', 'd')],
            [r('a', 'd')]
        ],
        [
            "<025> | <134> -> <0-5>",
            ['0', '2', '5'],
            ['1', '3', '4'],
            [r('0', '5')]
        ],
        [
            "<a-fée-h> | <i-kjlmn-zç> -> <a-zéç>",
            [r('a', 'f'), 'é', r('e', 'h')],
            [r('i', 'k'), 'j', 'l', 'm', r('n', 'z'), 'ç'],
            [r('a', 'z'), 'é', 'ç']
        ]
    ])("Union: %s", ([name, left, right, expected]) => {
        const cs1 = new CharsetNode(...left);
        const cs2 = new CharsetNode(...right);
        const csE = new CharsetNode(...expected);
        expect(cs1.union(cs2).toRegex()).toEqual(csE.toRegex());
    });

    test.for([
        [
            "<0-5> - <27> -> <013-5>",
            [r('0', '5')],
            ['2', '7'],
            ['0', '1', r('3', '5')]
        ],
        [
            "<a-f> - <0-9> -> <a-f>",
            [r('a', 'f')],
            [r('0', '9')],
            [r('a', 'f')]
        ],
        [
            "<5-8> - <1578> -> 6",
            [r('5', '8')],
            ['1', '5', '7', '8'],
            ['6']
        ]
    ])("Difference: %s", ([name, left, right, expected]) => {
        const cs1 = new CharsetNode(...left);
        const cs2 = new CharsetNode(...right);
        const csE = new CharsetNode(...expected);
        expect(cs1.difference(cs2).toRegex()).toEqual(csE.toRegex());
    });
});
