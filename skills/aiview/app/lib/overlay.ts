// Composition mode: what the frame injects into a served mockup so the person can see
// which regions were bound from elsewhere. Everything drawn lives in one fixed layer
// appended to <body>, positioned from measured rectangles: nothing is inserted into the
// host's flow, so the host's layout is exactly what Rendered mode shows.
//
// The layer takes every pointer event. In Composition the mockup is looked at, not
// operated: its hover states and clicks stay quiet, and only the labels and the legend
// answer the mouse. Wheel scrolling still reaches the document.
import type { BindingsSummary } from "./api.ts";

export const OVERLAY_MARK = "data-aiview-overlay";

export interface OverlayOptions {
  bindings?: BindingsSummary;
  /** A component name to scroll to and flash once the page has loaded (B12). */
  target?: string;
}

/** Drop the date prefix of a mockup file name for the label: `2026-09-03-dock-tools.mockup.html` -> `dock-tools`. */
export const shortName = (file: string): string =>
  file.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.mockup\.html$/, "").replace(/\.html$/, "");

const CSS = `
#__aiview{position:fixed;inset:0;z-index:2147483647;pointer-events:auto;cursor:default;font:11px/1.3 ui-sans-serif,system-ui,sans-serif}
#__aiview svg{position:absolute;inset:0;width:100%;height:100%}
#__aiview .box{position:absolute;outline:2px dashed #4f46e5;outline-offset:1px;border-radius:3px;pointer-events:none}
#__aiview .box.err{outline-color:#dc2626}
#__aiview .box.flash{animation:__aiview-flash 1.2s ease-out 1}
@keyframes __aiview-flash{0%{background:rgba(79,70,229,.35)}100%{background:transparent}}
#__aiview .lbl{position:absolute;left:-2px;top:-20px;display:none;pointer-events:auto;cursor:pointer;white-space:nowrap;padding:2px 7px;border-radius:4px;background:#4f46e5;color:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25)}
#__aiview .box.err .lbl{display:block;background:#dc2626;cursor:default}
#__aiview .box.hover .lbl{display:block}
#__aiview .legend{position:absolute;top:8px;right:8px;pointer-events:auto;max-width:360px;padding:6px 10px;border-radius:6px;background:rgba(255,255,255,.95);color:#1a1a1a;box-shadow:0 1px 4px rgba(0,0,0,.25)}
#__aiview .legend b{font-weight:600}
#__aiview .legend .err{color:#dc2626}
#__aiview .legend .warn{color:#6b7280}
`;

// The script is plain, dependency-free browser code. It reads its data from the
// attributes of the layer element so the html stays inert until it runs.
const SCRIPT = `
(function(){
  var layer=document.getElementById('__aiview'); if(!layer) return;
  var summary=JSON.parse(layer.getAttribute('data-summary')||'{"sources":[],"errors":[],"warnings":[]}');
  var target=layer.getAttribute('data-target')||'';
  var short=function(f){return f.replace(/^\\d{4}-\\d{2}-\\d{2}-/,'').replace(/\\.mockup\\.html$/,'').replace(/\\.html$/,'')};
  var svgNS='http://www.w3.org/2000/svg';
  var svg=document.createElementNS(svgNS,'svg');
  svg.innerHTML='<defs><mask id="__aiview-mask"><rect width="100%" height="100%" fill="white"/></mask></defs><rect width="100%" height="100%" fill="rgba(255,255,255,.45)" mask="url(#__aiview-mask)"/>';
  layer.appendChild(svg);
  var mask=svg.querySelector('mask');
  var legend=document.createElement('div'); legend.className='legend'; layer.appendChild(legend);
  var boxes=[];
  function build(){
    boxes.forEach(function(b){b.box.remove()}); boxes=[];
    var els=document.querySelectorAll('[data-bound],[data-bound-error]');
    var counts={};
    els.forEach(function(el){
      var ref=el.getAttribute('data-bound')||el.getAttribute('data-bound-error')||'';
      var isErr=el.hasAttribute('data-bound-error');
      var i=ref.indexOf('#'); var file=i<0?ref:ref.slice(0,i); var name=i<0?'':ref.slice(i+1);
      if(!isErr) counts[file]=(counts[file]||0)+1;
      var box=document.createElement('div'); box.className='box'+(isErr?' err':'');
      var lbl=document.createElement('span'); lbl.className='lbl';
      lbl.textContent=isErr?(el.textContent||ref):(short(file)+' \\u00b7 '+name);
      if(!isErr) lbl.addEventListener('click',function(ev){ev.stopPropagation();parent.postMessage({type:'aiview:open',file:file,component:name},'*')});
      box.appendChild(lbl); layer.appendChild(box);
      boxes.push({el:el,box:box,hole:null});
    });
    var html='';
    Object.keys(counts).forEach(function(f){html+='<div><b>'+short(f)+'</b> \\u00b7 '+counts[f]+' bound</div>'});
    if(!Object.keys(counts).length&&!summary.errors.length) html+='<div>No bindings in this mockup</div>';
    summary.errors.forEach(function(e){html+='<div class="err">'+e.ref+': '+e.message+'</div>'});
    summary.warnings.forEach(function(w){html+='<div class="warn">'+w.ref+': '+w.message+'</div>'});
    legend.innerHTML=html;
    place();
  }
  function place(){
    while(mask.childNodes.length>1) mask.removeChild(mask.lastChild);
    boxes.forEach(function(b){
      var r=b.el.getBoundingClientRect();
      b.box.style.left=r.left+'px'; b.box.style.top=r.top+'px'; b.box.style.width=r.width+'px'; b.box.style.height=r.height+'px';
      b.box.style.display=(r.width||r.height)?'block':'none';
      if(b.box.classList.contains('err')) return;
      var hole=document.createElementNS(svgNS,'rect');
      hole.setAttribute('x',r.left); hole.setAttribute('y',r.top); hole.setAttribute('width',r.width); hole.setAttribute('height',r.height); hole.setAttribute('fill','black');
      mask.appendChild(hole);
    });
  }
  var queued=false;
  function schedule(){ if(queued) return; queued=true; requestAnimationFrame(function(){queued=false;place()}); }
  function rebuild(){ if(queued) return; queued=true; requestAnimationFrame(function(){queued=false;build()}); }
  window.addEventListener('resize',schedule); window.addEventListener('scroll',schedule,true);
  new MutationObserver(function(muts){
    for(var i=0;i<muts.length;i++){ if(layer.contains(muts[i].target)) continue; rebuild(); return; }
  }).observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});
  document.addEventListener('mousemove',function(ev){
    var x=ev.clientX,y=ev.clientY;
    boxes.forEach(function(b){
      var r=b.el.getBoundingClientRect();
      var inside=x>=r.left&&x<=r.right&&y>=r.top-22&&y<=r.bottom;
      b.box.classList.toggle('hover',inside);
    });
  },true);
  build();
  if(target){
    var t=document.querySelector('[data-component="'+target.replace(/"/g,'')+'"]');
    if(t){ t.scrollIntoView({block:'center'}); var fb=document.createElement('div'); fb.className='box flash'; layer.appendChild(fb);
      var r=t.getBoundingClientRect(); fb.style.left=r.left+'px'; fb.style.top=r.top+'px'; fb.style.width=r.width+'px'; fb.style.height=r.height+'px';
      setTimeout(function(){fb.remove()},1300); }
  }
})();
`;

const attr = (s: string): string => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The served html with the composition layer appended. Idempotent on the marker. */
export function withOverlay(html: string, { bindings, target }: OverlayOptions = {}): string {
  const summary = JSON.stringify(bindings ?? { sources: [], errors: [], warnings: [] });
  const snippet =
    `<style ${OVERLAY_MARK}>${CSS}</style>` +
    `<div id="__aiview" ${OVERLAY_MARK} data-summary="${attr(summary)}"${target ? ` data-target="${attr(target)}"` : ""}></div>` +
    `<script ${OVERLAY_MARK}>${SCRIPT}</script>`;
  const i = html.lastIndexOf("</body>");
  return i < 0 ? html + snippet : html.slice(0, i) + snippet + html.slice(i);
}
