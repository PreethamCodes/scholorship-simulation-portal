import type {Pool,PoolClient} from "pg";
export class UserIssue extends Error {}
export const states=["DRAFT","SUBMITTED","UNDER_REVIEW","ADDITIONAL_INFORMATION_REQUIRED","RESUBMITTED","RECOMMENDED","REJECTED"] as const;
export const reviewNext:Record<string,string[]>={SUBMITTED:["UNDER_REVIEW"],RESUBMITTED:["UNDER_REVIEW"],UNDER_REVIEW:["ADDITIONAL_INFORMATION_REQUIRED","RECOMMENDED","REJECTED"]};
export const editable=(status:string)=>status==="DRAFT"||status==="ADDITIONAL_INFORMATION_REQUIRED";
export const label=(state:string)=>({ADDITIONAL_INFORMATION_REQUIRED:"Correction requested",AWAITING_EXTERNAL_VERIFICATION:"Awaiting external verification",NOT_REQUESTED:"Not requested"}[state]??(state.charAt(0)+state.slice(1).toLowerCase().replaceAll("_"," ")));
export function field(form:FormData,key:string,max:number,mandatory=true) {
  const v=form.get(key);
  if(typeof v!=="string" || v.trim().length>max || (mandatory && !v.trim()))throw new UserIssue("Check the "+key.replaceAll("_"," ")+" field.");
  return v.trim();
}
/** Returns the normalized MahaSetu student ID, or "" when optional and blank. */
export function studentId(form:FormData,mandatory:boolean) {
  const v=String(form.get("mahasetu_student_id")??"").trim().toUpperCase();
  if(!v&&!mandatory)return "";
  if(!/^MHSTU[0-9]{4}$/.test(v))throw new UserIssue("Enter your MahaSetu student ID in the format MHSTU0001.");
  return v;
}
/** Returns a 10-digit mobile number (an optional +91 or 0 prefix and spaces are accepted). */
export function mobile(form:FormData,mandatory:boolean) {
  const v=String(form.get("applicant_mobile")??"").replace(/[\s-]/g,"").replace(/^(\+91|0)/,"");
  if(!v&&!mandatory)return "";
  if(!/^[6-9][0-9]{9}$/.test(v))throw new UserIssue("Enter a 10-digit mobile number that starts with 6, 7, 8 or 9.");
  return v;
}
export const maskMobile=(value?:string|null)=>value?value.slice(0,2)+"•••••"+value.slice(-3):"Not provided";
export async function application(c:Pool|PoolClient,id:string,u:{id:string;officer:boolean},lock=false) {
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return null;
  const q=await c.query(`SELECT a.*,p.display_name,s.district,s.user_id FROM scholarship_applications a
    JOIN student_profiles s USING(student_ref) JOIN profiles p ON p.id=s.user_id
    WHERE a.id=$1 AND (($2::boolean AND a.status<>'DRAFT') OR (NOT $2 AND s.user_id=$3))
    ${lock?"FOR UPDATE OF a":""}`,[id,u.officer,u.id]);
  return q.rows[0]??null;
}
