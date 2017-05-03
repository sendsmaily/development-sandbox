const path = require('path');

const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {

  entry: ['babel-polyfill', 'es6-promise', path.resolve(__dirname, 'app/index.jsx')],

  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '',
  },

  devServer: {
    host: '0.0.0.0',
    port: 8000,
    disableHostCheck: true,
    contentBase: path.join(__dirname, 'dist'),
    watchContentBase: true,
  },

  // Add source map, without full re-build on every compilation.
  devtool: 'cheap-module-source-map',

  resolve: {
    // We're adding app to modules path so we can use absolute imports on app codebase.
    modules: [path.resolve(__dirname, 'app'), 'node_modules'],
    extensions: ['.js', '.jsx', '.scss'],
  },

  plugins: [
    new ExtractTextPlugin({
      filename: 'styles.css',
      allChunks: true,
    }),
    new webpack.LoaderOptionsPlugin({
      options: {
        eslint: {
          configFile: path.resolve(__dirname, '.eslintrc'),
        },
        context: path.resolve(__dirname),
      },
    }),
    new HtmlWebpackPlugin({
      title: 'Awesome demo app',
      template: 'app/templates/app.ejs',
      filename: 'index.html',
      inject: 'body',
    }),
  ],

  stats: {
    children: false,
  },

  module: {
    loaders: [
      {
        test: /\.(js|jsx)$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        query: {
          sourceMaps: true,
        },
      },
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        loader: 'eslint-loader',
      },
      {
        // Common CSS loader.
        test: /\.css$/,
        loader: ExtractTextPlugin.extract('css-loader?sourceMap'),
      },
      {
        // Component SASS loader.
        test: /\.scss$/,
        loader: ExtractTextPlugin.extract([
          'css-loader?sourceMap&importLoaders=1',
          'sass-loader?outputStyle=expanded',
        ]),
      },
    ],
  },
};
