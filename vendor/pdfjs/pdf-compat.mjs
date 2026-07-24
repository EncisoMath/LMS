/* EncisoMath PDF.js compatibility layer.
 * Loaded in both the page and the PDF worker before PDF.js 6.1.200.
 * It fills the modern JavaScript APIs missing from Safari/iOS and older WebViews.
 */
const root = globalThis;

function defineValue(target, name, value) {
  if (!target || typeof target[name] !== 'undefined') return;
  try {
    Object.defineProperty(target, name, {
      value,
      configurable: true,
      writable: true
    });
  } catch (_) {
    try { target[name] = value; } catch (_) {}
  }
}

defineValue(Map.prototype, 'getOrInsertComputed', function getOrInsertComputed(key, callback) {
  if (this.has(key)) return this.get(key);
  const value = callback(key);
  this.set(key, value);
  return value;
});

defineValue(Map.prototype, 'getOrInsert', function getOrInsert(key, value) {
  if (this.has(key)) return this.get(key);
  this.set(key, value);
  return value;
});

defineValue(Promise, 'withResolvers', function withResolvers() {
  let resolve;
  let reject;
  const promise = new this((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
});

defineValue(Promise, 'try', function promiseTry(callback, ...args) {
  return new this((resolve, reject) => {
    try { resolve(callback(...args)); }
    catch (error) { reject(error); }
  });
});

if (typeof URL !== 'undefined') {
  defineValue(URL, 'parse', function parseUrl(url, base) {
    try { return base === undefined ? new URL(url) : new URL(url, base); }
    catch (_) { return null; }
  });
}

defineValue(Object, 'hasOwn', function hasOwn(object, property) {
  return Object.prototype.hasOwnProperty.call(Object(object), property);
});

defineValue(String.prototype, 'replaceAll', function replaceAll(search, replacement) {
  if (search instanceof RegExp) {
    if (!search.global) throw new TypeError('String.prototype.replaceAll requires a global RegExp');
    return this.replace(search, replacement);
  }
  const source = String(this);
  const token = String(search);
  if (!token) {
    const replacer = typeof replacement === 'function'
      ? (_, index) => String(replacement('', index, source))
      : () => String(replacement);
    let output = replacer('', 0);
    for (let index = 0; index < source.length; index += 1) output += source[index] + replacer('', index + 1);
    return output;
  }
  if (typeof replacement === 'function') {
    let output = '';
    let cursor = 0;
    let index;
    while ((index = source.indexOf(token, cursor)) !== -1) {
      output += source.slice(cursor, index) + String(replacement(token, index, source));
      cursor = index + token.length;
    }
    return output + source.slice(cursor);
  }
  return source.split(token).join(String(replacement).replace(/\$/g, '$$$$'));
});

function at(index) {
  const object = Object(this);
  const length = Number(object.length) >>> 0;
  let position = Number(index) || 0;
  if (position < 0) position += length;
  return position < 0 || position >= length ? undefined : object[position];
}
defineValue(Array.prototype, 'at', at);
defineValue(String.prototype, 'at', at);
[
  typeof Int8Array !== 'undefined' && Int8Array,
  typeof Uint8Array !== 'undefined' && Uint8Array,
  typeof Uint8ClampedArray !== 'undefined' && Uint8ClampedArray,
  typeof Int16Array !== 'undefined' && Int16Array,
  typeof Uint16Array !== 'undefined' && Uint16Array,
  typeof Int32Array !== 'undefined' && Int32Array,
  typeof Uint32Array !== 'undefined' && Uint32Array,
  typeof Float32Array !== 'undefined' && Float32Array,
  typeof Float64Array !== 'undefined' && Float64Array,
  typeof BigInt64Array !== 'undefined' && BigInt64Array,
  typeof BigUint64Array !== 'undefined' && BigUint64Array
].filter(Boolean).forEach((TypedArray) => defineValue(TypedArray.prototype, 'at', at));

defineValue(Array.prototype, 'findLast', function findLast(callback, thisArg) {
  if (typeof callback !== 'function') throw new TypeError('callback must be a function');
  const object = Object(this);
  for (let index = (Number(object.length) >>> 0) - 1; index >= 0; index -= 1) {
    const value = object[index];
    if (callback.call(thisArg, value, index, object)) return value;
  }
  return undefined;
});

defineValue(Set.prototype, 'intersection', function intersection(other) {
  const result = new Set();
  if (!other || typeof other.has !== 'function') return result;
  for (const value of this) if (other.has(value)) result.add(value);
  return result;
});

if (typeof AbortSignal !== 'undefined' && typeof AbortController !== 'undefined') {
  defineValue(AbortSignal, 'any', function abortSignalAny(signals) {
    const controller = new AbortController();
    const list = Array.from(signals || []);
    const abortFrom = (signal) => {
      if (controller.signal.aborted) return;
      try { controller.abort(signal?.reason); }
      catch (_) { controller.abort(); }
    };
    for (const signal of list) {
      if (!signal) continue;
      if (signal.aborted) {
        abortFrom(signal);
        break;
      }
      signal.addEventListener?.('abort', () => abortFrom(signal), { once: true });
    }
    return controller.signal;
  });
}

function bytesToBinary(bytes) {
  let binary = '';
  const chunkSize = 8192;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return binary;
}

function binaryToBytes(binary) {
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index) & 255;
  return bytes;
}

defineValue(Uint8Array.prototype, 'toHex', function toHex() {
  let result = '';
  for (const byte of this) result += byte.toString(16).padStart(2, '0');
  return result;
});

defineValue(Uint8Array, 'fromBase64', function fromBase64(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  if (typeof root.atob === 'function') return binaryToBytes(root.atob(normalized));
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let bits = 0;
  let bitCount = 0;
  const output = [];
  for (const char of normalized.replace(/=+$/, '')) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) continue;
    bits = (bits << 6) | digit;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      output.push((bits >> bitCount) & 255);
    }
  }
  return new Uint8Array(output);
});

defineValue(Uint8Array.prototype, 'toBase64', function toBase64() {
  if (typeof root.btoa === 'function') return root.btoa(bytesToBinary(this));
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let index = 0; index < this.length; index += 3) {
    const a = this[index];
    const b = index + 1 < this.length ? this[index + 1] : 0;
    const c = index + 2 < this.length ? this[index + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    result += alphabet[(triple >> 18) & 63];
    result += alphabet[(triple >> 12) & 63];
    result += index + 1 < this.length ? alphabet[(triple >> 6) & 63] : '=';
    result += index + 2 < this.length ? alphabet[triple & 63] : '=';
  }
  return result;
});

if (typeof Response !== 'undefined') {
  defineValue(Response.prototype, 'bytes', async function responseBytes() {
    return new Uint8Array(await this.arrayBuffer());
  });
}

if (typeof root.WeakRef === 'undefined') {
  root.WeakRef = class WeakRefFallback {
    constructor(value) { this.value = value; }
    deref() { return this.value; }
  };
}
if (typeof root.FinalizationRegistry === 'undefined') {
  root.FinalizationRegistry = class FinalizationRegistryFallback {
    register() {}
    unregister() { return false; }
  };
}

if (typeof root.structuredClone !== 'function') {
  root.structuredClone = function structuredCloneFallback(input) {
    const seen = new Map();
    const clone = (value) => {
      if (value === null || typeof value !== 'object') return value;
      if (seen.has(value)) return seen.get(value);
      if (value instanceof ArrayBuffer) return value.slice(0);
      if (typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer) return value;
      if (ArrayBuffer.isView(value)) {
        if (value instanceof DataView) {
          const buffer = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
          return new DataView(buffer);
        }
        return new value.constructor(value);
      }
      if (value instanceof Date) return new Date(value.getTime());
      if (value instanceof RegExp) return new RegExp(value.source, value.flags);
      if (typeof Blob !== 'undefined' && value instanceof Blob) return value.slice(0, value.size, value.type);
      if (value instanceof Map) {
        const result = new Map();
        seen.set(value, result);
        for (const [key, item] of value) result.set(clone(key), clone(item));
        return result;
      }
      if (value instanceof Set) {
        const result = new Set();
        seen.set(value, result);
        for (const item of value) result.add(clone(item));
        return result;
      }
      const result = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
      seen.set(value, result);
      for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor) continue;
        if ('value' in descriptor) descriptor.value = clone(descriptor.value);
        try { Object.defineProperty(result, key, descriptor); }
        catch (_) { result[key] = clone(value[key]); }
      }
      return result;
    };
    return clone(input);
  };
}

export const PDFJS_COMPAT_READY = true;
