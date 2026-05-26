/** @type {import('tailwindcss').Config} */

// ============================================================
// SorgyAI — Tailwind CSS Configuration
// Theme: Cyber-Glass — Glassmorphism + Electric Blue + LED Glow
// ============================================================
// Design language:
//   • Deep space dark backgrounds (not pure black — layered navy/slate)
//   • Semi-transparent glass panels (backdrop-blur + rgba borders)
//   • Electric blue (#00D4FF) as primary accent — cyan-leaning
//   • Silver-white (#E8F4FD) for primary text and highlights
//   • LED glow effects via box-shadow and drop-shadow utilities
//   • Subtle gradient meshes on backgrounds
// ============================================================

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],

  theme: {
    extend: {

      // ----------------------------------------------------------
      // COLOR PALETTE
      // ----------------------------------------------------------
      colors: {
        // Primary electric blue family
        electric: {
          50:  '#e6fbff',
          100: '#b3f4ff',
          200: '#80edff',
          300: '#4de6ff',
          400: '#1adfff',
          500: '#00D4FF',   // ← Core accent: electric cyan-blue
          600: '#00aacf',
          700: '#00809f',
          800: '#00556f',
          900: '#002b3f',
          950: '#001520',
        },

        // Deep space backgrounds
        void: {
          50:  '#e8edf5',
          100: '#c5d0e0',
          200: '#8ea3c0',
          300: '#5a76a0',
          400: '#2e4d80',
          500: '#0d2550',
          600: '#091c3d',
          700: '#06132a',
          800: '#030c1a',   // ← Main app background
          900: '#010609',
          950: '#000304',
        },

        // Silver / glass-white for text and borders
        silver: {
          50:  '#f8fafc',
          100: '#f0f4f8',
          200: '#dde6ef',   // ← Glass border color
          300: '#bccad6',
          400: '#94a8ba',
          500: '#6b889e',
          600: '#4d6880',
          700: '#35506a',
          800: '#1e3a52',
          900: '#0c2035',
        },

        // Neon green for success/live indicators
        neon: {
          green:  '#00FF88',
          yellow: '#FFE500',
          pink:   '#FF00C8',
          purple: '#9D00FF',
        },
      },

      // ----------------------------------------------------------
      // TYPOGRAPHY
      // ----------------------------------------------------------
      fontFamily: {
        // Display: sharp, geometric, futuristic
        display: ['"Orbitron"', '"Space Grotesk"', 'sans-serif'],
        // Body: clean legibility
        body:    ['"DM Sans"', '"Manrope"', 'sans-serif'],
        // Mono: for code snippets, IDs
        mono:    ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },

      // ----------------------------------------------------------
      // BACKGROUND GRADIENTS (used as CSS var references)
      // ----------------------------------------------------------
      backgroundImage: {
        // Main app deep space gradient
        'space-deep': 'radial-gradient(ellipse at 20% 20%, #0d2550 0%, #030c1a 50%, #000304 100%)',
        // Panel glass gradient
        'glass-panel': 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
        // Electric blue gradient (buttons, accents)
        'electric-gradient': 'linear-gradient(135deg, #00D4FF 0%, #0066FF 100%)',
        // Subtle LED sweep for borders
        'led-border': 'linear-gradient(90deg, transparent, #00D4FF, transparent)',
        // Hero mesh background
        'mesh-hero': `
          radial-gradient(ellipse at 10% 50%, rgba(0,212,255,0.12) 0%, transparent 50%),
          radial-gradient(ellipse at 90% 20%, rgba(0,102,255,0.10) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 90%, rgba(157,0,255,0.06) 0%, transparent 50%)
        `,
      },

      // ----------------------------------------------------------
      // BOX SHADOWS — LED Glow System
      // ----------------------------------------------------------
      boxShadow: {
        // Core LED glow — electric blue
        'glow-sm':  '0 0 8px rgba(0, 212, 255, 0.35)',
        'glow-md':  '0 0 20px rgba(0, 212, 255, 0.40), 0 0 40px rgba(0, 212, 255, 0.15)',
        'glow-lg':  '0 0 30px rgba(0, 212, 255, 0.50), 0 0 80px rgba(0, 212, 255, 0.20)',
        'glow-xl':  '0 0 60px rgba(0, 212, 255, 0.60), 0 0 120px rgba(0, 102, 255, 0.25)',

        // Neon variants
        'glow-green':  '0 0 20px rgba(0, 255, 136, 0.45)',
        'glow-purple': '0 0 20px rgba(157, 0, 255, 0.45)',
        'glow-pink':   '0 0 20px rgba(255, 0, 200, 0.45)',

        // Glass panel shadow
        'glass':    '0 8px 32px rgba(0, 0, 0, 0.40), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glass-lg': '0 16px 64px rgba(0, 0, 0, 0.60), inset 0 1px 0 rgba(255,255,255,0.10)',

        // Inset for pressed/active states
        'inner-glow': 'inset 0 0 20px rgba(0, 212, 255, 0.10)',
      },

      // ----------------------------------------------------------
      // BORDER RADIUS — slightly rounded, not bubbly
      // ----------------------------------------------------------
      borderRadius: {
        'glass': '16px',
        'glass-sm': '10px',
        'glass-lg': '24px',
      },

      // ----------------------------------------------------------
      // BACKDROP BLUR — Glassmorphism core
      // ----------------------------------------------------------
      backdropBlur: {
        'glass':    '12px',
        'glass-sm': '6px',
        'glass-lg': '24px',
        'glass-xl': '40px',
      },

      // ----------------------------------------------------------
      // BORDER — Glass borders
      // ----------------------------------------------------------
      borderColor: {
        'glass':        'rgba(255, 255, 255, 0.10)',
        'glass-bright': 'rgba(255, 255, 255, 0.20)',
        'electric':     'rgba(0, 212, 255, 0.40)',
        'electric-dim': 'rgba(0, 212, 255, 0.15)',
      },

      // ----------------------------------------------------------
      // ANIMATIONS
      // ----------------------------------------------------------
      keyframes: {
        // Slow pulsing LED glow
        'led-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(0,212,255,0.3), 0 0 20px rgba(0,212,255,0.1)' },
          '50%':      { boxShadow: '0 0 20px rgba(0,212,255,0.6), 0 0 50px rgba(0,212,255,0.3)' },
        },
        // Horizontal LED sweep
        'led-sweep': {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        // Fade in upward
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Typing cursor blink
        'cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        // Slow background mesh drift
        'mesh-drift': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%':      { transform: 'translate(10px, -10px) scale(1.02)' },
          '66%':      { transform: 'translate(-8px, 6px) scale(0.98)' },
        },
        // Scanning line effect
        'scan-line': {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        // Dot loader
        'dot-bounce': {
          '0%, 80%, 100%': { transform: 'scale(0)', opacity: '0.3' },
          '40%':            { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'led-pulse':   'led-pulse 2.5s ease-in-out infinite',
        'led-sweep':   'led-sweep 3s linear infinite',
        'fade-up':     'fade-up 0.4s ease-out both',
        'cursor-blink':'cursor-blink 1s step-end infinite',
        'mesh-drift':  'mesh-drift 15s ease-in-out infinite',
        'scan-line':   'scan-line 8s linear infinite',
        'dot-bounce':  'dot-bounce 1.4s ease-in-out infinite',
        'dot-bounce-delay-1': 'dot-bounce 1.4s ease-in-out 0.2s infinite',
        'dot-bounce-delay-2': 'dot-bounce 1.4s ease-in-out 0.4s infinite',
      },

      // ----------------------------------------------------------
      // SCREENS — standard, no changes needed
      // ----------------------------------------------------------
    },
  },

  plugins: [
    // ── Plugin: Glass utility classes ─────────────────────────
    function({ addComponents, addUtilities, theme }) {

      // Glass panel component
      addComponents({
        '.glass-panel': {
          background: 'rgba(13, 37, 80, 0.45)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.09)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.40), inset 0 1px 0 rgba(255,255,255,0.08)',
        },
        '.glass-panel-bright': {
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.30), inset 0 1px 0 rgba(255,255,255,0.12)',
        },
        '.glass-input': {
          background: 'rgba(3, 12, 26, 0.60)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(0, 212, 255, 0.20)',
          borderRadius: '10px',
          color: '#E8F4FD',
          '&:focus': {
            outline: 'none',
            borderColor: 'rgba(0, 212, 255, 0.60)',
            boxShadow: '0 0 0 3px rgba(0, 212, 255, 0.10)',
          },
          '&::placeholder': {
            color: 'rgba(148, 168, 186, 0.60)',
          },
        },
        '.btn-electric': {
          background: 'linear-gradient(135deg, #00D4FF 0%, #0066FF 100%)',
          color: '#000304',
          fontWeight: '600',
          borderRadius: '10px',
          padding: '10px 24px',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 0 20px rgba(0,212,255,0.35)',
          '&:hover': {
            boxShadow: '0 0 30px rgba(0,212,255,0.55), 0 0 60px rgba(0,102,255,0.25)',
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        '.btn-glass': {
          background: 'rgba(0, 212, 255, 0.08)',
          color: '#00D4FF',
          fontWeight: '500',
          borderRadius: '10px',
          padding: '10px 24px',
          border: '1px solid rgba(0, 212, 255, 0.30)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            background: 'rgba(0, 212, 255, 0.15)',
            boxShadow: '0 0 20px rgba(0,212,255,0.25)',
          },
        },
        '.led-dot': {
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#00FF88',
          boxShadow: '0 0 6px #00FF88, 0 0 12px rgba(0,255,136,0.5)',
        },
        '.led-dot-blue': {
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#00D4FF',
          boxShadow: '0 0 6px #00D4FF, 0 0 12px rgba(0,212,255,0.5)',
        },
      })

      // Utility helpers
      addUtilities({
        '.text-glow-electric': {
          textShadow: '0 0 20px rgba(0,212,255,0.7), 0 0 40px rgba(0,212,255,0.3)',
        },
        '.text-glow-white': {
          textShadow: '0 0 20px rgba(255,255,255,0.5)',
        },
        '.border-led': {
          borderImage: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.6), transparent) 1',
        },
        '.scrollbar-glass': {
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0,212,255,0.3) transparent',
        },
      })
    },
  ],
}
