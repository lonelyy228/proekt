"use client";

type AdminStateBlockProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "default" | "error";
};

export const AdminStateBlock = ({
  title,
  description,
  actionLabel,
  onAction,
  tone = "default"
}: AdminStateBlockProps): JSX.Element => {
  const titleClass = tone === "error" ? "text-destructive" : "text-foreground";
  const descriptionClass =
    tone === "error" ? "text-destructive/80" : "text-muted-foreground";
  const buttonClass =
    tone === "error"
      ? "hover:border-destructive hover:text-destructive"
      : "hover:border-primary hover:text-primary";

  return (
    <div className="rounded-lg border bg-card p-6 text-sm">
      <p className={`font-medium ${titleClass}`}>{title}</p>
      <p className={`mt-1 ${descriptionClass}`}>{description}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          className={`mt-3 rounded-md border px-3 py-1 text-xs ${buttonClass}`}
          onClick={onAction}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
};
