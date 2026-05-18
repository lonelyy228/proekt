"use client";

export default function AdminError({ error, reset }: { error: Error; reset: () => void }): JSX.Element {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <p className="font-medium text-destructive">Ошибка модуля админки: {error.message}</p>
      <button className="mt-3 rounded-md border px-3 py-2 text-sm" onClick={reset} type="button">
        Повторить
      </button>
    </div>
  );
}
