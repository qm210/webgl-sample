import {useEffect, useMemo, useRef, useState} from "preact/hooks";
import styled from "@emotion/styled";
import AceEditor from "react-ace";
import {useShader} from "../app/useShader.jsx";
import {useGlobalKeyPresses} from "../app/useGlobalKeyPresses.jsx";
import baseShader from "../shaders/raytracing.glsl";

import "ace-builds/src-noconflict/mode-glsl";
import "ace-builds/src-noconflict/ext-language_tools"

const shaderKey = "qm.shader";

const sampleShader = baseShader.trim();
const storedShader = localStorage.getItem(shaderKey) ?? sampleShader;

const fontSize = new URLSearchParams(location.search).get("fontsize") ?? "13pt";


export const MainLayout = ({
    initialShader = storedShader,
    storageKey = "qm.shader",
    aspectRatio = 16 / 9,
                           }) => {
    const [shader, setShader] = useState(initialShader);
    const {
        time,
        compileFragmentShader,
        ref,
        error,
        uniforms,
        compiledAt,
        stop,
        lastWorkingFragmentShader,
        loopSec,
        setLoopSec,
    } = useShader(shader);
    const lastCompiledAt = useRef();
    const [annotations, setAnnotations] = useState([]);
    const [options, setOptions] = useState({
        noStorage: true,
    });
    const [putCursor, setPutCursor] = useState(0);
    const aceRef = useRef();

    useGlobalKeyPresses([{
        key: "Enter",
        ctrlKey: true,
        handle: () => compileFragmentShader(shader)
    }]);

    useEffect(() => {
        console.log("Reload.", new Date(), options.noStorage ? "[Disable Storage]" : "");
        if (options.noStorage) {
            compileFragmentShader(initialShader);
            setShader(initialShader);
        }
    }, [options.noStorage, compileFragmentShader]);

    useEffect(() => {
        if (compiledAt && compiledAt !== lastCompiledAt.current) {
            if (!options.noStorage) {
                localStorage.setItem(storageKey, shader);
            }
            lastCompiledAt.current = compiledAt;
        }
    }, [compiledAt, shader, options.noStorage]);

    useEffect(() => {
        if (!error.any) {
            return;
        }
        setAnnotations(
            error.fragmentShader.map(error => ({
                row: error.row,
                column: error.column,
                type: "error",
                text: error.message
            }))
        );
    }, [error]);

    const reset = () => {
        if (!options.noStorage) {
            localStorage.removeItem(storageKey);
        }
        setShader(sampleShader);
        compileFragmentShader(sampleShader);
    };

    const shaderMethods = useMemo(() =>
        buildFunctionLinks(lastWorkingFragmentShader)
    , [lastWorkingFragmentShader]);

    const [currentMethod, setCurrentMethod] = useState(null);

    const onCursorChange = () => {
        const startIndex = aceRef.current?.editor.getSelectionRange().start.row;
        const method = shaderMethods.find(m => startIndex >= m.lineIndex && startIndex <= m.lineCloseIndex);
        setCurrentMethod(method ?? null)
    };

    return (
        <Main>
            <div className={"editor-quicklinks"}>
                <ul>
                    {
                        shaderMethods.map((method, index) =>
                            <li
                                key={index}
                                onClick={handleLineJump(aceRef, method.lineIndex)}
                                className={method.name === currentMethod?.name ? "infobox" : ""}
                            >
                                {method.returnType} <span className={"link"}>{method.name}{method.shortArgs}</span>
                            </li>
                        )
                    }
                </ul>
            </div>
            <div>
                <div className={"editor-container"}>
                    <AceEditor
                        ref={aceRef}
                        mode={"glsl"}
                        value={shader}
                        onChange={(value) => setShader(value)}
                        name={"ACE_ID"}
                        annotations={annotations}
                        editorProps={{
                            $blockScrolling: true,
                        }}
                        fontSize={fontSize}
                        style={{
                            lineHeight: "120%",
                            width: "100%",
                            height: "100%",
                            backgroundColor: options.noStorage ? "#decefa70" : "white",
                        }}
                        setOptions={{
                            showLineNumbers: true,
                            enableBasicAutocompletion: true,
                            enableLiveAutocompletion: true,
                            enableMobileMenu: true,
                        }}
                        onCursorChange={onCursorChange}
                    />
                </div>
                <div className={"flex-row"} style={{marginTop: "1rem"}}>
                    <button
                        onClick={() => compileFragmentShader(shader)}
                    >
                        Apply Shader
                    </button>
                    <button
                        onClick={stop}
                    >
                        Stop
                    </button>
                    <div className={"flex-row boxed"}>
                        <button
                            onClick={reset}
                            disabled={options.noStorage}
                        >
                            Reset to Sample
                        </button>
                        <span className={"flex-row"}>
                            <input
                                type="checkbox"
                                id="noStore"
                                checked={!!options.noStorage}
                                onChange={() =>
                                    setOptions(o => ({
                                        ...o, noStorage: !o.noStorage,
                                    }))
                                }
                            />
                            <label htmlFor={"noStore"}>
                                Disable Storage
                            </label>
                        </span>
                    </div>
                    <button
                        onClick={() => saveToFile(lastWorkingFragmentShader)}
                    >
                        Save Textfile (the running one)
                    </button>
                </div>
            </div>
            <div>
                <canvas
                    ref={ref}
                    style={{
                        width: "45vw",
                        aspectRatio,
                    }}
                />
                <Uniforms
                    uniforms={uniforms}
                    loopSec={loopSec}
                    setLoopSec={setLoopSec}
                    time={time}
                />
                <div>
                    <pre style={{color: "red", textAlign: "left", fontSize}}>
                        {error.raw}
                    </pre>
                </div>
            </div>
        </Main>
    );
};

const Uniforms = ({uniforms, loopSec, setLoopSec, time}) => {
    const [loopInput, setLoopInput] = useState(loopSec?.toString() ?? "");

    const resolution = !uniforms.iResolution
        ? "--"
        : `(${uniforms.iResolution[0].toFixed(0)} x ${uniforms.iResolution[1].toFixed(0)})`;

    const onChangeLoopInput = (event) => {
        const value = event.target.value;
        if (value === "") {
            setLoopInput(null);
            return;
        }
        const number = +value;
        if (!Number.isNaN(number)) {
            setLoopInput(value);
            setLoopSec(number);
        }
    }

    return (
        <div style={{
            fontSize,
            textAlign: "left",
            fontFamily: "monospace",
            marginLeft: "0.5rem",
        }}>
            <span>
                <label htmlFor={"inputLoopSec"}>
                    Loop:
                </label>
                <input
                    value={loopInput}
                    onChange={onChangeLoopInput}
                    id={"inputLoopSec"}
                    style={{
                        width: 30
                    }}
                />
                <label htmlFor={"inputLoopSec"}>
                    sec,{" "}
                </label>
            </span>
            <span>
                iTime = {time.toFixed(3)} sec, iResolution = {resolution}
            </span>
        </div>
    );
};


const Main = styled.div`
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: space-evenly;
    align-items: stretch;
    gap: 2rem;

    & > div {
        flex: 1;
        box-sizing: border-box;
        padding: 0;
    }
    
    & div.editor-container {
        padding: 4px;
        box-shadow: 2px 2px 6px #2224 inset;
        width: 45vw;
        height: 90vh;
        border: 1px solid #ddd;
    }
    
    .editor-quicklinks {
        text-align: left;
        min-width: 12rem;

        ul {
            padding: 0;
        }
        
        li {
            list-style: none;
            cursor: pointer;
            transition: 300ms;
            padding: 0.15rem 0.5rem;
            
            &:hover {
                background-color: #747bff60;
            }
        }
    }
    
    .link {
        cursor: pointer;
        color: rebeccapurple;
        text-decoration: underline;
    }
    
    .infobox {
        background-color: #0002;
        box-shadow: 1px 1px 3px #0005;
        padding: 0.5rem;
        font-weight: bold;
    }
    
    & canvas {
        background: #1a1a1a;
    }
    
    .flex-row {
        display: flex;
        flex-direction: row;
        gap: 1rem;
        align-items: center;
    }
    
    & span.flex-row {
        display: flex;
        flex-direction: row;
        align-items: baseline;
        gap: 0;
    }
    
    .boxed {
        border: 1px solid #ddda;
        box-shadow: 1px 1px 2px #ddd4;
        padding: 0.5rem;
    }
`;

let lastChosenFilename;

const saveToFile = (text) => {
    const textBlob = new Blob([text], {type: "text/plain"});
    withTemporaryElement("a", (link) => {
        link.download = lastChosenFilename ?? "crappy_shit.glsl";
        link.href = window.URL.createObjectURL(textBlob);
        link.click();
        window.URL.revokeObjectURL(link.href);
    });
};

const withTemporaryElement = (tagName, doShit) => {
    if (!window.history.state) {
        window.history.pushState(state, title, href);
    }

    const element = document.createElement(tagName);
    document.body.appendChild(element);
    doShit(element);
    document.body.removeChild(element);
};

const functionSignature = /(float|int|vec2|vec3|vec4|void)\s+(\w*)\s*(\(.*\))/mg;

let algoWorks = true;

const countBraces = (line) => ({
    open: line.match(/\{/g)?.length ?? 0,
    close: line.match(/}/g)?.length ?? 0,
});

const isComplete = (scopeCounter) =>
    scopeCounter.open > 0 && scopeCounter.open === scopeCounter.close;

const buildFunctionLinks = (shader) => {
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
    // yeah, this algorithm breaks down if a signature spans more than one line...
    for (; lineIndex < lines.length && matchIndex < matches.length; lineIndex++) {
        try {
            line = lines[lineIndex].trim();
            doesMatch = line.startsWith(match[0]);
            if (openFunction) {
                const braces = countBraces(line);
                scopeCounter.open += braces.open;
                scopeCounter.close += braces.close;
                if (isComplete(scopeCounter)) {
                    openFunction.lineCloseIndex = lineIndex;
                    result.push(openFunction);
                    matchIndex += 1;
                    match = matches[matchIndex];
                    openFunction = null;
                }
            }
            else if (doesMatch) {
                openFunction = {
                    code: line,
                    ...functionSignatureParts(match),
                    lineIndex,
                    lineCloseIndex: undefined,
                };
                scopeCounter = countBraces(line);
            }
        } catch (err) {
            console.error(err);
            algoWorks = false;
        }
    }
    return result;
};

const handleLineJump = (aceRef, lineIndex) => {
    const editor = aceRef.current?.editor;
    if (!editor) {
        return () => {
            alert("AceEditor Ref broken.");
        };
    }
    return () => {
        editor.scrollToLine(lineIndex + 1, true, true, (...args) => {
            console.log("what is this?", args);
        })
        editor.gotoLine(lineIndex + 1, 0, true);
    };
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