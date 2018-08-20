const path = require('path')
const CleanWebpackPlugin = require('clean-webpack-plugin')

module.exports = {
  mode: 'development',
  devtool: 'source-map',
  entry: {
    index: path.join(__dirname, 'src', 'EventSourcePolyfill.ts')
  },
  output: {
    path: path.join(__dirname, './dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    library: 'EventSourcePolyfill'
  },
  resolve: {
    extensions: ['.ts']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'awesome-typescript-loader'
      }
    ]
  },
  plugins: [
    new CleanWebpackPlugin([path.join(__dirname, 'dist/**/*')])
  ]
}
