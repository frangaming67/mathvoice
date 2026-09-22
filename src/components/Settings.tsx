import { useEffect, useState } from 'react';
import type { Preferences } from '../types';
import { speech } from '../services/SpeechService';
export function Settings({
  preferences: p,
  change,
}: {
  preferences: Preferences;
  change: (p: Preferences) => void;
}) {
  const [voices, setVoices] = useState(() => speech.voices());
  useEffect(() => speech.subscribe(() => setVoices(speech.voices())), []);
  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    change({ ...p, [key]: value });
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
          <label>
            Velocidad: {p.rate}×
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={p.rate}
              onChange={(e) => update('rate', +e.target.value)}
            />
          </label>
          <label>
            Volumen: {Math.round(p.volume * 100)}%
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={p.volume}
              onChange={(e) => update('volume', +e.target.value)}
            />
          </label>
          <label>
            Tono: {p.pitch}
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={p.pitch}
              onChange={(e) => update('pitch', +e.target.value)}
            />
          </label>
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
          <div className="actions">
            <button
              type="button"
              disabled={!speech.available}
              onClick={() => speech.hablar('Esta es la voz de MathVoice. Dos más dos es cuatro.')}
            >
              Probar voz
            </button>
            <button type="button" onClick={() => speech.pausar()}>
              Pausar voz
            </button>
            <button type="button" onClick={() => speech.continuar()}>
              Continuar voz
            </button>
          </div>
        </fieldset>
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
          <label>
            Tamaño de texto: {p.fontSize} px
            <input
              type="range"
              min="16"
              max="28"
              step="1"
              value={p.fontSize}
              onChange={(e) => update('fontSize', +e.target.value)}
            />
          </label>
          <label>
            Interlineado: {p.spacing}
            <input
              type="range"
              min="1.4"
              max="2.2"
              step="0.1"
              value={p.spacing}
              onChange={(e) => update('spacing', +e.target.value)}
            />
          </label>
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
      </div>
    </section>
  );
}
