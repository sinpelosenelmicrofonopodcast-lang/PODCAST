import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { buildSeoMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildSeoMetadata({
  title: "Privacy Policy | Sin Pelos en el Micrófono",
  description: "Política de privacidad de Sin Pelos en el Micrófono y Sin Pelos Social Manager, incluyendo integraciones con TikTok.",
  path: "/privacy"
});

export default function PrivacyPage() {
  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container" style={{ maxWidth: 920 }}>
          <div className="card" style={{ display: "grid", gap: 16 }}>
            <div>
              <p className="muted" style={{ margin: 0 }}>B&B Entertainment Hub LLC</p>
              <h1 className="section-title" style={{ marginBottom: 6 }}>Privacy Policy / Política de Privacidad</h1>
              <p className="muted" style={{ margin: 0 }}>Effective date / Vigente desde: October 5, 2026</p>
            </div>

            <p>
              Esta Política de Privacidad explica cómo Sin Pelos en el Micrófono y Sin Pelos Social Manager ("SPM", "nosotros")
              recopilan, usan, almacenan y comparten información cuando visitas nuestro sitio web, utilizas funciones de comunidad o
              conectas servicios de terceros. This Privacy Policy also describes how we handle data used by our TikTok integration.
            </p>

            <h2>1. Información que podemos recopilar</h2>
            <p>Dependiendo de las funciones que utilices, podemos recopilar:</p>
            <ul>
              <li>Información que envías voluntariamente, como nombre, correo electrónico, mensajes, formularios, comentarios o contenido.</li>
              <li>Información de cuenta y autenticación necesaria para operar áreas registradas o privadas.</li>
              <li>Datos técnicos y de uso, como páginas visitadas, tipo de dispositivo, navegador, dirección IP aproximada, registros de errores y actividad de sesión.</li>
              <li>Preferencias almacenadas mediante cookies, almacenamiento local u otras tecnologías similares.</li>
              <li>Datos de notificaciones push cuando decides habilitarlas.</li>
              <li>Información recibida de plataformas de terceros únicamente cuando autorizas expresamente una integración.</li>
            </ul>

            <h2>2. TikTok Integration / Integración con TikTok</h2>
            <p>
              Sin Pelos Social Manager permite a usuarios autorizados conectar una cuenta de TikTok mediante los mecanismos oficiales de
              autorización de TikTok. Cuando autorizas la conexión, podemos recibir la información permitida por los permisos que apruebes,
              incluyendo información básica de la cuenta, identificadores de TikTok, tokens de autorización y datos necesarios para completar
              la acción solicitada.
            </p>
            <p>
              For TikTok Content Posting features, SPM may process original video files or video URLs, captions, basic content metadata and
              upload or publishing status. We use TikTok data only to authenticate the authorized account, perform user-requested TikTok
              actions, display relevant connection or upload status, maintain security, and troubleshoot the integration.
            </p>
            <p>
              SPM does not sell TikTok user data. We do not use TikTok data for unrelated advertising, profiling, or surveillance. A TikTok
              upload is initiated by an authorized user; connecting TikTok does not grant SPM permission to publish arbitrary content without
              user direction.
            </p>

            <h2>3. Cómo utilizamos la información</h2>
            <ul>
              <li>Operar, mantener, proteger y mejorar el website y Sin Pelos Social Manager.</li>
              <li>Autenticar usuarios y conexiones autorizadas con plataformas sociales.</li>
              <li>Procesar acciones solicitadas, incluyendo preparar o enviar contenido a plataformas conectadas.</li>
              <li>Responder a consultas, soporte, colaboraciones y solicitudes editoriales.</li>
              <li>Prevenir abuso, fraude, acceso no autorizado y problemas de seguridad.</li>
              <li>Medir rendimiento y uso del sitio de forma razonable.</li>
              <li>Cumplir obligaciones legales y hacer valer nuestros términos.</li>
            </ul>

            <h2>4. Cómo compartimos información</h2>
            <p>
              Podemos compartir información con proveedores que nos ayudan a alojar, almacenar, autenticar, analizar, enviar notificaciones o
              ejecutar funciones del servicio; con plataformas sociales cuando tú solicitas una acción hacia esa plataforma; o cuando sea
              requerido por ley, seguridad o para proteger derechos. No vendemos información personal.
            </p>

            <h2>5. Proveedores y servicios de terceros</h2>
            <p>
              Nuestro servicio puede depender de proveedores de infraestructura, base de datos, almacenamiento, analítica, notificaciones y
              plataformas sociales. El uso que hagas de servicios de terceros también está sujeto a sus propios términos y políticas de privacidad.
              Para TikTok, el acceso se realiza mediante las herramientas y APIs oficiales autorizadas por TikTok.
            </p>

            <h2>6. Cookies y almacenamiento local</h2>
            <p>
              Podemos usar cookies y almacenamiento local para recordar preferencias, mantener sesiones, registrar aceptación de términos,
              proteger el servicio y mejorar la experiencia. Puedes controlar ciertas tecnologías desde tu navegador, aunque deshabilitarlas
              puede afectar algunas funciones.
            </p>

            <h2>7. Retención de datos</h2>
            <p>
              Conservamos la información solo durante el tiempo razonablemente necesario para prestar el servicio, cumplir la finalidad para la
              que fue recopilada, resolver disputas, mantener seguridad o cumplir obligaciones legales. Los periodos pueden variar según el tipo
              de dato y la función utilizada.
            </p>

            <h2>8. Seguridad</h2>
            <p>
              Aplicamos medidas técnicas y organizativas razonables para proteger la información. Ningún sistema conectado a Internet puede
              garantizar seguridad absoluta, por lo que no podemos prometer que todo riesgo será eliminado.
            </p>

            <h2>9. Tus opciones y derechos</h2>
            <p>
              Puedes dejar de usar el servicio, desactivar notificaciones, revocar permisos de plataformas conectadas y solicitar acceso,
              corrección o eliminación de información personal cuando corresponda. Para desconectar TikTok, puedes revocar el acceso desde los
              controles de tu cuenta de TikTok y también contactarnos para solicitar la eliminación de datos asociados que controlemos.
            </p>

            <h2>10. Contenido público</h2>
            <p>
              La información o contenido que decidas publicar en áreas públicas puede ser visible para otras personas. Evita publicar información
              personal que no quieras hacer pública.
            </p>

            <h2>11. Menores</h2>
            <p>
              Las áreas de SPM sujetas al requisito de edad están destinadas a adultos y actualmente requieren confirmación de 21 años o más.
              No recopilamos intencionalmente información personal de menores mediante esas áreas.
            </p>

            <h2>12. Cambios a esta política</h2>
            <p>
              Podemos actualizar esta Política de Privacidad cuando cambien nuestras funciones, integraciones o requisitos legales. Publicaremos
              la versión vigente en esta URL e indicaremos la fecha efectiva correspondiente.
            </p>

            <h2>13. Contacto</h2>
            <p>
              Para preguntas sobre privacidad, datos o integraciones de plataformas, escribe a{" "}
              <a href="mailto:contacto@sinpelosenelmicrofono.com">contacto@sinpelosenelmicrofono.com</a>.
            </p>

            <hr />
            <p className="muted" style={{ margin: 0 }}>
              Related document / Documento relacionado: <a href="/terms">Terms of Service</a>
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
