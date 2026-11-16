/* Sincronización directa EncisoLMS -> EducaCity con Supabase Edge. Sin CMD ni Python.
   Las credenciales institucionales solo viajan al servidor HTTPS durante cada solicitud.
   La contraseña nunca se guarda en localStorage ni se sube a GitHub o a Supabase DB.
*/
(() => {
 'use strict';
 const ENDPOINT='https://jjllrciujqauqpjffsud.supabase.co/functions/v1/educacity-bridge';
 const TYPES={academic:'Académico',attendance:'Actitudinal (Asistencia)',rockstars:'Aptitudinal (Rockstars)'};
 let modal=null,snapshot=null,preview=null,busy=false,connections=[],linked=[];
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const byId=id=>modal?.querySelector('#'+id);
 const announce=(msg,isError=false)=>{const x=byId('ec1Status');if(x){x.textContent=msg;x.style.color=isError?'#b42318':'#155b84'}};
 const client=()=>window.EncisoSupabase?.getClient?.();
 async function send(op,cred,component='',baseline_hash=''){
  const c=client();if(!c)throw Error('Inicia sesión de docente en EncisoLMS.');
  const auth=await c.auth.getSession();
  const jwt=auth?.data?.session?.access_token;
  if(auth.error||!jwt)throw Error('Tu sesión de EncisoLMS ha caducado. Vuelve a iniciar sesión.');
  let response;
  try{
   response=await fetch(ENDPOINT,{method:'POST',cache:'no-store',mode:'cors',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+jwt,
      'apikey':window.ENCISOMATH_SUPABASE?.publishableKey||''},
    body:JSON.stringify({op,credentials:cred,snapshot,component,baseline_hash})});
  }catch(_){throw Error('No se pudo contactar el servidor de Supabase. Verifica tu conexión a Internet.')}
  let data;try{data=await response.json()}catch{throw Error('El servidor devolvió una respuesta no válida (HTTP '+response.status+').')}
  if(!response.ok||!data.ok)throw Error(data.error||'La operación no pudo comprobarse en educa.city.');
  return data;
 }
 function close(){if(busy)return;modal?.remove();modal=null;snapshot=null;preview=null;connections=[]}
 function credentials(){
  const user=byId('ec1Login')?.value.trim()||'';
  const pass=byId('ec1Password')?.value||'';
  const school=byId('ec1School')?.value.trim()||'';
  if(!/^[1-9][0-9]{0,14}$/.test(user)||!pass)throw Error('Introduce tu usuario y contraseña reales de educa.city.');
  return {login:user,password:pass,...(school?{school_id:school}:{})};
 }
 async function loadSnapshot(){
  if(typeof window.EncisoEducaCitySnapshot!=='function')throw Error('Recarga EncisoLMS para obtener la versión actualizada de PLANILLA.');
  const value=window.EncisoEducaCitySnapshot();
  if(!value?.students?.length)throw Error('No hay estudiantes en la PLANILLA elegida.');
  return value;
 }
 function busyControl(value){busy=value;
  modal?.querySelectorAll('.ec1-btn,.ec1-close').forEach(b=>b.disabled=value);
  if(value&&byId('ec1Read'))byId('ec1Read').textContent='Leyendo educa.city…';
  else if(byId('ec1Read'))byId('ec1Read').textContent='Leer y comparar';
 }
 async function previewLive(){
  if(busy)return;
  try{
   busyControl(true);announce('Leyendo la PLANILLA de EncisoLMS…');
   const cred=credentials();snapshot=await loadSnapshot();
   announce('Iniciando sesión y leyendo actividades, matrícula y notas REALES de educa.city…');
   const outcome=await send('preview',cred);
   preview=outcome.data;
   displayPreview(preview);
   announce('Lectura completada. Revisa las diferencias antes de guardar.');
  }catch(ex){announce('Lectura detenida: '+ex.message,true);preview=null}
  finally{busyControl(false)}
 }
 function displayPreview(data){
  const container=byId('ec1Preview');if(!container)return;
  const components=data.components||[],changes=data.changes||[],missing=data.unmatched||[];
  container.innerHTML=
   '<section class="ec1-panel"><h3>'+esc(snapshot.assignment_id.replace('mat-est-',''))+' · Período '+esc(snapshot.period)+'</h3>'+
   '<div class="ec1-grid">'+
    '<div><strong>'+Number(data.matched||0)+'</strong><p class="ec1-muted">Estudiantes verificados</p></div>'+
    '<div><strong>'+missing.length+'</strong><p class="ec1-muted">Estudiantes omitidos</p></div>'+
    '<div><strong>'+Number(data.needs_creation||0)+'</strong><p class="ec1-muted">Actividades que faltan</p></div>'+
    '<div><strong>'+changes.length+'</strong><p class="ec1-muted">Notas que cambiarán</p></div>'+
   '</div></section>'+
   '<section class="ec1-panel"><h3>Actividades obtenidas en vivo de educa.city</h3>'+
   '<table class="ec1-table"><thead><tr><th>Componente</th><th>ID real</th><th>Peso EncisoLMS</th><th>Acción</th></tr></thead><tbody>'+
   components.map(p=>'<tr><td>'+esc(TYPES[p.key])+'</td><td>'+esc(p.remote_id??'Se creará')+'</td>'+
    '<td>'+esc(p.weight_new)+' %</td><td>'+esc(p.action==='create'?'Crear':p.action==='update_weight'?'Actualizar peso':'Reutilizar')+'</td></tr>').join('')+
   '</tbody></table></section>'+
   (missing.length?'<section class="ec1-panel"><h3>Estudiantes que NO se enviarán</h3><div class="ec1-students">'+
    missing.map(p=>'<p>'+esc(p.code)+' · '+esc(p.name)+' — '+esc(p.cause)+'</p>').join('')+'</div></section>':'')+
   '<section class="ec1-panel"><h3>Notas diferentes en educa.city ('+changes.length+')</h3><div class="ec1-students">'+
   '<table class="ec1-table"><thead><tr><th>Alumno</th><th>Componente</th><th>Anterior</th><th>Nueva</th></tr></thead><tbody>'+
   changes.slice(0,45).map(p=>'<tr><td>'+esc(p.student_name)+'</td><td>'+esc(TYPES[p.component])+'</td>'+
    '<td>'+esc(p.before??'—')+'</td><td>'+esc(p.after)+'</td></tr>').join('')+
   '</tbody></table></div>'+(changes.length>45?'<p class="ec1-muted">Y '+(changes.length-45)+' registros adicionales.</p>':'')+
   '<div class="ec1-controls"><button type="button" class="ec1-btn" id="ec1Apply">Crear/reutilizar y enviar notas</button>'+
   '<button type="button" class="ec1-btn ec1-secondary" id="ec1Back">Volver</button></div></section>';
  byId('ec1Apply').onclick=apply;
  byId('ec1Back').onclick=()=>{preview=null;byId('ec1Preview').innerHTML='';announce('Puedes volver a leer sin enviar notas.')};
 }
 async function persistVerified(result){
  const c=client(),component=result.component;
  const row={assignment_id:snapshot.assignment_id,academic_year:2026,period:snapshot.period,component,
   educacity_activity_id:Number(result.remote_id),educacity_title:TYPES[component],
   weight:Number(snapshot.weights[component]),rockstar_target:component==='rockstars'?Number(snapshot.rockstar_target||15):null,
   status:'verified',source:'supabase_edge_live_read',updated_at:new Date().toISOString()};
  const saved=await c.from('educacity_component_links').upsert(row,{onConflict:'assignment_id,academic_year,period,component'});
  if(saved.error)throw Error('No se pudo guardar el vínculo de actividad en Supabase: '+saved.error.message);
  const matched=result.confirmed_students||[];
  if(!matched.length)return;
  const ids=matched.map(x=>String(x.code));
  const q=await c.from('students').select('id,student_code').in('student_code',ids);
  if(q.error)throw Error('No se pudo verificar el estudiante de EncisoLMS: '+q.error.message);
  const map=new Map((q.data||[]).map(x=>[String(x.student_code),String(x.id)]));
  const rows=matched.filter(x=>map.has(String(x.code))).map(x=>({
   assignment_id:snapshot.assignment_id,academic_year:2026,
   student_id:map.get(String(x.code)),educacity_student_id:Number(x.remote_id),
   educacity_name:String(x.name),match_method:'verified_code',status:'confirmed',updated_at:new Date().toISOString()
  }));
  if(rows.length){const save=await c.from('educacity_student_links').upsert(rows,{onConflict:'assignment_id,academic_year,student_id'});
   if(save.error)throw Error('No se pudieron guardar los vínculos de alumnos: '+save.error.message)}
 }
 async function apply(){
  if(busy||!preview)return;
  try{
   const c=credentials();busyControl(true);let done=0;
   for(const p of preview.components){
    announce('Verificando y sincronizando '+TYPES[p.key]+' ('+(done+1)+'/3)…');
    const out=await send('sync',c,p.key,p.baseline_hash);
    connections.push(out);done++;
    try{await persistVerified(out)}catch(e){console.warn('Vínculo EducaCity pendiente:',e.message);linked.push(e.message)}
   }
   byId('ec1Preview').innerHTML='<section class="ec1-panel"><h3>Sincronización terminada</h3>'+
    '<p>Actividades comprobadas: '+connections.length+'</p>'+
    '<p>Notas enviadas y verificadas: '+connections.reduce((s,x)=>s+Number(x.notes_verified||0),0)+'</p>'+
    '<p>Alumnos sin coincidencia: '+Number(preview.unmatched?.length||0)+'</p>'+
    (linked.length?'<p>Advertencia al registrar vínculos en Supabase: '+esc(linked.join('; '))+'</p>':'')+
    '<button class="ec1-btn" id="ec1Done">Cerrar</button></section>';
   byId('ec1Done').onclick=close;
   announce('educa.city verificó los envíos completados.');
  }catch(ex){
   announce('SINCRONIZACIÓN DETENIDA: '+ex.message,true);
   byId('ec1Preview').innerHTML='<section class="ec1-panel"><h3>Operación incompleta</h3>'+
    '<p>Componentes completados: '+connections.length+' de 3. No repitas a ciegas: vuelve a leer educa.city para comprobar qué se guardó.</p>'+
    '<button type="button" class="ec1-btn" id="ec1Retry">Volver a leer</button></section>';
   byId('ec1Retry').onclick=()=>{connections=[];previewLive()};
  }finally{busyControl(false)}
 }
 function open(){
  if(modal)return;
  modal=document.createElement('div');modal.className='ec1-overlay';
  modal.innerHTML='<div class="ec1-dialog" role="dialog" aria-modal="true">'+
   '<header class="ec1-head"><div><h2>Sincronizar con educa.city</h2>'+
   '<p>Conexión directa desde EncisoLMS · sin programas adicionales</p></div>'+
   '<button class="ec1-close" type="button" id="ec1Close" title="Cerrar">×</button></header>'+
   '<div class="ec1-body"><section class="ec1-panel"><h3>Acceso institucional</h3>'+
   '<p class="ec1-muted">El acceso se utiliza solo para esta conexión HTTPS. No se almacena tu contraseña.</p>'+
   '<div class="ec1-controls">'+
   '<label>Usuario educa.city<input id="ec1Login" inputmode="numeric" autocomplete="off" placeholder="Número de usuario"></label>'+
   '<label>Contraseña educa.city<input type="password" id="ec1Password" autocomplete="off" placeholder="Tu contraseña"></label>'+
   '<label>Institución (opcional)<input id="ec1School" inputmode="numeric" autocomplete="off" placeholder="Identificación automática"></label>'+
   '<button class="ec1-btn" type="button" id="ec1Read">Leer y comparar</button></div></section>'+
   '<p id="ec1Status" class="ec1-message" role="status">Primero leeremos educa.city. Ninguna nota se enviará sin tu confirmación.</p>'+
   '<div id="ec1Preview"></div></div></div>';
  document.body.appendChild(modal);
  byId('ec1Close').onclick=close;byId('ec1Read').onclick=previewLive;
  modal.addEventListener('click',e=>{if(e.target===modal)close()});
 }
 function mount(){
  const hero=document.querySelector('.em-notes-hero-host');
  if(!hero||hero.querySelector('.ec1-open'))return;
  const b=document.createElement('button');b.type='button';b.className='ec1-open';
  b.textContent='Sincronizar con educa.city';b.onclick=open;
  (hero.querySelector('.em-notes-hero-content')||hero).appendChild(b);
 }
 const root=document.querySelector('#app')||document.body;let scheduled=false;
 new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;mount()})})
 .observe(root,{childList:true,subtree:true});mount();
})();
