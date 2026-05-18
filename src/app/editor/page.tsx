import dynamic from "next/dynamic";

const EditorCanvas = dynamic(
  () => import("@/features/editor/components/editor-canvas").then((module) => module.EditorCanvas),
  { ssr: false }
);

export default function EditorPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <h1 className="text-4xl tracking-[0.05em]" style={{ fontFamily: "var(--font-heading)" }}>
        RSH 2D LAB
      </h1>
      <p className="text-muted-foreground">
        Кастомизация необязательна: сначала выбери обычную брендовую вещь в каталоге. Если хочешь уникальный вариант,
        открой 2D Lab, добавь текст и графику и сохрани дизайн в профиль.
      </p>
      <EditorCanvas />
    </div>
  );
}
