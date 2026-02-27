"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const DOWNLOAD_URL =
  "https://github.com/404twillCODE/OBS-File-Sorter/releases/download/Download/OBS.File.Sorter.Setup.2.0.0.exe";
const GITHUB_REPO_URL = "https://github.com/404twillCODE/OBS-File-Sorter";
const GITHUB_RELEASES_URL = "https://github.com/404twillCODE/OBS-File-Sorter/releases";

const fadeInUp = {
  initial: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};
const transition = { duration: 0.5, ease: [0.22, 1, 0.36, 1] };

function Nav() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-50 border-b border-white/[0.07] bg-[var(--bg)]/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <span className="text-lg font-semibold text-[var(--ice)]">
          OBS File Sorter
        </span>
        <a
          href={DOWNLOAD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-[var(--ice)]/40 bg-[var(--ice)]/10 px-4 py-2 text-sm font-medium text-[var(--ice)] transition-colors hover:bg-[var(--ice)]/20"
        >
          Download
        </a>
      </div>
    </motion.header>
  );
}

function Section({
  id,
  title,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`py-16 sm:py-20 ${className}`}>
      <div className="mx-auto max-w-4xl px-4">
        <h2 className="mb-10 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

const features = [
  {
    title: "Source folder",
    description:
      "Point to your main OBS folder. The app reads recordings and clips from here and sorts them by type and date. Only source and at least one destination folder are required — the rest are optional.",
  },
  {
    title: "Discord game detection (v2)",
    description:
      "Detects your current game from Discord (Rich Presence) and sorts Clips and Backtrack into game-named subfolders (e.g. Fortnite, R.E.P.O). Toggle on/off, use manual override, or \"Unknown\" when no game is detected.",
  },
  {
    title: "Backtrack & replay",
    description:
      "Files with \"backtrack\" or \"replay\" in the name go to their own date-based folders — with optional game subfolders when Discord detection is on. Ideal for Aitum Vertical and OBS replay buffer.",
  },
  {
    title: "Recordings",
    description:
      "Everything else is treated as a normal recording and sorted into date folders (YYYY-MM-DD) under your recordings path.",
  },
  {
    title: "Vault destination",
    description:
      "Optional vault sync: the app creates a vault folder in each date folder named after your chosen vault destination (e.g. \"Keepers\") and mirrors its subfolders. No fixed game list — your structure, your names.",
  },
  {
    title: "Auto-delete (optional)",
    description:
      "In Settings you can enable auto-deletion of short clips (under X minutes) and of old date folders (older than X days). The app includes ffprobe for clip length — no separate install.",
  },
  {
    title: "Run on startup",
    description:
      "Toggle in Settings to launch OBS File Sorter when Windows starts, so your workflow is ready as soon as you log in.",
  },
];

const steps = [
  {
    step: 1,
    title: "Set your folders",
    text: "Choose source (OBS output) and at least one of: backtrack, replay, or recording. Vault is optional. Enable Discord game detection in Settings to sort Clips/Backtrack by game.",
  },
  {
    step: 2,
    title: "Click Sort Clips",
    text: "The app moves .mp4 files into the right folders (with optional game subfolders when detection is on) and applies optional rules (e.g. delete short clips).",
  },
  {
    step: 3,
    title: "Done",
    text: "Your clips are organized by date (and by game when enabled). Config and Discord settings are saved automatically.",
  },
];

export default function HomePage() {
  const featuresRef = useRef(null);
  const stepsRef = useRef(null);
  const requirementsRef = useRef(null);
  const ctaRef = useRef(null);
  const footerRef = useRef(null);

  const inViewFeatures = useInView(featuresRef, { once: true, margin: "-80px" });
  const inViewSteps = useInView(stepsRef, { once: true, margin: "-80px" });
  const inViewReqs = useInView(requirementsRef, { once: true, margin: "-80px" });
  const inViewCta = useInView(ctaRef, { once: true, margin: "-80px" });
  const inViewFooter = useInView(footerRef, { once: true, margin: "-40px" });

  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <motion.section
          initial="initial"
          animate="visible"
          variants={{
            initial: {},
            visible: {
              transition: { staggerChildren: 0.1, delayChildren: 0.1 },
            },
          }}
          className="px-4 pt-20 pb-16 sm:pt-28 sm:pb-24"
        >
          <div className="mx-auto max-w-3xl text-center">
            <motion.h1
              variants={fadeInUp}
              transition={transition}
              className="text-4xl font-bold tracking-tight text-[var(--ice)] sm:text-5xl md:text-6xl"
            >
              OBS File Sorter
            </motion.h1>
            <motion.p
              variants={fadeInUp}
              transition={transition}
              className="mt-5 text-lg text-[var(--textMuted)] leading-relaxed sm:text-xl"
            >
              Sort OBS recordings and clips into date-based folders. Discord game
              detection, backtrack, replay buffer, and vault sync — all in one app.
            </motion.p>
            <motion.div variants={fadeInUp} transition={transition} className="mt-10">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href={DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--ice)]/40 bg-[var(--ice)] px-6 py-3.5 text-base font-semibold text-[var(--bg)] transition-all hover:bg-[var(--ice)]/90 hover:shadow-[0_0_24px_rgba(125,211,252,0.3)]"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                  </svg>
                  Download for Windows
                </a>
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--textMuted)]">
                  v2 · .exe on GitHub
                </span>
              </div>
            </motion.div>
            {/* Platforms: Windows available, Mac & Linux coming soon */}
            <motion.div
              variants={fadeInUp}
              transition={transition}
              className="mt-8 flex flex-wrap items-center justify-center gap-3"
            >
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-xl px-4 py-2.5 flex items-center gap-2">
                <svg className="h-5 w-5 text-[var(--ice)]" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                </svg>
                <span className="text-sm font-medium text-[var(--text)]">Windows</span>
                <span className="text-xs text-[var(--ice)]">Available</span>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 flex items-center gap-2 opacity-75">
                <svg className="h-5 w-5 text-[var(--textMuted)]" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.35-2.53-1.76-2.31-3.13-5.28-2.91-8.2.14-1.74 1.02-3.27 2.14-4.18 1.12-.9 2.38-1.41 3.64-1.44 1.27-.03 2.46.87 3.35.87.9 0 2.59-1.08 4.36-.91 1.04.07 3.96.42 5.85 2.5-.15.1-2.99 1.74-2.96 5.2.03 4.11 3.54 5.44 3.56 5.45-.02.06-.56 1.93-1.88 3.81zM12.96 3.73c.89-1.08 1.49-2.58 1.32-4.07-1.27.05-2.81.85-3.76 1.93-.81.93-1.52 2.42-1.33 3.84 1.42.11 2.87-.68 3.77-1.7z" />
                </svg>
                <span className="text-sm font-medium text-[var(--textMuted)]">Mac</span>
                <span className="text-xs text-[var(--textMuted)]">Coming soon</span>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 flex items-center gap-2 opacity-75">
                <svg className="h-5 w-5 text-[var(--textMuted)]" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489.236 1.525 1.472 2.017 2.595 2.131 1.339.138 2.877-.197 4.077-1.307.234-.218.454-.457.662-.714.168-.206.322-.424.463-.652.696-.994 1.241-2.116 1.505-3.359.377-1.776.225-3.214.061-4.84-.212-2.002-.994-3.552-2.604-4.385-.354-.184-.724-.318-1.107-.404-.262-.059-.524-.1-.787-.127-.174-.018-.347-.027-.519-.027zm.057 1.386c.12 0 .24.007.359.021.218.03.434.068.646.117.293.067.573.162.838.287.96.453 1.523 1.5 1.82 2.757.2.846.27 1.94.065 3.137-.246 1.453-.788 2.582-1.513 3.333-.905.946-2.111 1.412-3.385 1.308-1.051-.088-1.894-.534-2.406-1.302-.259-.389-.358-.837-.293-1.323.128-.958.722-1.927 1.593-2.794.61-.607 1.246-1.015 1.871-1.305 1.075-.5 2.214-.768 3.293-.768z" />
                </svg>
                <span className="text-sm font-medium text-[var(--textMuted)]">Linux</span>
                <span className="text-xs text-[var(--textMuted)]">Coming soon</span>
              </div>
            </motion.div>
            <motion.p
              variants={fadeInUp}
              transition={transition}
              className="mt-6 text-sm text-[var(--textMuted)]"
            >
              Opens the latest release on GitHub. Run the{" "}
              <strong className="text-[var(--text)]">OBS File Sorter Setup</strong>{" "}
              .exe to install.
            </motion.p>
            <motion.p
              variants={fadeInUp}
              transition={transition}
              className="mt-2 text-sm text-[var(--textMuted)]"
            >
              <a
                href={GITHUB_RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--ice)] hover:underline"
              >
                Older versions
              </a>
              {" "}— view all releases and downloads on GitHub.
            </motion.p>
          </div>
        </motion.section>

        {/* Features */}
        <Section id="features" title="What it does">
          <div ref={featuresRef} className="grid gap-4 sm:grid-cols-2">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                animate={inViewFeatures ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.45, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              >
                <GlassCard className="p-6">
                  <h3 className="text-lg font-semibold text-[var(--ice)]">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--textMuted)] leading-relaxed">
                    {f.description}
                  </p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* How it works */}
        <Section id="how-it-works" title="How it works">
          <div ref={stepsRef} className="space-y-8">
            {steps.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, x: -16 }}
                animate={inViewSteps ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.45, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="flex gap-6 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ice)]/20 text-lg font-bold text-[var(--ice)]">
                  {s.step}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text)]">
                    {s.title}
                  </h3>
                  <p className="mt-1 text-[var(--textMuted)]">{s.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* Requirements */}
        <Section id="requirements" title="Requirements">
          <div ref={requirementsRef}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewReqs ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <GlassCard className="p-6">
                <ul className="space-y-3 text-[var(--textMuted)]">
                  <li className="flex gap-2">
                    <span className="text-[var(--ice)]">·</span>
                    <span><strong className="text-[var(--text)]">Windows</strong> — download the .exe installer (Electron). <strong className="text-[var(--text)]">Mac &amp; Linux</strong> — coming soon.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[var(--ice)]">·</span>
                    <span><strong className="text-[var(--text)]">No extra installs</strong> for sorting, vault, or Discord game detection — just run the installer.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[var(--ice)]">·</span>
                    <span><strong className="text-[var(--text)]">FFmpeg/ffprobe</strong> is included — &quot;Auto delete short files&quot; works out of the box.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[var(--ice)]">·</span>
                    <span>Config and Discord settings are stored in your user data folder and persist between sessions.</span>
                  </li>
                </ul>
              </GlassCard>
            </motion.div>
          </div>
        </Section>

        {/* Download CTA */}
        <Section title="Get the app">
          <div ref={ctaRef}>
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={inViewCta ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <GlassCard className="p-8 text-center">
                <p className="text-[var(--textMuted)]">
                  Download the Windows installer from GitHub. No account required.
                  Mac and Linux builds are coming soon.
                </p>
                <a
                  href={DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[var(--ice)]/40 bg-[var(--ice)] px-6 py-3.5 text-base font-semibold text-[var(--bg)] transition-all hover:bg-[var(--ice)]/90 hover:shadow-[0_0_24px_rgba(125,211,252,0.3)]"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                  </svg>
                  Download for Windows
                </a>
                <p className="mt-4 text-sm text-[var(--textMuted)]">
                  You&apos;ll get the <strong className="text-[var(--text)]">OBS File Sorter Setup 2.0.0</strong> .exe.
                  Mac and Linux — coming soon.
                </p>
                <p className="mt-3 text-sm text-[var(--textMuted)]">
                  <a
                    href={GITHUB_RELEASES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--ice)] hover:underline"
                  >
                    Older versions
                  </a>
                  {" "}— all releases and downloads on GitHub.
                </p>
              </GlassCard>
            </motion.div>
          </div>
        </Section>

        {/* Footer */}
        <motion.footer
          ref={footerRef}
          initial={{ opacity: 0 }}
          animate={inViewFooter ? { opacity: 1 } : {}}
          transition={{ duration: 0.4 }}
          className="border-t border-white/[0.07] py-10"
        >
          <div className="mx-auto max-w-4xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm text-[var(--textMuted)]">
              OBS File Sorter — sort clips, not chaos.
            </span>
            <div className="flex gap-6">
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--ice)] hover:underline"
              >
                Source on GitHub
              </a>
              <a
                href={GITHUB_RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--ice)] hover:underline"
              >
                Older versions / Releases
              </a>
            </div>
          </div>
        </motion.footer>
      </main>
    </>
  );
}
