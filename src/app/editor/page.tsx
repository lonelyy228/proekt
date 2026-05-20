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
        В RSH 2D Lab кастомизируются только базовые blank-модели: футболки, худи, свитшоты, шорты и штаны.
        Брендовые вещи из каталога продаются только в оригинальном виде и в редактор не передаются.
      </p>
      <EditorCanvas />
    </div>
  );
}
