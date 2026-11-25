const V="painel-trt8-v6";
const SHELL=["./","index.html","estudo.js","q/publico.json","manifest.webmanifest","lib/pdf.min.js","lib/pdf.worker.min.js","icons/icon-192.png","icons/apple-touch-icon.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k!=="painel-trt8-pdf").map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url); if(e.request.method!=="GET"||u.origin!==location.origin) return;
  if(u.pathname.includes("/pdf/")){
    e.respondWith(caches.open("painel-trt8-pdf").then(async c=>{ const hit=await c.match(u.pathname); if(hit) return hit; const r=await fetch(e.request); if(r.ok) c.put(u.pathname,r.clone()); return r; }));
    return;
  }
  e.respondWith(fetch(e.request).then(r=>{ if(r.ok){ const cp=r.clone(); caches.open(V).then(c=>c.put(e.request,cp)); } return r; }).catch(()=>caches.match(e.request).then(h=>h||caches.match("index.html"))));
});
