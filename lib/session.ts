import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { randomUUID } from "node:crypto";
import { db,transaction } from "./db";

export const cookieName="ms_scholarship";
export async function auth(path:string, init:RequestInit={}, token?:string) {
  const key=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!key || !process.env.SUPABASE_URL) throw new Error("Identity service unavailable");
  return fetch(process.env.SUPABASE_URL+"/auth/v1/"+path,{...init,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(6500),
    headers:{apikey:key,"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})}});
}
export const identity=cache(async()=>{
  const token=(await cookies()).get(cookieName)?.value;
  if(!token)return null;
  const r=await auth("user",{},token);
  if([401,403].includes(r.status))return null;
  if(!r.ok)throw new Error("Identity service unavailable");
  const u=await r.json();
  if(!/^[0-9a-f-]{36}$/i.test(u.id)||typeof u.email!=="string")return null;
  const officer=(await db().query("SELECT 1 FROM officer_accounts WHERE user_id=$1",[u.id])).rowCount===1;
  return {id:u.id as string,email:u.email as string,officer};
});
export async function required(officer=false) {
  const u=await identity();
  if(!u)redirect("/login");
  if(officer && !u.officer)redirect("/student?notice=Student+accounts+cannot+open+the+officer+desk.");
  return u;
}
export async function provision(id:string,name:string,officer:boolean) {
  await transaction(async c=>{
    await c.query("INSERT INTO profiles(id,display_name) VALUES($1,$2) ON CONFLICT DO NOTHING",[id,name.slice(0,80)]);
    if(!officer) await c.query("INSERT INTO student_profiles(student_ref,user_id,academic_year) VALUES ($1,$2,$3) ON CONFLICT(user_id) DO NOTHING",["DEMO-"+randomUUID(),id,new Date().getUTCFullYear()]);
  });
}
