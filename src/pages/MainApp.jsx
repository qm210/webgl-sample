import {useEffect, useRef, useState} from "preact/hooks";
import styled from "@emotion/styled";
import AceEditor from "react-ace";
import {useShader} from "../app/useShader.jsx";
import {useGlobalKeyPresses} from "../app/useGlobalKeyPresses.jsx";
import baseShader from "../shaders/raytracing.glsl";
import {useSignal} from "@preact/signals";
import {useRoute, useLocation} from "preact-iso";

import "ace-builds/src-noconflict/mode-glsl";
import "ace-builds/src-noconflict/ext-language_tools"

const shaderKeyBase = "qm.shader";

const fontSize = new URLSearchParams(location.search).get("fontsize") ?? "10pt";


export const MainApp = () => {
    const [state, setState] = useState({
        initShader: "",
        isLoading: true,
        shaderKey: "",
        error: "",
        wasStored: false
    });
    const route = useRoute();
    const location = useLocation();

    useEffect(() => {
        const loadShader = async (name) => {
            const result = {
                initShader: baseShader,
                shaderKey: shaderKeyBase,
            };
            if (!name) {
                return result;
            }
            try {
                const module = await import(`../shaders/${name}.glsl`);
                result.initShader = module.default || module;
                result.shaderKey = [shaderKeyBase, name].join('.');
            } catch (error) {
                console.error("Cannot load shader with name:", name, error);
                result.error = error;
            }
            return result;
        }

        loadShader(route.params.shaderId)
            .then((result) => {
                if (result.error) {
                    location.route('/');
                    return;
                }
                const storedVersion = localStorage.getItem(result.shaderKey);
                if (storedVersion) {
                    result.initShader = storedVersion;
                }
                setState(state => ({
                    ...state,
                    ...result,
                    isLoading: false,
                    wasStored: !!storedVersion,
                }));
            });
    }, [route.params, location]);

    if (state.isLoading) {
        return (
            <div className={"loading wave"}>
                <h2 className={"wave resize-wave"} style={{"--amplitude": "1rem", "--factor": 0.7}}>Hähähä.</h2>
                <h4 className={"resize-wave"}>Habs gleich.</h4>
            </div>
        );
    }

    return (
        <MainLayout
            initialShader={state.initShader}
            storageKey={state.shaderKey}
        />
    );
};

export const MainLayout = ({
    initialShader = baseShader,
    storageKey = shaderKeyBase,
    aspectRatio = 16 / 9,
}) => {
    const [shader, setShader] = useState(initialShader);
    const {
        time,
        compileFragmentShader,
        ref,
        error,
        uniforms,
        stop,
        working,
        derived,
        loopSec,
        setLoopSec,
    } = useShader(shader);
    const lastCompiledAt = useRef();
    const [options, setOptions] = useState({
        noStorage: true,
    });
    const aceRef = useRef();
    const [currentMethod, setCurrentMethod] = useState(null);

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
    }, [options.noStorage, compileFragmentShader, initialShader]);

    useEffect(() => {
        if (working.compiledAt && working.compiledAt !== lastCompiledAt.current) {
            if (!options.noStorage) {
                localStorage.setItem(storageKey, shader);
            }
            lastCompiledAt.current = working.compiledAt;
        }
    }, [working.compiledAt, shader, options.noStorage]);

    const reset = () => {
        if (!options.noStorage) {
            localStorage.removeItem(storageKey);
        }
        setShader(initialShader);
        compileFragmentShader(initialShader);
    };

    const onCursorChange = () => {
        const startIndex = aceRef.current?.editor.getSelectionRange().start.row;
        const method = derived.methods.find(m => startIndex >= m.lineIndex && startIndex <= m.lineCloseIndex);
        setCurrentMethod(method ?? null);
    };

    return (
        <Main>
            <div className={"editor-quicklinks"}>
                <ul>
                    {
                        derived.methods.map((method, index) =>
                            <li
                                key={index}
                                onClick={handleLineJump(aceRef, method.lineIndex)}
                                className={method.code === currentMethod?.code ? "infobox" : ""}
                            >
                                {method.returnType} <span className={"link"}>{method.name}{method.shortArgs}</span>
                            </li>
                        )
                    }
                </ul>
            </div>
            <div className={"editor-container"}>
                <div className={"editor-frame"}>
                    <AceEditor
                        ref={aceRef}
                        mode={"glsl"}
                        value={shader}
                        onChange={(value) => setShader(value)}
                        name={"ACE_ID"}
                        annotations={
                            error.errors.map(error => ({
                                row: error.row,
                                column: error.column,
                                type: "error",
                                text: error.message
                            }))
                        }
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
                <div className={"flex-row"} style={{marginTop: "0.5rem"}}>
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
                        onClick={() => saveToFile(working.shader)}
                    >
                        Save Textfile (the running one)
                    </button>
                </div>
            </div>
            <div className={"canvas-container"}>
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
                    <div
                        className={"code"}
                        style={{color: "red", fontSize}}
                    >
                        <div style={{fontWeight: "bold", marginTop: "0.5rem"}}>
                            {error.title}
                        </div>
                        <ErrorList
                            errors={error.errors}
                            aceRef={aceRef}
                        />
                    </div>
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
                        width: "3rem",
                        marginRight: 4,
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
    display: flex;
    justify-content: space-evenly;
    align-items: stretch;
    gap: 0.5rem;
    padding: 0 0.5rem;
    
    & div.editor-frame {
        padding: 4px;
        box-shadow: 2px 2px 6px #2224 inset;
        height: 90vh;
        border: 1px solid #ddd;
    }
    
    & div.canvas-container, div.editor-container {
        flex: 1;
    }
    
    .editor-quicklinks {
        text-align: left;
        min-width: 12rem;
        font-family: monospace;

        ul {
            padding: 0;
        }
        
        li {
            list-style: none;
            cursor: pointer;
            transition: 300ms;
            padding: 0.15rem 0.5rem;
            white-space: nowrap;
            
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
    
    .code {
        text-align: left;
        font-family: monospace;
    }
    
    .error-grid {
        display: grid;
        grid-template-columns: auto 1fr;
        cursor: pointer;
        margin-top: 0.5rem;
        
        & > div:nth-of-type(2n+1) {
            padding-right: 0.5rem;
        }
    }
    
    & span.flex-row {
        display: flex;
        flex-direction: row;
        gap: 0;
    }
    
    .boxed {
        border: 1px solid #ddda;
        box-shadow: 1px 1px 2px #ddd4;
        padding: 0.5rem;
    }

    input {
        padding: 0.25rem;
        font-size: larger;
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

const withTemporaryElement = (tagName, doStuff) => {
    if (!window.history.state) {
        window.history.pushState(state, title, href);
    }

    const element = document.createElement(tagName);
    document.body.appendChild(element);
    doStuff(element);
    document.body.removeChild(element);
};

const handleLineJump = (aceRef, lineIndex, column = 0) => {
    const editor = aceRef.current?.editor;
    if (!editor) {
        return () => {
            alert("AceEditor Ref broken.");
        };
    }
    return () => {
        editor.scrollToLine(lineIndex + 1, true, true);
        editor.gotoLine(lineIndex + 1, column, true);
    };
};

const ErrorList = ({errors, aceRef}) => {
    const hover = useSignal(null);
    return (
        <div className={"error-grid"}>
            {
                errors.map((e, i) =>
                    <ErrorLine
                        key={i}
                        error={e}
                        index={i}
                        hover={hover}
                        aceRef={aceRef}
                    />
                )
            }
        </div>
    );
};

const ErrorLine = ({error, index, hover, aceRef}) => {
    const handlers = {
        onClick: () => {
            console.log(error);
            handleLineJump(aceRef, error.row, error.column)();
        },
        onMouseEnter: () => {
            hover.value = index
        },
        onMouseLeave: () => {
            hover.value = null
        },
    };

    const style = {
        backgroundColor: hover.value === index ? '#ffff0044' : undefined,
    };

    return (
        <>
            <div {...handlers} style={style}>
                l.{error.row}:
            </div>
            <div {...handlers} style={style}>
                {error.message}
            </div>
        </>
    );
};
