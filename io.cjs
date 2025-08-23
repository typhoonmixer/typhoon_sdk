"use strict";
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.modInverse = exports.split128 = exports.bitLength = exports.hexStringToBytes = exports.toHexStr = exports.toBigInt = void 0;
var toBigInt = function (value) {
    //Convert a string or integer to an integer. Supports hexadecimal and decimal strings.
    var e_1, _a;
    if (typeof value === 'string') {
        value = value.trim();
        try {
            return BigInt(value);
        }
        catch (e) {
            if (value.toLowerCase().startsWith('0x')) {
                throw new Error("Invalid hexadecimal value: ".concat(value));
            }
            else {
                throw new Error("Invalid decimal value: ".concat(value));
            }
        }
    }
    else if (typeof value === 'bigint') {
        return value;
    }
    else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
            return BigInt(value);
        }
        else {
            throw new TypeError("Expected integer number, got non-integer number: ".concat(value));
        }
    }
    else if (value instanceof Uint8Array) {
        var result = BigInt(0);
        try {
            for (var value_1 = __values(value), value_1_1 = value_1.next(); !value_1_1.done; value_1_1 = value_1.next()) {
                var byte = value_1_1.value;
                result = (result << BigInt(8)) + BigInt(byte);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (value_1_1 && !value_1_1.done && (_a = value_1.return)) _a.call(value_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return result;
    }
    else {
        throw new TypeError("Expected string, number, or Uint8Array, got ".concat(typeof value));
    }
};
exports.toBigInt = toBigInt;
var toHexStr = function (value) {
    if (typeof value === 'string') {
        value = value.trim();
        var intValue = BigInt(value);
        return ('0x' + intValue.toString(16)).toLowerCase();
    }
    else if (typeof value === 'number' || typeof value === 'bigint') {
        var intValue = BigInt(value);
        return ('0x' + intValue.toString(16)).toLowerCase();
    }
    else {
        throw new TypeError("Expected string, number integer, or bigint, got ".concat(typeof value));
    }
};
exports.toHexStr = toHexStr;
var hexStringToBytes = function (hexString) {
    if (hexString.toLowerCase().startsWith('0x')) {
        hexString = hexString.slice(2);
    }
    if (hexString.length % 2 !== 0) {
        hexString = '0' + hexString;
    }
    var bytes = new Uint8Array(hexString.length / 2);
    for (var i = 0; i < bytes.length; i++) {
        var byte = hexString.slice(i * 2, i * 2 + 2);
        bytes[i] = parseInt(byte, 16);
    }
    return bytes;
};
exports.hexStringToBytes = hexStringToBytes;
var bitLength = function (x) {
    if (x === BigInt(0) || x === BigInt(-0)) {
        return 0;
    }
    var bits = 0;
    var n = x < BigInt(0) ? -x : x; // Handle negative numbers
    while (n > BigInt(0)) {
        n >>= BigInt(1);
        bits++;
    }
    return bits;
};
exports.bitLength = bitLength;
var split128 = function (a) {
    try {
        console.log("a bigint", a);
        var MAX_UINT256 = BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639936");
        var MASK_128 = BigInt((BigInt(1) << BigInt(128)) - BigInt(1));
        if (a < BigInt(0) || a >= MAX_UINT256) {
            throw new Error("Value ".concat(a, " is too large to fit in a u256"));
        }
        var low = a & MASK_128;
        var high = a >> BigInt(128);
        return [low, high];
    }
    catch (err) {
        console.log("ERR split 128: ", err);
        throw new Error("ERROR split 128");
    }
};
exports.split128 = split128;
var modInverse = function (a, p) {
    var m0 = p;
    var y = BigInt(0), x = BigInt(1);
    if (p === BigInt(1)) {
        return BigInt(0);
    }
    while (a > BigInt(1)) {
        // q is quotient
        var q = a / p;
        var t = p;
        // p is remainder now, process same as Euclid's algorithm
        p = a % p;
        a = t;
        t = y;
        // Update x and y
        y = x - q * y;
        x = t;
    }
    // Make x positive
    if (x < BigInt(0)) {
        x = x + m0;
    }
    return x;
};
exports.modInverse = modInverse;
