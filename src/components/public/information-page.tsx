import type { ReactNode } from "react";

type InformationSection = {
  title: string;
  content: ReactNode;
};

type InformationPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: InformationSection[];
  asideTitle?: string;
  asideContent?: ReactNode;
};

export const InformationPage = ({
  eyebrow,
  title,
  description,
  sections,
  asideTitle,
  asideContent
}: InformationPageProps): JSX.Element => {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-card/90 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-primary">{eyebrow}</p>
        <h1 className="mt-3 text-5xl leading-[0.95] tracking-[0.04em]" style={{ fontFamily: "var(--font-heading)" }}>
          {title}
        </h1>
        <p className="mt-4 max-w-3xl text-base text-muted-foreground">{description}</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border bg-card/90 p-6 shadow-sm">
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">{section.content}</div>
            </section>
          ))}
        </div>

        {asideTitle && asideContent ? (
          <aside className="rounded-2xl border bg-card/90 p-6 shadow-sm lg:sticky lg:top-28 lg:self-start">
            <h2 className="text-xl font-semibold">{asideTitle}</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">{asideContent}</div>
          </aside>
        ) : null}
      </div>
    </div>
  );
};
