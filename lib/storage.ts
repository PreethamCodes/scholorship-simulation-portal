import { UserIssue } from "./applications";
export async function object(path:string,method:"POST"|"GET",body?:string) {
  const key=process.env.SCHOLARSHIP_STORAGE_KEY;
  if(!key||!process.env.SUPABASE_URL)throw new Error("Storage unavailable");
  const url=process.env.SUPABASE_URL+"/storage/v1/object/scholarship-documents/"+path.split("/").map(encodeURIComponent).join("/");
  const res=await fetch(url,{method,body,headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"text/plain;charset=UTF-8"},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(7000)});
  if(!res.ok)throw new UserIssue("Private document storage is unavailable. Please try again.");
  return res;
}
