let adapter;
if (typeof fetch !== "undefined") {
  // For browsers use fetch adapter
  adapter = require("./fetch");
} else if (
  typeof process !== "undefined" &&
  Object.prototype.toString.call(process) === "[object process]"
) {
  // For node use HTTP adapter
  adapter = require("axios/lib/adapters/http");
}

module.exports = adapter;
