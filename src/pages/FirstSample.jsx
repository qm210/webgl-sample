import {useEffect, useRef, useState} from "preact/hooks";
import styled from "@emotion/styled";
import {useShader} from "../app/useShader.jsx";



const shaderKey = "qm.shader";

const initFragmentCode = localStorage.getItem(shaderKey) ?? `
precision mediump float;
uniform float iTime;
void main(void) {
    vec2 st = gl_FragCoord.xy / vec2(640, 480);
    float r = sin(iTime + 8.0 * 3.14159265359 * st.x);
    float g = fract(sin(3.0 * 3.14159265359 * st.y));   
    float b = sin(iTime + 3.14159265359 * st.x * st.y);
    vec3 color = vec3(r, b, g);
    gl_FragColor = vec4(color, 1.0);
}
`;

const aspectRatio = 16 / 9;

const fontSize = new URLSearchParams(location.search).get("fontsize") ?? "14pt";

const useGlobalKeyPresses = (actions) => {
    useEffect(() => {
        const handle = (event) => {
            for (const action of actions) {
                const match =
                    event.key === action.key &&
                    !!action.shiftKey === !!event.shiftKey &&
                    !!action.ctrlKey === !!event.ctrlKey &&
                    !!action.altKey === !!event.altKey;
                if (match) {
                    action.handle();
                }
            }
        };
        window.addEventListener('keyup', handle);
        return () => {
            window.removeEventListener('keyup', handle);
        }
    }, [actions]);
};


export const FirstSample = () => {
    const [shader, setShader] = useState(initFragmentCode.trim());
    const {time, compileFragmentShader,  ref, error, compiledAt, stop} = useShader(shader);
    const lastCompiledAt = useRef();

    useGlobalKeyPresses([{
        key: "Enter",
        ctrlKey: true,
        handle: () => compileFragmentShader(shader)
    }]);

    useEffect(() => {
        if (compiledAt && compiledAt !== lastCompiledAt.current) {
            localStorage.setItem(shaderKey, shader);
            lastCompiledAt.current = compiledAt;
        }
    }, [compiledAt, shader]);

    return (
        <Main>
            <div>
                <textarea
                    value={shader}
                    onChange={e => setShader(e.target.value)}
                    style={{
                        fontSize,
                        lineHeight: "150%"
                    }}
                />
                <div className={"flex-row"}>
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
                </div>
            </div>
            <div>
                <canvas ref={ref}/>
                <div>
                    {time.toFixed(3)} sec.
                </div>
            </div>
        </Main>
    )
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
        min-width: 20vw;
        box-sizing: border-box;
        padding: 0;
    }
    
    & textarea {
        resize: none;
        padding: 0.5em;
        width: 45vw;
        height: 90vh;
    }
    
    & canvas {
        width: 45vw;
        height: ${Math.round(45 / aspectRatio)}vw;

        background: #1a1a1a;
    }
    
    .flex-row {
        display: flex;
        flex-direction: row;
        gap: 1rem;
        align-items: center;
    }
`;
