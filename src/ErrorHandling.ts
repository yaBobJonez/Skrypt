import {ATNSimulator, BaseErrorListener, RecognitionException, Recognizer, type Token} from "antlr4ng";

export class SemanticError extends Error {
    constructor(
        public start: Token,
        public end: Token,
        message: string,
    ) {
        super(message);
    }
}

export default class EchoErrorListener extends BaseErrorListener {
    constructor(
        public input: string,
        public output: HTMLTextAreaElement
    ) {
        super();
    }

    syntaxError<S extends Token, T extends ATNSimulator>(
        recognizer: Recognizer<T>,
        offendingSymbol: S | null,
        line: number,
        column: number,
        msg: string,
        e: RecognitionException | null
    ) {
        this.output.value += this.input.split('\n')[line-1] + '\n';
        if (offendingSymbol === null)
            this.output.value += ' '.repeat(column) + '^?\n';
        else {
            const s = offendingSymbol.start;
            const l = Math.max(0, offendingSymbol.stop - s);
            this.output.value += ' '.repeat(s) + '^' + '~'.repeat(l) + '\n';
        }
        this.output.value += `Syntax error [${line}:${column}]:\n`;
        this.output.value += `${msg}\n\n`;
    }

    semanticError(
        line: number,
        startCol: number,
        endCol: number,
        message: string
    ) {
        this.output.value += this.input.split('\n')[line-1] + '\n';
        this.output.value += ' '.repeat(startCol) + '^' + '~'.repeat(endCol-startCol) + '\n';
        this.output.value += `Semantic error [${line}:${startCol}]:\n`;
        this.output.value += `${message}\n\n`;
    }
}
