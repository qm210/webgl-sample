#version 300 es  // For WebGL 2 (GLSL ES 3.00)

precision mediump float;

out vec4 FragColor;

uniform float iTime;
uniform vec2 iResolution;
uniform float iAspectRatio;

float colors[9] = float[9](
    0.1, 0.3, 0.6,
    0.13, 0.50, 0.87,
    0.29, 0.97, 1.0
);

float pos[6] = float[6](0., 0., 0., 0., 0., 0.);

float random(vec2 uv)
{
    return fract(sin(dot(uv,vec2(12.9898,78.233)))*43758.5453123);
}

float rnd(float x)
{
    return fract(sin(x*78.233)*43758.5453123);
}

vec2 rndVec2() {
    return vec2(rnd(iTime), rnd(iTime+0.1));
}

void mainColor(inout vec3 color, in vec2 uv) {
    if (uv.x > 0.) {
        color.y = 1.;
    }
    if (uv.y > 0.) {
        color.z = 1.;
    }
}

void main() {
    vec2 uv = (2. * gl_FragCoord.xy / iResolution.y) - 1.0;

    uv.x *= (2. * uv.y * uv.y - uv.x * uv.x * iTime);

    
    float r, g, b;
    vec3 color = vec3(0.);
    mainColor(color, uv);
    
    FragColor.rgb = color;
    return;
    
    /*
    vec2 center;
    vec4 sum = vec4(0.);
    
    for (int i=0; i < 3; i++) {
        center = vec2(pos[2*i], pos[2*i+1]);
        color = vec3(colors[3*i], colors[3*i+1], colors[3*i+2]);
        float d = smoothstep(0.6, 0.2, distance(center, uv));
        sum += d * vec4(color, 1.);  
    }
    
    sum.rgb /= sum.a;
    sum.a = 1.;
    
    FragColor.rgb = sum.rgb;
    */
}
