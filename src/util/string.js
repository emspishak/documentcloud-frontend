/**
 * Appropriately pluralizes a word based on the quantity.
 * @param {number} value The number of items
 * @param {string} str The base string name of a singular item
 * @param {boolean} allowZero If false, return an empty string on zero items
 */
export function handlePlural(value, str, allowZero = false) {
  if (!allowZero && value == 0) return "";
  return `${value} ${simplePlural(value, str)}`;
}

/**
 * Returns a word with an "s" after it if appropriate
 * @param {number} value The number of items
 * @param {string} string The base string name of a single item
 */
export function simplePlural(value, string) {
  return string + (value != 1 ? "s" : "");
}

/**
 * Pluralizes a word and puts the number before it only if non-singular,
 * e.g. for the "selected document" vs. for the "3 selected documents"
 * @param {number} value The number of items
 * @param {string} string The base string name of a single item
 */
export function nameSingularNumberPlural(value, string) {
  return `${value == 1 ? "" : `${value} `}${simplePlural(value, string)}`;
}

/**
 * Formats a size to a human-readable format
 * @param {number} bytes The number of bytes
 * @param {number} decimals Number of decimal places
 */
export function formatBytes(bytes, decimals = 0) {
  // from https://stackoverflow.com/a/18650828/1404888
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Strips the extension part of a filename
 * @param {string} filename The filename
 */
export function stripExtension(filename) {
  const parts = filename.split(".");
  return parts.slice(0, parts.length - 1).join(".");
}

export function slugify(str, id = null, maxLength = 25) {
  const slug = str
    .substring(0, maxLength)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  if (id != null) return `${slug}-${id}`;
  return slug;
}

export function extractSlugId(str) {
  // Must be valid slug
  if (!/^[a-z0-9-]+$/.test(str)) return null;
  const parts = str.split("-");
  if (parts.length == 0) return null;
  return parts[parts.length - 1];
}

export function titlecase(str) {
  return str.charAt(0).toUpperCase() + str.substr(1);
}

export function allIndices(text, query) {
  const results = [];
  let pos = 0;
  while (true) {
    const idx = text.indexOf(query, pos);
    if (idx == -1) return results;
    results.push(idx);
    pos = idx + 1;
  }
}

export function isNumber(s) {
  return Number.isFinite(parseFloat(s));
}

export function lpad(s, length, fill = "0") {
  while (s.length < length) {
    s = `${fill}${s}`;
  }
  return s;
}

/** nFormatter retuns a number in shorthand string notation.
 *
 *  Example: `nFormatter(1234, 1)` returns `"1.2K"`.
 *
 *  This code is sourced from https://stackoverflow.com/a/9462382
 *
 * @param {Number} num
 * @param {Number} digits
 * @returns {String}
 */
export function nFormatter(num, digits) {
  const lookup = [
    { value: 1, symbol: "" },
    { value: 1e3, symbol: "K" },
    { value: 1e6, symbol: "M" },
    { value: 1e9, symbol: "B" },
    { value: 1e12, symbol: "T" },
  ];
  const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
  var item = lookup
    .slice()
    .reverse()
    .find(function (item) {
      return num >= item.value;
    });
  return item
    ? (num / item.value).toFixed(digits).replace(rx, "$1") + item.symbol
    : "0";
}
