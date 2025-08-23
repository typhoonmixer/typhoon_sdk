import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import wasm from '@rollup/plugin-wasm';
import  terser  from '@rollup/plugin-terser';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import replace from "@rollup/plugin-replace";

export default {
    input: 'index.js', // your SDK entry
    output: [
        {
            file: 'dist/typhoon-sdk.cjs.js',
            format: 'cjs',   // Node.js
            exports: 'named',
        },
        {
            file: 'dist/typhoon-sdk.esm.js',
            format: 'esm',   // Modern bundlers / browsers
        },
        {
            file: 'dist/typhoon-sdk.umd.js',
            format: 'umd',   // Browser global
            name: 'TyphoonSDK',
            globals: {
                snarkjs: "snarkjs", // assumes window.snarkjs in browser
            },
            plugins: [terser()], // ✅ keep terser only here
        },
    ],
    external: [
        'path',
        'fs',
        'os',
        'builtin-modules',
        'resolve',
        'browser-resolve',
        'is-module',
        'rollup-pluginutils',
        'snarkjs'
    ],
    plugins: [
        resolve({
            browser: true,
            preferBuiltins: false,
        }),
        commonjs(),
        json(),
        wasm({
            maxFileSize: 10000000, // inline wasm up to 10MB
        }),
        nodePolyfills(),
        replace({
            preventAssignment: true,
            "process.browser": true, // define a flag for conditional code
        }),
    ],
    context: "this", // ✅ ensures UMD uses globalThis/global instead of undefined
};
