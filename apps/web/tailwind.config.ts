import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Breakpoint WNF4: layout side-by-side powyżej 720 px, stacked poniżej.
      screens: {
        md: '720px',
      },
    },
  },
  plugins: [],
};

export default config;