import { useId } from 'react';

/*
 * TheSchoolTeacher "Deepam" mark: an open book whose pages curve up like a diya (the lamp of knowledge),
 * with a marigold flame rising from its spine. The flame is also a pen nib (slit and breather hole) and a
 * map pin: teaching, learning and "the right school near you" in one symbol. Colours: soft maroon
 * (maroon-500 → maroon-700) with a marigold flame. Standalone files: public/brand/ (SVG and PNG) and app/icon.svg.
 */
export function LogoMark({ size = 36, className = '', title }: { size?: number; className?: string; title?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A84A5B" /><stop offset="1" stopColor="#6B2234" /></linearGradient>
        <linearGradient id={`${id}fl`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FAD58C" /><stop offset="0.55" stopColor="#F0A22B" /><stop offset="1" stopColor="#DB8614" /></linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id}bg)`} />
      <circle cx="32" cy="24" r="17" fill="#F0A22B" opacity="0.13" />
      <path d="M6 33.5C14 32.2 24 34 32 39.5C40 34 50 32.2 58 33.5C56.5 45.5 46 54 32 54C18 54 7.5 45.5 6 33.5Z" fill="#FFFCF5" />
      <path d="M32 39.5V53.6" stroke="#8E3346" strokeWidth="1.6" strokeLinecap="round" />
      {size >= 28 && (
        <path d="M12 38.6C18 38.2 23.5 39.6 28.5 42.6M14.5 43.6C19.5 43.4 23.5 44.6 27.5 46.8M52 38.6C46 38.2 40.5 39.6 35.5 42.6M49.5 43.6C44.5 43.4 40.5 44.6 36.5 46.8" stroke="#ECC6CC" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      )}
      <path d="M32 6.5C35.5 12.5 41 18.5 41 25.5A9 9 0 0 1 23 25.5C23 18.5 28.5 12.5 32 6.5Z" fill={`url(#${id}fl)`} />
      <path d="M32 9.5V24.5" stroke="#6B2234" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="32" cy="26.4" r="2.4" fill="#6B2234" />
    </svg>
  );
}

/** Mark + wordmark. `tagline` adds the line underneath (for larger placements such as the footer). */
export function Logo({ size = 38, tagline }: { size?: number; tagline?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="text-[1.32rem] font-bold tracking-tight text-maroon-800">
          TheSchool<span className="text-marigold-600">Teacher</span>
        </span>
        {tagline && <span className="mt-1 whitespace-nowrap text-[0.75rem] font-semibold uppercase tracking-[0.05em] text-ink-muted">{tagline}</span>}
      </span>
    </span>
  );
}
