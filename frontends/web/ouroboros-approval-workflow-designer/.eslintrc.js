module.exports = {
  root: true,
  parser: '@babel/eslint-parser',
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  globals: {
    expect: 'readonly',
    test: 'readonly',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  plugins: ['react'],
  extends: ['eslint:recommended', 'prettier'],
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
      parserOpts: {
        plugins: ['jsx'],
      },
    },
  },
  rules: {
    // 生产环境下警告 console 的使用
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',

    // 生产环境下警告 debugger 的使用
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',

    // 是否强制使用 . 访问静态的属性名（否）
    // eg: foo['bar'] 会报错，但是如果方括号中的值是变量，就不会报错
    'dot-notation': 'off',

    // 数组或键值对最后一个元素后面必须有逗号
    'comma-dangle': [
      1,
      {
        arrays: 'always-multiline',
        objects: 'always-multiline',
        imports: 'always-multiline',
        exports: 'always-multiline',
        functions: 'never',
      },
    ],

    camelcase: 'warn', //驼峰法命名
    'react/jsx-uses-react': 'error',
    'react/jsx-uses-vars': 'error',
  },
}
