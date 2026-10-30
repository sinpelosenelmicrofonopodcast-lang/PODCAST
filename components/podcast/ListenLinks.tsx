import { podcastPlatforms } from "@/lib/podcastPlatforms";

export function ListenLinks() {
  return (
    <nav className="podcast-listen-links" aria-label="Escucha el podcast en tu plataforma">
      <span>Escúchanos en</span>
      <div>
        {podcastPlatforms.map((platform) => (
          <a key={platform.name} href={platform.url} target="_blank" rel="noopener noreferrer">
            {platform.name === "Spotify" ? (
              <img className="spm-spotify-mark" src="/brand/spotify.png" alt="" width={24} height={24} loading="lazy" />
            ) : null}
            <span>{platform.name}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
