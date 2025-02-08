import baseShader from "../shaders/raytracing.glsl";
import {fontSize, shaderKeyBase} from "../app/globals.js";
import {useEffect, useRef, useState} from "preact/hooks";
import {useShader} from "../app/useShader.jsx";
import {useGlobalKeyPresses} from "../app/useGlobalKeyPresses.jsx";
import styled from "@emotion/styled";
import {ErrorList} from "./Errors.jsx";
import {Uniforms} from "./Uniforms.jsx";
import {saveToFile} from "../lib/dom.jsx";
import {ShaderEditor} from "./ShaderEditor.jsx";
import {signal} from "@preact/signals";
import {handleLineJump} from "../lib/aceHelpers.js";

export const currentMethod = signal(null);

export const options = signal({
    noStorage: true
});
const toggleOption = (key) => {
    options.value = {
        ...options.value,
        [key]: !options.value[key]
    };
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
        analyzed,
        loopSec,
        setLoopSec,
    } = useShader(shader);
    const lastCompiledAt = useRef();

    useGlobalKeyPresses([{
        key: "Enter",
        ctrlKey: true,
        handle: () => compileFragmentShader(shader)
    }]);

    useEffect(() => {
        console.log("Reload.", new Date(), options.value.noStorage ? "[Disable Storage]" : "");
        if (options.value.noStorage) {
            compileFragmentShader(initialShader);
            setShader(initialShader);
        }
    }, [options.value.noStorage, compileFragmentShader, initialShader]);

    useEffect(() => {
        if (working.compiledAt && working.compiledAt !== lastCompiledAt.current) {
            if (!options.value.noStorage) {
                localStorage.setItem(storageKey, shader);
            }
            lastCompiledAt.current = working.compiledAt;
        }
    }, [working.compiledAt, shader, options.value.noStorage]);

    const reset = () => {
        if (!options.value.noStorage) {
            localStorage.removeItem(storageKey);
        }
        setShader(initialShader);
        compileFragmentShader(initialShader);
    };

    return (
        <Main>
            <div className={"editor-quicklinks"}>
                <ul>
                    {
                        analyzed.methods.map((method, index) =>
                            <li
                                key={index}
                                onClick={handleLineJump(method.lineIndex)}
                                className={method.code === currentMethod?.code ? "infobox" : ""}
                            >
                                {method.returnType} <span className={"link"}>{method.name}{method.shortArgs}</span>
                            </li>
                        )
                    }
                </ul>
            </div>
            <ShaderEditor
                value={shader}
                onChange={(value) => setShader(value)}
                error={error}
                analyzed={analyzed}
                onApply={() => compileFragmentShader(shader)}
                onStop={stop}
                onReset={reset}
                onToggleStorage={() => {
                    toggleOption("noStorage");
                }}
                onSaveToFile={() => saveToFile(working.shader)}
            />
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
                        />
                    </div>
                </div>
            </div>
        </Main>
    );
};

const Main = styled.div`
    display: flex;
    justify-content: space-evenly;
    align-items: stretch;
    gap: 0.5rem;
    padding: 0 0.5rem;
    height: 100vh;
    
    & div.canvas-container {
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
        margin: 0.25rem;
        gap: 0.25rem;
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
    
    input {
        padding: 0.25rem;
        font-size: larger;
    }
`;
