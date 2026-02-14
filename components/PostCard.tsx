export type PostCardProps = {
  title: string;
  excerpt: string;
  platform?: string;
  href?: string;
  stats?: string;
};

export function PostCard({ title, excerpt, platform, href, stats }: PostCardProps) {
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        {platform ? <span className="badge">{platform}</span> : null}
      </div>
      <p className="muted" style={{ marginTop: 12 }}>
        {excerpt}
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
        <span className="muted" style={{ fontSize: 12 }}>
          {stats}
        </span>
        {href ? (
          <a className="button secondary" href={href}>
            Ver
          </a>
        ) : null}
      </div>
    </div>
  );
}
