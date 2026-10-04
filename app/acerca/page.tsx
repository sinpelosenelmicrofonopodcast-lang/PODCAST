import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { buildSeoMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildSeoMetadata({
  title: "Conoce a Bito | Sin Pelos en el Micrófono",
  description:
    "Conoce a Bito, co-host de Sin Pelos en el Micrófono: lo bueno, lo malo, lo feo y la diferencia entre el personaje y la persona detrás del micrófono.",
  path: "/acerca"
});

const traitCards = [
  {
    title: "Lo bueno",
    text: "Curioso, trabajador, observador y obsesionado con entender cómo funcionan las cosas. Escucha, pregunta, produce, construye y empuja las conversaciones hacia lugares que muchas entrevistas nunca tocarían."
  },
  {
    title: "Lo malo",
    text: "Es terco. Puede analizar una situación hasta encontrarle siete problemas, incluyendo tres que probablemente no existían. Cuando cree que tiene razón, sacarlo de ahí puede convertirse en otro episodio completo."
  },
  {
    title: "Lo feo",
    text: "Su boca a veces llega primero que su cerebro. Puede ser impulsivo, sarcástico, controversial y absolutamente incapaz de dejar pasar ciertas cosas sin comentarlas."
  }
];

export default function AcercaPage() {
  return (
    <main>
      <Navbar />

      <section className="section">
        <div className="container" style={{ maxWidth: 980 }}>
          <span className="badge">Los personajes de Sin Pelos</span>
          <h1 className="section-title" style={{ marginTop: 14 }}>
            Bito: lo bueno, lo malo y lo feo
          </h1>
          <p className="muted" style={{ fontSize: 18, lineHeight: 1.75, maxWidth: 820 }}>
            Bito es de esos tipos que pueden estar hablando de relaciones, masculinidad, dinero, música o sociedad y,
            cinco minutos después, convertir la conversación más seria del mundo en un vacilón que probablemente no
            debía decirse frente a un micrófono.
          </p>

          <div
            className="grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              marginTop: 28
            }}
          >
            {traitCards.map((item) => (
              <article className="card" key={item.title}>
                <h2 style={{ marginTop: 0 }}>{item.title}</h2>
                <p className="muted" style={{ lineHeight: 1.7, marginBottom: 0 }}>
                  {item.text}
                </p>
              </article>
            ))}
          </div>

          <article className="card" style={{ marginTop: 28, padding: "clamp(22px, 4vw, 40px)" }}>
            <div style={{ display: "grid", gap: 22 }}>
              <section>
                <h2>¿Quién es Bito dentro de Sin Pelos?</h2>
                <p className="muted" style={{ lineHeight: 1.8 }}>
                  Boricua, radicado en Texas y co-host de Sin Pelos en el Micrófono, Bito representa una de las dos caras
                  de una fórmula que lleva años haciendo exactamente lo que promete el nombre del podcast: hablar sin
                  pelos en la lengua.
                </p>
                <p className="muted" style={{ lineHeight: 1.8 }}>
                  Mientras Bebo suele ocupar la silla de la voz principal, Bito funciona como contrapeso, provocador,
                  editor mental, técnico, productor y, cuando hace falta, abogado del diablo. Muchas veces no necesita
                  dominar la conversación. Le basta escuchar veinte minutos, soltar una pregunta incómoda y dejar que
                  todo el episodio se vaya por otro camino.
                </p>
              </section>

              <section>
                <h2>El tipo que cuestiona todo</h2>
                <p className="muted" style={{ lineHeight: 1.8 }}>
                  Bito cuestiona lo que todo el mundo repite. Cuestiona las relaciones modernas, las expectativas entre
                  hombres y mujeres, el ego, la doble moral, el dinero, las redes sociales, la industria musical y hasta
                  las cosas que él mismo dijo hace seis meses.
                </p>
                <p className="muted" style={{ lineHeight: 1.8 }}>
                  Tiene opiniones fuertes. A veces demasiado fuertes. Pero también cambia, aprende, se contradice y,
                  cuando se da cuenta de que habló mierda, existe una posibilidad razonable de que lo admita.
                  Razonable. No garantizada.
                </p>
              </section>

              <section>
                <h2>La obsesión por construir</h2>
                <p className="muted" style={{ lineHeight: 1.8 }}>
                  Bito es el tipo que quiere saber cómo funciona todo. Cámaras, luces, audio, edición, fotografía,
                  tecnología, negocios, contenido, música y diseño. Si algo despierta su curiosidad, probablemente termina
                  metiendo las manos. No le gusta quedarse solamente con la idea. Quiere construirla. Y si la va a
                  construir, quiere hacerla completa.
                </p>
                <p className="muted" style={{ lineHeight: 1.8 }}>
                  Eso tiene una parte admirable y otra bastante jodida, porque Bito puede convertir una idea sencilla en
                  una operación militar. Lo que empezó con “vamos a hacer un podcast” termina con cámaras, iluminación,
                  sistemas, automatizaciones, páginas, thumbnails, reels, bases de datos y probablemente algún aparato
                  que nadie pidió pero que, según él, “nos hacía falta”.
                </p>
              </section>

              <section>
                <h2>El humor, el fuete y las conversaciones reales</h2>
                <p className="muted" style={{ lineHeight: 1.8 }}>
                  En Sin Pelos, Bito encontró un lugar donde una personalidad que posiblemente sería problemática en una
                  reunión corporativa se convierte en parte del entretenimiento. Su humor es negro, sarcástico,
                  exagerado, callejero y muy boricua. Puede burlarse de alguien, de una situación, de Bebo y, sobre todo,
                  de sí mismo.
                </p>
                <p className="muted" style={{ lineHeight: 1.8 }}>
                  Pero detrás del fuete existe curiosidad genuina por las personas. Le interesan las historias: cómo
                  alguien llegó donde está, qué perdió, qué sacrificó y por qué piensa como piensa. Por eso algunas de las
                  mejores conversaciones aparecen cuando el episodio deja de sentirse como una entrevista y empieza a
                  parecer una conversación entre gente que olvidó que había cámaras grabando.
                </p>
              </section>

              <section>
                <h2>No vino a caerle bien a todo el mundo</h2>
                <p className="muted" style={{ lineHeight: 1.8 }}>
                  Bito parece sospechar de cualquier opinión diseñada específicamente para no molestar a nadie. Cree que
                  muchas conversaciones importantes se han vuelto imposibles porque la gente escucha buscando razones
                  para ofenderse en lugar de entender lo que la otra persona intenta decir.
                </p>
                <p className="muted" style={{ lineHeight: 1.8 }}>
                  El problema es que tampoco siempre facilita la misión. Donde otra persona diría “no estoy completamente
                  de acuerdo”, Bito probablemente diría: “¿Pero qué carajo tú estás hablando?”. Y después empieza el
                  debate.
                </p>
              </section>

              <section>
                <h2>Las contradicciones también son parte del personaje</h2>
                <p className="muted" style={{ lineHeight: 1.8 }}>
                  Habla de responsabilidad personal, pero se ríe de sus propias metidas de pata. Habla de hombres,
                  relaciones y disciplina mientras reconoce que ninguno de nosotros tiene la vida completamente resuelta.
                  Critica la necesidad de aparentar en redes mientras participa en una industria construida alrededor de
                  cámaras y contenido. Puede ser extremadamente serio con el trabajo y completamente ridículo cinco
                  minutos después.
                </p>
                <p className="muted" style={{ lineHeight: 1.8 }}>
                  Bito no pretende representar al hombre perfecto. Representa al tipo que está tratando de entender el
                  mundo mientras lo comenta en voz alta: el que observa, el que pregunta, el que jode, el que produce
                  detrás de las cámaras y después se sienta frente a ellas.
                </p>
              </section>
            </div>
          </article>

          <aside
            className="card"
            style={{
              marginTop: 28,
              borderColor: "rgba(255, 204, 51, 0.45)",
              background:
                "linear-gradient(135deg, rgba(255, 59, 59, 0.08), rgba(255, 204, 51, 0.08)), var(--panel)"
            }}
          >
            <span className="badge">La advertencia importante</span>
            <h2 style={{ marginBottom: 10 }}>Bito es un personaje.</h2>
            <p className="muted" style={{ fontSize: 18, lineHeight: 1.8, marginBottom: 0 }}>
              El Bito de Sin Pelos es la versión que ustedes ven cuando se prende la cámara, se abre el micrófono y
              empieza el vacilón. El Bito real puede ser mejor. Puede ser peor. Quién sabe. Y quizás sea mejor dejarlo
              así.
            </p>
          </aside>

          <section className="card" style={{ marginTop: 28 }}>
            <span className="badge">El otro lado de la mesa</span>
            <h2 style={{ marginBottom: 8 }}>Bebo</h2>
            <p className="muted" style={{ marginBottom: 0, lineHeight: 1.7 }}>
              Su perfil viene después. Esta sección crecerá para que la gente conozca a los dos personajes detrás de Sin
              Pelos en el Micrófono antes de sacar conclusiones por un clip de treinta segundos.
            </p>
          </section>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 28 }}>
            <a className="button" href="/podcast">
              Ver episodios
            </a>
            <a className="button secondary" href="/blog">
              Desde el Micrófono
            </a>
            <a className="button secondary" href="/contacto">
              Contacto
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
