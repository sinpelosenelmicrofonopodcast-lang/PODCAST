export default function AdminUsersPage() {
  return (
    <main>
      <h1 className="section-title">Usuarios & Roles</h1>
      <p className="muted">Control de membresías, roles y status.</p>
      <div className="card" style={{ marginTop: 20 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Membresía</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>og_sinpelos</td>
              <td>Admin</td>
              <td>Paid</td>
              <td>Activo</td>
            </tr>
            <tr>
              <td>pensador77</td>
              <td>Editor</td>
              <td>Free</td>
              <td>Activo</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}
