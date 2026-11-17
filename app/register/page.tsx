import {SignIn} from "../signin";export default async function Register({searchParams}:{searchParams:Promise<{notice?:string}>}){return <SignIn register notice={(await searchParams).notice}/>;}
