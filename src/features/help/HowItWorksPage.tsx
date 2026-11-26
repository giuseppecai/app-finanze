import { PageHeader } from '../../components/PageHeader';
import { TopBar } from '../../components/TopBar';
import { it } from '../../i18n/it';

/** Come funziona: il metodo in 5 righe e il glossario dei nomi (02-regole-e-calcoli.md § Nomi). */
export function HowItWorksPage() {
  return (
    <div className="flow">
      <TopBar />
      <PageHeader full title={it.insights.howTitle} />
      <ol className="card how-steps">
        {it.insights.howSteps.map((step, i) => (
          <li key={i}>
            <span className="how-steps__n" aria-hidden="true">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <section className="sec" aria-labelledby="glossary-title">
        <div className="sec-head">
          <h2 id="glossary-title">{it.insights.glossaryTitle}</h2>
        </div>
        <dl className="card glossary">
          {it.insights.glossary.map(([term, text]) => (
            <div key={term} className="glossary__item">
              <dt>{term}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
