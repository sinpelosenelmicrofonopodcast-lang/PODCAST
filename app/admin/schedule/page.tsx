export default function AdminSchedulePage() {
  return (
    <main>
      <h1 className="section-title">Programación de Posts</h1>
      <p className="muted">Vista cronológica de publicaciones programadas.</p>
      <div className="card" style={{ marginTop: 20 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Contenido</th>
              <th>Redes</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>2026-02-08 20:00</td>
              <td>Episodio: narrativa y control</td>
              <td>TikTok · YouTube · X</td>
              <td>Programado</td>
            </tr>
            <tr>
              <td>2026-02-09 12:00</td>
              <td>Clip: no dependas del algoritmo</td>
              <td>Instagram · Facebook</td>
              <td>Programado</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}
