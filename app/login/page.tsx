import {SignIn} from "../signin";export default async function Login({searchParams}:{searchParams:Promise<{notice?:string}>}){return <SignIn register={false} notice={(await searchParams).notice}/>;}
