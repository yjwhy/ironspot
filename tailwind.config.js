/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#F59E0B',
          light: '#FCD34D',
          dark: '#D97706',
          50: '#FFFBEB',
        },
        text: {
          primary: '#0F172A',
          secondary: '#475569',
          tertiary: '#94A3B8',
          inverse: '#FFFFFF',
        },
        bg: {
          base: '#FFFFFF',
          elevated: '#FFFFFF',
          subtle: '#F8FAFC',
          muted: '#F1F5F9',
        },
        border: {
          DEFAULT: '#E2E8F0',
          subtle: '#F1F5F9',
          focus: '#F59E0B',
        },
        success: '#22C55E',
        error: '#EF4444',
        info: '#3B82F6',
      },
      fontFamily: {
        sans: ['Pretendard-Regular'],
        medium: ['Pretendard-Medium'],
        semibold: ['Pretendard-SemiBold'],
        bold: ['Pretendard-Bold'],
      },
      fontSize: {
        display: ['28px', { lineHeight: '34px', fontWeight: '700' }],
        'heading-lg': ['22px', { lineHeight: '29px', fontWeight: '700' }],
        'heading-md': ['18px', { lineHeight: '23px', fontWeight: '600' }],
        'heading-sm': ['16px', { lineHeight: '22px', fontWeight: '600' }],
        body: ['15px', { lineHeight: '23px', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '20px', fontWeight: '400' }],
        caption: ['11px', { lineHeight: '15px', fontWeight: '500' }],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.05)',
        md: '0 4px 6px -1px rgba(0,0,0,0.07)',
        lg: '0 10px 15px -3px rgba(0,0,0,0.08)',
        xl: '0 20px 25px -5px rgba(0,0,0,0.10)',
      },
    },
  },
  plugins: [],
};
