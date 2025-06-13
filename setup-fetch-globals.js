const fetch = require("node-fetch");

module.exports = async function setupGlobals() {
  const { Blob } = await import("fetch-blob");
  const { FormData } = await import("formdata-node");

  globalThis.fetch = fetch;
  globalThis.Headers = fetch.Headers;
  globalThis.Request = fetch.Request;
  globalThis.Response = fetch.Response;
  globalThis.Blob = Blob;
  globalThis.FormData = FormData;
};
