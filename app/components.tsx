"use client";
import {useFormStatus} from "react-dom";
export function Submit({children,name,value,busy="Saving…"}:{children:React.ReactNode;name?:string;value?:string;busy?:string}){const {pending}=useFormStatus();return <button disabled={pending} type="submit" name={name} value={value}>{pending?busy:children}</button>;}
