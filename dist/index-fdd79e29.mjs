import { pathToFileURL } from 'url';
import { version as version$1, transformSync as transformSync$1, transform as transform$1 } from 'esbuild';
import crypto from 'crypto';
import MagicString from 'magic-string';
import { init, parse } from 'es-module-lexer';
import { parse as parse$1 } from 'es-module-lexer/js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const sha1 = (data) => crypto.createHash("sha1").update(data).digest("hex");

let wasmParserInitialized = false;
init.then(() => {
  wasmParserInitialized = true;
});
const parseEsm = (code) => wasmParserInitialized ? parse(code) : parse$1(code);

const version = "1";
const toEsmFunctionString = ((imported) => {
  const d = "default";
  const exports = Object.keys(imported);
  if (exports.length === 1 && exports[0] === d && imported[d] && typeof imported[d] === "object" && "__esModule" in imported[d]) {
    return imported[d];
  }
  return imported;
}).toString();
const handleDynamicImport = `.then(${toEsmFunctionString})`;
const transformDynamicImport = (filePath, code) => {
  if (!code.includes("import")) {
    return;
  }
  const dynamicImports = parseEsm(code)[0].filter((maybeDynamic) => maybeDynamic.d > -1);
  if (dynamicImports.length === 0) {
    return;
  }
  const magicString = new MagicString(code);
  for (const dynamicImport of dynamicImports) {
    magicString.appendRight(dynamicImport.se, handleDynamicImport);
  }
  const newCode = magicString.toString();
  const newMap = magicString.generateMap({
    source: filePath,
    includeContent: false
    /**
     * The performance hit on this is very high
     * Since we're only transforming import()s, I think this may be overkill
     */
    // hires: 'boundary',
  });
  return {
    code: newCode,
    map: newMap
  };
};

function readJsonFile(filePath) {
  try {
    const jsonString = fs.readFileSync(filePath, "utf8");
    return JSON.parse(jsonString);
  } catch {
  }
}

const getTime = () => Math.floor(Date.now() / 1e8);
const tmpdir = os.tmpdir();
const noop = () => {
};
const { geteuid } = process;
const userId = geteuid ? geteuid() : os.userInfo().username;
class FileCache extends Map {
  /**
   * By using tmpdir, the expectation is for the OS to clean any files
   * that haven't been read for a while.
   *
   * macOS - 3 days: https://superuser.com/a/187105
   * Linux - https://serverfault.com/a/377349
   *
   * Note on Windows, temp files are not cleaned up automatically.
   * https://superuser.com/a/1599897
   */
  cacheDirectory = path.join(
    // Write permissions by anyone
    tmpdir,
    `tsx-${userId}`
  );
  // Maintained so we can remove it on Windows
  oldCacheDirectory = path.join(tmpdir, "tsx");
  cacheFiles;
  constructor() {
    super();
    fs.mkdirSync(this.cacheDirectory, { recursive: true });
    this.cacheFiles = fs.readdirSync(this.cacheDirectory).map((fileName) => {
      const [time, key] = fileName.split("-");
      return {
        time: Number(time),
        key,
        fileName
      };
    });
    setImmediate(() => {
      this.expireDiskCache();
      this.removeOldCacheDirectory();
    });
  }
  get(key) {
    const memoryCacheHit = super.get(key);
    if (memoryCacheHit) {
      return memoryCacheHit;
    }
    const diskCacheHit = this.cacheFiles.find((cache) => cache.key === key);
    if (!diskCacheHit) {
      return;
    }
    const cacheFilePath = path.join(this.cacheDirectory, diskCacheHit.fileName);
    const cachedResult = readJsonFile(cacheFilePath);
    if (!cachedResult) {
      fs.promises.unlink(cacheFilePath).then(
        () => {
          const index = this.cacheFiles.indexOf(diskCacheHit);
          this.cacheFiles.splice(index, 1);
        },
        () => {
        }
      );
      return;
    }
    super.set(key, cachedResult);
    return cachedResult;
  }
  set(key, value) {
    super.set(key, value);
    if (value) {
      const time = getTime();
      fs.promises.writeFile(
        path.join(this.cacheDirectory, `${time}-${key}`),
        JSON.stringify(value)
      ).catch(noop);
    }
    return this;
  }
  expireDiskCache() {
    const time = getTime();
    for (const cache of this.cacheFiles) {
      if (time - cache.time > 7) {
        fs.promises.unlink(path.join(this.cacheDirectory, cache.fileName)).catch(noop);
      }
    }
  }
  async removeOldCacheDirectory() {
    try {
      const exists = await fs.promises.access(this.oldCacheDirectory).then(() => true);
      if (exists) {
        if ("rm" in fs.promises) {
          await fs.promises.rm(
            this.oldCacheDirectory,
            {
              recursive: true,
              force: true
            }
          );
        } else {
          await fs.promises.rmdir(
            this.oldCacheDirectory,
            { recursive: true }
          );
        }
      }
    } catch {
    }
  }
}
var cache = process.env.TSX_DISABLE_CACHE ? /* @__PURE__ */ new Map() : new FileCache();

const comma = ','.charCodeAt(0);
const semicolon = ';'.charCodeAt(0);
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const intToChar = new Uint8Array(64); // 64 possible chars.
const charToInt = new Uint8Array(128); // z is 122 in ASCII
for (let i = 0; i < chars.length; i++) {
    const c = chars.charCodeAt(i);
    intToChar[i] = c;
    charToInt[c] = i;
}
// Provide a fallback for older environments.
const td = typeof TextDecoder !== 'undefined'
    ? /* #__PURE__ */ new TextDecoder()
    : typeof Buffer !== 'undefined'
        ? {
            decode(buf) {
                const out = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
                return out.toString();
            },
        }
        : {
            decode(buf) {
                let out = '';
                for (let i = 0; i < buf.length; i++) {
                    out += String.fromCharCode(buf[i]);
                }
                return out;
            },
        };
function decode(mappings) {
    const state = new Int32Array(5);
    const decoded = [];
    let index = 0;
    do {
        const semi = indexOf(mappings, index);
        const line = [];
        let sorted = true;
        let lastCol = 0;
        state[0] = 0;
        for (let i = index; i < semi; i++) {
            let seg;
            i = decodeInteger(mappings, i, state, 0); // genColumn
            const col = state[0];
            if (col < lastCol)
                sorted = false;
            lastCol = col;
            if (hasMoreVlq(mappings, i, semi)) {
                i = decodeInteger(mappings, i, state, 1); // sourcesIndex
                i = decodeInteger(mappings, i, state, 2); // sourceLine
                i = decodeInteger(mappings, i, state, 3); // sourceColumn
                if (hasMoreVlq(mappings, i, semi)) {
                    i = decodeInteger(mappings, i, state, 4); // namesIndex
                    seg = [col, state[1], state[2], state[3], state[4]];
                }
                else {
                    seg = [col, state[1], state[2], state[3]];
                }
            }
            else {
                seg = [col];
            }
            line.push(seg);
        }
        if (!sorted)
            sort(line);
        decoded.push(line);
        index = semi + 1;
    } while (index <= mappings.length);
    return decoded;
}
function indexOf(mappings, index) {
    const idx = mappings.indexOf(';', index);
    return idx === -1 ? mappings.length : idx;
}
function decodeInteger(mappings, pos, state, j) {
    let value = 0;
    let shift = 0;
    let integer = 0;
    do {
        const c = mappings.charCodeAt(pos++);
        integer = charToInt[c];
        value |= (integer & 31) << shift;
        shift += 5;
    } while (integer & 32);
    const shouldNegate = value & 1;
    value >>>= 1;
    if (shouldNegate) {
        value = -0x80000000 | -value;
    }
    state[j] += value;
    return pos;
}
function hasMoreVlq(mappings, i, length) {
    if (i >= length)
        return false;
    return mappings.charCodeAt(i) !== comma;
}
function sort(line) {
    line.sort(sortComparator$1);
}
function sortComparator$1(a, b) {
    return a[0] - b[0];
}
function encode(decoded) {
    const state = new Int32Array(5);
    const bufLength = 1024 * 16;
    const subLength = bufLength - 36;
    const buf = new Uint8Array(bufLength);
    const sub = buf.subarray(0, subLength);
    let pos = 0;
    let out = '';
    for (let i = 0; i < decoded.length; i++) {
        const line = decoded[i];
        if (i > 0) {
            if (pos === bufLength) {
                out += td.decode(buf);
                pos = 0;
            }
            buf[pos++] = semicolon;
        }
        if (line.length === 0)
            continue;
        state[0] = 0;
        for (let j = 0; j < line.length; j++) {
            const segment = line[j];
            // We can push up to 5 ints, each int can take at most 7 chars, and we
            // may push a comma.
            if (pos > subLength) {
                out += td.decode(sub);
                buf.copyWithin(0, subLength, pos);
                pos -= subLength;
            }
            if (j > 0)
                buf[pos++] = comma;
            pos = encodeInteger(buf, pos, state, segment, 0); // genColumn
            if (segment.length === 1)
                continue;
            pos = encodeInteger(buf, pos, state, segment, 1); // sourcesIndex
            pos = encodeInteger(buf, pos, state, segment, 2); // sourceLine
            pos = encodeInteger(buf, pos, state, segment, 3); // sourceColumn
            if (segment.length === 4)
                continue;
            pos = encodeInteger(buf, pos, state, segment, 4); // namesIndex
        }
    }
    return out + td.decode(buf.subarray(0, pos));
}
function encodeInteger(buf, pos, state, segment, j) {
    const next = segment[j];
    let num = next - state[j];
    state[j] = next;
    num = num < 0 ? (-num << 1) | 1 : num << 1;
    do {
        let clamped = num & 0b011111;
        num >>>= 5;
        if (num > 0)
            clamped |= 0b100000;
        buf[pos++] = intToChar[clamped];
    } while (num > 0);
    return pos;
}

// Matches the scheme of a URL, eg "http://"
const schemeRegex = /^[\w+.-]+:\/\//;
/**
 * Matches the parts of a URL:
 * 1. Scheme, including ":", guaranteed.
 * 2. User/password, including "@", optional.
 * 3. Host, guaranteed.
 * 4. Port, including ":", optional.
 * 5. Path, including "/", optional.
 * 6. Query, including "?", optional.
 * 7. Hash, including "#", optional.
 */
const urlRegex = /^([\w+.-]+:)\/\/([^@/#?]*@)?([^:/#?]*)(:\d+)?(\/[^#?]*)?(\?[^#]*)?(#.*)?/;
/**
 * File URLs are weird. They dont' need the regular `//` in the scheme, they may or may not start
 * with a leading `/`, they can have a domain (but only if they don't start with a Windows drive).
 *
 * 1. Host, optional.
 * 2. Path, which may include "/", guaranteed.
 * 3. Query, including "?", optional.
 * 4. Hash, including "#", optional.
 */
const fileRegex = /^file:(?:\/\/((?![a-z]:)[^/#?]*)?)?(\/?[^#?]*)(\?[^#]*)?(#.*)?/i;
var UrlType;
(function (UrlType) {
    UrlType[UrlType["Empty"] = 1] = "Empty";
    UrlType[UrlType["Hash"] = 2] = "Hash";
    UrlType[UrlType["Query"] = 3] = "Query";
    UrlType[UrlType["RelativePath"] = 4] = "RelativePath";
    UrlType[UrlType["AbsolutePath"] = 5] = "AbsolutePath";
    UrlType[UrlType["SchemeRelative"] = 6] = "SchemeRelative";
    UrlType[UrlType["Absolute"] = 7] = "Absolute";
})(UrlType || (UrlType = {}));
function isAbsoluteUrl(input) {
    return schemeRegex.test(input);
}
function isSchemeRelativeUrl(input) {
    return input.startsWith('//');
}
function isAbsolutePath(input) {
    return input.startsWith('/');
}
function isFileUrl(input) {
    return input.startsWith('file:');
}
function isRelative(input) {
    return /^[.?#]/.test(input);
}
function parseAbsoluteUrl(input) {
    const match = urlRegex.exec(input);
    return makeUrl(match[1], match[2] || '', match[3], match[4] || '', match[5] || '/', match[6] || '', match[7] || '');
}
function parseFileUrl(input) {
    const match = fileRegex.exec(input);
    const path = match[2];
    return makeUrl('file:', '', match[1] || '', '', isAbsolutePath(path) ? path : '/' + path, match[3] || '', match[4] || '');
}
function makeUrl(scheme, user, host, port, path, query, hash) {
    return {
        scheme,
        user,
        host,
        port,
        path,
        query,
        hash,
        type: UrlType.Absolute,
    };
}
function parseUrl(input) {
    if (isSchemeRelativeUrl(input)) {
        const url = parseAbsoluteUrl('http:' + input);
        url.scheme = '';
        url.type = UrlType.SchemeRelative;
        return url;
    }
    if (isAbsolutePath(input)) {
        const url = parseAbsoluteUrl('http://foo.com' + input);
        url.scheme = '';
        url.host = '';
        url.type = UrlType.AbsolutePath;
        return url;
    }
    if (isFileUrl(input))
        return parseFileUrl(input);
    if (isAbsoluteUrl(input))
        return parseAbsoluteUrl(input);
    const url = parseAbsoluteUrl('http://foo.com/' + input);
    url.scheme = '';
    url.host = '';
    url.type = input
        ? input.startsWith('?')
            ? UrlType.Query
            : input.startsWith('#')
                ? UrlType.Hash
                : UrlType.RelativePath
        : UrlType.Empty;
    return url;
}
function stripPathFilename(path) {
    // If a path ends with a parent directory "..", then it's a relative path with excess parent
    // paths. It's not a file, so we can't strip it.
    if (path.endsWith('/..'))
        return path;
    const index = path.lastIndexOf('/');
    return path.slice(0, index + 1);
}
function mergePaths(url, base) {
    normalizePath(base, base.type);
    // If the path is just a "/", then it was an empty path to begin with (remember, we're a relative
    // path).
    if (url.path === '/') {
        url.path = base.path;
    }
    else {
        // Resolution happens relative to the base path's directory, not the file.
        url.path = stripPathFilename(base.path) + url.path;
    }
}
/**
 * The path can have empty directories "//", unneeded parents "foo/..", or current directory
 * "foo/.". We need to normalize to a standard representation.
 */
function normalizePath(url, type) {
    const rel = type <= UrlType.RelativePath;
    const pieces = url.path.split('/');
    // We need to preserve the first piece always, so that we output a leading slash. The item at
    // pieces[0] is an empty string.
    let pointer = 1;
    // Positive is the number of real directories we've output, used for popping a parent directory.
    // Eg, "foo/bar/.." will have a positive 2, and we can decrement to be left with just "foo".
    let positive = 0;
    // We need to keep a trailing slash if we encounter an empty directory (eg, splitting "foo/" will
    // generate `["foo", ""]` pieces). And, if we pop a parent directory. But once we encounter a
    // real directory, we won't need to append, unless the other conditions happen again.
    let addTrailingSlash = false;
    for (let i = 1; i < pieces.length; i++) {
        const piece = pieces[i];
        // An empty directory, could be a trailing slash, or just a double "//" in the path.
        if (!piece) {
            addTrailingSlash = true;
            continue;
        }
        // If we encounter a real directory, then we don't need to append anymore.
        addTrailingSlash = false;
        // A current directory, which we can always drop.
        if (piece === '.')
            continue;
        // A parent directory, we need to see if there are any real directories we can pop. Else, we
        // have an excess of parents, and we'll need to keep the "..".
        if (piece === '..') {
            if (positive) {
                addTrailingSlash = true;
                positive--;
                pointer--;
            }
            else if (rel) {
                // If we're in a relativePath, then we need to keep the excess parents. Else, in an absolute
                // URL, protocol relative URL, or an absolute path, we don't need to keep excess.
                pieces[pointer++] = piece;
            }
            continue;
        }
        // We've encountered a real directory. Move it to the next insertion pointer, which accounts for
        // any popped or dropped directories.
        pieces[pointer++] = piece;
        positive++;
    }
    let path = '';
    for (let i = 1; i < pointer; i++) {
        path += '/' + pieces[i];
    }
    if (!path || (addTrailingSlash && !path.endsWith('/..'))) {
        path += '/';
    }
    url.path = path;
}
/**
 * Attempts to resolve `input` URL/path relative to `base`.
 */
function resolve$1(input, base) {
    if (!input && !base)
        return '';
    const url = parseUrl(input);
    let inputType = url.type;
    if (base && inputType !== UrlType.Absolute) {
        const baseUrl = parseUrl(base);
        const baseType = baseUrl.type;
        switch (inputType) {
            case UrlType.Empty:
                url.hash = baseUrl.hash;
            // fall through
            case UrlType.Hash:
                url.query = baseUrl.query;
            // fall through
            case UrlType.Query:
            case UrlType.RelativePath:
                mergePaths(url, baseUrl);
            // fall through
            case UrlType.AbsolutePath:
                // The host, user, and port are joined, you can't copy one without the others.
                url.user = baseUrl.user;
                url.host = baseUrl.host;
                url.port = baseUrl.port;
            // fall through
            case UrlType.SchemeRelative:
                // The input doesn't have a schema at least, so we need to copy at least that over.
                url.scheme = baseUrl.scheme;
        }
        if (baseType > inputType)
            inputType = baseType;
    }
    normalizePath(url, inputType);
    const queryHash = url.query + url.hash;
    switch (inputType) {
        // This is impossible, because of the empty checks at the start of the function.
        // case UrlType.Empty:
        case UrlType.Hash:
        case UrlType.Query:
            return queryHash;
        case UrlType.RelativePath: {
            // The first char is always a "/", and we need it to be relative.
            const path = url.path.slice(1);
            if (!path)
                return queryHash || '.';
            if (isRelative(base || input) && !isRelative(path)) {
                // If base started with a leading ".", or there is no base and input started with a ".",
                // then we need to ensure that the relative path starts with a ".". We don't know if
                // relative starts with a "..", though, so check before prepending.
                return './' + path + queryHash;
            }
            return path + queryHash;
        }
        case UrlType.AbsolutePath:
            return url.path + queryHash;
        default:
            return url.scheme + '//' + url.user + url.host + url.port + url.path + queryHash;
    }
}

function resolve(input, base) {
    // The base is always treated as a directory, if it's not empty.
    // https://github.com/mozilla/source-map/blob/8cb3ee57/lib/util.js#L327
    // https://github.com/chromium/chromium/blob/da4adbb3/third_party/blink/renderer/devtools/front_end/sdk/SourceMap.js#L400-L401
    if (base && !base.endsWith('/'))
        base += '/';
    return resolve$1(input, base);
}

/**
 * Removes everything after the last "/", but leaves the slash.
 */
function stripFilename(path) {
    if (!path)
        return '';
    const index = path.lastIndexOf('/');
    return path.slice(0, index + 1);
}

const COLUMN$1 = 0;

function maybeSort(mappings, owned) {
    const unsortedIndex = nextUnsortedSegmentLine(mappings, 0);
    if (unsortedIndex === mappings.length)
        return mappings;
    // If we own the array (meaning we parsed it from JSON), then we're free to directly mutate it. If
    // not, we do not want to modify the consumer's input array.
    if (!owned)
        mappings = mappings.slice();
    for (let i = unsortedIndex; i < mappings.length; i = nextUnsortedSegmentLine(mappings, i + 1)) {
        mappings[i] = sortSegments(mappings[i], owned);
    }
    return mappings;
}
function nextUnsortedSegmentLine(mappings, start) {
    for (let i = start; i < mappings.length; i++) {
        if (!isSorted(mappings[i]))
            return i;
    }
    return mappings.length;
}
function isSorted(line) {
    for (let j = 1; j < line.length; j++) {
        if (line[j][COLUMN$1] < line[j - 1][COLUMN$1]) {
            return false;
        }
    }
    return true;
}
function sortSegments(line, owned) {
    if (!owned)
        line = line.slice();
    return line.sort(sortComparator);
}
function sortComparator(a, b) {
    return a[COLUMN$1] - b[COLUMN$1];
}

let found = false;
/**
 * A binary search implementation that returns the index if a match is found.
 * If no match is found, then the left-index (the index associated with the item that comes just
 * before the desired index) is returned. To maintain proper sort order, a splice would happen at
 * the next index:
 *
 * ```js
 * const array = [1, 3];
 * const needle = 2;
 * const index = binarySearch(array, needle, (item, needle) => item - needle);
 *
 * assert.equal(index, 0);
 * array.splice(index + 1, 0, needle);
 * assert.deepEqual(array, [1, 2, 3]);
 * ```
 */
function binarySearch(haystack, needle, low, high) {
    while (low <= high) {
        const mid = low + ((high - low) >> 1);
        const cmp = haystack[mid][COLUMN$1] - needle;
        if (cmp === 0) {
            found = true;
            return mid;
        }
        if (cmp < 0) {
            low = mid + 1;
        }
        else {
            high = mid - 1;
        }
    }
    found = false;
    return low - 1;
}
function upperBound(haystack, needle, index) {
    for (let i = index + 1; i < haystack.length; index = i++) {
        if (haystack[i][COLUMN$1] !== needle)
            break;
    }
    return index;
}
function lowerBound(haystack, needle, index) {
    for (let i = index - 1; i >= 0; index = i--) {
        if (haystack[i][COLUMN$1] !== needle)
            break;
    }
    return index;
}
function memoizedState() {
    return {
        lastKey: -1,
        lastNeedle: -1,
        lastIndex: -1,
    };
}
/**
 * This overly complicated beast is just to record the last tested line/column and the resulting
 * index, allowing us to skip a few tests if mappings are monotonically increasing.
 */
function memoizedBinarySearch(haystack, needle, state, key) {
    const { lastKey, lastNeedle, lastIndex } = state;
    let low = 0;
    let high = haystack.length - 1;
    if (key === lastKey) {
        if (needle === lastNeedle) {
            found = lastIndex !== -1 && haystack[lastIndex][COLUMN$1] === needle;
            return lastIndex;
        }
        if (needle >= lastNeedle) {
            // lastIndex may be -1 if the previous needle was not found.
            low = lastIndex === -1 ? 0 : lastIndex;
        }
        else {
            high = lastIndex;
        }
    }
    state.lastKey = key;
    state.lastNeedle = needle;
    return (state.lastIndex = binarySearch(haystack, needle, low, high));
}
const LEAST_UPPER_BOUND = -1;
const GREATEST_LOWER_BOUND = 1;
/**
 * Returns the decoded (array of lines of segments) form of the SourceMap's mappings field.
 */
let decodedMappings;
/**
 * A low-level API to find the segment associated with a generated line/column (think, from a
 * stack trace). Line and column here are 0-based, unlike `originalPositionFor`.
 */
let traceSegment;
class TraceMap {
    constructor(map, mapUrl) {
        const isString = typeof map === 'string';
        if (!isString && map._decodedMemo)
            return map;
        const parsed = (isString ? JSON.parse(map) : map);
        const { version, file, names, sourceRoot, sources, sourcesContent } = parsed;
        this.version = version;
        this.file = file;
        this.names = names;
        this.sourceRoot = sourceRoot;
        this.sources = sources;
        this.sourcesContent = sourcesContent;
        const from = resolve(sourceRoot || '', stripFilename(mapUrl));
        this.resolvedSources = sources.map((s) => resolve(s || '', from));
        const { mappings } = parsed;
        if (typeof mappings === 'string') {
            this._encoded = mappings;
            this._decoded = undefined;
        }
        else {
            this._encoded = undefined;
            this._decoded = maybeSort(mappings, isString);
        }
        this._decodedMemo = memoizedState();
        this._bySources = undefined;
        this._bySourceMemos = undefined;
    }
}
(() => {
    decodedMappings = (map) => {
        return (map._decoded || (map._decoded = decode(map._encoded)));
    };
    traceSegment = (map, line, column) => {
        const decoded = decodedMappings(map);
        // It's common for parent source maps to have pointers to lines that have no
        // mapping (like a "//# sourceMappingURL=") at the end of the child file.
        if (line >= decoded.length)
            return null;
        const segments = decoded[line];
        const index = traceSegmentInternal(segments, map._decodedMemo, line, column, GREATEST_LOWER_BOUND);
        return index === -1 ? null : segments[index];
    };
})();
function traceSegmentInternal(segments, memo, line, column, bias) {
    let index = memoizedBinarySearch(segments, column, memo, line);
    if (found) {
        index = (bias === LEAST_UPPER_BOUND ? upperBound : lowerBound)(segments, column, index);
    }
    else if (bias === LEAST_UPPER_BOUND)
        index++;
    if (index === -1 || index === segments.length)
        return -1;
    return index;
}

/**
 * Gets the index associated with `key` in the backing array, if it is already present.
 */
let get;
/**
 * Puts `key` into the backing array, if it is not already present. Returns
 * the index of the `key` in the backing array.
 */
let put;
/**
 * SetArray acts like a `Set` (allowing only one occurrence of a string `key`), but provides the
 * index of the `key` in the backing array.
 *
 * This is designed to allow synchronizing a second array with the contents of the backing array,
 * like how in a sourcemap `sourcesContent[i]` is the source content associated with `source[i]`,
 * and there are never duplicates.
 */
class SetArray {
    constructor() {
        this._indexes = { __proto__: null };
        this.array = [];
    }
}
(() => {
    get = (strarr, key) => strarr._indexes[key];
    put = (strarr, key) => {
        // The key may or may not be present. If it is present, it's a number.
        const index = get(strarr, key);
        if (index !== undefined)
            return index;
        const { array, _indexes: indexes } = strarr;
        return (indexes[key] = array.push(key) - 1);
    };
})();

const COLUMN = 0;
const SOURCES_INDEX = 1;
const SOURCE_LINE = 2;
const SOURCE_COLUMN = 3;
const NAMES_INDEX = 4;

const NO_NAME = -1;
/**
 * Same as `addSegment`, but will only add the segment if it generates useful information in the
 * resulting map. This only works correctly if segments are added **in order**, meaning you should
 * not add a segment with a lower generated line/column than one that came before.
 */
let maybeAddSegment;
/**
 * Adds/removes the content of the source file to the source map.
 */
let setSourceContent;
/**
 * Returns a sourcemap object (with decoded mappings) suitable for passing to a library that expects
 * a sourcemap, or to JSON.stringify.
 */
let toDecodedMap;
/**
 * Returns a sourcemap object (with encoded mappings) suitable for passing to a library that expects
 * a sourcemap, or to JSON.stringify.
 */
let toEncodedMap;
// This split declaration is only so that terser can elminiate the static initialization block.
let addSegmentInternal;
/**
 * Provides the state to generate a sourcemap.
 */
class GenMapping {
    constructor({ file, sourceRoot } = {}) {
        this._names = new SetArray();
        this._sources = new SetArray();
        this._sourcesContent = [];
        this._mappings = [];
        this.file = file;
        this.sourceRoot = sourceRoot;
    }
}
(() => {
    maybeAddSegment = (map, genLine, genColumn, source, sourceLine, sourceColumn, name, content) => {
        return addSegmentInternal(true, map, genLine, genColumn, source, sourceLine, sourceColumn, name, content);
    };
    setSourceContent = (map, source, content) => {
        const { _sources: sources, _sourcesContent: sourcesContent } = map;
        sourcesContent[put(sources, source)] = content;
    };
    toDecodedMap = (map) => {
        const { file, sourceRoot, _mappings: mappings, _sources: sources, _sourcesContent: sourcesContent, _names: names, } = map;
        removeEmptyFinalLines(mappings);
        return {
            version: 3,
            file: file || undefined,
            names: names.array,
            sourceRoot: sourceRoot || undefined,
            sources: sources.array,
            sourcesContent,
            mappings,
        };
    };
    toEncodedMap = (map) => {
        const decoded = toDecodedMap(map);
        return Object.assign(Object.assign({}, decoded), { mappings: encode(decoded.mappings) });
    };
    // Internal helpers
    addSegmentInternal = (skipable, map, genLine, genColumn, source, sourceLine, sourceColumn, name, content) => {
        const { _mappings: mappings, _sources: sources, _sourcesContent: sourcesContent, _names: names, } = map;
        const line = getLine(mappings, genLine);
        const index = getColumnIndex(line, genColumn);
        if (!source) {
            if (skipable && skipSourceless(line, index))
                return;
            return insert(line, index, [genColumn]);
        }
        const sourcesIndex = put(sources, source);
        const namesIndex = name ? put(names, name) : NO_NAME;
        if (sourcesIndex === sourcesContent.length)
            sourcesContent[sourcesIndex] = content !== null && content !== void 0 ? content : null;
        if (skipable && skipSource(line, index, sourcesIndex, sourceLine, sourceColumn, namesIndex)) {
            return;
        }
        return insert(line, index, name
            ? [genColumn, sourcesIndex, sourceLine, sourceColumn, namesIndex]
            : [genColumn, sourcesIndex, sourceLine, sourceColumn]);
    };
})();
function getLine(mappings, index) {
    for (let i = mappings.length; i <= index; i++) {
        mappings[i] = [];
    }
    return mappings[index];
}
function getColumnIndex(line, genColumn) {
    let index = line.length;
    for (let i = index - 1; i >= 0; index = i--) {
        const current = line[i];
        if (genColumn >= current[COLUMN])
            break;
    }
    return index;
}
function insert(array, index, value) {
    for (let i = array.length; i > index; i--) {
        array[i] = array[i - 1];
    }
    array[index] = value;
}
function removeEmptyFinalLines(mappings) {
    const { length } = mappings;
    let len = length;
    for (let i = len - 1; i >= 0; len = i, i--) {
        if (mappings[i].length > 0)
            break;
    }
    if (len < length)
        mappings.length = len;
}
function skipSourceless(line, index) {
    // The start of a line is already sourceless, so adding a sourceless segment to the beginning
    // doesn't generate any useful information.
    if (index === 0)
        return true;
    const prev = line[index - 1];
    // If the previous segment is also sourceless, then adding another sourceless segment doesn't
    // genrate any new information. Else, this segment will end the source/named segment and point to
    // a sourceless position, which is useful.
    return prev.length === 1;
}
function skipSource(line, index, sourcesIndex, sourceLine, sourceColumn, namesIndex) {
    // A source/named segment at the start of a line gives position at that genColumn
    if (index === 0)
        return false;
    const prev = line[index - 1];
    // If the previous segment is sourceless, then we're transitioning to a source.
    if (prev.length === 1)
        return false;
    // If the previous segment maps to the exact same source position, then this segment doesn't
    // provide any new position information.
    return (sourcesIndex === prev[SOURCES_INDEX] &&
        sourceLine === prev[SOURCE_LINE] &&
        sourceColumn === prev[SOURCE_COLUMN] &&
        namesIndex === (prev.length === 5 ? prev[NAMES_INDEX] : NO_NAME));
}

const SOURCELESS_MAPPING = /* #__PURE__ */ SegmentObject('', -1, -1, '', null);
const EMPTY_SOURCES = [];
function SegmentObject(source, line, column, name, content) {
    return { source, line, column, name, content };
}
function Source(map, sources, source, content) {
    return {
        map,
        sources,
        source,
        content,
    };
}
/**
 * MapSource represents a single sourcemap, with the ability to trace mappings into its child nodes
 * (which may themselves be SourceMapTrees).
 */
function MapSource(map, sources) {
    return Source(map, sources, '', null);
}
/**
 * A "leaf" node in the sourcemap tree, representing an original, unmodified source file. Recursive
 * segment tracing ends at the `OriginalSource`.
 */
function OriginalSource(source, content) {
    return Source(null, EMPTY_SOURCES, source, content);
}
/**
 * traceMappings is only called on the root level SourceMapTree, and begins the process of
 * resolving each mapping in terms of the original source files.
 */
function traceMappings(tree) {
    // TODO: Eventually support sourceRoot, which has to be removed because the sources are already
    // fully resolved. We'll need to make sources relative to the sourceRoot before adding them.
    const gen = new GenMapping({ file: tree.map.file });
    const { sources: rootSources, map } = tree;
    const rootNames = map.names;
    const rootMappings = decodedMappings(map);
    for (let i = 0; i < rootMappings.length; i++) {
        const segments = rootMappings[i];
        for (let j = 0; j < segments.length; j++) {
            const segment = segments[j];
            const genCol = segment[0];
            let traced = SOURCELESS_MAPPING;
            // 1-length segments only move the current generated column, there's no source information
            // to gather from it.
            if (segment.length !== 1) {
                const source = rootSources[segment[1]];
                traced = originalPositionFor(source, segment[2], segment[3], segment.length === 5 ? rootNames[segment[4]] : '');
                // If the trace is invalid, then the trace ran into a sourcemap that doesn't contain a
                // respective segment into an original source.
                if (traced == null)
                    continue;
            }
            const { column, line, name, content, source } = traced;
            maybeAddSegment(gen, i, genCol, source, line, column, name);
            if (source && content != null)
                setSourceContent(gen, source, content);
        }
    }
    return gen;
}
/**
 * originalPositionFor is only called on children SourceMapTrees. It recurses down into its own
 * child SourceMapTrees, until we find the original source map.
 */
function originalPositionFor(source, line, column, name) {
    if (!source.map) {
        return SegmentObject(source.source, line, column, name, source.content);
    }
    const segment = traceSegment(source.map, line, column);
    // If we couldn't find a segment, then this doesn't exist in the sourcemap.
    if (segment == null)
        return null;
    // 1-length segments only move the current generated column, there's no source information
    // to gather from it.
    if (segment.length === 1)
        return SOURCELESS_MAPPING;
    return originalPositionFor(source.sources[segment[1]], segment[2], segment[3], segment.length === 5 ? source.map.names[segment[4]] : name);
}

function asArray(value) {
    if (Array.isArray(value))
        return value;
    return [value];
}
/**
 * Recursively builds a tree structure out of sourcemap files, with each node
 * being either an `OriginalSource` "leaf" or a `SourceMapTree` composed of
 * `OriginalSource`s and `SourceMapTree`s.
 *
 * Every sourcemap is composed of a collection of source files and mappings
 * into locations of those source files. When we generate a `SourceMapTree` for
 * the sourcemap, we attempt to load each source file's own sourcemap. If it
 * does not have an associated sourcemap, it is considered an original,
 * unmodified source file.
 */
function buildSourceMapTree(input, loader) {
    const maps = asArray(input).map((m) => new TraceMap(m, ''));
    const map = maps.pop();
    for (let i = 0; i < maps.length; i++) {
        if (maps[i].sources.length > 1) {
            throw new Error(`Transformation map ${i} must have exactly one source file.\n` +
                'Did you specify these with the most recent transformation maps first?');
        }
    }
    let tree = build(map, loader, '', 0);
    for (let i = maps.length - 1; i >= 0; i--) {
        tree = MapSource(maps[i], [tree]);
    }
    return tree;
}
function build(map, loader, importer, importerDepth) {
    const { resolvedSources, sourcesContent } = map;
    const depth = importerDepth + 1;
    const children = resolvedSources.map((sourceFile, i) => {
        // The loading context gives the loader more information about why this file is being loaded
        // (eg, from which importer). It also allows the loader to override the location of the loaded
        // sourcemap/original source, or to override the content in the sourcesContent field if it's
        // an unmodified source file.
        const ctx = {
            importer,
            depth,
            source: sourceFile || '',
            content: undefined,
        };
        // Use the provided loader callback to retrieve the file's sourcemap.
        // TODO: We should eventually support async loading of sourcemap files.
        const sourceMap = loader(ctx.source, ctx);
        const { source, content } = ctx;
        // If there is a sourcemap, then we need to recurse into it to load its source files.
        if (sourceMap)
            return build(new TraceMap(sourceMap, source), loader, source, depth);
        // Else, it's an an unmodified source file.
        // The contents of this unmodified source file can be overridden via the loader context,
        // allowing it to be explicitly null or a string. If it remains undefined, we fall back to
        // the importing sourcemap's `sourcesContent` field.
        const sourceContent = content !== undefined ? content : sourcesContent ? sourcesContent[i] : null;
        return OriginalSource(source, sourceContent);
    });
    return MapSource(map, children);
}

/**
 * A SourceMap v3 compatible sourcemap, which only includes fields that were
 * provided to it.
 */
class SourceMap {
    constructor(map, options) {
        const out = options.decodedMappings ? toDecodedMap(map) : toEncodedMap(map);
        this.version = out.version; // SourceMap spec says this should be first.
        this.file = out.file;
        this.mappings = out.mappings;
        this.names = out.names;
        this.sourceRoot = out.sourceRoot;
        this.sources = out.sources;
        if (!options.excludeContent) {
            this.sourcesContent = out.sourcesContent;
        }
    }
    toString() {
        return JSON.stringify(this);
    }
}

/**
 * Traces through all the mappings in the root sourcemap, through the sources
 * (and their sourcemaps), all the way back to the original source location.
 *
 * `loader` will be called every time we encounter a source file. If it returns
 * a sourcemap, we will recurse into that sourcemap to continue the trace. If
 * it returns a falsey value, that source file is treated as an original,
 * unmodified source file.
 *
 * Pass `excludeContent` to exclude any self-containing source file content
 * from the output sourcemap.
 *
 * Pass `decodedMappings` to receive a SourceMap with decoded (instead of
 * VLQ encoded) mappings.
 */
function remapping(input, loader, options) {
    const opts = typeof options === 'object' ? options : { excludeContent: !!options, decodedMappings: false };
    const tree = buildSourceMapTree(input, loader);
    return new SourceMap(traceMappings(tree), opts);
}

function applyTransformersSync(filePath, code, transformers) {
  const maps = [];
  const warnings = [];
  const result = { code };
  for (const transformer of transformers) {
    const transformed = transformer(filePath, result.code);
    if (transformed) {
      Object.assign(result, transformed);
      maps.unshift(transformed.map);
      if (transformed.warnings) {
        warnings.push(...transformed.warnings);
      }
    }
  }
  return {
    ...result,
    map: remapping(maps, () => null),
    warnings
  };
}
async function applyTransformers(filePath, code, transformers) {
  const maps = [];
  const warnings = [];
  const result = { code };
  for (const transformer of transformers) {
    const transformed = await transformer(filePath, result.code);
    if (transformed) {
      Object.assign(result, transformed);
      maps.unshift(transformed.map);
      if (transformed.warnings) {
        warnings.push(...transformed.warnings);
      }
    }
  }
  return {
    ...result,
    map: remapping(maps, () => null),
    warnings
  };
}

const nodeVersion = process.versions.node;
const getEsbuildOptions = (extendOptions) => {
  const options = {
    target: `node${nodeVersion}`,
    // "default" tells esbuild to infer loader from file name
    // https://github.com/evanw/esbuild/blob/4a07b17adad23e40cbca7d2f8931e8fb81b47c33/internal/bundler/bundler.go#L158
    loader: "default",
    sourcemap: true,
    /**
     * Smaller output for cache and marginal performance improvement:
     * https://twitter.com/evanwallace/status/1396336348366180359?s=20
     *
     * minifyIdentifiers is disabled because debuggers don't use the
     * `names` property from the source map
     *
     * minifySyntax is disabled because it does some tree-shaking
     * eg. unused try-catch error variable
     */
    minifyWhitespace: true,
    keepNames: true,
    ...extendOptions
  };
  if (options.sourcefile) {
    const { sourcefile } = options;
    const extension = path.extname(sourcefile);
    if (extension) {
      if (extension === ".cts" || extension === ".mts") {
        options.sourcefile = `${sourcefile.slice(0, -3)}ts`;
      }
    } else {
      options.sourcefile += ".js";
    }
  }
  return options;
};

function transformSync(code, filePath, extendOptions) {
  const define = {};
  if (!(filePath.endsWith(".cjs") || filePath.endsWith(".cts"))) {
    define["import.meta.url"] = `'${pathToFileURL(filePath)}'`;
  }
  const esbuildOptions = getEsbuildOptions({
    format: "cjs",
    sourcefile: filePath,
    define,
    banner: "(()=>{",
    footer: "})()",
    ...extendOptions
  });
  const hash = sha1([
    code,
    JSON.stringify(esbuildOptions),
    version$1,
    version
  ].join("-"));
  let transformed = cache.get(hash);
  if (!transformed) {
    transformed = applyTransformersSync(
      filePath,
      code,
      [
        // eslint-disable-next-line @typescript-eslint/no-shadow
        (filePath2, code2) => {
          const transformed2 = transformSync$1(code2, esbuildOptions);
          if (esbuildOptions.sourcefile !== filePath2) {
            transformed2.map = transformed2.map.replace(
              JSON.stringify(esbuildOptions.sourcefile),
              JSON.stringify(filePath2)
            );
          }
          return transformed2;
        },
        transformDynamicImport
      ]
    );
    cache.set(hash, transformed);
  }
  if (transformed.warnings && transformed.warnings.length > 0) {
    const { warnings } = transformed;
    for (const warning of warnings) {
      console.error(warning);
    }
  }
  return transformed;
}
async function transform(code, filePath, extendOptions) {
  const esbuildOptions = getEsbuildOptions({
    format: "esm",
    sourcefile: filePath,
    ...extendOptions
  });
  const hash = sha1([
    code,
    JSON.stringify(esbuildOptions),
    version$1,
    version
  ].join("-"));
  let transformed = cache.get(hash);
  if (!transformed) {
    transformed = await applyTransformers(
      filePath,
      code,
      [
        // eslint-disable-next-line @typescript-eslint/no-shadow
        async (filePath2, code2) => {
          const transformed2 = await transform$1(code2, esbuildOptions);
          if (esbuildOptions.sourcefile !== filePath2) {
            transformed2.map = transformed2.map.replace(
              JSON.stringify(esbuildOptions.sourcefile),
              JSON.stringify(filePath2)
            );
          }
          return transformed2;
        },
        transformDynamicImport
      ]
    );
    cache.set(hash, transformed);
  }
  if (transformed.warnings && transformed.warnings.length > 0) {
    const { warnings } = transformed;
    for (const warning of warnings) {
      console.error(warning);
    }
  }
  return transformed;
}

export { transformDynamicImport as a, transformSync as b, parseEsm as p, transform as t };
