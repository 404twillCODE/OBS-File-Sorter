"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const DOWNLOAD_URL =
  "https://github.com/404twillCODE/OBS-File-Sorter/releases/download/Download/OBS.File.Sorter.Setup.1.0.0.exe";
const GITHUB_REPO_URL = "https://github.com/404twillCODE/OBS-File-Sorter";

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
      "Point to your main OBS folder. The app reads recordings and clips from here and sorts them by type and date.",
  },
  {
    title: "Backtrack & replay",
    description:
      "Files with \"backtrack\" or \"replay\" in the name go to their own date-based folders — ideal for Aitum Vertical and OBS replay buffer.",
  },
  {
    title: "Recordings",
    description:
      "Everything else is treated as a normal recording and sorted into date folders (YYYY-MM-DD) under your recordings path.",
  },
  {
    title: "Vault destination",
    description:
      "Optional vault sync: the app creates \"The Vault\" subfolders (e.g. Fortnite, R.E.P.O, Random) and syncs them to a single destination.",
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
    text: "Choose source (OBS output), backtrack, replay, recording, and optional vault paths in the app.",
  },
  {
    step: 2,
    title: "Click Sort Clips",
    text: "The app moves or copies .mp4 files into the right date folders and applies optional rules (e.g. delete short clips).",
  },
  {
    step: 3,
    title: "Done",
    text: "Your clips are organized by date. Config is saved automatically; no extra installs needed for basic use.",
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
              Sort OBS recordings and clips into date-based folders. Backtrack,
              replay buffer, and vault sync — all in one app for Windows.
            </motion.p>
            <motion.div variants={fadeInUp} transition={transition} className="mt-10">
              <a
                href={DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--ice)]/40 bg-[var(--ice)] px-6 py-3.5 text-base font-semibold text-[var(--bg)] transition-all hover:bg-[var(--ice)]/90 hover:shadow-[0_0_24px_rgba(125,211,252,0.3)]"
              >
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                </svg>
                Download for Windows
              </a>
            </motion.div>
            <motion.p
              variants={fadeInUp}
              transition={transition}
              className="mt-4 text-sm text-[var(--textMuted)]"
            >
              Opens the latest release on GitHub. Run the{" "}
              <strong className="text-[var(--text)]">OBS File Sorter Setup</strong>{" "}
              .exe to install.
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
                    <span><strong className="text-[var(--text)]">Windows</strong> — the app is built for Windows (Electron).</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[var(--ice)]">·</span>
                    <span><strong className="text-[var(--text)]">No extra installs</strong> for sorting and vault — just run the installer.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[var(--ice)]">·</span>
                    <span><strong className="text-[var(--text)]">FFmpeg/ffprobe</strong> is included with the installer — "Auto delete short files" works out of the box with no extra install.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[var(--ice)]">·</span>
                    <span>Config and settings are stored in your user data folder and persist between sessions.</span>
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
                  Download the installer from GitHub. No account required.
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
                  You'll be taken to the latest release. Grab the{" "}
                  <strong className="text-[var(--text)]">OBS File Sorter Setup</strong>{" "}
                  .exe.
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
                href={DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--ice)] hover:underline"
              >
                Releases
              </a>
            </div>
          </div>
        </motion.footer>
      </main>
    </>
  );
}
