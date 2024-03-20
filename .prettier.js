module.exports = {
    bracketSpacing: true,
    bracketSameLine: true,
    singleQuote: true,
    jsxSingleQuote: false,
    trailingComma: 'all',
    semi: false,
    tabWidth: 2,
    printWidth: 80,
    arrowParens: 'always',
    importOrder: [
      '^@lib/(.*)$',
      '^~/(.*)$',
      '^[./]',
    ],
    importOrderSeparation: true,
    plugins: [
      require('@ianvs/prettier-plugin-sort-imports'),
    ],
  }
  