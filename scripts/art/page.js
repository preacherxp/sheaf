import { init, surface, effect, texture, frame as renderFrame } from "vgpu";

const boxes = [...document.querySelectorAll(".review-check")];
const progress = document.querySelector(".result-count").firstChild;
const meter = document.querySelector("progress");
const finaleMs = 1500;
let finaleStart = -Infinity;
const updateProgress = (fromCheck = false) => {
  const wasDone = meter.position === 1;
  meter.value = boxes.filter(b=>b.checked).length;
  const done = meter.position === 1;
  progress.data = `${done ? "Review complete · " : ""}${meter.value} of ${boxes.length} checked`;
  if (!done) finaleStart = -Infinity;
  if (done && !wasDone && fromCheck && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    finaleStart = performance.now();
    if (!document.querySelector("#scene.ready")) {
      progress.parentElement.animate([{opacity:.4},{opacity:1}],{duration:600,easing:"ease-out"});
    }
  }
};
for (const box of boxes) {
  const key = `sheaf.checked:${box.value}`;
  try { box.checked = localStorage.getItem(key) === "1"; } catch {}
  box.addEventListener("change", () => {
    try { if (box.checked) localStorage.setItem(key,"1"); else localStorage.removeItem(key); } catch {}
    updateProgress(true);
  });
}
updateProgress();

async function renderPage() {
  if (!navigator.gpu || matchMedia("(forced-colors: active)").matches) return;
  const gpu = await init({ powerPreference: "low-power" });
  const canvas = document.querySelector("#scene"), main = document.querySelector("main");
  const layer = document.createElement("canvas"), ctx = layer.getContext("2d");
  const screen = surface(gpu, canvas, { autoResize: false, size: [1, 1] });
  const reduced = matchMedia("(prefers-reduced-motion: reduce)"), dark = matchMedia("(prefers-color-scheme: dark)");
  let ink, fx, size, hero, queue, scale, dirty = true, raf = 0, until = 0, stopped = false;
  let pointer = [-999, -999];
  let active, entered = 0, rowBox = [0,0,0,0], keyboard = false;
  let prism = [0,0], lastToggle, burstY = 0, burstStart = -Infinity;
  const nodes = [], walk = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) if (walk.currentNode.textContent.trim()) nodes.push(walk.currentNode);
  const range = document.createRange();

  function upload() {
    scale = Math.min(devicePixelRatio, 2, gpu.gpu.limits.maxTextureDimension2D/Math.max(innerWidth,innerHeight));
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width*scale)), h = Math.max(1, Math.round(rect.height*scale));
    if (size !== `${w}:${h}`) {
      size = `${w}:${h}`; layer.width = w; layer.height = h; screen.resize([w,h]);
      const prev = ink;
      ink = texture(gpu,{kind:"2d",size:[w,h],format:"rgba8unorm",usage:["texture_binding","copy_dst","render_attachment"]});
      if (fx) fx.set({ink});
      prev?.destroy();
    }
    ctx.setTransform(scale,0,0,scale,0,0);
    ctx.clearRect(0,0,rect.width,rect.height);
    const box = document.querySelector(".glass-head").getBoundingClientRect();
    hero = [box.x,box.y,box.width,box.height];
    const pane = main.querySelector(".queue").getBoundingClientRect();
    queue = [pane.x,pane.y,pane.width,pane.height];
    const track = meter.getBoundingClientRect();
    ctx.fillStyle = dark.matches ? "#ffffff24" : "#25211724";
    ctx.fillRect(track.x,track.y,track.width,track.height);
    ctx.fillStyle = dark.matches ? "#e4be77" : "#986722";
    ctx.fillRect(track.x,track.y,track.width*meter.position,track.height);
    const focused = main.querySelector(".row :focus-visible");
    keyboard = !!focused;
    const hot = focused?.closest(".row") ?? main.querySelector(".row:hover");
    if (hot !== active) { active = hot; entered = performance.now(); if (hot) until = entered + 700; }
    const bounds = hot?.getBoundingClientRect();
    rowBox = bounds ? [bounds.x,bounds.y,bounds.width,bounds.height] : [0,0,0,0];
    for (const row of main.querySelectorAll(".row")) {
      const r = row.getBoundingClientRect();
      if (r.bottom < 0 || r.top > rect.height) continue;
      const box = row.querySelector(".review-check"), b = box.getBoundingClientRect();
      prism = [b.x+b.width/2,b.width/2];
      if (box === lastToggle) burstY = b.y+b.height/2;
      // The ink texture's leftmost texel stores checkbox height and state for this scanline.
      const strip = ctx.createLinearGradient(0,b.y,0,b.bottom);
      const flags = `${box.checked ? 255 : 0},${box.matches(":focus-visible") ? 255 : 32}`;
      strip.addColorStop(0,`rgb(0,${flags})`);
      strip.addColorStop(1,`rgb(255,${flags})`);
      ctx.fillStyle=strip; ctx.fillRect(0,b.y,1/scale,b.height);
      ctx.fillStyle = dark.matches ? "#ffffff26" : "#59482930";
      ctx.fillRect(r.x,r.bottom-1,r.width,1);
    }
    for(const node of nodes) {
      const el = node.parentElement, r = el.getBoundingClientRect();
      if(r.bottom<0 || r.top>rect.height) continue;
      const style = getComputedStyle(el);
      ctx.save();
      ctx.beginPath(); ctx.rect(r.x,r.y,r.width,r.height); ctx.clip();
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      ctx.letterSpacing = style.letterSpacing === "normal" ? "0px" : style.letterSpacing;
      ctx.fillStyle = style.color; ctx.textBaseline = "middle";
      for (const m of node.textContent.matchAll(/\S+/gu)) {
        range.setStart(node,m.index); range.setEnd(node,m.index+m[0].length);
        const lines = range.getClientRects();
        const draw = (s,b) => ctx.fillText(s,b.x,b.y+b.height*.50);
        if(lines.length===1) draw(m[0],lines[0]);
        else {
          let i=m.index;
          for(const ch of m[0]) { range.setStart(node,i); i+=ch.length; range.setEnd(node,i); draw(ch,range.getBoundingClientRect()); }
        }
      }
      ctx.restore();
      if(el.matches("a:focus-visible")) {
        ctx.strokeStyle=dark.matches?"#ecc677":"#845e18"; ctx.lineWidth=2; ctx.strokeRect(r.x-2,r.y-2,r.width+4,r.height+4);
      }
    }
    gpu.gpu.queue.copyExternalImageToTexture({source:layer},{texture:ink.gpu},[w,h]);
    dirty = false;
  }
  function stop() {
    stopped=true; cancelAnimationFrame(raf); canvas.classList.remove("ready"); gpu.dispose();
  }
  gpu.onError(stop); gpu.lost.then(stop);
  function frame(now) {
    raf=0; if(stopped || document.hidden) return;
    try {
      if(dirty) upload();
      const finale = reduced.matches ? 1 : Math.min(1,Math.max(0,(now-finaleStart)/finaleMs));
      const scene={hero,queue,rowBox,prism,finale,burst:[burstY,reduced.matches ? 1 : Math.min(1,(now-burstStart)/700)],sweep:keyboard || reduced.matches ? 1 : Math.min(1,Math.max(0,(now-entered)/650)),pointer:reduced.matches || keyboard?[-999,-999]:pointer,scale,time:reduced.matches?0:Math.min(now,until)*.001,dark:Number(dark.matches)};
      if(!fx) fx=effect(gpu,PAGE_SHADER,{set:{ink,scene}});
      else fx.set({scene});
      renderFrame(gpu, f => f.pass(screen, fx));
      canvas.classList.add("ready");
      if(!reduced.matches && (now<until || finale<1)) raf=requestAnimationFrame(frame);
    } catch(e) { console.warn("Sheaf HTML view:",e); stop(); }
  }
  function schedule(layout=false) {
    dirty ||= layout;
    if(!raf && !stopped && !document.hidden) raf=requestAnimationFrame(frame);
  }
  function wake() { until=performance.now()+850; schedule(); }
  main.addEventListener("change",e=>{
    if (!e.target.matches(".review-check")) return;
    lastToggle=e.target; burstStart=lastToggle.checked ? performance.now() : -Infinity;
    until=Math.max(until,burstStart+700); schedule(true);
  });
  for(const name of ["scroll","resize","change","focusin","focusout","pointerover","pointerout","visibilitychange"])
    addEventListener(name,()=>schedule(true),{capture:true,passive:true});
  addEventListener("pointermove",e=>{pointer=[e.clientX,e.clientY];wake();},{passive:true});
  dark.addEventListener("change",()=>schedule(true)); reduced.addEventListener("change",()=>schedule());
  wake();
}
renderPage().catch(e=>console.warn("Sheaf HTML view:",e));
