import {signal} from "@preact/signals";
import {useEffect, useRef} from "preact/hooks";
import styled from "@emotion/styled";


const fragmentCode = signal(
`precision mediump float;
uniform float iTime;
void main(void) {
    vec2 st = gl_FragCoord.xy / vec2(640, 480);
    float r = sin(iTime + 8.0 * 3.14159265359 * st.x);
    float g = fract(sin(3.0 * 3.14159265359 * st.y));   
    float b = sin(iTime + 3.14159265359 * st.x * st.y);
    vec3 color = vec3(r, b, g);
    gl_FragColor = vec4(color, 1.0);
}
`);

const time = signal(0);


const useShader = () => {
    const ref = useRef();

    useEffect(() => {
        /*
        const canvas = ref.current;
        const gl = canvas.getContext('webgl') ||canvas.getContext('experimental-webgl');

        if (!gl) {
            alert('Unable to initialize WebGL. Your browser may not support it.');
        }

        gl.clearColor(0, 0, 2, 1);
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

        const programInfo = {
            attribLocations: {
                position: positionAttributeLocation
            },
            uniformLocations: {}
        };

        function drawScene() {
            gl.useProgram(program);
            const locTime = gl.getUniformLocation(program, "iTime");
            gl.uniform1f(locTime, time.value);
            const locAtt = gl.getAttribLocation(program, "position");
            gl.enableVertexAttribArray(locAtt);
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.vertexAttribPointer(locAtt, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            gl.drawElements(gl.TRIANGLE_STRIP, 4, gl.UNSIGNED_SHORT, 0);

            // Draw the triangle!
            // gl.drawArrays(gl.TRIANGLES, 0, 3);

            // requestAnimationFrame(drawScene);
        }

        // Get the resolution of the canvas
        const canvasWidth = canvas.clientWidth;
        const canvasHeight = canvas.clientHeight;

        // Resize the canvas when it changes
        window.addEventListener('resize', () => {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
            drawScene();
        });

        const loop = (now) => {
            time.value = 0.001 * now;
            drawScene();
            requestAnimationFrame(loop);
        };

        // Initial call to draw the scene
        console.log("restart.");
        requestAnimationFrame(loop);
         */
        let gl;
        let sId;
        let vBuff;
        let iBuff;
        let timer = 0;

        function initWebGL() {
            // let canvas = document.getElementById("glcanvas");
            const canvas = ref.current;
            gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
            if (!gl) {
                alert("Unable to initialize WebGL. Your browser may not support it.");
                return;
            }
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            initShaderProgram();
            initBuffers();
        }

        function initShaderProgram() {
            sId = gl.createProgram();
            let vertId = gl.createShader(gl.VERTEX_SHADER);
            let fragId = gl.createShader(gl.FRAGMENT_SHADER);
            const vert = `
                attribute vec3 position; 
                void main(void) {
                    gl_Position = vec4(position, 1.0);
                }            
            `;
            const frag = fragmentCode.value;

            gl.shaderSource(vertId, vert);
            gl.shaderSource(fragId, frag);
            gl.compileShader(vertId);
            gl.compileShader(fragId);
            if (!gl.getShaderParameter(vertId, gl.COMPILE_STATUS)) {
                alert("Vertex Shader Compiler Error: " + gl.getShaderInfoLog(vertId));
                gl.deleteShader(vertId);
                return;
            }
            if (!gl.getShaderParameter(fragId, gl.COMPILE_STATUS)) {
                alert("Fragment Shader Compiler Error: " + gl.getShaderInfoLog(fragId));
                gl.deleteShader(fragId);
                return;
            }
            gl.attachShader(sId, vertId);
            gl.attachShader(sId, fragId);
            gl.linkProgram(sId);
            if (!gl.getProgramParameter(sId, gl.LINK_STATUS)) {
                alert("Shader Linking Error: " + gl.getProgramInfoLog(sId));
            }
        }

        function initBuffers() {
            let vertices = new Float32Array([
                -1.0, -1.0, 0.0,
                -1.0, 1.0, 0.0,
                1.0, 1.0, 0.0,
                1.0, -1.0, 0.0
            ]);
            vBuff = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, vBuff);
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
            let indices = new Uint16Array([0, 1, 3, 2]);
            iBuff = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuff);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
        }

        let firstNow;
        function animationLoop(now) {
            if (firstNow === undefined) {
                firstNow = now;
            }
            time.value = 0.001 * (now - firstNow);
            requestAnimationFrame(animationLoop);
            render();
        }

        function render() {
            timer += 0.1;
            gl.useProgram(sId);
            let uID = gl.getUniformLocation(sId, "iTime");
            gl.uniform1f(uID, timer);
            let attId = gl.getAttribLocation(sId, "position");
            gl.enableVertexAttribArray(attId);
            gl.bindBuffer(gl.ARRAY_BUFFER, vBuff);
            gl.vertexAttribPointer(attId, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuff);
            gl.drawElements(gl.TRIANGLE_STRIP, 4, gl.UNSIGNED_SHORT, 0);
        }

        function start() {
            initWebGL();
            animationLoop();
        }

        start();
    }, [ref.current]);

    return ref;
};

const aspectRatio = 4 / 3;

const fontSize = new URLSearchParams(location.search).get("fontsize") ?? 12;

console.log("Aspect Ratio", aspectRatio, "Font Size:", fontSize);

export const FirstSample = () => {
    const canvasRef = useShader();

    return (
        <Main>
            <div>
                <textarea
                    value={fragmentCode}
                    onChange={e => {
                        fragmentCode.value = e.target.value;
                    }}
                />
            </div>
            <div>
                <canvas ref={canvasRef}/>
                <div>
                    {time.value.toFixed(3)} sec.
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
        font-size: 12pt;
    }
    
    & canvas {
        width: 45vw;
        height: ${Math.round(45 / aspectRatio)}vw;

        background: #1a1a1a;
    }
`;
