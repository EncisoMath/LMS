/* EducaCity: sincronización real desde PLANILLA. Requiere conector local v20. */
(() => {
'use strict';
const names={academic:'Académico',attendance:'Actitudinal',rockstars:'Aptitudinal'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let modal=null,conn=null,plan=null,snapshot=null,busy=false;
const node=id=>modal?.querySelector('#'+id);
function status(t){if(node('ecMessage'))node('ecMessage').textContent=t}
async function probe(port){
const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),1300);
try{const r=await fetch('http://127.0.0.1:'+port+'/api/lms/estado',{signal:ctrl.signal,cache:'no-store'});
if(!r.ok)return null;const j=await r.json();return j.ok&&j.token&&j.dominio==='insroque.educa.city'?{...j,port}:null}
catch(_){return null}finally{clearTimeout(timeout)}
}
async function connect(){
for(let port=8765;port<=8805;port+=8){
const values=await Promise.all(Array.from({length:Math.min(8,8806-port)},(_,i)=>probe(port+i)));
if(values.some(Boolean))return values.find(Boolean);
}
throw Error('No se detectó el conector. Ejecuta INICIAR_PANEL.bat del paquete EducaCity v20 y vuelve a pulsar Sincronizar.');
}
async function api(route,payload){
const r=await fetch('http://127.0.0.1:'+conn.port+'/api/lms/'+route,{
method:'POST',headers:{'Content-Type':'application/json','X-Panel-Token':conn.token},
body:JSON.stringify(payload),cache:'no-store'});
const j=await r.json();if(!r.ok||!j.ok)throw Error(j.error||'No se pudo verificar la operación');return j;
}
function close(){if(busy)return;modal?.remove();modal=null;plan=null;snapshot=null}
async function open(){
if(modal)return;
modal=document.createElement('div');modal.className='ec1-overlay';
modal.innerHTML='<div class="ec1-dialog" role="dialog" aria-modal="true">'+
'<header class="ec1-head"><div><h2>Sincronizar con educa.city</h2><p>Lectura real · alumnos por nombre · actividades y notas</p></div>'+
'<button class="ec1-close" id="ecClose">×</button></header><div class="ec1-body">'+
'<p id="ecMessage" role="status">Conectando con educa.city…</p><div id="ecContent"></div></div></div>';
document.body.appendChild(modal);node('ecClose').onclick=close;
try{
busy=true;
if(typeof window.EncisoEducaCitySnapshot!=='function')throw Error('Recarga EncisoLMS para cargar la versión actualizada de PLANILLA.');
snapshot=window.EncisoEducaCitySnapshot();
conn=await connect();if(!conn.ready)throw Error('Chrome todavía está iniciando sesión en educa.city.');
if(conn.frozen)throw Error('El conector tiene un bloqueo pendiente: '+conn.motivo);
status('Leyendo actividades, alumnos y notas en vivo…');
plan=await api('previsualizar',snapshot);render(plan.data);
}catch(e){status('No se pudo leer educa.city: '+e.message);
node('ecContent').innerHTML='<p class="ec1-muted">Sin un conector institucional activo no se mostrarán IDs ni notas antiguas.</p><button class="ec1-btn" id="ecRetry">Reintentar</button>';
node('ecRetry').onclick=()=>{busy=false;close();open()}}
finally{busy=false}
}
function render(d){
status('Comparación realizada directamente contra educa.city. Nada se ha escrito todavía.');
const parts=d.components||[],missing=d.unmatched||[],diff=d.changes||[];
node('ecContent').innerHTML=
'<section class="ec1-panel"><h3>'+esc(snapshot.assignment_id)+' · P'+snapshot.period+'</h3>'+
'<p>'+d.matched+' estudiantes identificados por código Y nombre · '+missing.length+' pendientes · '+diff.length+' notas distintas</p>'+
'<table class="ec1-table"><thead><tr><th>Componente</th><th>Actividad real</th><th>Peso</th><th>Acción</th></tr></thead><tbody>'+
parts.map(p=>'<tr><td>'+esc(names[p.key])+'</td><td>'+esc(p.title)+(p.remote_id?' (#'+esc(p.remote_id)+')':'')+'</td>'+
'<td>'+esc(p.weight_new)+' %</td><td>'+esc(p.action==='create'?'Crear':p.action==='update_weight'?'Ajustar peso':'Reutilizar')+'</td></tr>').join('')+
'</tbody></table></section>'+
(missing.length?'<section class="ec1-panel"><h3>Alumnos sin coincidencia (no se envían)</h3><div class="ec1-students">'+
missing.map(s=>'<p>'+esc(s.code)+' · '+esc(s.name)+' · '+esc(s.cause)+(s.remote_name?' · En EducaCity: '+esc(s.remote_name):'')+'</p>').join('')+
'</div></section>':'')+
'<section class="ec1-panel"><h3>Vista previa de las notas ('+diff.length+')</h3>'+
'<div class="ec1-students"><table class="ec1-table"><thead><tr><th>Alumno</th><th>Componente</th><th>Anterior</th><th>Nueva</th></tr></thead><tbody>'+
diff.slice(0,45).map(s=>'<tr><td>'+esc(s.student_name)+'</td><td>'+esc(names[s.component])+'</td><td>'+esc(s.before??'—')+'</td><td>'+esc(s.after)+'</td></tr>').join('')+
'</tbody></table></div>'+(diff.length>45?'<p class="ec1-muted">Y '+(diff.length-45)+' diferencias más.</p>':'')+
'<div class="ec1-controls"><button class="ec1-btn" id="ecApply">Crear/reutilizar y sincronizar</button>'+
'<button class="ec1-btn ec1-secondary" id="ecCancel">Cancelar</button></div></section>'+
'<p class="ec1-muted">Solo la confirmación anterior permite modificar educa.city. El conector relee y verifica cada envío.</p>';
node('ecApply').onclick=apply;node('ecCancel').onclick=close;
}
async function saveLinks(out){
const client=window.EncisoSupabase?.getClient?.();if(!client)throw Error('Falta sesión Supabase');
const year=2026,assignment=snapshot.assignment_id,period=snapshot.period;
const config=Object.keys(names).map(key=>({
assignment_id:assignment,academic_year:year,period,component:key,
educacity_activity_id:Number(out.remote_ids[key]),educacity_title:names[key],
weight:snapshot.weights[key],rockstar_target:key==='rockstars'?Number(snapshot.rockstar_target||15):null,
status:'verified',source:'lectura_real_confirmada',updated_at:new Date().toISOString()
}));
const a=await client.from('educacity_component_links').upsert(config,{onConflict:'assignment_id,academic_year,period,component'});
if(a.error)throw Error(a.error.message);
const confirmed=out.confirmed_students||[];if(!confirmed.length)return;
const s=await client.from('students').select('id,student_code').in('student_code',confirmed.map(x=>x.code));
if(s.error)throw Error(s.error.message);
const studentMap=new Map((s.data||[]).map(x=>[String(x.student_code),x.id]));
const links=confirmed.filter(x=>studentMap.has(String(x.code))).map(x=>({
assignment_id:assignment,academic_year:year,student_id:studentMap.get(String(x.code)),
educacity_student_id:Number(x.remote_id),educacity_name:x.name,match_method:'verified_code',
status:'confirmed',updated_at:new Date().toISOString()
}));
if(links.length){const r=await client.from('educacity_student_links').upsert(links,{onConflict:'assignment_id,academic_year,student_id'});if(r.error)throw Error(r.error.message)}
}
async function apply(){
if(busy)return;busy=true;node('ecApply').disabled=true;node('ecCancel').disabled=true;
status('Enviando actividades y notas, con verificación en cada paso…');
try{
const response=await api('sincronizar',{preview_id:plan.preview_id,confirmation:'SINCRONIZAR'});
const out=response.result;let issue='';
try{await saveLinks(out)}catch(e){issue=' El guardado en educa.city terminó, pero faltó guardar su vínculo en Supabase: '+e.message}
node('ecContent').innerHTML='<section class="ec1-panel"><h3>Sincronización completada</h3><p>'+
out.alumnos_verificados+' estudiantes comprobados · '+out.actividades.length+' actividades verificadas · '+
out.notas.reduce((n,x)=>n+x.total,0)+' notas enviadas.</p><p>'+esc(issue)+'</p>'+
'<button class="ec1-btn" id="ecFinish">Cerrar</button></section>';
status('educa.city confirmó los cambios.');
}catch(e){status('Operación detenida: '+e.message);
node('ecContent').innerHTML='<section class="ec1-panel"><p>Consulta el panel local y sus respaldos antes de reintentar. Una operación parcial puede haberse guardado.</p><button class="ec1-btn" id="ecFinish">Cerrar</button></section>'}
finally{busy=false;node('ecFinish').onclick=close}
}
function mount(){
const hero=document.querySelector('.em-notes-hero-host');if(!hero||hero.querySelector('.ec1-open'))return;
const btn=document.createElement('button');btn.type='button';btn.className='ec1-open';
btn.textContent='Sincronizar con educa.city';btn.onclick=open;
(hero.querySelector('.em-notes-hero-content')||hero).appendChild(btn);
}
const root=document.querySelector('#app')||document.body;let frame=false;
new MutationObserver(()=>{if(frame)return;frame=true;requestAnimationFrame(()=>{frame=false;mount()})})
.observe(root,{childList:true,subtree:true});
mount();
})();
