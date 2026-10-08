import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { UnsubscribeConfirm } from "@/components/newsletter/UnsubscribeConfirm";
export const metadata:Metadata={title:"Cancelar suscripción | Sin Pelos",robots:{index:false,follow:false}};
export default function NewsletterUnsubscribe({searchParams}:{searchParams:{token?:string}}){return <main><Navbar/><section className="section"><div className="container" style={{maxWidth:700}}><div className="card" style={{padding:28}}><p className="page-kicker">NEWSLETTER</p><h1>Darse de baja</h1><UnsubscribeConfirm token={String(searchParams.token??"")}/></div></div></section><Footer/></main>}