import Link from "next/link";
import "./style.css";
import {identity} from "../lib/session";
import {logout} from "./actions";
export const metadata={title:"Post-Matric Scholarships | MahaSetu",description:"Synthetic student scholarship service"};
export const dynamic="force-dynamic";
export default async function Layout({children}:{children:React.ReactNode}) {
 const u=await identity();
 return <html lang="en"><body><header><nav className="wrap"><Link className="brand" href="/"><b aria-hidden="true">M</b><span>MahaSetu<small>Scholarship services</small></span></Link><div className="navlinks"><Link href="/demo-guide">Demo guide</Link>{u?<><Link href={u.officer?"/officer":"/student"}>{u.officer?"Officer desk":"Student desk"}</Link><form action={logout}><button className="link">Sign out</button></form></>:<Link href="/login">Sign in</Link>}</div></nav></header><main className="wrap">{children}</main><footer className="wrap">MahaSetu · Post-Matric Scholarship demonstration <span>Synthetic data only</span></footer></body></html>;
}
