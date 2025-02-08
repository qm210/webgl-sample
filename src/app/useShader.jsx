import {useCallback, useEffect, useMemo, useRef, useState} from "preact/hooks";
import {buildFunctionLinks} from "./buildFunctionLinks.jsx";

const USE_WEBGL_2 = true;

const DEBUG_VERBOSE = true;
const DEBUG_GL_VERBOSE = false;

const consoleLog = (...args) => DEBUG_VERBOSE && console.log("[DEBUG]", ...args);
const consoleIfError = (error) => DEBUG_VERBOSE && error && console.error(error);
const glConsoleLog = (...args) => DEBUG_GL_VERBOSE && console.log("[DEBUG][GL]", ...args);
const glConsoleIfError = (error) => DEBUG_VERBOSE && error && console.error(error);

const getContext = (canvas) => {
    // hint: getContext() also takes params like e.g.
    // { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
    // and there is gl.getExtension('...');!
    let context;
    if (USE_WEBGL_2) {
        context = canvas.getContext('webgl2');
        if (context) {
            return context;
        } else {
            console.warn("You don't support WebGL2, trying WebGL1...");
        }
    }
    context = (
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl')
    );
    if (!context) {
        alert("No WebGL available, what is this, Internet Explorer 0.1?");
    }
    return context;
};

const vertexShader = `
#version 300 es

in vec3 position;
 
void main(void) {
    gl_Position = vec4(position, 1.0);
}`.trim();

const errorRegex = /ERROR: (\d+):(\d+): (.*)/;

const daySeconds = 60 * 60 * 24;

export const useShader = (fragShaderCode) => {
    const ref = useRef();
    const glRef = useRef();
    const [time, setTime] = useState(0);
    const [error, setError] = useState(null);
    const shader = useRef({
        vert: null,
        frag: null,
        prog: null,
        vertShaderCode: null,
        fragShaderCode: null,
        buffer: {
            vertex: null,
            index: null,
        },
    });
    const [uniforms, setUniforms] = useState({
        iResolution: null,
        iAspectRatio: null,
    });
    const [loopSec, setLoopSec] = useState(null);
    const initFragShader = useRef(fragShaderCode);
    const timeZero = useRef();
    const running = useRef(true);
    const animationRef = useRef();
    const perfMeasure = useRef({
        cycles: 1000,
        cursor: 0,
        start: null,
        end: null
    });

    // about the current fragment shader
    const [working, setWorking] = useState({
        shader: null,
        compiledAt: null,
    });

    const resetTimer = useCallback(() => {
        timeZero.current = undefined;
    }, []);

    const stop = useCallback(() => {
        // need to reload after that, for now
        running.current = false;
    }, []);

    const restart = useCallback(() => {
        running.current = true;
        resetTimer();
    }, [resetTimer]);

    const compileFragmentShader = useCallback((newFragmentShader) => {
        const [shaderObj, error] =
            initShaderProgram(glRef.current, newFragmentShader, shader.current);
        consoleLog("Compiled.", shaderObj);
        consoleIfError(error);

        if (shaderObj.prog && !error) {
            shader.current = shaderObj;
            setWorking({
                shader: shaderObj.fragShaderCode,
                compiledAt: Date.now()
            });
        }
        setError(error);
    }, [resetTimer]);

    useEffect(() => {
        if (error) {
            stop();
        } else {
            restart();
        }
    }, [error, stop, restart]);

    useEffect(() => {
        if (!ref.current) {
            return;
        }
        const rect = ref.current.getBoundingClientRect();
        setUniforms(state => ({
            ...state,
            iResolution: [rect.width, rect.height],
            iAspectRatio: rect.height / rect.width,
        }));
        // width/height attributes actually set the inner resolution, not the client size
        ref.current.width = rect.width;
        ref.current.height = rect.height;
    }, []);

    const render = useCallback((gl, iTime) => {
        const p = shader.current.prog;
        if (!p) {
            return;
        }
        gl.useProgram(p);
        gl.uniform1f(
            gl.getUniformLocation(p, "iTime"),
            iTime
        );
        if (uniforms.iResolution) {
            gl.uniform2fv(
                gl.getUniformLocation(p, "iResolution"),
                uniforms.iResolution,
            );
        }
        if (uniforms.iAspectRatio) {
            gl.uniform1f(
                gl.getUniformLocation(p, "iAspectRatio"),
                uniforms.iAspectRatio,
            );
        }
        // <-- extend further uniforms as required.

        const attribLocation = gl.getAttribLocation(p, "position");
        gl.enableVertexAttribArray(attribLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, shader.current.buffer.vertex);
        gl.vertexAttribPointer(attribLocation, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shader.current.buffer.index);
        gl.drawElements(gl.TRIANGLE_STRIP, 4, gl.UNSIGNED_SHORT, 0);
    }, [shader.current, uniforms]);

    useEffect(() => {
        let iTime;

        function initWebGL(gl) {
            glConsoleLog("INIT WEB GL", gl);
            if (!gl) {
                alert("Unable to initialize WebGL. Your browser may not support it.");
                return;
            }
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            // gl.viewport(0, 0, 300, 150);
            let error;
            [shader.current, error] = initShaderProgram(gl, initFragShader.current);
            shader.current.buffer = initBuffers(gl);
            setError(error);
        }

        function runLoop(now) {
            if (!running.current) {
                return;
            }
            if (timeZero.current === undefined) {
                timeZero.current = now;
            }
            iTime = 0.001 * (now - timeZero.current);
            if (loopSec !== null) {
                if (loopSec === 0.) {
                    iTime = 0.;
                } else while (iTime > loopSec) {
                    iTime -= loopSec;
                }
            }
            setTime(iTime);

            if (perfMeasure.current.start === null) {
                perfMeasure.current.start = performance.now();
                perfMeasure.current.cursor = perfMeasure.current.cycles;
            } else if (perfMeasure.current.cursor > 0) {
                perfMeasure.current.cursor -= 1;
            }

            try {
                render(glRef.current, iTime);
                animationRef.current = requestAnimationFrame(runLoop);
            } catch(err) {
                console.error("Render error", err);
            }

            if (perfMeasure.current.cursor === 0) {
                perfMeasure.current.end = performance.now();
                perfMeasure.current.cursor -= 1;
                console.log(
                    "[PERFORMANCE MEASUREMENT], cycles: ",
                    perfMeasure.current.cycles,
                    "took seconds: ",
                    0.001 * (perfMeasure.current.end - perfMeasure.current.start)
                );
            }
        }

        if (!glRef.current) {
            glRef.current = getContext(ref.current);
            initWebGL(glRef.current);
        }
        runLoop();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                restart();
            }

            // console.log("trying to lose Context...");
            // glRef.current?.getExtension("WEBGL_lose_context")?.loseContext();
        }
    }, [ref.current, render, restart, loopSec]);

    const shaderError = useMemo(() => {
        const lines = error?.split('\n');
        const result = {
            raw: error,
            title: lines?.shift().trim(),
            errors: [],
        }
        if (result.title !== "Fragment Shader Compiler Error:") {
            return result;
        }
        lines.shift();
        for (const line of lines) {
            const match = line.match(errorRegex);
            if (!match) {
                continue;
            }
            result.errors.push({
                line,
                column: +match[1],
                row: +match[2],
                message: match[3]
            });
        }
        return result;
    }, [error]);

    const analyzed = useMemo(() => {
        const methods = buildFunctionLinks(working.shader);
        consoleLog("Analyzed Methods:", methods);
        return {
            methods: buildFunctionLinks(working.shader)
        };
    }, [working]);

    return {
        ref,
        time,
        compileFragmentShader,
        error: shaderError,
        resetTimer,
        stop,
        working,
        analyzed,
        uniforms,
        setUniforms,
        loopSec,
        setLoopSec,
    };
};

function initBuffers(gl) {
    glConsoleLog("INIT BUFFERS CALLED");
    let vertices = new Float32Array([
        -1.0, -1.0, 0.0,
        -1.0, +1.0, 0.0,
        +1.0, +1.0, 0.0,
        +1.0, -1.0, 0.0
    ]);
    const vBuff = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuff);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    let indices = new Uint16Array([0, 1, 3, 2]);
    const iBuff = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuff);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    return {vertex: vBuff, index: iBuff};
}

function initShaderProgram(gl, fragmentShader, currentObj) {
    let error = "";
    const obj = !currentObj ? {
        vert: null,
        vertShaderCode: vertexShader,
        frag: null,
        fragShaderCode: fragmentShader,
        prog: null,
    } : {
        ...currentObj,
    };

    if (!obj.vert) {
        glConsoleLog("CREATE NEW VERTEX SHADER")
        obj.vert = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(obj.vert, obj.vertShaderCode);
        gl.compileShader(obj.vert);
        if (!gl.getShaderParameter(obj.vert, gl.COMPILE_STATUS)) {
            error = "Vertex Shader Compiler Error: " + gl.getShaderInfoLog(obj.vert);
            gl.deleteShader(obj.vert);
            return [obj, error];
        }
    }

    glConsoleLog("CREATE NEW FRAGMENT SHADER");
    const frag = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(frag, fragmentShader);
    gl.compileShader(frag);
    if (!gl.getShaderParameter(frag, gl.COMPILE_STATUS)) {
        error = "Fragment Shader Compiler Error: \n\n" + gl.getShaderInfoLog(frag);
        gl.deleteShader(frag);
        return [obj, error];
    }
    if (obj.prog && obj.frag) {
        glConsoleLog("-- DETACH & DELETE FRAGMENT SHADER");
        gl.detachShader(obj.prog, obj.frag);
        gl.deleteShader(obj.frag);
    }
    obj.frag = frag;
    obj.fragShaderCode = fragmentShader;

    if (obj.prog) {
        glConsoleLog("-- DELETE SHADER PROGRAM")
        gl.deleteProgram(obj.prog);
    }
    glConsoleLog("--> CREATE NEW PROGRAM")
    obj.prog = gl.createProgram();
    gl.attachShader(obj.prog, obj.vert);
    gl.attachShader(obj.prog, obj.frag);
    gl.linkProgram(obj.prog);
    if (!gl.getProgramParameter(obj.prog, gl.LINK_STATUS)) {
        error = "Shader Linking Error: " + gl.getProgramInfoLog(obj.prog);
        gl.deleteProgram(obj.prog);
        obj.prog = null;
    }

    return [obj, error];
}
