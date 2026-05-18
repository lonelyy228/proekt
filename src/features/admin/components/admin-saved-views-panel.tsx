"use client";

type SavedViewItem = {
  id: string;
  name: string;
  isDefault: boolean;
};

type AdminSavedViewsPanelProps = {
  presets: SavedViewItem[];
  selectedPresetId: string;
  presetName: string;
  presetAsDefault: boolean;
  applyDisabled: boolean;
  createDisabled: boolean;
  updateDisabled: boolean;
  deleteDisabled: boolean;
  isLoading: boolean;
  isError: boolean;
  onSelectedPresetIdChange: (value: string) => void;
  onPresetNameChange: (value: string) => void;
  onPresetAsDefaultChange: (value: boolean) => void;
  onApply: () => void;
  onCreate: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  loadingText?: string;
  errorText?: string;
};

export const AdminSavedViewsPanel = ({
  presets,
  selectedPresetId,
  presetName,
  presetAsDefault,
  applyDisabled,
  createDisabled,
  updateDisabled,
  deleteDisabled,
  isLoading,
  isError,
  onSelectedPresetIdChange,
  onPresetNameChange,
  onPresetAsDefaultChange,
  onApply,
  onCreate,
  onUpdate,
  onDelete,
  loadingText = "Загружаем сохраненные представления...",
  errorText = "Не удалось загрузить сохраненные представления."
}: AdminSavedViewsPanelProps): JSX.Element => {
  return (
    <div className="mt-3 rounded-md border bg-card/60 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Сохраненные представления</p>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={selectedPresetId}
          onChange={(event) => onSelectedPresetIdChange(event.target.value)}
        >
          <option value="">Выберите представление</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
              {preset.isDefault ? " (по умолчанию)" : ""}
            </option>
          ))}
        </select>

        <input
          className="rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="Название представления"
          value={presetName}
          maxLength={60}
          onChange={(event) => onPresetNameChange(event.target.value)}
        />

        <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs">
          <input
            type="checkbox"
            checked={presetAsDefault}
            onChange={(event) => onPresetAsDefaultChange(event.target.checked)}
          />
          Сделать представлением по умолчанию
        </label>

        <button
          type="button"
          className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-40"
          disabled={applyDisabled}
          onClick={onApply}
        >
          Применить
        </button>

        <button
          type="button"
          className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-40"
          disabled={createDisabled}
          onClick={onCreate}
        >
          Сохранить как новое
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            className="w-full rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary disabled:opacity-40"
            disabled={updateDisabled}
            onClick={onUpdate}
          >
            Обновить
          </button>
          <button
            type="button"
            className="w-full rounded-md border px-3 py-2 text-sm text-destructive hover:border-destructive disabled:opacity-40"
            disabled={deleteDisabled}
            onClick={onDelete}
          >
            Удалить
          </button>
        </div>
      </div>

      {isLoading ? <p className="mt-2 text-xs text-muted-foreground">{loadingText}</p> : null}
      {isError ? <p className="mt-2 text-xs text-destructive">{errorText}</p> : null}
    </div>
  );
};
