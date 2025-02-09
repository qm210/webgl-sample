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
            console.log("[GL] Using WEBGL2");
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
            frame: null,
            framePong: null,
        },
        location: null,
        maxPass: 1,
    });
    const [uniforms, setUniforms] = useState({
        iResolution: null,
        iAspectRatio: null,
        iPass: 0,
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
        measureSec: null,
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

        if (shaderObj.program && !error) {
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

    /* RENDER LOOP */
    const render = useCallback((gl, iTime) => {
        const s = shader.current;
        const p = s.program;
        if (!p) {
            return;
        }
        if (!s.location) {
            // gets reset after a new shader compilated, i.e. run once.
            s.location = {
                iTime: gl.getUniformLocation(p, "iTime"),
                iResolution: gl.getUniformLocation(p, "iResolution"),
                iAspectRatio: gl.getUniformLocation(p, "iAspectRatio"),
                iPass: gl.getUniformLocation(p, "iPass"),
                previousFrame: gl.getUniformLocation(p, "previousFrame"),
            };
            s.maxPass = tryParseMaxPass(s.fragShaderCode);
            s.frame = 0;

            // IMPORTANT: first useProgram() before you can use the program ;) make sense, yes. but is important.
            gl.useProgram(p);
        } else {
            s.frame += 1;
        }

        const attribLocation = gl.getAttribLocation(p, "position");
        gl.enableVertexAttribArray(attribLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, s.buffer.vertex);
        gl.vertexAttribPointer(attribLocation, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, s.buffer.index);

        // Pass the uniforms ...
        gl.uniform1f(s.location.iTime, iTime);
        if (uniforms.iResolution) {
            gl.uniform2fv(s.location.iResolution, uniforms.iResolution);
        }
        if (uniforms.iAspectRatio) {
            gl.uniform1f(s.location.iAspectRatio, uniforms.iAspectRatio);
        }
        // <-- ... extend further uniforms as required. ...

        // TODO: this somewhat mixes the concepts of "pass" with the
        // drawing-on-the-backbuffer concept.
        // maybe we should just use another fragshader that just passes
        // the texture to the front, but anyway.

        //gl.uniform1i(s.location.previousFrame, 0);
        // not needed, as said said: https://learnopengl.com/Getting-started/Textures
        // All that's left to do now is to bind the texture before calling glDrawElements
        // and it will then automatically assign the texture to the fragment shader's sampler:
        // glBindTexture(GL_TEXTURE_2D, texture);

        // this is the two-iPass-loop-solution --->
        const [fbo1, fbo2] = (s.frame % 2 === 0)
            ? [s.buffer.framePing, s.buffer.framePong]
            : [s.buffer.framePong, s.buffer.framePing];

        gl.uniform1i(s.location.iPass, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo1.fbo);
        gl.drawElements(gl.TRIANGLE_STRIP, 4, gl.UNSIGNED_SHORT, 0);

        gl.uniform1i(s.location.iPass, 1);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // draw on screen
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, fbo1.texture);
        gl.drawElements(gl.TRIANGLE_STRIP, 4, gl.UNSIGNED_SHORT, 0);
        // <----

        /*
        // THIS IS THE SINGLE PASS WAY HAT WORKS
        gl.uniform1i(s.location.iPass, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // draw on screen
        gl.drawElements(gl.TRIANGLE_STRIP, 4, gl.UNSIGNED_SHORT, 0);
         */
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
                perfMeasure.current.cursor = 0;
            }

            try {
                render(glRef.current, iTime);
                animationRef.current = requestAnimationFrame(runLoop);
            } catch(err) {
                console.error("Render error", err);
            }

            perfMeasure.current.cursor += 1;
            if (perfMeasure.current.cursor >= perfMeasure.current.cycles) {
                const now = performance.now();
                perfMeasure.current.measureSec = 0.001 * (now - perfMeasure.current.start) / perfMeasure.current.cycles;
                perfMeasure.current.start = now;
                perfMeasure.current.cursor = 0;
                console.log("[PERFORMANCE] render loop avg. seconds", perfMeasure.current.measureSec);
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
            console.log("[Cleanup] ... should delete the framebuffer / texture stuff ...");
            // console.log("trying to lose Context...");
            // glRef.current?.getExtension("WEBGL_lose_context")?.loseContext();
        };
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

    const framePing = createFBO(gl);
    const framePong = createFBO(gl);
    // QUESTion:
    // what is depth buffer support, why use?
    // what is the depth buffer internal format, why DEPTH_COMPONENT24 ?

    return {
        vertex: vBuff,
        index: iBuff,
        framePing,
        framePong,
    };
}

function initShaderProgram(gl, fragmentShader, currentObj) {
    let error = "";
    const obj = !currentObj ? {
        vert: null,
        vertShaderCode: vertexShader,
        frag: null,
        fragShaderCode: fragmentShader,
        program: null,
    } : {...currentObj};

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
    if (obj.program && obj.frag) {
        glConsoleLog("-- DETACH & DELETE FRAGMENT SHADER");
        gl.detachShader(obj.program, obj.frag);
        gl.deleteShader(obj.frag);
    }
    obj.frag = frag;
    obj.fragShaderCode = fragmentShader;

    if (obj.program) {
        glConsoleLog("-- DELETE SHADER PROGRAM")
        gl.deleteProgram(obj.program);
    }
    glConsoleLog("--> CREATE NEW PROGRAM")
    obj.program = gl.createProgram();
    gl.attachShader(obj.program, obj.vert);
    gl.attachShader(obj.program, obj.frag);
    gl.linkProgram(obj.program);
    if (!gl.getProgramParameter(obj.program, gl.LINK_STATUS)) {
        error = "Shader Linking Error: " + gl.getProgramInfoLog(obj.program);
        gl.deleteProgram(obj.program);
        obj.program = null;
    }

    return [obj, error];
}

function createFBO(gl, withDepthBuffer = false) {
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // <-- format gl.FLOAT could look like the following (see tables at https://registry.khronos.org/OpenGL-Refpages/es3.1/)
    // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGB, gl.FLOAT, null);
    // but throws one of these:
    // [.WebGL-0x1dd400107100] GL_INVALID_FRAMEBUFFER_OPERATION: Framebuffer is incomplete: Attachment is not renderable.
    // [.WebGL-0x1dd402129400] GL_INVALID_FRAMEBUFFER_OPERATION: Framebuffer is incomplete: Attachment has zero size.

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    // <-- now the texture is the framebuffer's render target, I should not

    // need bindTexture() again if I do not call any gl.tex...(...) again.
    gl.bindTexture(gl.TEXTURE_2D, null);

    // QUESTions:
    // ... all these constants / parameters? what are teh options of se meeeaninginging???
    // play around: how can this fuck it up?

    // they say it is better with depth - TODO - find out why / compare. :)
    // QUESTion: what is "DEPTH"?
    let depthBuffer = null;
    if (withDepthBuffer) {
        depthBuffer = gl.createRenderbuffer();
        const depthInternalFormat = gl.DEPTH_COMPONENT24;
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, depthInternalFormat, width, height);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);
    }

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
        console.error("[GL][CREATE_FBO] not complete:", status);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return {
        fbo,
        texture,
        depthBuffer
    };
}

const FIND_DUMB_IPASS_COMPARISON = /iPass\s*==\s*(\d+)/g;

const tryParseMaxPass = (shader) => {
    let maxCompared = 0;
    for (const match of shader.matchAll(FIND_DUMB_IPASS_COMPARISON)) {
        const compared = +match[1];
        maxCompared = Math.max(maxCompared, compared);
    }
    return maxCompared;
};
