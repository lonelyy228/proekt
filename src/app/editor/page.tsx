import dynamic from "next/dynamic";
import Link from "next/link";

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
        2D Lab работает только для базовой линейки RSH BASICS. Брендовые товары в каталоге продаются без кастомизации.
        Создай уникальный дизайн для базовой вещи, добавь текст и графику и сохрани результат в профиль.
      </p>
      <div>
        <Link href="/catalog/basics" className="inline-block rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary">
          Открыть каталог RSH BASICS
        </Link>
      </div>
      <EditorCanvas />
    </div>
  );
}
