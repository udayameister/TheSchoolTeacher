import type { Config } from 'tailwindcss';

/*
 * TheSchoolTeacher brand.
 *  - brand    = "chalkboard teal": calm, trustworthy, school-friendly. brand-700 is the main action colour
 *               (white text on brand-700 ≈ 8.5:1; brand-700 text on ivory ≈ 8.3:1, WCAG AA/AAA).
 *  - marigold = warm accent (festive marigold, school-bell yellow). Use 300–400 as fills with ink text,
 *               700–800 for accent text on light backgrounds (marigold-800 on ivory ≈ 8:1).
 *  - ivory    = page background; ink = body text.
 * Deliberately different from AcadeXMatch's maroon and gold.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF7F6', 100: '#D3ECE9', 200: '#A8D8D2', 300: '#74BDB5', 400: '#439E95',
          500: '#2A8279', 600: '#1F6A63', 700: '#1A5550', 800: '#16443F', 900: '#12332F', 950: '#0A1F1D',
        },
        marigold: {
          50: '#FFF8EB', 100: '#FDEBC8', 200: '#FAD58C', 300: '#F6BC50', 400: '#F0A22B',
          500: '#DB8614', 600: '#B4670E', 700: '#8C4E10', 800: '#6F3E12', 900: '#5B3412',
        },
        ivory: '#FFFCF5',
        paper: '#FFFFFF',
        line: '#E7E1D4',
        ink: { DEFAULT: '#1F2A2E', soft: '#47555A', muted: '#5F6B70' },
        danger: { 50: '#FEF2F2', 600: '#C62828', 700: '#A31F1F' },
        success: { 50: '#ECFDF3', 600: '#15803D', 700: '#166534' },
      },
      fontFamily: {
        // Noto Sans for Latin + Noto Sans Devanagari for Hindi, self-hosted (no request to Google Fonts).
        sans: ['"Noto Sans"', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl: '0.875rem' },
      boxShadow: {
        card: '0 1px 2px rgba(18, 51, 47, 0.06), 0 2px 8px rgba(18, 51, 47, 0.05)',
      },
    },
  },
  plugins: [],
};
export default config;
