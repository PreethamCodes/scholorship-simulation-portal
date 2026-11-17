import Link from "next/link";
import {redirect} from "next/navigation";
import {required} from "../../lib/session";
import {db} from "../../lib/db";
import {label} from "../../lib/applications";
import {createApplication,profile} from "../actions";
import {Submit} from "../components";
export default async function Student({searchParams}:{searchParams:Promise<{notice?:string}>}){
 const u=await required();if(u.officer)redirect("/officer");
 const info=(await db().query("SELECT p.display_name,s.district FROM profiles p JOIN student_profiles s ON s.user_id=p.id WHERE p.id=$1",[u.id])).rows[0];
 const rows=(await db().query("SELECT a.* FROM scholarship_applications a JOIN student_profiles s USING(student_ref) WHERE s.user_id=$1 ORDER BY updated_at DESC",[u.id])).rows;
 const year=new Date().getUTCFullYear(),notice=(await searchParams).notice;
 return <><p className="eyebrow">Student desk</p><h1>My scholarships</h1><p className="lead">Welcome, {info.display_name}.</p>{notice&&<p role="status" className="notice">{notice}</p>}<div className="grid"><section className="panel"><h2>My applications</h2>{rows.length?rows.map(r=><Link className="entry" href={"/applications/"+r.id} key={r.id}><strong>Post-Matric · {r.application_year}</strong><span className="status">{label(r.status)}</span></Link>):<p>No applications yet. Choose an academic year to begin.</p>}<form className="stack" action={createApplication}><label>Academic year<select name="year" defaultValue={year}>{[year-1,year,year+1].map(y=><option key={y}>{y}</option>)}</select></label><Submit>Create application</Submit></form></section><section className="panel"><h2>Student profile</h2><p>{u.email}</p><form className="stack" action={profile}><label>Student name<input name="name" defaultValue={info.display_name} maxLength={80} required/></label><label>District<input name="district" defaultValue={info.district} maxLength={80} required/></label><Submit>Save profile</Submit></form></section></div></>;}
