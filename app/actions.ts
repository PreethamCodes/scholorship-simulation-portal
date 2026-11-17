"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { auth,cookieName,required,provision } from "../lib/session";
import { db,transaction } from "../lib/db";
import { application,editable,field,mobile,reviewNext,studentId,UserIssue } from "../lib/applications";
import { object } from "../lib/storage";

function message(e:unknown) {
  if(e instanceof UserIssue)return e.message;
  if(typeof e==="object" && e && "code" in e && e.code==="23505")return "An application already exists for this academic year.";
  return "The request could not be completed. Check your connection and try again.";
}
function go(path:string,msg:string):never {redirect(path+"?notice="+encodeURIComponent(msg));}

export async function authenticate(mode:"login"|"register",form:FormData) {
  let destination="/student",notice="Signed in.";
  try {
    const email=field(form,"email",180).toLowerCase();
    const password=form.get("password");
    if(!/^[^\s@]+@example\.(test|com)$/.test(email)||typeof password!=="string"||password.length<12||password.length>128)
      throw new UserIssue("Use a synthetic example.test or example.com email and a password of 12–128 characters.");
    const name=mode==="register"?field(form,"name",80):"Demo student";
    const r=await auth(mode==="register"?"signup":"token?grant_type=password",{method:"POST",body:JSON.stringify({email,password,...(mode==="register"?{data:{display_name:name}}:{})})});
    if(!r.ok)throw new UserIssue(mode==="register"?"Registration unavailable. Check the email or try signing in.":"Sign-in failed. Check your email and password.");
    const result=await r.json();
    if(!result.access_token) {destination="/login";notice="Confirm your email before signing in.";}
    else {
      const id=result.user.id;
      const officer=!!(await db().query("SELECT 1 FROM officer_accounts WHERE user_id=$1",[id])).rowCount;
      await provision(id,String(result.user.user_metadata?.display_name??name),officer);
      (await cookies()).set(cookieName,result.access_token,{httpOnly:true,secure:process.env.COOKIE_SECURE!=="false",sameSite:"lax",path:"/",maxAge:Math.min(result.expires_in??3600,3600)});
      destination=officer?"/officer":"/student";notice=mode==="register"?"Account created. Complete your student profile.":"Signed in.";
    }
  }catch(e){go("/"+mode,message(e));}
  go(destination,notice);
}
export async function logout(){
 const jar=await cookies(),token=jar.get(cookieName)?.value;
 jar.delete(cookieName);
 if(token)try{await auth("logout",{method:"POST"},token);}catch{/* Local session has ended. */}
 redirect("/");
}
export async function profile(form:FormData) {
  const u=await required();if(u.officer)redirect("/officer");
  try {
    const name=field(form,"name",80),district=field(form,"district",80);
    await transaction(async c=>{
      await c.query("UPDATE profiles SET display_name=$2 WHERE id=$1",[u.id,name]);
      await c.query("UPDATE student_profiles SET district=$2 WHERE user_id=$1",[u.id,district]);
    });
  }catch(e){go("/student",message(e));}
  go("/student","Profile saved.");
}
export async function createApplication(form:FormData) {
  const u=await required(); if(u.officer)redirect("/officer");
  let id="";
  try{
    const year=Number(field(form,"year",4)),current=new Date().getUTCFullYear();
    if(!Number.isInteger(year)||year<current-1||year>current+1)throw new UserIssue("Choose an available academic year.");
    id=await transaction(async c=>{
      const r=await c.query("INSERT INTO scholarship_applications(student_ref,scheme_id,application_year) SELECT student_ref,'DEMO-PMS',$2 FROM student_profiles WHERE user_id=$1 RETURNING id",[u.id,year]);
      const key=r.rows[0].id;
      await c.query("INSERT INTO application_status_history(application_id,status,actor_id,event) VALUES($1,'DRAFT',$2,'Draft created')",[key,u.id]);
      return key;
    });
  }catch(e){go("/student",message(e));}
  go("/applications/"+id,"Draft created.");
}
export async function change(id:string,form:FormData){
  const u=await required();
  const back="/applications/"+encodeURIComponent(id);
  try{
    await transaction(async c=>{
      const a=await application(c,id,u,true); if(!a)throw new UserIssue("Application unavailable.");
      if(String(a.revision)!==field(form,"revision",12))throw new UserIssue("This application changed. Review its latest details and try again.");
      const intent=field(form,"intent",32);
      let state=a.status,event="",note="";
      if(u.officer){
        if(intent!=="review")throw new UserIssue("Officer action unavailable.");
        const next=field(form,"decision",40);note=field(form,"note",1200);
        if(next==="NOTE" && ["SUBMITTED","RESUBMITTED","UNDER_REVIEW"].includes(state)){event="Officer note added";}
        else {
          if(!reviewNext[state]?.includes(next))throw new UserIssue("That transition is unavailable for this application.");
          state=next;event="Officer review";
          await c.query("INSERT INTO officer_reviews(application_id,officer_id,recommendation,note) VALUES($1,$2,$3,$4)",[id,u.id,next==="RECOMMENDED"?"APPROVE":next==="REJECTED"?"REJECT":"MANUAL_REVIEW",note]);
        }
      }else{
        if(!editable(state))throw new UserIssue("This application is locked for changes.");
        if(intent==="save"||intent==="submit"){
          const mandatory=intent==="submit";
          const institution=field(form,"institution",120,mandatory),programme=field(form,"programme",100,mandatory),academic=field(form,"academic_reference",60,mandatory),income=field(form,"annual_income",13,mandatory);
          const student=studentId(form,mandatory),phone=mobile(form,mandatory);
          if(income&&!/^\d{1,10}(\.\d{1,2})?$/.test(income))throw new UserIssue("Enter a valid non-negative annual income.");
          if(mandatory){
            if(!a.district)throw new UserIssue("Save your district in the student profile before submitting.");
            if(!(await c.query("SELECT 1 FROM application_documents WHERE application_id=$1 AND removed_at IS NULL LIMIT 1",[id])).rowCount)throw new UserIssue("Upload a synthetic supporting document before submitting.");
            state=state==="DRAFT"?"SUBMITTED":"RESUBMITTED";
          }
          await c.query("UPDATE scholarship_applications SET institution=$2,programme=$3,academic_reference=$4,annual_income=$5,applicant_name=$6,applicant_district=$7,mahasetu_student_id=$8,applicant_mobile=$9 WHERE id=$1",[id,institution,programme,academic,income||null,a.display_name,a.district,student||null,phone||null]);
          event=mandatory?"Application submitted":"Draft details saved";
        }else if(intent==="upload"){
          const file=form.get("document");
          if(!(file instanceof File)||file.size===0||file.size>131072||!file.name.toLowerCase().endsWith(".txt"))throw new UserIssue("Choose a synthetic .txt document up to 128 KB.");
          let content:string;
          try{content=new TextDecoder("utf-8",{fatal:true}).decode(await file.arrayBuffer());}catch{throw new UserIssue("The document must contain UTF-8 text.");}
          if(!content.trim()||/[\u0000-\u0008\u000e-\u001f]/.test(content))throw new UserIssue("The document must contain readable text.");
          const filename=file.name.replace(/[^a-zA-Z0-9._ -]/g,"_").slice(0,100),path=id+"/"+randomUUID()+".txt";
          await object(path,"POST",content);
          await c.query("INSERT INTO application_documents(application_id,object_path,filename,media_type) VALUES($1,$2,$3,'text/plain')",[id,path,filename]);
          event="Document uploaded";note=filename;
        }else if(intent==="remove"){
          const doc=field(form,"document_id",36);
          const r=await c.query("UPDATE application_documents SET removed_at=now() WHERE application_id=$1 AND id=$2 AND removed_at IS NULL RETURNING filename",[id,doc]);
          if(!r.rowCount)throw new UserIssue("Document unavailable.");
          event="Document removed";note=r.rows[0].filename;
        }else throw new UserIssue("Unknown application action.");
      }
      await c.query("UPDATE scholarship_applications SET status=$2,revision=revision+1,updated_at=now() WHERE id=$1",[id,state]);
      await c.query("INSERT INTO application_status_history(application_id,status,actor_id,event,note) VALUES($1,$2,$3,$4,$5)",[id,state,u.id,event,note]);
    });
  }catch(e){go(back,message(e));}
  go(back,"Application updated.");
}
