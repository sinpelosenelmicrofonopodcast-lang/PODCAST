export default function AdminReportsPage() {
  return (
    <main>
      <h1 className="section-title">Reportes Internos</h1>
      <p className="muted">Moderación legal: doxxing, amenazas, acoso repetitivo.</p>
      <div className="card" style={{ marginTop: 20 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Contenido</th>
              <th>Razón</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Thread: "Censura suave"</td>
              <td>Doxxing potencial</td>
              <td>En revisión</td>
            </tr>
            <tr>
              <td>Confesión #88</td>
              <td>Lenguaje extremo</td>
              <td>Archivado</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}
