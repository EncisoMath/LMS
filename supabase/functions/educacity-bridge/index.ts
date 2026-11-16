import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { parseHTML } from "npm:linkedom@0.18.12";

// EducaCity -> EncisoLMS: server-only, never save or log external credentials.
const ORIGIN="https://encisomath.github.io";
const FRONT="https://www.educa.city";
const REMOTE="https://insroque.educa.city";
const BASE="/app/web/control/evaluation/";
const TYPES={academic:"ACADEMICO",attendance:"ACTITUDINAL",rockstars:"APTITUDINAL"};
const PRETTY={academic:"COMP. ACADÉMICO",attendance:"COMP. ACTITUDINAL",rockstars:"COMP. APTITUDINAL"};
const PERIOD={1:"51",2:"52",3:"53",4:"54"};
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"POST,GET,OPTIONS","Access-Control-Max-Age":"600","Cache-Control":"no-store"};
const result=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g," ").trim();
const nametag=s=>norm(s).split(/\s+/).filter(Boolean).sort().join(" ");
const asNum=s=>{const v=Number(s);return Number.isFinite(v)?v:NaN};
const idok=s=>/^[1-9]\d{0,14}$/.test(String(s||""));
const timeout=(ms)=>AbortSignal.timeout(ms);
async function digest(v){const bytes=new TextEncoder().encode(JSON.stringify(v));const buffer=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(buffer)].map(n=>n.toString(16).padStart(2,"0")).join("")}

class EducaHTTP{
 constructor(){this.cookies=[]}
 setCookies(response,host){
  const values=response.headers.getSetCookie?.()||[];
  if(!values.length && response.headers.get("set-cookie"))values.push(response.headers.get("set-cookie"));
  for(const raw of values){
   const first=String(raw).split(";")[0],pos=first.indexOf("=");
   if(pos<1)continue;
   const name=first.slice(0,pos).trim(),value=first.slice(pos+1);
   const d=(String(raw).match(/;\s*Domain\s*=\s*([^;\s]+)/i)||[])[1];
   const domain=String(d||host).replace(/^\./,"").toLowerCase();
   if(domain!=="educa.city"&&domain!=="www.educa.city"&&domain!=="insroque.educa.city")continue;
   this.cookies=this.cookies.filter(c=>!(c.name===name&&c.domain===domain));
   if(!/;\s*Max-Age=0\b/i.test(raw))this.cookies.push({name,value,domain});
  }
 }
 async request(url,options={},depth=0){
  if(depth>5)throw Error("Demasiadas redirecciones institucionales.");
  const target=new URL(url,FRONT);
  if(target.protocol!=="https:"||!["www.educa.city","insroque.educa.city"].includes(target.hostname))throw Error("Se rechazó una redirección ajena a educa.city.");
  const headers=new Headers(options.headers||{});
  const cookies=this.cookies.filter(c=>target.hostname===c.domain||target.hostname.endsWith("."+c.domain));
  if(cookies.length)headers.set("Cookie",cookies.map(c=>c.name+"="+c.value).join("; "));
  headers.set("Accept-Language","es-CO,es;q=0.9");
  headers.set("User-Agent","Mozilla/5.0 (compatible; EncisoLMS-Integration/1.0)");
  const response=await fetch(target,{...options,headers,redirect:"manual",signal:timeout(17000)});
  this.setCookies(response,target.hostname);
  if([301,302,303,307,308].includes(response.status)){
   const loc=response.headers.get("location");if(!loc)throw Error("Redirección sin destino.");
   const next=new URL(loc,target);
   const reset=[301,302,303].includes(response.status);
   return this.request(next.href,{method:reset?"GET":(options.method||"GET"),headers:options.headers,body:reset?undefined:options.body},depth+1);
  }
  const text=await response.text();
  if(!response.ok)throw Error("educa.city respondió HTTP "+response.status+" en "+target.pathname);
  return {text,url:target.href,host:target.hostname,status:response.status};
 }
 async login(credentials){
  if(!credentials||!idok(credentials.login)||typeof credentials.password!=="string"||!credentials.password||credentials.password.length>240)
   throw Error("Ingresa tu usuario y contraseña de educa.city en PLANILLA.");
  await this.request(FRONT+"/es/");
  let school=String(credentials.school_id||"").trim();
  if(!school){
   const find=await this.request(FRONT+"/school_search.php?q=insroque",{headers:{Accept:"application/json","X-Requested-With":"XMLHttpRequest",Referer:FRONT+"/es/",Origin:FRONT}});
   let schools=[];try{schools=JSON.parse(find.text).schools||[]}catch{throw Error("El buscador de instituciones no devolvió un JSON verificable.")}
   const matching=schools.filter(s=>idok(s.school_id)&&/roque|insroque/i.test([s.school_name,s.subdomain,s.domain,s.url].join(" ")));
   const ids=[...new Set(matching.map(s=>String(s.school_id)))];
   if(ids.length!==1)throw Error("No se identificó un school_id único en el buscador oficial; indícalo una sola vez en el formulario.");
   school=ids[0];
  }
  if(!idok(school))throw Error("Identificador de institución inválido.");
  const params=new URLSearchParams({login:String(credentials.login),password:credentials.password,school_id:school});
  const reply=await this.request(FRONT+"/login.php",{method:"POST",body:params,
    headers:{"Content-Type":"application/x-www-form-urlencoded","X-Requested-With":"XMLHttpRequest",Origin:FRONT,Referer:FRONT+"/es/",Accept:"application/json"}});
  let obj;try{obj=JSON.parse(reply.text)}catch{throw Error("educa.city devolvió una respuesta de login no reconocida.")}
  if(obj?.ok!==true||typeof obj?.url!=="string")throw Error("educa.city rechazó el acceso. Verifica usuario, clave e institución.");
  const dest=new URL(obj.url,FRONT);if(dest.hostname!=="insroque.educa.city")throw Error("El login no corresponde al colegio insroque.");
  await this.request(dest.href,{headers:{Referer:FRONT+"/es/"}});
 }
}

function fields(form){
 const out={};
 for(const input of form.querySelectorAll("input[name],textarea[name],select[name]")){
  if(input.hasAttribute("disabled"))continue;
  const name=input.getAttribute("name")||"";if(!name)continue;
  const tag=input.localName;
  const type=(input.getAttribute("type")||"").toLowerCase();
  if(["submit","button","file","reset"].includes(type))continue;
  if(["checkbox","radio"].includes(type)&&!input.hasAttribute("checked"))continue;
  let v="";
  if(tag==="textarea")v=input.textContent||"";
  else if(tag==="select"){
   const opt=input.querySelector("option[selected]")||input.querySelector("option");
   v=opt?.getAttribute("value")??opt?.textContent??"";
  }else v=input.getAttribute("value")||"";
  out[name]=String(v);
 }
 return out;
}
function docOf(txt){return parseHTML(txt).document}
function sourceCheck(s){
 if(!s||!/^mat-est-(8|9|10|11)-[1-6]$/.test(s.assignment_id)||![1,2,3,4].includes(s.period))throw Error("PLANILLA tiene un curso o período inválido.");
 if(!s.weights||Object.keys(TYPES).some(k=>!Number.isFinite(asNum(s.weights[k]))||asNum(s.weights[k])<0||asNum(s.weights[k])>100)||Math.abs(Object.keys(TYPES).reduce((a,k)=>a+Number(s.weights[k]),0)-100)>.02)throw Error("Los pesos actuales de PLANILLA no suman 100 %.");
 if(!Array.isArray(s.students)||!s.students.length||s.students.length>65)throw Error("Listado de estudiantes inválido.");
 const seen=new Set();
 for(const st of s.students){
  if(!idok(st.code)||!nametag(st.name)||seen.has(st.code))throw Error("Matrícula duplicada o sin nombre en PLANILLA.");
  seen.add(st.code);
  for(const k of Object.keys(TYPES)){const v=st.scores?.[k];if(v!==null&&v!==undefined&&(asNum(v)<0||asNum(v)>100||!Number.isFinite(asNum(v))))throw Error("Una calificación de PLANILLA es inválida.");}
 }
}
function readMatrix(raw){
 const map=new Map();
 for(const tok of String(raw||"").split(",").filter(Boolean)){
  const m=tok.trim().match(/^(\d{1,12})_(\d{1,12})_(-?\d{0,3}(?:\.\d{1,3})?)$/);
  if(!m)throw Error("La matriz de educa.city contiene celdas irreconocibles.");
  const key=m[1]+"_"+m[2];if(map.has(key))throw Error("La matriz de educa.city contiene celdas duplicadas.");
  map.set(key,m[3]===""?null:Number(m[3]));
 }
 if(!map.size)throw Error("educa.city devolvió una matriz de notas vacía.");
 return map;
}
function parseSheet(txt,course,period){
 const document=docOf(txt);
 const form=document.querySelector("#form_sheet_students_vs_assignments");
 if(!form)throw Error("La planilla de educa.city requiere ejecución JavaScript y no contiene el formulario en la respuesta del servidor. La integración necesita acceso a la API oficial de educa.city.");
 const f=fields(form);
 for(const [key,val] of Object.entries({gxc_id:course.educacity_group_id,c_id:course.educacity_subject_id,ar_id:course.educacity_area_id,et_id:PERIOD[period]})){
  if(String(f[key])!==String(val))throw Error("educa.city devolvió otro contexto de curso/periodo ("+key+").");
 }
 if(!f.str_cell_values||f.str_cell_values!==f.str_new_cell_values)throw Error("La planilla actual tiene cambios sin guardar o no incluye una matriz íntegra.");
 const matrix=readMatrix(f.str_cell_values);
 const people=[...document.querySelectorAll(".students_list .gbook_row .one_student")];
 const students=people.length?people:[...document.querySelectorAll(".gbook_row .one_student")];
 const rows=[...document.querySelectorAll(".gbook__cells_grid__row")];
 if(!students.length||students.length!==rows.length)throw Error("No se pudo verificar la identidad y posición de los estudiantes con el HTML real.");
 const byCode=new Map();
 for(let i=0;i<students.length;i++){
  const sid=(rows[i].getAttribute("id")||"").match(/(\d{2,12})$/)?.[1];
  if(!sid||byCode.has(sid))throw Error("ID de fila inexistente o duplicado en educa.city.");
  const first=students[i].querySelector(".first_name")?.textContent||"";
  const last=students[i].querySelector(".last_name")?.textContent||"";
  const name=(first+" "+last).trim();
  if(!name)throw Error("Falta un nombre verificable en la planilla.");
  byCode.set(sid,{code:sid,name});
 }
 return {document,form,f,matrix,byCode,raw:f.str_cell_values};
}
function sheetUrl(c,period){
 const q=new URLSearchParams({mode:"gxc",a:"1",filter_et_id:PERIOD[period],et_id:PERIOD[period],
 filter_gxc_id:String(c.educacity_group_id),gxc_id:String(c.educacity_group_id),
 filter_c_id:String(c.educacity_subject_id),c_id:String(c.educacity_subject_id),
 filter_ar_id:String(c.educacity_area_id),ar_id:String(c.educacity_area_id),
 filter_group:c.educacity_group_label,group:c.educacity_group_label});
 return REMOTE+BASE+"sheets/grading_book/list.php?"+q;
}
async function activityForm(client,mode,course,period,id){
 const params=new URLSearchParams({action:mode==="add"?"see_add":"see_update",module_in_use:"grading_book"});
 if(mode==="add"){params.set("et_id",PERIOD[period]);params.set("c_id",String(course.educacity_subject_id));params.set("group",course.educacity_group_label)}
 else params.set("a_id",String(id));
 const page=await client.request(REMOTE+BASE+"assignments/actions.php?"+params);
 const document=docOf(page.text);
 const form=[...document.querySelectorAll("form")].find(x=>x.querySelector('[name="title"]')&&x.querySelector('[name="form_id"]'));
 if(!form)throw Error("educa.city no devolvió el formulario de "+(mode==="add"?"creación":"edición")+" para la actividad.");
 const f=fields(form);
 if(String(f.c_id)!==String(course.educacity_subject_id)||String(f.group)!==course.educacity_group_label||String(f.original_et_id)!==PERIOD[period])throw Error("El formulario de actividad apunta a otro curso o período.");
 if(mode==="add"&&f.action!=="add")throw Error("Formulario de creación inesperado.");
 if(mode==="update"&&(f.action!=="update"||String(f.a_id)!==String(id)))throw Error("Formulario de edición inesperado.");
 return f;
}
function componentFor(title){
 let t=norm(title);
 for(const prefix of ["COMPONENTE ","COMP ","C ","NOTA "])if(t.startsWith(prefix)){t=t.slice(prefix.length);break}
 for(const [k,n] of Object.entries(TYPES))if(t===n)return k;
 return null;
}
async function readRemote(http,course,period){
 const page=await http.request(sheetUrl(course,period));
 const sheet=parseSheet(page.text,course,period);
 const aids=[...new Set([...sheet.matrix.keys()].map(k=>k.split("_")[1]))];
 const activities=[];
 // Metadata must come from EducaCity's live update forms, never from saved IDs.
 for(let i=0;i<aids.length;i+=6){
  const batch=await Promise.all(aids.slice(i,i+6).map(async id=>{
   const f=await activityForm(http,"update",course,period,id);
   return {id,title:f.title,weight:Number(f.influence),parent:String(f.parent_a_id||""),isRoot:norm(f.title)==="DEFINITIVA"||String(f.hie_id)==="1",form:f};
  }));
  activities.push(...batch);
 }
 const roots=activities.filter(x=>x.isRoot);
 if(roots.length!==1)throw Error("No se identificó una única actividad raíz DEFINITIVA.");
 const root=roots[0],found={};const other=[];
 for(const a of activities.filter(x=>!x.isRoot&&x.parent===root.id)){
  const k=componentFor(a.title);
  if(k){if(found[k])throw Error("Hay actividades duplicadas de "+k+" en educa.city.");found[k]=a}
  else if(a.weight>0)other.push(a.title);
 }
 if(other.length)throw Error("educa.city contiene componentes adicionales con peso: "+other.join(", ")+". Se detuvo para no alterar la definitiva.");
 return {...sheet,activities,root,found};
}
async function makePlan(remote,snapshot){
 const matched=[],unmatched=[],changes=[];
 for(const person of snapshot.students){
  const other=remote.byCode.get(String(person.code));
  if(!other){unmatched.push({code:person.code,name:person.name,cause:"Matrícula no encontrada"});continue}
  if(nametag(other.name)!==nametag(person.name)){unmatched.push({code:person.code,name:person.name,remote_name:other.name,cause:"Nombre diferente"});continue}
  matched.push({code:String(person.code),name:other.name,remote_id:person.code});
 }
 const components=[];
 for(const [key,title] of Object.entries(PRETTY)){
  const a=remote.found[key],weight=Number(snapshot.weights[key]);
  components.push({key,title:a?.title||title,remote_id:a?.id||null,weight_before:a?.weight??null,weight_new:weight,action:!a?"create":Math.abs(a.weight-weight)>.01?"update_weight":"reuse",
   baseline_hash:await digest({id:a?.id||null,title:a?.title||null,weight:a?.weight??null,
    cells:matched.map(st=>remote.matrix.get(st.code+"_"+a?.id)||null)})});
  for(const st of matched){
   const v=snapshot.students.find(s=>String(s.code)===st.code)?.scores?.[key];
   if(v===null||v===undefined)continue;
   const old=a?remote.matrix.get(st.code+"_"+a.id):null;
   if(a&&!remote.matrix.has(st.code+"_"+a.id))throw Error("La matriz no contiene la celda de "+st.name+" / "+a.title);
   if(old===null||Math.abs(Number(old)-Number(v))>0.001)changes.push({student_name:st.name,student_id:st.code,component:key,before:old??null,after:Number(v)});
  }
 }
 return {matched:matched.length,matched_students:matched,unmatched,changes,components,needs_creation:components.filter(x=>x.action==="create").length};
}
function toFormData(fields0,changes){
 const f=new FormData();
 for(const [k,v] of Object.entries({...fields0,...changes}))f.append(k,String(v??""));
 return f;
}
async function postActivity(http,course,period,root,part){
 const mode=part.action==="create"?"add":"update",id=part.remote_id;
 const base=await activityForm(http,mode,course,period,id);
 const changes={influence:String(part.weight_new)};
 if(mode==="add"){changes.title=part.title;changes.weighting_criteria="10";changes.parent_a_id=String(root.id);changes.all_groups="0";changes.some_groups=""}
 changes.action=mode==="add"?"add":"update";
 changes.action_button=mode==="add"?"form_object_assignments.button_add":"form_object_"+id+".button_update";
 const response=await http.request(REMOTE+BASE+"assignments/actions.php",{method:"POST",body:toFormData(base,changes),headers:{Origin:REMOTE,Referer:REMOTE+"/"}});
 if(/name=["'](?:password|login)["']|iniciar sesi[oó]n|sqlstate|access denied/i.test(response.text.slice(0,8000)))throw Error("educa.city indicó que la actividad no fue guardada correctamente.");
}
async function postGrades(http,remote,course,period,id,edits){
 const changeMap=new Map(edits.map(x=>[x.student_id+"_"+id,x.after]));
 const original=remote.raw;
 const newRaw=original.split(",").map(tok=>{
  const m=tok.match(/^(\d+)_(\d+)_(-?[\d.]*)$/);
  if(!m)return tok;const key=m[1]+"_"+m[2];
  return changeMap.has(key)?m[1]+"_"+m[2]+"_"+String(changeMap.get(key)):tok;
 }).join(",");
 const check=readMatrix(newRaw);
 for(const [key,prev] of remote.matrix)if(!changeMap.has(key)&&check.get(key)!==prev)throw Error("Se alteró una celda no seleccionada.");
 const f=remote.f;
 if(f.str_cell_values!==original)throw Error("La matriz original cambió.");
 const changes={action:"save_scores",str_new_cell_values:newRaw,groups:"only_this_gxc"};
 const response=await http.request(REMOTE+BASE+"sheets/grading_book/actions.php",{method:"POST",body:toFormData(f,changes),headers:{Origin:REMOTE,Referer:sheetUrl(course,period)}});
 if(/name=["'](?:password|login)["']|iniciar sesi[oó]n|sqlstate|permission denied/i.test(response.text.slice(0,8000)))throw Error("educa.city no confirmó el guardado de notas.");
}
function parseInput(data){if(!data||!["preview","sync"].includes(data.op))throw Error("Operación inválida.");sourceCheck(data.snapshot);
 const cred=data.credentials||{};if(!cred.password||!idok(cred.login))throw Error("Ingresa las credenciales de educa.city en PLANILLA.");
 return cred;
}
async function trustedClient(req,assignment){
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!token)throw Error("Inicia sesión en EncisoLMS como docente.");
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_ANON_KEY");
 if(!url||!key)throw Error("La función no tiene configuración Supabase.");
 const supa=createClient(url,key,{global:{headers:{Authorization:"Bearer "+token}}});
 const user=await supa.auth.getUser(token);
 if(user.error||!user.data?.user?.id)throw Error("Tu sesión de EncisoLMS venció.");
 const access=await supa.from("teaching_assignments").select("id").eq("id",assignment).eq("teacher_id",user.data.user.id).maybeSingle();
 if(access.error||!access.data)throw Error("No tienes permisos para esta planilla.");
 const course=await supa.from("educacity_course_links").select("*").eq("assignment_id",assignment).eq("academic_year",2026).maybeSingle();
 if(course.error||!course.data)throw Error("No hay correspondencia institucional de este curso.");
 return course.data;
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method==="GET"){
  const basic={ok:true,service:"encisolms-educacity-edge",local_dependency:false,supported_operations:["preview","sync"],credentials_stored:false};
  if(new URL(req.url).searchParams.get("probe")!=="1")return result(basic);
  const targets=[FRONT+"/es/",FRONT+"/school_search.php?q=insroque",REMOTE+"/"];
  const responses=await Promise.all(targets.map(async url=>{
    const host=new URL(url).hostname;
    try{
      const http=new EducaHTTP(); if(url.includes("/school_search.php"))await http.request(FRONT+"/es/"); const r=await http.request(url,url.includes("/school_search.php")?{headers:{Accept:"application/json","X-Requested-With":"XMLHttpRequest",Referer:FRONT+"/es/",Origin:FRONT}}:{});
      return {host,reachable:true,bytes:r.text.length,is_json:r.text.trim().startsWith("{"),has_html:/<html|<!doctype/i.test(r.text.slice(0,1200))};
    }catch(e){return {host,reachable:false,error:e instanceof Error?e.message.slice(0,130):"Error"}}
  }));
  return result({...basic,probe:responses});
 }
 if(req.method!=="POST")return result({ok:false,error:"Método no permitido"},405);
 try{
  if(req.headers.get("origin")!==ORIGIN)throw Error("Origen no permitido.");
  const body=await req.json();const credentials=parseInput(body);
  const course=await trustedClient(req,body.snapshot.assignment_id);
  const http=new EducaHTTP();
  await http.login(credentials);
  const remote=await readRemote(http,course,body.snapshot.period);
  const plan=await makePlan(remote,body.snapshot);
  if(body.op==="preview")return result({ok:true,data:plan});
  const key=String(body.component||"");if(!Object.hasOwn(TYPES,key))throw Error("Componente inválido.");
  const previous=plan.components.find(x=>x.key===key);
  if(!previous||body.baseline_hash!==previous.baseline_hash)throw Error("educa.city cambió desde la vista previa: consulta de nuevo.");
  const changes=plan.changes.filter(x=>x.component===key),part=previous;
  // Each invocation writes at most one component. Other components remain intact.
  if(part.action!=="reuse"){
   await postActivity(http,course,body.snapshot.period,remote.root,part);
   const after=await readRemote(http,course,body.snapshot.period);
   const linked=after.found[key];
   if(!linked||!idok(linked.id)||Math.abs(linked.weight-part.weight_new)>.01||norm(linked.title)!==norm(part.title))
    throw Error("La actividad no se pudo verificar tras el guardado. No se enviaron notas.");
  }
  let current=await readRemote(http,course,body.snapshot.period);
  const target=current.found[key];
  if(!target)throw Error("No se encontró la actividad recién creada.");
  const edits=changes.filter(x=>current.matrix.has(x.student_id+"_"+target.id) &&
    current.matrix.get(x.student_id+"_"+target.id)!==x.after);
  if(edits.length!==changes.length)throw Error("Cambió la matriz de alumnos entre la vista previa y el guardado; deteniendo el envío.");
  for(let i=0;i<edits.length;i+=25){
   const group=edits.slice(i,i+25);
   if(i){current=await readRemote(http,course,body.snapshot.period);}
   await postGrades(http,current,course,body.snapshot.period,target.id,group);
   const checked=await readRemote(http,course,body.snapshot.period);
   for(const e of group)if(checked.matrix.get(e.student_id+"_"+target.id)!==e.after)throw Error("No se pudo verificar la calificación de "+e.student_name+" en educa.city.");
  }
  return result({ok:true,component:key,remote_id:target.id,notes_verified:edits.length,
    confirmed_students:plan.matched_students,unmatched:plan.unmatched,weight:Number(target.weight)});
 }catch(err){
  return result({ok:false,error:err instanceof Error?err.message:"Error de conexión no identificable",remote_verified:false},400);
 }
});