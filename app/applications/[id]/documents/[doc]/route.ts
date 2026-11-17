import {identity} from "../../../../../lib/session";import {db} from "../../../../../lib/db";import {application} from "../../../../../lib/applications";import {object} from "../../../../../lib/storage";
export async function GET(_request:Request,{params}:{params:Promise<{id:string;doc:string}>}){
 const u=await identity();if(!u)return new Response("Sign in required",{status:401});
 const {id,doc}=await params;
 if(!/^[a-f0-9-]{36}$/i.test(doc)||!await application(db(),id,u))return new Response("Document unavailable",{status:404});
 const row=(await db().query("SELECT object_path,filename FROM application_documents WHERE application_id=$1 AND id::text=$2 AND removed_at IS NULL",[id,doc])).rows[0];
 if(!row)return new Response("Document unavailable",{status:404});
 try{const data=await object(row.object_path,"GET");
 return new Response(data.body,{headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox; default-src 'none'","Content-Disposition":"inline"}});}
 catch{return new Response("Document storage unavailable",{status:503});}
}
