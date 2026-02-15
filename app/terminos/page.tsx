import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function TerminosPage() {
  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container" style={{ maxWidth: 900 }}>
          <div className="card" style={{ display: "grid", gap: 14 }}>
            <h1 className="section-title" style={{ margin: 0 }}>
              SIN PELOS EN EL MICRÓFONO
            </h1>
            <h2 style={{ margin: 0 }}>ACUERDO DE USUARIO Y EXENCIÓN DE RESPONSABILIDAD</h2>
            <p className="muted" style={{ margin: 0 }}>
              Última actualización: 15 de febrero de 2026
            </p>

            <h3>1. REQUISITO DE EDAD (21+)</h3>
            <p>
              El acceso y registro en SPM está estrictamente limitado a personas mayores de veintiún (21) años de edad.
              Al crear una cuenta, el usuario declara y garantiza que:
            </p>
            <ul>
              <li>Tiene al menos 21 años cumplidos.</li>
              <li>Posee capacidad legal para aceptar este acuerdo.</li>
              <li>No se encuentra bajo ninguna restricción legal que le impida acceder a este tipo de contenido.</li>
            </ul>
            <p>SPM se reserva el derecho de suspender o eliminar cualquier cuenta que incumpla este requisito sin previo aviso.</p>

            <h3>2. NATURALEZA DEL CONTENIDO</h3>
            <p>SPM es una plataforma de opinión, debate y entretenimiento. El contenido puede incluir:</p>
            <ul>
              <li>Lenguaje explícito o soez.</li>
              <li>Opiniones fuertes.</li>
              <li>Temas sensibles o controversiales.</li>
              <li>Humor satírico o sarcasmo.</li>
              <li>Debate político, social, cultural o religioso.</li>
            </ul>
            <p>
              El usuario reconoce que el contenido es de carácter expresivo y opinativo, no constituye asesoramiento profesional
              (legal, médico o psicológico) y puede resultar ofensivo para ciertas personas.
            </p>

            <h3>3. EXENCIÓN TOTAL DE RESPONSABILIDAD POR OFENSA</h3>
            <p>El usuario acepta expresamente que accede voluntariamente al contenido y que puede sentirse ofendido.</p>
            <p>
              SPM, sus fundadores, anfitriones, colaboradores, afiliados, productores y cualquier entidad relacionada NO serán
              responsables bajo ninguna circunstancia por ofensa percibida, daño emocional, reacciones subjetivas, interpretaciones
              personales o discrepancias ideológicas.
            </p>
            <p>El consumo del contenido es voluntario y bajo responsabilidad exclusiva del usuario.</p>

            <h3>4. LIBERTAD DE EXPRESIÓN</h3>
            <p>
              SPM opera bajo principios de libertad de expresión protegidos por leyes aplicables, incluyendo la Primera Enmienda
              de la Constitución de los Estados Unidos y principios internacionales aplicables.
            </p>
            <p>Las opiniones expresadas representan exclusivamente a quien las emite y no declaraciones de hecho absoluto.</p>

            <h3>5. RESPONSABILIDAD DEL USUARIO</h3>
            <ul>
              <li>Es responsable de su reacción al contenido.</li>
              <li>No utilizará la plataforma para acoso, amenazas o actividades ilegales.</li>
              <li>No intentará responsabilizar a SPM por daños indirectos, emocionales o reputacionales.</li>
            </ul>

            <h3>6. LIMITACIÓN DE RESPONSABILIDAD</h3>
            <p>En la máxima medida permitida por la ley aplicable, SPM no será responsable por:</p>
            <ul>
              <li>Daños directos, indirectos, incidentales o consecuentes.</li>
              <li>Pérdida de datos.</li>
              <li>Pérdida de reputación.</li>
              <li>Pérdidas financieras derivadas del uso del contenido.</li>
            </ul>

            <h3>7. JURISDICCIÓN Y LEY APLICABLE</h3>
            <p>
              Este acuerdo se regirá por las leyes del Estado de Texas, Estados Unidos, sin considerar conflictos de leyes
              internacionales. Cualquier disputa será resuelta exclusivamente en tribunales competentes del Estado de Texas.
            </p>

            <h3>8. ACEPTACIÓN</h3>
            <p>Al registrarte, confirmas que:</p>
            <ul>
              <li>Tienes 21 años o más.</li>
              <li>Entiendes la naturaleza del contenido.</li>
              <li>Aceptas que puedes sentirte ofendido.</li>
              <li>Renuncias a reclamar responsabilidad por dicha ofensa.</li>
            </ul>
            <p>Si no estás de acuerdo con estos términos, debes abandonar la plataforma inmediatamente.</p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}

