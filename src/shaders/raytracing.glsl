#version 300 es  // For WebGL 2 (GLSL ES 3.00)

precision highp float;
out vec4 FragColor;
uniform float iTime;
uniform vec2 iResolution;

const vec3 c = vec3(1.,0.,-1.);

struct Ray { vec3 dir; vec3 origin; float factor; float n; vec3 normal; };

float sm(in float d)
{
    return smoothstep(1.5/iResolution.y, -1.5/iResolution.y, d);
}

#define MAX_DIST 1e8
float sphereRadius = 0.25;
vec3 spherePos = vec3(0., .25, 0.);

float iSphere(inout Ray ray, in vec2 distBound) {
    vec3 r = ray.origin - spherePos;
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


vec3 opU( vec3 d, float iResult, float mat ) {
    return (iResult < d.y) ? vec3(d.x, iResult, mat) : d;
}


vec3 findHit(inout Ray ray) {
    vec3 d = vec3(0.0001, 100, 0.);

    d = opU(d, iSphere(ray, d.xy), 3.);

    // the result is used as:
    // - d.z <= 0. means nothing is hit
    // - d.y is the trace step length

    return d;
}

vec3 sky(Ray ray) {
    vec3 bg = 0.3*cos(iTime+ray.dir+vec3(2,0,4));
    return bg;

    vec3 col = mix(vec3(1),vec3(.5,.7,1), .5+.5*ray.dir.y);
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

void render(inout vec3 col, in vec2 uv) {
    vec3 cameraPosition = vec3(0., 0., -1.);
    Ray ray;
    ray.origin = cameraPosition;
    ray.dir = normalize(vec3(ray.origin.xy + uv, 0.) - ray.origin);
    ray.factor = 1.;
    ray.n = 1.;
    ray.normal = vec3(0.);

    for (int p = 0; p < 12; ++p)
    {
        vec3 hit = findHit(ray);
        if (hit.z > 0.) {
            // we hit!
            ray.origin += ray.dir * hit.y;

            col *= vec3(1., 0.5, 0.5);
            // TODO: remove that for moar itorationiz0rs
            return;

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

    debugUv(col, uv);

    // Output to screen
    FragColor = vec4(col,1.0);
}
