import type { Metadata } from "next";
import "@/app/globals.css";
import { Header } from "@/components/layout/header";
import { AppQueryProvider } from "@/lib/query-provider";
import { Bebas_Neue, Space_Grotesk } from "next/font/google";

const headingFont = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-heading"
});

const bodyFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "RSH",
  description: "RSH — нишевый маркетплейс брендовых вещей и кастомных изделий."
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="ru">
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>
        <AppQueryProvider>
          <Header />
          <main className="mx-auto w-full max-w-7xl px-6 py-10">{children}</main>
        </AppQueryProvider>
      </body>
    </html>
  );
}
