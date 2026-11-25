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
    msgEl.textContent=`Pacote importado: ${d.banco.length.toLocaleString("pt-BR")} questões e ${Object.keys(d.simulados||{}).length} simulados.`;
    renderAll(false);
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
function para(t){ return esc(t).split("\n").map(l=>l.startsWith("## ")?`<h4>${l.slice(3)}</h4>`:`<p>${l}</p>`).join(""); }
function qBody(q){
  let h="";
  if(q.pas&&q.pas.length) h+=`<details class="qpas"><summary>Texto de apoio</summary>${q.pas.map(p=>`<img src="q/${p}" alt="Texto de apoio da questão" loading="lazy">`).join("")}</details>`;
  if(q.tx) h+=`<details class="qpas"><summary>Texto de apoio</summary><div class="qtx">${para(q.tx)}</div></details>`;
  if(q.img) h+=`<img class="qimg" src="q/${q.img}" alt="Enunciado e alternativas da questão" loading="lazy">`;
  else h+=`<div class="qstem">${para(q.s)}</div>`;
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
  const card=e.target.closest("#v-questoes .qcard"); if(!card) return;
  const q=QMAP[card.dataset.qid];
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
renderAll(false);
