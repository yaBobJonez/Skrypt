import {basicSetup, EditorView} from "codemirror"
import {keymap} from "@codemirror/view"
import {insertTab} from "@codemirror/commands";
import {skrypt} from "codemirror-lang-skrypt"
import defaultText from "../examples/pl-Cyrl.skrypt?raw"
import {CharStream, CommonTokenStream, BaseErrorListener} from "antlr4ng";
import {SkryptLexer} from "../lib/SkryptLexer.js";
import {SkryptParser} from "../lib/SkryptParser.js";
import FileVisitor from "./FileVisitor.js";
import CodeGenerator from "./CodeGenerator.js";
import {buildString, collectMatches} from "../public/Skrypt.js";

const codeGenerator = new CodeGenerator();
let fileVisitor;

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

    const chars = CharStream.fromString(code);
    const lexer = new SkryptLexer(chars);
    const tokens = new CommonTokenStream(lexer);
    const parser = new SkryptParser(tokens);

    const errorListener = new EchoErrorListener();
    lexer.removeErrorListeners();
    parser.removeErrorListeners();
    lexer.addErrorListener(errorListener);
    parser.addErrorListener(errorListener);

    document.getElementById("outputText").value = "";
    const tree = parser.file();
    const visitor = new FileVisitor((line, column, msg) => {
        document.getElementById("outputText").value += `Syntax error at ${line}:${column}: ${msg}\n`;
    });
    visitor.visit(tree);
    fileVisitor = visitor;

    Metro.notify.create("If any, errors written in Output field.", "Rules parsed");
}

document.getElementById("transformBtn").onclick = () => {
    if (!fileVisitor) return;
    let text = document.getElementById("inputText").value;

    if (fileVisitor.functions.length !== 1) {
        Metro.notify.create("Multiple functions defined, cannot transform.", "Error");
        return;
    }

    const startTime = performance.now();
    for (const stage of fileVisitor.functions[0].stages) {
        if (stage.isEmpty()) continue;
        const options = fileVisitor.functions[0].options;
        const rules = stage.rules.filter(r => {
            if (typeof r.when === "boolean")
                return r.when;
            const evaluator = new Function(...options.keys(), "return " + r.when);
            const result = evaluator(...options.values());
            if (result === "false") return false;
            return Boolean(result);
        });
        const slots = collectMatches(text, rules);
        text = buildString(text, slots);
    }
    const endTime = performance.now();

    document.getElementById("outputText").value = text;
    Metro.notify.create(`Operation took ${endTime - startTime} ms.`, "Transformed");
}

document.getElementById("generateJSBtn").onclick = () => {
    if (!fileVisitor) return;
    document.getElementById("outputText").value = codeGenerator.render(fileVisitor);
    Metro.notify.create("Function was composed in Output field.", "Generated");
}
