import {useCallback, useEffect, useRef, useState} from "preact/hooks";

const getContext = (canvas) => (
    canvas.getContext('webgl') ||
    canvas.getContext('experimental-webgl')
);

const vertexShader = `
attribute vec3 position; 
void main(void) {
    gl_Position = vec4(position, 1.0);
}`;

export const useShader = (fragShaderCode) => {
    const ref = useRef();
    const glRef = useRef();
    const [time, setTime] = useState(0);
    const [error, setError] = useState(null);
    const [compiledAt, setCompiledAt] = useState(null);
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
    const initFragShader = useRef(fragShaderCode);
    const timeZero = useRef();
    const running = useRef(true);
    const animationRef = useRef();

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
        if (shaderObj.prog) {
            shader.current = shaderObj;
            setCompiledAt(Date.now());
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

    const render = useCallback((gl, iTime) => {
        const p = shader.current.prog;
        gl.useProgram(p);
        let uID = gl.getUniformLocation(p, "iTime");
        gl.uniform1f(uID, iTime);
        let attId = gl.getAttribLocation(p, "position");
        gl.enableVertexAttribArray(attId);
        gl.bindBuffer(gl.ARRAY_BUFFER, shader.current.buffer.vertex);
        gl.vertexAttribPointer(attId, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shader.current.buffer.index);
        gl.drawElements(gl.TRIANGLE_STRIP, 4, gl.UNSIGNED_SHORT, 0);
    }, [shader.current]);

    useEffect(() => {
        /*
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const vsSource = `
            attribute vec3 aPosition;
            void main() {
                gl_Position = vec4(aPosition, 1.0);
            }
        `;
        const fsSource = fragmentCode.value;

        // Compile vertex shader
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vsSource);
        gl.compileShader(vertexShader);
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            console.error('Error compiling vertex shader:', gl.getShaderInfoLog(vertexShader));
            return;
        }

        // Compile fragment shader
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fsSource);
        gl.compileShader(fragmentShader);
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            console.error('Error compiling fragment shader:', gl.getShaderInfoLog(fragmentShader));
            return;
        }

        // Create program
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Error linking shader program:', gl.getProgramInfoLog(program));
            return;
        }

        const positionAttributeLocation = gl.getAttribLocation(program, 'aPosition');
        // Set up position attribute
        gl.enableVertexAttribArray(positionAttributeLocation);

        // Create buffer for positions and indices
        const positionBuffer = gl.createBuffer();
        const indexBuffer = gl.createBuffer();

        // Fill buffer with data
        const positions = new Float32Array(
            [
                -1.0, -1.0, 0.0,
                -1.0, 1.0, 0.0,
                1.0, 1.0, 0.0,
                1.0, -1.0, 0.0
            ]
        );
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        const indices = new Uint16Array(
            [0, 1, 3, 2]
        );
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        // Tell WebGL how to pull out the positions from the buffer into the shader
        gl.vertexAttribPointer(
            positionAttributeLocation,     // The attribute whose value we want to compute
            2,                             // Size of each component per color
            gl.FLOAT,                     // Data type of the buffer array
            false,                         // Normalize the data?
            0,                             // Stride (how many bytes between consecutive values)
            null                           // Offset of the first element (in array if multiple)
        );

        // now the actual application to the document
        gl.viewport(0, 0, canvas.width, canvas.height);
         */

        let iTime;

        function initWebGL(gl) {
            if (!gl) {
                alert("Unable to initialize WebGL. Your browser may not support it.");
                return;
            }
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
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
            setTime(iTime);

            try {
                render(glRef.current, iTime);
                animationRef.current = requestAnimationFrame(runLoop);
            } catch(err) {
                console.error("Render error", err);
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
        }
    }, [ref.current, render, restart]);

    return {
        ref,
        time,
        compileFragmentShader,
        error,
        resetTimer,
        stop,
        compiledAt,
    };
};

function initBuffers(gl) {
    let vertices = new Float32Array([
        -1.0, -1.0, 0.0,
        -1.0, 1.0, 0.0,
        1.0, 1.0, 0.0,
        1.0, -1.0, 0.0
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
        fragShaderCode: fragmentShader,
    };

    if (obj.prog) {
        gl.detachShader(obj.prog, obj.frag);
    }

    if (!obj.vert) {
        obj.vert = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(obj.vert, obj.vertShaderCode);
        gl.compileShader(obj.vert);
        if (!gl.getShaderParameter(obj.vert, gl.COMPILE_STATUS)) {
            error = "Vertex Shader Compiler Error: " + gl.getShaderInfoLog(obj.vert);
            gl.deleteShader(obj.vert);
            return [obj, error];
        }
    }

    obj.frag = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(obj.frag, obj.fragShaderCode);
    gl.compileShader(obj.frag);
    if (!gl.getShaderParameter(obj.frag, gl.COMPILE_STATUS)) {
        error = "Fragment Shader Compiler Error: \n\n" + gl.getShaderInfoLog(obj.frag);
        gl.deleteShader(obj.frag);
        return [obj, error];
    }

    obj.prog = gl.createProgram();
    gl.attachShader(obj.prog, obj.vert);
    gl.attachShader(obj.prog, obj.frag);
    gl.linkProgram(obj.prog);
    if (!gl.getProgramParameter(obj.prog, gl.LINK_STATUS)) {
        error = "Shader Linking Error: " + gl.getProgramInfoLog(obj.prog);
    }

    if (!!currentObj) {
        gl.deleteProgram(currentObj.prog);
    }

    return [obj, error];
}
