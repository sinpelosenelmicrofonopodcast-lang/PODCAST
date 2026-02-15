export function ProblemTrio({
  what,
  why,
  who
}: {
  what: string;
  why: string;
  who: string;
}) {
  return (
    <section className="problem-trio" aria-label="Problema claro">
      <div className="problem-card">
        <div className="problem-kicker">Qué está pasando</div>
        <div className="problem-text">{what}</div>
      </div>
      <div className="problem-card">
        <div className="problem-kicker">Por qué importa</div>
        <div className="problem-text">{why}</div>
      </div>
      <div className="problem-card">
        <div className="problem-kicker">A quién afecta</div>
        <div className="problem-text">{who}</div>
      </div>
    </section>
  );
}
