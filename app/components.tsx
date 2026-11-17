"use client";
import {useFormStatus} from "react-dom";
export function Submit({children,name,value}:{children:React.ReactNode;name?:string;value?:string}){const {pending}=useFormStatus();return <button disabled={pending} type="submit" name={name} value={value}>{pending?"Saving…":children}</button>;}
