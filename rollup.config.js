import { terser } from 'rollup-plugin-terser';

export default [
  {
    input: 'src/index.js',
    plugins: [terser()],
    output: {
      file: 'umd/dom-to-image.js',
      format: 'umd',
      name: 'domToImage',
      esModule: false,
    },
  },
  {
    input: 'src/index.js',
    output: {
      file: 'esm/index.js',
      format: 'esm',
    },
  },
];
