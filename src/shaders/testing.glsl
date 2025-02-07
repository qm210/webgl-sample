#version 300 es  // For WebGL 2 (GLSL ES 3.00)

precision highp float;
out vec4 FragColor;
uniform float iTime;
uniform vec2 iResolution;

const vec3 c = vec3(1.,0.,-1.);
const float TAU = 6.28318530718;

struct Ray { vec3 dir; vec3 origin; float factor; float n; vec3 normal; };

struct Material { vec3 albedo; int type; float roughness; };

float sm(in float d)
{
    return smoothstep(1.5/iResolution.y, -1.5/iResolution.y, d);
}

uint baseHash( uvec2 p ) {
    p = 1103515245U*((p >> 1U)^(p.yx));
    uint h32 = 1103515245U*((p.x)^(p.y>>3U));
    return h32^(h32 >> 16);
}

float hash1( inout float seed ) {
    uint n = baseHash(floatBitsToUint(vec2(seed+=.1,seed+=.1)));
    return float(n)/float(0xffffffffU);
}

vec2 hash2( inout float seed ) {
    uint n = baseHash(floatBitsToUint(vec2(seed+=.1,seed+=.1)));
    uvec2 rz = uvec2(n, n*48271U);
    return vec2(rz.xy & uvec2(0x7fffffffU))/float(0x7fffffff);
}

// my own abomination
vec3 hash3( inout float seed ) {
    uint n = baseHash(floatBitsToUint(vec2(seed+=.1,seed+=.1)));
    uvec3 rz = uvec3(n, n*48271U, n*328231U);
    return vec3(rz.xyz & uvec3(0x7fffffffU))/float(0x7fffffff);
}

float maxComp(vec3 v) {
    return v.x >= v.y && v.x >= v.z
            ? v.x
            : v.y >= v.z
            ? v.y
            : v.z;
}

void debugUv(inout vec3 col, in vec2 uv) {
    if (abs(uv.x - 0.888) < 0.005) {
        col = c.xyy;
    }
    if (abs(uv.x + 0.888) < 0.005) {
        col = c.yxy;
    }
    if (abs(uv.y - 0.5) < 0.005) {
        col = c.xyy;
    }
    if (abs(uv.y + 0.5) < 0.005) {
        col = c.yxy;
    }
}

float gpuIndepentHash(float p) {
    p = fract(p * .1031);
    p *= p + 19.19;
    p *= p + p;
    return fract(p);
}

#define UNDECIDED -1
#define PASS 1
#define FAIL 0

#define N_TESTS 6

void runTest(int index, out int result) {
    result = UNDECIDED;
    if (index == 0) {
        result =
            maxComp(vec3(0.8, 0.1, 0.5)) == 0.8
            ? PASS : FAIL;
    } else if (index == 1) {
        result =
            maxComp(vec3(0.8, 0.95, 0.9)) != 0.9
            ? PASS : FAIL;
    } else if (index == 2) {
        result =
            maxComp(vec3(0.1, -5., 0.1)) == 0.1
            ? PASS : FAIL;
    }
}

void runTests(inout vec3 color, in vec2 uv) {
    // uv.y is normed to [-0.5, +0.5], i.e.
    float height = 1.0 / float(N_TESTS);
    float cursor = 0.5 - 0.05 * height;
    int testResult;

    for (int i=0; i<N_TESTS; i++) {
        runTest(i, testResult);

        float border = cursor - 0.9 * height;
        float y = uv.y + 0.01 * sin(10.*uv.x); // we are so funny lel
        if (y < cursor && y >= border) { // } && uv.y > cursor - 0.9 * height) {
            if (testResult == PASS) {
                color = c.yxy;
            } else if (testResult == FAIL) {
                color = c.xyy;
            } else {
                color = vec3(0.5);
            }
        }
        cursor -= height;
    }
}

//void mainImage( out vec4 fragColor, in vec2 fragCoord )
void main()
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = (gl_FragCoord.xy)/iResolution.y - vec2(1., 0.5);

    vec3 col = vec3(0.);

    runTests(col, uv);

    // Output to screen
    FragColor = vec4(col,1.0);
}