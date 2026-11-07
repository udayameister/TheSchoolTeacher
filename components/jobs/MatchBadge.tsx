/** Colour + text (never colour alone) for a match score. */
export default function MatchBadge({ score, label }: { score: number; label: string }) {
  const tone = score >= 75 ? 'border-success-600/30 bg-success-50 text-success-700' : score >= 50 ? 'border-marigold-400 bg-marigold-50 text-marigold-800' : 'border-line bg-ivory text-ink-soft';
  return <span className={`badge shrink-0 whitespace-nowrap px-2.5 py-1 text-sm ${tone}`}>{label}</span>;
}
