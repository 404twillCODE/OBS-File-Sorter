import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "OBS File Sorter",
  description:
    "Sort OBS recordings and clips into date-based folders. Discord game detection, backtrack, replay, and vault sync. Windows now; Mac and Linux coming soon.",
  openGraph: {
    title: "OBS File Sorter",
    description:
      "Sort OBS recordings and clips into date-based folders. Discord game detection, backtrack, replay, and vault sync. Windows now; Mac and Linux coming soon.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${spaceGrotesk.variable} font-sans antialiased min-h-screen`}
      >
        <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 90% 55% at 50% -15%, var(--iceSoft), transparent 55%), radial-gradient(ellipse 70% 45% at 85% 30%, rgba(125, 211, 252, 0.06), transparent 50%), linear-gradient(180deg, var(--bg) 0%, var(--bg2) 50%, var(--bg3) 100%)",
            }}
          />
          <div
            className="absolute inset-0 bg-glow-pulse opacity-60"
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% 30%, rgba(125, 211, 252, 0.07), transparent 55%)",
            }}
          />
        </div>
        {children}
      </body>
    </html>
  );
}
