const path = require("path");

module.exports = {
  mode: "production",
  entry: path.resolve(__dirname, "src"),
  output: {
    library: "PersistentRequest",
    libraryTarget: "umd"
  },
  resolve: {
    fallback: {
      assert: require.resolve("assert/"),
      buffer: require.resolve("buffer/"),
      http: require.resolve("http-browserify"),
      https: require.resolve("https-browserify"),
      stream: require.resolve("stream-browserify"),
      url: require.resolve("url/"),
      util: require.resolve("util/"),
      zlib: require.resolve("browserify-zlib")
    }
  }
};
