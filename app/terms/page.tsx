import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { buildSeoMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildSeoMetadata({
  title: "Terms of Service | Sin Pelos en el Micrófono",
  description: "Términos de servicio de Sin Pelos en el Micrófono y Sin Pelos Social Manager, incluyendo integraciones sociales.",
  path: "/terms"
});

export default function TermsPage() {
  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container" style={{ maxWidth: 920 }}>
          <div className="card" style={{ display: "grid", gap: 16 }}>
            <div>
              <p className="muted" style={{ margin: 0 }}>B&B Entertainment Hub LLC</p>
              <h1 className="section-title" style={{ marginBottom: 6 }}>Terms of Service / Términos de Servicio</h1>
              <p className="muted" style={{ margin: 0 }}>Effective date / Vigente desde: October 5, 2026</p>
            </div>

            <p>
              Estos Términos de Servicio ("Términos") regulan tu acceso y uso de Sin Pelos en el Micrófono, sus funciones de comunidad y
              Sin Pelos Social Manager (colectivamente, "SPM", el "Servicio"). Al utilizar el Servicio aceptas estos Términos y nuestra
              Política de Privacidad.
            </p>

            <h2>1. Requisito de edad</h2>
            <p>
              Las áreas de SPM sujetas al control de edad están limitadas a personas de 21 años o más. Al acceder a dichas áreas declaras que
              cumples el requisito de edad y que tienes capacidad legal para aceptar estos Términos.
            </p>

            <h2>2. Naturaleza del servicio y contenido</h2>
            <p>
              SPM es una plataforma de podcast, entretenimiento, opinión, noticias, comunidad y herramientas de gestión de contenido. El contenido
              puede incluir lenguaje explícito, opiniones fuertes, humor, temas sensibles o controversiales y material enviado por usuarios.
              Las opiniones pertenecen a quienes las expresan y no constituyen asesoramiento profesional legal, médico, financiero o psicológico.
            </p>

            <h2>3. Cuentas y acceso autorizado</h2>
            <p>
              Eres responsable de la actividad realizada bajo tus credenciales y de mantenerlas seguras. No puedes acceder a cuentas, áreas
              privadas, integraciones o herramientas para las que no tengas autorización. Podemos limitar o suspender acceso para proteger el
              Servicio, cumplir la ley o hacer valer estos Términos.
            </p>

            <h2>4. TikTok and Third-Party Integrations / Integraciones con TikTok y terceros</h2>
            <p>
              Sin Pelos Social Manager puede permitir que usuarios autorizados conecten cuentas de plataformas externas, incluyendo TikTok.
              Cualquier conexión requiere la autorización correspondiente del titular de la cuenta y está sujeta también a los términos, políticas
              y límites técnicos de la plataforma externa.
            </p>
            <p>
              When you connect TikTok, SPM may use TikTok's official APIs to authenticate the account and carry out actions that you request,
              such as uploading eligible original video content and related metadata. You remain responsible for reviewing the content, having
              the rights to use it, complying with TikTok's rules, and completing any action TikTok requires inside its own application.
            </p>
            <p>
              We do not guarantee that any third-party platform will approve, publish, distribute, monetize or keep content available. Third-party
              APIs, scopes, review requirements and availability may change or be interrupted without notice from us.
            </p>

            <h2>5. Tu contenido</h2>
            <p>
              Conservas los derechos que tengas sobre el contenido que envías. Al cargar, publicar o entregar contenido al Servicio nos otorgas
              una licencia limitada, no exclusiva y únicamente en la medida necesaria para almacenar, procesar, mostrar, distribuir o transmitir
              ese contenido según la función que solicitaste.
            </p>
            <p>Declaras que tienes los derechos, permisos y autorizaciones necesarios para utilizar y distribuir el contenido que proporcionas.</p>

            <h2>6. Conducta prohibida</h2>
            <p>No puedes utilizar SPM para:</p>
            <ul>
              <li>Cometer fraude, suplantación, acoso, amenazas o actividades ilegales.</li>
              <li>Publicar contenido que no tengas derecho a utilizar.</li>
              <li>Intentar acceder sin autorización a cuentas, sistemas, datos o credenciales.</li>
              <li>Introducir malware, interferir con la seguridad o abusar de APIs y límites de plataformas.</li>
              <li>Automatizar acciones de manera que viole las reglas de una plataforma conectada.</li>
            </ul>

            <h2>7. Propiedad intelectual de SPM</h2>
            <p>
              Salvo contenido de usuarios o terceros, el nombre, marca, diseño, software, textos, gráficos y demás materiales propios de SPM están
              protegidos por las leyes aplicables. Estos Términos no te transfieren propiedad sobre esos materiales.
            </p>

            <h2>8. Disponibilidad y cambios</h2>
            <p>
              Podemos modificar, actualizar, limitar o retirar funciones del Servicio. No garantizamos disponibilidad ininterrumpida, ausencia de
              errores ni compatibilidad permanente con servicios de terceros.
            </p>

            <h2>9. Exención y limitación de responsabilidad</h2>
            <p>
              Utilizas el Servicio bajo tu propio riesgo. En la máxima medida permitida por la ley, SPM y B&B Entertainment Hub LLC no serán
              responsables por daños indirectos, incidentales, especiales, consecuentes, pérdida de datos, pérdida de ingresos, reputación o
              interrupciones causadas por el uso del Servicio o por plataformas de terceros.
            </p>
            <p>
              Nada en estos Términos pretende excluir responsabilidades que legalmente no puedan ser excluidas o limitadas.
            </p>

            <h2>10. Suspensión o terminación</h2>
            <p>
              Podemos suspender o terminar acceso cuando exista incumplimiento de estos Términos, riesgo de seguridad, uso no autorizado,
              requerimiento legal o necesidad razonable de proteger a SPM, sus usuarios o terceros.
            </p>

            <h2>11. Ley aplicable</h2>
            <p>
              Estos Términos se regirán por las leyes aplicables del Estado de Texas y de los Estados Unidos, sin perjuicio de derechos que no
              puedan ser renunciados bajo la ley aplicable. Las disputas se presentarán ante tribunales con jurisdicción competente en Texas,
              salvo que la ley exija otra cosa.
            </p>

            <h2>12. Cambios a los términos</h2>
            <p>
              Podemos actualizar estos Términos para reflejar cambios del Servicio, integraciones o requisitos legales. La versión vigente estará
              publicada permanentemente en esta URL con su fecha efectiva.
            </p>

            <h2>13. Contacto</h2>
            <p>
              Para preguntas sobre estos Términos o las integraciones de SPM, escribe a{" "}
              <a href="mailto:contacto@sinpelosenelmicrofono.com">contacto@sinpelosenelmicrofono.com</a>.
            </p>

            <hr />
            <p className="muted" style={{ margin: 0 }}>
              Related document / Documento relacionado: <a href="/privacy">Privacy Policy</a>
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
