import { toolGroups, type ToolId } from './toolCatalog';

export function ToolChooser({
  choice,
  choose,
  open,
}: {
  choice: ToolId;
  choose: (tool: ToolId) => void;
  open: (tool: ToolId) => void;
}) {
  return (
    <form
      className="tool-chooser"
      aria-label="Cambiar de herramienta"
      onSubmit={(event) => {
        event.preventDefault();
        open(choice);
      }}
    >
      <label htmlFor="tool-choice">Elegir herramienta</label>
      <div className="actions">
        <select
          id="tool-choice"
          value={choice}
          onChange={(event) => choose(event.target.value as ToolId)}
          aria-describedby="tool-choice-help"
        >
          {toolGroups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.tools.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button type="submit">Abrir herramienta</button>
      </div>
      <p id="tool-choice-help" className="hint">
        Elegí con las flechas y pulsá Abrir herramienta. Tus datos se conservan al cambiar.
      </p>
    </form>
  );
}
