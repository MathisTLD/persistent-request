const path = require("path");
const webpack = require("webpack");

module.exports = {
  mode: "production",
  entry: path.resolve(__dirname, "lib"),
  output: {
    library: "PersistentRequest",
    libraryTarget: "umd",
  },
  resolve: {
    fallback: {
      buffer: require.resolve("buffer/"),
      stream: require.resolve("stream-browserify"),
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: require.resolve("process/browser"),
    }),
  ],
};
