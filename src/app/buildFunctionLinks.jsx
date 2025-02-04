// const functionSignature = /(float|uint|int|vec2|vec3|vec4|void)\s+(\w*)\s*(\(.*\))/mg;
const functionSignature = /^(\w+)\s+(\w*)\s*(\(.*\))/mg;

// if it doesn't work, set to true - should be set to false after the first run anyway.
let debugAlgo = false;

// global flag shuts this off if it doesn't work anyway.
let algoWorks = true;

const countBraces = (line) => ({
    open: line.match(/\{/g)?.length ?? 0,
    close: line.match(/}/g)?.length ?? 0,
});

const isComplete = (scopeCounter) =>
    scopeCounter.open > 0 && scopeCounter.open === scopeCounter.close;

const debug = (...args) => {
    if (!debugAlgo) {
        return;
    }
    console.log("[buildFunctionLinks]", ...args);
};

export const buildFunctionLinks = (shader) => {
    const result = [];
    if (!shader || !algoWorks) {
        return result;
    }
    const matches = [...shader.matchAll(functionSignature)];
    let matchIndex = 0;
    let match = matches[matchIndex];
    let scopeCounter = null;
    let openFunction = null;
    let lineIndex = 0;
    let line;
    let doesMatch = false;
    const lines = shader.split('\n');
    debug("lines:", lines, "matches:", matches);
    // yeah, this algorithm breaks down if a signature spans more than one line...
    for (; lineIndex < lines.length && matchIndex < matches.length; lineIndex++) {
        try {
            line = lines[lineIndex].trim();
            doesMatch = line.startsWith(match[0]);
            debug(doesMatch ? "MATCH" : ".....", "line=", line, "match=", match, "openFunction=", openFunction);
            if (openFunction) {
                const braces = countBraces(line);
                scopeCounter.open += braces.open;
                scopeCounter.close += braces.close;
                const complete = isComplete(scopeCounter);
                debug("scopeCounter:", braces, "->", scopeCounter, "complete?", complete);
                if (complete) {
                    openFunction.lineCloseIndex = lineIndex;
                    result.push(openFunction);
                    matchIndex += 1;
                    match = matches[matchIndex];
                    openFunction = null;
                }
            } else if (doesMatch) {
                openFunction = {
                    code: line,
                    ...functionSignatureParts(match),
                    lineIndex,
                    lineCloseIndex: undefined,
                };
                scopeCounter = countBraces(line);
                debug("new openFunction", openFunction, "line:", line);
            }
        } catch (err) {
            console.error("buildFunctionLinks() broken", err);
            algoWorks = false;
        }
    }
    debug("RESULT:", result);
    // only debug on the first run
    debugAlgo = false;
    return result;
};

const functionSignatureParts = (match) => {
    const result = {
        returnType: match[1],
        name: match[2],
        args: match[3],
    };
    result.shortArgs = result.args === "()" ? "()" : "(...)";
    result.shortSignature = `${result.returnType} ${result.name}${result.shortArgs}`;
    return result;
};
