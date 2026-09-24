import js from '@eslint/js'
import globals from 'globals'

// The renderer is an ES module: index.html loads app.js with type="module" and it
// imports FX and IDLE_FX. The three UMD helpers stay classic scripts - node --test
// requires them as CommonJS - and each publishes one name on window.
const rendererGlobals = {
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
      sourceType: 'module',
      globals: { ...globals.browser, ...rendererGlobals }
    }
  },
  {
    // The UMD helpers load both in the browser and in node --test.
    files: ['src/renderer/js/roles.js', 'src/renderer/js/i18n/i18n.js', 'src/renderer/js/i18n/dict.js'],
    languageOptions: {
      sourceType: 'commonjs',
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
