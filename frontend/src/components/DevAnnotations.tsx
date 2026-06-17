'use client';

import dynamic from 'next/dynamic';

/**
 * Agentation visual-feedback toolbar — DEVELOPMENT ONLY.
 *
 * Click any element on the page to annotate it; the toolbar copies structured
 * markdown (CSS selectors, element paths, positions) that an AI coding agent can
 * grep for to find the exact code you mean.
 *
 * It is loaded lazily on the client (`ssr: false`) and gated behind
 * `NODE_ENV !== 'production'`. Next.js statically replaces `process.env.NODE_ENV`
 * at build time, so in a production build this whole branch is dead-code
 * eliminated and the `agentation` chunk is never shipped to users.
 *
 * `endpoint` enables Agent Sync: annotations are POSTed to the Agentation MCP
 * server (started by Claude Code from the repo's .mcp.json, HTTP on :4747) so the
 * coding agent can read them directly via MCP instead of pasting markdown.
 * Override the URL with NEXT_PUBLIC_AGENTATION_ENDPOINT if needed.
 */
const AGENTATION_ENDPOINT =
  process.env.NEXT_PUBLIC_AGENTATION_ENDPOINT || 'http://localhost:4747';

const Agentation =
  process.env.NODE_ENV !== 'production'
    ? dynamic(() => import('agentation').then((m) => m.Agentation), { ssr: false })
    : () => null;

export default function DevAnnotations() {
  if (process.env.NODE_ENV === 'production') return null;
  return <Agentation endpoint={AGENTATION_ENDPOINT} />;
}
