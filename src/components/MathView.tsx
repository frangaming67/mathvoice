import { useMemo } from 'react';
import { toMathML } from '../accessibility/mathml';
import type { DecimalSeparator, ScreenReaderMath } from '../types';

/**
 * Matemática a la vez visible y accesible. Con «mathml», el lector recibe MathML (NVDA con
 * MathCAT, JAWS y VoiceOver lo leen, lo recorren y lo pasan a braille) y la sintaxis lineal
 * queda solo a la vista para copiarla. Con «texto», el lector recibe la lectura en español.
 */
export function MathView({
  text,
  spoken,
  srMath,
  decimalSeparator,
  approximate = false,
  className,
  syntaxClassName,
}: {
  text: string;
  spoken: string;
  srMath: ScreenReaderMath;
  decimalSeparator?: DecimalSeparator;
  approximate?: boolean;
  className?: string;
  syntaxClassName?: string;
}) {
  const mathml = useMemo(
    () => toMathML(text, { decimalSeparator, alttext: spoken, display: 'inline' }),
    [text, decimalSeparator, spoken],
  );
  const exposeMath = !!mathml && srMath === 'mathml';
  return (
    <div className={className}>
      {mathml && (
        <span className="math-render">
          {approximate && (
            <>
              <span aria-hidden="true">≈ </span>
              {exposeMath && <span className="sr-only">aproximadamente </span>}
            </>
          )}
          <span
            className="math-element"
            aria-hidden={exposeMath ? undefined : true}
            dangerouslySetInnerHTML={{ __html: mathml }}
          />
        </span>
      )}
      {!mathml && approximate && (
        <>
          <span aria-hidden="true">≈ </span>
          <span className="sr-only">aproximadamente </span>
        </>
      )}
      <code
        className={syntaxClassName}
        aria-hidden={exposeMath || srMath === 'texto' ? true : undefined}
      >
        {text}
      </code>
      {srMath === 'texto' && <span className="sr-only">{spoken}</span>}
    </div>
  );
}
