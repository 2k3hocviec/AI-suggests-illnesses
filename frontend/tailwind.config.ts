import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7ff',
          100: '#d9edff',
          500: '#1976d2',
          600: '#1065b8',
          700: '#0b4f91',
        },
        ink: '#172033',
      },
      boxShadow: {
        auth: '0 18px 50px rgba(28, 45, 78, 0.10)',
      },
    },
  },
  plugins: [],
};

export default config;
