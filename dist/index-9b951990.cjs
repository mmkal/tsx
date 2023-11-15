'use strict';

var url = require('url');
var esbuild = require('esbuild');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var require$$2 = require('os');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var crypto__default = /*#__PURE__*/_interopDefaultLegacy(crypto);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var require$$2__default = /*#__PURE__*/_interopDefaultLegacy(require$$2);

const sha1 = (data) => crypto__default["default"].createHash("sha1").update(data).digest("hex");

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

class BitSet {
	constructor(arg) {
		this.bits = arg instanceof BitSet ? arg.bits.slice() : [];
	}

	add(n) {
		this.bits[n >> 5] |= 1 << (n & 31);
	}

	has(n) {
		return !!(this.bits[n >> 5] & (1 << (n & 31)));
	}
}

class Chunk {
	constructor(start, end, content) {
		this.start = start;
		this.end = end;
		this.original = content;

		this.intro = '';
		this.outro = '';

		this.content = content;
		this.storeName = false;
		this.edited = false;

		{
			this.previous = null;
			this.next = null;
		}
	}

	appendLeft(content) {
		this.outro += content;
	}

	appendRight(content) {
		this.intro = this.intro + content;
	}

	clone() {
		const chunk = new Chunk(this.start, this.end, this.original);

		chunk.intro = this.intro;
		chunk.outro = this.outro;
		chunk.content = this.content;
		chunk.storeName = this.storeName;
		chunk.edited = this.edited;

		return chunk;
	}

	contains(index) {
		return this.start < index && index < this.end;
	}

	eachNext(fn) {
		let chunk = this;
		while (chunk) {
			fn(chunk);
			chunk = chunk.next;
		}
	}

	eachPrevious(fn) {
		let chunk = this;
		while (chunk) {
			fn(chunk);
			chunk = chunk.previous;
		}
	}

	edit(content, storeName, contentOnly) {
		this.content = content;
		if (!contentOnly) {
			this.intro = '';
			this.outro = '';
		}
		this.storeName = storeName;

		this.edited = true;

		return this;
	}

	prependLeft(content) {
		this.outro = content + this.outro;
	}

	prependRight(content) {
		this.intro = content + this.intro;
	}

	split(index) {
		const sliceIndex = index - this.start;

		const originalBefore = this.original.slice(0, sliceIndex);
		const originalAfter = this.original.slice(sliceIndex);

		this.original = originalBefore;

		const newChunk = new Chunk(index, this.end, originalAfter);
		newChunk.outro = this.outro;
		this.outro = '';

		this.end = index;

		if (this.edited) {
			// after split we should save the edit content record into the correct chunk
			// to make sure sourcemap correct
			// For example:
			// '  test'.trim()
			//     split   -> '  ' + 'test'
			//   ✔️ edit    -> '' + 'test'
			//   ✖️ edit    -> 'test' + '' 
			// TODO is this block necessary?...
			newChunk.edit('', false);
			this.content = '';
		} else {
			this.content = originalBefore;
		}

		newChunk.next = this.next;
		if (newChunk.next) newChunk.next.previous = newChunk;
		newChunk.previous = this;
		this.next = newChunk;

		return newChunk;
	}

	toString() {
		return this.intro + this.content + this.outro;
	}

	trimEnd(rx) {
		this.outro = this.outro.replace(rx, '');
		if (this.outro.length) return true;

		const trimmed = this.content.replace(rx, '');

		if (trimmed.length) {
			if (trimmed !== this.content) {
				this.split(this.start + trimmed.length).edit('', undefined, true);
				if (this.edited) {
					// save the change, if it has been edited
					this.edit(trimmed, this.storeName, true);
				}
			}
			return true;
		} else {
			this.edit('', undefined, true);

			this.intro = this.intro.replace(rx, '');
			if (this.intro.length) return true;
		}
	}

	trimStart(rx) {
		this.intro = this.intro.replace(rx, '');
		if (this.intro.length) return true;

		const trimmed = this.content.replace(rx, '');

		if (trimmed.length) {
			if (trimmed !== this.content) {
				const newChunk = this.split(this.end - trimmed.length);
				if (this.edited) {
					// save the change, if it has been edited
					newChunk.edit(trimmed, this.storeName, true);
				}
				this.edit('', undefined, true);
			}
			return true;
		} else {
			this.edit('', undefined, true);

			this.outro = this.outro.replace(rx, '');
			if (this.outro.length) return true;
		}
	}
}

function getBtoa() {
	if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
		return (str) => window.btoa(unescape(encodeURIComponent(str)));
	} else if (typeof Buffer === 'function') {
		return (str) => Buffer.from(str, 'utf-8').toString('base64');
	} else {
		return () => {
			throw new Error('Unsupported environment: `window.btoa` or `Buffer` should be supported.');
		};
	}
}

const btoa = /*#__PURE__*/ getBtoa();

class SourceMap$1 {
	constructor(properties) {
		this.version = 3;
		this.file = properties.file;
		this.sources = properties.sources;
		this.sourcesContent = properties.sourcesContent;
		this.names = properties.names;
		this.mappings = encode(properties.mappings);
		if (typeof properties.x_google_ignoreList !== 'undefined') {
			this.x_google_ignoreList = properties.x_google_ignoreList;
		}
	}

	toString() {
		return JSON.stringify(this);
	}

	toUrl() {
		return 'data:application/json;charset=utf-8;base64,' + btoa(this.toString());
	}
}

function guessIndent(code) {
	const lines = code.split('\n');

	const tabbed = lines.filter((line) => /^\t+/.test(line));
	const spaced = lines.filter((line) => /^ {2,}/.test(line));

	if (tabbed.length === 0 && spaced.length === 0) {
		return null;
	}

	// More lines tabbed than spaced? Assume tabs, and
	// default to tabs in the case of a tie (or nothing
	// to go on)
	if (tabbed.length >= spaced.length) {
		return '\t';
	}

	// Otherwise, we need to guess the multiple
	const min = spaced.reduce((previous, current) => {
		const numSpaces = /^ +/.exec(current)[0].length;
		return Math.min(numSpaces, previous);
	}, Infinity);

	return new Array(min + 1).join(' ');
}

function getRelativePath(from, to) {
	const fromParts = from.split(/[/\\]/);
	const toParts = to.split(/[/\\]/);

	fromParts.pop(); // get dirname

	while (fromParts[0] === toParts[0]) {
		fromParts.shift();
		toParts.shift();
	}

	if (fromParts.length) {
		let i = fromParts.length;
		while (i--) fromParts[i] = '..';
	}

	return fromParts.concat(toParts).join('/');
}

const toString = Object.prototype.toString;

function isObject(thing) {
	return toString.call(thing) === '[object Object]';
}

function getLocator(source) {
	const originalLines = source.split('\n');
	const lineOffsets = [];

	for (let i = 0, pos = 0; i < originalLines.length; i++) {
		lineOffsets.push(pos);
		pos += originalLines[i].length + 1;
	}

	return function locate(index) {
		let i = 0;
		let j = lineOffsets.length;
		while (i < j) {
			const m = (i + j) >> 1;
			if (index < lineOffsets[m]) {
				j = m;
			} else {
				i = m + 1;
			}
		}
		const line = i - 1;
		const column = index - lineOffsets[line];
		return { line, column };
	};
}

const wordRegex = /\w/;

class Mappings {
	constructor(hires) {
		this.hires = hires;
		this.generatedCodeLine = 0;
		this.generatedCodeColumn = 0;
		this.raw = [];
		this.rawSegments = this.raw[this.generatedCodeLine] = [];
		this.pending = null;
	}

	addEdit(sourceIndex, content, loc, nameIndex) {
		if (content.length) {
			const segment = [this.generatedCodeColumn, sourceIndex, loc.line, loc.column];
			if (nameIndex >= 0) {
				segment.push(nameIndex);
			}
			this.rawSegments.push(segment);
		} else if (this.pending) {
			this.rawSegments.push(this.pending);
		}

		this.advance(content);
		this.pending = null;
	}

	addUneditedChunk(sourceIndex, chunk, original, loc, sourcemapLocations) {
		let originalCharIndex = chunk.start;
		let first = true;
		// when iterating each char, check if it's in a word boundary
		let charInHiresBoundary = false;

		while (originalCharIndex < chunk.end) {
			if (this.hires || first || sourcemapLocations.has(originalCharIndex)) {
				const segment = [this.generatedCodeColumn, sourceIndex, loc.line, loc.column];

				if (this.hires === 'boundary') {
					// in hires "boundary", group segments per word boundary than per char
					if (wordRegex.test(original[originalCharIndex])) {
						// for first char in the boundary found, start the boundary by pushing a segment
						if (!charInHiresBoundary) {
							this.rawSegments.push(segment);
							charInHiresBoundary = true;
						}
					} else {
						// for non-word char, end the boundary by pushing a segment
						this.rawSegments.push(segment);
						charInHiresBoundary = false;
					}
				} else {
					this.rawSegments.push(segment);
				}
			}

			if (original[originalCharIndex] === '\n') {
				loc.line += 1;
				loc.column = 0;
				this.generatedCodeLine += 1;
				this.raw[this.generatedCodeLine] = this.rawSegments = [];
				this.generatedCodeColumn = 0;
				first = true;
			} else {
				loc.column += 1;
				this.generatedCodeColumn += 1;
				first = false;
			}

			originalCharIndex += 1;
		}

		this.pending = null;
	}

	advance(str) {
		if (!str) return;

		const lines = str.split('\n');

		if (lines.length > 1) {
			for (let i = 0; i < lines.length - 1; i++) {
				this.generatedCodeLine++;
				this.raw[this.generatedCodeLine] = this.rawSegments = [];
			}
			this.generatedCodeColumn = 0;
		}

		this.generatedCodeColumn += lines[lines.length - 1].length;
	}
}

const n$1 = '\n';

const warned = {
	insertLeft: false,
	insertRight: false,
	storeName: false,
};

class MagicString {
	constructor(string, options = {}) {
		const chunk = new Chunk(0, string.length, string);

		Object.defineProperties(this, {
			original: { writable: true, value: string },
			outro: { writable: true, value: '' },
			intro: { writable: true, value: '' },
			firstChunk: { writable: true, value: chunk },
			lastChunk: { writable: true, value: chunk },
			lastSearchedChunk: { writable: true, value: chunk },
			byStart: { writable: true, value: {} },
			byEnd: { writable: true, value: {} },
			filename: { writable: true, value: options.filename },
			indentExclusionRanges: { writable: true, value: options.indentExclusionRanges },
			sourcemapLocations: { writable: true, value: new BitSet() },
			storedNames: { writable: true, value: {} },
			indentStr: { writable: true, value: undefined },
			ignoreList: { writable: true, value: options.ignoreList },
		});

		this.byStart[0] = chunk;
		this.byEnd[string.length] = chunk;
	}

	addSourcemapLocation(char) {
		this.sourcemapLocations.add(char);
	}

	append(content) {
		if (typeof content !== 'string') throw new TypeError('outro content must be a string');

		this.outro += content;
		return this;
	}

	appendLeft(index, content) {
		if (typeof content !== 'string') throw new TypeError('inserted content must be a string');

		this._split(index);

		const chunk = this.byEnd[index];

		if (chunk) {
			chunk.appendLeft(content);
		} else {
			this.intro += content;
		}
		return this;
	}

	appendRight(index, content) {
		if (typeof content !== 'string') throw new TypeError('inserted content must be a string');

		this._split(index);

		const chunk = this.byStart[index];

		if (chunk) {
			chunk.appendRight(content);
		} else {
			this.outro += content;
		}
		return this;
	}

	clone() {
		const cloned = new MagicString(this.original, { filename: this.filename });

		let originalChunk = this.firstChunk;
		let clonedChunk = (cloned.firstChunk = cloned.lastSearchedChunk = originalChunk.clone());

		while (originalChunk) {
			cloned.byStart[clonedChunk.start] = clonedChunk;
			cloned.byEnd[clonedChunk.end] = clonedChunk;

			const nextOriginalChunk = originalChunk.next;
			const nextClonedChunk = nextOriginalChunk && nextOriginalChunk.clone();

			if (nextClonedChunk) {
				clonedChunk.next = nextClonedChunk;
				nextClonedChunk.previous = clonedChunk;

				clonedChunk = nextClonedChunk;
			}

			originalChunk = nextOriginalChunk;
		}

		cloned.lastChunk = clonedChunk;

		if (this.indentExclusionRanges) {
			cloned.indentExclusionRanges = this.indentExclusionRanges.slice();
		}

		cloned.sourcemapLocations = new BitSet(this.sourcemapLocations);

		cloned.intro = this.intro;
		cloned.outro = this.outro;

		return cloned;
	}

	generateDecodedMap(options) {
		options = options || {};

		const sourceIndex = 0;
		const names = Object.keys(this.storedNames);
		const mappings = new Mappings(options.hires);

		const locate = getLocator(this.original);

		if (this.intro) {
			mappings.advance(this.intro);
		}

		this.firstChunk.eachNext((chunk) => {
			const loc = locate(chunk.start);

			if (chunk.intro.length) mappings.advance(chunk.intro);

			if (chunk.edited) {
				mappings.addEdit(
					sourceIndex,
					chunk.content,
					loc,
					chunk.storeName ? names.indexOf(chunk.original) : -1,
				);
			} else {
				mappings.addUneditedChunk(sourceIndex, chunk, this.original, loc, this.sourcemapLocations);
			}

			if (chunk.outro.length) mappings.advance(chunk.outro);
		});

		return {
			file: options.file ? options.file.split(/[/\\]/).pop() : undefined,
			sources: [
				options.source ? getRelativePath(options.file || '', options.source) : options.file || '',
			],
			sourcesContent: options.includeContent ? [this.original] : undefined,
			names,
			mappings: mappings.raw,
			x_google_ignoreList: this.ignoreList ? [sourceIndex] : undefined,
		};
	}

	generateMap(options) {
		return new SourceMap$1(this.generateDecodedMap(options));
	}

	_ensureindentStr() {
		if (this.indentStr === undefined) {
			this.indentStr = guessIndent(this.original);
		}
	}

	_getRawIndentString() {
		this._ensureindentStr();
		return this.indentStr;
	}

	getIndentString() {
		this._ensureindentStr();
		return this.indentStr === null ? '\t' : this.indentStr;
	}

	indent(indentStr, options) {
		const pattern = /^[^\r\n]/gm;

		if (isObject(indentStr)) {
			options = indentStr;
			indentStr = undefined;
		}

		if (indentStr === undefined) {
			this._ensureindentStr();
			indentStr = this.indentStr || '\t';
		}

		if (indentStr === '') return this; // noop

		options = options || {};

		// Process exclusion ranges
		const isExcluded = {};

		if (options.exclude) {
			const exclusions =
				typeof options.exclude[0] === 'number' ? [options.exclude] : options.exclude;
			exclusions.forEach((exclusion) => {
				for (let i = exclusion[0]; i < exclusion[1]; i += 1) {
					isExcluded[i] = true;
				}
			});
		}

		let shouldIndentNextCharacter = options.indentStart !== false;
		const replacer = (match) => {
			if (shouldIndentNextCharacter) return `${indentStr}${match}`;
			shouldIndentNextCharacter = true;
			return match;
		};

		this.intro = this.intro.replace(pattern, replacer);

		let charIndex = 0;
		let chunk = this.firstChunk;

		while (chunk) {
			const end = chunk.end;

			if (chunk.edited) {
				if (!isExcluded[charIndex]) {
					chunk.content = chunk.content.replace(pattern, replacer);

					if (chunk.content.length) {
						shouldIndentNextCharacter = chunk.content[chunk.content.length - 1] === '\n';
					}
				}
			} else {
				charIndex = chunk.start;

				while (charIndex < end) {
					if (!isExcluded[charIndex]) {
						const char = this.original[charIndex];

						if (char === '\n') {
							shouldIndentNextCharacter = true;
						} else if (char !== '\r' && shouldIndentNextCharacter) {
							shouldIndentNextCharacter = false;

							if (charIndex === chunk.start) {
								chunk.prependRight(indentStr);
							} else {
								this._splitChunk(chunk, charIndex);
								chunk = chunk.next;
								chunk.prependRight(indentStr);
							}
						}
					}

					charIndex += 1;
				}
			}

			charIndex = chunk.end;
			chunk = chunk.next;
		}

		this.outro = this.outro.replace(pattern, replacer);

		return this;
	}

	insert() {
		throw new Error(
			'magicString.insert(...) is deprecated. Use prependRight(...) or appendLeft(...)',
		);
	}

	insertLeft(index, content) {
		if (!warned.insertLeft) {
			console.warn(
				'magicString.insertLeft(...) is deprecated. Use magicString.appendLeft(...) instead',
			); // eslint-disable-line no-console
			warned.insertLeft = true;
		}

		return this.appendLeft(index, content);
	}

	insertRight(index, content) {
		if (!warned.insertRight) {
			console.warn(
				'magicString.insertRight(...) is deprecated. Use magicString.prependRight(...) instead',
			); // eslint-disable-line no-console
			warned.insertRight = true;
		}

		return this.prependRight(index, content);
	}

	move(start, end, index) {
		if (index >= start && index <= end) throw new Error('Cannot move a selection inside itself');

		this._split(start);
		this._split(end);
		this._split(index);

		const first = this.byStart[start];
		const last = this.byEnd[end];

		const oldLeft = first.previous;
		const oldRight = last.next;

		const newRight = this.byStart[index];
		if (!newRight && last === this.lastChunk) return this;
		const newLeft = newRight ? newRight.previous : this.lastChunk;

		if (oldLeft) oldLeft.next = oldRight;
		if (oldRight) oldRight.previous = oldLeft;

		if (newLeft) newLeft.next = first;
		if (newRight) newRight.previous = last;

		if (!first.previous) this.firstChunk = last.next;
		if (!last.next) {
			this.lastChunk = first.previous;
			this.lastChunk.next = null;
		}

		first.previous = newLeft;
		last.next = newRight || null;

		if (!newLeft) this.firstChunk = first;
		if (!newRight) this.lastChunk = last;
		return this;
	}

	overwrite(start, end, content, options) {
		options = options || {};
		return this.update(start, end, content, { ...options, overwrite: !options.contentOnly });
	}

	update(start, end, content, options) {
		if (typeof content !== 'string') throw new TypeError('replacement content must be a string');

		while (start < 0) start += this.original.length;
		while (end < 0) end += this.original.length;

		if (end > this.original.length) throw new Error('end is out of bounds');
		if (start === end)
			throw new Error(
				'Cannot overwrite a zero-length range – use appendLeft or prependRight instead',
			);

		this._split(start);
		this._split(end);

		if (options === true) {
			if (!warned.storeName) {
				console.warn(
					'The final argument to magicString.overwrite(...) should be an options object. See https://github.com/rich-harris/magic-string',
				); // eslint-disable-line no-console
				warned.storeName = true;
			}

			options = { storeName: true };
		}
		const storeName = options !== undefined ? options.storeName : false;
		const overwrite = options !== undefined ? options.overwrite : false;

		if (storeName) {
			const original = this.original.slice(start, end);
			Object.defineProperty(this.storedNames, original, {
				writable: true,
				value: true,
				enumerable: true,
			});
		}

		const first = this.byStart[start];
		const last = this.byEnd[end];

		if (first) {
			let chunk = first;
			while (chunk !== last) {
				if (chunk.next !== this.byStart[chunk.end]) {
					throw new Error('Cannot overwrite across a split point');
				}
				chunk = chunk.next;
				chunk.edit('', false);
			}

			first.edit(content, storeName, !overwrite);
		} else {
			// must be inserting at the end
			const newChunk = new Chunk(start, end, '').edit(content, storeName);

			// TODO last chunk in the array may not be the last chunk, if it's moved...
			last.next = newChunk;
			newChunk.previous = last;
		}
		return this;
	}

	prepend(content) {
		if (typeof content !== 'string') throw new TypeError('outro content must be a string');

		this.intro = content + this.intro;
		return this;
	}

	prependLeft(index, content) {
		if (typeof content !== 'string') throw new TypeError('inserted content must be a string');

		this._split(index);

		const chunk = this.byEnd[index];

		if (chunk) {
			chunk.prependLeft(content);
		} else {
			this.intro = content + this.intro;
		}
		return this;
	}

	prependRight(index, content) {
		if (typeof content !== 'string') throw new TypeError('inserted content must be a string');

		this._split(index);

		const chunk = this.byStart[index];

		if (chunk) {
			chunk.prependRight(content);
		} else {
			this.outro = content + this.outro;
		}
		return this;
	}

	remove(start, end) {
		while (start < 0) start += this.original.length;
		while (end < 0) end += this.original.length;

		if (start === end) return this;

		if (start < 0 || end > this.original.length) throw new Error('Character is out of bounds');
		if (start > end) throw new Error('end must be greater than start');

		this._split(start);
		this._split(end);

		let chunk = this.byStart[start];

		while (chunk) {
			chunk.intro = '';
			chunk.outro = '';
			chunk.edit('');

			chunk = end > chunk.end ? this.byStart[chunk.end] : null;
		}
		return this;
	}

	lastChar() {
		if (this.outro.length) return this.outro[this.outro.length - 1];
		let chunk = this.lastChunk;
		do {
			if (chunk.outro.length) return chunk.outro[chunk.outro.length - 1];
			if (chunk.content.length) return chunk.content[chunk.content.length - 1];
			if (chunk.intro.length) return chunk.intro[chunk.intro.length - 1];
		} while ((chunk = chunk.previous));
		if (this.intro.length) return this.intro[this.intro.length - 1];
		return '';
	}

	lastLine() {
		let lineIndex = this.outro.lastIndexOf(n$1);
		if (lineIndex !== -1) return this.outro.substr(lineIndex + 1);
		let lineStr = this.outro;
		let chunk = this.lastChunk;
		do {
			if (chunk.outro.length > 0) {
				lineIndex = chunk.outro.lastIndexOf(n$1);
				if (lineIndex !== -1) return chunk.outro.substr(lineIndex + 1) + lineStr;
				lineStr = chunk.outro + lineStr;
			}

			if (chunk.content.length > 0) {
				lineIndex = chunk.content.lastIndexOf(n$1);
				if (lineIndex !== -1) return chunk.content.substr(lineIndex + 1) + lineStr;
				lineStr = chunk.content + lineStr;
			}

			if (chunk.intro.length > 0) {
				lineIndex = chunk.intro.lastIndexOf(n$1);
				if (lineIndex !== -1) return chunk.intro.substr(lineIndex + 1) + lineStr;
				lineStr = chunk.intro + lineStr;
			}
		} while ((chunk = chunk.previous));
		lineIndex = this.intro.lastIndexOf(n$1);
		if (lineIndex !== -1) return this.intro.substr(lineIndex + 1) + lineStr;
		return this.intro + lineStr;
	}

	slice(start = 0, end = this.original.length) {
		while (start < 0) start += this.original.length;
		while (end < 0) end += this.original.length;

		let result = '';

		// find start chunk
		let chunk = this.firstChunk;
		while (chunk && (chunk.start > start || chunk.end <= start)) {
			// found end chunk before start
			if (chunk.start < end && chunk.end >= end) {
				return result;
			}

			chunk = chunk.next;
		}

		if (chunk && chunk.edited && chunk.start !== start)
			throw new Error(`Cannot use replaced character ${start} as slice start anchor.`);

		const startChunk = chunk;
		while (chunk) {
			if (chunk.intro && (startChunk !== chunk || chunk.start === start)) {
				result += chunk.intro;
			}

			const containsEnd = chunk.start < end && chunk.end >= end;
			if (containsEnd && chunk.edited && chunk.end !== end)
				throw new Error(`Cannot use replaced character ${end} as slice end anchor.`);

			const sliceStart = startChunk === chunk ? start - chunk.start : 0;
			const sliceEnd = containsEnd ? chunk.content.length + end - chunk.end : chunk.content.length;

			result += chunk.content.slice(sliceStart, sliceEnd);

			if (chunk.outro && (!containsEnd || chunk.end === end)) {
				result += chunk.outro;
			}

			if (containsEnd) {
				break;
			}

			chunk = chunk.next;
		}

		return result;
	}

	// TODO deprecate this? not really very useful
	snip(start, end) {
		const clone = this.clone();
		clone.remove(0, start);
		clone.remove(end, clone.original.length);

		return clone;
	}

	_split(index) {
		if (this.byStart[index] || this.byEnd[index]) return;

		let chunk = this.lastSearchedChunk;
		const searchForward = index > chunk.end;

		while (chunk) {
			if (chunk.contains(index)) return this._splitChunk(chunk, index);

			chunk = searchForward ? this.byStart[chunk.end] : this.byEnd[chunk.start];
		}
	}

	_splitChunk(chunk, index) {
		if (chunk.edited && chunk.content.length) {
			// zero-length edited chunks are a special case (overlapping replacements)
			const loc = getLocator(this.original)(index);
			throw new Error(
				`Cannot split a chunk that has already been edited (${loc.line}:${loc.column} – "${chunk.original}")`,
			);
		}

		const newChunk = chunk.split(index);

		this.byEnd[index] = chunk;
		this.byStart[index] = newChunk;
		this.byEnd[newChunk.end] = newChunk;

		if (chunk === this.lastChunk) this.lastChunk = newChunk;

		this.lastSearchedChunk = chunk;
		return true;
	}

	toString() {
		let str = this.intro;

		let chunk = this.firstChunk;
		while (chunk) {
			str += chunk.toString();
			chunk = chunk.next;
		}

		return str + this.outro;
	}

	isEmpty() {
		let chunk = this.firstChunk;
		do {
			if (
				(chunk.intro.length && chunk.intro.trim()) ||
				(chunk.content.length && chunk.content.trim()) ||
				(chunk.outro.length && chunk.outro.trim())
			)
				return false;
		} while ((chunk = chunk.next));
		return true;
	}

	length() {
		let chunk = this.firstChunk;
		let length = 0;
		do {
			length += chunk.intro.length + chunk.content.length + chunk.outro.length;
		} while ((chunk = chunk.next));
		return length;
	}

	trimLines() {
		return this.trim('[\\r\\n]');
	}

	trim(charType) {
		return this.trimStart(charType).trimEnd(charType);
	}

	trimEndAborted(charType) {
		const rx = new RegExp((charType || '\\s') + '+$');

		this.outro = this.outro.replace(rx, '');
		if (this.outro.length) return true;

		let chunk = this.lastChunk;

		do {
			const end = chunk.end;
			const aborted = chunk.trimEnd(rx);

			// if chunk was trimmed, we have a new lastChunk
			if (chunk.end !== end) {
				if (this.lastChunk === chunk) {
					this.lastChunk = chunk.next;
				}

				this.byEnd[chunk.end] = chunk;
				this.byStart[chunk.next.start] = chunk.next;
				this.byEnd[chunk.next.end] = chunk.next;
			}

			if (aborted) return true;
			chunk = chunk.previous;
		} while (chunk);

		return false;
	}

	trimEnd(charType) {
		this.trimEndAborted(charType);
		return this;
	}
	trimStartAborted(charType) {
		const rx = new RegExp('^' + (charType || '\\s') + '+');

		this.intro = this.intro.replace(rx, '');
		if (this.intro.length) return true;

		let chunk = this.firstChunk;

		do {
			const end = chunk.end;
			const aborted = chunk.trimStart(rx);

			if (chunk.end !== end) {
				// special case...
				if (chunk === this.lastChunk) this.lastChunk = chunk.next;

				this.byEnd[chunk.end] = chunk;
				this.byStart[chunk.next.start] = chunk.next;
				this.byEnd[chunk.next.end] = chunk.next;
			}

			if (aborted) return true;
			chunk = chunk.next;
		} while (chunk);

		return false;
	}

	trimStart(charType) {
		this.trimStartAborted(charType);
		return this;
	}

	hasChanged() {
		return this.original !== this.toString();
	}

	_replaceRegexp(searchValue, replacement) {
		function getReplacement(match, str) {
			if (typeof replacement === 'string') {
				return replacement.replace(/\$(\$|&|\d+)/g, (_, i) => {
					// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#specifying_a_string_as_a_parameter
					if (i === '$') return '$';
					if (i === '&') return match[0];
					const num = +i;
					if (num < match.length) return match[+i];
					return `$${i}`;
				});
			} else {
				return replacement(...match, match.index, str, match.groups);
			}
		}
		function matchAll(re, str) {
			let match;
			const matches = [];
			while ((match = re.exec(str))) {
				matches.push(match);
			}
			return matches;
		}
		if (searchValue.global) {
			const matches = matchAll(searchValue, this.original);
			matches.forEach((match) => {
				if (match.index != null)
					this.overwrite(
						match.index,
						match.index + match[0].length,
						getReplacement(match, this.original),
					);
			});
		} else {
			const match = this.original.match(searchValue);
			if (match && match.index != null)
				this.overwrite(
					match.index,
					match.index + match[0].length,
					getReplacement(match, this.original),
				);
		}
		return this;
	}

	_replaceString(string, replacement) {
		const { original } = this;
		const index = original.indexOf(string);

		if (index !== -1) {
			this.overwrite(index, index + string.length, replacement);
		}

		return this;
	}

	replace(searchValue, replacement) {
		if (typeof searchValue === 'string') {
			return this._replaceString(searchValue, replacement);
		}

		return this._replaceRegexp(searchValue, replacement);
	}

	_replaceAllString(string, replacement) {
		const { original } = this;
		const stringLength = string.length;
		for (
			let index = original.indexOf(string);
			index !== -1;
			index = original.indexOf(string, index + stringLength)
		) {
			this.overwrite(index, index + stringLength, replacement);
		}

		return this;
	}

	replaceAll(searchValue, replacement) {
		if (typeof searchValue === 'string') {
			return this._replaceAllString(searchValue, replacement);
		}

		if (!searchValue.global) {
			throw new TypeError(
				'MagicString.prototype.replaceAll called with a non-global RegExp argument',
			);
		}

		return this._replaceRegexp(searchValue, replacement);
	}
}

/* es-module-lexer 1.3.1 */
const A=1===new Uint8Array(new Uint16Array([1]).buffer)[0];function parse$1(E,g="@"){if(!C)return init.then((()=>parse$1(E)));const I=E.length+1,o=(C.__heap_base.value||C.__heap_base)+4*I-C.memory.buffer.byteLength;o>0&&C.memory.grow(Math.ceil(o/65536));const K=C.sa(I-1);if((A?B:Q)(E,new Uint16Array(C.memory.buffer,K,I)),!C.parse())throw Object.assign(new Error(`Parse error ${g}:${E.slice(0,C.e()).split("\n").length}:${C.e()-E.lastIndexOf("\n",C.e()-1)}`),{idx:C.e()});const D=[],k=[];for(;C.ri();){const A=C.is(),Q=C.ie(),B=C.ai(),g=C.id(),I=C.ss(),o=C.se();let K;C.ip()&&(K=J(E.slice(-1===g?A-1:A,-1===g?Q+1:Q))),D.push({n:K,s:A,e:Q,ss:I,se:o,d:g,a:B});}for(;C.re();){const A=C.es(),Q=C.ee(),B=C.els(),g=C.ele(),I=E.slice(A,Q),o=I[0],K=B<0?void 0:E.slice(B,g),D=K?K[0]:"";k.push({s:A,e:Q,ls:B,le:g,n:'"'===o||"'"===o?J(I):I,ln:'"'===D||"'"===D?J(K):K});}function J(A){try{return (0,eval)(A)}catch(A){}}return [D,k,!!C.f()]}function Q(A,Q){const B=A.length;let C=0;for(;C<B;){const B=A.charCodeAt(C);Q[C++]=(255&B)<<8|B>>>8;}}function B(A,Q){const B=A.length;let C=0;for(;C<B;)Q[C]=A.charCodeAt(C++);}let C;const init=WebAssembly.compile((E="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DQFBACgCoAohAQwCC0EAKAKgCiIBQQJqQbAIQQoQLQ0BQQYhAAwCC0EAKAKgCiIBLwECQekARw0AIAEvAQRB9ABHDQBBBCEAIAEvAQZB6ABGDQELQQAgAUF+ajYCoAoPC0EAIAEgAEEBdGo2AqAKAkBBARAnQfsARg0AQQAgATYCoAoPC0EAKAKgCiICIQADQEEAIABBAmo2AqAKAkACQAJAQQEQJyIAQSJGDQAgAEEnRw0BQScQGEEAQQAoAqAKQQJqNgKgCkEBECchAAwCC0EiEBhBAEEAKAKgCkECajYCoApBARAnIQAMAQsgABAqIQALAkAgAEE6Rg0AQQAgATYCoAoPC0EAQQAoAqAKQQJqNgKgCgJAQQEQJyIAQSJGDQAgAEEnRg0AQQAgATYCoAoPCyAAEBhBAEEAKAKgCkECajYCoAoCQAJAQQEQJyIAQSxGDQAgAEH9AEYNAUEAIAE2AqAKDwtBAEEAKAKgCkECajYCoApBARAnQf0ARg0AQQAoAqAKIQAMAQsLQQAoAuQJIgEgAjYCECABQQAoAqAKQQJqNgIMC20BAn8CQAJAA0ACQCAAQf//A3EiAUF3aiICQRdLDQBBASACdEGfgIAEcQ0CCyABQaABRg0BIAAhAiABECYNAkEAIQJBAEEAKAKgCiIAQQJqNgKgCiAALwECIgANAAwCCwsgACECCyACQf//A3ELqwEBBH8CQAJAQQAoAqAKIgIvAQAiA0HhAEYNACABIQQgACEFDAELQQAgAkEEajYCoApBARAnIQJBACgCoAohBQJAAkAgAkEiRg0AIAJBJ0YNACACECoaQQAoAqAKIQQMAQsgAhAYQQBBACgCoApBAmoiBDYCoAoLQQEQJyEDQQAoAqAKIQILAkAgAiAFRg0AIAUgBEEAIAAgACABRiICG0EAIAEgAhsQAgsgAwtyAQR/QQAoAqAKIQBBACgCpAohAQJAAkADQCAAQQJqIQIgACABTw0BAkACQCACLwEAIgNBpH9qDgIBBAALIAIhACADQXZqDgQCAQECAQsgAEEEaiEADAALC0EAIAI2AqAKECJBAA8LQQAgAjYCoApB3QALSQEDf0EAIQMCQCACRQ0AAkADQCAALQAAIgQgAS0AACIFRw0BIAFBAWohASAAQQFqIQAgAkF/aiICDQAMAgsLIAQgBWshAwsgAwsL4gECAEGACAvEAQAAeABwAG8AcgB0AG0AcABvAHIAdABlAHQAYQByAG8AbQB1AG4AYwB0AGkAbwBuAHMAcwBlAHIAdAB2AG8AeQBpAGUAZABlAGwAZQBjAG8AbgB0AGkAbgBpAG4AcwB0AGEAbgB0AHkAYgByAGUAYQByAGUAdAB1AHIAZABlAGIAdQBnAGcAZQBhAHcAYQBpAHQAaAByAHcAaABpAGwAZQBmAG8AcgBpAGYAYwBhAHQAYwBmAGkAbgBhAGwAbABlAGwAcwAAQcQJCxABAAAAAgAAAAAEAAAwOQAA","undefined"!=typeof Buffer?Buffer.from(E,"base64"):Uint8Array.from(atob(E),(A=>A.charCodeAt(0))))).then(WebAssembly.instantiate).then((({exports:A})=>{C=A;}));var E;

/* es-module-lexer 1.3.1 */
let e,a,r,i=2<<19;const s=1===new Uint8Array(new Uint16Array([1]).buffer)[0]?function(e,a){const r=e.length;let i=0;for(;i<r;)a[i]=e.charCodeAt(i++);}:function(e,a){const r=e.length;let i=0;for(;i<r;){const r=e.charCodeAt(i);a[i++]=(255&r)<<8|r>>>8;}},t="xportmportlassetaromsyncunctionssertvoyiedelecontininstantybreareturdebuggeawaithrwhileforifcatcfinallels";let f,c,n;function parse(l,k="@"){f=l,c=k;const u=2*f.length+(2<<18);if(u>i||!e){for(;u>i;)i*=2;a=new ArrayBuffer(i),s(t,new Uint16Array(a,16,105)),e=function(e,a,r){"use asm";var i=new e.Int8Array(r),s=new e.Int16Array(r),t=new e.Int32Array(r),f=new e.Uint8Array(r),c=new e.Uint16Array(r),n=1024;function b(){var e=0,a=0,r=0,f=0,b=0,u=0,w=0;w=n;n=n+10240|0;i[795]=1;s[395]=0;s[396]=0;t[67]=t[2];i[796]=0;t[66]=0;i[794]=0;t[68]=w+2048;t[69]=w;i[797]=0;e=(t[3]|0)+-2|0;t[70]=e;a=e+(t[64]<<1)|0;t[71]=a;e:while(1){r=e+2|0;t[70]=r;if(e>>>0>=a>>>0){u=18;break}a:do{switch(s[r>>1]|0){case 9:case 10:case 11:case 12:case 13:case 32:break;case 101:{if((((s[396]|0)==0?H(r)|0:0)?(m(e+4|0,16,10)|0)==0:0)?(l(),(i[795]|0)==0):0){u=9;break e}else u=17;break}case 105:{if(H(r)|0?(m(e+4|0,26,10)|0)==0:0){k();u=17;}else u=17;break}case 59:{u=17;break}case 47:switch(s[e+4>>1]|0){case 47:{P();break a}case 42:{y(1);break a}default:{u=16;break e}}default:{u=16;break e}}}while(0);if((u|0)==17){u=0;t[67]=t[70];}e=t[70]|0;a=t[71]|0;}if((u|0)==9){e=t[70]|0;t[67]=e;u=19;}else if((u|0)==16){i[795]=0;t[70]=e;u=19;}else if((u|0)==18)if(!(i[794]|0)){e=r;u=19;}else e=0;do{if((u|0)==19){e:while(1){a=e+2|0;t[70]=a;b=a;if(e>>>0>=(t[71]|0)>>>0){u=82;break}a:do{switch(s[a>>1]|0){case 9:case 10:case 11:case 12:case 13:case 32:break;case 101:{if(((s[396]|0)==0?H(a)|0:0)?(m(e+4|0,16,10)|0)==0:0){l();u=81;}else u=81;break}case 105:{if(H(a)|0?(m(e+4|0,26,10)|0)==0:0){k();u=81;}else u=81;break}case 99:{if((H(a)|0?(m(e+4|0,36,8)|0)==0:0)?V(s[e+12>>1]|0)|0:0){i[797]=1;u=81;}else u=81;break}case 40:{b=t[68]|0;r=s[396]|0;u=r&65535;t[b+(u<<3)>>2]=1;f=t[67]|0;s[396]=r+1<<16>>16;t[b+(u<<3)+4>>2]=f;u=81;break}case 41:{a=s[396]|0;if(!(a<<16>>16)){u=36;break e}u=a+-1<<16>>16;s[396]=u;f=s[395]|0;a=f&65535;if(f<<16>>16!=0?(t[(t[68]|0)+((u&65535)<<3)>>2]|0)==5:0){a=t[(t[69]|0)+(a+-1<<2)>>2]|0;r=a+4|0;if(!(t[r>>2]|0))t[r>>2]=b;t[a+12>>2]=e+4;s[395]=f+-1<<16>>16;u=81;}else u=81;break}case 123:{u=t[67]|0;b=t[61]|0;e=u;do{if((s[u>>1]|0)==41&(b|0)!=0?(t[b+4>>2]|0)==(u|0):0){a=t[62]|0;t[61]=a;if(!a){t[57]=0;break}else {t[a+28>>2]=0;break}}}while(0);b=t[68]|0;f=s[396]|0;u=f&65535;t[b+(u<<3)>>2]=(i[797]|0)==0?2:6;s[396]=f+1<<16>>16;t[b+(u<<3)+4>>2]=e;i[797]=0;u=81;break}case 125:{e=s[396]|0;if(!(e<<16>>16)){u=49;break e}b=t[68]|0;u=e+-1<<16>>16;s[396]=u;if((t[b+((u&65535)<<3)>>2]|0)==4){h();u=81;}else u=81;break}case 39:{d(39);u=81;break}case 34:{d(34);u=81;break}case 47:switch(s[e+4>>1]|0){case 47:{P();break a}case 42:{y(1);break a}default:{e=t[67]|0;f=s[e>>1]|0;r:do{if(!(U(f)|0)){switch(f<<16>>16){case 41:if(D(t[(t[68]|0)+(c[396]<<3)+4>>2]|0)|0){u=69;break r}else {u=66;break r}case 125:break;default:{u=66;break r}}a=t[68]|0;r=c[396]|0;if(!(p(t[a+(r<<3)+4>>2]|0)|0)?(t[a+(r<<3)>>2]|0)!=6:0)u=66;else u=69;}else switch(f<<16>>16){case 46:if(((s[e+-2>>1]|0)+-48&65535)<10){u=66;break r}else {u=69;break r}case 43:if((s[e+-2>>1]|0)==43){u=66;break r}else {u=69;break r}case 45:if((s[e+-2>>1]|0)==45){u=66;break r}else {u=69;break r}default:{u=69;break r}}}while(0);r:do{if((u|0)==66){u=0;if(!(o(e)|0)){switch(f<<16>>16){case 0:{u=69;break r}case 47:{if(i[796]|0){u=69;break r}break}default:{}}r=t[3]|0;a=f;do{if(e>>>0<=r>>>0)break;e=e+-2|0;t[67]=e;a=s[e>>1]|0;}while(!(E(a)|0));if(F(a)|0){do{if(e>>>0<=r>>>0)break;e=e+-2|0;t[67]=e;}while(F(s[e>>1]|0)|0);if(j(e)|0){g();i[796]=0;u=81;break a}else e=1;}else e=1;}else u=69;}}while(0);if((u|0)==69){g();e=0;}i[796]=e;u=81;break a}}case 96:{b=t[68]|0;f=s[396]|0;u=f&65535;t[b+(u<<3)+4>>2]=t[67];s[396]=f+1<<16>>16;t[b+(u<<3)>>2]=3;h();u=81;break}default:u=81;}}while(0);if((u|0)==81){u=0;t[67]=t[70];}e=t[70]|0;}if((u|0)==36){T();e=0;break}else if((u|0)==49){T();e=0;break}else if((u|0)==82){e=(i[794]|0)==0?(s[395]|s[396])<<16>>16==0:0;break}}}while(0);n=w;return e|0}function l(){var e=0,a=0,r=0,f=0,c=0,n=0,b=0,l=0,k=0,o=0,h=0,A=0,C=0,g=0;l=t[70]|0;k=t[63]|0;g=l+12|0;t[70]=g;r=w(1)|0;e=t[70]|0;if(!((e|0)==(g|0)?!(I(r)|0):0))C=3;e:do{if((C|0)==3){a:do{switch(r<<16>>16){case 123:{t[70]=e+2;e=w(1)|0;r=t[70]|0;while(1){if(W(e)|0){d(e);e=(t[70]|0)+2|0;t[70]=e;}else {q(e)|0;e=t[70]|0;}w(1)|0;e=v(r,e)|0;if(e<<16>>16==44){t[70]=(t[70]|0)+2;e=w(1)|0;}a=r;r=t[70]|0;if(e<<16>>16==125){C=15;break}if((r|0)==(a|0)){C=12;break}if(r>>>0>(t[71]|0)>>>0){C=14;break}}if((C|0)==12){T();break e}else if((C|0)==14){T();break e}else if((C|0)==15){t[70]=r+2;break a}break}case 42:{t[70]=e+2;w(1)|0;g=t[70]|0;v(g,g)|0;break}default:{i[795]=0;switch(r<<16>>16){case 100:{l=e+14|0;t[70]=l;switch((w(1)|0)<<16>>16){case 97:{a=t[70]|0;if((m(a+2|0,56,8)|0)==0?(c=a+10|0,F(s[c>>1]|0)|0):0){t[70]=c;w(0)|0;C=22;}break}case 102:{C=22;break}case 99:{a=t[70]|0;if(((m(a+2|0,36,8)|0)==0?(f=a+10|0,g=s[f>>1]|0,V(g)|0|g<<16>>16==123):0)?(t[70]=f,n=w(1)|0,n<<16>>16!=123):0){A=n;C=31;}break}default:{}}r:do{if((C|0)==22?(b=t[70]|0,(m(b+2|0,64,14)|0)==0):0){r=b+16|0;a=s[r>>1]|0;if(!(V(a)|0))switch(a<<16>>16){case 40:case 42:break;default:break r}t[70]=r;a=w(1)|0;if(a<<16>>16==42){t[70]=(t[70]|0)+2;a=w(1)|0;}if(a<<16>>16!=40){A=a;C=31;}}}while(0);if((C|0)==31?(o=t[70]|0,q(A)|0,h=t[70]|0,h>>>0>o>>>0):0){$(e,l,o,h);t[70]=(t[70]|0)+-2;break e}$(e,l,0,0);t[70]=e+12;break e}case 97:{t[70]=e+10;w(0)|0;e=t[70]|0;C=35;break}case 102:{C=35;break}case 99:{if((m(e+2|0,36,8)|0)==0?(a=e+10|0,E(s[a>>1]|0)|0):0){t[70]=a;g=w(1)|0;C=t[70]|0;q(g)|0;g=t[70]|0;$(C,g,C,g);t[70]=(t[70]|0)+-2;break e}e=e+4|0;t[70]=e;break}case 108:case 118:break;default:break e}if((C|0)==35){t[70]=e+16;e=w(1)|0;if(e<<16>>16==42){t[70]=(t[70]|0)+2;e=w(1)|0;}C=t[70]|0;q(e)|0;g=t[70]|0;$(C,g,C,g);t[70]=(t[70]|0)+-2;break e}t[70]=e+6;i[795]=0;r=w(1)|0;e=t[70]|0;r=(q(r)|0|32)<<16>>16==123;f=t[70]|0;if(r){t[70]=f+2;g=w(1)|0;e=t[70]|0;q(g)|0;}r:while(1){a=t[70]|0;if((a|0)==(e|0))break;$(e,a,e,a);a=w(1)|0;if(r)switch(a<<16>>16){case 93:case 125:break e;default:{}}e=t[70]|0;if(a<<16>>16!=44){C=51;break}t[70]=e+2;a=w(1)|0;e=t[70]|0;switch(a<<16>>16){case 91:case 123:{C=51;break r}default:{}}q(a)|0;}if((C|0)==51)t[70]=e+-2;if(!r)break e;t[70]=f+-2;break e}}}while(0);g=(w(1)|0)<<16>>16==102;e=t[70]|0;if(g?(m(e+2|0,50,6)|0)==0:0){t[70]=e+8;u(l,w(1)|0);e=(k|0)==0?232:k+16|0;while(1){e=t[e>>2]|0;if(!e)break e;t[e+12>>2]=0;t[e+8>>2]=0;e=e+16|0;}}t[70]=e+-2;}}while(0);return}function k(){var e=0,a=0,r=0,f=0,c=0,n=0;c=t[70]|0;e=c+12|0;t[70]=e;e:do{switch((w(1)|0)<<16>>16){case 40:{a=t[68]|0;n=s[396]|0;r=n&65535;t[a+(r<<3)>>2]=5;e=t[70]|0;s[396]=n+1<<16>>16;t[a+(r<<3)+4>>2]=e;if((s[t[67]>>1]|0)!=46){t[70]=e+2;n=w(1)|0;A(c,t[70]|0,0,e);a=t[61]|0;r=t[69]|0;c=s[395]|0;s[395]=c+1<<16>>16;t[r+((c&65535)<<2)>>2]=a;switch(n<<16>>16){case 39:{d(39);break}case 34:{d(34);break}default:{t[70]=(t[70]|0)+-2;break e}}e=(t[70]|0)+2|0;t[70]=e;switch((w(1)|0)<<16>>16){case 44:{t[70]=(t[70]|0)+2;w(1)|0;c=t[61]|0;t[c+4>>2]=e;n=t[70]|0;t[c+16>>2]=n;i[c+24>>0]=1;t[70]=n+-2;break e}case 41:{s[396]=(s[396]|0)+-1<<16>>16;n=t[61]|0;t[n+4>>2]=e;t[n+12>>2]=(t[70]|0)+2;i[n+24>>0]=1;s[395]=(s[395]|0)+-1<<16>>16;break e}default:{t[70]=(t[70]|0)+-2;break e}}}break}case 46:{t[70]=(t[70]|0)+2;if((w(1)|0)<<16>>16==109?(a=t[70]|0,(m(a+2|0,44,6)|0)==0):0){e=t[67]|0;if(!(G(e)|0)?(s[e>>1]|0)==46:0)break e;A(c,c,a+8|0,2);}break}case 42:case 39:case 34:{f=18;break}case 123:{e=t[70]|0;if(s[396]|0){t[70]=e+-2;break e}while(1){if(e>>>0>=(t[71]|0)>>>0)break;e=w(1)|0;if(!(W(e)|0)){if(e<<16>>16==125){f=33;break}}else d(e);e=(t[70]|0)+2|0;t[70]=e;}if((f|0)==33)t[70]=(t[70]|0)+2;n=(w(1)|0)<<16>>16==102;e=t[70]|0;if(n?m(e+2|0,50,6)|0:0){T();break e}t[70]=e+8;e=w(1)|0;if(W(e)|0){u(c,e);break e}else {T();break e}}default:if((t[70]|0)==(e|0))t[70]=c+10;else f=18;}}while(0);do{if((f|0)==18){if(s[396]|0){t[70]=(t[70]|0)+-2;break}e=t[71]|0;a=t[70]|0;while(1){if(a>>>0>=e>>>0){f=25;break}r=s[a>>1]|0;if(W(r)|0){f=23;break}n=a+2|0;t[70]=n;a=n;}if((f|0)==23){u(c,r);break}else if((f|0)==25){T();break}}}while(0);return}function u(e,a){e=e|0;a=a|0;var r=0,i=0;r=(t[70]|0)+2|0;switch(a<<16>>16){case 39:{d(39);i=5;break}case 34:{d(34);i=5;break}default:T();}do{if((i|0)==5){A(e,r,t[70]|0,1);t[70]=(t[70]|0)+2;a=w(0)|0;e=a<<16>>16==97;if(e){r=t[70]|0;if(m(r+2|0,78,10)|0)i=11;}else {r=t[70]|0;if(!(((a<<16>>16==119?(s[r+2>>1]|0)==105:0)?(s[r+4>>1]|0)==116:0)?(s[r+6>>1]|0)==104:0))i=11;}if((i|0)==11){t[70]=r+-2;break}t[70]=r+((e?6:4)<<1);if((w(1)|0)<<16>>16!=123){t[70]=r;break}e=t[70]|0;a=e;e:while(1){t[70]=a+2;a=w(1)|0;switch(a<<16>>16){case 39:{d(39);t[70]=(t[70]|0)+2;a=w(1)|0;break}case 34:{d(34);t[70]=(t[70]|0)+2;a=w(1)|0;break}default:a=q(a)|0;}if(a<<16>>16!=58){i=20;break}t[70]=(t[70]|0)+2;switch((w(1)|0)<<16>>16){case 39:{d(39);break}case 34:{d(34);break}default:{i=24;break e}}t[70]=(t[70]|0)+2;switch((w(1)|0)<<16>>16){case 125:{i=29;break e}case 44:break;default:{i=28;break e}}t[70]=(t[70]|0)+2;if((w(1)|0)<<16>>16==125){i=29;break}a=t[70]|0;}if((i|0)==20){t[70]=r;break}else if((i|0)==24){t[70]=r;break}else if((i|0)==28){t[70]=r;break}else if((i|0)==29){i=t[61]|0;t[i+16>>2]=e;t[i+12>>2]=(t[70]|0)+2;break}}}while(0);return}function o(e){e=e|0;e:do{switch(s[e>>1]|0){case 100:switch(s[e+-2>>1]|0){case 105:{e=O(e+-4|0,88,2)|0;break e}case 108:{e=O(e+-4|0,92,3)|0;break e}default:{e=0;break e}}case 101:switch(s[e+-2>>1]|0){case 115:switch(s[e+-4>>1]|0){case 108:{e=B(e+-6|0,101)|0;break e}case 97:{e=B(e+-6|0,99)|0;break e}default:{e=0;break e}}case 116:{e=O(e+-4|0,98,4)|0;break e}case 117:{e=O(e+-4|0,106,6)|0;break e}default:{e=0;break e}}case 102:{if((s[e+-2>>1]|0)==111?(s[e+-4>>1]|0)==101:0)switch(s[e+-6>>1]|0){case 99:{e=O(e+-8|0,118,6)|0;break e}case 112:{e=O(e+-8|0,130,2)|0;break e}default:{e=0;break e}}else e=0;break}case 107:{e=O(e+-2|0,134,4)|0;break}case 110:{e=e+-2|0;if(B(e,105)|0)e=1;else e=O(e,142,5)|0;break}case 111:{e=B(e+-2|0,100)|0;break}case 114:{e=O(e+-2|0,152,7)|0;break}case 116:{e=O(e+-2|0,166,4)|0;break}case 119:switch(s[e+-2>>1]|0){case 101:{e=B(e+-4|0,110)|0;break e}case 111:{e=O(e+-4|0,174,3)|0;break e}default:{e=0;break e}}default:e=0;}}while(0);return e|0}function h(){var e=0,a=0,r=0,i=0;a=t[71]|0;r=t[70]|0;e:while(1){e=r+2|0;if(r>>>0>=a>>>0){a=10;break}switch(s[e>>1]|0){case 96:{a=7;break e}case 36:{if((s[r+4>>1]|0)==123){a=6;break e}break}case 92:{e=r+4|0;break}default:{}}r=e;}if((a|0)==6){e=r+4|0;t[70]=e;a=t[68]|0;i=s[396]|0;r=i&65535;t[a+(r<<3)>>2]=4;s[396]=i+1<<16>>16;t[a+(r<<3)+4>>2]=e;}else if((a|0)==7){t[70]=e;r=t[68]|0;i=(s[396]|0)+-1<<16>>16;s[396]=i;if((t[r+((i&65535)<<3)>>2]|0)!=3)T();}else if((a|0)==10){t[70]=e;T();}return}function w(e){e=e|0;var a=0,r=0,i=0;r=t[70]|0;e:do{a=s[r>>1]|0;a:do{if(a<<16>>16!=47)if(e)if(V(a)|0)break;else break e;else if(F(a)|0)break;else break e;else switch(s[r+2>>1]|0){case 47:{P();break a}case 42:{y(e);break a}default:{a=47;break e}}}while(0);i=t[70]|0;r=i+2|0;t[70]=r;}while(i>>>0<(t[71]|0)>>>0);return a|0}function d(e){e=e|0;var a=0,r=0,i=0,f=0;f=t[71]|0;a=t[70]|0;while(1){i=a+2|0;if(a>>>0>=f>>>0){a=9;break}r=s[i>>1]|0;if(r<<16>>16==e<<16>>16){a=10;break}if(r<<16>>16==92){r=a+4|0;if((s[r>>1]|0)==13){a=a+6|0;a=(s[a>>1]|0)==10?a:r;}else a=r;}else if(Z(r)|0){a=9;break}else a=i;}if((a|0)==9){t[70]=i;T();}else if((a|0)==10)t[70]=i;return}function v(e,a){e=e|0;a=a|0;var r=0,i=0,f=0,c=0;r=t[70]|0;i=s[r>>1]|0;c=(e|0)==(a|0);f=c?0:e;c=c?0:a;if(i<<16>>16==97){t[70]=r+4;r=w(1)|0;e=t[70]|0;if(W(r)|0){d(r);a=(t[70]|0)+2|0;t[70]=a;}else {q(r)|0;a=t[70]|0;}i=w(1)|0;r=t[70]|0;}if((r|0)!=(e|0))$(e,a,f,c);return i|0}function A(e,a,r,s){e=e|0;a=a|0;r=r|0;s=s|0;var f=0,c=0;f=t[65]|0;t[65]=f+32;c=t[61]|0;t[((c|0)==0?228:c+28|0)>>2]=f;t[62]=c;t[61]=f;t[f+8>>2]=e;if(2==(s|0))e=r;else e=1==(s|0)?r+2|0:0;t[f+12>>2]=e;t[f>>2]=a;t[f+4>>2]=r;t[f+16>>2]=0;t[f+20>>2]=s;i[f+24>>0]=1==(s|0)&1;t[f+28>>2]=0;return}function C(){var e=0,a=0,r=0;r=t[71]|0;a=t[70]|0;e:while(1){e=a+2|0;if(a>>>0>=r>>>0){a=6;break}switch(s[e>>1]|0){case 13:case 10:{a=6;break e}case 93:{a=7;break e}case 92:{e=a+4|0;break}default:{}}a=e;}if((a|0)==6){t[70]=e;T();e=0;}else if((a|0)==7){t[70]=e;e=93;}return e|0}function g(){var e=0,a=0,r=0;e:while(1){e=t[70]|0;a=e+2|0;t[70]=a;if(e>>>0>=(t[71]|0)>>>0){r=7;break}switch(s[a>>1]|0){case 13:case 10:{r=7;break e}case 47:break e;case 91:{C()|0;break}case 92:{t[70]=e+4;break}default:{}}}if((r|0)==7)T();return}function p(e){e=e|0;switch(s[e>>1]|0){case 62:{e=(s[e+-2>>1]|0)==61;break}case 41:case 59:{e=1;break}case 104:{e=O(e+-2|0,200,4)|0;break}case 121:{e=O(e+-2|0,208,6)|0;break}case 101:{e=O(e+-2|0,220,3)|0;break}default:e=0;}return e|0}function y(e){e=e|0;var a=0,r=0,i=0,f=0,c=0;f=(t[70]|0)+2|0;t[70]=f;r=t[71]|0;while(1){a=f+2|0;if(f>>>0>=r>>>0)break;i=s[a>>1]|0;if(!e?Z(i)|0:0)break;if(i<<16>>16==42?(s[f+4>>1]|0)==47:0){c=8;break}f=a;}if((c|0)==8){t[70]=a;a=f+4|0;}t[70]=a;return}function m(e,a,r){e=e|0;a=a|0;r=r|0;var s=0,t=0;e:do{if(!r)e=0;else {while(1){s=i[e>>0]|0;t=i[a>>0]|0;if(s<<24>>24!=t<<24>>24)break;r=r+-1|0;if(!r){e=0;break e}else {e=e+1|0;a=a+1|0;}}e=(s&255)-(t&255)|0;}}while(0);return e|0}function I(e){e=e|0;e:do{switch(e<<16>>16){case 38:case 37:case 33:{e=1;break}default:if((e&-8)<<16>>16==40|(e+-58&65535)<6)e=1;else {switch(e<<16>>16){case 91:case 93:case 94:{e=1;break e}default:{}}e=(e+-123&65535)<4;}}}while(0);return e|0}function U(e){e=e|0;e:do{switch(e<<16>>16){case 38:case 37:case 33:break;default:if(!((e+-58&65535)<6|(e+-40&65535)<7&e<<16>>16!=41)){switch(e<<16>>16){case 91:case 94:break e;default:{}}return e<<16>>16!=125&(e+-123&65535)<4|0}}}while(0);return 1}function x(e){e=e|0;var a=0;a=s[e>>1]|0;e:do{if((a+-9&65535)>=5){switch(a<<16>>16){case 160:case 32:{a=1;break e}default:{}}if(I(a)|0)return a<<16>>16!=46|(G(e)|0)|0;else a=0;}else a=1;}while(0);return a|0}function S(e){e=e|0;var a=0,r=0,i=0,f=0;r=n;n=n+16|0;i=r;t[i>>2]=0;t[64]=e;a=t[3]|0;f=a+(e<<1)|0;e=f+2|0;s[f>>1]=0;t[i>>2]=e;t[65]=e;t[57]=0;t[61]=0;t[59]=0;t[58]=0;t[63]=0;t[60]=0;n=r;return a|0}function O(e,a,r){e=e|0;a=a|0;r=r|0;var i=0,s=0;i=e+(0-r<<1)|0;s=i+2|0;e=t[3]|0;if(s>>>0>=e>>>0?(m(s,a,r<<1)|0)==0:0)if((s|0)==(e|0))e=1;else e=x(i)|0;else e=0;return e|0}function $(e,a,r,i){e=e|0;a=a|0;r=r|0;i=i|0;var s=0,f=0;s=t[65]|0;t[65]=s+20;f=t[63]|0;t[((f|0)==0?232:f+16|0)>>2]=s;t[63]=s;t[s>>2]=e;t[s+4>>2]=a;t[s+8>>2]=r;t[s+12>>2]=i;t[s+16>>2]=0;return}function j(e){e=e|0;switch(s[e>>1]|0){case 107:{e=O(e+-2|0,134,4)|0;break}case 101:{if((s[e+-2>>1]|0)==117)e=O(e+-4|0,106,6)|0;else e=0;break}default:e=0;}return e|0}function B(e,a){e=e|0;a=a|0;var r=0;r=t[3]|0;if(r>>>0<=e>>>0?(s[e>>1]|0)==a<<16>>16:0)if((r|0)==(e|0))r=1;else r=E(s[e+-2>>1]|0)|0;else r=0;return r|0}function E(e){e=e|0;e:do{if((e+-9&65535)<5)e=1;else {switch(e<<16>>16){case 32:case 160:{e=1;break e}default:{}}e=e<<16>>16!=46&(I(e)|0);}}while(0);return e|0}function P(){var e=0,a=0,r=0;e=t[71]|0;r=t[70]|0;e:while(1){a=r+2|0;if(r>>>0>=e>>>0)break;switch(s[a>>1]|0){case 13:case 10:break e;default:r=a;}}t[70]=a;return}function q(e){e=e|0;while(1){if(V(e)|0)break;if(I(e)|0)break;e=(t[70]|0)+2|0;t[70]=e;e=s[e>>1]|0;if(!(e<<16>>16)){e=0;break}}return e|0}function z(){var e=0;e=t[(t[59]|0)+20>>2]|0;switch(e|0){case 1:{e=-1;break}case 2:{e=-2;break}default:e=e-(t[3]|0)>>1;}return e|0}function D(e){e=e|0;if(!(O(e,180,5)|0)?!(O(e,190,3)|0):0)e=O(e,196,2)|0;else e=1;return e|0}function F(e){e=e|0;switch(e<<16>>16){case 160:case 32:case 12:case 11:case 9:{e=1;break}default:e=0;}return e|0}function G(e){e=e|0;if((s[e>>1]|0)==46?(s[e+-2>>1]|0)==46:0)e=(s[e+-4>>1]|0)==46;else e=0;return e|0}function H(e){e=e|0;if((t[3]|0)==(e|0))e=1;else e=x(e+-2|0)|0;return e|0}function J(){var e=0;e=t[(t[60]|0)+12>>2]|0;if(!e)e=-1;else e=e-(t[3]|0)>>1;return e|0}function K(){var e=0;e=t[(t[59]|0)+12>>2]|0;if(!e)e=-1;else e=e-(t[3]|0)>>1;return e|0}function L(){var e=0;e=t[(t[60]|0)+8>>2]|0;if(!e)e=-1;else e=e-(t[3]|0)>>1;return e|0}function M(){var e=0;e=t[(t[59]|0)+16>>2]|0;if(!e)e=-1;else e=e-(t[3]|0)>>1;return e|0}function N(){var e=0;e=t[(t[59]|0)+4>>2]|0;if(!e)e=-1;else e=e-(t[3]|0)>>1;return e|0}function Q(){var e=0;e=t[59]|0;e=t[((e|0)==0?228:e+28|0)>>2]|0;t[59]=e;return (e|0)!=0|0}function R(){var e=0;e=t[60]|0;e=t[((e|0)==0?232:e+16|0)>>2]|0;t[60]=e;return (e|0)!=0|0}function T(){i[794]=1;t[66]=(t[70]|0)-(t[3]|0)>>1;t[70]=(t[71]|0)+2;return}function V(e){e=e|0;return (e|128)<<16>>16==160|(e+-9&65535)<5|0}function W(e){e=e|0;return e<<16>>16==39|e<<16>>16==34|0}function X(){return (t[(t[59]|0)+8>>2]|0)-(t[3]|0)>>1|0}function Y(){return (t[(t[60]|0)+4>>2]|0)-(t[3]|0)>>1|0}function Z(e){e=e|0;return e<<16>>16==13|e<<16>>16==10|0}function _(){return (t[t[59]>>2]|0)-(t[3]|0)>>1|0}function ee(){return (t[t[60]>>2]|0)-(t[3]|0)>>1|0}function ae(){return f[(t[59]|0)+24>>0]|0|0}function re(e){e=e|0;t[3]=e;return}function ie(){return (i[795]|0)!=0|0}function se(){return t[66]|0}function te(e){e=e|0;n=e+992+15&-16;return 992}return {su:te,ai:M,e:se,ee:Y,ele:J,els:L,es:ee,f:ie,id:z,ie:N,ip:ae,is:_,p:b,re:R,ri:Q,sa:S,se:K,ses:re,ss:X}}("undefined"!=typeof self?self:global,{},a),r=e.su(i-(2<<17));}const h=f.length+1;e.ses(r),e.sa(h-1),s(f,new Uint16Array(a,r,h)),e.p()||(n=e.e(),o());const w=[],d=[];for(;e.ri();){const a=e.is(),r=e.ie(),i=e.ai(),s=e.id(),t=e.ss(),c=e.se();let n;e.ip()&&(n=b(-1===s?a:a+1,f.charCodeAt(-1===s?a-1:a))),w.push({n:n,s:a,e:r,ss:t,se:c,d:s,a:i});}for(;e.re();){const a=e.es(),r=e.ee(),i=e.els(),s=e.ele(),t=f.charCodeAt(a),c=i>=0?f.charCodeAt(i):-1;d.push({s:a,e:r,ls:i,le:s,n:34===t||39===t?b(a+1,t):f.slice(a,r),ln:i<0?void 0:34===c||39===c?b(i+1,c):f.slice(i,s)});}return [w,d,!!e.f()]}function b(e,a){n=e;let r="",i=n;for(;;){n>=f.length&&o();const e=f.charCodeAt(n);if(e===a)break;92===e?(r+=f.slice(i,n),r+=l(),i=n):(8232===e||8233===e||u(e)&&o(),++n);}return r+=f.slice(i,n++),r}function l(){let e=f.charCodeAt(++n);switch(++n,e){case 110:return "\n";case 114:return "\r";case 120:return String.fromCharCode(k(2));case 117:return function(){const e=f.charCodeAt(n);let a;123===e?(++n,a=k(f.indexOf("}",n)-n),++n,a>1114111&&o()):a=k(4);return a<=65535?String.fromCharCode(a):(a-=65536,String.fromCharCode(55296+(a>>10),56320+(1023&a)))}();case 116:return "\t";case 98:return "\b";case 118:return "\v";case 102:return "\f";case 13:10===f.charCodeAt(n)&&++n;case 10:return "";case 56:case 57:o();default:if(e>=48&&e<=55){let a=f.substr(n-1,3).match(/^[0-7]+/)[0],r=parseInt(a,8);return r>255&&(a=a.slice(0,-1),r=parseInt(a,8)),n+=a.length-1,e=f.charCodeAt(n),"0"===a&&56!==e&&57!==e||o(),String.fromCharCode(r)}return u(e)?"":String.fromCharCode(e)}}function k(e){const a=n;let r=0,i=0;for(let a=0;a<e;++a,++n){let e,s=f.charCodeAt(n);if(95!==s){if(s>=97)e=s-97+10;else if(s>=65)e=s-65+10;else {if(!(s>=48&&s<=57))break;e=s-48;}if(e>=16)break;i=s,r=16*r+e;}else 95!==i&&0!==a||o(),i=s;}return 95!==i&&n-a===e||o(),r}function u(e){return 13===e||10===e}function o(){throw Object.assign(Error(`Parse error ${c}:${f.slice(0,n).split("\n").length}:${n-f.lastIndexOf("\n",n-1)}`),{idx:n})}

let wasmParserInitialized = false;
init.then(() => {
  wasmParserInitialized = true;
});
const parseEsm = (code) => wasmParserInitialized ? parse$1(code) : parse(code);

const handlerName = "___tsxInteropDynamicImport";
const handleEsModuleFunction = `function ${handlerName}${function(imported) {
  const d = "default";
  const exports = Object.keys(imported);
  if (exports.length === 1 && exports[0] === d && imported[d] && typeof imported[d] === "object" && "__esModule" in imported[d]) {
    return imported[d];
  }
  return imported;
}.toString().slice("function".length)}`;
const handleDynamicImport = `.then(${handlerName})`;
const esmImportPattern = /\bimport\b/;
const transformDynamicImport = (filePath, code) => {
  if (!esmImportPattern.test(code)) {
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
  magicString.append(handleEsModuleFunction);
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
    const jsonString = fs__default["default"].readFileSync(filePath, "utf8");
    return JSON.parse(jsonString);
  } catch {
  }
}

const getTime = () => Math.floor(Date.now() / 1e8);
const tmpdir = require$$2__default["default"].tmpdir();
const noop = () => {
};
const { geteuid } = process;
const cacheDirectoryName = geteuid === void 0 ? "tsx" : `tsx-${geteuid()}`;
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
  cacheDirectory = path__default["default"].join(
    // Write permissions by anyone
    tmpdir,
    cacheDirectoryName
  );
  // Maintained so we can remove it on Windows
  oldCacheDirectory = path__default["default"].join(tmpdir, "tsx");
  cacheFiles;
  constructor() {
    super();
    fs__default["default"].mkdirSync(this.cacheDirectory, { recursive: true });
    this.cacheFiles = fs__default["default"].readdirSync(this.cacheDirectory).map((fileName) => {
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
    const cacheFilePath = path__default["default"].join(this.cacheDirectory, diskCacheHit.fileName);
    const cachedResult = readJsonFile(cacheFilePath);
    if (!cachedResult) {
      fs__default["default"].promises.unlink(cacheFilePath).then(
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
      fs__default["default"].promises.writeFile(
        path__default["default"].join(this.cacheDirectory, `${time}-${key}`),
        JSON.stringify(value)
      ).catch(noop);
    }
    return this;
  }
  expireDiskCache() {
    const time = getTime();
    for (const cache of this.cacheFiles) {
      if (time - cache.time > 7) {
        fs__default["default"].promises.unlink(path__default["default"].join(this.cacheDirectory, cache.fileName)).catch(noop);
      }
    }
  }
  async removeOldCacheDirectory() {
    try {
      const exists = await fs__default["default"].promises.access(this.oldCacheDirectory).then(() => true);
      if (exists) {
        if ("rm" in fs__default["default"].promises) {
          await fs__default["default"].promises.rm(
            this.oldCacheDirectory,
            {
              recursive: true,
              force: true
            }
          );
        } else {
          await fs__default["default"].promises.rmdir(
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
    const extension = path__default["default"].extname(sourcefile);
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
    define["import.meta.url"] = `'${url.pathToFileURL(filePath)}'`;
  }
  const esbuildOptions = getEsbuildOptions({
    format: "cjs",
    sourcefile: filePath,
    define,
    banner: "(()=>{",
    footer: "})()",
    ...extendOptions
  });
  const hash = sha1(code + JSON.stringify(esbuildOptions) + esbuild.version);
  let transformed = cache.get(hash);
  if (!transformed) {
    transformed = applyTransformersSync(
      filePath,
      code,
      [
        // eslint-disable-next-line @typescript-eslint/no-shadow
        (filePath2, code2) => {
          const transformed2 = esbuild.transformSync(code2, esbuildOptions);
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
  const hash = sha1(code + JSON.stringify(esbuildOptions) + esbuild.version);
  let transformed = cache.get(hash);
  if (!transformed) {
    transformed = await applyTransformers(
      filePath,
      code,
      [
        // eslint-disable-next-line @typescript-eslint/no-shadow
        async (filePath2, code2) => {
          const transformed2 = await esbuild.transform(code2, esbuildOptions);
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

exports.parseEsm = parseEsm;
exports.transform = transform;
exports.transformDynamicImport = transformDynamicImport;
exports.transformSync = transformSync;
