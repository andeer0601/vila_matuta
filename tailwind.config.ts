import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        rustic: {
          50: '#FDFBF7',
          100: '#F5F0EB',
          200: '#EDE0D4',
          300: '#E6CCB2',
          400: '#DDB892',
          500: '#B08968',
          600: '#8B5A2B',
          700: '#5C4033',
          800: '#3E2723',
          900: '#27170E',
        },
        terracotta: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#EA580C',
          600: '#D9480F',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        olive: {
          50: '#F4F6F0',
          100: '#E7ECDE',
          200: '#CFDCBD',
          300: '#AEC393',
          400: '#8DAA6B',
          500: '#606C38',
          600: '#4D582A',
          700: '#3A431F',
          800: '#283618',
          900: '#19220F',
        }
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'rustic': '0 4px 20px -2px rgba(92, 64, 51, 0.12), 0 2px 6px -1px rgba(92, 64, 51, 0.08)',
        'rustic-lg': '0 10px 30px -4px rgba(92, 64, 51, 0.18), 0 4px 12px -2px rgba(92, 64, 51, 0.12)',
        'rustic-inner': 'inset 0 2px 4px 0 rgba(92, 64, 51, 0.08)',
      },
      borderRadius: {
        'rustic': '1rem',
      }
    },
  },
  plugins: [],
};
export default config;
