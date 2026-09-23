import js from '@eslint/js'
import globals from 'globals'

// Renderer scripts are classic <script src> files, not modules: the five UMD
// helpers publish one name each on window, and app.js consumes them.
const rendererGlobals = {
  FX: 'readonly',
  IDLE_FX: 'readonly',
  I18N: 'readonly',
  ROLES: 'readonly',
  DICT: 'readonly'
}

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'release/**']
  },
  js.configs.recommended,
  {
    files: ['src/main/**/*.js', 'src/preload/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: globals.node
    }
  },
  {
    files: ['src/renderer/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: { ...globals.browser, ...rendererGlobals }
    }
  },
  {
    // The UMD helpers load both in the browser and in node --test.
    files: ['src/renderer/js/roles.js', 'src/renderer/js/i18n/i18n.js', 'src/renderer/js/i18n/dict.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.commonjs }
    }
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: globals.node
    }
  }
]
