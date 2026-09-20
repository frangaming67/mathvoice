import type { CalculationStep } from '../types';
import { mathSpeech } from '../accessibility/MathSpeechFormatter';

function stepSpeech(step: CalculationStep, index: number) {
  return `Paso ${index + 1}. ${step.title}. ${step.detail}${step.formula ? ` ${mathSpeech(step.formula)}` : ''}`;
}

export function CalculationSteps({
  steps,
  speak,
}: {
  steps?: CalculationStep[];
  speak: (text: string) => void;
}) {
  if (!steps?.length) return null;
  return (
    <details className="calculation-steps">
      <summary>Procedimiento paso a paso ({steps.length} pasos)</summary>
      <p>
        Estos pasos muestran las operaciones y comprobaciones disponibles. Las restricciones de
        dominio de la expresión original siguen vigentes.
      </p>
      <button onClick={() => speak(steps.map(stepSpeech).join(' '))}>
        Escuchar todos los pasos
      </button>
      <ol>
        {steps.map((step, index) => (
          <li key={index}>
            <p data-speech={stepSpeech(step, index)}>
              <strong>{step.title}.</strong> {step.detail}
            </p>
            {step.formula && (
              <p className="step-formula" data-speech={mathSpeech(step.formula)}>
                {step.formula}
              </p>
            )}
            <button
              onClick={() => speak(stepSpeech(step, index))}
              aria-label={`Escuchar paso ${index + 1}: ${step.title}`}
            >
              Escuchar paso {index + 1}
            </button>
          </li>
        ))}
      </ol>
    </details>
  );
}
