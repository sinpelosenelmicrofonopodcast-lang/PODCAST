import {permanentRedirect} from 'next/navigation';
export default function FeedPage({searchParams}:{searchParams:{view?:string}}){permanentRedirect(searchParams.view==='audio'?'/rss':'/podcast');}
