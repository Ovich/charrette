// Composition mode: what the frame injects into a served mockup so the person can see
// which regions were bound from elsewhere. Everything drawn lives in one fixed layer
// appended to <body>, positioned from measured rectangles: nothing is inserted into the
// host's flow, so the host's layout is exactly what Rendered mode shows.
//
// The layer takes every pointer event. In Composition the mockup is looked at, not
// operated: its hover states and clicks stay quiet, and only the labels, the legend and
// the preview answer the mouse. Wheel scrolling still reaches the document.
//
// A bound element is not always on screen: a host may keep components in a hidden
// library and show them by script. So every bound element, visible or not, has a row in
// the legend, and a click on a row or on an outlined region opens a preview: the element
// cloned into a panel of the layer, rendered by the page's own styles, with the way to
// its source.
//
// The mode also shows what this mockup offers: its own declared components (a
// data-component that is not bound and sits in no bound element), drawn dotted, listed
// under "Offered", their preview carrying the placeholder a sibling would write. Labels say
// "pulled" or "offered".
import type { BindingsSummary } from "./api.ts";

export const OVERLAY_MARK = "data-aiview-overlay";

export interface OverlayOptions {
  bindings?: BindingsSummary;
  /** A component name to scroll to and flash once the page has loaded (B12). */
  target?: string;
  /** This mockup's own file name, bare: what a sibling would write in a placeholder to bind a component declared here. */
  file?: string;
}

/** Drop the date prefix of a mockup file name for the label: `2026-09-03-dock-tools.mockup.html` -> `dock-tools`. */
export const shortName = (file: string): string =>
  file.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.mockup\.html$/, "").replace(/\.html$/, "");

const UI_FONT = "font:12px/1.35 ui-sans-serif,system-ui,sans-serif";

const CSS = `
#__aiview{position:fixed;inset:0;z-index:2147483647;pointer-events:auto;cursor:default}
#__aiview .av-box,#__aiview .av-lbl,#__aiview .av-legend,#__aiview .av-pv{background:transparent;border:0;margin:0;padding:0;box-shadow:none;width:auto;height:auto;min-height:0;max-width:none;text-align:left;letter-spacing:normal;text-transform:none}
#__aiview svg{position:absolute;inset:0;width:100%;height:100%}
#__aiview .av-box{position:absolute;outline:2px dashed #4f46e5;outline-offset:1px;border-radius:3px;pointer-events:auto;cursor:pointer}
#__aiview .av-box.av-err{outline-color:#dc2626;pointer-events:none;cursor:default}
#__aiview .av-box.av-decl{outline:1.5px dotted #15803d}
#__aiview .av-box.av-decl .av-lbl{background:#15803d}
#__aiview .av-box.av-decl:hover{background:rgba(21,128,61,.05)}
#__aiview .av-box:hover{background:rgba(79,70,229,.06)}
#__aiview .av-box.av-flash{animation:__aiview-flash 1.2s ease-out 1}
@keyframes __aiview-flash{0%{background:rgba(79,70,229,.35)}100%{background:transparent}}
#__aiview .av-lbl{position:absolute;left:-2px;top:-22px;display:none;pointer-events:auto;cursor:pointer;white-space:nowrap;padding:2px 7px;border-radius:4px;background:#4f46e5;color:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);${UI_FONT}}
#__aiview .av-box.av-err .av-lbl{display:block;background:#dc2626;cursor:default}
#__aiview .av-box:hover .av-lbl{display:block}
#__aiview .av-legend{position:absolute;top:8px;right:8px;pointer-events:auto;max-width:380px;max-height:60vh;overflow:auto;padding:6px 10px;border-radius:6px;background:rgba(255,255,255,.96);color:#1a1a1a;box-shadow:0 1px 4px rgba(0,0,0,.25);${UI_FONT}}
#__aiview .av-legend b{font-weight:600}
#__aiview .av-legend .av-err{color:#dc2626}
#__aiview .av-legend .av-warn{color:#6b7280}
#__aiview .av-legend details{margin:2px 0}
#__aiview .av-legend summary{cursor:pointer;list-style:none;padding:2px 0}
#__aiview .av-legend summary::-webkit-details-marker{display:none}
#__aiview .av-legend summary::before{content:'▸ ';color:#6b7280}
#__aiview .av-legend details[open] summary::before{content:'▾ '}
#__aiview .av-legend .av-row{display:flex;gap:8px;align-items:baseline;padding:2px 0 2px 14px;cursor:pointer;border-radius:3px}
#__aiview .av-legend .av-row:hover{background:#eef2ff}
#__aiview .av-legend .av-row em{font-style:normal;color:#6b7280;margin-left:auto}
#__aiview .av-pv{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(880px,86vw);max-height:84vh;display:flex;flex-direction:column;background:#fff;color:#1a1a1a;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.35);pointer-events:auto;overflow:hidden}
#__aiview .av-pvh{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid #e5e7eb;background:#f8fafc;${UI_FONT}}
#__aiview .av-pvh b{font-weight:600;font-size:13px}
#__aiview .av-pvh em{font-style:normal;color:#6b7280}
#__aiview .av-pvh code{font:12px ui-monospace,Consolas,monospace;background:#eef2ff;color:#1e3a8a;padding:2px 6px;border-radius:4px;user-select:all}
#__aiview .av-pvh button{margin-left:auto;padding:3px 9px;border:1px solid #d1d5db;border-radius:5px;background:#fff;cursor:pointer;font:inherit}
#__aiview .av-pvh button+button{margin-left:0}
#__aiview .av-pvh button.av-x{font-size:14px;line-height:1;padding:2px 8px}
#__aiview .av-pvb{padding:16px;overflow:auto;background:repeating-linear-gradient(45deg,#fafafa 0 12px,#f4f4f5 12px 24px)}
#__aiview .av-pvb>*{background:#fff}
#__aiview .av-pvb .av-wrap{background:#fff;border-radius:6px;padding:12px;max-width:100%}
`;

// The script is plain, dependency-free browser code. It reads its data from the
// attributes of the layer element so the html stays inert until it runs.
const SCRIPT = `
(function(){
  var layer=document.getElementById('__aiview'); if(!layer) return;
  var summary=JSON.parse(layer.getAttribute('data-summary')||'{"sources":[],"errors":[],"warnings":[]}');
  var target=layer.getAttribute('data-target')||'';
  var ownFile=layer.getAttribute('data-file')||'';
  var short=function(f){return f.replace(/^\\d{4}-\\d{2}-\\d{2}-/,'').replace(/\\.mockup\\.html$/,'').replace(/\\.html$/,'')};
  var esc=function(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')};
  var svgNS='http://www.w3.org/2000/svg';
  var svg=document.createElementNS(svgNS,'svg');
  // The veil is one path with even-odd holes, never an SVG mask: Chrome does not always
  // repaint a masked element when the mask's children change, so cut-outs appeared only
  // once something else forced a paint. A path repaints whenever its d changes.
  svg.innerHTML='<path fill="rgba(255,255,255,.4)" fill-rule="evenodd" d=""/>';
  layer.appendChild(svg);
  var veil=svg.querySelector('path');
  var legend=document.createElement('div'); legend.className='av-legend'; layer.appendChild(legend);
  var entries=[]; var pv=null;
  function build(){
    entries.forEach(function(b){b.box.remove()}); entries=[];
    var els=document.querySelectorAll('[data-bound],[data-bound-error]');
    var byFile={};
    els.forEach(function(el){
      var ref=el.getAttribute('data-bound')||el.getAttribute('data-bound-error')||'';
      var isErr=el.hasAttribute('data-bound-error');
      var i=ref.indexOf('#'); var file=i<0?ref:ref.slice(0,i); var name=i<0?'':ref.slice(i+1);
      var box=document.createElement('div'); box.className='av-box'+(isErr?' av-err':'');
      var lbl=document.createElement('span'); lbl.className='av-lbl';
      lbl.textContent=isErr?(el.textContent||ref):(short(file)+' \\u00b7 '+name+' \\u00b7 pulled');
      var idx=entries.length;
      if(!isErr) lbl.addEventListener('click',function(ev){ev.stopPropagation();parent.postMessage({type:'aiview:open',file:file,component:name},'*')});
      if(!isErr) box.addEventListener('click',function(ev){ev.stopPropagation();preview(idx)});
      box.appendChild(lbl); layer.appendChild(box);
      entries.push({el:el,box:box,file:file,name:name,err:isErr,visible:false});
      if(!isErr){ (byFile[file]=byFile[file]||[]).push(idx); }
    });
    var declared=[];
    document.querySelectorAll('[data-component]').forEach(function(el){
      if(el.hasAttribute('data-bound')||el.hasAttribute('data-bound-error')||el.closest('[data-bound]')||layer.contains(el)) return;
      var name=el.getAttribute('data-component');
      var box=document.createElement('div'); box.className='av-box av-decl';
      var lbl=document.createElement('span'); lbl.className='av-lbl'; lbl.textContent=name+' \\u00b7 offered';
      var idx=entries.length;
      box.addEventListener('click',function(ev){ev.stopPropagation();preview(idx)});
      box.appendChild(lbl); layer.appendChild(box);
      entries.push({el:el,box:box,file:ownFile,name:name,err:false,decl:true,visible:false});
      declared.push(idx);
    });
    place();
    var html='';
    Object.keys(byFile).forEach(function(f){
      html+='<details open><summary>Pulled from <b>'+esc(short(f))+'</b> \\u00b7 '+byFile[f].length+'</summary>';
      byFile[f].forEach(function(idx){ var e=entries[idx]; html+='<div class="av-row" data-i="'+idx+'">'+esc(e.name)+(e.visible?'':'<em>hidden</em>')+'</div>'; });
      html+='</details>';
    });
    if(!Object.keys(byFile).length&&!summary.errors.length) html+='<div>No bindings in this mockup</div>';
    if(declared.length){
      html+='<details><summary><b>Offered</b> by this mockup \\u00b7 '+declared.length+'</summary>';
      declared.forEach(function(idx){ var e=entries[idx]; html+='<div class="av-row" data-i="'+idx+'">'+esc(e.name)+(e.visible?'':'<em>hidden</em>')+'</div>'; });
      html+='</details>';
    }
    summary.errors.forEach(function(e){html+='<div class="av-err">'+esc(e.ref)+': '+esc(e.message)+'</div>'});
    summary.warnings.forEach(function(w){html+='<div class="av-warn">'+esc(w.ref)+': '+esc(w.message)+'</div>'});
    legend.innerHTML=html;
  }
  function place(){
    var d='M0 0H'+innerWidth+'V'+innerHeight+'H0Z';
    entries.forEach(function(b){
      var r=b.el.getBoundingClientRect();
      b.visible=!!(r.width||r.height);
      b.box.style.left=r.left+'px'; b.box.style.top=r.top+'px'; b.box.style.width=r.width+'px'; b.box.style.height=r.height+'px';
      b.box.style.display=b.visible?'block':'none';
      if(b.err||!b.visible) return; // pulled and offered alike render at full strength under their outline
      d+='M'+r.left+' '+r.top+'h'+r.width+'v'+r.height+'h'+(-r.width)+'Z';
    });
    veil.setAttribute('d',d);
  }
  var queued=false;
  function schedule(){ if(queued) return; queued=true; requestAnimationFrame(function(){queued=false;place()}); }
  function rebuild(){ if(queued) return; queued=true; requestAnimationFrame(function(){queued=false;build()}); }
  window.addEventListener('resize',schedule); window.addEventListener('scroll',schedule,true);
  // layout settles after the script ran: measure again on load, when fonts arrive, and once more a moment later
  window.addEventListener('load',schedule); if(document.fonts&&document.fonts.ready) document.fonts.ready.then(schedule); setTimeout(schedule,400);
  new MutationObserver(function(muts){
    for(var i=0;i<muts.length;i++){ if(layer.contains(muts[i].target)) continue; rebuild(); return; }
  }).observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});
  // the preview: the element cloned into a panel of the layer, rendered by the page's own styles
  function closePreview(){ if(pv){pv.remove();pv=null;} }
  function preview(idx){
    var e=entries[idx]; if(!e||e.err) return; closePreview();
    pv=document.createElement('div'); pv.className='av-pv';
    var head=e.decl
      ?'<b>'+esc(e.name)+'</b><em>offered by this mockup</em>'+(ownFile?'<code>&lt;div data-bind="'+esc(ownFile)+'#'+esc(e.name)+'"&gt;&lt;/div&gt;</code>':'')+(e.visible?'':'<em>hidden</em>')
      :'<b>'+esc(e.name)+'</b><em>pulled from '+esc(short(e.file))+'</em>'+(e.visible?'':'<em>hidden in this mockup</em>')+'<button data-act="open">Open source</button>';
    pv.innerHTML='<div class="av-pvh">'+head+'<button class="av-x" data-act="close" aria-label="Close">\\u00d7</button></div><div class="av-pvb"><div class="av-wrap"></div></div>';
    var clone=e.el.cloneNode(true); clone.removeAttribute('hidden'); clone.style.display='';
    pv.querySelector('.av-wrap').appendChild(clone);
    pv.addEventListener('click',function(ev){ var b=ev.target.closest('[data-act]'); ev.stopPropagation(); if(!b) return;
      if(b.dataset.act==='close') closePreview();
      if(b.dataset.act==='open') parent.postMessage({type:'aiview:open',file:e.file,component:e.name},'*'); });
    layer.appendChild(pv);
  }
  layer.addEventListener('click',function(ev){
    var row=ev.target.closest('.av-legend .av-row'); if(row){ preview(+row.getAttribute('data-i')); return; }
    if(ev.target.closest('.av-legend')) return;
    if(pv&&pv.contains(ev.target)) return;
    if(pv) closePreview();
  });
  document.addEventListener('keydown',function(ev){ if(ev.key==='Escape') closePreview(); },true);
  build();
  if(target){
    var t=document.querySelector('[data-component="'+target.replace(/"/g,'')+'"]');
    if(t){ t.scrollIntoView({block:'center'}); var fb=document.createElement('div'); fb.className='av-box av-flash'; layer.appendChild(fb);
      var r=t.getBoundingClientRect(); fb.style.left=r.left+'px'; fb.style.top=r.top+'px'; fb.style.width=r.width+'px'; fb.style.height=r.height+'px';
      setTimeout(function(){fb.remove()},1300); }
  }
})();
`;

const attr = (s: string): string => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The served html with the composition layer appended. Idempotent on the marker. */
export function withOverlay(html: string, { bindings, target, file }: OverlayOptions = {}): string {
  const summary = JSON.stringify(bindings ?? { sources: [], errors: [], warnings: [] });
  const snippet =
    `<style ${OVERLAY_MARK}>${CSS}</style>` +
    `<div id="__aiview" ${OVERLAY_MARK} data-summary="${attr(summary)}"${target ? ` data-target="${attr(target)}"` : ""}${file ? ` data-file="${attr(file)}"` : ""}></div>` +
    `<script ${OVERLAY_MARK}>${SCRIPT}</script>`;
  const i = html.lastIndexOf("</body>");
  return i < 0 ? html + snippet : html.slice(0, i) + snippet + html.slice(i);
}
