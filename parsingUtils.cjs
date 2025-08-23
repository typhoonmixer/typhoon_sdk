"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPFromCurveId = exports.tryGuessingCurveIdFromJson = exports.checkGroth16VerifyingKey = exports.checkGroth16Proof = exports.createGroth16ProofFromRisc0 = exports.createGroth16ProofFromSp1 = exports.parseGroth16ProofFromObject = exports.parseGroth16VerifyingKeyFromObject = exports.KeyPatternNotFoundError = void 0;
var definitions_1 = require("./definitions.cjs");
var io_1 = require("./io.cjs");
var crypto_1 = require("crypto");
//https://github.com/risc0/risc0-ethereum/blob/main/contracts/src/groth16/ControlID.sol
var RISC0_CONTROL_ROOT = BigInt("0x8CDAD9242664BE3112ABA377C5425A4DF735EB1C6966472B561D2855932C0469");
var RISC0_BN254_CONTROL_ID = BigInt("0x04446E66D300EB7FB45C9726BB53C793DDA407A62E9601618BB43C5C14657AC0");
var SYSTEM_STATE_ZERO_DIGEST = Uint8Array.from(Buffer.from("A3ACC27117418996340B84E5A90F3EF4C49D22C79E44AAD822EC9C313E1EB8E2", "hex"));
var KeyPatternNotFoundError = /** @class */ (function (_super) {
    __extends(KeyPatternNotFoundError, _super);
    function KeyPatternNotFoundError(message) {
        var _this = _super.call(this, message) || this;
        _this.name = "KeyPatternNotFoundError";
        return _this;
    }
    return KeyPatternNotFoundError;
}(Error));
exports.KeyPatternNotFoundError = KeyPatternNotFoundError;
var parseGroth16VerifyingKeyFromObject = function (data) {
    try {
        var curveId_1 = (0, exports.tryGuessingCurveIdFromJson)(data);
        var verifyingKey = void 0;
        try {
            verifyingKey = findItemFromKeyPatterns(data, ["verifying_key"]);
        }
        catch (err) {
            verifyingKey = data;
        }
        try {
            var alpha = tryParseG1PointFromKey(verifyingKey, ['alpha'], curveId_1);
            var beta = tryParseG2PointFromKey(verifyingKey, ['beta'], curveId_1);
            var gamma = tryParseG2PointFromKey(verifyingKey, ['gamma'], curveId_1);
            var delta = tryParseG2PointFromKey(verifyingKey, ['delta'], curveId_1);
            if (curveId_1 !== null && curveId_1 !== undefined) {
                var ic = findItemFromKeyPatterns(verifyingKey, ['ic']).map(function (point) {
                    var g1Point = tryParseG1Point(point, curveId_1);
                    return g1Point;
                });
                var vk = {
                    alpha: alpha,
                    beta: beta,
                    gamma: gamma,
                    delta: delta,
                    ic: ic
                };
                if ((0, exports.checkGroth16VerifyingKey)(vk)) {
                    return vk;
                }
                throw new Error("Invalid Groth16 verifying key: ".concat(vk));
            }
            throw new Error("Curve ID not provided");
        }
        catch (err) {
            // Gnark case
            var g1Points = findItemFromKeyPatterns(verifyingKey, ['g1']);
            var g2Points = findItemFromKeyPatterns(verifyingKey, ['g2']);
            var alpha = tryParseG1PointFromKey(g1Points, ['alpha'], curveId_1);
            var beta = tryParseG2PointFromKey(g2Points, ['beta'], curveId_1);
            var gamma = tryParseG2PointFromKey(g2Points, ['gamma'], curveId_1);
            var delta = tryParseG2PointFromKey(g2Points, ['delta'], curveId_1);
            if (curveId_1 !== null && curveId_1 !== undefined) {
                var ic = findItemFromKeyPatterns(g1Points, ['K']).map(function (point) { return tryParseG1Point(point, curveId_1); });
                var vk = {
                    alpha: alpha,
                    beta: beta,
                    gamma: gamma,
                    delta: delta,
                    ic: ic
                };
                if ((0, exports.checkGroth16VerifyingKey)(vk)) {
                    return vk;
                }
            }
            throw new Error("Curve ID not provided");
        }
    }
    catch (err) {
        throw new Error("Failed to parse Groth16 verifying key from object: ".concat(err));
    }
};
exports.parseGroth16VerifyingKeyFromObject = parseGroth16VerifyingKeyFromObject;
var parseGroth16ProofFromObject = function (data, publicInputsData) {
    try {
        var curveId = (0, exports.tryGuessingCurveIdFromJson)(data);
        var proof = null;
        try {
            proof = findItemFromKeyPatterns(data, ['proof']);
        }
        catch (err) {
            proof = data;
        }
        // Try RISC0 parsing first
        try {
            var sealHex = (0, io_1.toHexStr)(findItemFromKeyPatterns(data, ['seal']));
            var imageIdHex = (0, io_1.toHexStr)(findItemFromKeyPatterns(data, ['image_id']));
            var journalHex = (0, io_1.toHexStr)(findItemFromKeyPatterns(data, ['journal']));
            var sealBytes = (0, io_1.hexStringToBytes)(sealHex);
            var imageIdBytes = (0, io_1.hexStringToBytes)(imageIdHex);
            var journalBytes = (0, io_1.hexStringToBytes)(journalHex);
            return (0, exports.createGroth16ProofFromRisc0)(sealBytes, imageIdBytes, journalBytes);
        }
        catch (err) {
            // Continue to SP1 parsing
        }
        // Try SP1 parsing second
        try {
            var sp1VkeyHex = findItemFromKeyPatterns(data, ['vkey']);
            var sp1PublicValuesHex = findItemFromKeyPatterns(data, ['publicValues']);
            var sp1ProofHex = findItemFromKeyPatterns(data, ['proof']);
            var vkeyBytes = void 0;
            var publicValuesBytes = void 0;
            var proofBytes = void 0;
            // Handle hex strings directly to preserve leading zeros
            if (typeof sp1VkeyHex === 'string') {
                vkeyBytes = (0, io_1.hexStringToBytes)(sp1VkeyHex);
            }
            else {
                vkeyBytes = (0, io_1.hexStringToBytes)((0, io_1.toHexStr)(sp1VkeyHex));
            }
            if (typeof sp1PublicValuesHex === 'string') {
                publicValuesBytes = (0, io_1.hexStringToBytes)(sp1PublicValuesHex);
            }
            else {
                publicValuesBytes = (0, io_1.hexStringToBytes)((0, io_1.toHexStr)(sp1PublicValuesHex));
            }
            if (typeof sp1ProofHex === 'string') {
                proofBytes = (0, io_1.hexStringToBytes)(sp1ProofHex);
            }
            else {
                proofBytes = (0, io_1.hexStringToBytes)((0, io_1.toHexStr)(sp1ProofHex));
            }
            return (0, exports.createGroth16ProofFromSp1)(vkeyBytes, publicValuesBytes, proofBytes);
        }
        catch (err) {
            // Continue to regular proof parsing
        }
        var publicInputs = [];
        if (publicInputsData && publicInputsData !== null && publicInputsData !== undefined) {
            if (typeof publicInputsData === 'object' && !Array.isArray(publicInputsData)) {
                // If it's an object, convert it to a list (array) of its values
                publicInputs = Object.values(publicInputsData).map(function (value) { return (0, io_1.toBigInt)(value); });
            }
            else if (Array.isArray(publicInputsData)) {
                publicInputs = publicInputsData.map(function (value) { return (0, io_1.toBigInt)(value); });
            }
            else {
                throw new Error("Invalid public inputs format: ".concat(publicInputsData));
            }
        }
        else {
            try {
                publicInputs = findItemFromKeyPatterns(data, ['public']);
            }
            catch (err) {
            }
        }
        var a = tryParseG1PointFromKey(proof, ['a'], curveId);
        var b = tryParseG2PointFromKey(proof, ['b'], curveId);
        var c = tryParseG1PointFromKey(proof, ['c', 'Krs'], curveId);
        var returnProof = {
            a: a,
            b: b,
            c: c,
            publicInputs: publicInputs
        };
        if ((0, exports.checkGroth16Proof)(returnProof)) {
            return returnProof;
        }
        throw new Error("Invalid Groth16 proof: ".concat(returnProof));
    }
    catch (err) {
        throw new Error("Failed to parse Groth16 proof from object: ".concat(err));
    }
};
exports.parseGroth16ProofFromObject = parseGroth16ProofFromObject;
var createGroth16ProofFromSp1 = function (vkey, publicValues, proof) {
    // SP1 version checking - first 4 bytes should match expected hash
    var SP1_VERIFIER_HASH = (0, io_1.hexStringToBytes)("11b6a09d63d255ad425ee3a7f6211d5ec63fbde9805b40551c3136275b6f4eb4");
    var selector = proof.slice(0, 4);
    var expectedSelector = SP1_VERIFIER_HASH.slice(0, 4);
    if (!selector.every(function (byte, index) { return byte === expectedSelector[index]; })) {
        throw new Error("Invalid SP1 proof version. Expected ".concat(Array.from(expectedSelector).map(function (b) { return b.toString(16).padStart(2, '0'); }).join(''), " for version v4.0.0-rc.3, got ").concat(Array.from(selector).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('')));
    }
    if (publicValues.length % 32 !== 0) {
        throw new Error("SP1 public values must be a multiple of 32 bytes");
    }
    // Hash public values and take mod 2^253
    var pubInputHash = (0, crypto_1.createHash)("sha256").update(publicValues).digest();
    var power253 = (BigInt(1) << BigInt(253)); // 2^253 using bit shift
    var pubInputHashBigInt = (0, io_1.toBigInt)(pubInputHash) % power253;
    var actualProof = proof.slice(4);
    var groth16Proof = {
        a: {
            x: (0, io_1.toBigInt)(actualProof.slice(0, 32)),
            y: (0, io_1.toBigInt)(actualProof.slice(32, 64)),
            curveId: definitions_1.CurveId.BN254
        },
        b: {
            x: [
                (0, io_1.toBigInt)(actualProof.slice(96, 128)),
                (0, io_1.toBigInt)(actualProof.slice(64, 96))
            ],
            y: [
                (0, io_1.toBigInt)(actualProof.slice(160, 192)),
                (0, io_1.toBigInt)(actualProof.slice(128, 160))
            ],
            curveId: definitions_1.CurveId.BN254
        },
        c: {
            x: (0, io_1.toBigInt)(actualProof.slice(192, 224)),
            y: (0, io_1.toBigInt)(actualProof.slice(224, 256)),
            curveId: definitions_1.CurveId.BN254
        },
        publicInputs: [
            (0, io_1.toBigInt)(vkey),
            pubInputHashBigInt
        ],
        vkeyPublicValuesSp1: {
            vkey: vkey,
            publicValues: publicValues
        }
    };
    if ((0, exports.checkGroth16Proof)(groth16Proof)) {
        return groth16Proof;
    }
    throw new Error("Invalid SP1 Groth16 proof: ".concat(groth16Proof));
};
exports.createGroth16ProofFromSp1 = createGroth16ProofFromSp1;
var createGroth16ProofFromRisc0 = function (seal, imageId, journalBytes, controlRoot, bn254ControlId) {
    if (controlRoot === void 0) { controlRoot = RISC0_CONTROL_ROOT; }
    if (bn254ControlId === void 0) { bn254ControlId = RISC0_BN254_CONTROL_ID; }
    if (imageId.length > 32) {
        throw new Error("imageId must be 32 bytes");
    }
    var _a = __read(splitDigest(controlRoot), 2), controlRoot0 = _a[0], controlRoot1 = _a[1];
    var proof = seal.slice(4);
    var journal = (0, crypto_1.createHash)("sha256").update(journalBytes).digest();
    var claimDigest = digestReceiptClaim(ok(imageId, journal));
    var _b = __read(splitDigest(claimDigest), 2), claim0 = _b[0], claim1 = _b[1];
    var groth16Proof = {
        a: {
            x: (0, io_1.toBigInt)(proof.slice(0, 32)),
            y: (0, io_1.toBigInt)(proof.slice(32, 64)),
            curveId: definitions_1.CurveId.BN254
        },
        b: {
            x: [
                (0, io_1.toBigInt)(proof.slice(96, 128)),
                (0, io_1.toBigInt)(proof.slice(64, 96))
            ],
            y: [
                (0, io_1.toBigInt)(proof.slice(160, 192)),
                (0, io_1.toBigInt)(proof.slice(128, 160))
            ],
            curveId: definitions_1.CurveId.BN254
        },
        c: {
            x: (0, io_1.toBigInt)(proof.slice(192, 224)),
            y: (0, io_1.toBigInt)(proof.slice(224, 256)),
            curveId: definitions_1.CurveId.BN254
        },
        publicInputs: [
            controlRoot0,
            controlRoot1,
            claim0,
            claim1,
            bn254ControlId
        ],
        imageId: imageId,
        journal: journal
    };
    if ((0, exports.checkGroth16Proof)(groth16Proof)) {
        return groth16Proof;
    }
    throw new Error("Invalid Groth16 proof: ".concat(groth16Proof));
};
exports.createGroth16ProofFromRisc0 = createGroth16ProofFromRisc0;
var checkGroth16Proof = function (proof) {
    return proof.a.curveId === proof.b.curveId && proof.b.curveId === proof.c.curveId;
};
exports.checkGroth16Proof = checkGroth16Proof;
var checkGroth16VerifyingKey = function (vk) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (vk.ic.length <= 1) {
        return false;
    }
    //check if ic points are different
    for (var i = 0; i < vk.ic.length; i++) {
        for (var j = i + 1; j < vk.ic.length; j++) {
            if (((_a = vk.ic[i]) === null || _a === void 0 ? void 0 : _a.x) === ((_b = vk.ic[j]) === null || _b === void 0 ? void 0 : _b.x) && ((_c = vk.ic[i]) === null || _c === void 0 ? void 0 : _c.y) === ((_d = vk.ic[j]) === null || _d === void 0 ? void 0 : _d.y) && ((_e = vk.ic[i]) === null || _e === void 0 ? void 0 : _e.curveId) === ((_f = vk.ic[j]) === null || _f === void 0 ? void 0 : _f.curveId)) {
                return false;
            }
        }
        if (((_g = vk.ic[i]) === null || _g === void 0 ? void 0 : _g.curveId) !== vk.alpha.curveId) {
            return false;
        }
    }
    return vk.alpha.curveId === vk.beta.curveId && vk.beta.curveId === vk.gamma.curveId && vk.gamma.curveId === vk.delta.curveId;
};
exports.checkGroth16VerifyingKey = checkGroth16VerifyingKey;
var digestReceiptClaim = function (receipt) {
    var tagDigest = receipt.tagDigest, input = receipt.input, preStateDigest = receipt.preStateDigest, postStateDigest = receipt.postStateDigest, output = receipt.output, exitCode = receipt.exitCode;
    var systemExitCodeBuffer = Buffer.alloc(4);
    systemExitCodeBuffer.writeUInt32BE(exitCode.system << 24);
    var userExitCodeBuffer = Buffer.alloc(4);
    userExitCodeBuffer.writeUInt32BE(exitCode.user << 24);
    // Create a 2-byte big-endian representation of 4 << 8
    var twoBytes = Buffer.alloc(2);
    twoBytes.writeUInt16BE(4 << 8);
    // Concatenating all parts into one Buffer
    var data = Buffer.concat([
        tagDigest,
        input,
        preStateDigest,
        postStateDigest,
        output,
        systemExitCodeBuffer,
        userExitCodeBuffer,
        twoBytes
    ]);
    return (0, crypto_1.createHash)('sha256').update(data).digest();
};
function ok(imageId, journalDigest) {
    // Create ExitCode object with system = 0 and user = 0 (equivalent to (Halted, 0) in Python)
    var exitCode = {
        system: 0,
        user: 0
    };
    // Create Output object
    var output = {
        journalDigest: journalDigest,
        assumptionsDigest: new Uint8Array(32) // bytes32(0) equivalent
    };
    // Create and return the ReceiptClaim object
    return {
        tagDigest: (0, crypto_1.createHash)('sha256').update(Buffer.from("risc0.ReceiptClaim")).digest(),
        preStateDigest: imageId,
        postStateDigest: SYSTEM_STATE_ZERO_DIGEST,
        exitCode: exitCode,
        input: new Uint8Array(32), // bytes32(0) equivalent
        output: digestOutput(output),
    };
}
var digestOutput = function (output) {
    var journalDigest = output.journalDigest, assumptionsDigest = output.assumptionsDigest;
    // Compute the internal tag digest equivalent to hashlib.sha256(b"risc0.Output").digest()
    var tagDigest = (0, crypto_1.createHash)('sha256').update(Buffer.from("risc0.Output")).digest();
    var twoBytes = Buffer.alloc(2);
    twoBytes.writeUInt16BE(512);
    var combined = Buffer.concat([
        tagDigest,
        Buffer.from(journalDigest),
        Buffer.from(assumptionsDigest),
        twoBytes // Append 2 as a 2-byte big-endian integer
    ]);
    // Return the sha256 digest of the combined data
    return (0, crypto_1.createHash)('sha256').update(combined).digest();
};
var reverseByteOrderUint256 = function (value) {
    var valueBytes;
    if (typeof value === 'bigint') {
        // Convert bigint to 32-byte array (big-endian)
        var hexString = value.toString(16).padStart(64, '0');
        valueBytes = Uint8Array.from(Buffer.from(hexString, 'hex'));
    }
    else {
        // Ensure it's 32 bytes, pad with zeros if needed
        valueBytes = new Uint8Array(32);
        valueBytes.set(value.slice(0, 32), 0);
    }
    // Reverse the byte order
    var reversedBytes = valueBytes.slice().reverse();
    // Convert the reversed bytes back to bigint
    return BigInt('0x' + Buffer.from(reversedBytes).toString('hex'));
};
var splitDigest = function (digest) {
    var reversedDigest = reverseByteOrderUint256(digest);
    return (0, io_1.split128)(reversedDigest);
};
var tryGuessingCurveIdFromJson = function (data) {
    try {
        var curveId = (0, definitions_1.findValueInStringToCurveId)(findItemFromKeyPatterns(data, ['curve']));
        return curveId;
    }
    catch (err) {
        var x = null;
        for (var value in iterateNestedDictToArray(data)) {
            try {
                x = (0, io_1.toBigInt)(value);
                break;
            }
            catch (err) {
                continue;
            }
        }
        if (x == null || x == undefined) {
            throw new Error("No integer found in the JSON data.");
        }
        if ((0, io_1.bitLength)(x) > 256) {
            return definitions_1.CurveId.BLS12_381;
        }
        else {
            return definitions_1.CurveId.BN254;
        }
    }
};
exports.tryGuessingCurveIdFromJson = tryGuessingCurveIdFromJson;
var iterateNestedDictToArray = function (d) {
    var result = [];
    for (var key in d) {
        if (Object.prototype.hasOwnProperty.call(d, key)) {
            var value = d[key];
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                // Recursively collect values from nested objects
                result.push.apply(result, __spreadArray([], __read(iterateNestedDictToArray(value)), false));
            }
            else {
                // Add the value to the result array
                result.push(value);
            }
        }
    }
    return result;
};
var findItemFromKeyPatterns = function (data, keyPatterns) {
    var bestMatch = null;
    var bestScore = -1;
    var bestMatchFound = false;
    Object.keys(data).forEach(function (key) {
        keyPatterns.forEach(function (pattern) {
            if (key.toLowerCase() == pattern.toLowerCase()) {
                bestMatch = data[key];
                bestMatchFound = true;
            }
            else if (!bestMatchFound && key.trim().toLowerCase().includes(pattern.trim().toLowerCase())) {
                //count number of matching character
                var re = new RegExp(pattern.toLowerCase(), 'g');
                var occurences = key.toLowerCase().match(re);
                var score = occurences ? occurences.length : 0;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = data[key];
                }
            }
        });
    });
    if (bestMatch) {
        return bestMatch;
    }
    throw new KeyPatternNotFoundError("No key found with patterns ".concat(keyPatterns));
};
var getPFromCurveId = function (curveId) {
    return definitions_1.CURVES[curveId].p;
};
exports.getPFromCurveId = getPFromCurveId;
var projToAffine = function (x, y, z, curveId) {
    var xBigInt = (0, io_1.toBigInt)(x);
    var yBigInt = (0, io_1.toBigInt)(y);
    var zBigInt = (0, io_1.toBigInt)(z);
    var p = (0, exports.getPFromCurveId)(curveId);
    zBigInt = (0, io_1.modInverse)(zBigInt, p);
    xBigInt = xBigInt * zBigInt % p;
    yBigInt = yBigInt * zBigInt % p;
    return {
        x: xBigInt,
        y: yBigInt,
        curveId: curveId
    };
};
var tryParseG1PointFromKey = function (data, keyPatterns, curveId) {
    var point = findItemFromKeyPatterns(data, keyPatterns);
    if (curveId === null || curveId === undefined) {
        throw new Error("Curve ID not provided");
    }
    return tryParseG1Point(point, curveId);
};
var tryParseG1Point = function (point, curveId) {
    if (typeof point === "object" && !Array.isArray(point)) {
        var x = (0, io_1.toBigInt)(findItemFromKeyPatterns(point, ["x"]));
        var y = (0, io_1.toBigInt)(findItemFromKeyPatterns(point, ["y"]));
        return {
            x: x,
            y: y,
            curveId: curveId
        };
    }
    else if (Array.isArray(point)) {
        if (point.length == 2) {
            return {
                x: (0, io_1.toBigInt)(point[0]),
                y: (0, io_1.toBigInt)(point[1]),
                curveId: curveId
            };
        }
        else if (point.length == 3) {
            return projToAffine(point[0], point[1], point[2], curveId);
        }
        throw new Error("Invalid point: ".concat(point));
    }
    else {
        throw new Error("Invalid point: ".concat(point));
    }
};
var tryParseG2PointFromKey = function (data, keyPatterns, curveId) {
    var point = findItemFromKeyPatterns(data, keyPatterns);
    if (curveId === null || curveId === undefined) {
        throw new Error("Curve ID not provided");
    }
    return tryParseG2Point(point, curveId);
};
var tryParseG2Point = function (point, curveId) {
    if (typeof point === "object" && !Array.isArray(point)) {
        var xG2 = findItemFromKeyPatterns(point, ["x"]);
        var yG2 = findItemFromKeyPatterns(point, ["y"]);
        if (typeof xG2 === "object" && typeof yG2 === "object" && !Array.isArray(xG2) && !Array.isArray(yG2)) {
            return {
                x: [
                    (0, io_1.toBigInt)(findItemFromKeyPatterns(xG2, ["a0"])),
                    (0, io_1.toBigInt)(findItemFromKeyPatterns(xG2, ["a1"]))
                ],
                y: [
                    (0, io_1.toBigInt)(findItemFromKeyPatterns(yG2, ["a0"])),
                    (0, io_1.toBigInt)(findItemFromKeyPatterns(yG2, ["a1"]))
                ],
                curveId: curveId
            };
        }
        else if (Array.isArray(xG2) && Array.isArray(yG2)) {
            return {
                x: [(0, io_1.toBigInt)(xG2[0]), (0, io_1.toBigInt)(xG2[1])],
                y: [(0, io_1.toBigInt)(yG2[0]), (0, io_1.toBigInt)(yG2[1])],
                curveId: curveId
            };
        }
        else {
            throw new Error("Invalid point: ".concat(point));
        }
    }
    else if (Array.isArray(point)) {
        var supposedX = void 0, supposedY = void 0;
        if (point.length === 2) {
            supposedX = point[0];
            supposedY = point[1];
        }
        else if (point.length === 3) {
            var check = [
                (0, io_1.toBigInt)(point[2][0]),
                (0, io_1.toBigInt)(point[2][1])
            ];
            if (check[0] !== BigInt(1) || check[1] !== BigInt(0)) {
                throw new Error("Non standard projective coordinates");
            }
            supposedX = point[0];
            supposedY = point[1];
        }
        if (Array.isArray(supposedX)) {
            if (supposedX.length !== 2) {
                throw new Error("Invalid fp2 coordinates: ".concat(supposedX));
            }
            supposedX = [(0, io_1.toBigInt)(supposedX[0]), (0, io_1.toBigInt)(supposedX[1])];
        }
        if (Array.isArray(supposedY)) {
            if (supposedY.length !== 2) {
                throw new Error("Invalid fp2 coordinates: ".concat(supposedY));
            }
            supposedY = [(0, io_1.toBigInt)(supposedY[0]), (0, io_1.toBigInt)(supposedY[1])];
        }
        return {
            x: supposedX,
            y: supposedY,
            curveId: curveId
        };
    }
    else {
        throw new Error("Invalid point: ".concat(point));
    }
};
