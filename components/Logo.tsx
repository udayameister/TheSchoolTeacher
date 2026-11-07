/** TheSchoolTeacher mark: an open book under a rising marigold sun, on chalkboard teal. */
export function LogoMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <rect width="48" height="48" rx="12" fill="#1A5550" />
      <circle cx="24" cy="17" r="6.5" fill="#F0A22B" />
      <path d="M8 23.5c5.5-1.6 11 -0.6 16 3 5-3.6 10.5-4.6 16-3V37c-5.5-1.6-11-0.6-16 3-5-3.6-10.5-4.6-16-3z" fill="#FFFCF5" />
      <path d="M24 26.5V40" stroke="#1A5550" strokeWidth="1.6" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="text-lg font-bold tracking-tight text-brand-800">
        TheSchool<span className="text-marigold-700">Teacher</span>
      </span>
    </span>
  );
}
