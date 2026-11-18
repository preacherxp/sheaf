struct Scene {
  hero: vec4f, // CSS pixels: left, top, width, height
  queue: vec4f,
  pointer: vec2f,
  scale: f32,
  time: f32,
  dark: f32,
  rowBox: vec4f,
  sweep: f32,
  prism: vec2f, // center x and half width, shared by the checkbox column
  burst: vec2f, // center y and normalized lifetime of the latest check
  finale: f32,
}
@group(0) @binding(0) var<uniform> scene: Scene;
@group(0) @binding(1) var ink: texture_2d<f32>;

fn rounded(p: vec2f, halfSize: vec2f, r: f32) -> f32 {
  let q = abs(p) - halfSize + r;
  return length(max(q, vec2f(0))) + min(max(q.x,q.y),0.0) - r;
}

fn segment(p: vec2f, a: vec2f, b: vec2f) -> f32 {
  let ab = b-a;
  return length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.,1.));
}

fn spectrum(x: f32) -> vec3f {
  return .58+.40*cos(6.283*(x+vec3f(.04,.37,.68)));
}

@fragment fn fs_main(@builtin(position) frag: vec4f) -> @location(0) vec4f {
  let p = frag.xy / scene.scale;
  let local = p - scene.hero.xy;
  let size = scene.hero.zw;
  let cursor = scene.pointer;
  let t = scene.time;
  let gold = vec3f(0.88,0.61,0.25);
  let field = sin(p.x*0.006+p.y*0.003)+0.5*sin(p.y*0.009-p.x*0.002);
  let isoline = 1.0-smoothstep(0.0,0.09,abs(fract(field*4.0)-0.5));
  var rgb = mix(vec3f(.955,.948,.926),vec3f(.077,.08,.078),scene.dark);
  rgb += (isoline-.5)*0.019;
  let d = rounded(local-size*.5,size*.5,16.0);
  let inside = 1.0-smoothstep(-0.6,0.6,d);
  let cursorLight = exp(-length(p-cursor)/170.0);
  let queueD = rounded(p-scene.queue.xy-scene.queue.zw*.5,scene.queue.zw*.5,16.);
  let glassD = min(d,queueD);
  let thickness = exp(-abs(glassD+2.)*.30);
  let paneUV = select((p-scene.queue.xy)/scene.queue.zw, local/size, d<queueD);
  let band = exp(-abs(paneUV.x+.29*paneUV.y-.78)*7.);
  let crystal = mix(vec3f(.55,.77,.80),gold,clamp(paneUV.x+.16*cursorLight,0.,1.));
  let bent = 1.-smoothstep(.0,.16,abs(fract(field*4.+thickness*.52)-.5));
  let panel = mix(vec3f(.986,.982,.965),vec3f(.132,.144,.148),scene.dark);
  rgb = mix(rgb,panel + crystal*(.045*band+.05*cursorLight+.06*thickness+.018*bent),1.-smoothstep(-.6,.6,glassD));
  let upperLip = exp(-abs(glassD)*1.2);
  let innerLip = exp(-abs(glassD+3.)*1.3);
  rgb = mix(rgb,crystal,.58*upperLip+.20*innerLip);

  let span = min(size.x*.30,size.y*1.03);
  let xy = (local-vec2f(size.x*.82,size.y*.50))/span;
  if (inside>0.0 && all(abs(xy)<vec2f(.64))) {
    let tilt = clamp((cursor.x-scene.hero.x-size.x*.5)/size.x,-.65,.65);
    for(var i=0;i<3;i++){
      let y = xy.y-.13+f32(i)*(.114+.008*sin(t));
      let a = vec2f(xy.x+1.8*y+tilt*y*.16,-xy.x+1.8*y);
      let edge = rounded(a,vec2f(.40,.32),.065);
      let rim = 1.0-smoothstep(.002,.019,abs(edge+.015));
      let glint = pow(.5+.5*cos(a.x*10.-a.y*5.+t*.8+tilt),7.);
      let pins = min(length(a-vec2f(-.15,.14)),min(length(a-vec2f(-.15,-.13)),length(a-vec2f(.15,-.13))));
      let trunk = max(abs(a.x+.15)-.007,abs(a.y)-.13);
      let fork = max(abs(a.y+.40*a.x+.055)-.008,abs(a.x)-.15);
      let etched = 1.-smoothstep(0.,.01,min(abs(pins-.024)-.005,min(trunk,fork)));
      let face = mix(vec3f(.32,.23,.14),gold,.32+glint*.65);
      let color = mix(face,vec3f(1.,.94,.77),max(rim,etched));
      rgb = mix(rgb,color,(1.-smoothstep(-.008,.006,edge))*(.51+.47*max(rim,etched)));
    }
  }
  if (scene.rowBox.z > 0.) {
    let q = p - scene.rowBox.xy;
    let dims = scene.rowBox.zw;
    let edge = rounded(q-dims*.5,dims*.5-1.,8.);
    let fill = 1.-smoothstep(-.5,.5,edge);
    let rim = 1.-smoothstep(.3,1.7,abs(edge));
    let sweepX = mix(-.18,1.18,1.-pow(1.-scene.sweep,2.));
    let streak = exp(-20.*abs(q.x/dims.x+.08*(q.y/dims.y-.5)-sweepX));
    rgb = mix(rgb,gold,fill*(.07+.08*cursorLight+.10*streak));
    rgb = mix(rgb,gold,rim*(.34+.40*cursorLight+.25*streak));
  }
  let dx = p.x-scene.prism.x;
  let age = scene.burst.y;
  let ray = vec2f(dx,p.y-scene.burst.x);
  if (age<1. && length(ray)<60.) {
    for (var i=0;i<9;i++) {
      let a = f32(i)*2.4+.2;
      let dir = vec2f(cos(a),sin(a));
      let travel = (1.-pow(1.-age,2.))*(26.+8.*cos(a*2.));
      let shard = ray-dir*(12.+travel);
      let cut = abs(dot(shard,dir))/(5.-2.*age)+abs(dot(shard,vec2f(-dir.y,dir.x)))/1.7;
      rgb = mix(rgb,spectrum(f32(i)*.18), (1.-smoothstep(.55,1.2,cut))*(1.-age));
    }
  }
  if (abs(dx)<scene.prism.y) {
    let code = textureLoad(ink,vec2i(0,i32(frag.y)),0);
    if (code.b>.06 && code.a>.7) {
      let q = vec2f(dx/scene.prism.y,code.r*2.-1.);
      let dist = max(max(abs(q.x),abs(q.y))-.78,(abs(q.x)+abs(q.y)-1.27)*.707);
      let checked = code.g;
      let bevel = exp(-16.*abs(dist+.08));
      let light = clamp((cursor.x-scene.prism.x)/50.,-1.,1.);
      let facets = abs(q.x*.78+q.y*.52)+.38*abs(q.x-q.y);
      let flare = pow(.5+.5*cos(8.*facets+light*2.2),6.);
      let hue = spectrum(.18*q.x+.27*q.y+.18*light+.12*facets);
      let glass = mix(vec3f(.12,.16,.20),vec3f(.30,.19,.12),checked)
                + hue*(.12+.40*flare+.50*bevel)+gold*checked*.22;
      rgb = mix(rgb,glass,1.-smoothstep(-.035,.035,dist));
      let rim = 1.-smoothstep(.01,.07,abs(dist));
      rgb = mix(rgb,mix(hue,vec3f(1.),.45),rim);
      if (checked>.5) {
        let tick = min(segment(q,vec2f(-.41,.00),vec2f(-.12,.27)),segment(q,vec2f(-.12,.27),vec2f(.40,-.31)));
        rgb = mix(rgb,vec3f(.08,.11,.14),1.-smoothstep(.095,.16,tick));
        rgb = mix(rgb,vec3f(1.,.985,.91),1.-smoothstep(.055,.105,tick));
      }
      if (code.b>.8) {rgb = mix(rgb,gold,1.-smoothstep(.025,.08,abs(dist-.15)));}
    }
  }
  if (scene.finale<1. && glassD<2.) {
    let origin = vec2f(scene.prism.x,scene.burst.x);
    let reach = length(vec2f(size.x, f32(textureDimensions(ink).y)/scene.scale));
    let radius = reach*(1.-pow(1.-scene.finale,1.7));
    let offset = length(p-origin)-radius;
    let fade = 1.-smoothstep(.55,1.,scene.finale);
    let crest = exp(-abs(offset)/11.);
    let wake = exp(-abs(offset+26.)/22.);
    let tint = spectrum(offset*.009+scene.finale*.36);
    rgb = mix(rgb,tint,fade*(.45*crest+.16*wake));
    rgb += vec3f(.32,.25,.13)*fade*crest*exp(-abs(glassD)*.25);
  }
  if (frag.x<1.) {return vec4f(rgb,1.);}
  let glyph = textureLoad(ink,vec2i(frag.xy),0);
  return vec4f(mix(rgb,glyph.rgb,glyph.a),1.0);
}
