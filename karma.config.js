const argv = require('yargs').argv;
const path = require('path');

const withCoverage = !argv.watch;
const TEST_BUNDLER = './spec/test-bundler.js';

const karmaConfig = {
  basePath: './',
  customLaunchers: {
    ChromeHeadless: {
      base: 'Chrome',
      flags: [
        '--headless',
        '--disable-gpu',
        // Without a remote debugging port, Google Chrome exits immediately.
        '--remote-debugging-port=9222',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-translate',
        '--disable-extensions',
      ],
      debug: true,
    },
  },
  browserNoActivityTimeout: 120000,
  singleRun: !argv.watch,
  coverageReporter: {
    dir: '.',
    reporters: [{ type: 'text-summary' }, { type: 'lcov', subdir: 'coverage' }],
  },
  files: [
    {
      pattern: TEST_BUNDLER,
      watched: false,
      served: true,
      included: true,
    },
    {
      pattern: './spec/resources/**/*',
      watched: false,
      included: false,
      served: true,
    },
    {
      pattern: './node_modules/@fortawesome/fontawesome-free/css/*.css',
      watched: false,
      included: false,
      served: true,
    },
  ],
  preprocessors: {
    [TEST_BUNDLER]: ['webpack', 'sourcemap'],
  },
  webpack: {
    mode: 'development',
    devtool: 'inline-source-map',
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: path.resolve(__dirname, 'node_modules'),
          use: [
            {
              loader: 'babel-loader',
              options: {
                presets: ['@babel/preset-env'],
                plugins: [
                  [
                    'istanbul',
                    {
                      exclude: ['**/*.spec.js', '**/test-bundler.js'],
                    },
                  ],
                ],
              },
            },
          ],
        },
      ],
    },
  },
  webpackServer: {
    noInfo: true,
  },
  frameworks: ['mocha'],
  reporters: withCoverage ? ['mocha', 'coverage'] : ['mocha'],
  mochaReporter: {
    showDiff: true,
  },
  specReporter: {
    maxLogLines: 5, // limit number of lines logged per test
    suppressErrorSummary: false, // do not print error summary
    suppressFailed: false, // do not print information about failed tests
    suppressPassed: false, // do not print information about passed tests
    suppressSkipped: false, // do not print information about skipped tests
    showSpecTiming: false, // print the time elapsed for each spec
    failFast: true, // test would finish with error when a first fail occurs.
  },
  logLevel: 'WARN',
  browserConsoleLogOptions: {
    terminal: true,
    format: '%b %T: %m',
    level: 'log',
  },
  plugins: ['karma-*'],
  client: {
    mocha: {
      timeout: '10000',
    },
  },
};

module.exports = (cfg) => cfg.set(karmaConfig);
