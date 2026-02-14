export default function AdminContentPage() {
  return (
    <main>
      <h1 className="section-title">Post Once, Publish Everywhere</h1>
      <p className="muted">Sube video, imagen, texto o enlace. Ajusta captions por red.</p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: 20 }}>
        <form className="card">
          <label>
            Tipo de contenido
            <select className="select" defaultValue="video">
              <option value="video">Video</option>
              <option value="image">Imagen</option>
              <option value="text">Texto</option>
              <option value="link">Enlace</option>
            </select>
          </label>
          <label>
            Caption general
            <textarea className="textarea" rows={4} placeholder="Mensaje base para todas las redes" />
          </label>
          <label>
            Programar
            <input className="input" type="datetime-local" />
          </label>
          <button className="button" type="button">
            Agendar publicación
          </button>
        </form>
        <div className="card">
          <h3>Adaptación por red</h3>
          <div className="list" style={{ marginTop: 12 }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              TikTok <input type="checkbox" defaultChecked />
            </label>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              YouTube <input type="checkbox" defaultChecked />
            </label>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              Instagram <input type="checkbox" />
            </label>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              Facebook <input type="checkbox" />
            </label>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              X (Twitter) <input type="checkbox" />
            </label>
          </div>
        </div>
      </div>
    </main>
  );
}
