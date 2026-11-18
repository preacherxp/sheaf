// Pre-render three glass sheets so opening a ticket never needs a GPU or a render loop.
import { writeFileSync } from "node:fs";
import { effect, init, target } from "vgpu/node";
import { prepareShader } from "@vgpu/wgsl/prepare";
import { PNG } from "pngjs";

const gpu = await init();
try {
  const size = 384;
  const plate = target(gpu, { size: [size, size], format: "rgba8unorm" });
  effect(gpu, prepareShader(`
    fn trace(p: vec2f, a: vec2f, b: vec2f) -> f32 {
      let v = b-a;
      return length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.0,1.0));
    }
    @fragment fn fs_main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
      let xy = pos.xy / 384.0 - 0.5;
      var col = vec3f(0.0);
      var alpha = 0.0;
      for (var i = 0; i < 3; i++) {
        let h = xy.y - 0.14 + 0.11 * f32(i);
        let p = vec2f(xy.x + 1.75*h, -xy.x + 1.75*h);
        let q = abs(p) - vec2f(0.32, 0.26);
        let d = length(max(q, vec2f(0.0))) + min(max(q.x,q.y),0.0) - 0.065;
        let bevel = 1.0 - smoothstep(0.001,0.018,abs(d+0.014));
        let seam = 1.0 - smoothstep(0.0,0.006,abs(fract(p.x*8.0)*0.125-0.0625));
        let glint = pow(0.5+0.5*cos(p.x*11.0-p.y*5.0),4.0);
        let root = vec2f(-0.17,0.13);
        let tip = vec2f(-0.17,-0.14);
        let fork = vec2f(0.16,-0.14);
        let joint = vec2f(-0.17,0.045);
        let elbow = vec2f(0.16,-0.025);
        let line = min(trace(p,root,tip), min(trace(p,joint,elbow),trace(p,elbow,fork)));
        let pins = min(length(p-root), min(length(p-tip),length(p-fork)));
        let mark = 1.0-smoothstep(0.010,0.017,min(max(line,0.027-pins),abs(pins-0.029)));
        let foil = vec3f(0.97,0.75,0.38);
        let ink = mix(mix(vec3f(0.15,0.12,0.085),foil,0.16+glint*0.72+seam*0.08),
                      vec3f(1.0,0.94,0.77), max(bevel,mark));
        let a = (1.0-smoothstep(-0.004,0.004,d))*max(0.48+bevel*0.47,mark);
        col = ink*a + col*(1.0-a);
        alpha = a + alpha*(1.0-a);
      }
      return vec4f(col/max(alpha,0.001),alpha);
    }
  `)).draw(plate);
  const pixels = await plate.color.read({ mipLevel: 0, region: "all" });
  if (!pixels.some((v, i) => i % 4 === 3 && v > 160)) throw Error("Empty glass render");
  const image = new PNG({ width: size, height: size });
  image.data.set(pixels);
  writeFileSync(new URL("../../glass.png", import.meta.url), PNG.sync.write(image));
} finally { gpu.dispose(); }
