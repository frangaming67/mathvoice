import { useEffect, useState } from 'react';
import type {
  DecimalSeparator,
  NumberFormat,
  NumberMode,
  Preferences,
  ResultForm,
  ScreenReaderMath,
} from '../types';
import { speech } from '../services/SpeechService';
import { feedbackSound } from '../services/FeedbackSoundService';
import {
  preferenceValueText,
  sanitizePreferences,
  type SliderPreference,
} from '../services/PreferencesService';
import { formatNumber } from '../accessibility/numberSpeech';

const digitOptions = Array.from({ length: 16 }, (_, digits) => digits);
export function Settings({
  preferences: p,
  change,
  cancelAutomatic,
  feedbackSounds,
}: {
  preferences: Preferences;
  change: (p: Preferences) => void;
  cancelAutomatic: () => void;
  /** Sonidos de confirmación: el interruptor se comparte con «Teclado y atajos». */
  feedbackSounds?: {
    enabled: boolean;
    volume: number;
    change: (enabled: boolean, volume: number) => void;
  };
}) {
  const [voices, setVoices] = useState(() => speech.voices());
  useEffect(() => speech.subscribe(() => setVoices(speech.voices())), []);
  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    change({ ...p, [key]: value });
  const shown = (value: number) =>
    formatNumber(value, { significant: 3, decimal: p.decimalSeparator });
  // Etiqueta fija para que el lector no repita el nombre en cada paso; el valor va en aria-valuetext.
  const slider = (
    key: SliderPreference,
    name: string,
    visible: string,
    [min, max, step]: [number, number, number],
  ) => (
    <label>
      {name}
      <span aria-hidden="true">: {visible}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={p[key]}
        aria-valuetext={preferenceValueText(key, p[key])}
        onChange={(e) => update(key, +e.target.value)}
      />
    </label>
  );
  const digits = p.numberDigits;
  const formatHint = {
    normal: `Hasta ${digits} cifras significativas, sin ceros de más.`,
    fijo:
      digits === 0
        ? 'Redondea al entero más cercano.'
        : `Siempre ${digits} ${digits === 1 ? 'decimal' : 'decimales'}.`,
    cientifico: `${digits} cifras significativas por una potencia de diez.`,
  }[p.numberFormat];
  const resultHint = {
    auto: `Según lo que escribiste: 1/3 + 1/6 da 1/2 y ${shown(2.5)} + 1 da ${shown(3.5)}.`,
    decimal: 'Siempre en decimal.',
    exacto: `Fracción o expresión exacta cuando existe, por ejemplo 1/2 en lugar de ${shown(0.5)}.`,
    ambos: 'La forma exacta y, a continuación, su valor decimal.',
  }[p.resultForm];
  return (
    <section className="panel settings" aria-labelledby="settings-title">
      <h2 id="settings-title" tabIndex={-1}>
        Configuración de voz y accesibilidad
      </h2>
      <div className="settings-grid">
        <fieldset>
          <legend>Lectura por voz</legend>
          <label>
            <input
              type="checkbox"
              checked={p.guided}
              disabled={!speech.available}
              onChange={(e) => {
                update('guided', e.target.checked);
                if (!e.target.checked) speech.detener();
              }}
            />{' '}
            Activar guía por voz
          </label>
          <p className="hint">
            Si usás un lector de pantalla, podés desactivar la guía para evitar dos voces
            simultáneas.
          </p>
          <button type="button" onClick={() => update('guided', false)}>
            Usar mi lector de pantalla
          </button>
          <p>
            {p.guided
              ? 'Voz automática de MathVoice activada.'
              : 'Modo lector de pantalla: MathVoice no usa su voz. Lo que pidas escuchar lo dice tu lector y aparece en la línea braille.'}
          </p>
          <label>
            Idioma de la voz
            <select
              value={p.language}
              onChange={(e) => change({ ...p, language: e.target.value, voice: '' })}
            >
              <option value="es-AR">Español Argentina</option>
              <option value="es-ES">Español España</option>
              <option value="es-MX">Español Latinoamérica</option>
              <option value="en-US">Inglés</option>
            </select>
          </label>
          <label>
            Voz
            <select value={p.voice} onChange={(e) => update('voice', e.target.value)}>
              <option value="">Automática según idioma</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </label>
          {!voices.length && (
            <p className="hint">
              El navegador todavía no informa voces instaladas. La síntesis intentará usar su voz
              predeterminada.
            </p>
          )}
          {slider('rate', 'Velocidad', `${shown(p.rate)}×`, [0.5, 2.5, 0.1])}
          {slider('volume', 'Volumen', `${Math.round(p.volume * 100)} %`, [0, 1, 0.1])}
          {slider('pitch', 'Tono', shown(p.pitch), [0, 2, 0.1])}
          {(
            [
              ['autoRead', 'Leer resultados automáticamente'],
              ['readFocus', 'Leer controles al enfocarlos'],
              ['readHover', 'Leer automáticamente al pasar el puntero'],
              ['readTyping', 'Leer expresión después de escribir'],
              ['readKeys', 'Leer teclas escritas'],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={p[key]}
                onChange={(e) => update(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
          <div className="actions" data-preserve-reading>
            <button
              type="button"
              disabled={!speech.available}
              onClick={() => {
                cancelAutomatic();
                speech.hablarLista(
                  ['Esta es la voz de MathVoice. Dos más dos es cuatro.'],
                  () => {},
                );
              }}
            >
              Probar voz
            </button>
            <button
              type="button"
              onClick={() => {
                cancelAutomatic();
                speech.pausar();
              }}
            >
              Pausar voz
            </button>
            <button
              type="button"
              onClick={() => {
                cancelAutomatic();
                speech.continuar();
              }}
            >
              Continuar voz
            </button>
          </div>
        </fieldset>
        {feedbackSounds && (
          <fieldset>
            <legend>Sonidos</legend>
            <label>
              <input
                type="checkbox"
                checked={feedbackSounds.enabled}
                onChange={(e) => feedbackSounds.change(e.target.checked, feedbackSounds.volume)}
              />
              Sonidos breves de confirmación
            </label>
            <p className="hint">
              Un tono al calcular, otro distinto ante un error y otro al cambiar de herramienta o al
              tocar una tecla sin función.
            </p>
            <label>
              Volumen de los sonidos
              <span aria-hidden="true">: {Math.round(feedbackSounds.volume * 100)} %</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={feedbackSounds.volume}
                aria-valuetext={preferenceValueText('volume', feedbackSounds.volume)}
                onChange={(e) => feedbackSounds.change(feedbackSounds.enabled, +e.target.value)}
              />
            </label>
            <div className="actions">
              <button type="button" onClick={() => void feedbackSound.test()}>
                Probar sonido
              </button>
            </div>
          </fieldset>
        )}
        <fieldset>
          <legend>Presentación</legend>
          <label>
            <input
              type="checkbox"
              checked={p.maximum}
              onChange={(e) =>
                change({
                  ...p,
                  maximum: e.target.checked,
                  ...(e.target.checked ? { theme: 'contrast', fontSize: 22, readFocus: true } : {}),
                })
              }
            />
            Modo de máxima accesibilidad
          </label>
          <p className="hint">
            Aumenta controles y contraste; con la guía activada, anuncia los controles al recibir
            foco.
          </p>
          <label>
            Tema
            <select value={p.theme} onChange={(e) => update('theme', e.target.value)}>
              <option value="light">Claro</option>
              <option value="dark">Oscuro</option>
              <option value="contrast">Alto contraste</option>
              <option value="mono">Negro y blanco</option>
              <option value="yellow">Amarillo sobre negro</option>
            </select>
          </label>
          {slider('fontSize', 'Tamaño de texto', `${p.fontSize} px`, [16, 28, 1])}
          {slider('spacing', 'Interlineado', shown(p.spacing), [1.4, 2.2, 0.1])}
          <label>
            Escala general
            <select value={p.scale} onChange={(e) => update('scale', +e.target.value)}>
              {[1, 1.25, 1.5, 2].map((value) => (
                <option key={value} value={value}>
                  {value * 100}%
                </option>
              ))}
            </select>
          </label>
          <p className="hint">
            Amplía toda la interfaz. También podés usar el zoom de tu navegador.
          </p>
        </fieldset>
        <fieldset>
          <legend>Números</legend>
          <label>
            Separador decimal
            <select
              value={p.decimalSeparator}
              aria-describedby="settings-decimal-hint"
              onChange={(e) => update('decimalSeparator', e.target.value as DecimalSeparator)}
            >
              <option value="punto">Punto (2.5)</option>
              <option value="coma">Coma (2,5)</option>
            </select>
          </label>
          <p className="hint" id="settings-decimal-hint">
            {p.decimalSeparator === 'coma'
              ? 'Escribí 2,5. Los argumentos de una función se separan con punto y coma: log(8; 2).'
              : 'Escribí 2.5. Los argumentos de una función se separan con coma: log(8, 2).'}
          </p>
          <label>
            Formato de los resultados
            <select
              value={p.numberFormat}
              aria-describedby="settings-format-hint"
              onChange={(e) =>
                // Al salir de fijo con 0 decimales, las cifras vuelven a su valor por defecto.
                change(sanitizePreferences({ ...p, numberFormat: e.target.value as NumberFormat }))
              }
            >
              <option value="normal">Normal</option>
              <option value="fijo">Fijo: cantidad fija de decimales</option>
              <option value="cientifico">Científico: con potencia de diez</option>
            </select>
          </label>
          <label>
            {p.numberFormat === 'fijo' ? 'Cantidad de decimales' : 'Cifras significativas'}
            <select
              value={p.numberDigits}
              aria-describedby="settings-format-hint"
              onChange={(e) => update('numberDigits', +e.target.value)}
            >
              {digitOptions
                .filter((n) => n > 0 || p.numberFormat === 'fijo')
                .map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
            </select>
          </label>
          <p className="hint" id="settings-format-hint">
            {formatHint} Vale para lo que se muestra, se lee y se copia.
          </p>
          <label>
            Cifras al leer un decimal
            <select
              value={p.spokenDigits}
              aria-describedby="settings-spoken-hint"
              onChange={(e) => update('spokenDigits', +e.target.value)}
            >
              <option value={0}>Todas las cifras</option>
              {digitOptions.slice(1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <p className="hint" id="settings-spoken-hint">
            {p.spokenDigits
              ? `Los decimales largos se leen redondeados a ${p.spokenDigits} ${p.spokenDigits === 1 ? 'cifra' : 'cifras'}, con la palabra «aproximadamente».`
              : 'La voz lee todas las cifras del resultado.'}
          </p>
          <label>
            Forma del resultado
            <select
              value={p.resultForm}
              aria-describedby="settings-result-hint"
              onChange={(e) => update('resultForm', e.target.value as ResultForm)}
            >
              <option value="auto">Automática</option>
              <option value="decimal">Decimal</option>
              <option value="exacto">Exacta, como fracción</option>
              <option value="ambos">Ambas: exacta y decimal</option>
            </select>
          </label>
          <p className="hint" id="settings-result-hint">
            {resultHint}
          </p>
          <label>
            Modo de números
            <select
              value={p.numberMode}
              aria-describedby="settings-mode-hint"
              onChange={(e) => update('numberMode', e.target.value as NumberMode)}
            >
              <option value="real">Reales</option>
              <option value="complejo">Complejos</option>
            </select>
          </label>
          <p className="hint" id="settings-mode-hint">
            {p.numberMode === 'real'
              ? 'sqrt(-4) avisa que no hay resultado real.'
              : 'sqrt(-4) da 2i: los resultados pueden tener parte imaginaria.'}
          </p>
        </fieldset>
        <fieldset>
          <legend>Lector de pantalla</legend>
          <label>
            Fórmulas para el lector de pantalla
            <select
              value={p.srMath}
              aria-describedby="settings-srmath-hint"
              onChange={(e) => update('srMath', e.target.value as ScreenReaderMath)}
            >
              <option value="mathml">MathML: NVDA con MathCAT, JAWS o VoiceOver</option>
              <option value="texto">Texto hablado en español</option>
            </select>
          </label>
          <p className="hint" id="settings-srmath-hint">
            {p.srMath === 'mathml'
              ? 'Tu lector lee las fórmulas y te deja explorarlas por partes. Si no las lee o las lee en otro idioma, elegí Texto hablado.'
              : 'Las fórmulas llegan como frases en español, iguales a la voz de MathVoice, sin exploración por partes.'}
          </p>
        </fieldset>
      </div>
    </section>
  );
}
