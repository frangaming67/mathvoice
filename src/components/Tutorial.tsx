import { tutorialSteps } from '../features/tutorial/steps';

/**
 * Panel del recorrido «Primeros pasos»: qué hacer ahora y botones para escucharlo otra vez,
 * saltar el paso o terminar. Cada paso avanza solo cuando se hace la acción.
 */
export function Tutorial({
  step,
  repeat,
  skip,
  finish,
}: {
  step: number;
  repeat: () => void;
  skip: () => void;
  finish: () => void;
}) {
  const current = tutorialSteps[step];
  const last = step === tutorialSteps.length - 1;
  return (
    <section className="panel tutorial" aria-labelledby="tutorial-title">
      <h2 id="tutorial-title">
        Primeros pasos, paso {step + 1} de {tutorialSteps.length}: {current.title}
      </h2>
      <p>{current.text}</p>
      <div className="actions">
        <button type="button" onClick={repeat}>
          Escuchar de nuevo
        </button>
        {!last && (
          <button type="button" onClick={skip}>
            Saltar este paso
          </button>
        )}
        <button type="button" className={last ? 'primary' : undefined} onClick={finish}>
          Terminar recorrido
        </button>
      </div>
    </section>
  );
}
