/* EncisoLMS — Etapa 1 EducaCity. No envía calificaciones ni modifica actividades remotas. */
(() => {
 'use strict';
 const YEAR=2026, TYPES=[
  {key:'academic',local:'Académico',remote:'Académico'},
  {key:'attendance',local:'Asistencia',remote:'Actitudinal'},
  {key:'rockstars',local:'Rockstars',remote:'Aptitudinal'}];
 let modal=null,courses=[],students=[],activities=[],roster=[],assignment='',period=4,query='',pendingOnly=true;
 const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const n=v=>/^[1-9]\d{0,14}$/.test(String(v??'').trim())?Number(v):null;
 const db=()=>window.EncisoSupabase?.getClient?.();
 const el=id=>modal?.querySelector('#'+id);
 const findCourse=()=>courses.find(x=>x.assignment_id===assignment);
 const link=t=>activities.find(x=>x.assignment_id===assignment&&Number(x.period)===period&&x.component===t);
 const currentStudentLinks=()=>students.filter(x=>x.assignment_id===assignment);
 const msg=(s,bad=false)=>{const x=el('ec1Message');if(x){x.textContent=s;x.style.color=bad?'#b42318':'#176032'}};
 const value=(r,label)=>{if(r.error)throw Error(label+': '+r.error.message);return r.data};
 async function getRoster(){
  roster=[];const client=db();if(!client||!assignment)return;
  const a=await client.from('teaching_assignments').select('group_id').eq('id',assignment).maybeSingle();
  if(a.error)throw Error(a.error.message);if(!a.data?.group_id)return;
  const e=value(await client.from('group_enrollments').select('student_id').eq('group_id',a.data.group_id).eq('status','active'),'Matrículas');
  if(!e.length)return;
  const s=value(await client.from('students').select('id,student_code,first_name,last_name,active').in('id',e.map(x=>x.student_id)),'Estudiantes');
  roster=s.filter(x=>x.active).sort((a,b)=>String(a.last_name).localeCompare(String(b.last_name),'es'));
 }
 async function load(){
  const client=db();if(!client)throw Error('Inicia sesión de docente en EncisoLMS.');
  const results=await Promise.all([
   client.from('educacity_course_links').select('*').eq('academic_year',YEAR).order('assignment_id'),
   client.from('educacity_student_links').select('*').eq('academic_year',YEAR),
   client.from('educacity_component_links').select('*').eq('academic_year',YEAR)]);
  courses=value(results[0],'Cursos')||[];
  students=value(results[1],'Vínculos de estudiantes')||[];
  activities=value(results[2],'Vínculos de actividades')||[];
  if(!courses.length)throw Error('No hay cursos vinculados para este docente.');
  const hero=document.querySelector('.em-notes-hero-host')?.innerText||'';
  const m=hero.match(/(?:^|[^\d])(8|9|10|11)\s*[°º]?\s*[-–]\s*([1-6])(?:[^\d]|$)/)||hero.match(/\b(8|9|10|11)([1-6])PPAL\b/i);
  const preferred=m?'mat-est-'+m[1]+'-'+m[2]:'';
  if(preferred&&courses.some(x=>x.assignment_id===preferred))assignment=preferred;
  if(!courses.some(x=>x.assignment_id===assignment))assignment=courses[0].assignment_id;
  await getRoster();draw();
 }
 function draw(){
  const body=el('ec1Body');if(!body)return;
  const c=findCourse(), mapped=currentStudentLinks();
  const all=roster.map(s=>({s,l:mapped.find(x=>x.student_id===s.id)}));
  const confirmed=all.filter(x=>x.l?.status==='confirmed').length;
  const matching=all.filter(x=>(!pendingOnly||x.l?.status!=='confirmed')&&(!query||(String(x.s.last_name+' '+x.s.first_name+' '+x.s.student_code).toLowerCase().includes(query.toLowerCase()))));
  body.innerHTML=
   '<section class="ec1-panel"><div class="ec1-controls"><label>Curso<select id="ec1Course">'+courses.map(c=>'<option value="'+h(c.assignment_id)+'" '+(c.assignment_id===assignment?'selected':'')+'>'+h(c.assignment_id.replace('mat-est-',''))+'</option>').join('')+'</select></label>'+
   '<label>Período<select id="ec1Period">'+[1,2,3,4].map(p=>'<option value="'+p+'" '+(period===p?'selected':'')+'>P'+p+'</option>').join('')+'</select></label>'+
   '<span class="ec1-muted">2026 · '+roster.length+' estudiantes activos · '+confirmed+' confirmados</span></div></section>'+
   '<section class="ec1-panel"><h3>1. Curso vinculado</h3><div class="ec1-grid">'+
    [['Grupo (gxc_id)','ec1Gxc',c?.educacity_group_id],['Asignatura (c_id)','ec1Sub',c?.educacity_subject_id],['Área (ar_id)','ec1Area',c?.educacity_area_id],['Grupo en EducaCity','ec1Label',c?.educacity_group_label]]
    .map(v=>'<label class="ec1-field">'+h(v[0])+'<input id="'+v[1]+'" value="'+h(v[2])+'"></label>').join('')+
   '</div><p class="ec1-muted">Identificadores del catálogo histórico verificado. No cambies estos números sin comprobarlos en educa.city.</p><button id="ec1SaveCourse" class="ec1-btn">Guardar curso</button></section>'+
   '<section class="ec1-panel"><h3>2. Actividades y pesos · Período '+period+'</h3><p class="ec1-muted">Asistencia equivale a Actitudinal; Rockstars equivale a Aptitudinal. Los porcentajes se leen desde PLANILLA.</p>'+
   '<div style="overflow-x:auto"><table class="ec1-table"><thead><tr><th>EncisoLMS</th><th>educa.city</th><th>Peso LMS</th><th>ID actividad</th><th>Estado</th></tr></thead><tbody>'+
   TYPES.map(t=>{const a=link(t.key);return '<tr><td>'+t.local+'</td><td>'+t.remote+'</td><td>'+h(a?.weight)+' %</td>'+
    '<td><input data-ec1-id="'+t.key+'" inputmode="numeric" value="'+h(a?.educacity_activity_id||'')+'" placeholder="Pendiente"></td>'+
    '<td><span class="ec1-tag '+(a?.status==='verified'?'ok':'pending')+'">'+h(a?.status==='verified'?'Verificado':a?.status==='found_unverified'?'ID histórico':'Pendiente')+'</span></td></tr>'}).join('')+
   '</tbody></table></div><div class="ec1-controls" style="margin-top:11px"><button class="ec1-btn" id="ec1SaveActivities">Guardar IDs</button><button class="ec1-btn ec1-secondary" id="ec1SyncWeights">Actualizar pesos desde PLANILLA</button></div></section>'+
   '<section class="ec1-panel"><h3>3. Estudiantes</h3><p class="ec1-muted">Los códigos confirmados provienen de planillas de educa.city. Los pendientes requieren comprobar el ID real antes de enviar notas.</p>'+
   '<div class="ec1-controls"><label>Buscar<input id="ec1Query" value="'+h(query)+'" placeholder="Nombre o matrícula"></label><label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="ec1Pending" '+(pendingOnly?'checked':'')+'>Solo pendientes</label></div>'+
   '<div class="ec1-students"><table class="ec1-table"><thead><tr><th>Estudiante</th><th>Matrícula</th><th>ID externo</th><th>Estado</th><th></th></tr></thead><tbody>'+
   matching.map(({s,l})=>'<tr><td>'+h(s.last_name+' '+s.first_name)+'</td><td>'+h(s.student_code)+'</td><td>'+h(l?.educacity_student_id||'—')+'</td>'+
    '<td><span class="ec1-tag '+(l?.status==='confirmed'?'ok':'pending')+'">'+(l?.status==='confirmed'?'Confirmado':'Revisar')+'</span></td>'+
    '<td><button class="ec1-btn ec1-secondary" data-ec1-student="'+h(s.id)+'">Editar</button></td></tr>').join('')+
   (matching.length?'':'<tr><td colspan="5" class="ec1-muted">Sin resultados para este filtro.</td></tr>')+
   '</tbody></table></div></section><p class="ec1-muted">Etapa 1: solo configura Supabase. Todavía no crea actividades ni envía notas a educa.city.</p>';
  el('ec1Course').onchange=async e=>{assignment=e.target.value;query='';msg('Cargando estudiantes…');try{await getRoster();draw();msg('Curso cargado.')}catch(ex){msg(ex.message,true)}};
  el('ec1Period').onchange=e=>{period=Number(e.target.value);draw()};
  el('ec1SaveCourse').onclick=saveCourse;el('ec1SaveActivities').onclick=saveActivities;el('ec1SyncWeights').onclick=syncWeights;
  el('ec1Pending').onchange=e=>{pendingOnly=e.target.checked;draw()};
  el('ec1Query').oninput=e=>{query=e.target.value;const pos=e.target.selectionStart;draw();el('ec1Query').focus();el('ec1Query').setSelectionRange(pos,pos)};
  body.querySelectorAll('[data-ec1-student]').forEach(b=>b.onclick=()=>editStudent(b.dataset.ec1Student));
 }
 async function saveCourse(){
  try{
   const c=findCourse(),g=n(el('ec1Gxc').value),sub=n(el('ec1Sub').value),area=n(el('ec1Area').value);
   if(!g||!sub||!area)throw Error('Los IDs deben ser enteros positivos.');
   if((c.educacity_group_id!==g||c.educacity_subject_id!==sub||c.educacity_area_id!==area)&&!confirm('¿Cambiar los identificadores históricos del curso?'))return;
   const result=await db().from('educacity_course_links').update({educacity_group_id:g,educacity_subject_id:sub,educacity_area_id:area,educacity_group_label:el('ec1Label').value.trim(),source:'manual',updated_at:new Date().toISOString()}).eq('assignment_id',assignment).eq('academic_year',YEAR).select('*').single();
   const v=value(result,'Guardar curso');courses=courses.map(x=>x.assignment_id===assignment?v:x);draw();msg('Curso guardado en Supabase.');
  }catch(ex){msg(ex.message,true)}
 }
 async function saveActivities(){
  try{
   const ids=TYPES.map(t=>({key:t.key,raw:bodyInput(t.key).value.trim()}));
   if(ids.some(x=>x.raw&&!n(x.raw)))throw Error('Introduce únicamente IDs numéricos positivos.');
   const valid=ids.map(x=>n(x.raw)).filter(Boolean);
   if(new Set(valid).size!==valid.length)throw Error('Dos componentes no pueden compartir la misma actividad.');
   const rows=ids.map(x=>{const before=link(x.key),id=n(x.raw);return {...before,assignment_id:assignment,academic_year:YEAR,period,component:x.key,educacity_activity_id:id,
     status:id?(before?.educacity_activity_id===id?before.status:'found_unverified'):'pending',
     source:'manual_or_snapshot',updated_at:new Date().toISOString()};});
   const result=await db().from('educacity_component_links').upsert(rows,{onConflict:'assignment_id,academic_year,period,component'}).select('*');
   const data=value(result,'Guardar actividades');activities=activities.filter(x=>x.assignment_id!==assignment||Number(x.period)!==period).concat(data);draw();msg('IDs guardados. No se enviaron notas.');
  }catch(ex){msg(ex.message,true)}
 }
 function bodyInput(key){return el('ec1Body').querySelector('[data-ec1-id="'+key+'"]')}
 function weights(config){
  const cols=config?.columns||{},v=(x,d)=>Number.isFinite(Number(x))?Math.max(0,Math.min(100,Number(x))):d;
  const detail=Object.entries(cols).filter(([k])=>k.startsWith('activity:')||k.startsWith('quiz:')).reduce((s,[,x])=>s+v(x?.weight,0),0);
  return {academic:cols.academic&&Object.prototype.hasOwnProperty.call(cols.academic,'weight')?v(cols.academic.weight,60):(detail||60),
   attendance:v(cols.attendance?.weight,20),rockstars:v(cols.rockstars?.weight,20),target:Math.max(1,Number(cols.rockstars?.target)||15)};
 }
 async function syncWeights(){
  try{
   const client=db(),user=await client.auth.getUser();
   if(user.error||!user.data?.user?.id)throw Error('Se necesita la sesión docente.');
   const prefs=value(await client.from('user_preferences').select('preferences').eq('user_id',user.data.user.id).maybeSingle(),'Preferencias');
   const w=weights(prefs?.preferences?.gradebookConfigs?.[assignment+'|period-'+period]);
   const sum=w.academic+w.attendance+w.rockstars;
   if(Math.abs(sum-100)>.01)throw Error('Los pesos suman '+sum+' %. Corrige la PLANILLA antes de sincronizar.');
   const rows=TYPES.map(t=>({...link(t.key),assignment_id:assignment,academic_year:YEAR,period,component:t.key,
      weight:w[t.key],rockstar_target:t.key==='rockstars'?w.target:null,updated_at:new Date().toISOString()}));
   const data=value(await client.from('educacity_component_links').upsert(rows,{onConflict:'assignment_id,academic_year,period,component'}).select('*'),'Actualizar pesos');
   activities=activities.filter(x=>x.assignment_id!==assignment||Number(x.period)!==period).concat(data);draw();
   msg('Pesos guardados: '+w.academic+'/'+w.attendance+'/'+w.rockstars+' %.');
  }catch(ex){msg(ex.message,true)}
 }
 async function editStudent(id){
  const s=roster.find(x=>x.id===id),old=currentStudentLinks().find(x=>x.student_id===id);
  if(!s)return;
  const typed=prompt('Escribe el ID que has comprobado en educa.city para '+s.last_name+' '+s.first_name+':',String(old?.educacity_student_id||''));
  if(typed===null)return;
  const studentId=n(typed);
  if(!studentId){msg('ID de estudiante inválido.',true);return}
  if(!confirm('¿Confirmas la identidad de '+s.last_name+' '+s.first_name+' con ID '+studentId+' en educa.city?'))return;
  try{
   const row={assignment_id:assignment,academic_year:YEAR,student_id:id,educacity_student_id:studentId,educacity_name:s.last_name+' '+s.first_name,match_method:'manual',status:'confirmed',updated_at:new Date().toISOString()};
   const data=value(await db().from('educacity_student_links').upsert(row,{onConflict:'assignment_id,academic_year,student_id'}).select('*').single(),'Guardar estudiante');
   students=students.filter(x=>x.assignment_id!==assignment||x.student_id!==id).concat(data);draw();msg('Identidad guardada, ninguna nota modificada.');
  }catch(ex){msg(ex.message,true)}
 }
 function close(){modal?.remove();modal=null;document.removeEventListener('keydown',onKey)}
 function onKey(e){if(e.key==='Escape')close()}
 async function open(){
  if(modal)return;
  modal=document.createElement('div');modal.className='ec1-overlay';
  modal.innerHTML='<div class="ec1-dialog" role="dialog" aria-modal="true" aria-labelledby="ec1Title">'+
   '<header class="ec1-head"><div><h2 id="ec1Title">Vinculación EncisoLMS ↔ educa.city</h2><p>Etapa 1 · Cursos, estudiantes, actividades y pesos</p></div><button id="ec1Close" class="ec1-close" aria-label="Cerrar">×</button></header>'+
   '<div class="ec1-body"><div id="ec1Message" class="ec1-message" role="status">Leyendo Supabase…</div><div id="ec1Body"></div></div></div>';
  document.body.appendChild(modal);el('ec1Close').onclick=close;modal.onclick=e=>{if(e.target===modal)close()};document.addEventListener('keydown',onKey);
  try{await load();msg('Datos cargados. Revisa los vínculos pendientes.')}catch(ex){msg('No se pudieron cargar los vínculos: '+ex.message,true)}
 }
 function mount(){
  const hero=document.querySelector('.em-notes-hero-host');if(!hero||hero.querySelector('.ec1-open'))return;
  const btn=document.createElement('button');btn.type='button';btn.className='ec1-open';btn.textContent='Vincular con educa.city';btn.onclick=open;
  (hero.querySelector('.em-notes-hero-content')||hero).appendChild(btn);
 }
 const root=document.querySelector('#app')||document.body;let scheduled=false;
 new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;mount()})}).observe(root,{childList:true,subtree:true});
 mount();
})();
