const path = require("path");

module.exports = {
  mode: "production",
  entry: path.resolve(__dirname, "src"),
  output: {
    library: "PersistentRequest",
    libraryTarget: "umd",
  },
  resolve: {
    fallback: {
      buffer: require.resolve("buffer/"),
      http: require.resolve("http-browserify"),
      stream: require.resolve("stream-browserify"),
    },
  },
};
