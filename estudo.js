// Banco de questões, simulados no app e caderno de erros ampliado
var QST = { r:{}, sim:{}, motivos:null };
var PUB = null, PACK = null, QMAP = {}, PACKMSG = "";
const MOTIVOS_PADRAO = ["Chutei","Não estudei o suficiente","Confundi institutos","Não lembrei a letra da lei","Li o enunciado com pressa","Faltou tempo"];
const FONTES = {fcc:"Provas FCC reais", au:"Exercícios do material 16", pa:"PasseiApostilas comentadas"};
const L5 = ["A","B","C","D","E"];
(function(){ const st=window.__ST||{}; if(st.questoes) QST=Object.assign(QST, st.questoes); if(!Array.isArray(QST.motivos)) QST.motivos=MOTIVOS_PADRAO.slice(); for(const k in QST.sim){ const st=QST.sim[k]; if(st&&st.t0) st.t0=null; } })();
function motivos(){ return QST.motivos&&QST.motivos.length?QST.motivos:MOTIVOS_PADRAO; }

// ---------- IndexedDB para o pacote ----------
function idb(){ return new Promise((ok,ko)=>{ const r=indexedDB.open("painel-trt8-pack",1); r.onupgradeneeded=()=>r.result.createObjectStore("kv"); r.onsuccess=()=>ok(r.result); r.onerror=()=>ko(r.error); }); }
async function idbGet(k){ const d=await idb(); return new Promise((ok,ko)=>{ const t=d.transaction("kv").objectStore("kv").get(k); t.onsuccess=()=>ok(t.result); t.onerror=()=>ko(t.error); }); }
async function idbSet(k,v){ const d=await idb(); return new Promise((ok,ko)=>{ const tx=d.transaction("kv","readwrite"); tx.objectStore("kv").put(v,k); tx.oncomplete=()=>ok(); tx.onerror=()=>ko(tx.error); }); }

function indexAll(){
  QMAP={};
  const add=list=>list.forEach(q=>QMAP[q.id]=q);
  if(PUB){ add(PUB.banco); Object.values(PUB.simulados).forEach(s=>add(s.q)); }
  if(PACK){ add(PACK.banco); Object.values(PACK.simulados).forEach(s=>add(s.q)); }
  BANCO=null;
}
let BANCO=null;
function banco(){ if(!BANCO){ BANCO=[...(PUB?PUB.banco:[]), ...(PACK?PACK.banco:[])]; } return BANCO; }
function simSrc(id){ return (PUB&&PUB.simulados[id])||(PACK&&PACK.simulados[id])||null; }

(async()=>{
  try{ const r=await fetch("q/publico.json"); if(r.ok) PUB=await r.json(); }catch(_){}
  try{ PACK=await idbGet("pack")||null; }catch(_){ PACK=null; }
  indexAll(); renderAll(false);
})();

async function importPack(file,msgEl){
  msgEl.textContent="Lendo o arquivo…";
  try{
    const d=JSON.parse(await file.text());
    if(!d||d.tipo!=="pacote"||!Array.isArray(d.banco)) throw new Error("formato");
    msgEl.textContent="Guardando no aparelho…";
    await idbSet("pack",d); PACK=d; indexAll();
    PACKMSG=`Pacote importado: ${d.banco.length.toLocaleString("pt-BR")} questões e ${Object.keys(d.simulados||{}).length} simulados.`;
    renderAll(false); setStatus(PACKMSG); setTimeout(()=>setStatus(""),8000);
  }catch(e){ msgEl.textContent = e&&e.message==="formato" ? "Este arquivo não é o pacote de estudos do painel." : "Não foi possível importar o pacote. Tente de novo; se persistir, libere espaço no aparelho."; }
}
function packCard(){
  if(PACK) return "";
  return `<div class="card qpack"><b>Importe o pacote de estudos</b><p class="note" style="margin:4px 0 8px">O arquivo <i>pacote_estudos_TRT8.json</i> traz as 9.002 questões comentadas da PasseiApostilas e os simulados 1, 3, 4, 5 e 6. Ele fica guardado só neste aparelho e funciona sem internet. Enquanto isso, estão disponíveis as provas reais da FCC, os exercícios do material 16 e o Simulado 2.</p>
  <label class="btn" style="display:inline-flex;cursor:pointer">Importar pacote<input type="file" accept=".json,application/json" hidden data-pack></label> <span class="saved" data-packmsg>${esc(PACKMSG)}</span></div>`;
}
document.addEventListener("change",e=>{ if(e.target.matches("input[data-pack]")){ const f=e.target.files[0]; const m=e.target.closest(".card").querySelector("[data-packmsg]"); if(f) importPack(f,m); } });

// ---------- respostas ----------
function answer(q,x,ch,src){ const ok=x===q.a; QST.r[q.id]={x,ok,d:TODAY,ch:!!ch,src:src||"banco"}; persist(); return ok; }
function addErr(q,motivo,nota,origem){
  const prev=ERR.find(e=>e.qid===q.id && statusErr(e)==="Pendente");
  const doc={data:TODAY,materia:q.m,causa:motivo,nota,tema:q.t||"Prova FCC TRT4 2022",questao:q.p,qid:q.id,origem,regra:`Gabarito: ${q.a}. Marquei ${(QST.r[q.id]||{}).x||"–"}.`,alerta:"",ver:q.d?`cronograma de ${br(q.d)}`:"",r1:"",r2:""};
  if(prev) Object.assign(prev,doc); else ERR.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),...doc});
  persist();
}

// ---------- renderização de uma questão ----------
function para(t){
  const out=[]; let tab=null;
  for(const l of String(t||"").split("\n")){
    if(l.startsWith("|")){ const cells=l.slice(1).split("|"); if(!tab){ tab=[]; out.push(()=>`<table class="qtab"><thead><tr>${tab[0].map(c=>`<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${tab.slice(1).map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`); } tab.push(cells); continue; }
    tab=null; out.push(l.startsWith("## ")?`<h4>${esc(l.slice(3))}</h4>`:`<p>${esc(l)}</p>`);
  }
  return out.map(x=>typeof x==="function"?x():x).join("");
}
function pasText(p){
  const t=PUB&&PUB.pas&&PUB.pas[p]; if(!t) return null;
  if(t.ln) return `${t.h?`<p class="meta">${esc(t.h)}</p>`:""}<ol class="qlines">${t.ln.map(l=>`<li>${esc(l)}</li>`).join("")}</ol>${t.src?`<p class="meta">${esc(t.src)}</p>`:""}`;
  return para((t.p||[]).join("\n"));
}
function orig(src,label){ return `<details class="qorig"><summary>${label||"Ver original"}</summary><img src="q/${src}" alt="Imagem original da prova" loading="lazy"></details>`; }
function qBody(q){
  let h="";
  if(q.pas&&q.pas.length) h+=`<details class="qpas"><summary>Texto de apoio</summary>${q.pas.map(p=>{ const tx=pasText(p); return tx?`<div class="qtx">${tx}</div>${orig(p,"Ver o texto original")}`:`<img src="q/${p}" alt="Texto de apoio da questão" loading="lazy">`; }).join("")}</details>`;
  if(q.tx) h+=`<details class="qpas"><summary>Texto de apoio</summary><div class="qtx">${para(q.tx)}</div></details>`;
  if(q.img&&!q.s) h+=`<img class="qimg" src="q/${q.img}" alt="Enunciado e alternativas da questão" loading="lazy">`;
  else { h+=`<div class="qstem">${para(q.s)}</div>`; if(q.fig) h+=`<img class="qimg" src="q/${q.img}" alt="Questão original com a figura" loading="lazy">`; else if(q.img&&q.dest) h+=`<p class="meta">Os destaques do enunciado (sublinhado, negrito) aparecem só no original:</p>`+orig(q.img,"Ver original da prova").replace("<details ","<details open "); else if(q.img) h+=orig(q.img,"Ver original da prova"); }
  return h;
}
function optsHtml(q,state){ // state: {sel, done, x}
  return `<div class="qopts">${L5.map((L,i)=>{
    let cls="qopt"; if(state.done){ if(L===q.a) cls+=" ok"; else if(L===state.x) cls+=" bad"; } else if(state.sel===L) cls+=" sel";
    return `<button type="button" class="${cls}" data-opt="${L}" ${state.done?"disabled":""}><b>${L}</b>${q.o?`<span>${esc(q.o[i])}</span>`:""}</button>`; }).join("")}</div>`;
}
function errPanel(q,origem){
  const r=QST.r[q.id]||{}; const inErr=ERR.find(e=>e.qid===q.id&&statusErr(e)==="Pendente");
  if(inErr) return `<div class="qerr sent">No caderno de erros: <b>${esc(inErr.causa)}</b>${inErr.nota?` · ${esc(inErr.nota)}`:""}</div>`;
  if(r.ok&&!r.ch) return "";
  return `<div class="qerr" data-qerr="${q.id}" data-origem="${origem}">
    <div class="meta">${r.ok?"Você acertou no chute. Quer registrar no caderno de erros?":"Por que você errou?"}</div>
    <div class="chips">${motivos().map(m=>`<button type="button" class="chip" data-mot="${esc(m)}" aria-pressed="${r.ok&&m==="Chutei"}">${esc(m)}</button>`).join("")}</div>
    <label class="f">Sua anotação<textarea rows="2" data-nota placeholder="Ex.: confundi prazo de 30 dias com 60 dias"></textarea></label>
    <div style="display:flex;gap:8px;align-items:center"><button type="button" class="btn" data-senderr>Enviar ao caderno de erros</button><span class="saved" data-errmsg></span></div></div>`;
}
function feedback(q,origem){
  const r=QST.r[q.id]; if(!r) return "";
  return `<div class="qfb ${r.ok?"good":"bad"}"><b>${r.ok?"Certo.":"Errado."}</b> Gabarito: ${q.a}${r.ok?"":` · você marcou ${r.x}`}</div>
  ${q.c?`<details class="qcom" open><summary>Comentário</summary>${para(q.c)}</details>`:`<p class="note">${q.f==="fcc"?"Gabarito oficial da FCC; esta questão não tem comentário.":""}</p>`}
  ${errPanel(q,origem)}`;
}
document.addEventListener("click",e=>{
  const c=e.target.closest(".qerr .chip"); if(c){ c.closest(".chips").querySelectorAll(".chip").forEach(b=>b.setAttribute("aria-pressed",b===c)); return; }
  const s=e.target.closest("[data-senderr]"); if(s){ const box=s.closest(".qerr"); const q=QMAP[box.dataset.qerr]; const m=box.querySelector('.chip[aria-pressed="true"]');
    if(!m){ box.querySelector("[data-errmsg]").textContent="Escolha o motivo do erro."; return; }
    addErr(q,m.dataset.mot,box.querySelector("[data-nota]").value.trim(),box.dataset.origem);
    box.outerHTML=errPanel(q,box.dataset.origem); }
});

// ---------- aba Questões ----------
const QF={fonte:"todas",mat:"todas",tema:"todos",dia:"todos",dif:"todos",sit:"nao",ord:"ordem",i:0};
let QLIST=[], qSel=null, qChute=false;
function qFilter(){
  const B=banco();
  QLIST=B.filter(q=>(QF.fonte==="todas"||q.f===QF.fonte)&&(QF.mat==="todas"||q.m===QF.mat)&&(QF.tema==="todos"||q.t===QF.tema)
    &&(QF.dia==="todos"||(QF.dia==="hoje"?q.d===TODAY:q.d===QF.dia))&&(QF.dif==="todos"||q.dif===QF.dif)
    &&(QF.sit==="todas"||(QF.sit==="nao"?!QST.r[q.id]:QF.sit==="erradas"?(QST.r[q.id]&&!QST.r[q.id].ok):(QST.r[q.id]&&QST.r[q.id].ok))));
  if(QF.ord==="aleatoria"){ let s=QF.seed||1; const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647; }; QLIST=QLIST.map(q=>[rnd(),q]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]); }
}
function renderQ(){
  const el=document.getElementById("v-questoes"); if(!el) return;
  if(!PUB&&!PACK){ el.innerHTML=`<h2>Banco de questões</h2><div class="empty">Carregando as questões…</div>`; return; }
  const B=banco();
  const sel=(id,val,opts)=>`<select id="${id}">${opts.map(([v,t])=>`<option value="${esc(v)}" ${v===val?"selected":""}>${esc(t)}</option>`).join("")}</select>`;
  const mats=[...new Set(B.map(q=>q.m))].sort((a,b)=>MATERIAS.indexOf(a)-MATERIAS.indexOf(b));
  const temas=[...new Set(B.filter(q=>QF.mat==="todas"||q.m===QF.mat).map(q=>q.t))].sort((a,b)=>a.localeCompare(b,"pt"));
  if(QF.tema!=="todos"&&!temas.includes(QF.tema)) QF.tema="todos";
  const dias=[...new Set(B.map(q=>q.d).filter(Boolean))].sort();
  qFilter(); if(QF.i>=QLIST.length) QF.i=Math.max(0,QLIST.length-1);
  const resolvidas=B.filter(q=>QST.r[q.id]).length, certas=B.filter(q=>QST.r[q.id]&&QST.r[q.id].ok).length;
  const q=QLIST[QF.i];
  el.innerHTML=`<h2>Banco de questões</h2>${packCard()}
  <div class="card qfil">
    <label class="f">Fonte${sel("qfFonte",QF.fonte,[["todas","Todas"],...Object.entries(FONTES).filter(([k])=>B.some(x=>x.f===k))])}</label>
    <label class="f">Matéria${sel("qfMat",QF.mat,[["todas","Todas"],...mats.map(m=>[m,m])])}</label>
    <label class="f wide">Tema ou tópico${sel("qfTema",QF.tema,[["todos","Todos"],...temas.map(t=>[t,t])])}</label>
    <label class="f">Dia do cronograma${sel("qfDia",QF.dia,[["todos","Todos"],["hoje","Hoje"],...dias.map(d=>[d,br(d)+" · "+wd(d)])])}</label>
    <label class="f">Nível${sel("qfDif",QF.dif,[["todos","Todos"],["Fácil","Fácil"],["Médio","Médio"],["Difícil","Difícil"]])}</label>
    <label class="f">Situação${sel("qfSit",QF.sit,[["nao","Não resolvidas"],["erradas","Erradas"],["certas","Certas"],["todas","Todas"]])}</label>
    <label class="f">Ordem${sel("qfOrd",QF.ord,[["ordem","Na ordem"],["aleatoria","Aleatória"]])}</label>
  </div>
  <p class="meta">${QLIST.length.toLocaleString("pt-BR")} questões neste filtro · ${resolvidas.toLocaleString("pt-BR")} resolvidas no total, ${pct(certas,resolvidas)} de acerto.</p>
  ${q?qCard(q):`<div class="empty">Nenhuma questão com esse filtro.</div>`}`;
  const bind=(id,k)=>document.getElementById(id).onchange=e=>{ QF[k]=e.target.value; if(k==="ord") QF.seed=Date.now()%2147483646+1; if(k==="mat") QF.tema="todos"; QF.i=0; qSel=null; qChute=false; renderQ(); };
  bind("qfFonte","fonte"); bind("qfMat","mat"); bind("qfTema","tema"); bind("qfDia","dia"); bind("qfDif","dif"); bind("qfSit","sit"); bind("qfOrd","ord");
}
function qCard(q){
  const r=QST.r[q.id];
  return `<div class="card qcard" data-qid="${q.id}">
    <div class="qhead"><span class="meta">${QF.i+1} de ${QLIST.length} · ${esc(q.p)}</span>${q.dif?`<span class="pill p-futuro">${esc(q.dif)}</span>`:""}</div>
    <div class="qtema"><b>${esc(q.m)}</b> · ${esc(q.t)}${q.d?` · <span class="meta">cronograma de ${br(q.d)}</span>`:""}</div>
    ${qBody(q)}
    ${optsHtml(q,{sel:qSel,done:!!r,x:r&&r.x})}
    ${r?feedback(q,"banco"):`<div class="qact"><label class="chk"><input type="checkbox" id="qChute" ${qChute?"checked":""}> Estou chutando</label><button type="button" class="btn" id="qResp" ${qSel?"":"disabled"}>Responder</button></div>`}
    <div class="qnav"><button type="button" class="btn ghost" id="qPrev" ${QF.i?"":"disabled"}>‹ Anterior</button>${r?`<button type="button" class="btn ghost" id="qRedo">Refazer esta</button>`:""}<button type="button" class="btn ghost" id="qNext" ${QF.i<QLIST.length-1?"":"disabled"}>Próxima ›</button></div>
  </div>`;
}
document.addEventListener("click",e=>{
  const card=e.target.closest("#v-questoes .qcard[data-qid]"); if(!card) return;
  const q=QMAP[card.dataset.qid]; if(!q) return;
  const o=e.target.closest("[data-opt]"); if(o&&!QST.r[q.id]){ qSel=o.dataset.opt; card.querySelectorAll("[data-opt]").forEach(b=>b.classList.toggle("sel",b===o)); const r=document.getElementById("qResp"); if(r) r.disabled=false; return; }
  if(e.target.id==="qChute"){ qChute=e.target.checked; return; }
  if(e.target.id==="qResp"&&qSel){ answer(q,qSel,qChute,"banco"); renderQAfter(q); return; }
  if(e.target.id==="qNext"||e.target.id==="qPrev"){ if(QF.sit!=="todas"&&QST.r[q.id]){ qFilter(); const j=QLIST.indexOf(q); /* a respondida saiu do filtro */ if(j<0){ if(e.target.id==="qPrev") QF.i=Math.max(0,QF.i-1); } else QF.i+= e.target.id==="qNext"?1:-1; } else QF.i+= e.target.id==="qNext"?1:-1; qSel=null; qChute=false; renderQ(); window.scrollTo({top:document.getElementById("v-questoes").offsetTop-60}); return; }
  if(e.target.id==="qRedo"){ delete QST.r[q.id]; persist(); qSel=null; qChute=false; renderQAfter(q); }
});
function renderQAfter(q){ // re-render mantendo a questão na tela, mesmo que saia do filtro
  const card=document.querySelector("#v-questoes .qcard"); if(!card) return renderQ();
  const tmp=document.createElement("div"); tmp.innerHTML=qCard(q); card.replaceWith(tmp.firstElementChild);
}

// ---------- simulados ----------
let SIMRUN=null; // {id, i}
let simTick=null;
function runState(id){ return QST.sim[id]||(QST.sim[id]={ans:{},el:0,fim:null}); }
function fmtT(ms){ const s=Math.floor(ms/1000); return `${Math.floor(s/3600)}h${pad(Math.floor(s/60)%60)}min${pad(s%60)}`; }
const _renderSimTable = renderSim;
renderSim = function(){
  if(SIMRUN) return renderRunner();
  _renderSimTable();
  const el=document.getElementById("v-simulados");
  const tb=el.querySelector("table"); if(!tb) return;
  tb.querySelector("thead tr").insertAdjacentHTML("beforeend","<th>No app</th>");
  tb.querySelectorAll("tbody tr").forEach(tr=>{ const id=tr.dataset.s, src=simSrc(id), st=QST.sim[id];
    let h; if(!src) h=`<span class="meta">${id==="s2"?"carregando":"importe o pacote"}</span>`;
    else if(st&&st.fim) h=`<button type="button" class="btn ghost" data-sim="${id}" data-modo="rev">Ver correção</button>`;
    else h=`<button type="button" class="btn" data-sim="${id}" data-modo="run">${st&&Object.keys(st.ans).length?`Continuar (${Object.keys(st.ans).length}/${src.q.length})`:"Resolver no app"}</button>`;
    tr.insertAdjacentHTML("beforeend",`<td>${h}</td>`); });
  el.insertAdjacentHTML("beforeend",`${PACK?"":packCard()}<p class="note">Ao entregar um simulado resolvido no app, os acertos gerais e específicos entram automaticamente nesta tabela, as respostas passam a contar no desempenho por matéria e você pode enviar cada erro ao caderno com o motivo e a sua anotação. A nota da discursiva continua sendo lançada à mão. Fontes: Simulado 2, prova FCC do TRT4 de 2022; Simulados 1, 3, 4, 5 e 6, simulados PasseiApostilas 01 a 05 (modelo TRT8, 20 gerais e 40 específicas).</p>`);
};
document.addEventListener("click",e=>{
  const b=e.target.closest("#v-simulados [data-sim]"); if(!b) return;
  SIMRUN={id:b.dataset.sim,i:0,modo:b.dataset.modo,so:"todas"}; runState(SIMRUN.id); renderSim(); window.scrollTo({top:0});
});
function simDef(id){ return SIMS.find(s=>s.id===id); }
function renderRunner(){
  const el=document.getElementById("v-simulados"); const id=SIMRUN.id, src=simSrc(id), st=runState(id), def=simDef(id);
  if(!src){ SIMRUN=null; return renderSim(); }
  const qs=src.q, review=!!st.fim;
  if(!review&&!st.t0&&!document.hidden){ st.t0=Date.now(); }
  let list=qs; if(review&&SIMRUN.so==="erradas") list=qs.filter(q=>st.ans[q.id]!==q.a);
  if(SIMRUN.i>=list.length) SIMRUN.i=Math.max(0,list.length-1);
  const q=list[SIMRUN.i];
  const nav=qs.map((x,k)=>{ let c="nv"; if(review) c+= st.ans[x.id]===x.a?" ok":" bad"; else if(st.ans[x.id]) c+=" an"; if(x===q) c+=" cur"; return `<button type="button" class="${c}" data-go="${k}">${x.n}</button>`; }).join("");
  const res=review?simResult(id):null;
  el.innerHTML=`<div class="simtop"><button type="button" class="btn ghost" id="sBack">‹ Voltar à tabela</button><div><b>${def.n}</b> · <span class="meta">${esc(src.fonte)}</span></div>
    ${review?"":`<div class="simclock" id="sClock">${fmtT(st.el+(st.t0?Date.now()-st.t0:0))}</div>`}</div>
  ${review?`<div class="kpis"><div class="kpi"><div class="v">${res.ag}/${res.G}</div><div class="l">acertos gerais</div></div><div class="kpi"><div class="v">${res.ae}/${res.E}</div><div class="l">acertos específicas</div></div><div class="kpi"><div class="v">${res.nota.toFixed(2).replace(".",",")}</div><div class="l">nota objetiva</div></div><div class="kpi"><div class="v">${fmtT(st.el).replace(/min\d+$/,"min")}</div><div class="l">tempo de prova</div></div></div>
    <div class="filters"><label class="f">Mostrar<select id="sSo"><option value="todas">Todas as questões</option><option value="erradas" ${SIMRUN.so==="erradas"?"selected":""}>Só as erradas e em branco</option></select></label><span class="meta" style="flex:1"></span><button type="button" class="btn ghost" id="sRedo">Refazer simulado</button></div>`
   :`<p class="note">Respondidas ${Object.keys(st.ans).length} de ${qs.length}. As respostas ficam salvas; você pode sair e continuar depois. O relógio pausa quando o app sai da tela.</p>`}
  <div class="simnav">${nav}</div>
  ${q?simQ(q,st,review,list.length):`<div class="empty">Nenhuma questão errada. Parabéns.</div>`}
  ${review?"":`<div class="card" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button type="button" class="btn" id="sEnd">Entregar simulado</button><span class="saved" id="sEndMsg"></span></div>`}`;
  clearInterval(simTick); if(!review) simTick=setInterval(()=>{ const c=document.getElementById("sClock"); if(!c||!SIMRUN){ clearInterval(simTick); return; } c.textContent=fmtT(st.el+(st.t0?Date.now()-st.t0:0)); },1000);
}
function simQ(q,st,review,n){
  const x=st.ans[q.id];
  return `<div class="card qcard" data-simq="${q.id}">
    <div class="qhead"><span class="meta">Questão ${q.n} · ${q.bloco==="G"?"Conhecimentos gerais":"Conhecimentos específicos"}</span>${review?`<span class="meta">${esc(q.m)}${q.t?" · "+esc(q.t):""}</span>`:""}</div>
    ${qBody(q)}
    ${review?optsHtml(q,{done:true,x}):optsHtml(q,{sel:x,done:false})}
    ${review?`<div class="qfb ${x===q.a?"good":"bad"}"><b>${x===q.a?"Certo.":x?"Errado.":"Em branco."}</b> Gabarito: ${q.a}${x&&x!==q.a?` · você marcou ${x}`:""}</div>${q.c?`<details class="qcom"><summary>Comentário</summary>${para(q.c)}</details>`:""}${x===q.a?"":errPanel(q,"simulado")}`:""}
    <div class="qnav"><button type="button" class="btn ghost" data-step="-1" ${SIMRUN.i?"":"disabled"}>‹ Anterior</button>${review?"":`<button type="button" class="btn ghost" data-clear ${x?"":"disabled"}>Limpar resposta</button>`}<button type="button" class="btn ghost" data-step="1" ${SIMRUN.i<n-1?"":"disabled"}>Próxima ›</button></div></div>`;
}
function simResult(id){
  const src=simSrc(id), st=runState(id), def=simDef(id);
  let ag=0,ae=0,G=0,E=0; src.q.forEach(q=>{ const ok=st.ans[q.id]===q.a; if(q.bloco==="G"){G++; if(ok) ag++;} else {E++; if(ok) ae++;} });
  return {ag,ae,G,E,nota:(ag/G*10+2*ae/E*10)/3};
}
function pauseClock(){ if(!SIMRUN) return; const st=QST.sim[SIMRUN.id]; if(st&&st.t0&&!st.fim){ st.el+=Date.now()-st.t0; st.t0=null; persist(); } }
document.addEventListener("visibilitychange",()=>{ if(document.hidden) pauseClock(); else if(SIMRUN&&view==="simulados"){ const st=QST.sim[SIMRUN.id]; if(st&&!st.fim&&!st.t0) st.t0=Date.now(); } });
document.addEventListener("click",e=>{
  if(!SIMRUN||!e.target.closest("#v-simulados")) return;
  const id=SIMRUN.id, st=runState(id), src=simSrc(id);
  if(e.target.id==="sBack"){ pauseClock(); SIMRUN=null; renderSim(); return; }
  const go=e.target.closest("[data-go]"); if(go){ const q=src.q[+go.dataset.go]; SIMRUN.so="todas"; SIMRUN.i=+go.dataset.go; renderRunner(); return; }
  const stp=e.target.closest("[data-step]"); if(stp){ SIMRUN.i+=+stp.dataset.step; renderRunner(); window.scrollTo({top:document.querySelector(".simnav").offsetTop-60}); return; }
  const card=e.target.closest("[data-simq]");
  if(card&&!st.fim){ const q=QMAP[card.dataset.simq];
    const o=e.target.closest("[data-opt]"); if(o){ st.ans[q.id]=o.dataset.opt; persist(); card.querySelectorAll("[data-opt]").forEach(b=>b.classList.toggle("sel",b===o)); const nb=document.querySelector(`.simnav [data-go="${src.q.indexOf(q)}"]`); if(nb) nb.classList.add("an"); const cl=card.querySelector("[data-clear]"); if(cl) cl.disabled=false; return; }
    if(e.target.closest("[data-clear]")){ delete st.ans[q.id]; persist(); renderRunner(); return; } }
  if(e.target.id==="sEnd"){ const m=document.getElementById("sEndMsg"); const falta=src.q.length-Object.keys(st.ans).length;
    if(!e.target.dataset.armed){ e.target.dataset.armed="1"; e.target.textContent="Confirmar entrega"; m.textContent=falta?`Há ${falta} questões em branco. Toque de novo para entregar assim mesmo.`:"Toque de novo para confirmar a entrega."; setTimeout(()=>{ if(e.target.isConnected){ delete e.target.dataset.armed; e.target.textContent="Entregar simulado"; m.textContent=""; } },6000); return; }
    pauseClock(); st.fim=TODAY;
    src.q.forEach(q=>{ if(st.ans[q.id]) QST.r[q.id]={x:st.ans[q.id],ok:st.ans[q.id]===q.a,d:TODAY,ch:false,src:"simulado"}; });
    const r=simResult(id); SIM[id]={...(SIM[id]||{}),ag:String(r.ag),ae:String(r.ae),app:true,atualizado:new Date().toISOString()};
    persist(); SIMRUN.modo="rev"; SIMRUN.i=0; SIMRUN.so="erradas"; renderRunner(); window.scrollTo({top:0}); return; }
  if(e.target.id==="sRedo"){ if(!e.target.dataset.armed){ e.target.dataset.armed="1"; e.target.textContent="Confirmar: apagar respostas"; setTimeout(()=>{ if(e.target.isConnected){ delete e.target.dataset.armed; e.target.textContent="Refazer simulado"; } },6000); return; }
    QST.sim[id]={ans:{},el:0,fim:null}; persist(); SIMRUN.i=0; SIMRUN.so="todas"; renderRunner(); }
});
document.addEventListener("change",e=>{ if(e.target.id==="sSo"&&SIMRUN){ SIMRUN.so=e.target.value; SIMRUN.i=0; renderRunner(); } });
window.addEventListener("hashchange",()=>{ if(view!=="simulados") pauseClock(); });

// ---------- caderno de erros ----------
const EF={st:"Pendente",mat:"todas",tema:"todos",mot:"todos"};
renderErr = function(){
  const el=document.getElementById("v-erros");
  const opt=(arr,sel)=>arr.map(([v,t])=>`<option value="${esc(v)}" ${v===sel?"selected":""}>${esc(t)}</option>`).join("");
  const mats=[...new Set(ERR.map(e=>e.materia).filter(Boolean))];
  const temas=[...new Set(ERR.filter(e=>EF.mat==="todas"||e.materia===EF.mat).map(e=>e.tema).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt"));
  if(EF.tema!=="todos"&&!temas.includes(EF.tema)) EF.tema="todos";
  const mots=[...new Set(ERR.map(e=>e.causa).filter(Boolean))];
  const list=ERR.filter(e=>(EF.st==="Todos"||statusErr(e)===EF.st)&&(EF.mat==="todas"||e.materia===EF.mat)&&(EF.tema==="todos"||e.tema===EF.tema)&&(EF.mot==="todos"||e.causa===EF.mot)).sort((a,b)=>(b.data||"").localeCompare(a.data||""));
  el.innerHTML=`<h2>Caderno de erros</h2>
  <div class="card qfil">
    <label class="f">Situação<select id="efSt">${opt([["Pendente","Pendentes"],["Resolvido","Resolvidos"],["Todos","Todos"]],EF.st)}</select></label>
    <label class="f">Matéria<select id="efMat">${opt([["todas","Todas"],...mats.map(m=>[m,m])],EF.mat)}</select></label>
    <label class="f wide">Tema ou tópico<select id="efTema">${opt([["todos","Todos"],...temas.map(t=>[t,t])],EF.tema)}</select></label>
    <label class="f">Motivo<select id="efMot">${opt([["todos","Todos"],...mots.map(m=>[m,m])],EF.mot)}</select></label>
  </div>
  <p class="meta">${list.length} neste filtro · ${ERR.filter(e=>statusErr(e)==="Pendente").length} pendentes · ${ERR.length} registrados. Refaça a questão no domingo da semana (1ª revisão) e no domingo seguinte (2ª revisão).</p>
  ${list.length?list.map(e=>`<div class="card err" data-id="${e.id}">
    <div class="mrow"><span><b>${esc(e.materia)}</b> · ${esc(e.tema)}</span><span class="pill ${statusErr(e)==="Resolvido"?"p-feito":"p-atraso"}">${statusErr(e)}</span></div>
    ${e.causa?`<div><span class="chip on">${esc(e.causa)}</span></div>`:""}
    ${e.nota?`<div class="rule">${esc(e.nota)}</div>`:""}
    ${e.regra?`<div class="meta">${esc(e.regra)}</div>`:""}
    <div class="bot"><span>${e.data?br(e.data):""}${e.questao?" · "+esc(e.questao):""}${e.alerta?" · alerta: "+esc(e.alerta):""}${e.ver?" · ver: "+esc(e.ver):""}</span>
      ${e.qid&&QMAP[e.qid]?`<button type="button" class="btn ghost" data-rever="${e.qid}">Rever questão</button>`:""}
      <label>1ª revisão <select data-f="r1">${opt([["",""],["Sim","Sim"],["Não","Não"]],e.r1||"")}</select></label>
      <label>2ª revisão <select data-f="r2">${opt([["",""],["Sim","Sim"],["Não","Não"]],e.r2||"")}</select></label>
      <button type="button" class="btn ghost" data-del>Excluir</button></div>
    <div class="rever" hidden></div></div>`).join(""):`<div class="empty">${ERR.length?"Nenhum erro com esse filtro.":"Nenhum erro registrado ainda. Ao errar uma questão no banco ou num simulado, escolha o motivo e envie ao caderno."}</div>`}
  <details class="card"><summary><b>Registrar erro de fora do app</b></summary>
  <form id="errForm" class="formgrid" style="margin-top:10px">
    <label class="f">Matéria<select id="e-mat" required>${opt(MATERIAS.map(m=>[m,m]))}</select></label>
    <label class="f">Motivo<select id="e-causa">${opt(motivos().map(m=>[m,m]))}</select></label>
    <label class="f">Tema<input id="e-tema" required placeholder="Ex.: competência territorial"></label>
    <label class="f">Questão (banca, órgão, ano, nº)<input id="e-q" placeholder="Ex.: FCC, TRT4, 2022, nº 41"></label>
    <label class="f wide">Sua anotação<textarea id="e-nota" rows="2" placeholder="Ex.: chutei; não lembrava o prazo"></textarea></label>
    <label class="f wide">Regra correta e fundamento<textarea id="e-regra" rows="2" placeholder="Ex.: art. 651, § 3º, da CLT"></textarea></label>
    <div class="wide" style="display:flex;gap:10px;align-items:center"><button class="btn" type="submit">Registrar erro</button><span class="saved" id="e-msg"></span></div>
  </form></details>
  <details class="card"><summary><b>Lista de motivos</b></summary>
    <div class="chips" style="margin:10px 0">${motivos().map((m,i)=>`<span class="chip on">${esc(m)} <button type="button" class="x" data-rmmot="${i}" aria-label="Remover ${esc(m)}">×</button></span>`).join("")}</div>
    <div style="display:flex;gap:8px"><input id="newMot" placeholder="Novo motivo" style="max-width:280px"><button type="button" class="btn ghost" id="addMot">Adicionar</button></div></details>`;
  const bind=(id,k)=>document.getElementById(id).onchange=ev=>{ EF[k]=ev.target.value; if(k==="mat") EF.tema="todos"; renderErr(); };
  bind("efSt","st"); bind("efMat","mat"); bind("efTema","tema"); bind("efMot","mot");
  document.getElementById("errForm").onsubmit=ev=>{ ev.preventDefault(); const g=id=>document.getElementById(id).value.trim();
    ERR.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),data:TODAY,materia:g("e-mat"),causa:g("e-causa"),nota:g("e-nota"),tema:g("e-tema"),questao:g("e-q"),regra:g("e-regra"),alerta:"",ver:"",origem:"manual",r1:"",r2:""});
    persist(); renderErr(); };
  el.querySelectorAll(".err select").forEach(s=>s.onchange=()=>{ const e=ERR.find(x=>x.id===s.closest(".err").dataset.id); if(e){ e[s.dataset.f]=s.value; persist(); renderErr(); } });
  el.querySelectorAll("[data-del]").forEach(b=>{ b.onclick=()=>{ if(!b.dataset.armed){ b.dataset.armed="1"; b.textContent="Confirmar exclusão"; setTimeout(()=>{ if(b.isConnected){ delete b.dataset.armed; b.textContent="Excluir"; } },4000); return; } const id=b.closest(".err").dataset.id; ERR=ERR.filter(x=>x.id!==id); persist(); renderErr(); }; });
  el.querySelectorAll("[data-rever]").forEach(b=>b.onclick=()=>{ const box=b.closest(".err").querySelector(".rever"); if(!box.hidden){ box.hidden=true; return; } const q=QMAP[b.dataset.rever]; const r=QST.r[q.id]||{};
    box.innerHTML=`${qBody(q)}${optsHtml(q,{done:true,x:r.x})}<div class="qfb bad">Gabarito: ${q.a}${r.x?` · você marcou ${r.x}`:""}</div>${q.c?`<details class="qcom" open><summary>Comentário</summary>${para(q.c)}</details>`:""}`; box.hidden=false; });
  el.querySelectorAll("[data-rmmot]").forEach(b=>b.onclick=()=>{ QST.motivos=motivos().filter((_,i)=>i!==+b.dataset.rmmot); persist(); renderErr(); });
  document.getElementById("addMot").onclick=()=>{ const v=document.getElementById("newMot").value.trim(); if(v&&!motivos().includes(v)){ QST.motivos=[...motivos(),v]; persist(); } renderErr(); };
};

// ---------- desempenho ----------
const _totals = totals;
totals = function(filter){ // soma as questões respondidas no app às registradas nos dias
  const t=_totals(filter);
  for(const id in QST.r){ const q=QMAP[id]; if(!q) continue; if(filter&&!filter({m:q.m,d:QST.r[id].d,h:0,k:"",f:"",a:""})) continue; t.q++; if(QST.r[id].ok) t.a++; }
  return t;
};
const _renderDes = renderDes;
renderDes = function(){
  _renderDes();
  const el=document.getElementById("v-desempenho");
  const ans=Object.entries(QST.r).map(([id,r])=>({q:QMAP[id],r})).filter(x=>x.q);
  const by=(f)=>{ const o={}; ans.forEach(x=>{ const k=f(x); if(!k) return; const v=(o[k]??={n:0,a:0}); v.n++; if(x.r.ok) v.a++; }); return o; };
  const bm=by(x=>x.q.m), bt=by(x=>x.q.m+" › "+(x.q.t||"")), bs=by(x=>x.r.src==="simulado"?"Simulados":FONTES[x.q.f]);
  const mot={}; ERR.forEach(e=>{ if(e.causa) mot[e.causa]=(mot[e.causa]||0)+1; });
  const weak=Object.entries(bt).filter(([,v])=>v.n>=3).sort((a,b)=>a[1].a/a[1].n-b[1].a/b[1].n).slice(0,12);
  const tot=ans.length, ok=ans.filter(x=>x.r.ok).length, mx=Math.max(1,...Object.values(mot));
  const hoje=ans.filter(x=>x.r.d===TODAY);
  el.querySelector(".note").insertAdjacentHTML("afterend",`<p class="note">As colunas Questões e Acerto somam o que você lança no registro de cada dia e o que responde no app. Para não contar duas vezes, não lance no registro do dia as questões já respondidas no app.</p>`);
  el.insertAdjacentHTML("beforeend",`<h2>Questões resolvidas no app</h2>
  <div class="kpis"><div class="kpi"><div class="v">${tot.toLocaleString("pt-BR")}</div><div class="l">questões respondidas</div></div><div class="kpi"><div class="v">${pct(ok,tot)}</div><div class="l">de acerto</div></div><div class="kpi"><div class="v">${hoje.length}</div><div class="l">respondidas hoje, ${pct(hoje.filter(x=>x.r.ok).length,hoje.length)} de acerto</div></div></div>
  ${tot?`<div class="tablewrap"><table><thead><tr><th>Matéria</th><th class="n">Respondidas</th><th class="n">Certas</th><th>Acerto</th></tr></thead><tbody>
  ${Object.entries(bm).sort((a,b)=>MATERIAS.indexOf(a[0])-MATERIAS.indexOf(b[0])).map(([m,v])=>`<tr><td>${esc(m)}</td><td class="n">${v.n}</td><td class="n">${v.a}</td><td>${accCell(v.a,v.n)}</td></tr>`).join("")}</tbody></table></div>
  <p class="note">Por origem: ${Object.entries(bs).map(([k,v])=>`${esc(k)}, ${v.n} (${pct(v.a,v.n)})`).join("; ")}.</p>
  ${weak.length?`<h3 style="margin-top:14px">Temas com menor acerto (mínimo de 3 questões)</h3><div class="tablewrap"><table><tbody>${weak.map(([t,v])=>`<tr><td>${esc(t)}</td><td class="n">${v.a}/${v.n}</td><td>${accCell(v.a,v.n)}</td></tr>`).join("")}</tbody></table></div>`:""}`
  :`<div class="empty">Os números aparecem quando você responder questões na aba Questões ou entregar um simulado no app.</div>`}
  ${Object.keys(mot).length?`<h3 style="margin-top:14px">Motivos dos erros no caderno</h3><div class="card">${Object.entries(mot).sort((a,b)=>b[1]-a[1]).map(([m,n])=>`<div class="motrow"><span>${esc(m)}</span><div class="bar"><i style="width:${100*n/mx}%"></i></div><span class="n">${n}</span></div>`).join("")}</div>`:""}`);
};

// ---------- Hoje: atalho para as questões do dia ----------
const _renderHoje = renderHoje;
renderHoje = function(){
  _renderHoje();
  if(!PUB&&!PACK) return;
  const qs=banco().filter(q=>q.d===TODAY); if(!qs.length) return;
  const feitas=qs.filter(q=>QST.r[q.id]).length;
  const el=document.getElementById("v-hoje"); const box=el.querySelector(".kpis"); if(!box) return;
  box.insertAdjacentHTML("afterend",`<div class="card" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div style="flex:1"><b>Questões do dia no banco</b><div class="meta">${qs.length} questões ligadas aos tópicos de hoje · ${feitas} resolvidas</div></div><button type="button" class="btn" id="goQHoje">Resolver agora</button></div>`);
  document.getElementById("goQHoje").onclick=()=>{ Object.assign(QF,{fonte:"todas",mat:"todas",tema:"todos",dia:"hoje",dif:"todos",sit:"nao",i:0}); location.hash="#questoes"; };
};
// ---------- revisão programada dos erros ----------
function addDays(d,n){ const x=parse(d); x.setDate(x.getDate()+n); return iso(x); }
function sundayOf(d){ const x=parse(d); x.setDate(x.getDate()+((7-x.getDay())%7)); return iso(x); }
function dueOf(e){ const b=e.base||e.data||TODAY; const d1=sundayOf(b), d2=addDays(d1,7); if(e.r1!=="Sim") return {n:1,d:d1}; if(e.r2!=="Sim") return {n:2,d:d2}; return null; }
function dueErrs(){ return ERR.filter(e=>{ const u=dueOf(e); return u&&u.d<=TODAY; }); }
function revFila(){ return dueErrs().filter(e=>e.qid&&QMAP[e.qid]).sort((a,b)=>dueOf(a).d.localeCompare(dueOf(b).d)); }
let REV=null; // {ids:[errId], i, sel, done:{errId:{x,ok}}}
function startRev(){ REV={ids:revFila().map(e=>e.id),i:0,sel:null,done:{}}; location.hash="#questoes"; renderQ(); }
const _renderQ0 = renderQ;
renderQ = function(){
  if(!REV) return _renderQ0();
  const el=document.getElementById("v-questoes");
  const n=REV.ids.length; if(REV.i>=n) REV.i=Math.max(0,n-1);
  const e=ERR.find(x=>x.id===REV.ids[REV.i]); const q=e&&QMAP[e.qid];
  const feitos=Object.keys(REV.done).length, certos=Object.values(REV.done).filter(x=>x.ok).length;
  if(!n||!q){ el.innerHTML=`<h2>Revisão de erros</h2><div class="empty">Nenhum erro com revisão marcada para hoje.</div><div><button type="button" class="btn ghost" id="revSair">Voltar ao banco</button></div>`; document.getElementById("revSair").onclick=()=>{ REV=null; renderQ(); }; return; }
  const u=dueOf(e)||{n:2}, dn=REV.done[e.id];
  el.innerHTML=`<div class="simtop"><h2 style="margin:0">Revisão de erros</h2><button type="button" class="btn ghost" id="revSair">Sair da revisão</button></div>
  <p class="meta">${REV.i+1} de ${n} · ${feitos} refeitos nesta rodada, ${certos} certos. Se você acertar, a revisão é marcada no caderno; se errar, o erro volta para a fila com novas datas e fica marcado como reincidente.</p>
  <div class="card qcard" data-revq="${e.id}">
    <div class="qhead"><span class="meta">${esc(q.p)}</span><span class="pill p-hoje">${dn?"Refeita":u.n+"ª revisão"}</span></div>
    <div class="qtema"><b>${esc(q.m)}</b> · ${esc(q.t||"")}${e.rein?` · <span class="pill p-atraso">reincidente (${e.rein})</span>`:""}</div>
    ${qBody(q)}
    ${optsHtml(q,{sel:REV.sel,done:!!dn,x:dn&&dn.x})}
    ${dn?`<div class="qfb ${dn.ok?"good":"bad"}"><b>${dn.ok?"Certo.":"Errado de novo."}</b> Gabarito: ${q.a}${dn.ok?` · ${u.n===1&&e.r1==="Sim"&&e.r2!=="Sim"?"1ª revisão registrada":"revisão registrada"}`:" · o erro voltou para a fila"}</div>${q.c?`<details class="qcom" open><summary>Comentário</summary>${para(q.c)}</details>`:""}${e.nota?`<div class="meta">Sua anotação: ${esc(e.nota)}</div>`:""}`
      :`<div class="qact"><span class="chk"></span><button type="button" class="btn" id="revResp" ${REV.sel?"":"disabled"}>Responder</button></div>`}
    <div class="qnav"><button type="button" class="btn ghost" id="revPrev" ${REV.i?"":"disabled"}>‹ Anterior</button><button type="button" class="btn ghost" id="revNext" ${REV.i<n-1?"":"disabled"}>Próxima ›</button></div>
  </div>`;
  document.getElementById("revSair").onclick=()=>{ REV=null; renderQ(); };
};
document.addEventListener("click",ev=>{
  if(!REV) return; const card=ev.target.closest("[data-revq]"); if(!card) return;
  const e=ERR.find(x=>x.id===card.dataset.revq); const q=QMAP[e.qid];
  const o=ev.target.closest("[data-opt]"); if(o&&!REV.done[e.id]){ REV.sel=o.dataset.opt; card.querySelectorAll("[data-opt]").forEach(b=>b.classList.toggle("sel",b===o)); document.getElementById("revResp").disabled=false; return; }
  if(ev.target.id==="revResp"&&REV.sel){ const ok=REV.sel===q.a; REV.done[e.id]={x:REV.sel,ok};
    (e.rev??=[]).push({d:TODAY,x:REV.sel,ok});
    if(ok){ if(e.r1!=="Sim") e.r1="Sim"; else e.r2="Sim"; }
    else { e.rein=(e.rein||0)+1; e.r1=""; e.r2=""; e.base=TODAY; }
    persist(); renderQ(); return; }
  if(ev.target.id==="revNext"||ev.target.id==="revPrev"){ REV.i+=ev.target.id==="revNext"?1:-1; REV.sel=null; renderQ(); window.scrollTo({top:0}); }
});
window.addEventListener("hashchange",()=>{ if(location.hash!=="#questoes") REV=null; });
// caderno: datas de revisão e reincidência
const _renderErr1 = renderErr;
renderErr = function(){
  _renderErr1();
  const el=document.getElementById("v-erros");
  el.querySelectorAll(".err").forEach(c=>{ const e=ERR.find(x=>x.id===c.dataset.id); if(!e) return; const u=dueOf(e);
    const t=u?(u.d<=TODAY?`<span class="pill p-atraso">${u.n}ª revisão: ${u.d<TODAY?"atrasada desde "+br(u.d):"hoje"}</span>`:`<span class="pill p-futuro">${u.n}ª revisão em ${br(u.d)}</span>`):"";
    const r=e.rein?`<span class="pill p-atraso">reincidente (${e.rein})</span>`:"";
    if(t||r) c.querySelector(".mrow").insertAdjacentHTML("afterend",`<div style="display:flex;gap:6px;flex-wrap:wrap">${t}${r}</div>`); });
  const fila=revFila(), sem=dueErrs().length-fila.length;
  const p=el.querySelector("p.meta");
  if(p) p.insertAdjacentHTML("afterend",`<div class="card" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div style="flex:1"><b>Revisão de hoje</b><div class="meta">${dueErrs().length?`${dueErrs().length} erros com revisão vencida${sem?`, dos quais ${sem} registrados à mão (revise pelo material e marque abaixo)`:""}`:"Nenhum erro com revisão vencida."}</div></div>${fila.length?`<button type="button" class="btn" data-startrev>Refazer ${fila.length} no app</button>`:""}</div>`);
};
document.addEventListener("click",ev=>{ if(ev.target.closest("[data-startrev]")) startRev(); });

// ---------- botão de questões por tópico no cronograma ----------
const _itemHtml = itemHtml;
itemHtml = function(r){
  let h=_itemHtml(r);
  if(!(PUB||PACK)||!isStudy(r)) return h;
  const qs=banco().filter(q=>q.d===r.d&&q.m===r.m); if(!qs.length) return h;
  const nr=qs.filter(q=>!QST.r[q.id]).length;
  const btn=`<div><button type="button" class="btn ghost" data-qtop="${r.d}|${esc(r.m)}">Questões deste tópico (${qs.length}${nr<qs.length?`, ${nr} por fazer`:""})</button></div>`;
  return h.replace(/<\/div>\s*$/,btn+"</div>");
};
function qtopBtn(r){ if(!(PUB||PACK)||!isStudy(r)) return ""; const qs=banco().filter(q=>q.d===r.d&&q.m===r.m); if(!qs.length) return ""; const nr=qs.filter(q=>!QST.r[q.id]).length;
  return `<div><button type="button" class="btn ghost" data-qtop="${r.d}|${esc(r.m)}">Questões deste tópico (${qs.length}${nr<qs.length?`, ${nr} por fazer`:""})</button></div>`; }
const _renderCrono = renderCrono;
renderCrono = function(){ _renderCrono(); document.querySelectorAll("#v-cronograma details.row").forEach(dt=>{ const l=dt.querySelector(".log"); if(!l) return; const r=ROWS.find(x=>x.k===l.dataset.k); const h=r&&qtopBtn(r); if(h) dt.querySelector(".body").insertAdjacentHTML("beforeend",h); }); };
document.addEventListener("click",ev=>{ const b=ev.target.closest("[data-qtop]"); if(!b) return; const [d,m]=b.dataset.qtop.split("|");
  const qs=banco().filter(q=>q.d===d&&q.m===m); REV=null;
  Object.assign(QF,{fonte:"todas",mat:m,tema:"todos",dia:d,dif:"todos",sit:qs.some(q=>!QST.r[q.id])?"nao":"todas",ord:"ordem",i:0}); qSel=null;
  if(location.hash==="#questoes") renderQ(); else location.hash="#questoes"; window.scrollTo({top:0}); });

// ---------- Hoje: revisão de erros ----------
const _renderHoje1 = renderHoje;
renderHoje = function(){
  _renderHoje1();
  const due=dueErrs(); if(!due.length) return;
  const fila=revFila(); const el=document.getElementById("v-hoje"); const box=el.querySelector(".kpis"); if(!box) return;
  box.insertAdjacentHTML("afterend",`<div class="card" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;border-color:var(--bad)"><div style="flex:1"><b>Erros para revisar</b><div class="meta">${due.length} com revisão marcada até hoje${due.length>fila.length?` (${due.length-fila.length} registrados à mão: revise pelo caderno)`:""}</div></div>${fila.length?`<button type="button" class="btn" data-startrev>Refazer erros</button>`:`<a class="btn" href="#erros">Abrir caderno</a>`}</div>`);
};

// ---------- projeção de nota ----------
const PESO = {G:{"Língua Portuguesa":7.8,"Raciocínio Lógico e Matemática":6.2,"Informática":3.8,"Legislação e Direitos Humanos":2.2},
              E:{"Direito do Trabalho":9,"Direito Processual do Trabalho":7.2,"Direito Constitucional":6.8,"Direito Civil":6.8,"Direito Administrativo":5.2,"Direito Processual Civil":5}};
function acertoMaterias(){ // app + registros diários
  const o={}; const add=(m,n,a,d)=>{ const v=(o[m]??={n:0,a:0,ult:null}); v.n+=n; v.a+=a; if(n&&(!v.ult||d>v.ult)) v.ult=d; };
  for(const id in QST.r){ const q=QMAP[id]; if(q) add(q.m,1,QST.r[id].ok?1:0,QST.r[id].d); }
  for(const r of ROWS){ const l=LOG[r.k]; if(l&&num(l.questoes)) add(r.m,num(l.questoes),num(l.acertos),r.d); }
  return o;
}
function projecao(){
  const ac=acertoMaterias(); const rows=[]; let G=0,E=0,falta=[];
  for(const b of ["G","E"]) for(const [m,w] of Object.entries(PESO[b])){ const v=ac[m]; const ok=v&&v.n>=10; const p=ok?v.a/v.n:null;
    if(ok){ if(b==="G") G+=p*w; else E+=p*w; } else falta.push(m);
    rows.push({b,m,w,p,n:v?v.n:0,perde:ok?(1-p)*w*(b==="G"?10/20:20/40)/3:null}); }
  const nota=falta.length?null:(G/20*10+2*E/40*10)/3;
  return {rows,nota,G,E,falta};
}
const _renderDes1 = renderDes;
renderDes = function(){
  _renderDes1();
  const el=document.getElementById("v-desempenho"); const pj=projecao();
  const lim=pj.rows.filter(r=>r.perde!=null).sort((a,b)=>b.perde-a.perde);
  const fmt2=x=>x.toFixed(2).replace(".",",");
  const proj=`<h2>Projeção de nota (se a prova fosse hoje)</h2>
  ${pj.nota!=null?`<div class="kpis"><div class="kpi"><div class="v">${fmt2(pj.nota)}</div><div class="l">nota objetiva estimada (mínimo 6,00)</div><div class="bar"><i class="${pj.nota>=7?"good":pj.nota>=6?"mid":"low"}" style="width:${pj.nota*10}%"></i></div></div><div class="kpi"><div class="v">${fmt1(pj.G)}/20</div><div class="l">acertos estimados em gerais</div></div><div class="kpi"><div class="v">${fmt1(pj.E)}/40</div><div class="l">acertos estimados em específicas</div></div></div>`
    :`<div class="banner">A nota estimada aparece quando todas as matérias tiverem pelo menos 10 questões resolvidas. Faltam: ${pj.falta.map(esc).join("; ")}.</div>`}
  <div class="tablewrap"><table><thead><tr><th>Matéria</th><th class="n">Questões na prova (média)</th><th>Seu acerto</th><th class="n">Pontos que deixa na nota</th></tr></thead><tbody>
  ${pj.rows.slice().sort((a,b)=>(b.perde??-1)-(a.perde??-1)).map(r=>`<tr><td>${esc(r.m)} <span class="meta">${r.b==="G"?"gerais":"específicas"}</span></td><td class="n">${fmt1(r.w)}</td><td>${r.p==null?`<span class="meta">${r.n} de 10 questões</span>`:accCell(Math.round(r.p*1000),1000)}</td><td class="n">${r.perde==null?"–":fmt2(r.perde)}</td></tr>`).join("")}
  </tbody></table></div>
  <p class="note">A estimativa aplica o seu percentual de acerto em cada matéria (questões do app e do registro diário) à quantidade média de questões de cada matéria nos cinco simulados modelo TRT8, e calcula a nota pela fórmula do edital: (gerais + 2 × específicas) ÷ 3. A coluna da direita mostra quanto cada matéria tira da nota hoje; as primeiras linhas são onde a hora de reserva rende mais. É uma referência de tendência, não uma previsão: o edital não fixa o número de questões por matéria.</p>`;
  // evolução semanal
  const ac=acertoMaterias();
  const wk={}; const addw=(m,d,n,a)=>{ const w=weekKey(d); const o=((wk[m]??={})[w]??={n:0,a:0}); o.n+=n; o.a+=a; };
  for(const id in QST.r){ const q=QMAP[id]; if(q) addw(q.m,QST.r[id].d,1,QST.r[id].ok?1:0); }
  for(const r of ROWS){ const l=LOG[r.k]; if(l&&num(l.questoes)) addw(r.m,r.d,num(l.questoes),num(l.acertos)); }
  const weeks=[...new Set(Object.values(wk).flatMap(o=>Object.keys(o)))].sort();
  const sel=window.__evoMat||"todas";
  const series=(sel==="todas"?MATERIAS:[sel]).filter(m=>wk[m]);
  const W=Math.max(320,60+weeks.length*70), H=200, x=i=>40+i*((W-60)/Math.max(1,weeks.length-1)), y=p=>H-30-p*(H-50);
  const pal=["#B9536A","#3F7D57","#A8690A","#4C6FA8","#7A4FA0","#2E8A8A","#9A5B3B","#5C6B2E","#B03A7A","#4A4A4A"];
  const lines=series.map((m,si)=>{ const pts=weeks.map((w,i)=>{ const o=wk[m][w]; return o&&o.n?[x(i),y(o.a/o.n),o]:null; }).filter(Boolean);
    const c=pal[MATERIAS.indexOf(m)%pal.length];
    return `<polyline fill="none" stroke="${c}" stroke-width="2" points="${pts.map(p=>p[0]+","+p[1]).join(" ")}"></polyline>${pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${c}"><title>${esc(m)}: ${Math.round(100*p[2].a/p[2].n)}% (${p[2].n} questões)</title></circle>`).join("")}`; }).join("");
  const chart=weeks.length?`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Acerto semanal por matéria">
    <rect x="34" y="${y(1)}" width="${W-40}" height="${y(.75)-y(1)}" fill="var(--ok-soft)"></rect>
    ${[0,.25,.5,.75,1].map(p=>`<line x1="34" x2="${W-6}" y1="${y(p)}" y2="${y(p)}" stroke="var(--line)"></line><text x="4" y="${y(p)+4}" font-size="10" fill="var(--muted)">${p*100}%</text>`).join("")}
    ${weeks.map((w,i)=>`<text x="${x(i)}" y="${H-10}" text-anchor="middle" font-size="10" fill="var(--muted)">${br(w)}</text>`).join("")}${lines}</svg>`:`<div class="empty">O gráfico aparece quando houver questões resolvidas.</div>`;
  const legend=series.map(m=>`<span class="leg"><i style="background:${pal[MATERIAS.indexOf(m)%pal.length]}"></i>${esc(m)}</span>`).join("");
  const parado=MATERIAS.filter(m=>ROWS.some(r=>r.m===m&&r.d<=TODAY&&isStudy(r))).map(m=>({m,ult:ac[m]&&ac[m].ult})).filter(o=>!o.ult||Math.round((parse(TODAY)-parse(o.ult))/864e5)>10);
  const evo=`<h2>Evolução semanal do acerto</h2>
  <div class="filters"><label class="f">Matéria<select id="evoSel"><option value="todas">Todas</option>${MATERIAS.map(m=>`<option ${m===sel?"selected":""}>${esc(m)}</option>`).join("")}</select></label></div>
  <div class="tablewrap" style="padding:8px">${chart}<div class="legs">${legend}</div></div>
  <p class="note">A faixa verde marca 75% de acerto ou mais. Cada ponto é uma semana (segunda a domingo); toque no ponto para ver o número de questões.</p>
  ${parado.length?`<div class="banner warn"><b>Sem questões há mais de 10 dias:</b> ${parado.map(o=>`${esc(o.m)}${o.ult?` (última em ${br(o.ult)})`:" (nenhuma ainda)"}`).join("; ")}.</div>`:""}`;
  const anchor=el.querySelector("h2:nth-of-type(2)");
  const wrap=document.createElement("div"); wrap.style.cssText="display:grid;gap:12px"; wrap.innerHTML=proj+evo;
  if(anchor) anchor.before(wrap); else el.appendChild(wrap);
  document.getElementById("evoSel").onchange=e=>{ window.__evoMat=e.target.value; renderDes(); };
};

// ---------- Backup: situação do pacote ----------
if(typeof renderBackup==="function"){ const _rb=renderBackup; renderBackup=function(){ _rb(); const el=document.getElementById("v-backup"); const c=el.querySelector(".card");
  c.insertAdjacentHTML("beforebegin",`<div class="banner ${PACK?"":"warn"}">${PACK?`<b>Pacote de estudos importado neste aparelho:</b> ${PACK.banco.length.toLocaleString("pt-BR")} questões comentadas e ${Object.keys(PACK.simulados||{}).length} simulados.`:`<b>Pacote de estudos não importado neste aparelho.</b> Importe o arquivo pacote_estudos_TRT8.json na aba Questões.`}</div>`); }; }

renderAll(false);
