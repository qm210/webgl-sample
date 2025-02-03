#version 300 es  // For WebGL 2 (GLSL ES 3.00)

precision highp float;
out vec4 FragColor;
uniform float iTime;
uniform vec2 iResolution;

const vec3 c = vec3(1.,0.,-1.);

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

#define MAT_LAMBERTIAN 1
#define MAT_METAL 2
#define MAT_DIELECTRIC 3

#define MAX_DIST 1e8
float sphereRadius = 0.25;

float iSphere(inout Ray ray, in vec3 pos, in vec2 distBound) {
    vec3 r = ray.origin - pos;
    float b = dot(r, ray.dir);
    float c = dot(r, r) - sphereRadius*sphereRadius;
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

vec3 findHit(inout Ray ray) {
    vec3 d = vec3(0.0001, 100, 0.);
    vec3 spherePos = vec3(0.4, .25 + 0.03 * cos(iTime), 1.);

    d = updateIfClosest(d, iSphere(ray, spherePos, d.xy), MAT_LAMBERTIAN);

    // the result is used as:
    // - d.z is the hit material (0 = nothing)
    // - d.y is the hit distance
    // - d.x is the minimum hit distance, is only kept because the [x,y] is updated as cursor

    return d;
}

vec3 sky(Ray ray) {
    vec3 bg = 0.2*cos(iTime+ray.dir+vec3(2,0,4));
    // return bg;

    vec3 col = bg;
    col = mix(col,vec3(.5,.7,1), .5+.5*ray.dir.y);
    float sun = clamp(dot(normalize(vec3(-.4,.7,-.6)),ray.dir), 0., 1.);
    col += vec3(1,.6,.1)*(pow(sun,4.) + 10.*pow(sun,32.));
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
    return a + b*cos(6.28318530718*(c*t+d));
}

void getMaterialProperties(in float matIndex, out Material mat) {
    mat.albedo = pal(matIndex*.59996323+.5, vec3(.5),vec3(.5),vec3(1),vec3(0,.1,.2));
    mat.type = int(matIndex);
    mat.roughness = (1.-matIndex*.475); // * gpuIndepentHash(27. * mat);
}

int number_of_reflection_paths = 3;

vec3 cosWeightedRandomHemisphereDirection( const vec3 n, inout float seed ) {
    vec2 r = hash2(seed);
    vec3  uu = normalize(cross(n, abs(n.y) > .5 ? vec3(1.,0.,0.) : vec3(0.,1.,0.)));
    vec3  vv = cross(uu, n);
    float ra = sqrt(r.y);
    float rx = ra*cos(6.28318530718*r.x);
    float ry = ra*sin(6.28318530718*r.x);
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