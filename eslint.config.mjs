import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  { ignores: ['.next/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'plugin:jsx-a11y/recommended'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // The only media element in the app is the music player's <audio>.
      // Song playback has no caption track to offer, and a dummy <track>
      // would announce an empty text alternative rather than help anyone.
      'jsx-a11y/media-has-caption': 'off',
    },
  },
];

export default eslintConfig;
