module.exports = {
  root: true,
  extends: ['next/core-web-vitals', 'prettier'],
  plugins: ['tailwindcss'],
  rules: {
    'tailwindcss/classnames-order': 'warn',
    'tailwindcss/enforces-shorthand': 'warn',
  },
  settings: {
    tailwindcss: {
      callees: ['className', 'cn', 'clsx', 'twMerge'],
    },
  },
};
