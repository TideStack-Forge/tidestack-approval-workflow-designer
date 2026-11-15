const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

const packageJson = require('./package.json')
const port = process.env.port || process.env.npm_config_port || 8083
const publicPath = process.env.OUROBOROS_EDITOR_PUBLIC_PATH || '/micro-workflow-editor/'
const isPlaywrightHarness = process.env.PLAYWRIGHT_HARNESS === 'true'
const apiTarget = process.env.WORKFLOW_EDITOR_API_TARGET || 'http://127.0.0.1:8088'

module.exports = (env, argv = {}) => {
  const isProduction = argv.mode === 'production'

  const htmlPlugins = [
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: path.resolve(__dirname, 'public/index.html'),
      chunks: ['app'],
    }),
  ]

  const entry = {
    app: path.resolve(__dirname, 'src/main.js'),
  }

  if (isPlaywrightHarness) {
    entry['playwright-harness'] = path.resolve(
      __dirname,
      'tests/integration/workflow/harness/index.js'
    )
    htmlPlugins.push(
      new HtmlWebpackPlugin({
        filename: 'playwright-harness.html',
        template: path.resolve(
          __dirname,
          'tests/integration/workflow/harness/playwright-harness.html'
        ),
        chunks: ['playwright-harness'],
      })
    )
  }

  return {
    mode: isProduction ? 'production' : 'development',
    entry,
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'static/js/[name].js',
      chunkFilename: 'static/js/[name].js',
      assetModuleFilename: 'static/assets/[contenthash][ext][query]',
      publicPath,
      clean: true,
      library: `${packageJson.name}-[name]`,
      libraryTarget: 'umd',
      globalObject: 'self',
    },
    devtool: isProduction ? false : 'eval-cheap-module-source-map',
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      alias: {
        'ouroboros-sdk': require('node:path').resolve(
          __dirname,
          '../ouroboros-sdk/src/main.ts'
        ),
        '@': path.resolve(__dirname, 'src'),
      },
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx|ts|tsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
          },
        },
        {
          test: /\.css$/,
          use: [isProduction ? MiniCssExtractPlugin.loader : 'style-loader', 'css-loader'],
        },
        {
          test: /\.less$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
            'less-loader',
          ],
        },
        {
          test: /\.s[ac]ss$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
            'sass-loader',
          ],
        },
        {
          test: /\.(png|jpe?g|gif|svg|webp|woff2?|eot|ttf|otf)$/i,
          type: 'asset/resource',
        },
      ],
    },
    plugins: [
      ...htmlPlugins,
      new MiniCssExtractPlugin({
        filename: 'static/css/[name].css',
        chunkFilename: 'static/css/[name].css',
      }),
    ],
    externals: isPlaywrightHarness
      ? {}
      : {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react-dom/client': 'ReactDOM',
        },
    optimization: {
      splitChunks: false,
      runtimeChunk: false,
    },
    devServer: {
      port,
      open: false,
      client: {
        overlay: false,
      },
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      static: {
        directory: path.resolve(__dirname, 'dist'),
        publicPath,
        watch: false,
      },
      devMiddleware: {
        publicPath,
      },
      proxy: [
        {
          context: ['/api'],
          changeOrigin: true,
          target: apiTarget,
        },
      ],
    },
    performance: {
      hints: false,
    },
    stats: 'minimal',
  }
}
