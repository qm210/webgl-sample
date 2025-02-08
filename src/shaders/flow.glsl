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

float gpuIndependentHash(float p) {
    p = fract(p * .1031);
    p *= p + 19.19;
    p *= p + p;
    return fract(p);
}

vec2 randomPos(in float seed) {
    float s = seed;
    return vec2(
        2. * hash1(s) - 1.,
        hash1(s) - 0.5
    );
}

float rndSeed = 0.1;
#define RND_STEP .2

void randomCircles(inout vec3 col, in vec2 uv) {
    float lifeSeconds = 0.5;
    float spawnInterval = 2.;
    bool alive = false;
    vec2 pos;
    float radius = 0.02;

    float lifetime = mod(iTime, spawnInterval);
    rndSeed += RND_STEP * floor(iTime / spawnInterval);

    if (lifetime < lifeSeconds) {
        pos = randomPos(rndSeed);
        alive = true;
    } else if (alive) {
        rndSeed += 1.;
        alive = false;
    }

    col = c.yyy;
    if (alive) {
        if (distance(uv, pos) <= radius) {
            col = vec3(1.);
        }
    }

    // debugging the coordinates, maybe I'm the doodoo here
    if (distance(uv, vec2(1., 0.5)) < radius) {
        col = vec3(0,0,1);
    }
}

//void mainImage( out vec4 fragColor, in vec2 fragCoord )
void main()
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = (gl_FragCoord.xy)/iResolution.y - vec2(1., 0.5);

    vec4 previous = texture2D(prevFrame, uv);

    // start with one and then can mulitply to durken -> awesome, I guess?
    vec3 col = vec3(1.);

    randomCircles(col, uv);

    // Output to screen
    FragColor = vec4(col,1.0);
}