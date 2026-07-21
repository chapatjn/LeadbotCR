import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cr: {
          blue: '#0033A0',
          red: '#CE1126',
        },
      },
    },
  },
  plugins: [],
};

export default config;
