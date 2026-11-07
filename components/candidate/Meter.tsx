/** Accessible progress meter (role="meter" with text, never colour alone). */
export default function Meter({ percent, label }: { percent: number; label: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm font-semibold"><span>{label}</span><span>{percent}%</span></div>
      <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={label} className="mt-1 h-3 rounded-full bg-brand-50">
        <div className={`h-3 rounded-full ${percent >= 80 ? 'bg-success-600' : percent >= 50 ? 'bg-marigold-400' : 'bg-brand-500'}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
