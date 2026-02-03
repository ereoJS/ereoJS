/**
 * @ereo/plugin-tailwind - Framework Preset
 *
 * Tailwind CSS preset with sensible defaults for Ereo apps.
 */

/**
 * Ereo Tailwind preset.
 */
export const ereoPreset = {
  theme: {
    extend: {
      // Animation utilities for transitions
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },

      // Typography
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'monospace',
        ],
      },

      // Spacing
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },

      // Colors
      colors: {
        ereo: {
          50: '#f5f7ff',
          100: '#ebf0fe',
          200: '#d6e0fd',
          300: '#b3c7fb',
          400: '#8aa8f8',
          500: '#6285f4',
          600: '#4361ee',
          700: '#3451d1',
          800: '#2c43aa',
          900: '#273b87',
          950: '#1a2552',
        },
      },

      // Border radius
      borderRadius: {
        '4xl': '2rem',
      },

      // Box shadow
      boxShadow: {
        'inner-sm': 'inset 0 1px 2px 0 rgb(0 0 0 / 0.05)',
      },

      // Z-index
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
    },
  },

  plugins: [],
};

/**
 * Get Tailwind config with Ereo preset.
 */
export function getEreoTailwindConfig(overrides: Record<string, any> = {}) {
  return {
    presets: [ereoPreset],
    content: [
      './app/**/*.{js,ts,jsx,tsx}',
      './components/**/*.{js,ts,jsx,tsx}',
    ],
    darkMode: 'class' as const,
    ...overrides,
    theme: {
      extend: {
        ...ereoPreset.theme.extend,
        ...overrides.theme?.extend,
      },
    },
  };
}

export default ereoPreset;
