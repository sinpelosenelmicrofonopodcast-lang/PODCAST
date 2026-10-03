import {podcastPlatforms} from '@/lib/podcastPlatforms';
export function ListenLinks(){return <nav className="podcast-listen-links" aria-label="Escucha el podcast en tu plataforma"><span>Escúchanos en</span><div>{podcastPlatforms.map(p=><a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer">{p.name}</a>)}</div></nav>;}
