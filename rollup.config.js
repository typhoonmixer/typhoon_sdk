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
            inlineDynamicImports: true
        },
        {
            file: 'dist/typhoon-sdk.esm.js',
            format: 'esm',   // Modern bundlers / browsers
            inlineDynamicImports: true
        },
        {
            file: 'dist/typhoon-sdk.browser.esm.js',
            format: 'esm',   // Browser global
            name: 'TyphoonSDK',
            globals: {
                snarkjs: "snarkjs", // assumes window.snarkjs in browser
            },
            plugins: [terser(),  replace({
                preventAssignment: true,
                "process.browser": true, // define a flag for conditional code
                'typeof window': '"object"',
            }),], // ✅ keep terser only here
            inlineDynamicImports: true
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
        
    ],
    context: "this", // ✅ ensures UMD uses globalThis/global instead of undefined
};
