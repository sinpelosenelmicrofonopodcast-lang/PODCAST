import { googleCatalog } from "@/lib/googleEditorial";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { const data = await googleCatalog(); const id=new URL(request.url).searchParams.get('id'); return Response.json({backend:'google_sheets',publishedOnly:true,news:data.news_items.length,blog:data.blog_posts.length,...(id?{found:data.news_items.some(x=>x.id===id)}:{})}); }
  catch { return Response.json({backend:'google_sheets',error:'Public editorial feed unavailable'}, {status:503}); }
}
