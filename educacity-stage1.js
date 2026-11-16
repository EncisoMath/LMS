/* EducaCity · integrada en EncisoLMS. Presentación separada del motor de notas.
 * Los datos de acceso se cifran con WebCrypto en IndexedDB por usuario de EncisoLMS.
 * La Edge Function autentica, lee y escribe. Este archivo no envía notas directamente.
 */
(() => {
 'use strict';
 const API='https://jjllrciujqauqpjffsud.supabase.co/functions/v1/educacity-bridge';
 const SCHOOL='https://insroque.educa.city/';
 const COMPONENTS={academic:'Académico',attendance:'Actitudinal',rockstars:'Aptitudinal'};
 const ORDER=['academic','attendance','rockstars'];
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
 const by=id=>document.getElementById(id);
 const client=()=>window.EncisoSupabase?.getClient?.();
 let layer=null,busy=false,credential=null,preview=null,snapshot=null,replies=[],tab='summary';
 let ephemeral=null;
 function vault(){
  let pending;
  const open=()=>{
   if(!window.indexedDB||!window.crypto?.subtle)throw Error('Este navegador no admite almacenamiento cifrado. Utiliza Chrome actualizado.');
   if(!pending)pending=new Promise((resolve,reject)=>{
    const req=indexedDB.open('encisomath-educacity-vault',1);
    req.onupgradeneeded=()=>{
     if(!req.result.objectStoreNames.contains('keys'))req.result.createObjectStore('keys');
     if(!req.result.objectStoreNames.contains('profiles'))req.result.createObjectStore('profiles');
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||Error('No se pudo abrir el almacenamiento.'));
   }).catch(err=>{pending=null;throw err});
   return pending;
  };
  async function get(store,key){const db=await open();return new Promise((resolve,reject)=>{
   const q=db.transaction(store,'readonly').objectStore(store).get(key);
   q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);
  })}
  async function put(store,key,value){const db=await open();return new Promise((resolve,reject)=>{
   const t=db.transaction(store,'readwrite');t.objectStore(store).put(value,key);
   t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);
  })}
  async function drop(store,key){const db=await open();return new Promise((resolve,reject)=>{
   const t=db.transaction(store,'readwrite');t.objectStore(store).delete(key);
   t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);
  })}
  return {
   async save(uid,entry){
    let key=await get('keys',uid);
    if(!key){key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);await put('keys',uid,key)}
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const plain=new TextEncoder().encode(JSON.stringify(entry));
    const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(uid)},key,plain);
    await put('profiles',uid,{iv:Array.from(iv),cipher:Array.from(new Uint8Array(cipher))});
   },
   async load(uid){
    const [key,row]=await Promise.all([get('keys',uid),get('profiles',uid)]);
    if(!key||!row)return null;
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(row.iv),additionalData:new TextEncoder().encode(uid)},key,new Uint8Array(row.cipher));
    return JSON.parse(new TextDecoder().decode(plain));
   },
   async clear(uid){await drop('profiles',uid);await drop('keys',uid)}
  };
 }
 const storage=vault();
 async function currentIdentity(){
  const c=client();if(!c)throw Error('Inicia sesión como docente en EncisoLMS.');
  const res=await c.auth.getSession();
  const session=res?.data?.session;
  if(res.error||!session?.access_token||!session.user?.id)throw Error('Inicia sesión nuevamente en EncisoLMS.');
  return {jwt:session.access_token,uid:String(session.user.id)};
 }
 async function send(op,creds,part='',hash=''){
  const auth=await currentIdentity();
  let reply;
  try{reply=await fetch(API,{method:'POST',cache:'no-store',mode:'cors',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.jwt,
    apikey:window.ENCISOMATH_SUPABASE?.publishableKey||''},
   body:JSON.stringify({op,credentials:creds,snapshot:op==='connection_check'?undefined:snapshot,component:part,baseline_hash:hash})});
  }catch(_){throw Error('No fue posible comunicarse con Supabase. Revisa tu conexión a Internet.')}
  let data;try{data=await reply.json()}catch(_){throw Error('Supabase devolvió una respuesta no válida (HTTP '+reply.status+').')}
  if(!reply.ok||!data?.ok)throw Error(data?.error||'La operación no pudo comprobarse en educa.city.');
  return data;
 }
 function validate(entry){
  const login=String(entry.login||'').trim(),password=String(entry.password||'');
  let school;
  try{school=new URL(String(entry.school_url||SCHOOL).trim())}catch(_){throw Error('Escribe una URL institucional válida.')}
  if(school.protocol!=='https:'||school.hostname!=='insroque.educa.city'||school.port||school.username||school.password||!['','/'].includes(school.pathname)||school.search||school.hash)
   throw Error('La dirección institucional autorizada es https://insroque.educa.city/');
  if(!/^[1-9]\d{0,14}$/.test(login)||!password||password.length>240)throw Error('Revisa el usuario y la contraseña institucional.');
  return {login,password,school_url:SCHOOL};
 }
 function modal(mode){
  close(true);busy=false;preview=null;snapshot=null;replies=[];tab='summary';
  const isSettings=mode==='settings';
  layer=document.createElement('div');layer.id='ec1-layer';layer.className='ec1-overlay';
  layer.innerHTML='<section class="ec1-dialog modal-card '+(isSettings?'ec1-dialog-settings':'ec1-dialog-sync')+'" role="dialog" aria-modal="true" aria-labelledby="ec1Title" tabindex="-1">'+
   '<header class="ec1-head"><div><p class="section-kicker">'+(isSettings?'PERFIL DOCENTE · HERRAMIENTAS':'PLANILLA · EDUCA.CITY')+'</p>'+
   '<h2 id="ec1Title">'+(isSettings?'EducaCity':'Cargar a EducaCity')+'</h2>'+
   '<p class="ec1-subtitle">'+(isSettings?'Conexión institucional de tu cuenta docente.':'Sincronización de las calificaciones del periodo.')+'</p></div>'+
   '<button type="button" class="ec1-close" id="ec1Close" aria-label="Cerrar">×</button></header>'+
   '<div class="ec1-body" id="ec1Body"></div>'+
   '<footer class="ec1-footer" id="ec1Footer"></footer></section>';
  document.body.appendChild(layer);document.body.classList.add('ec1-is-open');
  by('ec1Close').addEventListener('click',()=>close());
  layer.addEventListener('click',e=>{if(e.target===layer)close()});
  document.addEventListener('keydown',escKey);
  requestAnimationFrame(()=>layer?.classList.add('is-visible'));
  return layer;
 }
 function escKey(e){if(e.key==='Escape'&&!busy)close()}
 function close(force=false){
  if(busy&&!force)return;
  document.removeEventListener('keydown',escKey);
  if(layer){layer.remove();layer=null}
  document.body.classList.remove('ec1-is-open');
  credential=null;preview=null;snapshot=null;replies=[];busy=false;
 }
 function setBusy(value){
  busy=value;
  if(layer)layer.querySelectorAll('button').forEach(b=>{
   if(b.id==='ec1Close'||b.id==='ec1Cancel')b.disabled=value;
  });
 }
 function status(message,bad=false){
  const node=by('ec1Message');
  if(node){node.textContent=message;node.classList.toggle('is-error',bad)}
 }
 function settingsMarkup(){
  by('ec1Body').innerHTML='<form class="ec1-settings-form" id="ec1SettingsForm" autocomplete="off">'+
   '<label for="ec1Login">Usuario de educa.city<input id="ec1Login" type="text" inputmode="numeric" autocomplete="off" required placeholder="Número de usuario"></label>'+
   '<label for="ec1Password">Contraseña<input id="ec1Password" type="password" autocomplete="new-password" required placeholder="Contraseña institucional"></label>'+
   '<label for="ec1School">URL del colegio<input id="ec1School" type="url" inputmode="url" spellcheck="false" value="'+SCHOOL+'" required></label>'+
   '<label class="ec1-remember"><input id="ec1Remember" type="checkbox" checked><span>Recordar acceso cifrado en este dispositivo</span></label>'+
   '<p class="ec1-help">La contraseña se guarda cifrada en este navegador, asociada a tu sesión de EncisoLMS. No se almacena en la base de datos. En dispositivos compartidos, desmarca esta opción.</p>'+
   '</form>'+
   '<div class="ec1-connection-line" id="ec1Message" role="status">Configura el acceso o comprueba la conexión.</div>';
  by('ec1Footer').innerHTML='<button type="button" class="ec1-btn ec1-muted-btn" id="ec1Remove">Olvidar acceso</button>'+
   '<div class="ec1-footer-end"><button type="button" class="ec1-btn ec1-muted-btn" id="ec1Cancel">Cancelar</button>'+
   '<button type="button" class="ec1-btn ec1-secondary" id="ec1Save">Guardar</button>'+
   '<button type="button" class="ec1-btn ec1-primary" id="ec1Check">Comprobar conexión</button></div>';
  by('ec1Cancel').onclick=()=>close();
  by('ec1Save').onclick=()=>saveSettings(false);
  by('ec1Check').onclick=()=>saveSettings(true);
  by('ec1Remove').onclick=forgetSettings;
  by('ec1SettingsForm').onsubmit=e=>{e.preventDefault();saveSettings(true)};
 }
 function readSettingsForm(){
  return validate({login:by('ec1Login').value,password:by('ec1Password').value,school_url:by('ec1School').value});
 }
 async function storeEntry(uid,entry,remember){
  if(remember){await storage.save(uid,entry);ephemeral=null}
  else{await storage.clear(uid);ephemeral={uid,entry}}
 }
 async function saveSettings(check){
  if(busy)return;
  let entry;try{entry=readSettingsForm()}catch(e){status(e.message,true);return}
  setBusy(true);
  const submit=by(check?'ec1Check':'ec1Save');
  const original=submit?.textContent;
  if(submit)submit.textContent=check?'Comprobando…':'Guardando…';
  status(check?'Autenticando con educa.city…':'Guardando configuración cifrada…');
  try{
   const auth=await currentIdentity();
   if(check)await send('connection_check',entry);
   await storeEntry(auth.uid,entry,by('ec1Remember').checked);
   credential=entry;
   status(check?'Conexión comprobada con insroque.educa.city. Acceso listo para sincronizar.':'Acceso guardado. Ya puedes cargar notas desde PLANILLA.');
  }catch(e){status('No se pudo '+(check?'comprobar la conexión':'guardar el acceso')+': '+e.message,true)}
  finally{setBusy(false);if(submit)submit.textContent=original}
 }
 async function forgetSettings(){
  if(busy)return;
  setBusy(true);
  try{
   const {uid}=await currentIdentity();
   await storage.clear(uid);
   ephemeral=null;credential=null;
   by('ec1Login').value='';by('ec1Password').value='';by('ec1School').value=SCHOOL;
   status('Acceso eliminado de este navegador.');
  }catch(e){status('No se pudo borrar: '+e.message,true)}
  finally{setBusy(false)}
 }
 async function openSettings(){
  modal('settings');settingsMarkup();
  try{
   const {uid}=await currentIdentity();
   const saved=ephemeral?.uid===uid?ephemeral.entry:await storage.load(uid);
   if(!layer||!by('ec1Login'))return;
   if(saved){by('ec1Login').value=saved.login||'';by('ec1Password').value=saved.password||'';by('ec1School').value=saved.school_url||SCHOOL;
    by('ec1Remember').checked=!(ephemeral?.uid===uid);
    status('Acceso configurado. Puedes comprobar la conexión o modificar los datos.')}
  }catch(e){status('No se pudo recuperar el acceso: '+e.message,true)}
 }
 function progressView(message,percentage,items=[]){
  by('ec1Body').innerHTML='<section class="ec1-progress-panel" aria-live="polite">'+
   '<div class="ec1-spinner" aria-hidden="true"></div>'+
   '<h3 id="ec1ProgressTitle">'+esc(message)+'</h3>'+
   '<p class="ec1-progress-description" id="ec1ProgressDescription">Conexión segura desde EncisoLMS. La planilla permanecerá intacta hasta confirmar.</p>'+
   '<div class="ec1-progress-track" role="progressbar" aria-label="Progreso de sincronización" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+percentage+'"><span style="width:'+percentage+'%"></span></div>'+
   '<ul class="ec1-progress-steps" id="ec1Steps">'+items.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'+
   '</section>';
  by('ec1Footer').innerHTML='<button class="ec1-btn ec1-muted-btn" id="ec1Cancel" type="button" '+(busy?'disabled':'')+'>Cancelar</button>';
  by('ec1Cancel').onclick=()=>close();
 }
 function advance(message,percent,items=[]){
  const title=by('ec1ProgressTitle'),bar=by('ec1Body')?.querySelector('.ec1-progress-track'),steps=by('ec1Steps');
  if(title)title.textContent=message;
  if(bar){bar.setAttribute('aria-valuenow',String(percent));bar.querySelector('span').style.width=percent+'%'}
  if(steps)steps.innerHTML=items.map(x=>'<li>'+esc(x)+'</li>').join('');
 }
 function showFailure(error,context='Lectura detenida'){
  setBusy(false);
  by('ec1Body').innerHTML='<section class="ec1-result ec1-error" role="alert"><div class="ec1-result-icon">!</div>'+
   '<h3>'+esc(context)+'</h3><p>'+esc(error?.message||error||'No fue posible completar la solicitud.')+'</p>'+
   '<small>Verifica la conexión y vuelve a leer antes de intentar otro envío. Si se interrumpió una escritura, algunas notas pueden haber quedado guardadas.</small></section>';
  by('ec1Footer').innerHTML='<button class="ec1-btn ec1-muted-btn" id="ec1Cancel" type="button">Cerrar</button>'+
   '<button class="ec1-btn ec1-primary" id="ec1Retry" type="button">Volver a leer</button>';
  by('ec1Cancel').onclick=()=>close();
  by('ec1Retry').onclick=()=>startPreview();
 }
 function pill(label,kind){return '<span class="ec1-pill '+(kind||'')+'">'+esc(label)+'</span>'}
 function formatComponent(part){
  if(part.action==='create')return pill('Crear','is-pending');
  if(part.action==='update_weight')return pill('Actualizar peso','is-pending');
  return pill('Reutilizar','is-ok');
 }
 function compactGrades(changes){
  const students=new Map();
  for(const x of changes){
   const id=String(x.student_id||x.student_name||'');
   if(!students.has(id))students.set(id,{name:x.student_name,grades:{}});
   students.get(id).grades[x.component]=x;
  }
  if(!students.size)return '<div class="ec1-empty"><strong>Todo está actualizado.</strong><span>Las notas de EncisoLMS coinciden con las de educa.city.</span></div>';
  const headings=ORDER.map(k=>'<th scope="col">'+esc(COMPONENTS[k])+'</th>').join('');
  const rows=[...students.values()].map(student=>'<tr><th scope="row">'+esc(student.name)+'</th>'+
   ORDER.map(k=>{const g=student.grades[k];return '<td>'+(g?'<span class="ec1-old">'+esc(g.before??'—')+'</span><span class="ec1-arrow">→</span><strong class="ec1-new">'+esc(g.after)+'</strong>':'<span class="ec1-same">Sin cambios</span>')+'</td>'}).join('')+'</tr>').join('');
  return '<div class="ec1-table-wrap"><table class="ec1-table"><thead><tr><th>Estudiante</th>'+headings+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
 }
 function displayPreview(){
  const p=preview,changes=p.changes||[],acts=p.components||[],missing=p.unmatched||[];
  const count=changes.length;
  by('ec1Body').innerHTML=
   '<div class="ec1-summary-strip"><div><strong>Período '+esc(snapshot.period)+'</strong><span>'+esc(snapshot.assignment_id.replace('mat-est-',''))+'</span></div>'+
   '<div><strong>'+Number(p.matched||0)+'</strong><span>Estudiantes</span></div>'+
   '<div><strong>'+Number(p.needs_creation||0)+'</strong><span>Por crear</span></div>'+
   '<div><strong>'+count+'</strong><span>Notas diferentes</span></div></div>'+
   '<div class="ec1-tabs" role="tablist" aria-label="Detalle de sincronización">'+
   '<button type="button" role="tab" aria-selected="true" class="ec1-tab is-active" data-tab="summary" id="ec1TabSummary" aria-controls="ec1PanelSummary">Resumen</button>'+
   '<button type="button" role="tab" aria-selected="false" class="ec1-tab" data-tab="activities" id="ec1TabActivities" aria-controls="ec1PanelActivities">Actividades</button>'+
   '<button type="button" role="tab" aria-selected="false" class="ec1-tab" data-tab="grades" id="ec1TabGrades" aria-controls="ec1PanelGrades">Calificaciones</button></div>'+
   '<section class="ec1-tab-panel" id="ec1PanelSummary" role="tabpanel" aria-labelledby="ec1TabSummary">'+
    '<h3>'+(!count&&!p.needs_creation?'La planilla está al día':'Cambios preparados para cargar')+'</h3>'+
    '<p>'+(!count&&!p.needs_creation?'Los datos ya coinciden. Puedes comprobar nuevamente las tres actividades sin modificar notas.':'Se sincronizarán únicamente las diferencias con educa.city, conservando las demás notas.')+'</p>'+
    (missing.length?'<p class="ec1-warning">'+missing.length+' estudiante(s) sin correspondencia. No se enviarán sus calificaciones.</p>':'')+
    '<div class="ec1-legend">'+pill('Académico · '+snapshot.weights.academic+' %')+pill('Actitudinal · '+snapshot.weights.attendance+' %')+pill('Aptitudinal · '+snapshot.weights.rockstars+' %')+'</div></section>'+
   '<section class="ec1-tab-panel" id="ec1PanelActivities" role="tabpanel" aria-labelledby="ec1TabActivities" hidden>'+
    '<h3>Actividades en educa.city</h3>'+
    '<div class="ec1-table-wrap"><table class="ec1-table"><thead><tr><th>Componente</th><th>Actividad</th><th>Peso</th><th>Acción</th></tr></thead><tbody>'+
    acts.map(a=>'<tr><th scope="row">'+esc(COMPONENTS[a.key])+'</th><td>'+esc(a.remote_id||'Nueva')+'</td><td>'+esc(a.weight_new)+' %</td><td>'+formatComponent(a)+'</td></tr>').join('')+
    '</tbody></table></div></section>'+
   '<section class="ec1-tab-panel" id="ec1PanelGrades" role="tabpanel" aria-labelledby="ec1TabGrades">'+
    '<h3>Notas que cambiarán</h3><p>Una fila por estudiante. Las notas se envían como números enteros.</p>'+compactGrades(changes)+'</section>';
  by('ec1Footer').innerHTML='<button class="ec1-btn ec1-muted-btn" id="ec1Cancel" type="button">Cancelar</button>'+
   '<button class="ec1-btn ec1-primary" id="ec1Apply" type="button">'+(count||p.needs_creation?'Cargar a EducaCity':'Verificar sincronización')+'</button>';
  by('ec1Cancel').onclick=()=>close();
  by('ec1Apply').onclick=apply;
  by('ec1Body').querySelectorAll('.ec1-tab').forEach(b=>b.onclick=()=>selectTab(b.dataset.tab));
  selectTab('summary');
 }
 function selectTab(name){
  tab=name;
  by('ec1Body')?.querySelectorAll('.ec1-tab').forEach(b=>{
   const active=b.dataset.tab===name;
   b.classList.toggle('is-active',active);b.setAttribute('aria-selected',String(active));
  });
  for(const key of ['summary','activities','grades']){
   const pane=by('ec1Panel'+key[0].toUpperCase()+key.slice(1));
   if(pane)pane.hidden=key!==name;
  }
 }
 async function persistVerified(reply){
  const c=client(),component=reply.component;
  const row={assignment_id:snapshot.assignment_id,academic_year:2026,period:snapshot.period,component,
   educacity_activity_id:Number(reply.remote_id),educacity_title:COMPONENTS[component],
   weight:Number(snapshot.weights[component]),rockstar_target:component==='rockstars'?Number(snapshot.rockstar_target||15):null,
   status:'verified',source:'supabase_edge_live_read',updated_at:new Date().toISOString()};
  const saved=await c.from('educacity_component_links').upsert(row,{onConflict:'assignment_id,academic_year,period,component'});
  if(saved.error)throw Error(saved.error.message);
  const matched=reply.confirmed_students||[];
  if(!matched.length)return;
  const ids=matched.map(x=>String(x.code));
  const q=await c.from('students').select('id,student_code').in('student_code',ids);
  if(q.error)throw Error(q.error.message);
  const map=new Map((q.data||[]).map(x=>[String(x.student_code),String(x.id)]));
  const rows=matched.filter(x=>map.has(String(x.code))).map(x=>({
   assignment_id:snapshot.assignment_id,academic_year:2026,student_id:map.get(String(x.code)),
   educacity_student_id:Number(x.remote_id),educacity_name:String(x.name),
   match_method:'verified_code',status:'confirmed',updated_at:new Date().toISOString()
  }));
  if(rows.length){
   const v=await c.from('educacity_student_links').upsert(rows,{onConflict:'assignment_id,academic_year,student_id'});
   if(v.error)throw Error(v.error.message);
  }
 }
 async function startPreview(){
  if(busy)return;
  replies=[];preview=null;snapshot=null;
  progressView('Preparando conexión institucional',6,['Recuperando configuración segura…']);
  setBusy(true);
  try{
   const {uid}=await currentIdentity();
   credential=ephemeral?.uid===uid?ephemeral.entry:await storage.load(uid);
   if(!credential)throw Error('Primero guarda tu acceso en Inicio → Herramientas → EducaCity.');
   credential=validate(credential);
   advance('Leyendo la planilla del LMS',24,['Acceso institucional configurado','Preparando calificaciones…']);
   if(typeof window.EncisoEducaCitySnapshot!=='function')throw Error('Recarga EncisoLMS para actualizar la PLANILLA.');
   snapshot=window.EncisoEducaCitySnapshot();
   if(!snapshot?.students?.length)throw Error('La planilla seleccionada no tiene estudiantes.');
   advance('Conectando con educa.city',55,['Acceso institucional configurado','Validando matrícula y actividades…']);
   const response=await send('preview',credential);
   preview=response.data;
   advance('Comparación terminada',100,['Conexión comprobada','Actividades y calificaciones comparadas']);
   displayPreview();
  }catch(err){
   if(String(err.message||'').includes('Primero guarda'))showSettingsRequired(err.message);
   else showFailure(err,'No se pudo leer educa.city');
  }finally{setBusy(false)}
 }
 function showSettingsRequired(message){
  setBusy(false);
  by('ec1Body').innerHTML='<section class="ec1-result"><h3>Configura EducaCity una sola vez</h3><p>'+esc(message)+'</p></section>';
  by('ec1Footer').innerHTML='<button class="ec1-btn ec1-muted-btn" id="ec1Cancel" type="button">Cancelar</button>'+
   '<button class="ec1-btn ec1-primary" id="ec1Settings" type="button">Abrir Herramientas</button>';
  by('ec1Cancel').onclick=()=>close();
  by('ec1Settings').onclick=()=>openSettings();
 }
 async function apply(){
  if(busy||!preview||!credential)return;
  replies=[];const issues=[];let verified=0;
  progressView('Iniciando sincronización',4,['Conservando notas no modificadas…']);
  setBusy(true);
  try{
   for(let i=0;i<ORDER.length;i++){
    const k=ORDER[i],part=preview.components.find(x=>x.key===k);
    if(!part)throw Error('Falta el componente '+COMPONENTS[k]+' en la lectura inicial.');
    advance('Sincronizando '+COMPONENTS[k],12+i*27,
     ORDER.slice(0,i).map(key=>'✓ '+COMPONENTS[key]+' completado').concat(['Comprobando '+COMPONENTS[k]+' en educa.city…']));
    const outcome=await send('sync',credential,k,part.baseline_hash);
    replies.push(outcome);
    verified+=Number(outcome.notes_verified||0);
    issues.push(...(outcome.failed_notes||[]),...(outcome.not_sent_notes||[]));
    try{await persistVerified(outcome)}catch(e){issues.push({student_name:'Vínculos de '+COMPONENTS[k],reason:'Sin guardar vínculo en LMS: '+e.message})}
    advance(COMPONENTS[k]+' comprobado',Math.min(95,36+i*30),
     ORDER.slice(0,i+1).map(key=>'✓ '+COMPONENTS[key]+' comprobado'));
   }
   const partial=issues.length>0;
   by('ec1Body').innerHTML='<section class="ec1-result '+(partial?'ec1-partial':'ec1-ok')+'">'+
    '<div class="ec1-result-icon">'+(partial?'!':'✓')+'</div>'+
    '<h3>'+(partial?'Sincronización con pendientes':'Sincronización completada')+'</h3>'+
    '<p>Se comprobaron las tres actividades y sus calificaciones en educa.city.</p>'+
    '<div class="ec1-result-stats"><div><strong>'+verified+'</strong><span>Notas guardadas y verificadas</span></div>'+
    '<div><strong>'+issues.length+'</strong><span>Pendientes de revisión</span></div></div>'+
    (partial?'<details class="ec1-issues"><summary>Ver detalles de los pendientes ('+issues.length+')</summary><ul>'+
     issues.map(x=>'<li>'+esc(x.student_name||'Registro')+': '+esc(x.reason||'No confirmado')+'</li>').join('')+
    '</ul></details>':'')+'</section>';
   by('ec1Footer').innerHTML=(partial?'<button class="ec1-btn ec1-secondary" id="ec1Retry" type="button">Volver a leer</button>':'')+
    '<button class="ec1-btn ec1-primary" id="ec1Done" type="button">Finalizar</button>';
   by('ec1Done').onclick=()=>close();
   if(partial)by('ec1Retry').onclick=()=>startPreview();
  }catch(err){showFailure(err,'Sincronización interrumpida · '+replies.length+' de 3 componentes comprobados')}
  finally{setBusy(false)}
 }
 async function openSync(){
  modal('sync');
  await startPreview();
 }
 window.EncisoEducaCity={openSettings,openSync};
})();