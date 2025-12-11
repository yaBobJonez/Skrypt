import {basicSetup, EditorView} from "codemirror"
import {keymap} from "@codemirror/view"
import {insertTab} from "@codemirror/commands";
import {skrypt} from "codemirror-lang-skrypt"
import defaultText from "../examples/pl-Cyrl.skrypt?raw"
import {BaseErrorListener} from "antlr4ng";
import {parseRules, transformText} from "./Driver.js";

let functions = [];

class EchoErrorListener extends BaseErrorListener {
    output = document.getElementById("outputText");

    syntaxError(
        recognizer,
        offendingSymbol,
        line,
        column,
        msg,
        e)
    {
        this.output.value += `Syntax error at ${line}:${column}: ${msg}\n`;
    }
}

const view = new EditorView({
    doc: defaultText,
    parent: document.getElementById("editor"),
    extensions: [
        basicSetup,
        keymap.of([ {key: "Tab", run: insertTab} ]),
        skrypt()
    ],
});

document.getElementById("uploadBtn").onchange = () => {
    const file = document.getElementById("uploadBtn").files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: content }
        });
    };
    reader.onerror = () => {
        Metro.notify.create("Could not load file.", "Error");
    };
    reader.readAsText(file);
}

document.getElementById("downloadBtn").onclick = () => {
    const content = view.state.doc.toString();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    link.download = "file.skrypt";
    link.click();
    URL.revokeObjectURL(link.href);
}

document.getElementById("parseBtn").onclick = () => {
    const code = view.state.doc.toString();
    const errorListener = new EchoErrorListener();
    const handler = (line, column, msg) => {
        document.getElementById("outputText").value += `Syntax error at ${line}:${column}: ${msg}\n`;
    };

    document.getElementById("outputText").value = "";
    functions = parseRules(code, errorListener, handler);

    Metro.notify.create("If any, errors written in Output field.", "Rules parsed");
}

document.getElementById("transformBtn").onclick = () => {
    if (functions.length === 0) return;
    let text = document.getElementById("inputText").value;

    if (functions.length !== 1) {
        Metro.notify.create("Multiple functions defined, cannot transform.", "Error");
        return;
    }

    const startTime = performance.now();
    text = transformText(functions[0], text);
    const endTime = performance.now();

    document.getElementById("outputText").value = text;
    Metro.notify.create(`Operation took ${endTime - startTime} ms.`, "Transformed");
}

document.getElementById("generateJSBtn").onclick = () => {
    if (functions.length === 0) return;
    const code = [`import {collectMatches, buildString} from "./Skrypt.js"`, ``];
    for (const func of functions)
        code.push(...func.emitJS());
    document.getElementById("outputText").value = code.join('\n');
    Metro.notify.create("Function was composed in Output field.", "Generated");
}
