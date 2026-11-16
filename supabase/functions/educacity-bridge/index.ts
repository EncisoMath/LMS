import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { parseHTML } from "npm:linkedom@0.18.12";
import JSON5 from "npm:json5@2.2.3";

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
// EducaCity only accepts integer grades. 53.5 -> 54, 53.4 -> 53.
const scoreInt=v=>{
 const score=Number(v);
 if(!Number.isFinite(score)||score<0||score>100)throw Error("Calificación de EncisoLMS fuera del rango 0–100.");
 return Math.round(score);
};
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
// La interfaz oficial calcula str_cell_values DESPUÉS de inicializar JavaScript.
// Intentamos recuperar solamente el modelo JSON original, sin ejecutar código externo.

/* JavaScript text is untrusted. Parse data expressions as JSON5, NEVER eval scripts.
   EducaCity may emit JS object literals with unquoted properties and single quotes. */
function literalEnd(s,start){
 const i=start;
 if(!"{[".includes(s[i]||" ") || (s[i]!=="{"&&s[i]!=="["))return -1;
 const stack=[],pairs={"{":"}","[":"]"};
 let str="",esc=false,comment=0;
 for(let j=i;j<s.length&&j-i<2000000;j++){
  const c=s[j],n=s[j+1]||"";
  if(comment===1){if(c==="\n")comment=0;continue}
  if(comment===2){if(c==="*"&&n==="/"){comment=0;j++}continue}
  if(str){if(esc){esc=false;continue}if(c==="\\"){esc=true;continue}if(c===str)str="";continue}
  if(c==="/"&&n==="/"){comment=1;j++;continue}
  if(c==="/"&&n==="*"){comment=2;j++;continue}
  if(c==='"'||c==="'"){str=c;continue}
  if(c==="{"||c==="["){stack.push(pairs[c]);continue}
  if(c==="}"||c==="]"){if(stack.pop()!==c)return -1;if(!stack.length)return j+1}
 }
 return -1;
}
function parseDataExpression(script,at){
 let i=at;
 while(/\s/.test(script[i]||""))i++;
 if(script[i]==="{"||script[i]==="["){
  const end=literalEnd(script,i);
  if(end<0)return null;
  const body=script.slice(i,end);
  try{return JSON.parse(body)}catch{}
  try{return JSON5.parse(body)}catch{}
 }
 if(script.slice(i).match(/^(?:JSON\.parse|\$\.parseJSON|jQuery\.parseJSON)\s*\(/)){
  const match=script.slice(i).match(/^(?:JSON\.parse|\$\.parseJSON|jQuery\.parseJSON)\s*\(\s*/);
  if(!match)return null;
  const after=i+match[0].length;
  if(!["'",'"'].includes(script[after]))return null;
  const quote=script[after];let end=after+1,escaped=false;
  for(;end<script.length&&end-after<1800000;end++){
   const c=script[end];
   if(escaped){escaped=false;continue}
   if(c==="\\"){escaped=true;continue}
   if(c===quote)break;
  }
  if(end>=script.length)return null;
  const expression=script.slice(after,end+1);
  try{
   const decoded=JSON5.parse(expression);
   if(typeof decoded==="string"){
    try{return JSON.parse(decoded)}catch{}
    try{return JSON5.parse(decoded)}catch{}
   }
  }catch{}
 }
 return null;
}
function bootstrapModel(doc){
 const elements=[...doc.querySelectorAll("script")];
 const scripts=elements.map(s=>String(s.textContent||""));
 const payload={};
 // Supports server-emitted JS object literals and independently assigned datasets.
 const patterns=[
  ["whole",/(?:^|[;\n])\s*(?:(?:var|let|const)\s+)?(?:window\.|top\.)?_data\s*=\s*/g],
  ["whole",/(?:^|[;\n])\s*(?:(?:var|let|const)\s+)?(?:window\.|top\.)?gbook_data\s*=\s*/g],
  ["ar_axe",/(?:window\.|top\.)?_data(?:\.ar_axe|\s*\[\s*['"]ar_axe['"]\s*\])\s*=\s*/g],
  ["ar_enrollments",/(?:window\.|top\.)?_data(?:\.ar_enrollments|\s*\[\s*['"]ar_enrollments['"]\s*\])\s*=\s*/g],
  ["ar_assignments",/(?:window\.|top\.)?_data(?:\.ar_assignments|\s*\[\s*['"]ar_assignments['"]\s*\])\s*=\s*/g],
  ["ar_axe",/(?:^|[;\n])\s*(?:(?:var|let|const)\s+)?ar_axe\s*=\s*/g],
  ["ar_enrollments",/(?:^|[;\n])\s*(?:(?:var|let|const)\s+)?ar_enrollments\s*=\s*/g],
  ["ar_assignments",/(?:^|[;\n])\s*(?:(?:var|let|const)\s+)?ar_assignments\s*=\s*/g],
  ["ar_axe",/(?:^|[,\{\n])\s*[\x27\x22]?ar_axe[\x27\x22]?\s*:\s*/g],
  ["ar_enrollments",/(?:^|[,\{\n])\s*[\x27\x22]?ar_enrollments[\x27\x22]?\s*:\s*/g],
  ["ar_assignments",/(?:^|[,\{\n])\s*[\x27\x22]?ar_assignments[\x27\x22]?\s*:\s*/g]
 ];
 for(const script of scripts){
  if(!script.trim())continue;
  for(const [key,pattern] of patterns){
   pattern.lastIndex=0;let m,count=0;
   while((m=pattern.exec(script))&&count++<12){
    const value=parseDataExpression(script,m.index+m[0].length);
    if(value&&typeof value==="object"&&!Array.isArray(value)){
     if(key==="whole"){
      for(const part of ["ar_axe","ar_enrollments","ar_assignments"])if(value[part]&&typeof value[part]==="object")payload[part]=value[part];
     } else payload[key]=value;
    }
   }
  }
 }
 const inline=scripts.filter(s=>s.length>0);
 const signatures={
  ar_axe:scripts.some(x=>/\bar_axe\b/.test(x)),
  ar_enrollments:scripts.some(x=>/\bar_enrollments\b/.test(x)),
  ar_assignments:scripts.some(x=>/\bar_assignments\b/.test(x)),
  var_data:scripts.some(x=>/\b_data\s*=/.test(x)),
  data_member:scripts.some(x=>/\b_data\s*\./.test(x)),
  json_parse:scripts.some(x=>/JSON\.parse|\$\.parseJSON/.test(x)),
  ajax:scripts.some(x=>/\.ajax\b|\.post\b|\.getJSON\b|fetch\s*\(/.test(x)),
  dom_students:doc.querySelectorAll(".one_student").length,
  dom_grid:doc.querySelectorAll(".gbook__cells_grid__row").length,
  embedded_json:doc.querySelectorAll('script[type="application/json"]').length
 };
 return {payload,diagnostic:{scripts:scripts.length,inline:inline.length,
  inline_lengths:inline.map(x=>x.length).sort((a,b)=>b-a).slice(0,8),
  external:elements.filter(x=>x.getAttribute("src")).length,
  markers:signatures,
  parsed_keys:Object.keys(payload).sort()
 }};
}

/* Official EducaCity activity catalog can contain ungraded activities that are
   absent from ar_axe / str_cell_values. Do not infer created IDs from grades. */
function verifiedAssignmentIds(collection){
 if(!collection||typeof collection!=="object"||Array.isArray(collection))return [];
 const out=new Set();
 for(const [key,value] of Object.entries(collection)){
  if(!value||typeof value!=="object"||Array.isArray(value))continue;
  const id=String(value.a_id??key);
  if(!idok(id))continue;
  if(idok(key)&&key!==id)throw Error("El listado de actividades contiene IDs contradictorios.");
  out.add(id);
 }
 if(out.size>160)throw Error("La respuesta institucional contiene demasiadas actividades para esta planilla.");
 return [...out];
}
function hasActivityCells(matrix,id){
 const suffix="_"+id;
 for(const key of matrix.keys())if(key.endsWith(suffix))return true;
 return false;
}
/* Complete only a freshly created, officially catalogued *empty* column.
   This mirrors the blank cells the EducaCity JS gradebook creates in Chrome.
   Every pre-existing grade token remains byte-for-byte unchanged. */
function materializeEmptyColumn(remote,id){
 const activityId=String(id);
 if(!remote.assignmentIds.includes(activityId))throw Error("No se puede preparar la actividad: falta del catálogo oficial en vivo.");
 const students=[...remote.byCode.keys()];
 if(!students.length||students.some(x=>!idok(x)))throw Error("Los estudiantes de la actividad no se pudieron verificar.");
 // The live matrix can be sparse: some students have already received a grade
 // while others have no serialized cell at all. Never recreate existing cells.
 const blanks=students.filter(student=>!remote.matrix.has(student+"_"+activityId))
   .map(student=>student+"_"+activityId+"_");
 if(!blanks.length)return remote;
 const raw=(remote.raw?remote.raw+",":"")+blanks.join(",");
 const matrix=readMatrix(raw);
 if(matrix.size!==remote.matrix.size+blanks.length)throw Error("La preparación de celdas nuevas alteraría celdas existentes.");
 for(const [key,v] of remote.matrix)if(!matrix.has(key)||matrix.get(key)!==v)throw Error("La matriz cambió durante la preparación de celdas vacías.");
 return {...remote,raw,matrix,f:{...remote.f,str_cell_values:raw,str_new_cell_values:raw}};
}

function scoreSource(payload){
 const out=new Map();
 const axe=payload.ar_axe;
 if(!axe||typeof axe!=="object"||Array.isArray(axe))return out;
 for(const nested of Object.values(axe)){
  if(!nested||typeof nested!=="object")continue;
  for(const row of Object.values(nested)){
   if(!row||typeof row!=="object"||!idok(row.e_id)||!idok(row.a_id))continue;
   const val=row.score===null||row.score===undefined||row.score===""?null:Number(row.score);
   if(val!==null&&(!Number.isFinite(val)||val<0||val>100))throw Error("educa.city contiene una calificación fuera de rango.");
   const key=String(row.e_id)+"_"+String(row.a_id);
   if(out.has(key))throw Error("educa.city contiene valores duplicados para una celda.");
   out.set(key,val);
  }
 }
 return out;
}
function enrollmentName(row){
 if(!row||typeof row!=="object")return "";
 const data=row.student&&typeof row.student==="object"?row.student:row;
 const first=String(data.first_name||data.first_names||data.names||data.given_names||"").trim();
 const last=String(data.last_name||data.last_names||data.surnames||data.family_names||"").trim();
 return (first+" "+last).trim();
}
function parseSheet(txt,course,period){
 const document=docOf(txt);
 const form=document.querySelector("#form_sheet_students_vs_assignments");
 if(!form)throw Error("educa.city no devolvió el formulario de la planilla; comprueba que la sesión docente está activa.");
 const f=fields(form);
 for(const [key,val] of Object.entries({gxc_id:course.educacity_group_id,c_id:course.educacity_subject_id,ar_id:course.educacity_area_id,et_id:PERIOD[period]})){
  if(String(f[key])!==String(val))throw Error("educa.city devolvió otro contexto de curso o período ("+key+").");
 }
 if(f.str_cell_values&&f.str_cell_values!==f.str_new_cell_values)
  throw Error("Hay modificaciones sin guardar en la planilla REAL de educa.city. No se sobrescribió ninguna nota.");
 const {payload,diagnostic}=bootstrapModel(document);
 const assignmentIds=verifiedAssignmentIds(payload.ar_assignments);
 let matrix,byCode=new Map(),raw=f.str_cell_values||"";
 const domStudents=[...document.querySelectorAll(".students_list .gbook_row .one_student")];
 const students=domStudents.length?domStudents:[...document.querySelectorAll(".gbook_row .one_student")];
 const rows=[...document.querySelectorAll(".gbook__cells_grid__row")];
 if(students.length&&students.length===rows.length){
  for(let i=0;i<students.length;i++){
   const sid=(rows[i].getAttribute("id")||"").match(/(\d{2,12})$/)?.[1];
   if(!sid||byCode.has(sid))throw Error("No se pudo identificar una fila única de estudiante en educa.city.");
   const first=students[i].querySelector(".first_name")?.textContent||"";
   const last=students[i].querySelector(".last_name")?.textContent||"";
   const name=(first+" "+last).trim();
   if(name)byCode.set(sid,{code:sid,name});
  }
 }
 if(raw){
  matrix=readMatrix(raw);
 }else{
  const saved=scoreSource(payload);
  if(saved.size){
   matrix=saved;
   raw=[...saved].map(([key,v])=>key+"_"+(v??"")).sort().join(",");
   f.str_cell_values=raw;
   f.str_new_cell_values=raw;
  }
  if(!byCode.size&&payload.ar_enrollments){
   for(const [key,data] of Object.entries(payload.ar_enrollments)){
    const id=String(data?.e_id||key),name=enrollmentName(data);
    if(idok(id)&&name&& !byCode.has(id))byCode.set(id,{code:id,name});
   }
  }
  if(!matrix||!matrix.size||!byCode.size){
   const fingerprint=[
    "HTML="+txt.length,
    "scripts="+diagnostic.scripts,
    "js_inline="+diagnostic.inline,
    "js_externos="+diagnostic.external,
    "mayores_js="+diagnostic.inline_lengths.join("/"),
    "marcas="+Object.entries(diagnostic.markers).filter(x=>x[1]).map(x=>x[0]).join(","),
    "modelo="+diagnostic.parsed_keys.join(","),
    "ejes="+Number(matrix?.size||0),
    "alumnos="+byCode.size
   ].join(" · ");
   throw Error("La planilla llegó sin datos inicializados por JavaScript. "+fingerprint+
    ". No hay cambios pendientes ni se enviaron notas. Debe recuperarse la fuente de datos original o utilizar la API de educa.city.");
  }
 }
 if(!byCode.size)throw Error("Se cargaron notas, pero no nombres verificables de estudiantes; envío detenido.");
 const validStudents=new Set(byCode.keys());
 if([...matrix.keys()].some(k=>!validStudents.has(k.split("_")[0])))
  throw Error("La matriz de educa.city contiene alumnos ajenos al listado verificado.");
 return {document,form,f,matrix,byCode,raw,assignmentIds};
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
 const aids=[...new Set([...sheet.matrix.keys()].map(k=>k.split("_")[1]).concat(sheet.assignmentIds))];
 if(!aids.length)throw Error("La planilla no devolvió actividades identificables.");
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
   const original=snapshot.students.find(s=>String(s.code)===st.code)?.scores?.[key];
   if(original===null||original===undefined)continue;
   const v=scoreInt(original);
   const old=a?remote.matrix.get(st.code+"_"+a.id):null;
   if(a&&!remote.matrix.has(st.code+"_"+a.id)&&!remote.assignmentIds.includes(a.id))
    throw Error("La actividad "+a.title+" no está confirmada en el catálogo oficial.");
   if(old===null||old===undefined||Math.abs(Number(old)-Number(v))>0.001)changes.push({student_name:st.name,student_id:st.code,component:key,before:old??null,after:v});
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
 const changeMap=new Map(edits.map(x=>{
  if(!Number.isInteger(x.after))throw Error("Se detuvo el envío: educa.city exige notas enteras.");
  return [x.student_id+"_"+id,x.after];
 }));
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
 const changes={action:"save_scores",str_new_cell_values:newRaw,groups:"only_this_gxc",force:"0",selected_columns:"",selected_rows:"",adds:""};
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
  if(new URL(req.url).searchParams.get("selftest")==="1"){
   const testHtml='<html><script>const _data = {"ar_axe":{"987654321":{"k":{"e_id":"987654321","a_id":"987654322","score":70}}},"ar_enrollments":{"987654321":{"e_id":"987654321","first_name":"Estudiante","last_name":"Ficticio"}}};</script></html>';
   const {payload,diagnostic}=bootstrapModel(docOf(testHtml));
   const resultMatrix=scoreSource(payload);
   const json5Html='<html><script>var _data={ar_axe:{\"987654321\":{a:{e_id:\"987654321\",a_id:\"987654322\",score:70}}}, ar_enrollments:{\"987654321\":{e_id:\"987654321\",first_name:\"Estudiante\",last_name:\"Ficticio\"}}}</script></html>';
   const json5Map=scoreSource(bootstrapModel(docOf(json5Html)).payload);
   const nestedHtml='<html><script>const bootstrap={ar_axe:{\"987654321\":{a:{e_id:\"987654321\",a_id:\"987654322\",score:70}}},ar_enrollments:{\"987654321\":{e_id:\"987654321\",first_name:\"Estudiante\",last_name:\"Ficticio\"}},custom:undefined}</script></html>';
   const nestedMap=scoreSource(bootstrapModel(docOf(nestedHtml)).payload);
   const formText='<form id="form_sheet_students_vs_assignments">'+
     '<input name="gxc_id" value="14899"><input name="c_id" value="1955">'+
     '<input name="ar_id" value="208"><input name="et_id" value="54">'+
     '<input name="str_cell_values" value=""><input name="str_new_cell_values" value="">'+
     '</form>';
   const sheet=parseSheet(formText+testHtml,{educacity_group_id:14899,educacity_subject_id:1955,educacity_area_id:208},4);
   // Regression: a created activity exists in ar_assignments before it gets
   // any row in ar_axe. Reproduce the original false-negative in isolation.
   const newlyCreated='<script>const _data={ar_axe:{"987654321":{old:{e_id:"987654321",a_id:"987654322",score:70}}},'+
      'ar_enrollments:{"987654321":{e_id:"987654321",first_name:"Estudiante",last_name:"Ficticio"}},'+
      'ar_assignments:{"987654322":{a_id:"987654322",title:"DEFINITIVA",parent_a_id:"987654322"},'+
        '"987654323":{a_id:"987654323",title:"COMP. ACADÉMICO",parent_a_id:"987654322"}}};</script>';
   const emptySheet=parseSheet(formText+newlyCreated,{educacity_group_id:14899,educacity_subject_id:1955,educacity_area_id:208},4);
   const catalogOK=emptySheet.assignmentIds.includes("987654323")&&!hasActivityCells(emptySheet.matrix,"987654323");
   
   const mockForms={
    "987654322":'<form><input name="form_id" value="form_object_987654322"><input name="action" value="update"><input name="a_id" value="987654322"><input name="c_id" value="1955"><input name="group" value="2PPAL"><input name="original_et_id" value="54"><input name="title" value="DEFINITIVA"><input name="influence" value="100"><input name="hie_id" value="1"><input name="parent_a_id" value="987654322"></form>',
    "987654323":'<form><input name="form_id" value="form_object_987654323"><input name="action" value="update"><input name="a_id" value="987654323"><input name="c_id" value="1955"><input name="group" value="2PPAL"><input name="original_et_id" value="54"><input name="title" value="COMP. ACADÉMICO"><input name="influence" value="60"><input name="hie_id" value="2"><input name="parent_a_id" value="987654322"></form>'
   };
   const mockClient={request:async url=>{
    const parsed=new URL(url);
    if(parsed.pathname.endsWith("/grading_book/list.php"))return {text:formText+newlyCreated};
    if(parsed.pathname.endsWith("/assignments/actions.php")){
     const id=parsed.searchParams.get("a_id");
     if(id&&mockForms[id])return {text:mockForms[id]};
    }
    throw Error("Unexpected fixture request");
   }};
   const mockCourse={educacity_group_id:14899,educacity_subject_id:1955,
    educacity_area_id:208,educacity_group_label:"2PPAL"};
   const mockRemote=await readRemote(mockClient,mockCourse,4);
   const mockPlan=await makePlan(mockRemote,{students:[{code:"987654321",name:"Estudiante Ficticio",
    scores:{academic:54,attendance:null,rockstars:null}}],weights:{academic:60,attendance:20,rockstars:20}});
   const discoveryParts={
    found_id:mockRemote.found.academic?.id??null,
    catalog:mockRemote.assignmentIds,
    new_column_has_cells:hasActivityCells(mockRemote.matrix,"987654323"),
    action:mockPlan.components.find(c=>c.key==="academic")?.action??null,
    change_count:mockPlan.changes.filter(c=>c.component==="academic"&&c.after===54).length
   };
   const discoveryOK=discoveryParts.found_id==="987654323"&&
    !discoveryParts.new_column_has_cells&&
    discoveryParts.action==="reuse"&&discoveryParts.change_count===1;

   const expanded=materializeEmptyColumn(emptySheet,"987654323");
   const blankColumnOK=catalogOK&&expanded.matrix.get("987654321_987654323")===null&&
     expanded.matrix.get("987654321_987654322")===70&&
     expanded.raw.includes("987654321_987654322_70")&&
     expanded.raw.includes("987654321_987654323_")&&
     expanded.matrix.size===emptySheet.matrix.size+1;
   const integerGrades=[53.4,53.5,54,71.5,99.5].map(scoreInt);
   const roundingOK=JSON.stringify(integerGrades)===JSON.stringify([53,54,54,72,100]);
   const ok=discoveryOK&&blankColumnOK&&roundingOK&&nestedMap.get("987654321_987654322")===70&&json5Map.get("987654321_987654322")===70&&resultMatrix.get("987654321_987654322")===70&&
     sheet.matrix.get("987654321_987654322")===70&&
     sheet.byCode.get("987654321")?.name==="Estudiante Ficticio"&&
     sheet.f.str_cell_values==="987654321_987654322_70";
   return result({ok,test:"json_bootstrap_and_gradebook_parser",integer_rounding:roundingOK,rounding_examples:integerGrades,new_activity_blank_cells:blankColumnOK,new_activity_catalog_discovery:discoveryOK,fixture_discovery:discoveryParts,cells:sheet.matrix.size,
    students:sheet.byCode.size,model_keys:diagnostic.parsed_keys});
  }
  if(new URL(req.url).searchParams.get("probe")!=="1")return result(basic);
  const targets=[FRONT+"/es/",FRONT+"/school_search.php?q=insroque",REMOTE+"/"];
  const responses=await Promise.all(targets.map(async url=>{
    const host=new URL(url).hostname;
    try{
      const http=new EducaHTTP(); if(url.includes("/school_search.php"))await http.request(FRONT+"/es/"); const r=await http.request(url,url.includes("/school_search.php")?{headers:{Accept:"application/json","X-Requested-With":"XMLHttpRequest",Referer:FRONT+"/es/",Origin:FRONT}}:{});
      const isSchool=url.includes("/school_search.php");let schoolMatches;
      if(isSchool){try{
        const x=JSON.parse(r.text),rows=Array.isArray(x.schools)?x.schools:[];
        schoolMatches=[...new Set(rows.filter(s=>idok(s.school_id)&&/roque|insroque/i.test([s.school_name,s.subdomain,s.domain,s.url].join(" "))).map(s=>String(s.school_id)))].length;
      }catch{schoolMatches=-1}}
      return {host,reachable:true,bytes:r.text.length,is_json:r.text.trim().startsWith("{"),has_html:/<html|<!doctype/i.test(r.text.slice(0,1200)),
        ...(isSchool?{matching_schools:schoolMatches}:{})};
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
   // For creation require the live activity catalog. Otherwise a successful
   // POST with zero scores could look absent, and retries could duplicate it.
   if(part.action==="create"&&!remote.assignmentIds.length)
    throw Error("No se obtuvo el catálogo de actividades de educa.city; no es seguro crear una nueva.");
   await postActivity(http,course,body.snapshot.period,remote.root,part);
   let after=null,linked=null,readingError="";
   for(let attempt=0;attempt<3;attempt++){
    if(attempt)await new Promise(resolve=>setTimeout(resolve,800));
    try{
     after=await readRemote(http,course,body.snapshot.period);
     linked=after.found[key]||null;
     if(linked)break;
    }catch(err){readingError=err instanceof Error?err.message:"Error al releer"}
   }
   if(!linked)
    throw Error("La actividad se intentó guardar, pero no se localizó en la lista actual de educa.city"+
      (readingError?" ("+readingError.slice(0,130)+")":"")+
      ". NO se repetirá la creación: vuelve a leer y comprobar antes de intentarlo otra vez.");
   if(!idok(linked.id)||Math.abs(linked.weight-part.weight_new)>.01||norm(linked.title)!==norm(part.title))
    throw Error("La actividad "+linked.title+" aparece con ID "+linked.id+
      " y peso "+linked.weight+" %, pero se esperaba "+part.weight_new+
      " %. Corrige su configuración antes de enviar notas.");
  }
  let current=await readRemote(http,course,body.snapshot.period);
  const target=current.found[key];
  if(!target)throw Error("No se encontró la actividad recién creada.");
  // New EducaCity activities may not have any serialized grade cells yet.
  current=materializeEmptyColumn(current,target.id);
  const edits=changes.filter(x=>current.matrix.has(x.student_id+"_"+target.id) &&
    current.matrix.get(x.student_id+"_"+target.id)!==x.after);
  if(edits.length!==changes.length)throw Error("Cambió la matriz de alumnos entre la vista previa y el guardado; deteniendo el envío.");
  // Partial saves are real: EducaCity can accept most grades while omitting
  // some students without returning an HTTP error. Verify each cell, never
  // resend the same POST, and report unconfirmed rows separately.
  let verifiedCount=0;
  const failedNotes=[];
  const BATCH_SIZE=10;
  for(let i=0;i<edits.length;i+=BATCH_SIZE){
   const group=edits.slice(i,i+BATCH_SIZE);
   if(i){
    current=materializeEmptyColumn(await readRemote(http,course,body.snapshot.period),target.id);
    // Do not overwrite a grade that changed after the initial preview.
    for(const e of group){
     const cell=current.matrix.get(e.student_id+"_"+target.id);
     if(cell!==null&&cell!==undefined&&cell!==e.before)
      throw Error("La nota de "+e.student_name+" cambió durante la sincronización. Relee antes de continuar.");
    }
   }
   await postGrades(http,current,course,body.snapshot.period,target.id,group);
   // Wait briefly for propagation, but NEVER repeat the POST automatically.
   let observed=null,unconfirmed=[];
   for(let attempt=0;attempt<3;attempt++){
    if(attempt)await new Promise(resolve=>setTimeout(resolve,800));
    observed=await readRemote(http,course,body.snapshot.period);
    unconfirmed=group.filter(e=>observed.matrix.get(e.student_id+"_"+target.id)!==e.after);
    if(!unconfirmed.length)break;
   }
   verifiedCount+=group.length-unconfirmed.length;
   for(const e of unconfirmed){
    const value=observed.matrix.get(e.student_id+"_"+target.id);
    failedNotes.push({student_name:e.student_name,component:key,
      expected:e.after,observed:value??null,reason:"educa.city no confirmó la celda"});
   }
   if(unconfirmed.length===group.length)
    throw Error("educa.city no guardó ninguna de las "+group.length+
      " notas del último bloque. Se detuvo para evitar nuevos envíos inciertos. "+
      "Los bloques anteriores pueden haberse guardado; vuelve a leer antes de continuar.");
  }
  return result({ok:true,component:key,remote_id:target.id,notes_verified:verifiedCount,
    notes_unverified:failedNotes.length,failed_notes:failedNotes,partial:failedNotes.length>0,
    confirmed_students:plan.matched_students,unmatched:plan.unmatched,weight:Number(target.weight)});
 }catch(err){
  return result({ok:false,error:err instanceof Error?err.message:"Error de conexión no identificable",remote_verified:false},400);
 }
});