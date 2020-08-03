import { terser } from 'rollup-plugin-terser';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';

export default [
  {
    input: 'src/index.js',
    plugins: [nodeResolve(), babel({ exclude: 'node_modules/**', babelHelpers: 'bundled' })],
    output: {
      file: 'umd/dom-to-image-next.js',
      format: 'umd',
      name: 'domToImage',
      esModule: false,
    },
  },
  {
    input: 'src/index.js',
    plugins: [
      nodeResolve(),
      babel({ exclude: 'node_modules/**', babelHelpers: 'bundled' }),
      terser(),
    ],
    output: {
      file: 'umd/dom-to-image-next.min.js',
      format: 'umd',
      name: 'domToImage',
      esModule: false,
    },
  },
  {
    input: 'src/index.js',
    external: [/@babel\/runtime/],
    plugins: [
      nodeResolve(),
      babel({
        babelHelpers: 'runtime',
        plugins: [
          [
            '@babel/plugin-transform-runtime',
            {
              useESModules: true,
            },
          ],
        ],
      }),
    ],
    output: {
      file: 'esm/index.js',
      format: 'esm',
    },
  },
];
