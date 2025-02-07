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

/// worley noise after https://github.com/ashima/webgl-noise/blob/master/src/cellular2x2x2.glsl

// Modulo 289 without a division (only multiplications)
vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

// Modulo 7 without a division
vec4 mod7(vec4 x) {
    return x - floor(x * (1.0 / 7.0)) * 7.0;
}

// Permutation polynomial: (34x^2 + 6x) mod 289
vec3 permute(vec3 x) {
    return mod289((34.0 * x + 10.0) * x);
}

vec4 permute(vec4 x) {
    return mod289((34.0 * x + 10.0) * x);
}

// Cellular noise, returning F1 and F2 in a vec2.
// Speeded up by using 2x2x2 search window instead of 3x3x3,
// at the expense of some pattern artifacts.
// F2 is often wrong and has sharp discontinuities.
// If you need a good F2, use the slower 3x3x3 version.
vec2 cellular2x2x2(vec3 P) {
    #define K 0.142857142857 // 1/7
#define Ko 0.428571428571 // 1/2-K/2
#define K2 0.020408163265306 // 1/(7*7)
#define Kz 0.166666666667 // 1/6
#define Kzo 0.416666666667 // 1/2-1/6*2
#define jitter 0.8 // smaller jitter gives less errors in F2
	vec3 Pi = mod289(floor(P));
    vec3 Pf = fract(P);
    vec4 Pfx = Pf.x + vec4(0.0, -1.0, 0.0, -1.0);
    vec4 Pfy = Pf.y + vec4(0.0, 0.0, -1.0, -1.0);
    vec4 p = permute(Pi.x + vec4(0.0, 1.0, 0.0, 1.0));
    p = permute(p + Pi.y + vec4(0.0, 0.0, 1.0, 1.0));
    vec4 p1 = permute(p + Pi.z); // z+0
    vec4 p2 = permute(p + Pi.z + vec4(1.0)); // z+1
    vec4 ox1 = fract(p1*K) - Ko;
    vec4 oy1 = mod7(floor(p1*K))*K - Ko;
    vec4 oz1 = floor(p1*K2)*Kz - Kzo; // p1 < 289 guaranteed
    vec4 ox2 = fract(p2*K) - Ko;
    vec4 oy2 = mod7(floor(p2*K))*K - Ko;
    vec4 oz2 = floor(p2*K2)*Kz - Kzo;
    vec4 dx1 = Pfx + jitter*ox1;
    vec4 dy1 = Pfy + jitter*oy1;
    vec4 dz1 = Pf.z + jitter*oz1;
    vec4 dx2 = Pfx + jitter*ox2;
    vec4 dy2 = Pfy + jitter*oy2;
    vec4 dz2 = Pf.z - 1.0 + jitter*oz2;
    vec4 d1 = dx1 * dx1 + dy1 * dy1 + dz1 * dz1; // z+0
    vec4 d2 = dx2 * dx2 + dy2 * dy2 + dz2 * dz2; // z+1

    // Sort out the two smallest distances (F1, F2)
    #if 0
	// Cheat and sort out only F1
    d1 = min(d1, d2);
    d1.xy = min(d1.xy, d1.wz);
    d1.x = min(d1.x, d1.y);
    return vec2(sqrt(d1.x));
    #else
	// Do it right and sort out both F1 and F2
    vec4 d = min(d1,d2); // F1 is now in d
    d2 = max(d1,d2); // Make sure we keep all candidates for F2
    d.xy = (d.x < d.y) ? d.xy : d.yx; // Swap smallest to d.x
    d.xz = (d.x < d.z) ? d.xz : d.zx;
    d.xw = (d.x < d.w) ? d.xw : d.wx; // F1 is now in d.x
    d.yzw = min(d.yzw, d2.yzw); // F2 now not in d2.yzw
    d.y = min(d.y, d.z); // nor in d.z
    d.y = min(d.y, d.w); // nor in d.w
    d.y = min(d.y, d2.x); // F2 is now in d.y
    return sqrt(d.xy); // F1 and F2
    #endif
}

/// lessons:
/// cleanup functions -> Out of Memory
/// hashes!
/// expenses -> e.g. divisions. why is this? speeding up algos.
/// modulo trick!
/// FPS Counter: Browser Console -> Ctrl + Shift + P -> "FPS"

/// next up:
/// materialien? wie durchsichtig? wie nicht-fest (wolke / watte / ...)?
/// geile beleuchtung?
/// generelle dynamik bewegter dinge (auch oberflächen-UI), was mögen menschen so?

#define MAT_LAMBERTIAN 1
#define MAT_METAL 2
#define MAT_DIELECTRIC 3

#define MAX_DIST 1e8

float iSphere(inout Ray ray, in vec3 pos, in float radius, in vec2 distBound) {
    vec3 r = ray.origin - pos;
    float b = dot(r, ray.dir);
    float c = dot(r, r) - radius*radius;
    float h = b*b - c;
    if (h < 0.) {
        return MAX_DIST;
    } else {
        h = sqrt(h);
        float d1 = -b-h;
        float d2 = -b+h;
        if (d1 >= distBound.x && d1 <= distBound.y) {
            ray.normal = normalize(r + ray.dir * d1);
            return d1;
        } else if (d2 >= distBound.x && d2 <= distBound.y) {
            ray.normal = normalize(r + ray.dir * d2);
            return d2;
        } else {
            return MAX_DIST;
        }
    }
}

vec3 updateIfClosest( vec3 d, float iResult, int mat ) {
    return iResult < d.y ? vec3(d.x, iResult, float(mat)) : d;
}

const int nSpheres = 9;
int number_of_reflection_paths = 20;

float maxcomp(vec3 v) {
    return v.x >= v.y && v.x >= v.z
            ? v.x
            : v.y >= v.z
            ? v.y
            : v.z;
}

vec3 findHit(inout Ray ray) {
    vec3 d = vec3(0.0001, 100, 0.);

    vec3 spherePos = vec3(0.4, .25, 1.); // my first one
    float sphereRadius = 0.25;
    vec3 randomPos;
    float randomPhase, randomAmp, randomFreq;
    float seed = 14.;
    for (int s = 0; s < nSpheres; s++) {
        spherePos = vec3(-2., 2., 0.5);
        randomPos = hash3(seed);
        spherePos.x += 5. * randomPos.x;
        spherePos.y += -3. * randomPos.y;
        spherePos.z += 4. * randomPos.z;
        sphereRadius = 0.2 + .3 * randomPos.y;
        randomPhase = 80. * hash1(seed);
        randomAmp = 0.2 * hash1(seed);
        randomFreq = 0.1 * hash1(seed);
        spherePos.y += randomAmp * cos(iTime * (1. + randomFreq) - randomPhase);

        d = updateIfClosest(d, iSphere(ray, spherePos, sphereRadius, d.xy), MAT_LAMBERTIAN);
    }

    float iBox = 0.;
    vec3 posBox = vec3(0, 0, 4);
    float tBox = dot(ray.dir, (posBox - ray.origin));
//    if (tBox > -0.5) {
//        d.y = tBox;
//        d.z = 3.;
//    }
//    else if (tBox > 0.5) {
//        d.y = tBox;
//        d.z = 4.;
//    }

    /// the result is used as:
    /// - d.z is the hit material (0 = nothing)
    /// - d.y is the hit distance
    /// - d.x is the minimum hit distance, is only kept because the [x,y] is updated as cursor
    return d;
}

vec3 sky(Ray ray) {
    vec3 bg = 0.2*cos(iTime+ray.dir+vec3(2,0,4));

    vec3 col = vec3(0.,0.2,0.4);
    col = mix(col,bg, .5+.5*ray.dir.y);
    vec3 sunPos = vec3(
        -.4 + sin(iTime) * (2. + 0.5*cos(2.4*iTime)),
        1.5 + sin(2.4*iTime),
        -.6 + .2 * cos(2.4 * iTime)
    );
    float sun = clamp(dot(normalize(sunPos), ray.dir), 0., 1.);
    col += vec3(.7,.3,.7)*(pow(sun,2.) + 10.*pow(sun,32.));
    return col;
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

// iq palette
vec3 pal(in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d) {
    return a + b*cos(TAU*(c*t+d));
}

void getMaterialProperties(in float matIndex, out Material mat) {
    mat.albedo = pal(matIndex*.59996323+.5, vec3(.5),vec3(.5),vec3(1),vec3(0,.1,.2));
    mat.type = int(matIndex);
    mat.roughness = (1.-matIndex*.475); // * gpuIndepentHash(27. * mat);
}

vec3 cosWeightedRandomHemisphereDirection( const vec3 n, inout float seed ) {
    vec2 r = hash2(seed);
    /// vec3  uu = normalize(cross(n, abs(n.z) < .5 ? vec3(1.,0.,0.) : vec3(0.,1.,0.)));
    vec3  uu = normalize(cross(n, vec3(0.,1.,0.)));
    vec3  vv = cross(uu, n);
    float ra = sqrt(r.y);
    float rx = ra*cos(TAU*r.x);
    float ry = ra*sin(TAU*r.x);
    float rz = sqrt(1.-r.y);
    vec3  rr = vec3(rx*uu + ry*vv + rz*n);
    return normalize(rr);
}

void render(inout vec3 col, in vec2 uv) {
    vec3 cameraPosition = vec3(0., 0., -1.);
    Ray ray;
    ray.origin = cameraPosition;
    ray.dir = normalize(vec3(ray.origin.xy + uv, 0.) - ray.origin);
    ray.factor = 1.;
    ray.n = 1.;
    ray.normal = vec3(0.);
    Material material;
    float seed = 0.002;

    for (int p = 0; p < number_of_reflection_paths; ++p)
    {
        vec3 hit = findHit(ray);
        if (hit.z > 0.) {
            // we hit!
            ray.origin += ray.dir * hit.y;
            getMaterialProperties(hit.z, material);
            col *= material.albedo;
            ray.dir = cosWeightedRandomHemisphereDirection(ray.normal, seed);
            // col = vec3(1., 0.5, 0.9);

        } else {
            col *= sky(ray);
            return;
        }
    }
    return;
}

//void mainImage( out vec4 fragColor, in vec2 fragCoord )
void main()
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = (gl_FragCoord.xy)/iResolution.y - vec2(1., 0.5);

    // start with one and then can mulitply to durken -> awesome, I guess?
    vec3 col = vec3(1.);

    render(col, uv);

    // Output to screen
    FragColor = vec4(col,1.0);
}