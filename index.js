(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.discord = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (__dirname){(function (){
const MODULE = '[SillyTavern-DiscordRichPresence-Server]';
const states = [
    'Constructing a waifu army',
    'Spreading the silliness',
    'Mass producing catgirls',
    'Roleplaying with a toaster',
    'Caffeinated and chaotic',
    'Existential AI therapy',
    'Seraphina my beloved',
    // Add more states here
];

let client;

async function exit() {
    if (client) {
        try {
            const chalk = require('chalk');
            console.log(chalk.green(MODULE), 'Shutting down Discord connection');
            await Promise.race([
                client.destroy(),
                new Promise(resolve => setTimeout(resolve, 1000)),
            ]);
        } catch {
            // Ignore
        }
    }
}

/**
 * Initializes the plugin
 * @param {import('express').Router} router Express router
 */
async function init(router) {
    const rpc = require('discord-rpc');
    const fs = require('fs');
    const path = require('path');
    const chalk = require('chalk');
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
    let connected = false;
    console.log(chalk.green(MODULE), 'Plugin loaded!');
    await connectToDiscord();

    router && router.post('/update', (req, res) => {
        const name = req.query.name;
        if (name) {
            console.log(chalk.green(MODULE), 'Updating Discord Rich Presence to', chalk.blue(name));
            const state = `Chatting with ${name}`;
            setActivity(state);
            res.status(200).send('OK');
        } else {
            console.log(chalk.green(MODULE), 'Resetting Discord Rich Presence');
            setActivity();
            res.status(204).send();
        }
    });

    async function connectToDiscord() {
        client = new rpc.Client({ transport: 'ipc' });

        client.once('ready', () => {
            console.log(chalk.green(MODULE), 'Discord Rich Presence is ready!');
            setActivity();
        });

        client.on('connected', () => {
            connected = true;
        });

        client.on('disconnected', () => {
            console.log(chalk.yellow(MODULE), 'Client disconnected!');
            connected = false;
        });

        await client.login({ clientId: config.ClientID }).catch(console.error);
    }

    async function setActivity(state) {
        try {
            // Try to connect if not connected.
            if (!connected) {
                await connectToDiscord();
            }

            // Still nothing? Avast!
            if (!connected) {
                console.error(chalk.yellow(MODULE), 'Not connected to a client');
                return;
            }

            state = state || states[Math.floor(Math.random() * states.length)];
            await client.setActivity({
                details: config.Details,
                state: state,
                buttons: [
                    {
                        label: config.Button1,
                        url: config.Url1,
                    },
                    {
                        label: config.Button2,
                        url: config.Url2,
                    },
                ],
                largeImageKey: config.LargeImage,
                largeImageText: config.LargeImageText,
            }, process.pid);
        } catch {
            console.error(chalk.yellow(MODULE), 'Failed to set activity');
        }
    }
}

module.exports = {
    init,
    exit,
    info: {
        id: 'discord',
        name: 'Discord Rich Presence',
        description: 'Set your rich presence in Discord to the "SillyTavern" app.',
    },
};

}).call(this)}).call(this,require("path").join(__dirname,"."))
},{"chalk":6,"discord-rpc":15,"fs":undefined,"path":undefined}],2:[function(require,module,exports){
'use strict';

const wrapAnsi16 = (fn, offset) => (...args) => {
	const code = fn(...args);
	return `\u001B[${code + offset}m`;
};

const wrapAnsi256 = (fn, offset) => (...args) => {
	const code = fn(...args);
	return `\u001B[${38 + offset};5;${code}m`;
};

const wrapAnsi16m = (fn, offset) => (...args) => {
	const rgb = fn(...args);
	return `\u001B[${38 + offset};2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
};

const ansi2ansi = n => n;
const rgb2rgb = (r, g, b) => [r, g, b];

const setLazyProperty = (object, property, get) => {
	Object.defineProperty(object, property, {
		get: () => {
			const value = get();

			Object.defineProperty(object, property, {
				value,
				enumerable: true,
				configurable: true
			});

			return value;
		},
		enumerable: true,
		configurable: true
	});
};

/** @type {typeof import('color-convert')} */
let colorConvert;
const makeDynamicStyles = (wrap, targetSpace, identity, isBackground) => {
	if (colorConvert === undefined) {
		colorConvert = require('color-convert');
	}

	const offset = isBackground ? 10 : 0;
	const styles = {};

	for (const [sourceSpace, suite] of Object.entries(colorConvert)) {
		const name = sourceSpace === 'ansi16' ? 'ansi' : sourceSpace;
		if (sourceSpace === targetSpace) {
			styles[name] = wrap(identity, offset);
		} else if (typeof suite === 'object') {
			styles[name] = wrap(suite[targetSpace], offset);
		}
	}

	return styles;
};

function assembleStyles() {
	const codes = new Map();
	const styles = {
		modifier: {
			reset: [0, 0],
			// 21 isn't widely supported and 22 does the same thing
			bold: [1, 22],
			dim: [2, 22],
			italic: [3, 23],
			underline: [4, 24],
			inverse: [7, 27],
			hidden: [8, 28],
			strikethrough: [9, 29]
		},
		color: {
			black: [30, 39],
			red: [31, 39],
			green: [32, 39],
			yellow: [33, 39],
			blue: [34, 39],
			magenta: [35, 39],
			cyan: [36, 39],
			white: [37, 39],

			// Bright color
			blackBright: [90, 39],
			redBright: [91, 39],
			greenBright: [92, 39],
			yellowBright: [93, 39],
			blueBright: [94, 39],
			magentaBright: [95, 39],
			cyanBright: [96, 39],
			whiteBright: [97, 39]
		},
		bgColor: {
			bgBlack: [40, 49],
			bgRed: [41, 49],
			bgGreen: [42, 49],
			bgYellow: [43, 49],
			bgBlue: [44, 49],
			bgMagenta: [45, 49],
			bgCyan: [46, 49],
			bgWhite: [47, 49],

			// Bright color
			bgBlackBright: [100, 49],
			bgRedBright: [101, 49],
			bgGreenBright: [102, 49],
			bgYellowBright: [103, 49],
			bgBlueBright: [104, 49],
			bgMagentaBright: [105, 49],
			bgCyanBright: [106, 49],
			bgWhiteBright: [107, 49]
		}
	};

	// Alias bright black as gray (and grey)
	styles.color.gray = styles.color.blackBright;
	styles.bgColor.bgGray = styles.bgColor.bgBlackBright;
	styles.color.grey = styles.color.blackBright;
	styles.bgColor.bgGrey = styles.bgColor.bgBlackBright;

	for (const [groupName, group] of Object.entries(styles)) {
		for (const [styleName, style] of Object.entries(group)) {
			styles[styleName] = {
				open: `\u001B[${style[0]}m`,
				close: `\u001B[${style[1]}m`
			};

			group[styleName] = styles[styleName];

			codes.set(style[0], style[1]);
		}

		Object.defineProperty(styles, groupName, {
			value: group,
			enumerable: false
		});
	}

	Object.defineProperty(styles, 'codes', {
		value: codes,
		enumerable: false
	});

	styles.color.close = '\u001B[39m';
	styles.bgColor.close = '\u001B[49m';

	setLazyProperty(styles.color, 'ansi', () => makeDynamicStyles(wrapAnsi16, 'ansi16', ansi2ansi, false));
	setLazyProperty(styles.color, 'ansi256', () => makeDynamicStyles(wrapAnsi256, 'ansi256', ansi2ansi, false));
	setLazyProperty(styles.color, 'ansi16m', () => makeDynamicStyles(wrapAnsi16m, 'rgb', rgb2rgb, false));
	setLazyProperty(styles.bgColor, 'ansi', () => makeDynamicStyles(wrapAnsi16, 'ansi16', ansi2ansi, true));
	setLazyProperty(styles.bgColor, 'ansi256', () => makeDynamicStyles(wrapAnsi256, 'ansi256', ansi2ansi, true));
	setLazyProperty(styles.bgColor, 'ansi16m', () => makeDynamicStyles(wrapAnsi16m, 'rgb', rgb2rgb, true));

	return styles;
}

// Make the export immutable
Object.defineProperty(module, 'exports', {
	enumerable: true,
	get: assembleStyles
});

},{"color-convert":10}],3:[function(require,module,exports){
(function (__filename){(function (){
/**
 * Module dependencies.
 */

var fs = require('fs'),
  path = require('path'),
  fileURLToPath = require('file-uri-to-path'),
  join = path.join,
  dirname = path.dirname,
  exists =
    (fs.accessSync &&
      function(path) {
        try {
          fs.accessSync(path);
        } catch (e) {
          return false;
        }
        return true;
      }) ||
    fs.existsSync ||
    path.existsSync,
  defaults = {
    arrow: process.env.NODE_BINDINGS_ARROW || ' → ',
    compiled: process.env.NODE_BINDINGS_COMPILED_DIR || 'compiled',
    platform: process.platform,
    arch: process.arch,
    nodePreGyp:
      'node-v' +
      process.versions.modules +
      '-' +
      process.platform +
      '-' +
      process.arch,
    version: process.versions.node,
    bindings: 'bindings.node',
    try: [
      // node-gyp's linked version in the "build" dir
      ['module_root', 'build', 'bindings'],
      // node-waf and gyp_addon (a.k.a node-gyp)
      ['module_root', 'build', 'Debug', 'bindings'],
      ['module_root', 'build', 'Release', 'bindings'],
      // Debug files, for development (legacy behavior, remove for node v0.9)
      ['module_root', 'out', 'Debug', 'bindings'],
      ['module_root', 'Debug', 'bindings'],
      // Release files, but manually compiled (legacy behavior, remove for node v0.9)
      ['module_root', 'out', 'Release', 'bindings'],
      ['module_root', 'Release', 'bindings'],
      // Legacy from node-waf, node <= 0.4.x
      ['module_root', 'build', 'default', 'bindings'],
      // Production "Release" buildtype binary (meh...)
      ['module_root', 'compiled', 'version', 'platform', 'arch', 'bindings'],
      // node-qbs builds
      ['module_root', 'addon-build', 'release', 'install-root', 'bindings'],
      ['module_root', 'addon-build', 'debug', 'install-root', 'bindings'],
      ['module_root', 'addon-build', 'default', 'install-root', 'bindings'],
      // node-pre-gyp path ./lib/binding/{node_abi}-{platform}-{arch}
      ['module_root', 'lib', 'binding', 'nodePreGyp', 'bindings']
    ]
  };

/**
 * The main `bindings()` function loads the compiled bindings for a given module.
 * It uses V8's Error API to determine the parent filename that this function is
 * being invoked from, which is then used to find the root directory.
 */

function bindings(opts) {
  // Argument surgery
  if (typeof opts == 'string') {
    opts = { bindings: opts };
  } else if (!opts) {
    opts = {};
  }

  // maps `defaults` onto `opts` object
  Object.keys(defaults).map(function(i) {
    if (!(i in opts)) opts[i] = defaults[i];
  });

  // Get the module root
  if (!opts.module_root) {
    opts.module_root = exports.getRoot(exports.getFileName());
  }

  // Ensure the given bindings name ends with .node
  if (path.extname(opts.bindings) != '.node') {
    opts.bindings += '.node';
  }

  // https://github.com/webpack/webpack/issues/4175#issuecomment-342931035
  var requireFunc =
    typeof __webpack_require__ === 'function'
      ? __non_webpack_require__
      : require;

  var tries = [],
    i = 0,
    l = opts.try.length,
    n,
    b,
    err;

  for (; i < l; i++) {
    n = join.apply(
      null,
      opts.try[i].map(function(p) {
        return opts[p] || p;
      })
    );
    tries.push(n);
    try {
      b = opts.path ? requireFunc.resolve(n) : requireFunc(n);
      if (!opts.path) {
        b.path = n;
      }
      return b;
    } catch (e) {
      if (e.code !== 'MODULE_NOT_FOUND' &&
          e.code !== 'QUALIFIED_PATH_RESOLUTION_FAILED' &&
          !/not find/i.test(e.message)) {
        throw e;
      }
    }
  }

  err = new Error(
    'Could not locate the bindings file. Tried:\n' +
      tries
        .map(function(a) {
          return opts.arrow + a;
        })
        .join('\n')
  );
  err.tries = tries;
  throw err;
}
module.exports = exports = bindings;

/**
 * Gets the filename of the JavaScript file that invokes this function.
 * Used to help find the root directory of a module.
 * Optionally accepts an filename argument to skip when searching for the invoking filename
 */

exports.getFileName = function getFileName(calling_file) {
  var origPST = Error.prepareStackTrace,
    origSTL = Error.stackTraceLimit,
    dummy = {},
    fileName;

  Error.stackTraceLimit = 10;

  Error.prepareStackTrace = function(e, st) {
    for (var i = 0, l = st.length; i < l; i++) {
      fileName = st[i].getFileName();
      if (fileName !== __filename) {
        if (calling_file) {
          if (fileName !== calling_file) {
            return;
          }
        } else {
          return;
        }
      }
    }
  };

  // run the 'prepareStackTrace' function above
  Error.captureStackTrace(dummy);
  dummy.stack;

  // cleanup
  Error.prepareStackTrace = origPST;
  Error.stackTraceLimit = origSTL;

  // handle filename that starts with "file://"
  var fileSchema = 'file://';
  if (fileName.indexOf(fileSchema) === 0) {
    fileName = fileURLToPath(fileName);
  }

  return fileName;
};

/**
 * Gets the root directory of a module, given an arbitrary filename
 * somewhere in the module tree. The "root directory" is the directory
 * containing the `package.json` file.
 *
 *   In:  /home/nate/node-native-module/lib/index.js
 *   Out: /home/nate/node-native-module
 */

exports.getRoot = function getRoot(file) {
  var dir = dirname(file),
    prev;
  while (true) {
    if (dir === '.') {
      // Avoids an infinite loop in rare cases, like the REPL
      dir = process.cwd();
    }
    if (
      exists(join(dir, 'package.json')) ||
      exists(join(dir, 'node_modules'))
    ) {
      // Found the 'package.json' file or 'node_modules' dir; we're done
      return dir;
    }
    if (prev === dir) {
      // Got to the top
      throw new Error(
        'Could not find module root given file: "' +
          file +
          '". Do you have a `package.json` file? '
      );
    }
    // Try the parent dir next
    prev = dir;
    dir = join(dir, '..');
  }
};

}).call(this)}).call(this,require("path").join(__dirname,"node_modules","bindings","bindings.js"))
},{"file-uri-to-path":22,"fs":undefined,"path":undefined}],4:[function(require,module,exports){
'use strict';

/**
 * Masks a buffer using the given mask.
 *
 * @param {Buffer} source The buffer to mask
 * @param {Buffer} mask The mask to use
 * @param {Buffer} output The buffer where to store the result
 * @param {Number} offset The offset at which to start writing
 * @param {Number} length The number of bytes to mask.
 * @public
 */
const mask = (source, mask, output, offset, length) => {
  for (var i = 0; i < length; i++) {
    output[offset + i] = source[i] ^ mask[i & 3];
  }
};

/**
 * Unmasks a buffer using the given mask.
 *
 * @param {Buffer} buffer The buffer to unmask
 * @param {Buffer} mask The mask to use
 * @public
 */
const unmask = (buffer, mask) => {
  // Required until https://github.com/nodejs/node/issues/9006 is resolved.
  const length = buffer.length;
  for (var i = 0; i < length; i++) {
    buffer[i] ^= mask[i & 3];
  }
};

module.exports = { mask, unmask };

},{}],5:[function(require,module,exports){
(function (__dirname){(function (){
'use strict';

try {
  module.exports = require('node-gyp-build')(__dirname);
} catch (e) {
  module.exports = require('./fallback');
}

}).call(this)}).call(this,require("path").join(__dirname,"node_modules","bufferutil"))
},{"./fallback":4,"node-gyp-build":46,"path":undefined}],6:[function(require,module,exports){
'use strict';
const ansiStyles = require('ansi-styles');
const {stdout: stdoutColor, stderr: stderrColor} = require('supports-color');
const {
	stringReplaceAll,
	stringEncaseCRLFWithFirstIndex
} = require('./util');

const {isArray} = Array;

// `supportsColor.level` → `ansiStyles.color[name]` mapping
const levelMapping = [
	'ansi',
	'ansi',
	'ansi256',
	'ansi16m'
];

const styles = Object.create(null);

const applyOptions = (object, options = {}) => {
	if (options.level && !(Number.isInteger(options.level) && options.level >= 0 && options.level <= 3)) {
		throw new Error('The `level` option should be an integer from 0 to 3');
	}

	// Detect level if not set manually
	const colorLevel = stdoutColor ? stdoutColor.level : 0;
	object.level = options.level === undefined ? colorLevel : options.level;
};

class ChalkClass {
	constructor(options) {
		// eslint-disable-next-line no-constructor-return
		return chalkFactory(options);
	}
}

const chalkFactory = options => {
	const chalk = {};
	applyOptions(chalk, options);

	chalk.template = (...arguments_) => chalkTag(chalk.template, ...arguments_);

	Object.setPrototypeOf(chalk, Chalk.prototype);
	Object.setPrototypeOf(chalk.template, chalk);

	chalk.template.constructor = () => {
		throw new Error('`chalk.constructor()` is deprecated. Use `new chalk.Instance()` instead.');
	};

	chalk.template.Instance = ChalkClass;

	return chalk.template;
};

function Chalk(options) {
	return chalkFactory(options);
}

for (const [styleName, style] of Object.entries(ansiStyles)) {
	styles[styleName] = {
		get() {
			const builder = createBuilder(this, createStyler(style.open, style.close, this._styler), this._isEmpty);
			Object.defineProperty(this, styleName, {value: builder});
			return builder;
		}
	};
}

styles.visible = {
	get() {
		const builder = createBuilder(this, this._styler, true);
		Object.defineProperty(this, 'visible', {value: builder});
		return builder;
	}
};

const usedModels = ['rgb', 'hex', 'keyword', 'hsl', 'hsv', 'hwb', 'ansi', 'ansi256'];

for (const model of usedModels) {
	styles[model] = {
		get() {
			const {level} = this;
			return function (...arguments_) {
				const styler = createStyler(ansiStyles.color[levelMapping[level]][model](...arguments_), ansiStyles.color.close, this._styler);
				return createBuilder(this, styler, this._isEmpty);
			};
		}
	};
}

for (const model of usedModels) {
	const bgModel = 'bg' + model[0].toUpperCase() + model.slice(1);
	styles[bgModel] = {
		get() {
			const {level} = this;
			return function (...arguments_) {
				const styler = createStyler(ansiStyles.bgColor[levelMapping[level]][model](...arguments_), ansiStyles.bgColor.close, this._styler);
				return createBuilder(this, styler, this._isEmpty);
			};
		}
	};
}

const proto = Object.defineProperties(() => {}, {
	...styles,
	level: {
		enumerable: true,
		get() {
			return this._generator.level;
		},
		set(level) {
			this._generator.level = level;
		}
	}
});

const createStyler = (open, close, parent) => {
	let openAll;
	let closeAll;
	if (parent === undefined) {
		openAll = open;
		closeAll = close;
	} else {
		openAll = parent.openAll + open;
		closeAll = close + parent.closeAll;
	}

	return {
		open,
		close,
		openAll,
		closeAll,
		parent
	};
};

const createBuilder = (self, _styler, _isEmpty) => {
	const builder = (...arguments_) => {
		if (isArray(arguments_[0]) && isArray(arguments_[0].raw)) {
			// Called as a template literal, for example: chalk.red`2 + 3 = {bold ${2+3}}`
			return applyStyle(builder, chalkTag(builder, ...arguments_));
		}

		// Single argument is hot path, implicit coercion is faster than anything
		// eslint-disable-next-line no-implicit-coercion
		return applyStyle(builder, (arguments_.length === 1) ? ('' + arguments_[0]) : arguments_.join(' '));
	};

	// We alter the prototype because we must return a function, but there is
	// no way to create a function with a different prototype
	Object.setPrototypeOf(builder, proto);

	builder._generator = self;
	builder._styler = _styler;
	builder._isEmpty = _isEmpty;

	return builder;
};

const applyStyle = (self, string) => {
	if (self.level <= 0 || !string) {
		return self._isEmpty ? '' : string;
	}

	let styler = self._styler;

	if (styler === undefined) {
		return string;
	}

	const {openAll, closeAll} = styler;
	if (string.indexOf('\u001B') !== -1) {
		while (styler !== undefined) {
			// Replace any instances already present with a re-opening code
			// otherwise only the part of the string until said closing code
			// will be colored, and the rest will simply be 'plain'.
			string = stringReplaceAll(string, styler.close, styler.open);

			styler = styler.parent;
		}
	}

	// We can move both next actions out of loop, because remaining actions in loop won't have
	// any/visible effect on parts we add here. Close the styling before a linebreak and reopen
	// after next line to fix a bleed issue on macOS: https://github.com/chalk/chalk/pull/92
	const lfIndex = string.indexOf('\n');
	if (lfIndex !== -1) {
		string = stringEncaseCRLFWithFirstIndex(string, closeAll, openAll, lfIndex);
	}

	return openAll + string + closeAll;
};

let template;
const chalkTag = (chalk, ...strings) => {
	const [firstString] = strings;

	if (!isArray(firstString) || !isArray(firstString.raw)) {
		// If chalk() was called by itself or with a string,
		// return the string itself as a string.
		return strings.join(' ');
	}

	const arguments_ = strings.slice(1);
	const parts = [firstString.raw[0]];

	for (let i = 1; i < firstString.length; i++) {
		parts.push(
			String(arguments_[i - 1]).replace(/[{}\\]/g, '\\$&'),
			String(firstString.raw[i])
		);
	}

	if (template === undefined) {
		template = require('./templates');
	}

	return template(chalk, parts.join(''));
};

Object.defineProperties(Chalk.prototype, styles);

const chalk = Chalk(); // eslint-disable-line new-cap
chalk.supportsColor = stdoutColor;
chalk.stderr = Chalk({level: stderrColor ? stderrColor.level : 0}); // eslint-disable-line new-cap
chalk.stderr.supportsColor = stderrColor;

module.exports = chalk;

},{"./templates":7,"./util":8,"ansi-styles":2,"supports-color":50}],7:[function(require,module,exports){
'use strict';
const TEMPLATE_REGEX = /(?:\\(u(?:[a-f\d]{4}|\{[a-f\d]{1,6}\})|x[a-f\d]{2}|.))|(?:\{(~)?(\w+(?:\([^)]*\))?(?:\.\w+(?:\([^)]*\))?)*)(?:[ \t]|(?=\r?\n)))|(\})|((?:.|[\r\n\f])+?)/gi;
const STYLE_REGEX = /(?:^|\.)(\w+)(?:\(([^)]*)\))?/g;
const STRING_REGEX = /^(['"])((?:\\.|(?!\1)[^\\])*)\1$/;
const ESCAPE_REGEX = /\\(u(?:[a-f\d]{4}|{[a-f\d]{1,6}})|x[a-f\d]{2}|.)|([^\\])/gi;

const ESCAPES = new Map([
	['n', '\n'],
	['r', '\r'],
	['t', '\t'],
	['b', '\b'],
	['f', '\f'],
	['v', '\v'],
	['0', '\0'],
	['\\', '\\'],
	['e', '\u001B'],
	['a', '\u0007']
]);

function unescape(c) {
	const u = c[0] === 'u';
	const bracket = c[1] === '{';

	if ((u && !bracket && c.length === 5) || (c[0] === 'x' && c.length === 3)) {
		return String.fromCharCode(parseInt(c.slice(1), 16));
	}

	if (u && bracket) {
		return String.fromCodePoint(parseInt(c.slice(2, -1), 16));
	}

	return ESCAPES.get(c) || c;
}

function parseArguments(name, arguments_) {
	const results = [];
	const chunks = arguments_.trim().split(/\s*,\s*/g);
	let matches;

	for (const chunk of chunks) {
		const number = Number(chunk);
		if (!Number.isNaN(number)) {
			results.push(number);
		} else if ((matches = chunk.match(STRING_REGEX))) {
			results.push(matches[2].replace(ESCAPE_REGEX, (m, escape, character) => escape ? unescape(escape) : character));
		} else {
			throw new Error(`Invalid Chalk template style argument: ${chunk} (in style '${name}')`);
		}
	}

	return results;
}

function parseStyle(style) {
	STYLE_REGEX.lastIndex = 0;

	const results = [];
	let matches;

	while ((matches = STYLE_REGEX.exec(style)) !== null) {
		const name = matches[1];

		if (matches[2]) {
			const args = parseArguments(name, matches[2]);
			results.push([name].concat(args));
		} else {
			results.push([name]);
		}
	}

	return results;
}

function buildStyle(chalk, styles) {
	const enabled = {};

	for (const layer of styles) {
		for (const style of layer.styles) {
			enabled[style[0]] = layer.inverse ? null : style.slice(1);
		}
	}

	let current = chalk;
	for (const [styleName, styles] of Object.entries(enabled)) {
		if (!Array.isArray(styles)) {
			continue;
		}

		if (!(styleName in current)) {
			throw new Error(`Unknown Chalk style: ${styleName}`);
		}

		current = styles.length > 0 ? current[styleName](...styles) : current[styleName];
	}

	return current;
}

module.exports = (chalk, temporary) => {
	const styles = [];
	const chunks = [];
	let chunk = [];

	// eslint-disable-next-line max-params
	temporary.replace(TEMPLATE_REGEX, (m, escapeCharacter, inverse, style, close, character) => {
		if (escapeCharacter) {
			chunk.push(unescape(escapeCharacter));
		} else if (style) {
			const string = chunk.join('');
			chunk = [];
			chunks.push(styles.length === 0 ? string : buildStyle(chalk, styles)(string));
			styles.push({inverse, styles: parseStyle(style)});
		} else if (close) {
			if (styles.length === 0) {
				throw new Error('Found extraneous } in Chalk template literal');
			}

			chunks.push(buildStyle(chalk, styles)(chunk.join('')));
			chunk = [];
			styles.pop();
		} else {
			chunk.push(character);
		}
	});

	chunks.push(chunk.join(''));

	if (styles.length > 0) {
		const errMessage = `Chalk template literal is missing ${styles.length} closing bracket${styles.length === 1 ? '' : 's'} (\`}\`)`;
		throw new Error(errMessage);
	}

	return chunks.join('');
};

},{}],8:[function(require,module,exports){
'use strict';

const stringReplaceAll = (string, substring, replacer) => {
	let index = string.indexOf(substring);
	if (index === -1) {
		return string;
	}

	const substringLength = substring.length;
	let endIndex = 0;
	let returnValue = '';
	do {
		returnValue += string.substr(endIndex, index - endIndex) + substring + replacer;
		endIndex = index + substringLength;
		index = string.indexOf(substring, endIndex);
	} while (index !== -1);

	returnValue += string.substr(endIndex);
	return returnValue;
};

const stringEncaseCRLFWithFirstIndex = (string, prefix, postfix, index) => {
	let endIndex = 0;
	let returnValue = '';
	do {
		const gotCR = string[index - 1] === '\r';
		returnValue += string.substr(endIndex, (gotCR ? index - 1 : index) - endIndex) + prefix + (gotCR ? '\r\n' : '\n') + postfix;
		endIndex = index + 1;
		index = string.indexOf('\n', endIndex);
	} while (index !== -1);

	returnValue += string.substr(endIndex);
	return returnValue;
};

module.exports = {
	stringReplaceAll,
	stringEncaseCRLFWithFirstIndex
};

},{}],9:[function(require,module,exports){
/* MIT license */
/* eslint-disable no-mixed-operators */
const cssKeywords = require('color-name');

// NOTE: conversions should only return primitive values (i.e. arrays, or
//       values that give correct `typeof` results).
//       do not use box values types (i.e. Number(), String(), etc.)

const reverseKeywords = {};
for (const key of Object.keys(cssKeywords)) {
	reverseKeywords[cssKeywords[key]] = key;
}

const convert = {
	rgb: {channels: 3, labels: 'rgb'},
	hsl: {channels: 3, labels: 'hsl'},
	hsv: {channels: 3, labels: 'hsv'},
	hwb: {channels: 3, labels: 'hwb'},
	cmyk: {channels: 4, labels: 'cmyk'},
	xyz: {channels: 3, labels: 'xyz'},
	lab: {channels: 3, labels: 'lab'},
	lch: {channels: 3, labels: 'lch'},
	hex: {channels: 1, labels: ['hex']},
	keyword: {channels: 1, labels: ['keyword']},
	ansi16: {channels: 1, labels: ['ansi16']},
	ansi256: {channels: 1, labels: ['ansi256']},
	hcg: {channels: 3, labels: ['h', 'c', 'g']},
	apple: {channels: 3, labels: ['r16', 'g16', 'b16']},
	gray: {channels: 1, labels: ['gray']}
};

module.exports = convert;

// Hide .channels and .labels properties
for (const model of Object.keys(convert)) {
	if (!('channels' in convert[model])) {
		throw new Error('missing channels property: ' + model);
	}

	if (!('labels' in convert[model])) {
		throw new Error('missing channel labels property: ' + model);
	}

	if (convert[model].labels.length !== convert[model].channels) {
		throw new Error('channel and label counts mismatch: ' + model);
	}

	const {channels, labels} = convert[model];
	delete convert[model].channels;
	delete convert[model].labels;
	Object.defineProperty(convert[model], 'channels', {value: channels});
	Object.defineProperty(convert[model], 'labels', {value: labels});
}

convert.rgb.hsl = function (rgb) {
	const r = rgb[0] / 255;
	const g = rgb[1] / 255;
	const b = rgb[2] / 255;
	const min = Math.min(r, g, b);
	const max = Math.max(r, g, b);
	const delta = max - min;
	let h;
	let s;

	if (max === min) {
		h = 0;
	} else if (r === max) {
		h = (g - b) / delta;
	} else if (g === max) {
		h = 2 + (b - r) / delta;
	} else if (b === max) {
		h = 4 + (r - g) / delta;
	}

	h = Math.min(h * 60, 360);

	if (h < 0) {
		h += 360;
	}

	const l = (min + max) / 2;

	if (max === min) {
		s = 0;
	} else if (l <= 0.5) {
		s = delta / (max + min);
	} else {
		s = delta / (2 - max - min);
	}

	return [h, s * 100, l * 100];
};

convert.rgb.hsv = function (rgb) {
	let rdif;
	let gdif;
	let bdif;
	let h;
	let s;

	const r = rgb[0] / 255;
	const g = rgb[1] / 255;
	const b = rgb[2] / 255;
	const v = Math.max(r, g, b);
	const diff = v - Math.min(r, g, b);
	const diffc = function (c) {
		return (v - c) / 6 / diff + 1 / 2;
	};

	if (diff === 0) {
		h = 0;
		s = 0;
	} else {
		s = diff / v;
		rdif = diffc(r);
		gdif = diffc(g);
		bdif = diffc(b);

		if (r === v) {
			h = bdif - gdif;
		} else if (g === v) {
			h = (1 / 3) + rdif - bdif;
		} else if (b === v) {
			h = (2 / 3) + gdif - rdif;
		}

		if (h < 0) {
			h += 1;
		} else if (h > 1) {
			h -= 1;
		}
	}

	return [
		h * 360,
		s * 100,
		v * 100
	];
};

convert.rgb.hwb = function (rgb) {
	const r = rgb[0];
	const g = rgb[1];
	let b = rgb[2];
	const h = convert.rgb.hsl(rgb)[0];
	const w = 1 / 255 * Math.min(r, Math.min(g, b));

	b = 1 - 1 / 255 * Math.max(r, Math.max(g, b));

	return [h, w * 100, b * 100];
};

convert.rgb.cmyk = function (rgb) {
	const r = rgb[0] / 255;
	const g = rgb[1] / 255;
	const b = rgb[2] / 255;

	const k = Math.min(1 - r, 1 - g, 1 - b);
	const c = (1 - r - k) / (1 - k) || 0;
	const m = (1 - g - k) / (1 - k) || 0;
	const y = (1 - b - k) / (1 - k) || 0;

	return [c * 100, m * 100, y * 100, k * 100];
};

function comparativeDistance(x, y) {
	/*
		See https://en.m.wikipedia.org/wiki/Euclidean_distance#Squared_Euclidean_distance
	*/
	return (
		((x[0] - y[0]) ** 2) +
		((x[1] - y[1]) ** 2) +
		((x[2] - y[2]) ** 2)
	);
}

convert.rgb.keyword = function (rgb) {
	const reversed = reverseKeywords[rgb];
	if (reversed) {
		return reversed;
	}

	let currentClosestDistance = Infinity;
	let currentClosestKeyword;

	for (const keyword of Object.keys(cssKeywords)) {
		const value = cssKeywords[keyword];

		// Compute comparative distance
		const distance = comparativeDistance(rgb, value);

		// Check if its less, if so set as closest
		if (distance < currentClosestDistance) {
			currentClosestDistance = distance;
			currentClosestKeyword = keyword;
		}
	}

	return currentClosestKeyword;
};

convert.keyword.rgb = function (keyword) {
	return cssKeywords[keyword];
};

convert.rgb.xyz = function (rgb) {
	let r = rgb[0] / 255;
	let g = rgb[1] / 255;
	let b = rgb[2] / 255;

	// Assume sRGB
	r = r > 0.04045 ? (((r + 0.055) / 1.055) ** 2.4) : (r / 12.92);
	g = g > 0.04045 ? (((g + 0.055) / 1.055) ** 2.4) : (g / 12.92);
	b = b > 0.04045 ? (((b + 0.055) / 1.055) ** 2.4) : (b / 12.92);

	const x = (r * 0.4124) + (g * 0.3576) + (b * 0.1805);
	const y = (r * 0.2126) + (g * 0.7152) + (b * 0.0722);
	const z = (r * 0.0193) + (g * 0.1192) + (b * 0.9505);

	return [x * 100, y * 100, z * 100];
};

convert.rgb.lab = function (rgb) {
	const xyz = convert.rgb.xyz(rgb);
	let x = xyz[0];
	let y = xyz[1];
	let z = xyz[2];

	x /= 95.047;
	y /= 100;
	z /= 108.883;

	x = x > 0.008856 ? (x ** (1 / 3)) : (7.787 * x) + (16 / 116);
	y = y > 0.008856 ? (y ** (1 / 3)) : (7.787 * y) + (16 / 116);
	z = z > 0.008856 ? (z ** (1 / 3)) : (7.787 * z) + (16 / 116);

	const l = (116 * y) - 16;
	const a = 500 * (x - y);
	const b = 200 * (y - z);

	return [l, a, b];
};

convert.hsl.rgb = function (hsl) {
	const h = hsl[0] / 360;
	const s = hsl[1] / 100;
	const l = hsl[2] / 100;
	let t2;
	let t3;
	let val;

	if (s === 0) {
		val = l * 255;
		return [val, val, val];
	}

	if (l < 0.5) {
		t2 = l * (1 + s);
	} else {
		t2 = l + s - l * s;
	}

	const t1 = 2 * l - t2;

	const rgb = [0, 0, 0];
	for (let i = 0; i < 3; i++) {
		t3 = h + 1 / 3 * -(i - 1);
		if (t3 < 0) {
			t3++;
		}

		if (t3 > 1) {
			t3--;
		}

		if (6 * t3 < 1) {
			val = t1 + (t2 - t1) * 6 * t3;
		} else if (2 * t3 < 1) {
			val = t2;
		} else if (3 * t3 < 2) {
			val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
		} else {
			val = t1;
		}

		rgb[i] = val * 255;
	}

	return rgb;
};

convert.hsl.hsv = function (hsl) {
	const h = hsl[0];
	let s = hsl[1] / 100;
	let l = hsl[2] / 100;
	let smin = s;
	const lmin = Math.max(l, 0.01);

	l *= 2;
	s *= (l <= 1) ? l : 2 - l;
	smin *= lmin <= 1 ? lmin : 2 - lmin;
	const v = (l + s) / 2;
	const sv = l === 0 ? (2 * smin) / (lmin + smin) : (2 * s) / (l + s);

	return [h, sv * 100, v * 100];
};

convert.hsv.rgb = function (hsv) {
	const h = hsv[0] / 60;
	const s = hsv[1] / 100;
	let v = hsv[2] / 100;
	const hi = Math.floor(h) % 6;

	const f = h - Math.floor(h);
	const p = 255 * v * (1 - s);
	const q = 255 * v * (1 - (s * f));
	const t = 255 * v * (1 - (s * (1 - f)));
	v *= 255;

	switch (hi) {
		case 0:
			return [v, t, p];
		case 1:
			return [q, v, p];
		case 2:
			return [p, v, t];
		case 3:
			return [p, q, v];
		case 4:
			return [t, p, v];
		case 5:
			return [v, p, q];
	}
};

convert.hsv.hsl = function (hsv) {
	const h = hsv[0];
	const s = hsv[1] / 100;
	const v = hsv[2] / 100;
	const vmin = Math.max(v, 0.01);
	let sl;
	let l;

	l = (2 - s) * v;
	const lmin = (2 - s) * vmin;
	sl = s * vmin;
	sl /= (lmin <= 1) ? lmin : 2 - lmin;
	sl = sl || 0;
	l /= 2;

	return [h, sl * 100, l * 100];
};

// http://dev.w3.org/csswg/css-color/#hwb-to-rgb
convert.hwb.rgb = function (hwb) {
	const h = hwb[0] / 360;
	let wh = hwb[1] / 100;
	let bl = hwb[2] / 100;
	const ratio = wh + bl;
	let f;

	// Wh + bl cant be > 1
	if (ratio > 1) {
		wh /= ratio;
		bl /= ratio;
	}

	const i = Math.floor(6 * h);
	const v = 1 - bl;
	f = 6 * h - i;

	if ((i & 0x01) !== 0) {
		f = 1 - f;
	}

	const n = wh + f * (v - wh); // Linear interpolation

	let r;
	let g;
	let b;
	/* eslint-disable max-statements-per-line,no-multi-spaces */
	switch (i) {
		default:
		case 6:
		case 0: r = v;  g = n;  b = wh; break;
		case 1: r = n;  g = v;  b = wh; break;
		case 2: r = wh; g = v;  b = n; break;
		case 3: r = wh; g = n;  b = v; break;
		case 4: r = n;  g = wh; b = v; break;
		case 5: r = v;  g = wh; b = n; break;
	}
	/* eslint-enable max-statements-per-line,no-multi-spaces */

	return [r * 255, g * 255, b * 255];
};

convert.cmyk.rgb = function (cmyk) {
	const c = cmyk[0] / 100;
	const m = cmyk[1] / 100;
	const y = cmyk[2] / 100;
	const k = cmyk[3] / 100;

	const r = 1 - Math.min(1, c * (1 - k) + k);
	const g = 1 - Math.min(1, m * (1 - k) + k);
	const b = 1 - Math.min(1, y * (1 - k) + k);

	return [r * 255, g * 255, b * 255];
};

convert.xyz.rgb = function (xyz) {
	const x = xyz[0] / 100;
	const y = xyz[1] / 100;
	const z = xyz[2] / 100;
	let r;
	let g;
	let b;

	r = (x * 3.2406) + (y * -1.5372) + (z * -0.4986);
	g = (x * -0.9689) + (y * 1.8758) + (z * 0.0415);
	b = (x * 0.0557) + (y * -0.2040) + (z * 1.0570);

	// Assume sRGB
	r = r > 0.0031308
		? ((1.055 * (r ** (1.0 / 2.4))) - 0.055)
		: r * 12.92;

	g = g > 0.0031308
		? ((1.055 * (g ** (1.0 / 2.4))) - 0.055)
		: g * 12.92;

	b = b > 0.0031308
		? ((1.055 * (b ** (1.0 / 2.4))) - 0.055)
		: b * 12.92;

	r = Math.min(Math.max(0, r), 1);
	g = Math.min(Math.max(0, g), 1);
	b = Math.min(Math.max(0, b), 1);

	return [r * 255, g * 255, b * 255];
};

convert.xyz.lab = function (xyz) {
	let x = xyz[0];
	let y = xyz[1];
	let z = xyz[2];

	x /= 95.047;
	y /= 100;
	z /= 108.883;

	x = x > 0.008856 ? (x ** (1 / 3)) : (7.787 * x) + (16 / 116);
	y = y > 0.008856 ? (y ** (1 / 3)) : (7.787 * y) + (16 / 116);
	z = z > 0.008856 ? (z ** (1 / 3)) : (7.787 * z) + (16 / 116);

	const l = (116 * y) - 16;
	const a = 500 * (x - y);
	const b = 200 * (y - z);

	return [l, a, b];
};

convert.lab.xyz = function (lab) {
	const l = lab[0];
	const a = lab[1];
	const b = lab[2];
	let x;
	let y;
	let z;

	y = (l + 16) / 116;
	x = a / 500 + y;
	z = y - b / 200;

	const y2 = y ** 3;
	const x2 = x ** 3;
	const z2 = z ** 3;
	y = y2 > 0.008856 ? y2 : (y - 16 / 116) / 7.787;
	x = x2 > 0.008856 ? x2 : (x - 16 / 116) / 7.787;
	z = z2 > 0.008856 ? z2 : (z - 16 / 116) / 7.787;

	x *= 95.047;
	y *= 100;
	z *= 108.883;

	return [x, y, z];
};

convert.lab.lch = function (lab) {
	const l = lab[0];
	const a = lab[1];
	const b = lab[2];
	let h;

	const hr = Math.atan2(b, a);
	h = hr * 360 / 2 / Math.PI;

	if (h < 0) {
		h += 360;
	}

	const c = Math.sqrt(a * a + b * b);

	return [l, c, h];
};

convert.lch.lab = function (lch) {
	const l = lch[0];
	const c = lch[1];
	const h = lch[2];

	const hr = h / 360 * 2 * Math.PI;
	const a = c * Math.cos(hr);
	const b = c * Math.sin(hr);

	return [l, a, b];
};

convert.rgb.ansi16 = function (args, saturation = null) {
	const [r, g, b] = args;
	let value = saturation === null ? convert.rgb.hsv(args)[2] : saturation; // Hsv -> ansi16 optimization

	value = Math.round(value / 50);

	if (value === 0) {
		return 30;
	}

	let ansi = 30
		+ ((Math.round(b / 255) << 2)
		| (Math.round(g / 255) << 1)
		| Math.round(r / 255));

	if (value === 2) {
		ansi += 60;
	}

	return ansi;
};

convert.hsv.ansi16 = function (args) {
	// Optimization here; we already know the value and don't need to get
	// it converted for us.
	return convert.rgb.ansi16(convert.hsv.rgb(args), args[2]);
};

convert.rgb.ansi256 = function (args) {
	const r = args[0];
	const g = args[1];
	const b = args[2];

	// We use the extended greyscale palette here, with the exception of
	// black and white. normal palette only has 4 greyscale shades.
	if (r === g && g === b) {
		if (r < 8) {
			return 16;
		}

		if (r > 248) {
			return 231;
		}

		return Math.round(((r - 8) / 247) * 24) + 232;
	}

	const ansi = 16
		+ (36 * Math.round(r / 255 * 5))
		+ (6 * Math.round(g / 255 * 5))
		+ Math.round(b / 255 * 5);

	return ansi;
};

convert.ansi16.rgb = function (args) {
	let color = args % 10;

	// Handle greyscale
	if (color === 0 || color === 7) {
		if (args > 50) {
			color += 3.5;
		}

		color = color / 10.5 * 255;

		return [color, color, color];
	}

	const mult = (~~(args > 50) + 1) * 0.5;
	const r = ((color & 1) * mult) * 255;
	const g = (((color >> 1) & 1) * mult) * 255;
	const b = (((color >> 2) & 1) * mult) * 255;

	return [r, g, b];
};

convert.ansi256.rgb = function (args) {
	// Handle greyscale
	if (args >= 232) {
		const c = (args - 232) * 10 + 8;
		return [c, c, c];
	}

	args -= 16;

	let rem;
	const r = Math.floor(args / 36) / 5 * 255;
	const g = Math.floor((rem = args % 36) / 6) / 5 * 255;
	const b = (rem % 6) / 5 * 255;

	return [r, g, b];
};

convert.rgb.hex = function (args) {
	const integer = ((Math.round(args[0]) & 0xFF) << 16)
		+ ((Math.round(args[1]) & 0xFF) << 8)
		+ (Math.round(args[2]) & 0xFF);

	const string = integer.toString(16).toUpperCase();
	return '000000'.substring(string.length) + string;
};

convert.hex.rgb = function (args) {
	const match = args.toString(16).match(/[a-f0-9]{6}|[a-f0-9]{3}/i);
	if (!match) {
		return [0, 0, 0];
	}

	let colorString = match[0];

	if (match[0].length === 3) {
		colorString = colorString.split('').map(char => {
			return char + char;
		}).join('');
	}

	const integer = parseInt(colorString, 16);
	const r = (integer >> 16) & 0xFF;
	const g = (integer >> 8) & 0xFF;
	const b = integer & 0xFF;

	return [r, g, b];
};

convert.rgb.hcg = function (rgb) {
	const r = rgb[0] / 255;
	const g = rgb[1] / 255;
	const b = rgb[2] / 255;
	const max = Math.max(Math.max(r, g), b);
	const min = Math.min(Math.min(r, g), b);
	const chroma = (max - min);
	let grayscale;
	let hue;

	if (chroma < 1) {
		grayscale = min / (1 - chroma);
	} else {
		grayscale = 0;
	}

	if (chroma <= 0) {
		hue = 0;
	} else
	if (max === r) {
		hue = ((g - b) / chroma) % 6;
	} else
	if (max === g) {
		hue = 2 + (b - r) / chroma;
	} else {
		hue = 4 + (r - g) / chroma;
	}

	hue /= 6;
	hue %= 1;

	return [hue * 360, chroma * 100, grayscale * 100];
};

convert.hsl.hcg = function (hsl) {
	const s = hsl[1] / 100;
	const l = hsl[2] / 100;

	const c = l < 0.5 ? (2.0 * s * l) : (2.0 * s * (1.0 - l));

	let f = 0;
	if (c < 1.0) {
		f = (l - 0.5 * c) / (1.0 - c);
	}

	return [hsl[0], c * 100, f * 100];
};

convert.hsv.hcg = function (hsv) {
	const s = hsv[1] / 100;
	const v = hsv[2] / 100;

	const c = s * v;
	let f = 0;

	if (c < 1.0) {
		f = (v - c) / (1 - c);
	}

	return [hsv[0], c * 100, f * 100];
};

convert.hcg.rgb = function (hcg) {
	const h = hcg[0] / 360;
	const c = hcg[1] / 100;
	const g = hcg[2] / 100;

	if (c === 0.0) {
		return [g * 255, g * 255, g * 255];
	}

	const pure = [0, 0, 0];
	const hi = (h % 1) * 6;
	const v = hi % 1;
	const w = 1 - v;
	let mg = 0;

	/* eslint-disable max-statements-per-line */
	switch (Math.floor(hi)) {
		case 0:
			pure[0] = 1; pure[1] = v; pure[2] = 0; break;
		case 1:
			pure[0] = w; pure[1] = 1; pure[2] = 0; break;
		case 2:
			pure[0] = 0; pure[1] = 1; pure[2] = v; break;
		case 3:
			pure[0] = 0; pure[1] = w; pure[2] = 1; break;
		case 4:
			pure[0] = v; pure[1] = 0; pure[2] = 1; break;
		default:
			pure[0] = 1; pure[1] = 0; pure[2] = w;
	}
	/* eslint-enable max-statements-per-line */

	mg = (1.0 - c) * g;

	return [
		(c * pure[0] + mg) * 255,
		(c * pure[1] + mg) * 255,
		(c * pure[2] + mg) * 255
	];
};

convert.hcg.hsv = function (hcg) {
	const c = hcg[1] / 100;
	const g = hcg[2] / 100;

	const v = c + g * (1.0 - c);
	let f = 0;

	if (v > 0.0) {
		f = c / v;
	}

	return [hcg[0], f * 100, v * 100];
};

convert.hcg.hsl = function (hcg) {
	const c = hcg[1] / 100;
	const g = hcg[2] / 100;

	const l = g * (1.0 - c) + 0.5 * c;
	let s = 0;

	if (l > 0.0 && l < 0.5) {
		s = c / (2 * l);
	} else
	if (l >= 0.5 && l < 1.0) {
		s = c / (2 * (1 - l));
	}

	return [hcg[0], s * 100, l * 100];
};

convert.hcg.hwb = function (hcg) {
	const c = hcg[1] / 100;
	const g = hcg[2] / 100;
	const v = c + g * (1.0 - c);
	return [hcg[0], (v - c) * 100, (1 - v) * 100];
};

convert.hwb.hcg = function (hwb) {
	const w = hwb[1] / 100;
	const b = hwb[2] / 100;
	const v = 1 - b;
	const c = v - w;
	let g = 0;

	if (c < 1) {
		g = (v - c) / (1 - c);
	}

	return [hwb[0], c * 100, g * 100];
};

convert.apple.rgb = function (apple) {
	return [(apple[0] / 65535) * 255, (apple[1] / 65535) * 255, (apple[2] / 65535) * 255];
};

convert.rgb.apple = function (rgb) {
	return [(rgb[0] / 255) * 65535, (rgb[1] / 255) * 65535, (rgb[2] / 255) * 65535];
};

convert.gray.rgb = function (args) {
	return [args[0] / 100 * 255, args[0] / 100 * 255, args[0] / 100 * 255];
};

convert.gray.hsl = function (args) {
	return [0, 0, args[0]];
};

convert.gray.hsv = convert.gray.hsl;

convert.gray.hwb = function (gray) {
	return [0, 100, gray[0]];
};

convert.gray.cmyk = function (gray) {
	return [0, 0, 0, gray[0]];
};

convert.gray.lab = function (gray) {
	return [gray[0], 0, 0];
};

convert.gray.hex = function (gray) {
	const val = Math.round(gray[0] / 100 * 255) & 0xFF;
	const integer = (val << 16) + (val << 8) + val;

	const string = integer.toString(16).toUpperCase();
	return '000000'.substring(string.length) + string;
};

convert.rgb.gray = function (rgb) {
	const val = (rgb[0] + rgb[1] + rgb[2]) / 3;
	return [val / 255 * 100];
};

},{"color-name":12}],10:[function(require,module,exports){
const conversions = require('./conversions');
const route = require('./route');

const convert = {};

const models = Object.keys(conversions);

function wrapRaw(fn) {
	const wrappedFn = function (...args) {
		const arg0 = args[0];
		if (arg0 === undefined || arg0 === null) {
			return arg0;
		}

		if (arg0.length > 1) {
			args = arg0;
		}

		return fn(args);
	};

	// Preserve .conversion property if there is one
	if ('conversion' in fn) {
		wrappedFn.conversion = fn.conversion;
	}

	return wrappedFn;
}

function wrapRounded(fn) {
	const wrappedFn = function (...args) {
		const arg0 = args[0];

		if (arg0 === undefined || arg0 === null) {
			return arg0;
		}

		if (arg0.length > 1) {
			args = arg0;
		}

		const result = fn(args);

		// We're assuming the result is an array here.
		// see notice in conversions.js; don't use box types
		// in conversion functions.
		if (typeof result === 'object') {
			for (let len = result.length, i = 0; i < len; i++) {
				result[i] = Math.round(result[i]);
			}
		}

		return result;
	};

	// Preserve .conversion property if there is one
	if ('conversion' in fn) {
		wrappedFn.conversion = fn.conversion;
	}

	return wrappedFn;
}

models.forEach(fromModel => {
	convert[fromModel] = {};

	Object.defineProperty(convert[fromModel], 'channels', {value: conversions[fromModel].channels});
	Object.defineProperty(convert[fromModel], 'labels', {value: conversions[fromModel].labels});

	const routes = route(fromModel);
	const routeModels = Object.keys(routes);

	routeModels.forEach(toModel => {
		const fn = routes[toModel];

		convert[fromModel][toModel] = wrapRounded(fn);
		convert[fromModel][toModel].raw = wrapRaw(fn);
	});
});

module.exports = convert;

},{"./conversions":9,"./route":11}],11:[function(require,module,exports){
const conversions = require('./conversions');

/*
	This function routes a model to all other models.

	all functions that are routed have a property `.conversion` attached
	to the returned synthetic function. This property is an array
	of strings, each with the steps in between the 'from' and 'to'
	color models (inclusive).

	conversions that are not possible simply are not included.
*/

function buildGraph() {
	const graph = {};
	// https://jsperf.com/object-keys-vs-for-in-with-closure/3
	const models = Object.keys(conversions);

	for (let len = models.length, i = 0; i < len; i++) {
		graph[models[i]] = {
			// http://jsperf.com/1-vs-infinity
			// micro-opt, but this is simple.
			distance: -1,
			parent: null
		};
	}

	return graph;
}

// https://en.wikipedia.org/wiki/Breadth-first_search
function deriveBFS(fromModel) {
	const graph = buildGraph();
	const queue = [fromModel]; // Unshift -> queue -> pop

	graph[fromModel].distance = 0;

	while (queue.length) {
		const current = queue.pop();
		const adjacents = Object.keys(conversions[current]);

		for (let len = adjacents.length, i = 0; i < len; i++) {
			const adjacent = adjacents[i];
			const node = graph[adjacent];

			if (node.distance === -1) {
				node.distance = graph[current].distance + 1;
				node.parent = current;
				queue.unshift(adjacent);
			}
		}
	}

	return graph;
}

function link(from, to) {
	return function (args) {
		return to(from(args));
	};
}

function wrapConversion(toModel, graph) {
	const path = [graph[toModel].parent, toModel];
	let fn = conversions[graph[toModel].parent][toModel];

	let cur = graph[toModel].parent;
	while (graph[cur].parent) {
		path.unshift(graph[cur].parent);
		fn = link(conversions[graph[cur].parent][cur], fn);
		cur = graph[cur].parent;
	}

	fn.conversion = path;
	return fn;
}

module.exports = function (fromModel) {
	const graph = deriveBFS(fromModel);
	const conversion = {};

	const models = Object.keys(graph);
	for (let len = models.length, i = 0; i < len; i++) {
		const toModel = models[i];
		const node = graph[toModel];

		if (node.parent === null) {
			// No possible conversion, or this node is the source model.
			continue;
		}

		conversion[toModel] = wrapConversion(toModel, graph);
	}

	return conversion;
};


},{"./conversions":9}],12:[function(require,module,exports){
'use strict'

module.exports = {
	"aliceblue": [240, 248, 255],
	"antiquewhite": [250, 235, 215],
	"aqua": [0, 255, 255],
	"aquamarine": [127, 255, 212],
	"azure": [240, 255, 255],
	"beige": [245, 245, 220],
	"bisque": [255, 228, 196],
	"black": [0, 0, 0],
	"blanchedalmond": [255, 235, 205],
	"blue": [0, 0, 255],
	"blueviolet": [138, 43, 226],
	"brown": [165, 42, 42],
	"burlywood": [222, 184, 135],
	"cadetblue": [95, 158, 160],
	"chartreuse": [127, 255, 0],
	"chocolate": [210, 105, 30],
	"coral": [255, 127, 80],
	"cornflowerblue": [100, 149, 237],
	"cornsilk": [255, 248, 220],
	"crimson": [220, 20, 60],
	"cyan": [0, 255, 255],
	"darkblue": [0, 0, 139],
	"darkcyan": [0, 139, 139],
	"darkgoldenrod": [184, 134, 11],
	"darkgray": [169, 169, 169],
	"darkgreen": [0, 100, 0],
	"darkgrey": [169, 169, 169],
	"darkkhaki": [189, 183, 107],
	"darkmagenta": [139, 0, 139],
	"darkolivegreen": [85, 107, 47],
	"darkorange": [255, 140, 0],
	"darkorchid": [153, 50, 204],
	"darkred": [139, 0, 0],
	"darksalmon": [233, 150, 122],
	"darkseagreen": [143, 188, 143],
	"darkslateblue": [72, 61, 139],
	"darkslategray": [47, 79, 79],
	"darkslategrey": [47, 79, 79],
	"darkturquoise": [0, 206, 209],
	"darkviolet": [148, 0, 211],
	"deeppink": [255, 20, 147],
	"deepskyblue": [0, 191, 255],
	"dimgray": [105, 105, 105],
	"dimgrey": [105, 105, 105],
	"dodgerblue": [30, 144, 255],
	"firebrick": [178, 34, 34],
	"floralwhite": [255, 250, 240],
	"forestgreen": [34, 139, 34],
	"fuchsia": [255, 0, 255],
	"gainsboro": [220, 220, 220],
	"ghostwhite": [248, 248, 255],
	"gold": [255, 215, 0],
	"goldenrod": [218, 165, 32],
	"gray": [128, 128, 128],
	"green": [0, 128, 0],
	"greenyellow": [173, 255, 47],
	"grey": [128, 128, 128],
	"honeydew": [240, 255, 240],
	"hotpink": [255, 105, 180],
	"indianred": [205, 92, 92],
	"indigo": [75, 0, 130],
	"ivory": [255, 255, 240],
	"khaki": [240, 230, 140],
	"lavender": [230, 230, 250],
	"lavenderblush": [255, 240, 245],
	"lawngreen": [124, 252, 0],
	"lemonchiffon": [255, 250, 205],
	"lightblue": [173, 216, 230],
	"lightcoral": [240, 128, 128],
	"lightcyan": [224, 255, 255],
	"lightgoldenrodyellow": [250, 250, 210],
	"lightgray": [211, 211, 211],
	"lightgreen": [144, 238, 144],
	"lightgrey": [211, 211, 211],
	"lightpink": [255, 182, 193],
	"lightsalmon": [255, 160, 122],
	"lightseagreen": [32, 178, 170],
	"lightskyblue": [135, 206, 250],
	"lightslategray": [119, 136, 153],
	"lightslategrey": [119, 136, 153],
	"lightsteelblue": [176, 196, 222],
	"lightyellow": [255, 255, 224],
	"lime": [0, 255, 0],
	"limegreen": [50, 205, 50],
	"linen": [250, 240, 230],
	"magenta": [255, 0, 255],
	"maroon": [128, 0, 0],
	"mediumaquamarine": [102, 205, 170],
	"mediumblue": [0, 0, 205],
	"mediumorchid": [186, 85, 211],
	"mediumpurple": [147, 112, 219],
	"mediumseagreen": [60, 179, 113],
	"mediumslateblue": [123, 104, 238],
	"mediumspringgreen": [0, 250, 154],
	"mediumturquoise": [72, 209, 204],
	"mediumvioletred": [199, 21, 133],
	"midnightblue": [25, 25, 112],
	"mintcream": [245, 255, 250],
	"mistyrose": [255, 228, 225],
	"moccasin": [255, 228, 181],
	"navajowhite": [255, 222, 173],
	"navy": [0, 0, 128],
	"oldlace": [253, 245, 230],
	"olive": [128, 128, 0],
	"olivedrab": [107, 142, 35],
	"orange": [255, 165, 0],
	"orangered": [255, 69, 0],
	"orchid": [218, 112, 214],
	"palegoldenrod": [238, 232, 170],
	"palegreen": [152, 251, 152],
	"paleturquoise": [175, 238, 238],
	"palevioletred": [219, 112, 147],
	"papayawhip": [255, 239, 213],
	"peachpuff": [255, 218, 185],
	"peru": [205, 133, 63],
	"pink": [255, 192, 203],
	"plum": [221, 160, 221],
	"powderblue": [176, 224, 230],
	"purple": [128, 0, 128],
	"rebeccapurple": [102, 51, 153],
	"red": [255, 0, 0],
	"rosybrown": [188, 143, 143],
	"royalblue": [65, 105, 225],
	"saddlebrown": [139, 69, 19],
	"salmon": [250, 128, 114],
	"sandybrown": [244, 164, 96],
	"seagreen": [46, 139, 87],
	"seashell": [255, 245, 238],
	"sienna": [160, 82, 45],
	"silver": [192, 192, 192],
	"skyblue": [135, 206, 235],
	"slateblue": [106, 90, 205],
	"slategray": [112, 128, 144],
	"slategrey": [112, 128, 144],
	"snow": [255, 250, 250],
	"springgreen": [0, 255, 127],
	"steelblue": [70, 130, 180],
	"tan": [210, 180, 140],
	"teal": [0, 128, 128],
	"thistle": [216, 191, 216],
	"tomato": [255, 99, 71],
	"turquoise": [64, 224, 208],
	"violet": [238, 130, 238],
	"wheat": [245, 222, 179],
	"white": [255, 255, 255],
	"whitesmoke": [245, 245, 245],
	"yellow": [255, 255, 0],
	"yellowgreen": [154, 205, 50]
};

},{}],13:[function(require,module,exports){
'use strict';

const EventEmitter = require('events');
const { setTimeout, clearTimeout } = require('timers');
const fetch = require('node-fetch');
const transports = require('./transports');
const { RPCCommands, RPCEvents, RelationshipTypes } = require('./constants');
const { pid: getPid, uuid } = require('./util');

function subKey(event, args) {
  return `${event}${JSON.stringify(args)}`;
}

/**
 * @typedef {RPCClientOptions}
 * @extends {ClientOptions}
 * @prop {string} transport RPC transport. one of `ipc` or `websocket`
 */

/**
 * The main hub for interacting with Discord RPC
 * @extends {BaseClient}
 */
class RPCClient extends EventEmitter {
  /**
   * @param {RPCClientOptions} [options] Options for the client.
   * You must provide a transport
   */
  constructor(options = {}) {
    super();

    this.options = options;

    this.accessToken = null;
    this.clientId = null;

    /**
     * Application used in this client
     * @type {?ClientApplication}
     */
    this.application = null;

    /**
     * User used in this application
     * @type {?User}
     */
    this.user = null;

    const Transport = transports[options.transport];
    if (!Transport) {
      throw new TypeError('RPC_INVALID_TRANSPORT', options.transport);
    }

    this.fetch = (method, path, { data, query } = {}) =>
      fetch(`${this.fetch.endpoint}${path}${query ? new URLSearchParams(query) : ''}`, {
        method,
        body: data,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }).then(async (r) => {
        const body = await r.json();
        if (!r.ok) {
          const e = new Error(r.status);
          e.body = body;
          throw e;
        }
        return body;
      });

    this.fetch.endpoint = 'https://discord.com/api';

    /**
     * Raw transport userd
     * @type {RPCTransport}
     * @private
     */
    this.transport = new Transport(this);
    this.transport.on('message', this._onRpcMessage.bind(this));

    /**
     * Map of nonces being expected from the transport
     * @type {Map}
     * @private
     */
    this._expecting = new Map();

    this._connectPromise = undefined;
  }

  /**
   * Search and connect to RPC
   */
  connect(clientId) {
    if (this._connectPromise) {
      return this._connectPromise;
    }
    this._connectPromise = new Promise((resolve, reject) => {
      this.clientId = clientId;
      const timeout = setTimeout(() => reject(new Error('RPC_CONNECTION_TIMEOUT')), 10e3);
      timeout.unref();
      this.once('connected', () => {
        clearTimeout(timeout);
        resolve(this);
      });
      this.transport.once('close', () => {
        this._expecting.forEach((e) => {
          e.reject(new Error('connection closed'));
        });
        this.emit('disconnected');
        reject(new Error('connection closed'));
      });
      this.transport.connect().catch(reject);
    });
    return this._connectPromise;
  }

  /**
   * @typedef {RPCLoginOptions}
   * @param {string} clientId Client ID
   * @param {string} [clientSecret] Client secret
   * @param {string} [accessToken] Access token
   * @param {string} [rpcToken] RPC token
   * @param {string} [tokenEndpoint] Token endpoint
   * @param {string[]} [scopes] Scopes to authorize with
   */

  /**
   * Performs authentication flow. Automatically calls Client#connect if needed.
   * @param {RPCLoginOptions} options Options for authentication.
   * At least one property must be provided to perform login.
   * @example client.login({ clientId: '1234567', clientSecret: 'abcdef123' });
   * @returns {Promise<RPCClient>}
   */
  async login(options = {}) {
    let { clientId, accessToken } = options;
    await this.connect(clientId);
    if (!options.scopes) {
      this.emit('ready');
      return this;
    }
    if (!accessToken) {
      accessToken = await this.authorize(options);
    }
    return this.authenticate(accessToken);
  }

  /**
   * Request
   * @param {string} cmd Command
   * @param {Object} [args={}] Arguments
   * @param {string} [evt] Event
   * @returns {Promise}
   * @private
   */
  request(cmd, args, evt) {
    return new Promise((resolve, reject) => {
      const nonce = uuid();
      this.transport.send({ cmd, args, evt, nonce });
      this._expecting.set(nonce, { resolve, reject });
    });
  }

  /**
   * Message handler
   * @param {Object} message message
   * @private
   */
  _onRpcMessage(message) {
    if (message.cmd === RPCCommands.DISPATCH && message.evt === RPCEvents.READY) {
      if (message.data.user) {
        this.user = message.data.user;
      }
      this.emit('connected');
    } else if (this._expecting.has(message.nonce)) {
      const { resolve, reject } = this._expecting.get(message.nonce);
      if (message.evt === 'ERROR') {
        const e = new Error(message.data.message);
        e.code = message.data.code;
        e.data = message.data;
        reject(e);
      } else {
        resolve(message.data);
      }
      this._expecting.delete(message.nonce);
    } else {
      this.emit(message.evt, message.data);
    }
  }

  /**
   * Authorize
   * @param {Object} options options
   * @returns {Promise}
   * @private
   */
  async authorize({ scopes, clientSecret, rpcToken, redirectUri, prompt } = {}) {
    if (clientSecret && rpcToken === true) {
      const body = await this.fetch('POST', '/oauth2/token/rpc', {
        data: new URLSearchParams({
          client_id: this.clientId,
          client_secret: clientSecret,
        }),
      });
      rpcToken = body.rpc_token;
    }

    const { code } = await this.request('AUTHORIZE', {
      scopes,
      client_id: this.clientId,
      prompt,
      rpc_token: rpcToken,
    });

    const response = await this.fetch('POST', '/oauth2/token', {
      data: new URLSearchParams({
        client_id: this.clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    return response.access_token;
  }

  /**
   * Authenticate
   * @param {string} accessToken access token
   * @returns {Promise}
   * @private
   */
  authenticate(accessToken) {
    return this.request('AUTHENTICATE', { access_token: accessToken })
      .then(({ application, user }) => {
        this.accessToken = accessToken;
        this.application = application;
        this.user = user;
        this.emit('ready');
        return this;
      });
  }


  /**
   * Fetch a guild
   * @param {Snowflake} id Guild ID
   * @param {number} [timeout] Timeout request
   * @returns {Promise<Guild>}
   */
  getGuild(id, timeout) {
    return this.request(RPCCommands.GET_GUILD, { guild_id: id, timeout });
  }

  /**
   * Fetch all guilds
   * @param {number} [timeout] Timeout request
   * @returns {Promise<Collection<Snowflake, Guild>>}
   */
  getGuilds(timeout) {
    return this.request(RPCCommands.GET_GUILDS, { timeout });
  }

  /**
   * Get a channel
   * @param {Snowflake} id Channel ID
   * @param {number} [timeout] Timeout request
   * @returns {Promise<Channel>}
   */
  getChannel(id, timeout) {
    return this.request(RPCCommands.GET_CHANNEL, { channel_id: id, timeout });
  }

  /**
   * Get all channels
   * @param {Snowflake} [id] Guild ID
   * @param {number} [timeout] Timeout request
   * @returns {Promise<Collection<Snowflake, Channel>>}
   */
  async getChannels(id, timeout) {
    const { channels } = await this.request(RPCCommands.GET_CHANNELS, {
      timeout,
      guild_id: id,
    });
    return channels;
  }

  /**
   * @typedef {CertifiedDevice}
   * @prop {string} type One of `AUDIO_INPUT`, `AUDIO_OUTPUT`, `VIDEO_INPUT`
   * @prop {string} uuid This device's Windows UUID
   * @prop {object} vendor Vendor information
   * @prop {string} vendor.name Vendor's name
   * @prop {string} vendor.url Vendor's url
   * @prop {object} model Model information
   * @prop {string} model.name Model's name
   * @prop {string} model.url Model's url
   * @prop {string[]} related Array of related product's Windows UUIDs
   * @prop {boolean} echoCancellation If the device has echo cancellation
   * @prop {boolean} noiseSuppression If the device has noise suppression
   * @prop {boolean} automaticGainControl If the device has automatic gain control
   * @prop {boolean} hardwareMute If the device has a hardware mute
   */

  /**
   * Tell discord which devices are certified
   * @param {CertifiedDevice[]} devices Certified devices to send to discord
   * @returns {Promise}
   */
  setCertifiedDevices(devices) {
    return this.request(RPCCommands.SET_CERTIFIED_DEVICES, {
      devices: devices.map((d) => ({
        type: d.type,
        id: d.uuid,
        vendor: d.vendor,
        model: d.model,
        related: d.related,
        echo_cancellation: d.echoCancellation,
        noise_suppression: d.noiseSuppression,
        automatic_gain_control: d.automaticGainControl,
        hardware_mute: d.hardwareMute,
      })),
    });
  }

  /**
   * @typedef {UserVoiceSettings}
   * @prop {Snowflake} id ID of the user these settings apply to
   * @prop {?Object} [pan] Pan settings, an object with `left` and `right` set between
   * 0.0 and 1.0, inclusive
   * @prop {?number} [volume=100] The volume
   * @prop {bool} [mute] If the user is muted
   */

  /**
   * Set the voice settings for a user, by id
   * @param {Snowflake} id ID of the user to set
   * @param {UserVoiceSettings} settings Settings
   * @returns {Promise}
   */
  setUserVoiceSettings(id, settings) {
    return this.request(RPCCommands.SET_USER_VOICE_SETTINGS, {
      user_id: id,
      pan: settings.pan,
      mute: settings.mute,
      volume: settings.volume,
    });
  }

  /**
   * Move the user to a voice channel
   * @param {Snowflake} id ID of the voice channel
   * @param {Object} [options] Options
   * @param {number} [options.timeout] Timeout for the command
   * @param {boolean} [options.force] Force this move. This should only be done if you
   * have explicit permission from the user.
   * @returns {Promise}
   */
  selectVoiceChannel(id, { timeout, force = false } = {}) {
    return this.request(RPCCommands.SELECT_VOICE_CHANNEL, { channel_id: id, timeout, force });
  }

  /**
   * Move the user to a text channel
   * @param {Snowflake} id ID of the voice channel
   * @param {Object} [options] Options
   * @param {number} [options.timeout] Timeout for the command
   * have explicit permission from the user.
   * @returns {Promise}
   */
  selectTextChannel(id, { timeout } = {}) {
    return this.request(RPCCommands.SELECT_TEXT_CHANNEL, { channel_id: id, timeout });
  }

  /**
   * Get current voice settings
   * @returns {Promise}
   */
  getVoiceSettings() {
    return this.request(RPCCommands.GET_VOICE_SETTINGS)
      .then((s) => ({
        automaticGainControl: s.automatic_gain_control,
        echoCancellation: s.echo_cancellation,
        noiseSuppression: s.noise_suppression,
        qos: s.qos,
        silenceWarning: s.silence_warning,
        deaf: s.deaf,
        mute: s.mute,
        input: {
          availableDevices: s.input.available_devices,
          device: s.input.device_id,
          volume: s.input.volume,
        },
        output: {
          availableDevices: s.output.available_devices,
          device: s.output.device_id,
          volume: s.output.volume,
        },
        mode: {
          type: s.mode.type,
          autoThreshold: s.mode.auto_threshold,
          threshold: s.mode.threshold,
          shortcut: s.mode.shortcut,
          delay: s.mode.delay,
        },
      }));
  }

  /**
   * Set current voice settings, overriding the current settings until this session disconnects.
   * This also locks the settings for any other rpc sessions which may be connected.
   * @param {Object} args Settings
   * @returns {Promise}
   */
  setVoiceSettings(args) {
    return this.request(RPCCommands.SET_VOICE_SETTINGS, {
      automatic_gain_control: args.automaticGainControl,
      echo_cancellation: args.echoCancellation,
      noise_suppression: args.noiseSuppression,
      qos: args.qos,
      silence_warning: args.silenceWarning,
      deaf: args.deaf,
      mute: args.mute,
      input: args.input ? {
        device_id: args.input.device,
        volume: args.input.volume,
      } : undefined,
      output: args.output ? {
        device_id: args.output.device,
        volume: args.output.volume,
      } : undefined,
      mode: args.mode ? {
        type: args.mode.type,
        auto_threshold: args.mode.autoThreshold,
        threshold: args.mode.threshold,
        shortcut: args.mode.shortcut,
        delay: args.mode.delay,
      } : undefined,
    });
  }

  /**
   * Capture a shortcut using the client
   * The callback takes (key, stop) where `stop` is a function that will stop capturing.
   * This `stop` function must be called before disconnecting or else the user will have
   * to restart their client.
   * @param {Function} callback Callback handling keys
   * @returns {Promise<Function>}
   */
  captureShortcut(callback) {
    const subid = subKey(RPCEvents.CAPTURE_SHORTCUT_CHANGE);
    const stop = () => {
      this._subscriptions.delete(subid);
      return this.request(RPCCommands.CAPTURE_SHORTCUT, { action: 'STOP' });
    };
    this._subscriptions.set(subid, ({ shortcut }) => {
      callback(shortcut, stop);
    });
    return this.request(RPCCommands.CAPTURE_SHORTCUT, { action: 'START' })
      .then(() => stop);
  }

  /**
   * Sets the presence for the logged in user.
   * @param {object} args The rich presence to pass.
   * @param {number} [pid] The application's process ID. Defaults to the executing process' PID.
   * @returns {Promise}
   */
  setActivity(args = {}, pid = getPid()) {
    let timestamps;
    let assets;
    let party;
    let secrets;
    if (args.startTimestamp || args.endTimestamp) {
      timestamps = {
        start: args.startTimestamp,
        end: args.endTimestamp,
      };
      if (timestamps.start instanceof Date) {
        timestamps.start = Math.round(timestamps.start.getTime());
      }
      if (timestamps.end instanceof Date) {
        timestamps.end = Math.round(timestamps.end.getTime());
      }
      if (timestamps.start > 2147483647000) {
        throw new RangeError('timestamps.start must fit into a unix timestamp');
      }
      if (timestamps.end > 2147483647000) {
        throw new RangeError('timestamps.end must fit into a unix timestamp');
      }
    }
    if (
      args.largeImageKey || args.largeImageText
      || args.smallImageKey || args.smallImageText
    ) {
      assets = {
        large_image: args.largeImageKey,
        large_text: args.largeImageText,
        small_image: args.smallImageKey,
        small_text: args.smallImageText,
      };
    }
    if (args.partySize || args.partyId || args.partyMax) {
      party = { id: args.partyId };
      if (args.partySize || args.partyMax) {
        party.size = [args.partySize, args.partyMax];
      }
    }
    if (args.matchSecret || args.joinSecret || args.spectateSecret) {
      secrets = {
        match: args.matchSecret,
        join: args.joinSecret,
        spectate: args.spectateSecret,
      };
    }

    return this.request(RPCCommands.SET_ACTIVITY, {
      pid,
      activity: {
        state: args.state,
        details: args.details,
        timestamps,
        assets,
        party,
        secrets,
        buttons: args.buttons,
        instance: !!args.instance,
      },
    });
  }

  /**
   * Clears the currently set presence, if any. This will hide the "Playing X" message
   * displayed below the user's name.
   * @param {number} [pid] The application's process ID. Defaults to the executing process' PID.
   * @returns {Promise}
   */
  clearActivity(pid = getPid()) {
    return this.request(RPCCommands.SET_ACTIVITY, {
      pid,
    });
  }

  /**
   * Invite a user to join the game the RPC user is currently playing
   * @param {User} user The user to invite
   * @returns {Promise}
   */
  sendJoinInvite(user) {
    return this.request(RPCCommands.SEND_ACTIVITY_JOIN_INVITE, {
      user_id: user.id || user,
    });
  }

  /**
   * Request to join the game the user is playing
   * @param {User} user The user whose game you want to request to join
   * @returns {Promise}
   */
  sendJoinRequest(user) {
    return this.request(RPCCommands.SEND_ACTIVITY_JOIN_REQUEST, {
      user_id: user.id || user,
    });
  }

  /**
   * Reject a join request from a user
   * @param {User} user The user whose request you wish to reject
   * @returns {Promise}
   */
  closeJoinRequest(user) {
    return this.request(RPCCommands.CLOSE_ACTIVITY_JOIN_REQUEST, {
      user_id: user.id || user,
    });
  }

  createLobby(type, capacity, metadata) {
    return this.request(RPCCommands.CREATE_LOBBY, {
      type,
      capacity,
      metadata,
    });
  }

  updateLobby(lobby, { type, owner, capacity, metadata } = {}) {
    return this.request(RPCCommands.UPDATE_LOBBY, {
      id: lobby.id || lobby,
      type,
      owner_id: (owner && owner.id) || owner,
      capacity,
      metadata,
    });
  }

  deleteLobby(lobby) {
    return this.request(RPCCommands.DELETE_LOBBY, {
      id: lobby.id || lobby,
    });
  }

  connectToLobby(id, secret) {
    return this.request(RPCCommands.CONNECT_TO_LOBBY, {
      id,
      secret,
    });
  }

  sendToLobby(lobby, data) {
    return this.request(RPCCommands.SEND_TO_LOBBY, {
      id: lobby.id || lobby,
      data,
    });
  }

  disconnectFromLobby(lobby) {
    return this.request(RPCCommands.DISCONNECT_FROM_LOBBY, {
      id: lobby.id || lobby,
    });
  }

  updateLobbyMember(lobby, user, metadata) {
    return this.request(RPCCommands.UPDATE_LOBBY_MEMBER, {
      lobby_id: lobby.id || lobby,
      user_id: user.id || user,
      metadata,
    });
  }

  getRelationships() {
    const types = Object.keys(RelationshipTypes);
    return this.request(RPCCommands.GET_RELATIONSHIPS)
      .then((o) => o.relationships.map((r) => ({
        ...r,
        type: types[r.type],
      })));
  }

  /**
   * Subscribe to an event
   * @param {string} event Name of event e.g. `MESSAGE_CREATE`
   * @param {Object} [args] Args for event e.g. `{ channel_id: '1234' }`
   * @returns {Promise<Object>}
   */
  async subscribe(event, args) {
    await this.request(RPCCommands.SUBSCRIBE, args, event);
    return {
      unsubscribe: () => this.request(RPCCommands.UNSUBSCRIBE, args, event),
    };
  }

  /**
   * Destroy the client
   */
  async destroy() {
    await this.transport.close();
  }
}

module.exports = RPCClient;

},{"./constants":14,"./transports":16,"./util":19,"events":undefined,"node-fetch":45,"timers":undefined}],14:[function(require,module,exports){
'use strict';

function keyMirror(arr) {
  const tmp = {};
  for (const value of arr) {
    tmp[value] = value;
  }
  return tmp;
}


exports.browser = typeof window !== 'undefined';

exports.RPCCommands = keyMirror([
  'DISPATCH',
  'AUTHORIZE',
  'AUTHENTICATE',
  'GET_GUILD',
  'GET_GUILDS',
  'GET_CHANNEL',
  'GET_CHANNELS',
  'CREATE_CHANNEL_INVITE',
  'GET_RELATIONSHIPS',
  'GET_USER',
  'SUBSCRIBE',
  'UNSUBSCRIBE',
  'SET_USER_VOICE_SETTINGS',
  'SET_USER_VOICE_SETTINGS_2',
  'SELECT_VOICE_CHANNEL',
  'GET_SELECTED_VOICE_CHANNEL',
  'SELECT_TEXT_CHANNEL',
  'GET_VOICE_SETTINGS',
  'SET_VOICE_SETTINGS_2',
  'SET_VOICE_SETTINGS',
  'CAPTURE_SHORTCUT',
  'SET_ACTIVITY',
  'SEND_ACTIVITY_JOIN_INVITE',
  'CLOSE_ACTIVITY_JOIN_REQUEST',
  'ACTIVITY_INVITE_USER',
  'ACCEPT_ACTIVITY_INVITE',
  'INVITE_BROWSER',
  'DEEP_LINK',
  'CONNECTIONS_CALLBACK',
  'BRAINTREE_POPUP_BRIDGE_CALLBACK',
  'GIFT_CODE_BROWSER',
  'GUILD_TEMPLATE_BROWSER',
  'OVERLAY',
  'BROWSER_HANDOFF',
  'SET_CERTIFIED_DEVICES',
  'GET_IMAGE',
  'CREATE_LOBBY',
  'UPDATE_LOBBY',
  'DELETE_LOBBY',
  'UPDATE_LOBBY_MEMBER',
  'CONNECT_TO_LOBBY',
  'DISCONNECT_FROM_LOBBY',
  'SEND_TO_LOBBY',
  'SEARCH_LOBBIES',
  'CONNECT_TO_LOBBY_VOICE',
  'DISCONNECT_FROM_LOBBY_VOICE',
  'SET_OVERLAY_LOCKED',
  'OPEN_OVERLAY_ACTIVITY_INVITE',
  'OPEN_OVERLAY_GUILD_INVITE',
  'OPEN_OVERLAY_VOICE_SETTINGS',
  'VALIDATE_APPLICATION',
  'GET_ENTITLEMENT_TICKET',
  'GET_APPLICATION_TICKET',
  'START_PURCHASE',
  'GET_SKUS',
  'GET_ENTITLEMENTS',
  'GET_NETWORKING_CONFIG',
  'NETWORKING_SYSTEM_METRICS',
  'NETWORKING_PEER_METRICS',
  'NETWORKING_CREATE_TOKEN',
  'SET_USER_ACHIEVEMENT',
  'GET_USER_ACHIEVEMENTS',
]);

exports.RPCEvents = keyMirror([
  'CURRENT_USER_UPDATE',
  'GUILD_STATUS',
  'GUILD_CREATE',
  'CHANNEL_CREATE',
  'RELATIONSHIP_UPDATE',
  'VOICE_CHANNEL_SELECT',
  'VOICE_STATE_CREATE',
  'VOICE_STATE_DELETE',
  'VOICE_STATE_UPDATE',
  'VOICE_SETTINGS_UPDATE',
  'VOICE_SETTINGS_UPDATE_2',
  'VOICE_CONNECTION_STATUS',
  'SPEAKING_START',
  'SPEAKING_STOP',
  'GAME_JOIN',
  'GAME_SPECTATE',
  'ACTIVITY_JOIN',
  'ACTIVITY_JOIN_REQUEST',
  'ACTIVITY_SPECTATE',
  'ACTIVITY_INVITE',
  'NOTIFICATION_CREATE',
  'MESSAGE_CREATE',
  'MESSAGE_UPDATE',
  'MESSAGE_DELETE',
  'LOBBY_DELETE',
  'LOBBY_UPDATE',
  'LOBBY_MEMBER_CONNECT',
  'LOBBY_MEMBER_DISCONNECT',
  'LOBBY_MEMBER_UPDATE',
  'LOBBY_MESSAGE',
  'CAPTURE_SHORTCUT_CHANGE',
  'OVERLAY',
  'OVERLAY_UPDATE',
  'ENTITLEMENT_CREATE',
  'ENTITLEMENT_DELETE',
  'USER_ACHIEVEMENT_UPDATE',
  'READY',
  'ERROR',
]);

exports.RPCErrors = {
  CAPTURE_SHORTCUT_ALREADY_LISTENING: 5004,
  GET_GUILD_TIMED_OUT: 5002,
  INVALID_ACTIVITY_JOIN_REQUEST: 4012,
  INVALID_ACTIVITY_SECRET: 5005,
  INVALID_CHANNEL: 4005,
  INVALID_CLIENTID: 4007,
  INVALID_COMMAND: 4002,
  INVALID_ENTITLEMENT: 4015,
  INVALID_EVENT: 4004,
  INVALID_GIFT_CODE: 4016,
  INVALID_GUILD: 4003,
  INVALID_INVITE: 4011,
  INVALID_LOBBY: 4013,
  INVALID_LOBBY_SECRET: 4014,
  INVALID_ORIGIN: 4008,
  INVALID_PAYLOAD: 4000,
  INVALID_PERMISSIONS: 4006,
  INVALID_TOKEN: 4009,
  INVALID_USER: 4010,
  LOBBY_FULL: 5007,
  NO_ELIGIBLE_ACTIVITY: 5006,
  OAUTH2_ERROR: 5000,
  PURCHASE_CANCELED: 5008,
  PURCHASE_ERROR: 5009,
  RATE_LIMITED: 5011,
  SELECT_CHANNEL_TIMED_OUT: 5001,
  SELECT_VOICE_FORCE_REQUIRED: 5003,
  SERVICE_UNAVAILABLE: 1001,
  TRANSACTION_ABORTED: 1002,
  UNAUTHORIZED_FOR_ACHIEVEMENT: 5010,
  UNKNOWN_ERROR: 1000,
};

exports.RPCCloseCodes = {
  CLOSE_NORMAL: 1000,
  CLOSE_UNSUPPORTED: 1003,
  CLOSE_ABNORMAL: 1006,
  INVALID_CLIENTID: 4000,
  INVALID_ORIGIN: 4001,
  RATELIMITED: 4002,
  TOKEN_REVOKED: 4003,
  INVALID_VERSION: 4004,
  INVALID_ENCODING: 4005,
};

exports.LobbyTypes = {
  PRIVATE: 1,
  PUBLIC: 2,
};

exports.RelationshipTypes = {
  NONE: 0,
  FRIEND: 1,
  BLOCKED: 2,
  PENDING_INCOMING: 3,
  PENDING_OUTGOING: 4,
  IMPLICIT: 5,
};

},{}],15:[function(require,module,exports){
'use strict';

const util = require('./util');

module.exports = {
  Client: require('./client'),
  register(id) {
    return util.register(`discord-${id}`);
  },
};

},{"./client":13,"./util":19}],16:[function(require,module,exports){
'use strict';

module.exports = {
  ipc: require('./ipc'),
  websocket: require('./websocket'),
};

},{"./ipc":17,"./websocket":18}],17:[function(require,module,exports){
'use strict';

const net = require('net');
const EventEmitter = require('events');
const fetch = require('node-fetch');
const { uuid } = require('../util');

const OPCodes = {
  HANDSHAKE: 0,
  FRAME: 1,
  CLOSE: 2,
  PING: 3,
  PONG: 4,
};

function getIPCPath(id) {
  if (process.platform === 'win32') {
    return `\\\\?\\pipe\\discord-ipc-${id}`;
  }
  const { env: { XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP } } = process;
  const prefix = XDG_RUNTIME_DIR || TMPDIR || TMP || TEMP || '/tmp';
  return `${prefix.replace(/\/$/, '')}/discord-ipc-${id}`;
}

function getIPC(id = 0) {
  return new Promise((resolve, reject) => {
    const path = getIPCPath(id);
    const onerror = () => {
      if (id < 10) {
        resolve(getIPC(id + 1));
      } else {
        reject(new Error('Could not connect'));
      }
    };
    const sock = net.createConnection(path, () => {
      sock.removeListener('error', onerror);
      resolve(sock);
    });
    sock.once('error', onerror);
  });
}

async function findEndpoint(tries = 0) {
  if (tries > 30) {
    throw new Error('Could not find endpoint');
  }
  const endpoint = `http://127.0.0.1:${6463 + (tries % 10)}`;
  try {
    const r = await fetch(endpoint);
    if (r.status === 404) {
      return endpoint;
    }
    return findEndpoint(tries + 1);
  } catch (e) {
    return findEndpoint(tries + 1);
  }
}

function encode(op, data) {
  data = JSON.stringify(data);
  const len = Buffer.byteLength(data);
  const packet = Buffer.alloc(8 + len);
  packet.writeInt32LE(op, 0);
  packet.writeInt32LE(len, 4);
  packet.write(data, 8, len);
  return packet;
}

const working = {
  full: '',
  op: undefined,
};

function decode(socket, callback) {
  const packet = socket.read();
  if (!packet) {
    return;
  }

  let { op } = working;
  let raw;
  if (working.full === '') {
    op = working.op = packet.readInt32LE(0);
    const len = packet.readInt32LE(4);
    raw = packet.slice(8, len + 8);
  } else {
    raw = packet.toString();
  }

  try {
    const data = JSON.parse(working.full + raw);
    callback({ op, data }); // eslint-disable-line callback-return
    working.full = '';
    working.op = undefined;
  } catch (err) {
    working.full += raw;
  }

  decode(socket, callback);
}

class IPCTransport extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.socket = null;
  }

  async connect() {
    const socket = this.socket = await getIPC();
    socket.on('close', this.onClose.bind(this));
    socket.on('error', this.onClose.bind(this));
    this.emit('open');
    socket.write(encode(OPCodes.HANDSHAKE, {
      v: 1,
      client_id: this.client.clientId,
    }));
    socket.pause();
    socket.on('readable', () => {
      decode(socket, ({ op, data }) => {
        switch (op) {
          case OPCodes.PING:
            this.send(data, OPCodes.PONG);
            break;
          case OPCodes.FRAME:
            if (!data) {
              return;
            }
            if (data.cmd === 'AUTHORIZE' && data.evt !== 'ERROR') {
              findEndpoint()
                .then((endpoint) => {
                  this.client.request.endpoint = endpoint;
                })
                .catch((e) => {
                  this.client.emit('error', e);
                });
            }
            this.emit('message', data);
            break;
          case OPCodes.CLOSE:
            this.emit('close', data);
            break;
          default:
            break;
        }
      });
    });
  }

  onClose(e) {
    this.emit('close', e);
  }

  send(data, op = OPCodes.FRAME) {
    this.socket.write(encode(op, data));
  }

  async close() {
    return new Promise((r) => {
      this.once('close', r);
      this.send({}, OPCodes.CLOSE);
      this.socket.end();
    });
  }

  ping() {
    this.send(uuid(), OPCodes.PING);
  }
}

module.exports = IPCTransport;
module.exports.encode = encode;
module.exports.decode = decode;

},{"../util":19,"events":undefined,"net":undefined,"node-fetch":45}],18:[function(require,module,exports){
'use strict';

const EventEmitter = require('events');
const { browser } = require('../constants');

// eslint-disable-next-line
const WebSocket = browser ? window.WebSocket : require('ws');

const pack = (d) => JSON.stringify(d);
const unpack = (s) => JSON.parse(s);

class WebSocketTransport extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.ws = null;
    this.tries = 0;
  }

  async connect() {
    const port = 6463 + (this.tries % 10);
    this.tries += 1;

    this.ws = new WebSocket(
      `ws://127.0.0.1:${port}/?v=1&client_id=${this.client.clientId}`,
      browser ? undefined : { origin: this.client.options.origin },
    );
    this.ws.onopen = this.onOpen.bind(this);
    this.ws.onclose = this.onClose.bind(this);
    this.ws.onerror = this.onError.bind(this);
    this.ws.onmessage = this.onMessage.bind(this);
  }

  onOpen() {
    this.emit('open');
  }

  onClose(event) {
    if (!event.wasClean) {
      return;
    }
    this.emit('close', event);
  }

  onError(event) {
    try {
      this.ws.close();
    } catch {} // eslint-disable-line no-empty

    if (this.tries > 20) {
      this.emit('error', event.error);
    } else {
      setTimeout(() => {
        this.connect();
      }, 250);
    }
  }

  onMessage(event) {
    this.emit('message', unpack(event.data));
  }

  send(data) {
    this.ws.send(pack(data));
  }

  ping() {} // eslint-disable-line no-empty-function

  close() {
    return new Promise((r) => {
      this.once('close', r);
      this.ws.close();
    });
  }
}

module.exports = WebSocketTransport;

},{"../constants":14,"events":undefined,"ws":72}],19:[function(require,module,exports){
'use strict';

let register;
try {
  const { app } = require('electron');
  register = app.setAsDefaultProtocolClient.bind(app);
} catch (err) {
  try {
    register = require('register-scheme');
  } catch (e) {} // eslint-disable-line no-empty
}

if (typeof register !== 'function') {
  register = () => false;
}

function pid() {
  if (typeof process !== 'undefined') {
    return process.pid;
  }
  return null;
}

const uuid4122 = () => {
  let uuid = '';
  for (let i = 0; i < 32; i += 1) {
    if (i === 8 || i === 12 || i === 16 || i === 20) {
      uuid += '-';
    }
    let n;
    if (i === 12) {
      n = 4;
    } else {
      const random = Math.random() * 16 | 0;
      if (i === 16) {
        n = (random & 3) | 0;
      } else {
        n = random;
      }
    }
    uuid += n.toString(16);
  }
  return uuid;
};

module.exports = {
  pid,
  register,
  uuid: uuid4122,
};

},{"electron":20,"register-scheme":48}],20:[function(require,module,exports){
(function (__dirname){(function (){
const fs = require('fs');
const path = require('path');

const pathFile = path.join(__dirname, 'path.txt');

function getElectronPath () {
  let executablePath;
  if (fs.existsSync(pathFile)) {
    executablePath = fs.readFileSync(pathFile, 'utf-8');
  }
  if (process.env.ELECTRON_OVERRIDE_DIST_PATH) {
    return path.join(process.env.ELECTRON_OVERRIDE_DIST_PATH, executablePath || 'electron');
  }
  if (executablePath) {
    return path.join(__dirname, 'dist', executablePath);
  } else {
    throw new Error('Electron failed to install correctly, please delete node_modules/electron and try installing again');
  }
}

module.exports = getElectronPath();

}).call(this)}).call(this,require("path").join(__dirname,"node_modules","electron"))
},{"fs":undefined,"path":undefined}],21:[function(require,module,exports){
'use strict';

var iconvLite = require('iconv-lite');

// Expose to the world
module.exports.convert = convert;

/**
 * Convert encoding of an UTF-8 string or a buffer
 *
 * @param {String|Buffer} str String to be converted
 * @param {String} to Encoding to be converted to
 * @param {String} [from='UTF-8'] Encoding to be converted from
 * @return {Buffer} Encoded string
 */
function convert(str, to, from) {
    from = checkEncoding(from || 'UTF-8');
    to = checkEncoding(to || 'UTF-8');
    str = str || '';

    var result;

    if (from !== 'UTF-8' && typeof str === 'string') {
        str = Buffer.from(str, 'binary');
    }

    if (from === to) {
        if (typeof str === 'string') {
            result = Buffer.from(str);
        } else {
            result = str;
        }
    } else {
        try {
            result = convertIconvLite(str, to, from);
        } catch (E) {
            console.error(E);
            result = str;
        }
    }

    if (typeof result === 'string') {
        result = Buffer.from(result, 'utf-8');
    }

    return result;
}

/**
 * Convert encoding of astring with iconv-lite
 *
 * @param {String|Buffer} str String to be converted
 * @param {String} to Encoding to be converted to
 * @param {String} [from='UTF-8'] Encoding to be converted from
 * @return {Buffer} Encoded string
 */
function convertIconvLite(str, to, from) {
    if (to === 'UTF-8') {
        return iconvLite.decode(str, from);
    } else if (from === 'UTF-8') {
        return iconvLite.encode(str, to);
    } else {
        return iconvLite.encode(iconvLite.decode(str, from), to);
    }
}

/**
 * Converts charset name if needed
 *
 * @param {String} name Character set
 * @return {String} Character set name
 */
function checkEncoding(name) {
    return (name || '')
        .toString()
        .trim()
        .replace(/^latin[\-_]?(\d+)$/i, 'ISO-8859-$1')
        .replace(/^win(?:dows)?[\-_]?(\d+)$/i, 'WINDOWS-$1')
        .replace(/^utf[\-_]?(\d+)$/i, 'UTF-$1')
        .replace(/^ks_c_5601\-1987$/i, 'CP949')
        .replace(/^us[\-_]?ascii$/i, 'ASCII')
        .toUpperCase();
}

},{"iconv-lite":43}],22:[function(require,module,exports){

/**
 * Module dependencies.
 */

var sep = require('path').sep || '/';

/**
 * Module exports.
 */

module.exports = fileUriToPath;

/**
 * File URI to Path function.
 *
 * @param {String} uri
 * @return {String} path
 * @api public
 */

function fileUriToPath (uri) {
  if ('string' != typeof uri ||
      uri.length <= 7 ||
      'file://' != uri.substring(0, 7)) {
    throw new TypeError('must pass in a file:// URI to convert to a file path');
  }

  var rest = decodeURI(uri.substring(7));
  var firstSlash = rest.indexOf('/');
  var host = rest.substring(0, firstSlash);
  var path = rest.substring(firstSlash + 1);

  // 2.  Scheme Definition
  // As a special case, <host> can be the string "localhost" or the empty
  // string; this is interpreted as "the machine from which the URL is
  // being interpreted".
  if ('localhost' == host) host = '';

  if (host) {
    host = sep + sep + host;
  }

  // 3.2  Drives, drive letters, mount points, file system root
  // Drive letters are mapped into the top of a file URI in various ways,
  // depending on the implementation; some applications substitute
  // vertical bar ("|") for the colon after the drive letter, yielding
  // "file:///c|/tmp/test.txt".  In some cases, the colon is left
  // unchanged, as in "file:///c:/tmp/test.txt".  In other cases, the
  // colon is simply omitted, as in "file:///c/tmp/test.txt".
  path = path.replace(/^(.+)\|/, '$1:');

  // for Windows, we need to invert the path separators from what a URI uses
  if (sep == '\\') {
    path = path.replace(/\//g, '\\');
  }

  if (/^.+\:/.test(path)) {
    // has Windows drive at beginning of path
  } else {
    // unix path…
    path = sep + path;
  }

  return host + path;
}

},{"path":undefined}],23:[function(require,module,exports){
'use strict';

module.exports = (flag, argv = process.argv) => {
	const prefix = flag.startsWith('-') ? '' : (flag.length === 1 ? '-' : '--');
	const position = argv.indexOf(prefix + flag);
	const terminatorPosition = argv.indexOf('--');
	return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
};

},{}],24:[function(require,module,exports){
"use strict";
var Buffer = require("safer-buffer").Buffer;

// Multibyte codec. In this scheme, a character is represented by 1 or more bytes.
// Our codec supports UTF-16 surrogates, extensions for GB18030 and unicode sequences.
// To save memory and loading time, we read table files only when requested.

exports._dbcs = DBCSCodec;

var UNASSIGNED = -1,
    GB18030_CODE = -2,
    SEQ_START  = -10,
    NODE_START = -1000,
    UNASSIGNED_NODE = new Array(0x100),
    DEF_CHAR = -1;

for (var i = 0; i < 0x100; i++)
    UNASSIGNED_NODE[i] = UNASSIGNED;


// Class DBCSCodec reads and initializes mapping tables.
function DBCSCodec(codecOptions, iconv) {
    this.encodingName = codecOptions.encodingName;
    if (!codecOptions)
        throw new Error("DBCS codec is called without the data.")
    if (!codecOptions.table)
        throw new Error("Encoding '" + this.encodingName + "' has no data.");

    // Load tables.
    var mappingTable = codecOptions.table();


    // Decode tables: MBCS -> Unicode.

    // decodeTables is a trie, encoded as an array of arrays of integers. Internal arrays are trie nodes and all have len = 256.
    // Trie root is decodeTables[0].
    // Values: >=  0 -> unicode character code. can be > 0xFFFF
    //         == UNASSIGNED -> unknown/unassigned sequence.
    //         == GB18030_CODE -> this is the end of a GB18030 4-byte sequence.
    //         <= NODE_START -> index of the next node in our trie to process next byte.
    //         <= SEQ_START  -> index of the start of a character code sequence, in decodeTableSeq.
    this.decodeTables = [];
    this.decodeTables[0] = UNASSIGNED_NODE.slice(0); // Create root node.

    // Sometimes a MBCS char corresponds to a sequence of unicode chars. We store them as arrays of integers here. 
    this.decodeTableSeq = [];

    // Actual mapping tables consist of chunks. Use them to fill up decode tables.
    for (var i = 0; i < mappingTable.length; i++)
        this._addDecodeChunk(mappingTable[i]);

    // Load & create GB18030 tables when needed.
    if (typeof codecOptions.gb18030 === 'function') {
        this.gb18030 = codecOptions.gb18030(); // Load GB18030 ranges.

        // Add GB18030 common decode nodes.
        var commonThirdByteNodeIdx = this.decodeTables.length;
        this.decodeTables.push(UNASSIGNED_NODE.slice(0));

        var commonFourthByteNodeIdx = this.decodeTables.length;
        this.decodeTables.push(UNASSIGNED_NODE.slice(0));

        // Fill out the tree
        var firstByteNode = this.decodeTables[0];
        for (var i = 0x81; i <= 0xFE; i++) {
            var secondByteNode = this.decodeTables[NODE_START - firstByteNode[i]];
            for (var j = 0x30; j <= 0x39; j++) {
                if (secondByteNode[j] === UNASSIGNED) {
                    secondByteNode[j] = NODE_START - commonThirdByteNodeIdx;
                } else if (secondByteNode[j] > NODE_START) {
                    throw new Error("gb18030 decode tables conflict at byte 2");
                }

                var thirdByteNode = this.decodeTables[NODE_START - secondByteNode[j]];
                for (var k = 0x81; k <= 0xFE; k++) {
                    if (thirdByteNode[k] === UNASSIGNED) {
                        thirdByteNode[k] = NODE_START - commonFourthByteNodeIdx;
                    } else if (thirdByteNode[k] === NODE_START - commonFourthByteNodeIdx) {
                        continue;
                    } else if (thirdByteNode[k] > NODE_START) {
                        throw new Error("gb18030 decode tables conflict at byte 3");
                    }

                    var fourthByteNode = this.decodeTables[NODE_START - thirdByteNode[k]];
                    for (var l = 0x30; l <= 0x39; l++) {
                        if (fourthByteNode[l] === UNASSIGNED)
                            fourthByteNode[l] = GB18030_CODE;
                    }
                }
            }
        }
    }

    this.defaultCharUnicode = iconv.defaultCharUnicode;

    
    // Encode tables: Unicode -> DBCS.

    // `encodeTable` is array mapping from unicode char to encoded char. All its values are integers for performance.
    // Because it can be sparse, it is represented as array of buckets by 256 chars each. Bucket can be null.
    // Values: >=  0 -> it is a normal char. Write the value (if <=256 then 1 byte, if <=65536 then 2 bytes, etc.).
    //         == UNASSIGNED -> no conversion found. Output a default char.
    //         <= SEQ_START  -> it's an index in encodeTableSeq, see below. The character starts a sequence.
    this.encodeTable = [];
    
    // `encodeTableSeq` is used when a sequence of unicode characters is encoded as a single code. We use a tree of
    // objects where keys correspond to characters in sequence and leafs are the encoded dbcs values. A special DEF_CHAR key
    // means end of sequence (needed when one sequence is a strict subsequence of another).
    // Objects are kept separately from encodeTable to increase performance.
    this.encodeTableSeq = [];

    // Some chars can be decoded, but need not be encoded.
    var skipEncodeChars = {};
    if (codecOptions.encodeSkipVals)
        for (var i = 0; i < codecOptions.encodeSkipVals.length; i++) {
            var val = codecOptions.encodeSkipVals[i];
            if (typeof val === 'number')
                skipEncodeChars[val] = true;
            else
                for (var j = val.from; j <= val.to; j++)
                    skipEncodeChars[j] = true;
        }
        
    // Use decode trie to recursively fill out encode tables.
    this._fillEncodeTable(0, 0, skipEncodeChars);

    // Add more encoding pairs when needed.
    if (codecOptions.encodeAdd) {
        for (var uChar in codecOptions.encodeAdd)
            if (Object.prototype.hasOwnProperty.call(codecOptions.encodeAdd, uChar))
                this._setEncodeChar(uChar.charCodeAt(0), codecOptions.encodeAdd[uChar]);
    }

    this.defCharSB  = this.encodeTable[0][iconv.defaultCharSingleByte.charCodeAt(0)];
    if (this.defCharSB === UNASSIGNED) this.defCharSB = this.encodeTable[0]['?'];
    if (this.defCharSB === UNASSIGNED) this.defCharSB = "?".charCodeAt(0);
}

DBCSCodec.prototype.encoder = DBCSEncoder;
DBCSCodec.prototype.decoder = DBCSDecoder;

// Decoder helpers
DBCSCodec.prototype._getDecodeTrieNode = function(addr) {
    var bytes = [];
    for (; addr > 0; addr >>>= 8)
        bytes.push(addr & 0xFF);
    if (bytes.length == 0)
        bytes.push(0);

    var node = this.decodeTables[0];
    for (var i = bytes.length-1; i > 0; i--) { // Traverse nodes deeper into the trie.
        var val = node[bytes[i]];

        if (val == UNASSIGNED) { // Create new node.
            node[bytes[i]] = NODE_START - this.decodeTables.length;
            this.decodeTables.push(node = UNASSIGNED_NODE.slice(0));
        }
        else if (val <= NODE_START) { // Existing node.
            node = this.decodeTables[NODE_START - val];
        }
        else
            throw new Error("Overwrite byte in " + this.encodingName + ", addr: " + addr.toString(16));
    }
    return node;
}


DBCSCodec.prototype._addDecodeChunk = function(chunk) {
    // First element of chunk is the hex mbcs code where we start.
    var curAddr = parseInt(chunk[0], 16);

    // Choose the decoding node where we'll write our chars.
    var writeTable = this._getDecodeTrieNode(curAddr);
    curAddr = curAddr & 0xFF;

    // Write all other elements of the chunk to the table.
    for (var k = 1; k < chunk.length; k++) {
        var part = chunk[k];
        if (typeof part === "string") { // String, write as-is.
            for (var l = 0; l < part.length;) {
                var code = part.charCodeAt(l++);
                if (0xD800 <= code && code < 0xDC00) { // Decode surrogate
                    var codeTrail = part.charCodeAt(l++);
                    if (0xDC00 <= codeTrail && codeTrail < 0xE000)
                        writeTable[curAddr++] = 0x10000 + (code - 0xD800) * 0x400 + (codeTrail - 0xDC00);
                    else
                        throw new Error("Incorrect surrogate pair in "  + this.encodingName + " at chunk " + chunk[0]);
                }
                else if (0x0FF0 < code && code <= 0x0FFF) { // Character sequence (our own encoding used)
                    var len = 0xFFF - code + 2;
                    var seq = [];
                    for (var m = 0; m < len; m++)
                        seq.push(part.charCodeAt(l++)); // Simple variation: don't support surrogates or subsequences in seq.

                    writeTable[curAddr++] = SEQ_START - this.decodeTableSeq.length;
                    this.decodeTableSeq.push(seq);
                }
                else
                    writeTable[curAddr++] = code; // Basic char
            }
        } 
        else if (typeof part === "number") { // Integer, meaning increasing sequence starting with prev character.
            var charCode = writeTable[curAddr - 1] + 1;
            for (var l = 0; l < part; l++)
                writeTable[curAddr++] = charCode++;
        }
        else
            throw new Error("Incorrect type '" + typeof part + "' given in "  + this.encodingName + " at chunk " + chunk[0]);
    }
    if (curAddr > 0xFF)
        throw new Error("Incorrect chunk in "  + this.encodingName + " at addr " + chunk[0] + ": too long" + curAddr);
}

// Encoder helpers
DBCSCodec.prototype._getEncodeBucket = function(uCode) {
    var high = uCode >> 8; // This could be > 0xFF because of astral characters.
    if (this.encodeTable[high] === undefined)
        this.encodeTable[high] = UNASSIGNED_NODE.slice(0); // Create bucket on demand.
    return this.encodeTable[high];
}

DBCSCodec.prototype._setEncodeChar = function(uCode, dbcsCode) {
    var bucket = this._getEncodeBucket(uCode);
    var low = uCode & 0xFF;
    if (bucket[low] <= SEQ_START)
        this.encodeTableSeq[SEQ_START-bucket[low]][DEF_CHAR] = dbcsCode; // There's already a sequence, set a single-char subsequence of it.
    else if (bucket[low] == UNASSIGNED)
        bucket[low] = dbcsCode;
}

DBCSCodec.prototype._setEncodeSequence = function(seq, dbcsCode) {
    
    // Get the root of character tree according to first character of the sequence.
    var uCode = seq[0];
    var bucket = this._getEncodeBucket(uCode);
    var low = uCode & 0xFF;

    var node;
    if (bucket[low] <= SEQ_START) {
        // There's already a sequence with  - use it.
        node = this.encodeTableSeq[SEQ_START-bucket[low]];
    }
    else {
        // There was no sequence object - allocate a new one.
        node = {};
        if (bucket[low] !== UNASSIGNED) node[DEF_CHAR] = bucket[low]; // If a char was set before - make it a single-char subsequence.
        bucket[low] = SEQ_START - this.encodeTableSeq.length;
        this.encodeTableSeq.push(node);
    }

    // Traverse the character tree, allocating new nodes as needed.
    for (var j = 1; j < seq.length-1; j++) {
        var oldVal = node[uCode];
        if (typeof oldVal === 'object')
            node = oldVal;
        else {
            node = node[uCode] = {}
            if (oldVal !== undefined)
                node[DEF_CHAR] = oldVal
        }
    }

    // Set the leaf to given dbcsCode.
    uCode = seq[seq.length-1];
    node[uCode] = dbcsCode;
}

DBCSCodec.prototype._fillEncodeTable = function(nodeIdx, prefix, skipEncodeChars) {
    var node = this.decodeTables[nodeIdx];
    var hasValues = false;
    var subNodeEmpty = {};
    for (var i = 0; i < 0x100; i++) {
        var uCode = node[i];
        var mbCode = prefix + i;
        if (skipEncodeChars[mbCode])
            continue;

        if (uCode >= 0) {
            this._setEncodeChar(uCode, mbCode);
            hasValues = true;
        } else if (uCode <= NODE_START) {
            var subNodeIdx = NODE_START - uCode;
            if (!subNodeEmpty[subNodeIdx]) {  // Skip empty subtrees (they are too large in gb18030).
                var newPrefix = (mbCode << 8) >>> 0;  // NOTE: '>>> 0' keeps 32-bit num positive.
                if (this._fillEncodeTable(subNodeIdx, newPrefix, skipEncodeChars))
                    hasValues = true;
                else
                    subNodeEmpty[subNodeIdx] = true;
            }
        } else if (uCode <= SEQ_START) {
            this._setEncodeSequence(this.decodeTableSeq[SEQ_START - uCode], mbCode);
            hasValues = true;
        }
    }
    return hasValues;
}



// == Encoder ==================================================================

function DBCSEncoder(options, codec) {
    // Encoder state
    this.leadSurrogate = -1;
    this.seqObj = undefined;
    
    // Static data
    this.encodeTable = codec.encodeTable;
    this.encodeTableSeq = codec.encodeTableSeq;
    this.defaultCharSingleByte = codec.defCharSB;
    this.gb18030 = codec.gb18030;
}

DBCSEncoder.prototype.write = function(str) {
    var newBuf = Buffer.alloc(str.length * (this.gb18030 ? 4 : 3)),
        leadSurrogate = this.leadSurrogate,
        seqObj = this.seqObj, nextChar = -1,
        i = 0, j = 0;

    while (true) {
        // 0. Get next character.
        if (nextChar === -1) {
            if (i == str.length) break;
            var uCode = str.charCodeAt(i++);
        }
        else {
            var uCode = nextChar;
            nextChar = -1;    
        }

        // 1. Handle surrogates.
        if (0xD800 <= uCode && uCode < 0xE000) { // Char is one of surrogates.
            if (uCode < 0xDC00) { // We've got lead surrogate.
                if (leadSurrogate === -1) {
                    leadSurrogate = uCode;
                    continue;
                } else {
                    leadSurrogate = uCode;
                    // Double lead surrogate found.
                    uCode = UNASSIGNED;
                }
            } else { // We've got trail surrogate.
                if (leadSurrogate !== -1) {
                    uCode = 0x10000 + (leadSurrogate - 0xD800) * 0x400 + (uCode - 0xDC00);
                    leadSurrogate = -1;
                } else {
                    // Incomplete surrogate pair - only trail surrogate found.
                    uCode = UNASSIGNED;
                }
                
            }
        }
        else if (leadSurrogate !== -1) {
            // Incomplete surrogate pair - only lead surrogate found.
            nextChar = uCode; uCode = UNASSIGNED; // Write an error, then current char.
            leadSurrogate = -1;
        }

        // 2. Convert uCode character.
        var dbcsCode = UNASSIGNED;
        if (seqObj !== undefined && uCode != UNASSIGNED) { // We are in the middle of the sequence
            var resCode = seqObj[uCode];
            if (typeof resCode === 'object') { // Sequence continues.
                seqObj = resCode;
                continue;

            } else if (typeof resCode == 'number') { // Sequence finished. Write it.
                dbcsCode = resCode;

            } else if (resCode == undefined) { // Current character is not part of the sequence.

                // Try default character for this sequence
                resCode = seqObj[DEF_CHAR];
                if (resCode !== undefined) {
                    dbcsCode = resCode; // Found. Write it.
                    nextChar = uCode; // Current character will be written too in the next iteration.

                } else {
                    // TODO: What if we have no default? (resCode == undefined)
                    // Then, we should write first char of the sequence as-is and try the rest recursively.
                    // Didn't do it for now because no encoding has this situation yet.
                    // Currently, just skip the sequence and write current char.
                }
            }
            seqObj = undefined;
        }
        else if (uCode >= 0) {  // Regular character
            var subtable = this.encodeTable[uCode >> 8];
            if (subtable !== undefined)
                dbcsCode = subtable[uCode & 0xFF];
            
            if (dbcsCode <= SEQ_START) { // Sequence start
                seqObj = this.encodeTableSeq[SEQ_START-dbcsCode];
                continue;
            }

            if (dbcsCode == UNASSIGNED && this.gb18030) {
                // Use GB18030 algorithm to find character(s) to write.
                var idx = findIdx(this.gb18030.uChars, uCode);
                if (idx != -1) {
                    var dbcsCode = this.gb18030.gbChars[idx] + (uCode - this.gb18030.uChars[idx]);
                    newBuf[j++] = 0x81 + Math.floor(dbcsCode / 12600); dbcsCode = dbcsCode % 12600;
                    newBuf[j++] = 0x30 + Math.floor(dbcsCode / 1260); dbcsCode = dbcsCode % 1260;
                    newBuf[j++] = 0x81 + Math.floor(dbcsCode / 10); dbcsCode = dbcsCode % 10;
                    newBuf[j++] = 0x30 + dbcsCode;
                    continue;
                }
            }
        }

        // 3. Write dbcsCode character.
        if (dbcsCode === UNASSIGNED)
            dbcsCode = this.defaultCharSingleByte;
        
        if (dbcsCode < 0x100) {
            newBuf[j++] = dbcsCode;
        }
        else if (dbcsCode < 0x10000) {
            newBuf[j++] = dbcsCode >> 8;   // high byte
            newBuf[j++] = dbcsCode & 0xFF; // low byte
        }
        else if (dbcsCode < 0x1000000) {
            newBuf[j++] = dbcsCode >> 16;
            newBuf[j++] = (dbcsCode >> 8) & 0xFF;
            newBuf[j++] = dbcsCode & 0xFF;
        } else {
            newBuf[j++] = dbcsCode >>> 24;
            newBuf[j++] = (dbcsCode >>> 16) & 0xFF;
            newBuf[j++] = (dbcsCode >>> 8) & 0xFF;
            newBuf[j++] = dbcsCode & 0xFF;
        }
    }

    this.seqObj = seqObj;
    this.leadSurrogate = leadSurrogate;
    return newBuf.slice(0, j);
}

DBCSEncoder.prototype.end = function() {
    if (this.leadSurrogate === -1 && this.seqObj === undefined)
        return; // All clean. Most often case.

    var newBuf = Buffer.alloc(10), j = 0;

    if (this.seqObj) { // We're in the sequence.
        var dbcsCode = this.seqObj[DEF_CHAR];
        if (dbcsCode !== undefined) { // Write beginning of the sequence.
            if (dbcsCode < 0x100) {
                newBuf[j++] = dbcsCode;
            }
            else {
                newBuf[j++] = dbcsCode >> 8;   // high byte
                newBuf[j++] = dbcsCode & 0xFF; // low byte
            }
        } else {
            // See todo above.
        }
        this.seqObj = undefined;
    }

    if (this.leadSurrogate !== -1) {
        // Incomplete surrogate pair - only lead surrogate found.
        newBuf[j++] = this.defaultCharSingleByte;
        this.leadSurrogate = -1;
    }
    
    return newBuf.slice(0, j);
}

// Export for testing
DBCSEncoder.prototype.findIdx = findIdx;


// == Decoder ==================================================================

function DBCSDecoder(options, codec) {
    // Decoder state
    this.nodeIdx = 0;
    this.prevBytes = [];

    // Static data
    this.decodeTables = codec.decodeTables;
    this.decodeTableSeq = codec.decodeTableSeq;
    this.defaultCharUnicode = codec.defaultCharUnicode;
    this.gb18030 = codec.gb18030;
}

DBCSDecoder.prototype.write = function(buf) {
    var newBuf = Buffer.alloc(buf.length*2),
        nodeIdx = this.nodeIdx, 
        prevBytes = this.prevBytes, prevOffset = this.prevBytes.length,
        seqStart = -this.prevBytes.length, // idx of the start of current parsed sequence.
        uCode;

    for (var i = 0, j = 0; i < buf.length; i++) {
        var curByte = (i >= 0) ? buf[i] : prevBytes[i + prevOffset];

        // Lookup in current trie node.
        var uCode = this.decodeTables[nodeIdx][curByte];

        if (uCode >= 0) { 
            // Normal character, just use it.
        }
        else if (uCode === UNASSIGNED) { // Unknown char.
            // TODO: Callback with seq.
            uCode = this.defaultCharUnicode.charCodeAt(0);
            i = seqStart; // Skip one byte ('i' will be incremented by the for loop) and try to parse again.
        }
        else if (uCode === GB18030_CODE) {
            if (i >= 3) {
                var ptr = (buf[i-3]-0x81)*12600 + (buf[i-2]-0x30)*1260 + (buf[i-1]-0x81)*10 + (curByte-0x30);
            } else {
                var ptr = (prevBytes[i-3+prevOffset]-0x81)*12600 + 
                          (((i-2 >= 0) ? buf[i-2] : prevBytes[i-2+prevOffset])-0x30)*1260 + 
                          (((i-1 >= 0) ? buf[i-1] : prevBytes[i-1+prevOffset])-0x81)*10 + 
                          (curByte-0x30);
            }
            var idx = findIdx(this.gb18030.gbChars, ptr);
            uCode = this.gb18030.uChars[idx] + ptr - this.gb18030.gbChars[idx];
        }
        else if (uCode <= NODE_START) { // Go to next trie node.
            nodeIdx = NODE_START - uCode;
            continue;
        }
        else if (uCode <= SEQ_START) { // Output a sequence of chars.
            var seq = this.decodeTableSeq[SEQ_START - uCode];
            for (var k = 0; k < seq.length - 1; k++) {
                uCode = seq[k];
                newBuf[j++] = uCode & 0xFF;
                newBuf[j++] = uCode >> 8;
            }
            uCode = seq[seq.length-1];
        }
        else
            throw new Error("iconv-lite internal error: invalid decoding table value " + uCode + " at " + nodeIdx + "/" + curByte);

        // Write the character to buffer, handling higher planes using surrogate pair.
        if (uCode >= 0x10000) { 
            uCode -= 0x10000;
            var uCodeLead = 0xD800 | (uCode >> 10);
            newBuf[j++] = uCodeLead & 0xFF;
            newBuf[j++] = uCodeLead >> 8;

            uCode = 0xDC00 | (uCode & 0x3FF);
        }
        newBuf[j++] = uCode & 0xFF;
        newBuf[j++] = uCode >> 8;

        // Reset trie node.
        nodeIdx = 0; seqStart = i+1;
    }

    this.nodeIdx = nodeIdx;
    this.prevBytes = (seqStart >= 0)
        ? Array.prototype.slice.call(buf, seqStart)
        : prevBytes.slice(seqStart + prevOffset).concat(Array.prototype.slice.call(buf));

    return newBuf.slice(0, j).toString('ucs2');
}

DBCSDecoder.prototype.end = function() {
    var ret = '';

    // Try to parse all remaining chars.
    while (this.prevBytes.length > 0) {
        // Skip 1 character in the buffer.
        ret += this.defaultCharUnicode;
        var bytesArr = this.prevBytes.slice(1);

        // Parse remaining as usual.
        this.prevBytes = [];
        this.nodeIdx = 0;
        if (bytesArr.length > 0)
            ret += this.write(bytesArr);
    }

    this.prevBytes = [];
    this.nodeIdx = 0;
    return ret;
}

// Binary search for GB18030. Returns largest i such that table[i] <= val.
function findIdx(table, val) {
    if (table[0] > val)
        return -1;

    var l = 0, r = table.length;
    while (l < r-1) { // always table[l] <= val < table[r]
        var mid = l + ((r-l+1) >> 1);
        if (table[mid] <= val)
            l = mid;
        else
            r = mid;
    }
    return l;
}


},{"safer-buffer":49}],25:[function(require,module,exports){
"use strict";

// Description of supported double byte encodings and aliases.
// Tables are not require()-d until they are needed to speed up library load.
// require()-s are direct to support Browserify.

module.exports = {
    
    // == Japanese/ShiftJIS ====================================================
    // All japanese encodings are based on JIS X set of standards:
    // JIS X 0201 - Single-byte encoding of ASCII + ¥ + Kana chars at 0xA1-0xDF.
    // JIS X 0208 - Main set of 6879 characters, placed in 94x94 plane, to be encoded by 2 bytes. 
    //              Has several variations in 1978, 1983, 1990 and 1997.
    // JIS X 0212 - Supplementary plane of 6067 chars in 94x94 plane. 1990. Effectively dead.
    // JIS X 0213 - Extension and modern replacement of 0208 and 0212. Total chars: 11233.
    //              2 planes, first is superset of 0208, second - revised 0212.
    //              Introduced in 2000, revised 2004. Some characters are in Unicode Plane 2 (0x2xxxx)

    // Byte encodings are:
    //  * Shift_JIS: Compatible with 0201, uses not defined chars in top half as lead bytes for double-byte
    //               encoding of 0208. Lead byte ranges: 0x81-0x9F, 0xE0-0xEF; Trail byte ranges: 0x40-0x7E, 0x80-0x9E, 0x9F-0xFC.
    //               Windows CP932 is a superset of Shift_JIS. Some companies added more chars, notably KDDI.
    //  * EUC-JP:    Up to 3 bytes per character. Used mostly on *nixes.
    //               0x00-0x7F       - lower part of 0201
    //               0x8E, 0xA1-0xDF - upper part of 0201
    //               (0xA1-0xFE)x2   - 0208 plane (94x94).
    //               0x8F, (0xA1-0xFE)x2 - 0212 plane (94x94).
    //  * JIS X 208: 7-bit, direct encoding of 0208. Byte ranges: 0x21-0x7E (94 values). Uncommon.
    //               Used as-is in ISO2022 family.
    //  * ISO2022-JP: Stateful encoding, with escape sequences to switch between ASCII, 
    //                0201-1976 Roman, 0208-1978, 0208-1983.
    //  * ISO2022-JP-1: Adds esc seq for 0212-1990.
    //  * ISO2022-JP-2: Adds esc seq for GB2313-1980, KSX1001-1992, ISO8859-1, ISO8859-7.
    //  * ISO2022-JP-3: Adds esc seq for 0201-1976 Kana set, 0213-2000 Planes 1, 2.
    //  * ISO2022-JP-2004: Adds 0213-2004 Plane 1.
    //
    // After JIS X 0213 appeared, Shift_JIS-2004, EUC-JISX0213 and ISO2022-JP-2004 followed, with just changing the planes.
    //
    // Overall, it seems that it's a mess :( http://www8.plala.or.jp/tkubota1/unicode-symbols-map2.html

    'shiftjis': {
        type: '_dbcs',
        table: function() { return require('./tables/shiftjis.json') },
        encodeAdd: {'\u00a5': 0x5C, '\u203E': 0x7E},
        encodeSkipVals: [{from: 0xED40, to: 0xF940}],
    },
    'csshiftjis': 'shiftjis',
    'mskanji': 'shiftjis',
    'sjis': 'shiftjis',
    'windows31j': 'shiftjis',
    'ms31j': 'shiftjis',
    'xsjis': 'shiftjis',
    'windows932': 'shiftjis',
    'ms932': 'shiftjis',
    '932': 'shiftjis',
    'cp932': 'shiftjis',

    'eucjp': {
        type: '_dbcs',
        table: function() { return require('./tables/eucjp.json') },
        encodeAdd: {'\u00a5': 0x5C, '\u203E': 0x7E},
    },

    // TODO: KDDI extension to Shift_JIS
    // TODO: IBM CCSID 942 = CP932, but F0-F9 custom chars and other char changes.
    // TODO: IBM CCSID 943 = Shift_JIS = CP932 with original Shift_JIS lower 128 chars.


    // == Chinese/GBK ==========================================================
    // http://en.wikipedia.org/wiki/GBK
    // We mostly implement W3C recommendation: https://www.w3.org/TR/encoding/#gbk-encoder

    // Oldest GB2312 (1981, ~7600 chars) is a subset of CP936
    'gb2312': 'cp936',
    'gb231280': 'cp936',
    'gb23121980': 'cp936',
    'csgb2312': 'cp936',
    'csiso58gb231280': 'cp936',
    'euccn': 'cp936',

    // Microsoft's CP936 is a subset and approximation of GBK.
    'windows936': 'cp936',
    'ms936': 'cp936',
    '936': 'cp936',
    'cp936': {
        type: '_dbcs',
        table: function() { return require('./tables/cp936.json') },
    },

    // GBK (~22000 chars) is an extension of CP936 that added user-mapped chars and some other.
    'gbk': {
        type: '_dbcs',
        table: function() { return require('./tables/cp936.json').concat(require('./tables/gbk-added.json')) },
    },
    'xgbk': 'gbk',
    'isoir58': 'gbk',

    // GB18030 is an algorithmic extension of GBK.
    // Main source: https://www.w3.org/TR/encoding/#gbk-encoder
    // http://icu-project.org/docs/papers/gb18030.html
    // http://source.icu-project.org/repos/icu/data/trunk/charset/data/xml/gb-18030-2000.xml
    // http://www.khngai.com/chinese/charmap/tblgbk.php?page=0
    'gb18030': {
        type: '_dbcs',
        table: function() { return require('./tables/cp936.json').concat(require('./tables/gbk-added.json')) },
        gb18030: function() { return require('./tables/gb18030-ranges.json') },
        encodeSkipVals: [0x80],
        encodeAdd: {'€': 0xA2E3},
    },

    'chinese': 'gb18030',


    // == Korean ===============================================================
    // EUC-KR, KS_C_5601 and KS X 1001 are exactly the same.
    'windows949': 'cp949',
    'ms949': 'cp949',
    '949': 'cp949',
    'cp949': {
        type: '_dbcs',
        table: function() { return require('./tables/cp949.json') },
    },

    'cseuckr': 'cp949',
    'csksc56011987': 'cp949',
    'euckr': 'cp949',
    'isoir149': 'cp949',
    'korean': 'cp949',
    'ksc56011987': 'cp949',
    'ksc56011989': 'cp949',
    'ksc5601': 'cp949',


    // == Big5/Taiwan/Hong Kong ================================================
    // There are lots of tables for Big5 and cp950. Please see the following links for history:
    // http://moztw.org/docs/big5/  http://www.haible.de/bruno/charsets/conversion-tables/Big5.html
    // Variations, in roughly number of defined chars:
    //  * Windows CP 950: Microsoft variant of Big5. Canonical: http://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WINDOWS/CP950.TXT
    //  * Windows CP 951: Microsoft variant of Big5-HKSCS-2001. Seems to be never public. http://me.abelcheung.org/articles/research/what-is-cp951/
    //  * Big5-2003 (Taiwan standard) almost superset of cp950.
    //  * Unicode-at-on (UAO) / Mozilla 1.8. Falling out of use on the Web. Not supported by other browsers.
    //  * Big5-HKSCS (-2001, -2004, -2008). Hong Kong standard. 
    //    many unicode code points moved from PUA to Supplementary plane (U+2XXXX) over the years.
    //    Plus, it has 4 combining sequences.
    //    Seems that Mozilla refused to support it for 10 yrs. https://bugzilla.mozilla.org/show_bug.cgi?id=162431 https://bugzilla.mozilla.org/show_bug.cgi?id=310299
    //    because big5-hkscs is the only encoding to include astral characters in non-algorithmic way.
    //    Implementations are not consistent within browsers; sometimes labeled as just big5.
    //    MS Internet Explorer switches from big5 to big5-hkscs when a patch applied.
    //    Great discussion & recap of what's going on https://bugzilla.mozilla.org/show_bug.cgi?id=912470#c31
    //    In the encoder, it might make sense to support encoding old PUA mappings to Big5 bytes seq-s.
    //    Official spec: http://www.ogcio.gov.hk/en/business/tech_promotion/ccli/terms/doc/2003cmp_2008.txt
    //                   http://www.ogcio.gov.hk/tc/business/tech_promotion/ccli/terms/doc/hkscs-2008-big5-iso.txt
    // 
    // Current understanding of how to deal with Big5(-HKSCS) is in the Encoding Standard, http://encoding.spec.whatwg.org/#big5-encoder
    // Unicode mapping (http://www.unicode.org/Public/MAPPINGS/OBSOLETE/EASTASIA/OTHER/BIG5.TXT) is said to be wrong.

    'windows950': 'cp950',
    'ms950': 'cp950',
    '950': 'cp950',
    'cp950': {
        type: '_dbcs',
        table: function() { return require('./tables/cp950.json') },
    },

    // Big5 has many variations and is an extension of cp950. We use Encoding Standard's as a consensus.
    'big5': 'big5hkscs',
    'big5hkscs': {
        type: '_dbcs',
        table: function() { return require('./tables/cp950.json').concat(require('./tables/big5-added.json')) },
        encodeSkipVals: [
            // Although Encoding Standard says we should avoid encoding to HKSCS area (See Step 1 of
            // https://encoding.spec.whatwg.org/#index-big5-pointer), we still do it to increase compatibility with ICU.
            // But if a single unicode point can be encoded both as HKSCS and regular Big5, we prefer the latter.
            0x8e69, 0x8e6f, 0x8e7e, 0x8eab, 0x8eb4, 0x8ecd, 0x8ed0, 0x8f57, 0x8f69, 0x8f6e, 0x8fcb, 0x8ffe,
            0x906d, 0x907a, 0x90c4, 0x90dc, 0x90f1, 0x91bf, 0x92af, 0x92b0, 0x92b1, 0x92b2, 0x92d1, 0x9447, 0x94ca,
            0x95d9, 0x96fc, 0x9975, 0x9b76, 0x9b78, 0x9b7b, 0x9bc6, 0x9bde, 0x9bec, 0x9bf6, 0x9c42, 0x9c53, 0x9c62,
            0x9c68, 0x9c6b, 0x9c77, 0x9cbc, 0x9cbd, 0x9cd0, 0x9d57, 0x9d5a, 0x9dc4, 0x9def, 0x9dfb, 0x9ea9, 0x9eef,
            0x9efd, 0x9f60, 0x9fcb, 0xa077, 0xa0dc, 0xa0df, 0x8fcc, 0x92c8, 0x9644, 0x96ed,

            // Step 2 of https://encoding.spec.whatwg.org/#index-big5-pointer: Use last pointer for U+2550, U+255E, U+2561, U+256A, U+5341, or U+5345
            0xa2a4, 0xa2a5, 0xa2a7, 0xa2a6, 0xa2cc, 0xa2ce,
        ],
    },

    'cnbig5': 'big5hkscs',
    'csbig5': 'big5hkscs',
    'xxbig5': 'big5hkscs',
};

},{"./tables/big5-added.json":31,"./tables/cp936.json":32,"./tables/cp949.json":33,"./tables/cp950.json":34,"./tables/eucjp.json":35,"./tables/gb18030-ranges.json":36,"./tables/gbk-added.json":37,"./tables/shiftjis.json":38}],26:[function(require,module,exports){
"use strict";

// Update this array if you add/rename/remove files in this directory.
// We support Browserify by skipping automatic module discovery and requiring modules directly.
var modules = [
    require("./internal"),
    require("./utf32"),
    require("./utf16"),
    require("./utf7"),
    require("./sbcs-codec"),
    require("./sbcs-data"),
    require("./sbcs-data-generated"),
    require("./dbcs-codec"),
    require("./dbcs-data"),
];

// Put all encoding/alias/codec definitions to single object and export it.
for (var i = 0; i < modules.length; i++) {
    var module = modules[i];
    for (var enc in module)
        if (Object.prototype.hasOwnProperty.call(module, enc))
            exports[enc] = module[enc];
}

},{"./dbcs-codec":24,"./dbcs-data":25,"./internal":27,"./sbcs-codec":28,"./sbcs-data":30,"./sbcs-data-generated":29,"./utf16":39,"./utf32":40,"./utf7":41}],27:[function(require,module,exports){
"use strict";
var Buffer = require("safer-buffer").Buffer;

// Export Node.js internal encodings.

module.exports = {
    // Encodings
    utf8:   { type: "_internal", bomAware: true},
    cesu8:  { type: "_internal", bomAware: true},
    unicode11utf8: "utf8",

    ucs2:   { type: "_internal", bomAware: true},
    utf16le: "ucs2",

    binary: { type: "_internal" },
    base64: { type: "_internal" },
    hex:    { type: "_internal" },

    // Codec.
    _internal: InternalCodec,
};

//------------------------------------------------------------------------------

function InternalCodec(codecOptions, iconv) {
    this.enc = codecOptions.encodingName;
    this.bomAware = codecOptions.bomAware;

    if (this.enc === "base64")
        this.encoder = InternalEncoderBase64;
    else if (this.enc === "cesu8") {
        this.enc = "utf8"; // Use utf8 for decoding.
        this.encoder = InternalEncoderCesu8;

        // Add decoder for versions of Node not supporting CESU-8
        if (Buffer.from('eda0bdedb2a9', 'hex').toString() !== '💩') {
            this.decoder = InternalDecoderCesu8;
            this.defaultCharUnicode = iconv.defaultCharUnicode;
        }
    }
}

InternalCodec.prototype.encoder = InternalEncoder;
InternalCodec.prototype.decoder = InternalDecoder;

//------------------------------------------------------------------------------

// We use node.js internal decoder. Its signature is the same as ours.
var StringDecoder = require('string_decoder').StringDecoder;

if (!StringDecoder.prototype.end) // Node v0.8 doesn't have this method.
    StringDecoder.prototype.end = function() {};


function InternalDecoder(options, codec) {
    this.decoder = new StringDecoder(codec.enc);
}

InternalDecoder.prototype.write = function(buf) {
    if (!Buffer.isBuffer(buf)) {
        buf = Buffer.from(buf);
    }

    return this.decoder.write(buf);
}

InternalDecoder.prototype.end = function() {
    return this.decoder.end();
}


//------------------------------------------------------------------------------
// Encoder is mostly trivial

function InternalEncoder(options, codec) {
    this.enc = codec.enc;
}

InternalEncoder.prototype.write = function(str) {
    return Buffer.from(str, this.enc);
}

InternalEncoder.prototype.end = function() {
}


//------------------------------------------------------------------------------
// Except base64 encoder, which must keep its state.

function InternalEncoderBase64(options, codec) {
    this.prevStr = '';
}

InternalEncoderBase64.prototype.write = function(str) {
    str = this.prevStr + str;
    var completeQuads = str.length - (str.length % 4);
    this.prevStr = str.slice(completeQuads);
    str = str.slice(0, completeQuads);

    return Buffer.from(str, "base64");
}

InternalEncoderBase64.prototype.end = function() {
    return Buffer.from(this.prevStr, "base64");
}


//------------------------------------------------------------------------------
// CESU-8 encoder is also special.

function InternalEncoderCesu8(options, codec) {
}

InternalEncoderCesu8.prototype.write = function(str) {
    var buf = Buffer.alloc(str.length * 3), bufIdx = 0;
    for (var i = 0; i < str.length; i++) {
        var charCode = str.charCodeAt(i);
        // Naive implementation, but it works because CESU-8 is especially easy
        // to convert from UTF-16 (which all JS strings are encoded in).
        if (charCode < 0x80)
            buf[bufIdx++] = charCode;
        else if (charCode < 0x800) {
            buf[bufIdx++] = 0xC0 + (charCode >>> 6);
            buf[bufIdx++] = 0x80 + (charCode & 0x3f);
        }
        else { // charCode will always be < 0x10000 in javascript.
            buf[bufIdx++] = 0xE0 + (charCode >>> 12);
            buf[bufIdx++] = 0x80 + ((charCode >>> 6) & 0x3f);
            buf[bufIdx++] = 0x80 + (charCode & 0x3f);
        }
    }
    return buf.slice(0, bufIdx);
}

InternalEncoderCesu8.prototype.end = function() {
}

//------------------------------------------------------------------------------
// CESU-8 decoder is not implemented in Node v4.0+

function InternalDecoderCesu8(options, codec) {
    this.acc = 0;
    this.contBytes = 0;
    this.accBytes = 0;
    this.defaultCharUnicode = codec.defaultCharUnicode;
}

InternalDecoderCesu8.prototype.write = function(buf) {
    var acc = this.acc, contBytes = this.contBytes, accBytes = this.accBytes, 
        res = '';
    for (var i = 0; i < buf.length; i++) {
        var curByte = buf[i];
        if ((curByte & 0xC0) !== 0x80) { // Leading byte
            if (contBytes > 0) { // Previous code is invalid
                res += this.defaultCharUnicode;
                contBytes = 0;
            }

            if (curByte < 0x80) { // Single-byte code
                res += String.fromCharCode(curByte);
            } else if (curByte < 0xE0) { // Two-byte code
                acc = curByte & 0x1F;
                contBytes = 1; accBytes = 1;
            } else if (curByte < 0xF0) { // Three-byte code
                acc = curByte & 0x0F;
                contBytes = 2; accBytes = 1;
            } else { // Four or more are not supported for CESU-8.
                res += this.defaultCharUnicode;
            }
        } else { // Continuation byte
            if (contBytes > 0) { // We're waiting for it.
                acc = (acc << 6) | (curByte & 0x3f);
                contBytes--; accBytes++;
                if (contBytes === 0) {
                    // Check for overlong encoding, but support Modified UTF-8 (encoding NULL as C0 80)
                    if (accBytes === 2 && acc < 0x80 && acc > 0)
                        res += this.defaultCharUnicode;
                    else if (accBytes === 3 && acc < 0x800)
                        res += this.defaultCharUnicode;
                    else
                        // Actually add character.
                        res += String.fromCharCode(acc);
                }
            } else { // Unexpected continuation byte
                res += this.defaultCharUnicode;
            }
        }
    }
    this.acc = acc; this.contBytes = contBytes; this.accBytes = accBytes;
    return res;
}

InternalDecoderCesu8.prototype.end = function() {
    var res = 0;
    if (this.contBytes > 0)
        res += this.defaultCharUnicode;
    return res;
}

},{"safer-buffer":49,"string_decoder":undefined}],28:[function(require,module,exports){
"use strict";
var Buffer = require("safer-buffer").Buffer;

// Single-byte codec. Needs a 'chars' string parameter that contains 256 or 128 chars that
// correspond to encoded bytes (if 128 - then lower half is ASCII). 

exports._sbcs = SBCSCodec;
function SBCSCodec(codecOptions, iconv) {
    if (!codecOptions)
        throw new Error("SBCS codec is called without the data.")
    
    // Prepare char buffer for decoding.
    if (!codecOptions.chars || (codecOptions.chars.length !== 128 && codecOptions.chars.length !== 256))
        throw new Error("Encoding '"+codecOptions.type+"' has incorrect 'chars' (must be of len 128 or 256)");
    
    if (codecOptions.chars.length === 128) {
        var asciiString = "";
        for (var i = 0; i < 128; i++)
            asciiString += String.fromCharCode(i);
        codecOptions.chars = asciiString + codecOptions.chars;
    }

    this.decodeBuf = Buffer.from(codecOptions.chars, 'ucs2');
    
    // Encoding buffer.
    var encodeBuf = Buffer.alloc(65536, iconv.defaultCharSingleByte.charCodeAt(0));

    for (var i = 0; i < codecOptions.chars.length; i++)
        encodeBuf[codecOptions.chars.charCodeAt(i)] = i;

    this.encodeBuf = encodeBuf;
}

SBCSCodec.prototype.encoder = SBCSEncoder;
SBCSCodec.prototype.decoder = SBCSDecoder;


function SBCSEncoder(options, codec) {
    this.encodeBuf = codec.encodeBuf;
}

SBCSEncoder.prototype.write = function(str) {
    var buf = Buffer.alloc(str.length);
    for (var i = 0; i < str.length; i++)
        buf[i] = this.encodeBuf[str.charCodeAt(i)];
    
    return buf;
}

SBCSEncoder.prototype.end = function() {
}


function SBCSDecoder(options, codec) {
    this.decodeBuf = codec.decodeBuf;
}

SBCSDecoder.prototype.write = function(buf) {
    // Strings are immutable in JS -> we use ucs2 buffer to speed up computations.
    var decodeBuf = this.decodeBuf;
    var newBuf = Buffer.alloc(buf.length*2);
    var idx1 = 0, idx2 = 0;
    for (var i = 0; i < buf.length; i++) {
        idx1 = buf[i]*2; idx2 = i*2;
        newBuf[idx2] = decodeBuf[idx1];
        newBuf[idx2+1] = decodeBuf[idx1+1];
    }
    return newBuf.toString('ucs2');
}

SBCSDecoder.prototype.end = function() {
}

},{"safer-buffer":49}],29:[function(require,module,exports){
"use strict";

// Generated data for sbcs codec. Don't edit manually. Regenerate using generation/gen-sbcs.js script.
module.exports = {
  "437": "cp437",
  "737": "cp737",
  "775": "cp775",
  "850": "cp850",
  "852": "cp852",
  "855": "cp855",
  "856": "cp856",
  "857": "cp857",
  "858": "cp858",
  "860": "cp860",
  "861": "cp861",
  "862": "cp862",
  "863": "cp863",
  "864": "cp864",
  "865": "cp865",
  "866": "cp866",
  "869": "cp869",
  "874": "windows874",
  "922": "cp922",
  "1046": "cp1046",
  "1124": "cp1124",
  "1125": "cp1125",
  "1129": "cp1129",
  "1133": "cp1133",
  "1161": "cp1161",
  "1162": "cp1162",
  "1163": "cp1163",
  "1250": "windows1250",
  "1251": "windows1251",
  "1252": "windows1252",
  "1253": "windows1253",
  "1254": "windows1254",
  "1255": "windows1255",
  "1256": "windows1256",
  "1257": "windows1257",
  "1258": "windows1258",
  "28591": "iso88591",
  "28592": "iso88592",
  "28593": "iso88593",
  "28594": "iso88594",
  "28595": "iso88595",
  "28596": "iso88596",
  "28597": "iso88597",
  "28598": "iso88598",
  "28599": "iso88599",
  "28600": "iso885910",
  "28601": "iso885911",
  "28603": "iso885913",
  "28604": "iso885914",
  "28605": "iso885915",
  "28606": "iso885916",
  "windows874": {
    "type": "_sbcs",
    "chars": "€����…�����������‘’“”•–—�������� กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����"
  },
  "win874": "windows874",
  "cp874": "windows874",
  "windows1250": {
    "type": "_sbcs",
    "chars": "€�‚�„…†‡�‰Š‹ŚŤŽŹ�‘’“”•–—�™š›śťžź ˇ˘Ł¤Ą¦§¨©Ş«¬­®Ż°±˛ł´µ¶·¸ąş»Ľ˝ľżŔÁÂĂÄĹĆÇČÉĘËĚÍÎĎĐŃŇÓÔŐÖ×ŘŮÚŰÜÝŢßŕáâăäĺćçčéęëěíîďđńňóôőö÷řůúűüýţ˙"
  },
  "win1250": "windows1250",
  "cp1250": "windows1250",
  "windows1251": {
    "type": "_sbcs",
    "chars": "ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ‘’“”•–—�™љ›њќћџ ЎўЈ¤Ґ¦§Ё©Є«¬­®Ї°±Ііґµ¶·ё№є»јЅѕїАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя"
  },
  "win1251": "windows1251",
  "cp1251": "windows1251",
  "windows1252": {
    "type": "_sbcs",
    "chars": "€�‚ƒ„…†‡ˆ‰Š‹Œ�Ž��‘’“”•–—˜™š›œ�žŸ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
  },
  "win1252": "windows1252",
  "cp1252": "windows1252",
  "windows1253": {
    "type": "_sbcs",
    "chars": "€�‚ƒ„…†‡�‰�‹�����‘’“”•–—�™�›���� ΅Ά£¤¥¦§¨©�«¬­®―°±²³΄µ¶·ΈΉΊ»Ό½ΎΏΐΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡ�ΣΤΥΦΧΨΩΪΫάέήίΰαβγδεζηθικλμνξοπρςστυφχψωϊϋόύώ�"
  },
  "win1253": "windows1253",
  "cp1253": "windows1253",
  "windows1254": {
    "type": "_sbcs",
    "chars": "€�‚ƒ„…†‡ˆ‰Š‹Œ����‘’“”•–—˜™š›œ��Ÿ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏĞÑÒÓÔÕÖ×ØÙÚÛÜİŞßàáâãäåæçèéêëìíîïğñòóôõö÷øùúûüışÿ"
  },
  "win1254": "windows1254",
  "cp1254": "windows1254",
  "windows1255": {
    "type": "_sbcs",
    "chars": "€�‚ƒ„…†‡ˆ‰�‹�����‘’“”•–—˜™�›���� ¡¢£₪¥¦§¨©×«¬­®¯°±²³´µ¶·¸¹÷»¼½¾¿ְֱֲֳִֵֶַָֹֺֻּֽ־ֿ׀ׁׂ׃װױײ׳״�������אבגדהוזחטיךכלםמןנסעףפץצקרשת��‎‏�"
  },
  "win1255": "windows1255",
  "cp1255": "windows1255",
  "windows1256": {
    "type": "_sbcs",
    "chars": "€پ‚ƒ„…†‡ˆ‰ٹ‹Œچژڈگ‘’“”•–—ک™ڑ›œ‌‍ں ،¢£¤¥¦§¨©ھ«¬­®¯°±²³´µ¶·¸¹؛»¼½¾؟ہءآأؤإئابةتثجحخدذرزسشصض×طظعغـفقكàلâمنهوçèéêëىيîïًٌٍَôُِ÷ّùْûü‎‏ے"
  },
  "win1256": "windows1256",
  "cp1256": "windows1256",
  "windows1257": {
    "type": "_sbcs",
    "chars": "€�‚�„…†‡�‰�‹�¨ˇ¸�‘’“”•–—�™�›�¯˛� �¢£¤�¦§Ø©Ŗ«¬­®Æ°±²³´µ¶·ø¹ŗ»¼½¾æĄĮĀĆÄÅĘĒČÉŹĖĢĶĪĻŠŃŅÓŌÕÖ×ŲŁŚŪÜŻŽßąįāćäåęēčéźėģķīļšńņóōõö÷ųłśūüżž˙"
  },
  "win1257": "windows1257",
  "cp1257": "windows1257",
  "windows1258": {
    "type": "_sbcs",
    "chars": "€�‚ƒ„…†‡ˆ‰�‹Œ����‘’“”•–—˜™�›œ��Ÿ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂĂÄÅÆÇÈÉÊË̀ÍÎÏĐÑ̉ÓÔƠÖ×ØÙÚÛÜỮßàáâăäåæçèéêë́íîïđṇ̃óôơö÷øùúûüư₫ÿ"
  },
  "win1258": "windows1258",
  "cp1258": "windows1258",
  "iso88591": {
    "type": "_sbcs",
    "chars": " ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
  },
  "cp28591": "iso88591",
  "iso88592": {
    "type": "_sbcs",
    "chars": " Ą˘Ł¤ĽŚ§¨ŠŞŤŹ­ŽŻ°ą˛ł´ľśˇ¸šşťź˝žżŔÁÂĂÄĹĆÇČÉĘËĚÍÎĎĐŃŇÓÔŐÖ×ŘŮÚŰÜÝŢßŕáâăäĺćçčéęëěíîďđńňóôőö÷řůúűüýţ˙"
  },
  "cp28592": "iso88592",
  "iso88593": {
    "type": "_sbcs",
    "chars": " Ħ˘£¤�Ĥ§¨İŞĞĴ­�Ż°ħ²³´µĥ·¸ışğĵ½�żÀÁÂ�ÄĊĈÇÈÉÊËÌÍÎÏ�ÑÒÓÔĠÖ×ĜÙÚÛÜŬŜßàáâ�äċĉçèéêëìíîï�ñòóôġö÷ĝùúûüŭŝ˙"
  },
  "cp28593": "iso88593",
  "iso88594": {
    "type": "_sbcs",
    "chars": " ĄĸŖ¤ĨĻ§¨ŠĒĢŦ­Ž¯°ą˛ŗ´ĩļˇ¸šēģŧŊžŋĀÁÂÃÄÅÆĮČÉĘËĖÍÎĪĐŅŌĶÔÕÖ×ØŲÚÛÜŨŪßāáâãäåæįčéęëėíîīđņōķôõö÷øųúûüũū˙"
  },
  "cp28594": "iso88594",
  "iso88595": {
    "type": "_sbcs",
    "chars": " ЁЂЃЄЅІЇЈЉЊЋЌ­ЎЏАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя№ёђѓєѕіїјљњћќ§ўџ"
  },
  "cp28595": "iso88595",
  "iso88596": {
    "type": "_sbcs",
    "chars": " ���¤�������،­�������������؛���؟�ءآأؤإئابةتثجحخدذرزسشصضطظعغ�����ـفقكلمنهوىيًٌٍَُِّْ�������������"
  },
  "cp28596": "iso88596",
  "iso88597": {
    "type": "_sbcs",
    "chars": " ‘’£€₯¦§¨©ͺ«¬­�―°±²³΄΅Ά·ΈΉΊ»Ό½ΎΏΐΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡ�ΣΤΥΦΧΨΩΪΫάέήίΰαβγδεζηθικλμνξοπρςστυφχψωϊϋόύώ�"
  },
  "cp28597": "iso88597",
  "iso88598": {
    "type": "_sbcs",
    "chars": " �¢£¤¥¦§¨©×«¬­®¯°±²³´µ¶·¸¹÷»¼½¾��������������������������������‗אבגדהוזחטיךכלםמןנסעףפץצקרשת��‎‏�"
  },
  "cp28598": "iso88598",
  "iso88599": {
    "type": "_sbcs",
    "chars": " ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏĞÑÒÓÔÕÖ×ØÙÚÛÜİŞßàáâãäåæçèéêëìíîïğñòóôõö÷øùúûüışÿ"
  },
  "cp28599": "iso88599",
  "iso885910": {
    "type": "_sbcs",
    "chars": " ĄĒĢĪĨĶ§ĻĐŠŦŽ­ŪŊ°ąēģīĩķ·ļđšŧž―ūŋĀÁÂÃÄÅÆĮČÉĘËĖÍÎÏÐŅŌÓÔÕÖŨØŲÚÛÜÝÞßāáâãäåæįčéęëėíîïðņōóôõöũøųúûüýþĸ"
  },
  "cp28600": "iso885910",
  "iso885911": {
    "type": "_sbcs",
    "chars": " กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����"
  },
  "cp28601": "iso885911",
  "iso885913": {
    "type": "_sbcs",
    "chars": " ”¢£¤„¦§Ø©Ŗ«¬­®Æ°±²³“µ¶·ø¹ŗ»¼½¾æĄĮĀĆÄÅĘĒČÉŹĖĢĶĪĻŠŃŅÓŌÕÖ×ŲŁŚŪÜŻŽßąįāćäåęēčéźėģķīļšńņóōõö÷ųłśūüżž’"
  },
  "cp28603": "iso885913",
  "iso885914": {
    "type": "_sbcs",
    "chars": " Ḃḃ£ĊċḊ§Ẁ©ẂḋỲ­®ŸḞḟĠġṀṁ¶ṖẁṗẃṠỳẄẅṡÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏŴÑÒÓÔÕÖṪØÙÚÛÜÝŶßàáâãäåæçèéêëìíîïŵñòóôõöṫøùúûüýŷÿ"
  },
  "cp28604": "iso885914",
  "iso885915": {
    "type": "_sbcs",
    "chars": " ¡¢£€¥Š§š©ª«¬­®¯°±²³Žµ¶·ž¹º»ŒœŸ¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
  },
  "cp28605": "iso885915",
  "iso885916": {
    "type": "_sbcs",
    "chars": " ĄąŁ€„Š§š©Ș«Ź­źŻ°±ČłŽ”¶·žčș»ŒœŸżÀÁÂĂÄĆÆÇÈÉÊËÌÍÎÏĐŃÒÓÔŐÖŚŰÙÚÛÜĘȚßàáâăäćæçèéêëìíîïđńòóôőöśűùúûüęțÿ"
  },
  "cp28606": "iso885916",
  "cp437": {
    "type": "_sbcs",
    "chars": "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
  },
  "ibm437": "cp437",
  "csibm437": "cp437",
  "cp737": {
    "type": "_sbcs",
    "chars": "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρσςτυφχψ░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀ωάέήϊίόύϋώΆΈΉΊΌΎΏ±≥≤ΪΫ÷≈°∙·√ⁿ²■ "
  },
  "ibm737": "cp737",
  "csibm737": "cp737",
  "cp775": {
    "type": "_sbcs",
    "chars": "ĆüéāäģåćłēŖŗīŹÄÅÉæÆōöĢ¢ŚśÖÜø£Ø×¤ĀĪóŻżź”¦©®¬½¼Ł«»░▒▓│┤ĄČĘĖ╣║╗╝ĮŠ┐└┴┬├─┼ŲŪ╚╔╩╦╠═╬Žąčęėįšųūž┘┌█▄▌▐▀ÓßŌŃõÕµńĶķĻļņĒŅ’­±“¾¶§÷„°∙·¹³²■ "
  },
  "ibm775": "cp775",
  "csibm775": "cp775",
  "cp850": {
    "type": "_sbcs",
    "chars": "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ "
  },
  "ibm850": "cp850",
  "csibm850": "cp850",
  "cp852": {
    "type": "_sbcs",
    "chars": "ÇüéâäůćçłëŐőîŹÄĆÉĹĺôöĽľŚśÖÜŤťŁ×čáíóúĄąŽžĘę¬źČş«»░▒▓│┤ÁÂĚŞ╣║╗╝Żż┐└┴┬├─┼Ăă╚╔╩╦╠═╬¤đĐĎËďŇÍÎě┘┌█▄ŢŮ▀ÓßÔŃńňŠšŔÚŕŰýÝţ´­˝˛ˇ˘§÷¸°¨˙űŘř■ "
  },
  "ibm852": "cp852",
  "csibm852": "cp852",
  "cp855": {
    "type": "_sbcs",
    "chars": "ђЂѓЃёЁєЄѕЅіІїЇјЈљЉњЊћЋќЌўЎџЏюЮъЪаАбБцЦдДеЕфФгГ«»░▒▓│┤хХиИ╣║╗╝йЙ┐└┴┬├─┼кК╚╔╩╦╠═╬¤лЛмМнНоОп┘┌█▄Пя▀ЯрРсСтТуУжЖвВьЬ№­ыЫзЗшШэЭщЩчЧ§■ "
  },
  "ibm855": "cp855",
  "csibm855": "cp855",
  "cp856": {
    "type": "_sbcs",
    "chars": "אבגדהוזחטיךכלםמןנסעףפץצקרשת�£�×����������®¬½¼�«»░▒▓│┤���©╣║╗╝¢¥┐└┴┬├─┼��╚╔╩╦╠═╬¤���������┘┌█▄¦�▀������µ�������¯´­±‗¾¶§÷¸°¨·¹³²■ "
  },
  "ibm856": "cp856",
  "csibm856": "cp856",
  "cp857": {
    "type": "_sbcs",
    "chars": "ÇüéâäàåçêëèïîıÄÅÉæÆôöòûùİÖÜø£ØŞşáíóúñÑĞğ¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ºªÊËÈ�ÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµ�×ÚÛÙìÿ¯´­±�¾¶§÷¸°¨·¹³²■ "
  },
  "ibm857": "cp857",
  "csibm857": "cp857",
  "cp858": {
    "type": "_sbcs",
    "chars": "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈ€ÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ "
  },
  "ibm858": "cp858",
  "csibm858": "cp858",
  "cp860": {
    "type": "_sbcs",
    "chars": "ÇüéâãàÁçêÊèÍÔìÃÂÉÀÈôõòÚùÌÕÜ¢£Ù₧ÓáíóúñÑªº¿Ò¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
  },
  "ibm860": "cp860",
  "csibm860": "cp860",
  "cp861": {
    "type": "_sbcs",
    "chars": "ÇüéâäàåçêëèÐðÞÄÅÉæÆôöþûÝýÖÜø£Ø₧ƒáíóúÁÍÓÚ¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
  },
  "ibm861": "cp861",
  "csibm861": "cp861",
  "cp862": {
    "type": "_sbcs",
    "chars": "אבגדהוזחטיךכלםמןנסעףפץצקרשת¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
  },
  "ibm862": "cp862",
  "csibm862": "cp862",
  "cp863": {
    "type": "_sbcs",
    "chars": "ÇüéâÂà¶çêëèïî‗À§ÉÈÊôËÏûù¤ÔÜ¢£ÙÛƒ¦´óú¨¸³¯Î⌐¬½¼¾«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
  },
  "ibm863": "cp863",
  "csibm863": "cp863",
  "cp864": {
    "type": "_sbcs",
    "chars": "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f !\"#$٪&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~°·∙√▒─│┼┤┬├┴┐┌└┘β∞φ±½¼≈«»ﻷﻸ��ﻻﻼ� ­ﺂ£¤ﺄ��ﺎﺏﺕﺙ،ﺝﺡﺥ٠١٢٣٤٥٦٧٨٩ﻑ؛ﺱﺵﺹ؟¢ﺀﺁﺃﺅﻊﺋﺍﺑﺓﺗﺛﺟﺣﺧﺩﺫﺭﺯﺳﺷﺻﺿﻁﻅﻋﻏ¦¬÷×ﻉـﻓﻗﻛﻟﻣﻧﻫﻭﻯﻳﺽﻌﻎﻍﻡﹽّﻥﻩﻬﻰﻲﻐﻕﻵﻶﻝﻙﻱ■�"
  },
  "ibm864": "cp864",
  "csibm864": "cp864",
  "cp865": {
    "type": "_sbcs",
    "chars": "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø₧ƒáíóúñÑªº¿⌐¬½¼¡«¤░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
  },
  "ibm865": "cp865",
  "csibm865": "cp865",
  "cp866": {
    "type": "_sbcs",
    "chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀рстуфхцчшщъыьэюяЁёЄєЇїЎў°∙·√№¤■ "
  },
  "ibm866": "cp866",
  "csibm866": "cp866",
  "cp869": {
    "type": "_sbcs",
    "chars": "������Ά�·¬¦‘’Έ―ΉΊΪΌ��ΎΫ©Ώ²³ά£έήίϊΐόύΑΒΓΔΕΖΗ½ΘΙ«»░▒▓│┤ΚΛΜΝ╣║╗╝ΞΟ┐└┴┬├─┼ΠΡ╚╔╩╦╠═╬ΣΤΥΦΧΨΩαβγ┘┌█▄δε▀ζηθικλμνξοπρσςτ΄­±υφχ§ψ΅°¨ωϋΰώ■ "
  },
  "ibm869": "cp869",
  "csibm869": "cp869",
  "cp922": {
    "type": "_sbcs",
    "chars": " ¡¢£¤¥¦§¨©ª«¬­®‾°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏŠÑÒÓÔÕÖ×ØÙÚÛÜÝŽßàáâãäåæçèéêëìíîïšñòóôõö÷øùúûüýžÿ"
  },
  "ibm922": "cp922",
  "csibm922": "cp922",
  "cp1046": {
    "type": "_sbcs",
    "chars": "ﺈ×÷ﹱ■│─┐┌└┘ﹹﹻﹽﹿﹷﺊﻰﻳﻲﻎﻏﻐﻶﻸﻺﻼ ¤ﺋﺑﺗﺛﺟﺣ،­ﺧﺳ٠١٢٣٤٥٦٧٨٩ﺷ؛ﺻﺿﻊ؟ﻋءآأؤإئابةتثجحخدذرزسشصضطﻇعغﻌﺂﺄﺎﻓـفقكلمنهوىيًٌٍَُِّْﻗﻛﻟﻵﻷﻹﻻﻣﻧﻬﻩ�"
  },
  "ibm1046": "cp1046",
  "csibm1046": "cp1046",
  "cp1124": {
    "type": "_sbcs",
    "chars": " ЁЂҐЄЅІЇЈЉЊЋЌ­ЎЏАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя№ёђґєѕіїјљњћќ§ўџ"
  },
  "ibm1124": "cp1124",
  "csibm1124": "cp1124",
  "cp1125": {
    "type": "_sbcs",
    "chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀рстуфхцчшщъыьэюяЁёҐґЄєІіЇї·√№¤■ "
  },
  "ibm1125": "cp1125",
  "csibm1125": "cp1125",
  "cp1129": {
    "type": "_sbcs",
    "chars": " ¡¢£¤¥¦§œ©ª«¬­®¯°±²³Ÿµ¶·Œ¹º»¼½¾¿ÀÁÂĂÄÅÆÇÈÉÊË̀ÍÎÏĐÑ̉ÓÔƠÖ×ØÙÚÛÜỮßàáâăäåæçèéêë́íîïđṇ̃óôơö÷øùúûüư₫ÿ"
  },
  "ibm1129": "cp1129",
  "csibm1129": "cp1129",
  "cp1133": {
    "type": "_sbcs",
    "chars": " ກຂຄງຈສຊຍດຕຖທນບປຜຝພຟມຢຣລວຫອຮ���ຯະາຳິີຶືຸູຼັົຽ���ເແໂໃໄ່້໊໋໌ໍໆ�ໜໝ₭����������������໐໑໒໓໔໕໖໗໘໙��¢¬¦�"
  },
  "ibm1133": "cp1133",
  "csibm1133": "cp1133",
  "cp1161": {
    "type": "_sbcs",
    "chars": "��������������������������������่กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู้๊๋€฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛¢¬¦ "
  },
  "ibm1161": "cp1161",
  "csibm1161": "cp1161",
  "cp1162": {
    "type": "_sbcs",
    "chars": "€…‘’“”•–— กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����"
  },
  "ibm1162": "cp1162",
  "csibm1162": "cp1162",
  "cp1163": {
    "type": "_sbcs",
    "chars": " ¡¢£€¥¦§œ©ª«¬­®¯°±²³Ÿµ¶·Œ¹º»¼½¾¿ÀÁÂĂÄÅÆÇÈÉÊË̀ÍÎÏĐÑ̉ÓÔƠÖ×ØÙÚÛÜỮßàáâăäåæçèéêë́íîïđṇ̃óôơö÷øùúûüư₫ÿ"
  },
  "ibm1163": "cp1163",
  "csibm1163": "cp1163",
  "maccroatian": {
    "type": "_sbcs",
    "chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®Š™´¨≠ŽØ∞±≤≥∆µ∂∑∏š∫ªºΩžø¿¡¬√ƒ≈Ć«Č… ÀÃÕŒœĐ—“”‘’÷◊�©⁄¤‹›Æ»–·‚„‰ÂćÁčÈÍÎÏÌÓÔđÒÚÛÙıˆ˜¯πË˚¸Êæˇ"
  },
  "maccyrillic": {
    "type": "_sbcs",
    "chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ†°¢£§•¶І®©™Ђђ≠Ѓѓ∞±≤≥іµ∂ЈЄєЇїЉљЊњјЅ¬√ƒ≈∆«»… ЋћЌќѕ–—“”‘’÷„ЎўЏџ№Ёёяабвгдежзийклмнопрстуфхцчшщъыьэю¤"
  },
  "macgreek": {
    "type": "_sbcs",
    "chars": "Ä¹²É³ÖÜ΅àâä΄¨çéèêë£™îï•½‰ôö¦­ùûü†ΓΔΘΛΞΠß®©ΣΪ§≠°·Α±≤≥¥ΒΕΖΗΙΚΜΦΫΨΩάΝ¬ΟΡ≈Τ«»… ΥΧΆΈœ–―“”‘’÷ΉΊΌΎέήίόΏύαβψδεφγηιξκλμνοπώρστθωςχυζϊϋΐΰ�"
  },
  "maciceland": {
    "type": "_sbcs",
    "chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûüÝ°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤ÐðÞþý·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"
  },
  "macroman": {
    "type": "_sbcs",
    "chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"
  },
  "macromania": {
    "type": "_sbcs",
    "chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ĂŞ∞±≤≥¥µ∂∑∏π∫ªºΩăş¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤‹›Ţţ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"
  },
  "macthai": {
    "type": "_sbcs",
    "chars": "«»…“”�•‘’� กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู﻿​–—฿เแโใไๅๆ็่้๊๋์ํ™๏๐๑๒๓๔๕๖๗๘๙®©����"
  },
  "macturkish": {
    "type": "_sbcs",
    "chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸĞğİıŞş‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙ�ˆ˜¯˘˙˚¸˝˛ˇ"
  },
  "macukraine": {
    "type": "_sbcs",
    "chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ†°Ґ£§•¶І®©™Ђђ≠Ѓѓ∞±≤≥іµґЈЄєЇїЉљЊњјЅ¬√ƒ≈∆«»… ЋћЌќѕ–—“”‘’÷„ЎўЏџ№Ёёяабвгдежзийклмнопрстуфхцчшщъыьэю¤"
  },
  "koi8r": {
    "type": "_sbcs",
    "chars": "─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥ ⌡°²·÷═║╒ё╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡Ё╢╣╤╥╦╧╨╩╪╫╬©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ"
  },
  "koi8u": {
    "type": "_sbcs",
    "chars": "─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥ ⌡°²·÷═║╒ёє╔ії╗╘╙╚╛ґ╝╞╟╠╡ЁЄ╣ІЇ╦╧╨╩╪Ґ╬©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ"
  },
  "koi8ru": {
    "type": "_sbcs",
    "chars": "─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥ ⌡°²·÷═║╒ёє╔ії╗╘╙╚╛ґў╞╟╠╡ЁЄ╣ІЇ╦╧╨╩╪ҐЎ©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ"
  },
  "koi8t": {
    "type": "_sbcs",
    "chars": "қғ‚Ғ„…†‡�‰ҳ‹ҲҷҶ�Қ‘’“”•–—�™�›�����ӯӮё¤ӣ¦§���«¬­®�°±²Ё�Ӣ¶·�№�»���©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ"
  },
  "armscii8": {
    "type": "_sbcs",
    "chars": " �և։)(»«—.՝,-֊…՜՛՞ԱաԲբԳգԴդԵեԶզԷէԸըԹթԺժԻիԼլԽխԾծԿկՀհՁձՂղՃճՄմՅյՆնՇշՈոՉչՊպՋջՌռՍսՎվՏտՐրՑցՒւՓփՔքՕօՖֆ՚�"
  },
  "rk1048": {
    "type": "_sbcs",
    "chars": "ЂЃ‚ѓ„…†‡€‰Љ‹ЊҚҺЏђ‘’“”•–—�™љ›њқһџ ҰұӘ¤Ө¦§Ё©Ғ«¬­®Ү°±Ііөµ¶·ё№ғ»әҢңүАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя"
  },
  "tcvn": {
    "type": "_sbcs",
    "chars": "\u0000ÚỤ\u0003ỪỬỮ\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010ỨỰỲỶỸÝỴ\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ÀẢÃÁẠẶẬÈẺẼÉẸỆÌỈĨÍỊÒỎÕÓỌỘỜỞỠỚỢÙỦŨ ĂÂÊÔƠƯĐăâêôơưđẶ̀̀̉̃́àảãáạẲằẳẵắẴẮẦẨẪẤỀặầẩẫấậèỂẻẽéẹềểễếệìỉỄẾỒĩíịòỔỏõóọồổỗốộờởỡớợùỖủũúụừửữứựỳỷỹýỵỐ"
  },
  "georgianacademy": {
    "type": "_sbcs",
    "chars": "‚ƒ„…†‡ˆ‰Š‹Œ‘’“”•–—˜™š›œŸ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰჱჲჳჴჵჶçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
  },
  "georgianps": {
    "type": "_sbcs",
    "chars": "‚ƒ„…†‡ˆ‰Š‹Œ‘’“”•–—˜™š›œŸ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿აბგდევზჱთიკლმნჲოპჟრსტჳუფქღყშჩცძწჭხჴჯჰჵæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
  },
  "pt154": {
    "type": "_sbcs",
    "chars": "ҖҒӮғ„…ҶҮҲүҠӢҢҚҺҸҗ‘’“”•–—ҳҷҡӣңқһҹ ЎўЈӨҘҰ§Ё©Ә«¬ӯ®Ҝ°ұІіҙө¶·ё№ә»јҪҫҝАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя"
  },
  "viscii": {
    "type": "_sbcs",
    "chars": "\u0000\u0001Ẳ\u0003\u0004ẴẪ\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013Ỷ\u0015\u0016\u0017\u0018Ỹ\u001a\u001b\u001c\u001dỴ\u001f !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ẠẮẰẶẤẦẨẬẼẸẾỀỂỄỆỐỒỔỖỘỢỚỜỞỊỎỌỈỦŨỤỲÕắằặấầẩậẽẹếềểễệốồổỗỠƠộờởịỰỨỪỬơớƯÀÁÂÃẢĂẳẵÈÉÊẺÌÍĨỳĐứÒÓÔạỷừửÙÚỹỵÝỡưàáâãảăữẫèéêẻìíĩỉđựòóôõỏọụùúũủýợỮ"
  },
  "iso646cn": {
    "type": "_sbcs",
    "chars": "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f !\"#¥%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}‾��������������������������������������������������������������������������������������������������������������������������������"
  },
  "iso646jp": {
    "type": "_sbcs",
    "chars": "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[¥]^_`abcdefghijklmnopqrstuvwxyz{|}‾��������������������������������������������������������������������������������������������������������������������������������"
  },
  "hproman8": {
    "type": "_sbcs",
    "chars": " ÀÂÈÊËÎÏ´ˋˆ¨˜ÙÛ₤¯Ýý°ÇçÑñ¡¿¤£¥§ƒ¢âêôûáéóúàèòùäëöüÅîØÆåíøæÄìÖÜÉïßÔÁÃãÐðÍÌÓÒÕõŠšÚŸÿÞþ·µ¶¾—¼½ªº«■»±�"
  },
  "macintosh": {
    "type": "_sbcs",
    "chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"
  },
  "ascii": {
    "type": "_sbcs",
    "chars": "��������������������������������������������������������������������������������������������������������������������������������"
  },
  "tis620": {
    "type": "_sbcs",
    "chars": "���������������������������������กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����"
  }
}
},{}],30:[function(require,module,exports){
"use strict";

// Manually added data to be used by sbcs codec in addition to generated one.

module.exports = {
    // Not supported by iconv, not sure why.
    "10029": "maccenteuro",
    "maccenteuro": {
        "type": "_sbcs",
        "chars": "ÄĀāÉĄÖÜáąČäčĆćéŹźĎíďĒēĖóėôöõúĚěü†°Ę£§•¶ß®©™ę¨≠ģĮįĪ≤≥īĶ∂∑łĻļĽľĹĺŅņŃ¬√ńŇ∆«»… ňŐÕőŌ–—“”‘’÷◊ōŔŕŘ‹›řŖŗŠ‚„šŚśÁŤťÍŽžŪÓÔūŮÚůŰűŲųÝýķŻŁżĢˇ"
    },

    "808": "cp808",
    "ibm808": "cp808",
    "cp808": {
        "type": "_sbcs",
        "chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀рстуфхцчшщъыьэюяЁёЄєЇїЎў°∙·√№€■ "
    },

    "mik": {
        "type": "_sbcs",
        "chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя└┴┬├─┼╣║╚╔╩╦╠═╬┐░▒▓│┤№§╗╝┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
    },

    "cp720": {
        "type": "_sbcs",
        "chars": "\x80\x81éâ\x84à\x86çêëèïî\x8d\x8e\x8f\x90\u0651\u0652ô¤ـûùءآأؤ£إئابةتثجحخدذرزسشص«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀ضطظعغفµقكلمنهوىي≡\u064b\u064c\u064d\u064e\u064f\u0650≈°∙·√ⁿ²■\u00a0"
    },

    // Aliases of generated encodings.
    "ascii8bit": "ascii",
    "usascii": "ascii",
    "ansix34": "ascii",
    "ansix341968": "ascii",
    "ansix341986": "ascii",
    "csascii": "ascii",
    "cp367": "ascii",
    "ibm367": "ascii",
    "isoir6": "ascii",
    "iso646us": "ascii",
    "iso646irv": "ascii",
    "us": "ascii",

    "latin1": "iso88591",
    "latin2": "iso88592",
    "latin3": "iso88593",
    "latin4": "iso88594",
    "latin5": "iso88599",
    "latin6": "iso885910",
    "latin7": "iso885913",
    "latin8": "iso885914",
    "latin9": "iso885915",
    "latin10": "iso885916",

    "csisolatin1": "iso88591",
    "csisolatin2": "iso88592",
    "csisolatin3": "iso88593",
    "csisolatin4": "iso88594",
    "csisolatincyrillic": "iso88595",
    "csisolatinarabic": "iso88596",
    "csisolatingreek" : "iso88597",
    "csisolatinhebrew": "iso88598",
    "csisolatin5": "iso88599",
    "csisolatin6": "iso885910",

    "l1": "iso88591",
    "l2": "iso88592",
    "l3": "iso88593",
    "l4": "iso88594",
    "l5": "iso88599",
    "l6": "iso885910",
    "l7": "iso885913",
    "l8": "iso885914",
    "l9": "iso885915",
    "l10": "iso885916",

    "isoir14": "iso646jp",
    "isoir57": "iso646cn",
    "isoir100": "iso88591",
    "isoir101": "iso88592",
    "isoir109": "iso88593",
    "isoir110": "iso88594",
    "isoir144": "iso88595",
    "isoir127": "iso88596",
    "isoir126": "iso88597",
    "isoir138": "iso88598",
    "isoir148": "iso88599",
    "isoir157": "iso885910",
    "isoir166": "tis620",
    "isoir179": "iso885913",
    "isoir199": "iso885914",
    "isoir203": "iso885915",
    "isoir226": "iso885916",

    "cp819": "iso88591",
    "ibm819": "iso88591",

    "cyrillic": "iso88595",

    "arabic": "iso88596",
    "arabic8": "iso88596",
    "ecma114": "iso88596",
    "asmo708": "iso88596",

    "greek" : "iso88597",
    "greek8" : "iso88597",
    "ecma118" : "iso88597",
    "elot928" : "iso88597",

    "hebrew": "iso88598",
    "hebrew8": "iso88598",

    "turkish": "iso88599",
    "turkish8": "iso88599",

    "thai": "iso885911",
    "thai8": "iso885911",

    "celtic": "iso885914",
    "celtic8": "iso885914",
    "isoceltic": "iso885914",

    "tis6200": "tis620",
    "tis62025291": "tis620",
    "tis62025330": "tis620",

    "10000": "macroman",
    "10006": "macgreek",
    "10007": "maccyrillic",
    "10079": "maciceland",
    "10081": "macturkish",

    "cspc8codepage437": "cp437",
    "cspc775baltic": "cp775",
    "cspc850multilingual": "cp850",
    "cspcp852": "cp852",
    "cspc862latinhebrew": "cp862",
    "cpgr": "cp869",

    "msee": "cp1250",
    "mscyrl": "cp1251",
    "msansi": "cp1252",
    "msgreek": "cp1253",
    "msturk": "cp1254",
    "mshebr": "cp1255",
    "msarab": "cp1256",
    "winbaltrim": "cp1257",

    "cp20866": "koi8r",
    "20866": "koi8r",
    "ibm878": "koi8r",
    "cskoi8r": "koi8r",

    "cp21866": "koi8u",
    "21866": "koi8u",
    "ibm1168": "koi8u",

    "strk10482002": "rk1048",

    "tcvn5712": "tcvn",
    "tcvn57121": "tcvn",

    "gb198880": "iso646cn",
    "cn": "iso646cn",

    "csiso14jisc6220ro": "iso646jp",
    "jisc62201969ro": "iso646jp",
    "jp": "iso646jp",

    "cshproman8": "hproman8",
    "r8": "hproman8",
    "roman8": "hproman8",
    "xroman8": "hproman8",
    "ibm1051": "hproman8",

    "mac": "macintosh",
    "csmacintosh": "macintosh",
};


},{}],31:[function(require,module,exports){
module.exports=[
["8740","䏰䰲䘃䖦䕸𧉧䵷䖳𧲱䳢𧳅㮕䜶䝄䱇䱀𤊿𣘗𧍒𦺋𧃒䱗𪍑䝏䗚䲅𧱬䴇䪤䚡𦬣爥𥩔𡩣𣸆𣽡晍囻"],
["8767","綕夝𨮹㷴霴𧯯寛𡵞媤㘥𩺰嫑宷峼杮薓𩥅瑡璝㡵𡵓𣚞𦀡㻬"],
["87a1","𥣞㫵竼龗𤅡𨤍𣇪𠪊𣉞䌊蒄龖鐯䤰蘓墖靊鈘秐稲晠権袝瑌篅枂稬剏遆㓦珄𥶹瓆鿇垳䤯呌䄱𣚎堘穲𧭥讏䚮𦺈䆁𥶙箮𢒼鿈𢓁𢓉𢓌鿉蔄𣖻䂴鿊䓡𪷿拁灮鿋"],
["8840","㇀",4,"𠄌㇅𠃑𠃍㇆㇇𠃋𡿨㇈𠃊㇉㇊㇋㇌𠄎㇍㇎ĀÁǍÀĒÉĚÈŌÓǑÒ࿿Ê̄Ế࿿Ê̌ỀÊāáǎàɑēéěèīíǐìōóǒòūúǔùǖǘǚ"],
["88a1","ǜü࿿ê̄ế࿿ê̌ềêɡ⏚⏛"],
["8940","𪎩𡅅"],
["8943","攊"],
["8946","丽滝鵎釟"],
["894c","𧜵撑会伨侨兖兴农凤务动医华发变团声处备夲头学实実岚庆总斉柾栄桥济炼电纤纬纺织经统缆缷艺苏药视设询车轧轮"],
["89a1","琑糼緍楆竉刧"],
["89ab","醌碸酞肼"],
["89b0","贋胶𠧧"],
["89b5","肟黇䳍鷉鸌䰾𩷶𧀎鸊𪄳㗁"],
["89c1","溚舾甙"],
["89c5","䤑马骏龙禇𨑬𡷊𠗐𢫦两亁亀亇亿仫伷㑌侽㹈倃傈㑽㒓㒥円夅凛凼刅争剹劐匧㗇厩㕑厰㕓参吣㕭㕲㚁咓咣咴咹哐哯唘唣唨㖘唿㖥㖿嗗㗅"],
["8a40","𧶄唥"],
["8a43","𠱂𠴕𥄫喐𢳆㧬𠍁蹆𤶸𩓥䁓𨂾睺𢰸㨴䟕𨅝𦧲𤷪擝𠵼𠾴𠳕𡃴撍蹾𠺖𠰋𠽤𢲩𨉖𤓓"],
["8a64","𠵆𩩍𨃩䟴𤺧𢳂骲㩧𩗴㿭㔆𥋇𩟔𧣈𢵄鵮頕"],
["8a76","䏙𦂥撴哣𢵌𢯊𡁷㧻𡁯"],
["8aa1","𦛚𦜖𧦠擪𥁒𠱃蹨𢆡𨭌𠜱"],
["8aac","䠋𠆩㿺塳𢶍"],
["8ab2","𤗈𠓼𦂗𠽌𠶖啹䂻䎺"],
["8abb","䪴𢩦𡂝膪飵𠶜捹㧾𢝵跀嚡摼㹃"],
["8ac9","𪘁𠸉𢫏𢳉"],
["8ace","𡃈𣧂㦒㨆𨊛㕸𥹉𢃇噒𠼱𢲲𩜠㒼氽𤸻"],
["8adf","𧕴𢺋𢈈𪙛𨳍𠹺𠰴𦠜羓𡃏𢠃𢤹㗻𥇣𠺌𠾍𠺪㾓𠼰𠵇𡅏𠹌"],
["8af6","𠺫𠮩𠵈𡃀𡄽㿹𢚖搲𠾭"],
["8b40","𣏴𧘹𢯎𠵾𠵿𢱑𢱕㨘𠺘𡃇𠼮𪘲𦭐𨳒𨶙𨳊閪哌苄喹"],
["8b55","𩻃鰦骶𧝞𢷮煀腭胬尜𦕲脴㞗卟𨂽醶𠻺𠸏𠹷𠻻㗝𤷫㘉𠳖嚯𢞵𡃉𠸐𠹸𡁸𡅈𨈇𡑕𠹹𤹐𢶤婔𡀝𡀞𡃵𡃶垜𠸑"],
["8ba1","𧚔𨋍𠾵𠹻𥅾㜃𠾶𡆀𥋘𪊽𤧚𡠺𤅷𨉼墙剨㘚𥜽箲孨䠀䬬鼧䧧鰟鮍𥭴𣄽嗻㗲嚉丨夂𡯁屮靑𠂆乛亻㔾尣彑忄㣺扌攵歺氵氺灬爫丬犭𤣩罒礻糹罓𦉪㓁"],
["8bde","𦍋耂肀𦘒𦥑卝衤见𧢲讠贝钅镸长门𨸏韦页风飞饣𩠐鱼鸟黄歯龜丷𠂇阝户钢"],
["8c40","倻淾𩱳龦㷉袏𤅎灷峵䬠𥇍㕙𥴰愢𨨲辧釶熑朙玺𣊁𪄇㲋𡦀䬐磤琂冮𨜏䀉橣𪊺䈣蘏𠩯稪𩥇𨫪靕灍匤𢁾鏴盙𨧣龧矝亣俰傼丯众龨吴綋墒壐𡶶庒庙忂𢜒斋"],
["8ca1","𣏹椙橃𣱣泿"],
["8ca7","爀𤔅玌㻛𤨓嬕璹讃𥲤𥚕窓篬糃繬苸薗龩袐龪躹龫迏蕟駠鈡龬𨶹𡐿䁱䊢娚"],
["8cc9","顨杫䉶圽"],
["8cce","藖𤥻芿𧄍䲁𦵴嵻𦬕𦾾龭龮宖龯曧繛湗秊㶈䓃𣉖𢞖䎚䔶"],
["8ce6","峕𣬚諹屸㴒𣕑嵸龲煗䕘𤃬𡸣䱷㥸㑊𠆤𦱁諌侴𠈹妿腬顖𩣺弻"],
["8d40","𠮟"],
["8d42","𢇁𨥭䄂䚻𩁹㼇龳𪆵䃸㟖䛷𦱆䅼𨚲𧏿䕭㣔𥒚䕡䔛䶉䱻䵶䗪㿈𤬏㙡䓞䒽䇭崾嵈嵖㷼㠏嶤嶹㠠㠸幂庽弥徃㤈㤔㤿㥍惗愽峥㦉憷憹懏㦸戬抐拥挘㧸嚱"],
["8da1","㨃揢揻搇摚㩋擀崕嘡龟㪗斆㪽旿晓㫲暒㬢朖㭂枤栀㭘桊梄㭲㭱㭻椉楃牜楤榟榅㮼槖㯝橥橴橱檂㯬檙㯲檫檵櫔櫶殁毁毪汵沪㳋洂洆洦涁㳯涤涱渕渘温溆𨧀溻滢滚齿滨滩漤漴㵆𣽁澁澾㵪㵵熷岙㶊瀬㶑灐灔灯灿炉𠌥䏁㗱𠻘"],
["8e40","𣻗垾𦻓焾𥟠㙎榢𨯩孴穉𥣡𩓙穥穽𥦬窻窰竂竃燑𦒍䇊竚竝竪䇯咲𥰁笋筕笩𥌎𥳾箢筯莜𥮴𦱿篐萡箒箸𥴠㶭𥱥蒒篺簆簵𥳁籄粃𤢂粦晽𤕸糉糇糦籴糳糵糎"],
["8ea1","繧䔝𦹄絝𦻖璍綉綫焵綳緒𤁗𦀩緤㴓緵𡟹緥𨍭縝𦄡𦅚繮纒䌫鑬縧罀罁罇礶𦋐駡羗𦍑羣𡙡𠁨䕜𣝦䔃𨌺翺𦒉者耈耝耨耯𪂇𦳃耻耼聡𢜔䦉𦘦𣷣𦛨朥肧𨩈脇脚墰𢛶汿𦒘𤾸擧𡒊舘𡡞橓𤩥𤪕䑺舩𠬍𦩒𣵾俹𡓽蓢荢𦬊𤦧𣔰𡝳𣷸芪椛芳䇛"],
["8f40","蕋苐茚𠸖𡞴㛁𣅽𣕚艻苢茘𣺋𦶣𦬅𦮗𣗎㶿茝嗬莅䔋𦶥莬菁菓㑾𦻔橗蕚㒖𦹂𢻯葘𥯤葱㷓䓤檧葊𣲵祘蒨𦮖𦹷𦹃蓞萏莑䒠蒓蓤𥲑䉀𥳀䕃蔴嫲𦺙䔧蕳䔖枿蘖"],
["8fa1","𨘥𨘻藁𧂈蘂𡖂𧃍䕫䕪蘨㙈𡢢号𧎚虾蝱𪃸蟮𢰧螱蟚蠏噡虬桖䘏衅衆𧗠𣶹𧗤衞袜䙛袴袵揁装睷𧜏覇覊覦覩覧覼𨨥觧𧤤𧪽誜瞓釾誐𧩙竩𧬺𣾏䜓𧬸煼謌謟𥐰𥕥謿譌譍誩𤩺讐讛誯𡛟䘕衏貛𧵔𧶏貫㜥𧵓賖𧶘𧶽贒贃𡤐賛灜贑𤳉㻐起"],
["9040","趩𨀂𡀔𤦊㭼𨆼𧄌竧躭躶軃鋔輙輭𨍥𨐒辥錃𪊟𠩐辳䤪𨧞𨔽𣶻廸𣉢迹𪀔𨚼𨔁𢌥㦀𦻗逷𨔼𧪾遡𨕬𨘋邨𨜓郄𨛦邮都酧㫰醩釄粬𨤳𡺉鈎沟鉁鉢𥖹銹𨫆𣲛𨬌𥗛"],
["90a1","𠴱錬鍫𨫡𨯫炏嫃𨫢𨫥䥥鉄𨯬𨰹𨯿鍳鑛躼閅閦鐦閠濶䊹𢙺𨛘𡉼𣸮䧟氜陻隖䅬隣𦻕懚隶磵𨫠隽双䦡𦲸𠉴𦐐𩂯𩃥𤫑𡤕𣌊霱虂霶䨏䔽䖅𤫩灵孁霛靜𩇕靗孊𩇫靟鐥僐𣂷𣂼鞉鞟鞱鞾韀韒韠𥑬韮琜𩐳響韵𩐝𧥺䫑頴頳顋顦㬎𧅵㵑𠘰𤅜"],
["9140","𥜆飊颷飈飇䫿𦴧𡛓喰飡飦飬鍸餹𤨩䭲𩡗𩤅駵騌騻騐驘𥜥㛄𩂱𩯕髠髢𩬅髴䰎鬔鬭𨘀倴鬴𦦨㣃𣁽魐魀𩴾婅𡡣鮎𤉋鰂鯿鰌𩹨鷔𩾷𪆒𪆫𪃡𪄣𪇟鵾鶃𪄴鸎梈"],
["91a1","鷄𢅛𪆓𪈠𡤻𪈳鴹𪂹𪊴麐麕麞麢䴴麪麯𤍤黁㭠㧥㴝伲㞾𨰫鼂鼈䮖鐤𦶢鼗鼖鼹嚟嚊齅馸𩂋韲葿齢齩竜龎爖䮾𤥵𤦻煷𤧸𤍈𤩑玞𨯚𡣺禟𨥾𨸶鍩鏳𨩄鋬鎁鏋𨥬𤒹爗㻫睲穃烐𤑳𤏸煾𡟯炣𡢾𣖙㻇𡢅𥐯𡟸㜢𡛻𡠹㛡𡝴𡣑𥽋㜣𡛀坛𤨥𡏾𡊨"],
["9240","𡏆𡒶蔃𣚦蔃葕𤦔𧅥𣸱𥕜𣻻𧁒䓴𣛮𩦝𦼦柹㜳㰕㷧塬𡤢栐䁗𣜿𤃡𤂋𤄏𦰡哋嚞𦚱嚒𠿟𠮨𠸍鏆𨬓鎜仸儫㠙𤐶亼𠑥𠍿佋侊𥙑婨𠆫𠏋㦙𠌊𠐔㐵伩𠋀𨺳𠉵諚𠈌亘"],
["92a1","働儍侢伃𤨎𣺊佂倮偬傁俌俥偘僼兙兛兝兞湶𣖕𣸹𣺿浲𡢄𣺉冨凃𠗠䓝𠒣𠒒𠒑赺𨪜𠜎剙劤𠡳勡鍮䙺熌𤎌𠰠𤦬𡃤槑𠸝瑹㻞璙琔瑖玘䮎𤪼𤂍叐㖄爏𤃉喴𠍅响𠯆圝鉝雴鍦埝垍坿㘾壋媙𨩆𡛺𡝯𡜐娬妸銏婾嫏娒𥥆𡧳𡡡𤊕㛵洅瑃娡𥺃"],
["9340","媁𨯗𠐓鏠璌𡌃焅䥲鐈𨧻鎽㞠尞岞幞幈𡦖𡥼𣫮廍孏𡤃𡤄㜁𡢠㛝𡛾㛓脪𨩇𡶺𣑲𨦨弌弎𡤧𡞫婫𡜻孄蘔𧗽衠恾𢡠𢘫忛㺸𢖯𢖾𩂈𦽳懀𠀾𠁆𢘛憙憘恵𢲛𢴇𤛔𩅍"],
["93a1","摱𤙥𢭪㨩𢬢𣑐𩣪𢹸挷𪑛撶挱揑𤧣𢵧护𢲡搻敫楲㯴𣂎𣊭𤦉𣊫唍𣋠𡣙𩐿曎𣊉𣆳㫠䆐𥖄𨬢𥖏𡛼𥕛𥐥磮𣄃𡠪𣈴㑤𣈏𣆂𤋉暎𦴤晫䮓昰𧡰𡷫晣𣋒𣋡昞𥡲㣑𣠺𣞼㮙𣞢𣏾瓐㮖枏𤘪梶栞㯄檾㡣𣟕𤒇樳橒櫉欅𡤒攑梘橌㯗橺歗𣿀𣲚鎠鋲𨯪𨫋"],
["9440","銉𨀞𨧜鑧涥漋𤧬浧𣽿㶏渄𤀼娽渊塇洤硂焻𤌚𤉶烱牐犇犔𤞏𤜥兹𤪤𠗫瑺𣻸𣙟𤩊𤤗𥿡㼆㺱𤫟𨰣𣼵悧㻳瓌琼鎇琷䒟𦷪䕑疃㽣𤳙𤴆㽘畕癳𪗆㬙瑨𨫌𤦫𤦎㫻"],
["94a1","㷍𤩎㻿𤧅𤣳釺圲鍂𨫣𡡤僟𥈡𥇧睸𣈲眎眏睻𤚗𣞁㩞𤣰琸璛㺿𤪺𤫇䃈𤪖𦆮錇𥖁砞碍碈磒珐祙𧝁𥛣䄎禛蒖禥樭𣻺稺秴䅮𡛦䄲鈵秱𠵌𤦌𠊙𣶺𡝮㖗啫㕰㚪𠇔𠰍竢婙𢛵𥪯𥪜娍𠉛磰娪𥯆竾䇹籝籭䈑𥮳𥺼𥺦糍𤧹𡞰粎籼粮檲緜縇緓罎𦉡"],
["9540","𦅜𧭈綗𥺂䉪𦭵𠤖柖𠁎𣗏埄𦐒𦏸𤥢翝笧𠠬𥫩𥵃笌𥸎駦虅驣樜𣐿㧢𤧷𦖭騟𦖠蒀𧄧𦳑䓪脷䐂胆脉腂𦞴飃𦩂艢艥𦩑葓𦶧蘐𧈛媆䅿𡡀嬫𡢡嫤𡣘蚠蜨𣶏蠭𧐢娂"],
["95a1","衮佅袇袿裦襥襍𥚃襔𧞅𧞄𨯵𨯙𨮜𨧹㺭蒣䛵䛏㟲訽訜𩑈彍鈫𤊄旔焩烄𡡅鵭貟賩𧷜妚矃姰䍮㛔踪躧𤰉輰轊䋴汘澻𢌡䢛潹溋𡟚鯩㚵𤤯邻邗啱䤆醻鐄𨩋䁢𨫼鐧𨰝𨰻蓥訫閙閧閗閖𨴴瑅㻂𤣿𤩂𤏪㻧𣈥随𨻧𨹦𨹥㻌𤧭𤩸𣿮琒瑫㻼靁𩂰"],
["9640","桇䨝𩂓𥟟靝鍨𨦉𨰦𨬯𦎾銺嬑譩䤼珹𤈛鞛靱餸𠼦巁𨯅𤪲頟𩓚鋶𩗗釥䓀𨭐𤩧𨭤飜𨩅㼀鈪䤥萔餻饍𧬆㷽馛䭯馪驜𨭥𥣈檏騡嫾騯𩣱䮐𩥈馼䮽䮗鍽塲𡌂堢𤦸"],
["96a1","𡓨硄𢜟𣶸棅㵽鑘㤧慐𢞁𢥫愇鱏鱓鱻鰵鰐魿鯏𩸭鮟𪇵𪃾鴡䲮𤄄鸘䲰鴌𪆴𪃭𪃳𩤯鶥蒽𦸒𦿟𦮂藼䔳𦶤𦺄𦷰萠藮𦸀𣟗𦁤秢𣖜𣙀䤭𤧞㵢鏛銾鍈𠊿碹鉷鑍俤㑀遤𥕝砽硔碶硋𡝗𣇉𤥁㚚佲濚濙瀞瀞吔𤆵垻壳垊鴖埗焴㒯𤆬燫𦱀𤾗嬨𡞵𨩉"],
["9740","愌嫎娋䊼𤒈㜬䭻𨧼鎻鎸𡣖𠼝葲𦳀𡐓𤋺𢰦𤏁妔𣶷𦝁綨𦅛𦂤𤦹𤦋𨧺鋥珢㻩璴𨭣𡢟㻡𤪳櫘珳珻㻖𤨾𤪔𡟙𤩦𠎧𡐤𤧥瑈𤤖炥𤥶銄珦鍟𠓾錱𨫎𨨖鎆𨯧𥗕䤵𨪂煫"],
["97a1","𤥃𠳿嚤𠘚𠯫𠲸唂秄𡟺緾𡛂𤩐𡡒䔮鐁㜊𨫀𤦭妰𡢿𡢃𧒄媡㛢𣵛㚰鉟婹𨪁𡡢鍴㳍𠪴䪖㦊僴㵩㵌𡎜煵䋻𨈘渏𩃤䓫浗𧹏灧沯㳖𣿭𣸭渂漌㵯𠏵畑㚼㓈䚀㻚䡱姄鉮䤾轁𨰜𦯀堒埈㛖𡑒烾𤍢𤩱𢿣𡊰𢎽梹楧𡎘𣓥𧯴𣛟𨪃𣟖𣏺𤲟樚𣚭𦲷萾䓟䓎"],
["9840","𦴦𦵑𦲂𦿞漗𧄉茽𡜺菭𦲀𧁓𡟛妉媂𡞳婡婱𡤅𤇼㜭姯𡜼㛇熎鎐暚𤊥婮娫𤊓樫𣻹𧜶𤑛𤋊焝𤉙𨧡侰𦴨峂𤓎𧹍𤎽樌𤉖𡌄炦焳𤏩㶥泟勇𤩏繥姫崯㷳彜𤩝𡟟綤萦"],
["98a1","咅𣫺𣌀𠈔坾𠣕𠘙㿥𡾞𪊶瀃𩅛嵰玏糓𨩙𩐠俈翧狍猐𧫴猸猹𥛶獁獈㺩𧬘遬燵𤣲珡臶㻊県㻑沢国琙琞琟㻢㻰㻴㻺瓓㼎㽓畂畭畲疍㽼痈痜㿀癍㿗癴㿜発𤽜熈嘣覀塩䀝睃䀹条䁅㗛瞘䁪䁯属瞾矋売砘点砜䂨砹硇硑硦葈𥔵礳栃礲䄃"],
["9940","䄉禑禙辻稆込䅧窑䆲窼艹䇄竏竛䇏両筢筬筻簒簛䉠䉺类粜䊌粸䊔糭输烀𠳏総緔緐緽羮羴犟䎗耠耥笹耮耱联㷌垴炠肷胩䏭脌猪脎脒畠脔䐁㬹腖腙腚"],
["99a1","䐓堺腼膄䐥膓䐭膥埯臁臤艔䒏芦艶苊苘苿䒰荗险榊萅烵葤惣蒈䔄蒾蓡蓸蔐蔸蕒䔻蕯蕰藠䕷虲蚒蚲蛯际螋䘆䘗袮裿褤襇覑𧥧訩訸誔誴豑賔賲贜䞘塟跃䟭仮踺嗘坔蹱嗵躰䠷軎転軤軭軲辷迁迊迌逳駄䢭飠鈓䤞鈨鉘鉫銱銮銿"],
["9a40","鋣鋫鋳鋴鋽鍃鎄鎭䥅䥑麿鐗匁鐝鐭鐾䥪鑔鑹锭関䦧间阳䧥枠䨤靀䨵鞲韂噔䫤惨颹䬙飱塄餎餙冴餜餷饂饝饢䭰駅䮝騼鬏窃魩鮁鯝鯱鯴䱭鰠㝯𡯂鵉鰺"],
["9aa1","黾噐鶓鶽鷀鷼银辶鹻麬麱麽黆铜黢黱黸竈齄𠂔𠊷𠎠椚铃妬𠓗塀铁㞹𠗕𠘕𠙶𡚺块煳𠫂𠫍𠮿呪吆𠯋咞𠯻𠰻𠱓𠱥𠱼惧𠲍噺𠲵𠳝𠳭𠵯𠶲𠷈楕鰯螥𠸄𠸎𠻗𠾐𠼭𠹳尠𠾼帋𡁜𡁏𡁶朞𡁻𡂈𡂖㙇𡂿𡃓𡄯𡄻卤蒭𡋣𡍵𡌶讁𡕷𡘙𡟃𡟇乸炻𡠭𡥪"],
["9b40","𡨭𡩅𡰪𡱰𡲬𡻈拃𡻕𡼕熘桕𢁅槩㛈𢉼𢏗𢏺𢜪𢡱𢥏苽𢥧𢦓𢫕覥𢫨辠𢬎鞸𢬿顇骽𢱌"],
["9b62","𢲈𢲷𥯨𢴈𢴒𢶷𢶕𢹂𢽴𢿌𣀳𣁦𣌟𣏞徱晈暿𧩹𣕧𣗳爁𤦺矗𣘚𣜖纇𠍆墵朎"],
["9ba1","椘𣪧𧙗𥿢𣸑𣺹𧗾𢂚䣐䪸𤄙𨪚𤋮𤌍𤀻𤌴𤎖𤩅𠗊凒𠘑妟𡺨㮾𣳿𤐄𤓖垈𤙴㦛𤜯𨗨𩧉㝢𢇃譞𨭎駖𤠒𤣻𤨕爉𤫀𠱸奥𤺥𤾆𠝹軚𥀬劏圿煱𥊙𥐙𣽊𤪧喼𥑆𥑮𦭒釔㑳𥔿𧘲𥕞䜘𥕢𥕦𥟇𤤿𥡝偦㓻𣏌惞𥤃䝼𨥈𥪮𥮉𥰆𡶐垡煑澶𦄂𧰒遖𦆲𤾚譢𦐂𦑊"],
["9c40","嵛𦯷輶𦒄𡤜諪𤧶𦒈𣿯𦔒䯀𦖿𦚵𢜛鑥𥟡憕娧晉侻嚹𤔡𦛼乪𤤴陖涏𦲽㘘襷𦞙𦡮𦐑𦡞營𦣇筂𩃀𠨑𦤦鄄𦤹穅鷰𦧺騦𦨭㙟𦑩𠀡禃𦨴𦭛崬𣔙菏𦮝䛐𦲤画补𦶮墶"],
["9ca1","㜜𢖍𧁋𧇍㱔𧊀𧊅銁𢅺𧊋錰𧋦𤧐氹钟𧑐𠻸蠧裵𢤦𨑳𡞱溸𤨪𡠠㦤㚹尐秣䔿暶𩲭𩢤襃𧟌𧡘囖䃟𡘊㦡𣜯𨃨𡏅熭荦𧧝𩆨婧䲷𧂯𨦫𧧽𧨊𧬋𧵦𤅺筃祾𨀉澵𪋟樃𨌘厢𦸇鎿栶靝𨅯𨀣𦦵𡏭𣈯𨁈嶅𨰰𨂃圕頣𨥉嶫𤦈斾槕叒𤪥𣾁㰑朶𨂐𨃴𨄮𡾡𨅏"],
["9d40","𨆉𨆯𨈚𨌆𨌯𨎊㗊𨑨𨚪䣺揦𨥖砈鉕𨦸䏲𨧧䏟𨧨𨭆𨯔姸𨰉輋𨿅𩃬筑𩄐𩄼㷷𩅞𤫊运犏嚋𩓧𩗩𩖰𩖸𩜲𩣑𩥉𩥪𩧃𩨨𩬎𩵚𩶛纟𩻸𩼣䲤镇𪊓熢𪋿䶑递𪗋䶜𠲜达嗁"],
["9da1","辺𢒰边𤪓䔉繿潖檱仪㓤𨬬𧢝㜺躀𡟵𨀤𨭬𨮙𧨾𦚯㷫𧙕𣲷𥘵𥥖亚𥺁𦉘嚿𠹭踎孭𣺈𤲞揞拐𡟶𡡻攰嘭𥱊吚𥌑㷆𩶘䱽嘢嘞罉𥻘奵𣵀蝰东𠿪𠵉𣚺脗鵞贘瘻鱅癎瞹鍅吲腈苷嘥脲萘肽嗪祢噃吖𠺝㗎嘅嗱曱𨋢㘭甴嗰喺咗啲𠱁𠲖廐𥅈𠹶𢱢"],
["9e40","𠺢麫絚嗞𡁵抝靭咔賍燶酶揼掹揾啩𢭃鱲𢺳冚㓟𠶧冧呍唞唓癦踭𦢊疱肶蠄螆裇膶萜𡃁䓬猄𤜆宐茋𦢓噻𢛴𧴯𤆣𧵳𦻐𧊶酰𡇙鈈𣳼𪚩𠺬𠻹牦𡲢䝎𤿂𧿹𠿫䃺"],
["9ea1","鱝攟𢶠䣳𤟠𩵼𠿬𠸊恢𧖣𠿭"],
["9ead","𦁈𡆇熣纎鵐业丄㕷嬍沲卧㚬㧜卽㚥𤘘墚𤭮舭呋垪𥪕𠥹"],
["9ec5","㩒𢑥獴𩺬䴉鯭𣳾𩼰䱛𤾩𩖞𩿞葜𣶶𧊲𦞳𣜠挮紥𣻷𣸬㨪逈勌㹴㙺䗩𠒎癀嫰𠺶硺𧼮墧䂿噼鮋嵴癔𪐴麅䳡痹㟻愙𣃚𤏲"],
["9ef5","噝𡊩垧𤥣𩸆刴𧂮㖭汊鵼"],
["9f40","籖鬹埞𡝬屓擓𩓐𦌵𧅤蚭𠴨𦴢𤫢𠵱"],
["9f4f","凾𡼏嶎霃𡷑麁遌笟鬂峑箣扨挵髿篏鬪籾鬮籂粆鰕篼鬉鼗鰛𤤾齚啳寃俽麘俲剠㸆勑坧偖妷帒韈鶫轜呩鞴饀鞺匬愰"],
["9fa1","椬叚鰊鴂䰻陁榀傦畆𡝭駚剳"],
["9fae","酙隁酜"],
["9fb2","酑𨺗捿𦴣櫊嘑醎畺抅𠏼獏籰𥰡𣳽"],
["9fc1","𤤙盖鮝个𠳔莾衂"],
["9fc9","届槀僭坺刟巵从氱𠇲伹咜哚劚趂㗾弌㗳"],
["9fdb","歒酼龥鮗頮颴骺麨麄煺笔"],
["9fe7","毺蠘罸"],
["9feb","嘠𪙊蹷齓"],
["9ff0","跔蹏鸜踁抂𨍽踨蹵竓𤩷稾磘泪詧瘇"],
["a040","𨩚鼦泎蟖痃𪊲硓咢贌狢獱謭猂瓱賫𤪻蘯徺袠䒷"],
["a055","𡠻𦸅"],
["a058","詾𢔛"],
["a05b","惽癧髗鵄鍮鮏蟵"],
["a063","蠏賷猬霡鮰㗖犲䰇籑饊𦅙慙䰄麖慽"],
["a073","坟慯抦戹拎㩜懢厪𣏵捤栂㗒"],
["a0a1","嵗𨯂迚𨸹"],
["a0a6","僙𡵆礆匲阸𠼻䁥"],
["a0ae","矾"],
["a0b0","糂𥼚糚稭聦聣絍甅瓲覔舚朌聢𧒆聛瓰脃眤覉𦟌畓𦻑螩蟎臈螌詉貭譃眫瓸蓚㘵榲趦"],
["a0d4","覩瑨涹蟁𤀑瓧㷛煶悤憜㳑煢恷"],
["a0e2","罱𨬭牐惩䭾删㰘𣳇𥻗𧙖𥔱𡥄𡋾𩤃𦷜𧂭峁𦆭𨨏𣙷𠃮𦡆𤼎䕢嬟𦍌齐麦𦉫"],
["a3c0","␀",31,"␡"],
["c6a1","①",9,"⑴",9,"ⅰ",9,"丶丿亅亠冂冖冫勹匸卩厶夊宀巛⼳广廴彐彡攴无疒癶辵隶¨ˆヽヾゝゞ〃仝々〆〇ー［］✽ぁ",23],
["c740","す",58,"ァアィイ"],
["c7a1","ゥ",81,"А",5,"ЁЖ",4],
["c840","Л",26,"ёж",25,"⇧↸↹㇏𠃌乚𠂊刂䒑"],
["c8a1","龰冈龱𧘇"],
["c8cd","￢￤＇＂㈱№℡゛゜⺀⺄⺆⺇⺈⺊⺌⺍⺕⺜⺝⺥⺧⺪⺬⺮⺶⺼⺾⻆⻊⻌⻍⻏⻖⻗⻞⻣"],
["c8f5","ʃɐɛɔɵœøŋʊɪ"],
["f9fe","￭"],
["fa40","𠕇鋛𠗟𣿅蕌䊵珯况㙉𤥂𨧤鍄𡧛苮𣳈砼杄拟𤤳𨦪𠊠𦮳𡌅侫𢓭倈𦴩𧪄𣘀𤪱𢔓倩𠍾徤𠎀𠍇滛𠐟偽儁㑺儎顬㝃萖𤦤𠒇兠𣎴兪𠯿𢃼𠋥𢔰𠖎𣈳𡦃宂蝽𠖳𣲙冲冸"],
["faa1","鴴凉减凑㳜凓𤪦决凢卂凭菍椾𣜭彻刋刦刼劵剗劔効勅簕蕂勠蘍𦬓包𨫞啉滙𣾀𠥔𣿬匳卄𠯢泋𡜦栛珕恊㺪㣌𡛨燝䒢卭却𨚫卾卿𡖖𡘓矦厓𨪛厠厫厮玧𥝲㽙玜叁叅汉义埾叙㪫𠮏叠𣿫𢶣叶𠱷吓灹唫晗浛呭𦭓𠵴啝咏咤䞦𡜍𠻝㶴𠵍"],
["fb40","𨦼𢚘啇䳭启琗喆喩嘅𡣗𤀺䕒𤐵暳𡂴嘷曍𣊊暤暭噍噏磱囱鞇叾圀囯园𨭦㘣𡉏坆𤆥汮炋坂㚱𦱾埦𡐖堃𡑔𤍣堦𤯵塜墪㕡壠壜𡈼壻寿坃𪅐𤉸鏓㖡够梦㛃湙"],
["fba1","𡘾娤啓𡚒蔅姉𠵎𦲁𦴪𡟜姙𡟻𡞲𦶦浱𡠨𡛕姹𦹅媫婣㛦𤦩婷㜈媖瑥嫓𦾡𢕔㶅𡤑㜲𡚸広勐孶斈孼𧨎䀄䡝𠈄寕慠𡨴𥧌𠖥寳宝䴐尅𡭄尓珎尔𡲥𦬨屉䣝岅峩峯嶋𡷹𡸷崐崘嵆𡺤岺巗苼㠭𤤁𢁉𢅳芇㠶㯂帮檊幵幺𤒼𠳓厦亷廐厨𡝱帉廴𨒂"],
["fc40","廹廻㢠廼栾鐛弍𠇁弢㫞䢮𡌺强𦢈𢏐彘𢑱彣鞽𦹮彲鍀𨨶徧嶶㵟𥉐𡽪𧃸𢙨釖𠊞𨨩怱暅𡡷㥣㷇㘹垐𢞴祱㹀悞悤悳𤦂𤦏𧩓璤僡媠慤萤慂慈𦻒憁凴𠙖憇宪𣾷"],
["fca1","𢡟懓𨮝𩥝懐㤲𢦀𢣁怣慜攞掋𠄘担𡝰拕𢸍捬𤧟㨗搸揸𡎎𡟼撐澊𢸶頔𤂌𥜝擡擥鑻㩦携㩗敍漖𤨨𤨣斅敭敟𣁾斵𤥀䬷旑䃘𡠩无旣忟𣐀昘𣇷𣇸晄𣆤𣆥晋𠹵晧𥇦晳晴𡸽𣈱𨗴𣇈𥌓矅𢣷馤朂𤎜𤨡㬫槺𣟂杞杧杢𤇍𩃭柗䓩栢湐鈼栁𣏦𦶠桝"],
["fd40","𣑯槡樋𨫟楳棃𣗍椁椀㴲㨁𣘼㮀枬楡𨩊䋼椶榘㮡𠏉荣傐槹𣙙𢄪橅𣜃檝㯳枱櫈𩆜㰍欝𠤣惞欵歴𢟍溵𣫛𠎵𡥘㝀吡𣭚毡𣻼毜氷𢒋𤣱𦭑汚舦汹𣶼䓅𣶽𤆤𤤌𤤀"],
["fda1","𣳉㛥㳫𠴲鮃𣇹𢒑羏样𦴥𦶡𦷫涖浜湼漄𤥿𤂅𦹲蔳𦽴凇沜渝萮𨬡港𣸯瑓𣾂秌湏媑𣁋濸㜍澝𣸰滺𡒗𤀽䕕鏰潄潜㵎潴𩅰㴻澟𤅄濓𤂑𤅕𤀹𣿰𣾴𤄿凟𤅖𤅗𤅀𦇝灋灾炧炁烌烕烖烟䄄㷨熴熖𤉷焫煅媈煊煮岜𤍥煏鍢𤋁焬𤑚𤨧𤨢熺𨯨炽爎"],
["fe40","鑂爕夑鑃爤鍁𥘅爮牀𤥴梽牕牗㹕𣁄栍漽犂猪猫𤠣𨠫䣭𨠄猨献珏玪𠰺𦨮珉瑉𤇢𡛧𤨤昣㛅𤦷𤦍𤧻珷琕椃𤨦琹𠗃㻗瑜𢢭瑠𨺲瑇珤瑶莹瑬㜰瑴鏱樬璂䥓𤪌"],
["fea1","𤅟𤩹𨮏孆𨰃𡢞瓈𡦈甎瓩甞𨻙𡩋寗𨺬鎅畍畊畧畮𤾂㼄𤴓疎瑝疞疴瘂瘬癑癏癯癶𦏵皐臯㟸𦤑𦤎皡皥皷盌𦾟葢𥂝𥅽𡸜眞眦着撯𥈠睘𣊬瞯𨥤𨥨𡛁矴砉𡍶𤨒棊碯磇磓隥礮𥗠磗礴碱𧘌辸袄𨬫𦂃𢘜禆褀椂禀𥡗禝𧬹礼禩渪𧄦㺨秆𩄍秔"]
]

},{}],32:[function(require,module,exports){
module.exports=[
["0","\u0000",127,"€"],
["8140","丂丄丅丆丏丒丗丟丠両丣並丩丮丯丱丳丵丷丼乀乁乂乄乆乊乑乕乗乚乛乢乣乤乥乧乨乪",5,"乲乴",9,"乿",6,"亇亊"],
["8180","亐亖亗亙亜亝亞亣亪亯亰亱亴亶亷亸亹亼亽亾仈仌仏仐仒仚仛仜仠仢仦仧仩仭仮仯仱仴仸仹仺仼仾伀伂",6,"伋伌伒",4,"伜伝伡伣伨伩伬伭伮伱伳伵伷伹伻伾",4,"佄佅佇",5,"佒佔佖佡佢佦佨佪佫佭佮佱佲併佷佸佹佺佽侀侁侂侅來侇侊侌侎侐侒侓侕侖侘侙侚侜侞侟価侢"],
["8240","侤侫侭侰",4,"侶",8,"俀俁係俆俇俈俉俋俌俍俒",4,"俙俛俠俢俤俥俧俫俬俰俲俴俵俶俷俹俻俼俽俿",11],
["8280","個倎倐們倓倕倖倗倛倝倞倠倢倣値倧倫倯",10,"倻倽倿偀偁偂偄偅偆偉偊偋偍偐",4,"偖偗偘偙偛偝",7,"偦",5,"偭",8,"偸偹偺偼偽傁傂傃傄傆傇傉傊傋傌傎",20,"傤傦傪傫傭",4,"傳",6,"傼"],
["8340","傽",17,"僐",5,"僗僘僙僛",10,"僨僩僪僫僯僰僱僲僴僶",4,"僼",9,"儈"],
["8380","儉儊儌",5,"儓",13,"儢",28,"兂兇兊兌兎兏児兒兓兗兘兙兛兝",4,"兣兤兦內兩兪兯兲兺兾兿冃冄円冇冊冋冎冏冐冑冓冔冘冚冝冞冟冡冣冦",4,"冭冮冴冸冹冺冾冿凁凂凃凅凈凊凍凎凐凒",5],
["8440","凘凙凚凜凞凟凢凣凥",5,"凬凮凱凲凴凷凾刄刅刉刋刌刏刐刓刔刕刜刞刟刡刢刣別刦刧刪刬刯刱刲刴刵刼刾剄",5,"剋剎剏剒剓剕剗剘"],
["8480","剙剚剛剝剟剠剢剣剤剦剨剫剬剭剮剰剱剳",9,"剾劀劃",4,"劉",6,"劑劒劔",6,"劜劤劥劦劧劮劯劰労",9,"勀勁勂勄勅勆勈勊勌勍勎勏勑勓勔動勗務",5,"勠勡勢勣勥",10,"勱",7,"勻勼勽匁匂匃匄匇匉匊匋匌匎"],
["8540","匑匒匓匔匘匛匜匞匟匢匤匥匧匨匩匫匬匭匯",9,"匼匽區卂卄卆卋卌卍卐協単卙卛卝卥卨卪卬卭卲卶卹卻卼卽卾厀厁厃厇厈厊厎厏"],
["8580","厐",4,"厖厗厙厛厜厞厠厡厤厧厪厫厬厭厯",6,"厷厸厹厺厼厽厾叀參",4,"収叏叐叒叓叕叚叜叝叞叡叢叧叴叺叾叿吀吂吅吇吋吔吘吙吚吜吢吤吥吪吰吳吶吷吺吽吿呁呂呄呅呇呉呌呍呎呏呑呚呝",4,"呣呥呧呩",7,"呴呹呺呾呿咁咃咅咇咈咉咊咍咑咓咗咘咜咞咟咠咡"],
["8640","咢咥咮咰咲咵咶咷咹咺咼咾哃哅哊哋哖哘哛哠",4,"哫哬哯哰哱哴",5,"哻哾唀唂唃唄唅唈唊",4,"唒唓唕",5,"唜唝唞唟唡唥唦"],
["8680","唨唩唫唭唲唴唵唶唸唹唺唻唽啀啂啅啇啈啋",4,"啑啒啓啔啗",4,"啝啞啟啠啢啣啨啩啫啯",5,"啹啺啽啿喅喆喌喍喎喐喒喓喕喖喗喚喛喞喠",6,"喨",8,"喲喴営喸喺喼喿",4,"嗆嗇嗈嗊嗋嗎嗏嗐嗕嗗",4,"嗞嗠嗢嗧嗩嗭嗮嗰嗱嗴嗶嗸",4,"嗿嘂嘃嘄嘅"],
["8740","嘆嘇嘊嘋嘍嘐",7,"嘙嘚嘜嘝嘠嘡嘢嘥嘦嘨嘩嘪嘫嘮嘯嘰嘳嘵嘷嘸嘺嘼嘽嘾噀",11,"噏",4,"噕噖噚噛噝",4],
["8780","噣噥噦噧噭噮噯噰噲噳噴噵噷噸噹噺噽",7,"嚇",6,"嚐嚑嚒嚔",14,"嚤",10,"嚰",6,"嚸嚹嚺嚻嚽",12,"囋",8,"囕囖囘囙囜団囥",5,"囬囮囯囲図囶囷囸囻囼圀圁圂圅圇國",6],
["8840","園",9,"圝圞圠圡圢圤圥圦圧圫圱圲圴",4,"圼圽圿坁坃坄坅坆坈坉坋坒",4,"坘坙坢坣坥坧坬坮坰坱坲坴坵坸坹坺坽坾坿垀"],
["8880","垁垇垈垉垊垍",4,"垔",6,"垜垝垞垟垥垨垪垬垯垰垱垳垵垶垷垹",8,"埄",6,"埌埍埐埑埓埖埗埛埜埞埡埢埣埥",7,"埮埰埱埲埳埵埶執埻埼埾埿堁堃堄堅堈堉堊堌堎堏堐堒堓堔堖堗堘堚堛堜堝堟堢堣堥",4,"堫",4,"報堲堳場堶",7],
["8940","堾",5,"塅",6,"塎塏塐塒塓塕塖塗塙",4,"塟",5,"塦",4,"塭",16,"塿墂墄墆墇墈墊墋墌"],
["8980","墍",4,"墔",4,"墛墜墝墠",7,"墪",17,"墽墾墿壀壂壃壄壆",10,"壒壓壔壖",13,"壥",5,"壭壯壱売壴壵壷壸壺",7,"夃夅夆夈",4,"夎夐夑夒夓夗夘夛夝夞夠夡夢夣夦夨夬夰夲夳夵夶夻"],
["8a40","夽夾夿奀奃奅奆奊奌奍奐奒奓奙奛",4,"奡奣奤奦",12,"奵奷奺奻奼奾奿妀妅妉妋妌妎妏妐妑妔妕妘妚妛妜妝妟妠妡妢妦"],
["8a80","妧妬妭妰妱妳",5,"妺妼妽妿",6,"姇姈姉姌姍姎姏姕姖姙姛姞",4,"姤姦姧姩姪姫姭",11,"姺姼姽姾娀娂娊娋娍娎娏娐娒娔娕娖娗娙娚娛娝娞娡娢娤娦娧娨娪",6,"娳娵娷",4,"娽娾娿婁",4,"婇婈婋",9,"婖婗婘婙婛",5],
["8b40","婡婣婤婥婦婨婩婫",8,"婸婹婻婼婽婾媀",17,"媓",6,"媜",13,"媫媬"],
["8b80","媭",4,"媴媶媷媹",4,"媿嫀嫃",5,"嫊嫋嫍",4,"嫓嫕嫗嫙嫚嫛嫝嫞嫟嫢嫤嫥嫧嫨嫪嫬",4,"嫲",22,"嬊",11,"嬘",25,"嬳嬵嬶嬸",7,"孁",6],
["8c40","孈",7,"孒孖孞孠孡孧孨孫孭孮孯孲孴孶孷學孹孻孼孾孿宂宆宊宍宎宐宑宒宔宖実宧宨宩宬宭宮宯宱宲宷宺宻宼寀寁寃寈寉寊寋寍寎寏"],
["8c80","寑寔",8,"寠寢寣實寧審",4,"寯寱",6,"寽対尀専尃尅將專尋尌對導尐尒尓尗尙尛尞尟尠尡尣尦尨尩尪尫尭尮尯尰尲尳尵尶尷屃屄屆屇屌屍屒屓屔屖屗屘屚屛屜屝屟屢層屧",6,"屰屲",6,"屻屼屽屾岀岃",4,"岉岊岋岎岏岒岓岕岝",4,"岤",4],
["8d40","岪岮岯岰岲岴岶岹岺岻岼岾峀峂峃峅",5,"峌",5,"峓",5,"峚",6,"峢峣峧峩峫峬峮峯峱",9,"峼",4],
["8d80","崁崄崅崈",5,"崏",4,"崕崗崘崙崚崜崝崟",4,"崥崨崪崫崬崯",4,"崵",7,"崿",7,"嵈嵉嵍",10,"嵙嵚嵜嵞",10,"嵪嵭嵮嵰嵱嵲嵳嵵",12,"嶃",21,"嶚嶛嶜嶞嶟嶠"],
["8e40","嶡",21,"嶸",12,"巆",6,"巎",12,"巜巟巠巣巤巪巬巭"],
["8e80","巰巵巶巸",4,"巿帀帄帇帉帊帋帍帎帒帓帗帞",7,"帨",4,"帯帰帲",4,"帹帺帾帿幀幁幃幆",5,"幍",6,"幖",4,"幜幝幟幠幣",14,"幵幷幹幾庁庂広庅庈庉庌庍庎庒庘庛庝庡庢庣庤庨",4,"庮",4,"庴庺庻庼庽庿",6],
["8f40","廆廇廈廋",5,"廔廕廗廘廙廚廜",11,"廩廫",8,"廵廸廹廻廼廽弅弆弇弉弌弍弎弐弒弔弖弙弚弜弝弞弡弢弣弤"],
["8f80","弨弫弬弮弰弲",6,"弻弽弾弿彁",14,"彑彔彙彚彛彜彞彟彠彣彥彧彨彫彮彯彲彴彵彶彸彺彽彾彿徃徆徍徎徏徑従徔徖徚徛徝從徟徠徢",5,"復徫徬徯",5,"徶徸徹徺徻徾",4,"忇忈忊忋忎忓忔忕忚忛応忞忟忢忣忥忦忨忩忬忯忰忲忳忴忶忷忹忺忼怇"],
["9040","怈怉怋怌怐怑怓怗怘怚怞怟怢怣怤怬怭怮怰",4,"怶",4,"怽怾恀恄",6,"恌恎恏恑恓恔恖恗恘恛恜恞恟恠恡恥恦恮恱恲恴恵恷恾悀"],
["9080","悁悂悅悆悇悈悊悋悎悏悐悑悓悕悗悘悙悜悞悡悢悤悥悧悩悪悮悰悳悵悶悷悹悺悽",7,"惇惈惉惌",4,"惒惓惔惖惗惙惛惞惡",4,"惪惱惲惵惷惸惻",4,"愂愃愄愅愇愊愋愌愐",4,"愖愗愘愙愛愜愝愞愡愢愥愨愩愪愬",18,"慀",6],
["9140","慇慉態慍慏慐慒慓慔慖",6,"慞慟慠慡慣慤慥慦慩",6,"慱慲慳慴慶慸",18,"憌憍憏",4,"憕"],
["9180","憖",6,"憞",8,"憪憫憭",9,"憸",5,"憿懀懁懃",4,"應懌",4,"懓懕",16,"懧",13,"懶",8,"戀",5,"戇戉戓戔戙戜戝戞戠戣戦戧戨戩戫戭戯戰戱戲戵戶戸",4,"扂扄扅扆扊"],
["9240","扏扐払扖扗扙扚扜",6,"扤扥扨扱扲扴扵扷扸扺扻扽抁抂抃抅抆抇抈抋",5,"抔抙抜抝択抣抦抧抩抪抭抮抯抰抲抳抴抶抷抸抺抾拀拁"],
["9280","拃拋拏拑拕拝拞拠拡拤拪拫拰拲拵拸拹拺拻挀挃挄挅挆挊挋挌挍挏挐挒挓挔挕挗挘挙挜挦挧挩挬挭挮挰挱挳",5,"挻挼挾挿捀捁捄捇捈捊捑捒捓捔捖",7,"捠捤捥捦捨捪捫捬捯捰捲捳捴捵捸捹捼捽捾捿掁掃掄掅掆掋掍掑掓掔掕掗掙",6,"採掤掦掫掯掱掲掵掶掹掻掽掿揀"],
["9340","揁揂揃揅揇揈揊揋揌揑揓揔揕揗",6,"揟揢揤",4,"揫揬揮揯揰揱揳揵揷揹揺揻揼揾搃搄搆",4,"損搎搑搒搕",5,"搝搟搢搣搤"],
["9380","搥搧搨搩搫搮",5,"搵",4,"搻搼搾摀摂摃摉摋",6,"摓摕摖摗摙",4,"摟",7,"摨摪摫摬摮",9,"摻",6,"撃撆撈",8,"撓撔撗撘撚撛撜撝撟",4,"撥撦撧撨撪撫撯撱撲撳撴撶撹撻撽撾撿擁擃擄擆",6,"擏擑擓擔擕擖擙據"],
["9440","擛擜擝擟擠擡擣擥擧",24,"攁",7,"攊",7,"攓",4,"攙",8],
["9480","攢攣攤攦",4,"攬攭攰攱攲攳攷攺攼攽敀",4,"敆敇敊敋敍敎敐敒敓敔敗敘敚敜敟敠敡敤敥敧敨敩敪敭敮敯敱敳敵敶數",14,"斈斉斊斍斎斏斒斔斕斖斘斚斝斞斠斢斣斦斨斪斬斮斱",7,"斺斻斾斿旀旂旇旈旉旊旍旐旑旓旔旕旘",7,"旡旣旤旪旫"],
["9540","旲旳旴旵旸旹旻",4,"昁昄昅昇昈昉昋昍昐昑昒昖昗昘昚昛昜昞昡昢昣昤昦昩昪昫昬昮昰昲昳昷",4,"昽昿晀時晄",6,"晍晎晐晑晘"],
["9580","晙晛晜晝晞晠晢晣晥晧晩",4,"晱晲晳晵晸晹晻晼晽晿暀暁暃暅暆暈暉暊暋暍暎暏暐暒暓暔暕暘",4,"暞",8,"暩",4,"暯",4,"暵暶暷暸暺暻暼暽暿",25,"曚曞",7,"曧曨曪",5,"曱曵曶書曺曻曽朁朂會"],
["9640","朄朅朆朇朌朎朏朑朒朓朖朘朙朚朜朞朠",5,"朧朩朮朰朲朳朶朷朸朹朻朼朾朿杁杄杅杇杊杋杍杒杔杕杗",4,"杝杢杣杤杦杧杫杬杮東杴杶"],
["9680","杸杹杺杻杽枀枂枃枅枆枈枊枌枍枎枏枑枒枓枔枖枙枛枟枠枡枤枦枩枬枮枱枲枴枹",7,"柂柅",9,"柕柖柗柛柟柡柣柤柦柧柨柪柫柭柮柲柵",7,"柾栁栂栃栄栆栍栐栒栔栕栘",4,"栞栟栠栢",6,"栫",6,"栴栵栶栺栻栿桇桋桍桏桒桖",5],
["9740","桜桝桞桟桪桬",7,"桵桸",8,"梂梄梇",7,"梐梑梒梔梕梖梘",9,"梣梤梥梩梪梫梬梮梱梲梴梶梷梸"],
["9780","梹",6,"棁棃",5,"棊棌棎棏棐棑棓棔棖棗棙棛",4,"棡棢棤",9,"棯棲棳棴棶棷棸棻棽棾棿椀椂椃椄椆",4,"椌椏椑椓",11,"椡椢椣椥",7,"椮椯椱椲椳椵椶椷椸椺椻椼椾楀楁楃",16,"楕楖楘楙楛楜楟"],
["9840","楡楢楤楥楧楨楩楪楬業楯楰楲",4,"楺楻楽楾楿榁榃榅榊榋榌榎",5,"榖榗榙榚榝",9,"榩榪榬榮榯榰榲榳榵榶榸榹榺榼榽"],
["9880","榾榿槀槂",7,"構槍槏槑槒槓槕",5,"槜槝槞槡",11,"槮槯槰槱槳",9,"槾樀",9,"樋",11,"標",5,"樠樢",5,"権樫樬樭樮樰樲樳樴樶",6,"樿",4,"橅橆橈",7,"橑",6,"橚"],
["9940","橜",4,"橢橣橤橦",10,"橲",6,"橺橻橽橾橿檁檂檃檅",8,"檏檒",4,"檘",7,"檡",5],
["9980","檧檨檪檭",114,"欥欦欨",6],
["9a40","欯欰欱欳欴欵欶欸欻欼欽欿歀歁歂歄歅歈歊歋歍",11,"歚",7,"歨歩歫",13,"歺歽歾歿殀殅殈"],
["9a80","殌殎殏殐殑殔殕殗殘殙殜",4,"殢",7,"殫",7,"殶殸",6,"毀毃毄毆",4,"毌毎毐毑毘毚毜",4,"毢",7,"毬毭毮毰毱毲毴毶毷毸毺毻毼毾",6,"氈",4,"氎氒気氜氝氞氠氣氥氫氬氭氱氳氶氷氹氺氻氼氾氿汃汄汅汈汋",4,"汑汒汓汖汘"],
["9b40","汙汚汢汣汥汦汧汫",4,"汱汳汵汷汸決汻汼汿沀沄沇沊沋沍沎沑沒沕沖沗沘沚沜沝沞沠沢沨沬沯沰沴沵沶沷沺泀況泂泃泆泇泈泋泍泎泏泑泒泘"],
["9b80","泙泚泜泝泟泤泦泧泩泬泭泲泴泹泿洀洂洃洅洆洈洉洊洍洏洐洑洓洔洕洖洘洜洝洟",5,"洦洨洩洬洭洯洰洴洶洷洸洺洿浀浂浄浉浌浐浕浖浗浘浛浝浟浡浢浤浥浧浨浫浬浭浰浱浲浳浵浶浹浺浻浽",4,"涃涄涆涇涊涋涍涏涐涒涖",4,"涜涢涥涬涭涰涱涳涴涶涷涹",5,"淁淂淃淈淉淊"],
["9c40","淍淎淏淐淒淓淔淕淗淚淛淜淟淢淣淥淧淨淩淪淭淯淰淲淴淵淶淸淺淽",7,"渆渇済渉渋渏渒渓渕渘渙減渜渞渟渢渦渧渨渪測渮渰渱渳渵"],
["9c80","渶渷渹渻",7,"湅",7,"湏湐湑湒湕湗湙湚湜湝湞湠",10,"湬湭湯",14,"満溁溂溄溇溈溊",4,"溑",6,"溙溚溛溝溞溠溡溣溤溦溨溩溫溬溭溮溰溳溵溸溹溼溾溿滀滃滄滅滆滈滉滊滌滍滎滐滒滖滘滙滛滜滝滣滧滪",5],
["9d40","滰滱滲滳滵滶滷滸滺",7,"漃漄漅漇漈漊",4,"漐漑漒漖",9,"漡漢漣漥漦漧漨漬漮漰漲漴漵漷",6,"漿潀潁潂"],
["9d80","潃潄潅潈潉潊潌潎",9,"潙潚潛潝潟潠潡潣潤潥潧",5,"潯潰潱潳潵潶潷潹潻潽",6,"澅澆澇澊澋澏",12,"澝澞澟澠澢",4,"澨",10,"澴澵澷澸澺",5,"濁濃",5,"濊",6,"濓",10,"濟濢濣濤濥"],
["9e40","濦",7,"濰",32,"瀒",7,"瀜",6,"瀤",6],
["9e80","瀫",9,"瀶瀷瀸瀺",17,"灍灎灐",13,"灟",11,"灮灱灲灳灴灷灹灺灻災炁炂炃炄炆炇炈炋炌炍炏炐炑炓炗炘炚炛炞",12,"炰炲炴炵炶為炾炿烄烅烆烇烉烋",12,"烚"],
["9f40","烜烝烞烠烡烢烣烥烪烮烰",6,"烸烺烻烼烾",10,"焋",4,"焑焒焔焗焛",10,"焧",7,"焲焳焴"],
["9f80","焵焷",13,"煆煇煈煉煋煍煏",12,"煝煟",4,"煥煩",4,"煯煰煱煴煵煶煷煹煻煼煾",5,"熅",4,"熋熌熍熎熐熑熒熓熕熖熗熚",4,"熡",6,"熩熪熫熭",5,"熴熶熷熸熺",8,"燄",9,"燏",4],
["a040","燖",9,"燡燢燣燤燦燨",5,"燯",9,"燺",11,"爇",19],
["a080","爛爜爞",9,"爩爫爭爮爯爲爳爴爺爼爾牀",6,"牉牊牋牎牏牐牑牓牔牕牗牘牚牜牞牠牣牤牥牨牪牫牬牭牰牱牳牴牶牷牸牻牼牽犂犃犅",4,"犌犎犐犑犓",11,"犠",11,"犮犱犲犳犵犺",6,"狅狆狇狉狊狋狌狏狑狓狔狕狖狘狚狛"],
["a1a1","　、。·ˉˇ¨〃々—～‖…‘’“”〔〕〈",7,"〖〗【】±×÷∶∧∨∑∏∪∩∈∷√⊥∥∠⌒⊙∫∮≡≌≈∽∝≠≮≯≤≥∞∵∴♂♀°′″℃＄¤￠￡‰§№☆★○●◎◇◆□■△▲※→←↑↓〓"],
["a2a1","ⅰ",9],
["a2b1","⒈",19,"⑴",19,"①",9],
["a2e5","㈠",9],
["a2f1","Ⅰ",11],
["a3a1","！＂＃￥％",88,"￣"],
["a4a1","ぁ",82],
["a5a1","ァ",85],
["a6a1","Α",16,"Σ",6],
["a6c1","α",16,"σ",6],
["a6e0","︵︶︹︺︿﹀︽︾﹁﹂﹃﹄"],
["a6ee","︻︼︷︸︱"],
["a6f4","︳︴"],
["a7a1","А",5,"ЁЖ",25],
["a7d1","а",5,"ёж",25],
["a840","ˊˋ˙–―‥‵℅℉↖↗↘↙∕∟∣≒≦≧⊿═",35,"▁",6],
["a880","█",7,"▓▔▕▼▽◢◣◤◥☉⊕〒〝〞"],
["a8a1","āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüêɑ"],
["a8bd","ńň"],
["a8c0","ɡ"],
["a8c5","ㄅ",36],
["a940","〡",8,"㊣㎎㎏㎜㎝㎞㎡㏄㏎㏑㏒㏕︰￢￤"],
["a959","℡㈱"],
["a95c","‐"],
["a960","ー゛゜ヽヾ〆ゝゞ﹉",9,"﹔﹕﹖﹗﹙",8],
["a980","﹢",4,"﹨﹩﹪﹫"],
["a996","〇"],
["a9a4","─",75],
["aa40","狜狝狟狢",5,"狪狫狵狶狹狽狾狿猀猂猄",5,"猋猌猍猏猐猑猒猔猘猙猚猟猠猣猤猦猧猨猭猯猰猲猳猵猶猺猻猼猽獀",8],
["aa80","獉獊獋獌獎獏獑獓獔獕獖獘",7,"獡",10,"獮獰獱"],
["ab40","獲",11,"獿",4,"玅玆玈玊玌玍玏玐玒玓玔玕玗玘玙玚玜玝玞玠玡玣",5,"玪玬玭玱玴玵玶玸玹玼玽玾玿珁珃",4],
["ab80","珋珌珎珒",6,"珚珛珜珝珟珡珢珣珤珦珨珪珫珬珮珯珰珱珳",4],
["ac40","珸",10,"琄琇琈琋琌琍琎琑",8,"琜",5,"琣琤琧琩琫琭琯琱琲琷",4,"琽琾琿瑀瑂",11],
["ac80","瑎",6,"瑖瑘瑝瑠",12,"瑮瑯瑱",4,"瑸瑹瑺"],
["ad40","瑻瑼瑽瑿璂璄璅璆璈璉璊璌璍璏璑",10,"璝璟",7,"璪",15,"璻",12],
["ad80","瓈",9,"瓓",8,"瓝瓟瓡瓥瓧",6,"瓰瓱瓲"],
["ae40","瓳瓵瓸",6,"甀甁甂甃甅",7,"甎甐甒甔甕甖甗甛甝甞甠",4,"甦甧甪甮甴甶甹甼甽甿畁畂畃畄畆畇畉畊畍畐畑畒畓畕畖畗畘"],
["ae80","畝",7,"畧畨畩畫",6,"畳畵當畷畺",4,"疀疁疂疄疅疇"],
["af40","疈疉疊疌疍疎疐疓疕疘疛疜疞疢疦",4,"疭疶疷疺疻疿痀痁痆痋痌痎痏痐痑痓痗痙痚痜痝痟痠痡痥痩痬痭痮痯痲痳痵痶痷痸痺痻痽痾瘂瘄瘆瘇"],
["af80","瘈瘉瘋瘍瘎瘏瘑瘒瘓瘔瘖瘚瘜瘝瘞瘡瘣瘧瘨瘬瘮瘯瘱瘲瘶瘷瘹瘺瘻瘽癁療癄"],
["b040","癅",6,"癎",5,"癕癗",4,"癝癟癠癡癢癤",6,"癬癭癮癰",7,"癹発發癿皀皁皃皅皉皊皌皍皏皐皒皔皕皗皘皚皛"],
["b080","皜",7,"皥",8,"皯皰皳皵",9,"盀盁盃啊阿埃挨哎唉哀皑癌蔼矮艾碍爱隘鞍氨安俺按暗岸胺案肮昂盎凹敖熬翱袄傲奥懊澳芭捌扒叭吧笆八疤巴拔跋靶把耙坝霸罢爸白柏百摆佰败拜稗斑班搬扳般颁板版扮拌伴瓣半办绊邦帮梆榜膀绑棒磅蚌镑傍谤苞胞包褒剥"],
["b140","盄盇盉盋盌盓盕盙盚盜盝盞盠",4,"盦",7,"盰盳盵盶盷盺盻盽盿眀眂眃眅眆眊県眎",10,"眛眜眝眞眡眣眤眥眧眪眫"],
["b180","眬眮眰",4,"眹眻眽眾眿睂睄睅睆睈",7,"睒",7,"睜薄雹保堡饱宝抱报暴豹鲍爆杯碑悲卑北辈背贝钡倍狈备惫焙被奔苯本笨崩绷甭泵蹦迸逼鼻比鄙笔彼碧蓖蔽毕毙毖币庇痹闭敝弊必辟壁臂避陛鞭边编贬扁便变卞辨辩辫遍标彪膘表鳖憋别瘪彬斌濒滨宾摈兵冰柄丙秉饼炳"],
["b240","睝睞睟睠睤睧睩睪睭",11,"睺睻睼瞁瞂瞃瞆",5,"瞏瞐瞓",11,"瞡瞣瞤瞦瞨瞫瞭瞮瞯瞱瞲瞴瞶",4],
["b280","瞼瞾矀",12,"矎",8,"矘矙矚矝",4,"矤病并玻菠播拨钵波博勃搏铂箔伯帛舶脖膊渤泊驳捕卜哺补埠不布步簿部怖擦猜裁材才财睬踩采彩菜蔡餐参蚕残惭惨灿苍舱仓沧藏操糙槽曹草厕策侧册测层蹭插叉茬茶查碴搽察岔差诧拆柴豺搀掺蝉馋谗缠铲产阐颤昌猖"],
["b340","矦矨矪矯矰矱矲矴矵矷矹矺矻矼砃",5,"砊砋砎砏砐砓砕砙砛砞砠砡砢砤砨砪砫砮砯砱砲砳砵砶砽砿硁硂硃硄硆硈硉硊硋硍硏硑硓硔硘硙硚"],
["b380","硛硜硞",11,"硯",7,"硸硹硺硻硽",6,"场尝常长偿肠厂敞畅唱倡超抄钞朝嘲潮巢吵炒车扯撤掣彻澈郴臣辰尘晨忱沉陈趁衬撑称城橙成呈乘程惩澄诚承逞骋秤吃痴持匙池迟弛驰耻齿侈尺赤翅斥炽充冲虫崇宠抽酬畴踌稠愁筹仇绸瞅丑臭初出橱厨躇锄雏滁除楚"],
["b440","碄碅碆碈碊碋碏碐碒碔碕碖碙碝碞碠碢碤碦碨",7,"碵碶碷碸確碻碼碽碿磀磂磃磄磆磇磈磌磍磎磏磑磒磓磖磗磘磚",9],
["b480","磤磥磦磧磩磪磫磭",4,"磳磵磶磸磹磻",5,"礂礃礄礆",6,"础储矗搐触处揣川穿椽传船喘串疮窗幢床闯创吹炊捶锤垂春椿醇唇淳纯蠢戳绰疵茨磁雌辞慈瓷词此刺赐次聪葱囱匆从丛凑粗醋簇促蹿篡窜摧崔催脆瘁粹淬翠村存寸磋撮搓措挫错搭达答瘩打大呆歹傣戴带殆代贷袋待逮"],
["b540","礍",5,"礔",9,"礟",4,"礥",14,"礵",4,"礽礿祂祃祄祅祇祊",8,"祔祕祘祙祡祣"],
["b580","祤祦祩祪祫祬祮祰",6,"祹祻",4,"禂禃禆禇禈禉禋禌禍禎禐禑禒怠耽担丹单郸掸胆旦氮但惮淡诞弹蛋当挡党荡档刀捣蹈倒岛祷导到稻悼道盗德得的蹬灯登等瞪凳邓堤低滴迪敌笛狄涤翟嫡抵底地蒂第帝弟递缔颠掂滇碘点典靛垫电佃甸店惦奠淀殿碉叼雕凋刁掉吊钓调跌爹碟蝶迭谍叠"],
["b640","禓",6,"禛",11,"禨",10,"禴",4,"禼禿秂秄秅秇秈秊秌秎秏秐秓秔秖秗秙",5,"秠秡秢秥秨秪"],
["b680","秬秮秱",6,"秹秺秼秾秿稁稄稅稇稈稉稊稌稏",4,"稕稖稘稙稛稜丁盯叮钉顶鼎锭定订丢东冬董懂动栋侗恫冻洞兜抖斗陡豆逗痘都督毒犊独读堵睹赌杜镀肚度渡妒端短锻段断缎堆兑队对墩吨蹲敦顿囤钝盾遁掇哆多夺垛躲朵跺舵剁惰堕蛾峨鹅俄额讹娥恶厄扼遏鄂饿恩而儿耳尔饵洱二"],
["b740","稝稟稡稢稤",14,"稴稵稶稸稺稾穀",5,"穇",9,"穒",4,"穘",16],
["b780","穩",6,"穱穲穳穵穻穼穽穾窂窅窇窉窊窋窌窎窏窐窓窔窙窚窛窞窡窢贰发罚筏伐乏阀法珐藩帆番翻樊矾钒繁凡烦反返范贩犯饭泛坊芳方肪房防妨仿访纺放菲非啡飞肥匪诽吠肺废沸费芬酚吩氛分纷坟焚汾粉奋份忿愤粪丰封枫蜂峰锋风疯烽逢冯缝讽奉凤佛否夫敷肤孵扶拂辐幅氟符伏俘服"],
["b840","窣窤窧窩窪窫窮",4,"窴",10,"竀",10,"竌",9,"竗竘竚竛竜竝竡竢竤竧",5,"竮竰竱竲竳"],
["b880","竴",4,"竻竼竾笀笁笂笅笇笉笌笍笎笐笒笓笖笗笘笚笜笝笟笡笢笣笧笩笭浮涪福袱弗甫抚辅俯釜斧脯腑府腐赴副覆赋复傅付阜父腹负富讣附妇缚咐噶嘎该改概钙盖溉干甘杆柑竿肝赶感秆敢赣冈刚钢缸肛纲岗港杠篙皋高膏羔糕搞镐稿告哥歌搁戈鸽胳疙割革葛格蛤阁隔铬个各给根跟耕更庚羹"],
["b940","笯笰笲笴笵笶笷笹笻笽笿",5,"筆筈筊筍筎筓筕筗筙筜筞筟筡筣",10,"筯筰筳筴筶筸筺筼筽筿箁箂箃箄箆",6,"箎箏"],
["b980","箑箒箓箖箘箙箚箛箞箟箠箣箤箥箮箯箰箲箳箵箶箷箹",7,"篂篃範埂耿梗工攻功恭龚供躬公宫弓巩汞拱贡共钩勾沟苟狗垢构购够辜菇咕箍估沽孤姑鼓古蛊骨谷股故顾固雇刮瓜剐寡挂褂乖拐怪棺关官冠观管馆罐惯灌贯光广逛瑰规圭硅归龟闺轨鬼诡癸桂柜跪贵刽辊滚棍锅郭国果裹过哈"],
["ba40","篅篈築篊篋篍篎篏篐篒篔",4,"篛篜篞篟篠篢篣篤篧篨篩篫篬篭篯篰篲",4,"篸篹篺篻篽篿",7,"簈簉簊簍簎簐",5,"簗簘簙"],
["ba80","簚",4,"簠",5,"簨簩簫",12,"簹",5,"籂骸孩海氦亥害骇酣憨邯韩含涵寒函喊罕翰撼捍旱憾悍焊汗汉夯杭航壕嚎豪毫郝好耗号浩呵喝荷菏核禾和何合盒貉阂河涸赫褐鹤贺嘿黑痕很狠恨哼亨横衡恒轰哄烘虹鸿洪宏弘红喉侯猴吼厚候后呼乎忽瑚壶葫胡蝴狐糊湖"],
["bb40","籃",9,"籎",36,"籵",5,"籾",9],
["bb80","粈粊",6,"粓粔粖粙粚粛粠粡粣粦粧粨粩粫粬粭粯粰粴",4,"粺粻弧虎唬护互沪户花哗华猾滑画划化话槐徊怀淮坏欢环桓还缓换患唤痪豢焕涣宦幻荒慌黄磺蝗簧皇凰惶煌晃幌恍谎灰挥辉徽恢蛔回毁悔慧卉惠晦贿秽会烩汇讳诲绘荤昏婚魂浑混豁活伙火获或惑霍货祸击圾基机畸稽积箕"],
["bc40","粿糀糂糃糄糆糉糋糎",6,"糘糚糛糝糞糡",6,"糩",5,"糰",7,"糹糺糼",13,"紋",5],
["bc80","紑",14,"紡紣紤紥紦紨紩紪紬紭紮細",6,"肌饥迹激讥鸡姬绩缉吉极棘辑籍集及急疾汲即嫉级挤几脊己蓟技冀季伎祭剂悸济寄寂计记既忌际妓继纪嘉枷夹佳家加荚颊贾甲钾假稼价架驾嫁歼监坚尖笺间煎兼肩艰奸缄茧检柬碱硷拣捡简俭剪减荐槛鉴践贱见键箭件"],
["bd40","紷",54,"絯",7],
["bd80","絸",32,"健舰剑饯渐溅涧建僵姜将浆江疆蒋桨奖讲匠酱降蕉椒礁焦胶交郊浇骄娇嚼搅铰矫侥脚狡角饺缴绞剿教酵轿较叫窖揭接皆秸街阶截劫节桔杰捷睫竭洁结解姐戒藉芥界借介疥诫届巾筋斤金今津襟紧锦仅谨进靳晋禁近烬浸"],
["be40","継",12,"綧",6,"綯",42],
["be80","線",32,"尽劲荆兢茎睛晶鲸京惊精粳经井警景颈静境敬镜径痉靖竟竞净炯窘揪究纠玖韭久灸九酒厩救旧臼舅咎就疚鞠拘狙疽居驹菊局咀矩举沮聚拒据巨具距踞锯俱句惧炬剧捐鹃娟倦眷卷绢撅攫抉掘倔爵觉决诀绝均菌钧军君峻"],
["bf40","緻",62],
["bf80","縺縼",4,"繂",4,"繈",21,"俊竣浚郡骏喀咖卡咯开揩楷凯慨刊堪勘坎砍看康慷糠扛抗亢炕考拷烤靠坷苛柯棵磕颗科壳咳可渴克刻客课肯啃垦恳坑吭空恐孔控抠口扣寇枯哭窟苦酷库裤夸垮挎跨胯块筷侩快宽款匡筐狂框矿眶旷况亏盔岿窥葵奎魁傀"],
["c040","繞",35,"纃",23,"纜纝纞"],
["c080","纮纴纻纼绖绤绬绹缊缐缞缷缹缻",6,"罃罆",9,"罒罓馈愧溃坤昆捆困括扩廓阔垃拉喇蜡腊辣啦莱来赖蓝婪栏拦篮阑兰澜谰揽览懒缆烂滥琅榔狼廊郎朗浪捞劳牢老佬姥酪烙涝勒乐雷镭蕾磊累儡垒擂肋类泪棱楞冷厘梨犁黎篱狸离漓理李里鲤礼莉荔吏栗丽厉励砾历利傈例俐"],
["c140","罖罙罛罜罝罞罠罣",4,"罫罬罭罯罰罳罵罶罷罸罺罻罼罽罿羀羂",7,"羋羍羏",4,"羕",4,"羛羜羠羢羣羥羦羨",6,"羱"],
["c180","羳",4,"羺羻羾翀翂翃翄翆翇翈翉翋翍翏",4,"翖翗翙",5,"翢翣痢立粒沥隶力璃哩俩联莲连镰廉怜涟帘敛脸链恋炼练粮凉梁粱良两辆量晾亮谅撩聊僚疗燎寥辽潦了撂镣廖料列裂烈劣猎琳林磷霖临邻鳞淋凛赁吝拎玲菱零龄铃伶羚凌灵陵岭领另令溜琉榴硫馏留刘瘤流柳六龙聋咙笼窿"],
["c240","翤翧翨翪翫翬翭翯翲翴",6,"翽翾翿耂耇耈耉耊耎耏耑耓耚耛耝耞耟耡耣耤耫",5,"耲耴耹耺耼耾聀聁聄聅聇聈聉聎聏聐聑聓聕聖聗"],
["c280","聙聛",13,"聫",5,"聲",11,"隆垄拢陇楼娄搂篓漏陋芦卢颅庐炉掳卤虏鲁麓碌露路赂鹿潞禄录陆戮驴吕铝侣旅履屡缕虑氯律率滤绿峦挛孪滦卵乱掠略抡轮伦仑沦纶论萝螺罗逻锣箩骡裸落洛骆络妈麻玛码蚂马骂嘛吗埋买麦卖迈脉瞒馒蛮满蔓曼慢漫"],
["c340","聾肁肂肅肈肊肍",5,"肔肕肗肙肞肣肦肧肨肬肰肳肵肶肸肹肻胅胇",4,"胏",6,"胘胟胠胢胣胦胮胵胷胹胻胾胿脀脁脃脄脅脇脈脋"],
["c380","脌脕脗脙脛脜脝脟",12,"脭脮脰脳脴脵脷脹",4,"脿谩芒茫盲氓忙莽猫茅锚毛矛铆卯茂冒帽貌贸么玫枚梅酶霉煤没眉媒镁每美昧寐妹媚门闷们萌蒙檬盟锰猛梦孟眯醚靡糜迷谜弥米秘觅泌蜜密幂棉眠绵冕免勉娩缅面苗描瞄藐秒渺庙妙蔑灭民抿皿敏悯闽明螟鸣铭名命谬摸"],
["c440","腀",5,"腇腉腍腎腏腒腖腗腘腛",4,"腡腢腣腤腦腨腪腫腬腯腲腳腵腶腷腸膁膃",4,"膉膋膌膍膎膐膒",5,"膙膚膞",4,"膤膥"],
["c480","膧膩膫",7,"膴",5,"膼膽膾膿臄臅臇臈臉臋臍",6,"摹蘑模膜磨摩魔抹末莫墨默沫漠寞陌谋牟某拇牡亩姆母墓暮幕募慕木目睦牧穆拿哪呐钠那娜纳氖乃奶耐奈南男难囊挠脑恼闹淖呢馁内嫩能妮霓倪泥尼拟你匿腻逆溺蔫拈年碾撵捻念娘酿鸟尿捏聂孽啮镊镍涅您柠狞凝宁"],
["c540","臔",14,"臤臥臦臨臩臫臮",4,"臵",5,"臽臿舃與",4,"舎舏舑舓舕",5,"舝舠舤舥舦舧舩舮舲舺舼舽舿"],
["c580","艀艁艂艃艅艆艈艊艌艍艎艐",7,"艙艛艜艝艞艠",7,"艩拧泞牛扭钮纽脓浓农弄奴努怒女暖虐疟挪懦糯诺哦欧鸥殴藕呕偶沤啪趴爬帕怕琶拍排牌徘湃派攀潘盘磐盼畔判叛乓庞旁耪胖抛咆刨炮袍跑泡呸胚培裴赔陪配佩沛喷盆砰抨烹澎彭蓬棚硼篷膨朋鹏捧碰坯砒霹批披劈琵毗"],
["c640","艪艫艬艭艱艵艶艷艸艻艼芀芁芃芅芆芇芉芌芐芓芔芕芖芚芛芞芠芢芣芧芲芵芶芺芻芼芿苀苂苃苅苆苉苐苖苙苚苝苢苧苨苩苪苬苭苮苰苲苳苵苶苸"],
["c680","苺苼",4,"茊茋茍茐茒茓茖茘茙茝",9,"茩茪茮茰茲茷茻茽啤脾疲皮匹痞僻屁譬篇偏片骗飘漂瓢票撇瞥拼频贫品聘乒坪苹萍平凭瓶评屏坡泼颇婆破魄迫粕剖扑铺仆莆葡菩蒲埔朴圃普浦谱曝瀑期欺栖戚妻七凄漆柒沏其棋奇歧畦崎脐齐旗祈祁骑起岂乞企启契砌器气迄弃汽泣讫掐"],
["c740","茾茿荁荂荄荅荈荊",4,"荓荕",4,"荝荢荰",6,"荹荺荾",6,"莇莈莊莋莌莍莏莐莑莔莕莖莗莙莚莝莟莡",6,"莬莭莮"],
["c780","莯莵莻莾莿菂菃菄菆菈菉菋菍菎菐菑菒菓菕菗菙菚菛菞菢菣菤菦菧菨菫菬菭恰洽牵扦钎铅千迁签仟谦乾黔钱钳前潜遣浅谴堑嵌欠歉枪呛腔羌墙蔷强抢橇锹敲悄桥瞧乔侨巧鞘撬翘峭俏窍切茄且怯窃钦侵亲秦琴勤芹擒禽寝沁青轻氢倾卿清擎晴氰情顷请庆琼穷秋丘邱球求囚酋泅趋区蛆曲躯屈驱渠"],
["c840","菮華菳",4,"菺菻菼菾菿萀萂萅萇萈萉萊萐萒",5,"萙萚萛萞",5,"萩",7,"萲",5,"萹萺萻萾",7,"葇葈葉"],
["c880","葊",6,"葒",4,"葘葝葞葟葠葢葤",4,"葪葮葯葰葲葴葷葹葻葼取娶龋趣去圈颧权醛泉全痊拳犬券劝缺炔瘸却鹊榷确雀裙群然燃冉染瓤壤攘嚷让饶扰绕惹热壬仁人忍韧任认刃妊纫扔仍日戎茸蓉荣融熔溶容绒冗揉柔肉茹蠕儒孺如辱乳汝入褥软阮蕊瑞锐闰润若弱撒洒萨腮鳃塞赛三叁"],
["c940","葽",4,"蒃蒄蒅蒆蒊蒍蒏",7,"蒘蒚蒛蒝蒞蒟蒠蒢",12,"蒰蒱蒳蒵蒶蒷蒻蒼蒾蓀蓂蓃蓅蓆蓇蓈蓋蓌蓎蓏蓒蓔蓕蓗"],
["c980","蓘",4,"蓞蓡蓢蓤蓧",4,"蓭蓮蓯蓱",10,"蓽蓾蔀蔁蔂伞散桑嗓丧搔骚扫嫂瑟色涩森僧莎砂杀刹沙纱傻啥煞筛晒珊苫杉山删煽衫闪陕擅赡膳善汕扇缮墒伤商赏晌上尚裳梢捎稍烧芍勺韶少哨邵绍奢赊蛇舌舍赦摄射慑涉社设砷申呻伸身深娠绅神沈审婶甚肾慎渗声生甥牲升绳"],
["ca40","蔃",8,"蔍蔎蔏蔐蔒蔔蔕蔖蔘蔙蔛蔜蔝蔞蔠蔢",8,"蔭",9,"蔾",4,"蕄蕅蕆蕇蕋",10],
["ca80","蕗蕘蕚蕛蕜蕝蕟",4,"蕥蕦蕧蕩",8,"蕳蕵蕶蕷蕸蕼蕽蕿薀薁省盛剩胜圣师失狮施湿诗尸虱十石拾时什食蚀实识史矢使屎驶始式示士世柿事拭誓逝势是嗜噬适仕侍释饰氏市恃室视试收手首守寿授售受瘦兽蔬枢梳殊抒输叔舒淑疏书赎孰熟薯暑曙署蜀黍鼠属术述树束戍竖墅庶数漱"],
["cb40","薂薃薆薈",6,"薐",10,"薝",6,"薥薦薧薩薫薬薭薱",5,"薸薺",6,"藂",6,"藊",4,"藑藒"],
["cb80","藔藖",5,"藝",6,"藥藦藧藨藪",14,"恕刷耍摔衰甩帅栓拴霜双爽谁水睡税吮瞬顺舜说硕朔烁斯撕嘶思私司丝死肆寺嗣四伺似饲巳松耸怂颂送宋讼诵搜艘擞嗽苏酥俗素速粟僳塑溯宿诉肃酸蒜算虽隋随绥髓碎岁穗遂隧祟孙损笋蓑梭唆缩琐索锁所塌他它她塔"],
["cc40","藹藺藼藽藾蘀",4,"蘆",10,"蘒蘓蘔蘕蘗",15,"蘨蘪",13,"蘹蘺蘻蘽蘾蘿虀"],
["cc80","虁",11,"虒虓處",4,"虛虜虝號虠虡虣",7,"獭挞蹋踏胎苔抬台泰酞太态汰坍摊贪瘫滩坛檀痰潭谭谈坦毯袒碳探叹炭汤塘搪堂棠膛唐糖倘躺淌趟烫掏涛滔绦萄桃逃淘陶讨套特藤腾疼誊梯剔踢锑提题蹄啼体替嚏惕涕剃屉天添填田甜恬舔腆挑条迢眺跳贴铁帖厅听烃"],
["cd40","虭虯虰虲",6,"蚃",6,"蚎",4,"蚔蚖",5,"蚞",4,"蚥蚦蚫蚭蚮蚲蚳蚷蚸蚹蚻",4,"蛁蛂蛃蛅蛈蛌蛍蛒蛓蛕蛖蛗蛚蛜"],
["cd80","蛝蛠蛡蛢蛣蛥蛦蛧蛨蛪蛫蛬蛯蛵蛶蛷蛺蛻蛼蛽蛿蜁蜄蜅蜆蜋蜌蜎蜏蜐蜑蜔蜖汀廷停亭庭挺艇通桐酮瞳同铜彤童桶捅筒统痛偷投头透凸秃突图徒途涂屠土吐兔湍团推颓腿蜕褪退吞屯臀拖托脱鸵陀驮驼椭妥拓唾挖哇蛙洼娃瓦袜歪外豌弯湾玩顽丸烷完碗挽晚皖惋宛婉万腕汪王亡枉网往旺望忘妄威"],
["ce40","蜙蜛蜝蜟蜠蜤蜦蜧蜨蜪蜫蜬蜭蜯蜰蜲蜳蜵蜶蜸蜹蜺蜼蜽蝀",6,"蝊蝋蝍蝏蝐蝑蝒蝔蝕蝖蝘蝚",5,"蝡蝢蝦",7,"蝯蝱蝲蝳蝵"],
["ce80","蝷蝸蝹蝺蝿螀螁螄螆螇螉螊螌螎",4,"螔螕螖螘",6,"螠",4,"巍微危韦违桅围唯惟为潍维苇萎委伟伪尾纬未蔚味畏胃喂魏位渭谓尉慰卫瘟温蚊文闻纹吻稳紊问嗡翁瓮挝蜗涡窝我斡卧握沃巫呜钨乌污诬屋无芜梧吾吴毋武五捂午舞伍侮坞戊雾晤物勿务悟误昔熙析西硒矽晰嘻吸锡牺"],
["cf40","螥螦螧螩螪螮螰螱螲螴螶螷螸螹螻螼螾螿蟁",4,"蟇蟈蟉蟌",4,"蟔",6,"蟜蟝蟞蟟蟡蟢蟣蟤蟦蟧蟨蟩蟫蟬蟭蟯",9],
["cf80","蟺蟻蟼蟽蟿蠀蠁蠂蠄",5,"蠋",7,"蠔蠗蠘蠙蠚蠜",4,"蠣稀息希悉膝夕惜熄烯溪汐犀檄袭席习媳喜铣洗系隙戏细瞎虾匣霞辖暇峡侠狭下厦夏吓掀锨先仙鲜纤咸贤衔舷闲涎弦嫌显险现献县腺馅羡宪陷限线相厢镶香箱襄湘乡翔祥详想响享项巷橡像向象萧硝霄削哮嚣销消宵淆晓"],
["d040","蠤",13,"蠳",5,"蠺蠻蠽蠾蠿衁衂衃衆",5,"衎",5,"衕衖衘衚",6,"衦衧衪衭衯衱衳衴衵衶衸衹衺"],
["d080","衻衼袀袃袆袇袉袊袌袎袏袐袑袓袔袕袗",4,"袝",4,"袣袥",5,"小孝校肖啸笑效楔些歇蝎鞋协挟携邪斜胁谐写械卸蟹懈泄泻谢屑薪芯锌欣辛新忻心信衅星腥猩惺兴刑型形邢行醒幸杏性姓兄凶胸匈汹雄熊休修羞朽嗅锈秀袖绣墟戌需虚嘘须徐许蓄酗叙旭序畜恤絮婿绪续轩喧宣悬旋玄"],
["d140","袬袮袯袰袲",4,"袸袹袺袻袽袾袿裀裃裄裇裈裊裋裌裍裏裐裑裓裖裗裚",4,"裠裡裦裧裩",6,"裲裵裶裷裺裻製裿褀褁褃",5],
["d180","褉褋",4,"褑褔",4,"褜",4,"褢褣褤褦褧褨褩褬褭褮褯褱褲褳褵褷选癣眩绚靴薛学穴雪血勋熏循旬询寻驯巡殉汛训讯逊迅压押鸦鸭呀丫芽牙蚜崖衙涯雅哑亚讶焉咽阉烟淹盐严研蜒岩延言颜阎炎沿奄掩眼衍演艳堰燕厌砚雁唁彦焰宴谚验殃央鸯秧杨扬佯疡羊洋阳氧仰痒养样漾邀腰妖瑶"],
["d240","褸",8,"襂襃襅",24,"襠",5,"襧",19,"襼"],
["d280","襽襾覀覂覄覅覇",26,"摇尧遥窑谣姚咬舀药要耀椰噎耶爷野冶也页掖业叶曳腋夜液一壹医揖铱依伊衣颐夷遗移仪胰疑沂宜姨彝椅蚁倚已乙矣以艺抑易邑屹亿役臆逸肄疫亦裔意毅忆义益溢诣议谊译异翼翌绎茵荫因殷音阴姻吟银淫寅饮尹引隐"],
["d340","覢",30,"觃觍觓觔觕觗觘觙觛觝觟觠觡觢觤觧觨觩觪觬觭觮觰觱觲觴",6],
["d380","觻",4,"訁",5,"計",21,"印英樱婴鹰应缨莹萤营荧蝇迎赢盈影颖硬映哟拥佣臃痈庸雍踊蛹咏泳涌永恿勇用幽优悠忧尤由邮铀犹油游酉有友右佑釉诱又幼迂淤于盂榆虞愚舆余俞逾鱼愉渝渔隅予娱雨与屿禹宇语羽玉域芋郁吁遇喻峪御愈欲狱育誉"],
["d440","訞",31,"訿",8,"詉",21],
["d480","詟",25,"詺",6,"浴寓裕预豫驭鸳渊冤元垣袁原援辕园员圆猿源缘远苑愿怨院曰约越跃钥岳粤月悦阅耘云郧匀陨允运蕴酝晕韵孕匝砸杂栽哉灾宰载再在咱攒暂赞赃脏葬遭糟凿藻枣早澡蚤躁噪造皂灶燥责择则泽贼怎增憎曾赠扎喳渣札轧"],
["d540","誁",7,"誋",7,"誔",46],
["d580","諃",32,"铡闸眨栅榨咋乍炸诈摘斋宅窄债寨瞻毡詹粘沾盏斩辗崭展蘸栈占战站湛绽樟章彰漳张掌涨杖丈帐账仗胀瘴障招昭找沼赵照罩兆肇召遮折哲蛰辙者锗蔗这浙珍斟真甄砧臻贞针侦枕疹诊震振镇阵蒸挣睁征狰争怔整拯正政"],
["d640","諤",34,"謈",27],
["d680","謤謥謧",30,"帧症郑证芝枝支吱蜘知肢脂汁之织职直植殖执值侄址指止趾只旨纸志挚掷至致置帜峙制智秩稚质炙痔滞治窒中盅忠钟衷终种肿重仲众舟周州洲诌粥轴肘帚咒皱宙昼骤珠株蛛朱猪诸诛逐竹烛煮拄瞩嘱主著柱助蛀贮铸筑"],
["d740","譆",31,"譧",4,"譭",25],
["d780","讇",24,"讬讱讻诇诐诪谉谞住注祝驻抓爪拽专砖转撰赚篆桩庄装妆撞壮状椎锥追赘坠缀谆准捉拙卓桌琢茁酌啄着灼浊兹咨资姿滋淄孜紫仔籽滓子自渍字鬃棕踪宗综总纵邹走奏揍租足卒族祖诅阻组钻纂嘴醉最罪尊遵昨左佐柞做作坐座"],
["d840","谸",8,"豂豃豄豅豈豊豋豍",7,"豖豗豘豙豛",5,"豣",6,"豬",6,"豴豵豶豷豻",6,"貃貄貆貇"],
["d880","貈貋貍",6,"貕貖貗貙",20,"亍丌兀丐廿卅丕亘丞鬲孬噩丨禺丿匕乇夭爻卮氐囟胤馗毓睾鼗丶亟鼐乜乩亓芈孛啬嘏仄厍厝厣厥厮靥赝匚叵匦匮匾赜卦卣刂刈刎刭刳刿剀剌剞剡剜蒯剽劂劁劐劓冂罔亻仃仉仂仨仡仫仞伛仳伢佤仵伥伧伉伫佞佧攸佚佝"],
["d940","貮",62],
["d980","賭",32,"佟佗伲伽佶佴侑侉侃侏佾佻侪佼侬侔俦俨俪俅俚俣俜俑俟俸倩偌俳倬倏倮倭俾倜倌倥倨偾偃偕偈偎偬偻傥傧傩傺僖儆僭僬僦僮儇儋仝氽佘佥俎龠汆籴兮巽黉馘冁夔勹匍訇匐凫夙兕亠兖亳衮袤亵脔裒禀嬴蠃羸冫冱冽冼"],
["da40","贎",14,"贠赑赒赗赟赥赨赩赪赬赮赯赱赲赸",8,"趂趃趆趇趈趉趌",4,"趒趓趕",9,"趠趡"],
["da80","趢趤",12,"趲趶趷趹趻趽跀跁跂跅跇跈跉跊跍跐跒跓跔凇冖冢冥讠讦讧讪讴讵讷诂诃诋诏诎诒诓诔诖诘诙诜诟诠诤诨诩诮诰诳诶诹诼诿谀谂谄谇谌谏谑谒谔谕谖谙谛谘谝谟谠谡谥谧谪谫谮谯谲谳谵谶卩卺阝阢阡阱阪阽阼陂陉陔陟陧陬陲陴隈隍隗隰邗邛邝邙邬邡邴邳邶邺"],
["db40","跕跘跙跜跠跡跢跥跦跧跩跭跮跰跱跲跴跶跼跾",6,"踆踇踈踋踍踎踐踑踒踓踕",7,"踠踡踤",4,"踫踭踰踲踳踴踶踷踸踻踼踾"],
["db80","踿蹃蹅蹆蹌",4,"蹓",5,"蹚",11,"蹧蹨蹪蹫蹮蹱邸邰郏郅邾郐郄郇郓郦郢郜郗郛郫郯郾鄄鄢鄞鄣鄱鄯鄹酃酆刍奂劢劬劭劾哿勐勖勰叟燮矍廴凵凼鬯厶弁畚巯坌垩垡塾墼壅壑圩圬圪圳圹圮圯坜圻坂坩垅坫垆坼坻坨坭坶坳垭垤垌垲埏垧垴垓垠埕埘埚埙埒垸埴埯埸埤埝"],
["dc40","蹳蹵蹷",4,"蹽蹾躀躂躃躄躆躈",6,"躑躒躓躕",6,"躝躟",11,"躭躮躰躱躳",6,"躻",7],
["dc80","軃",10,"軏",21,"堋堍埽埭堀堞堙塄堠塥塬墁墉墚墀馨鼙懿艹艽艿芏芊芨芄芎芑芗芙芫芸芾芰苈苊苣芘芷芮苋苌苁芩芴芡芪芟苄苎芤苡茉苷苤茏茇苜苴苒苘茌苻苓茑茚茆茔茕苠苕茜荑荛荜茈莒茼茴茱莛荞茯荏荇荃荟荀茗荠茭茺茳荦荥"],
["dd40","軥",62],
["dd80","輤",32,"荨茛荩荬荪荭荮莰荸莳莴莠莪莓莜莅荼莶莩荽莸荻莘莞莨莺莼菁萁菥菘堇萘萋菝菽菖萜萸萑萆菔菟萏萃菸菹菪菅菀萦菰菡葜葑葚葙葳蒇蒈葺蒉葸萼葆葩葶蒌蒎萱葭蓁蓍蓐蓦蒽蓓蓊蒿蒺蓠蒡蒹蒴蒗蓥蓣蔌甍蔸蓰蔹蔟蔺"],
["de40","轅",32,"轪辀辌辒辝辠辡辢辤辥辦辧辪辬辭辮辯農辳辴辵辷辸辺辻込辿迀迃迆"],
["de80","迉",4,"迏迒迖迗迚迠迡迣迧迬迯迱迲迴迵迶迺迻迼迾迿逇逈逌逎逓逕逘蕖蔻蓿蓼蕙蕈蕨蕤蕞蕺瞢蕃蕲蕻薤薨薇薏蕹薮薜薅薹薷薰藓藁藜藿蘧蘅蘩蘖蘼廾弈夼奁耷奕奚奘匏尢尥尬尴扌扪抟抻拊拚拗拮挢拶挹捋捃掭揶捱捺掎掴捭掬掊捩掮掼揲揸揠揿揄揞揎摒揆掾摅摁搋搛搠搌搦搡摞撄摭撖"],
["df40","這逜連逤逥逧",5,"逰",4,"逷逹逺逽逿遀遃遅遆遈",4,"過達違遖遙遚遜",5,"遤遦遧適遪遫遬遯",4,"遶",6,"遾邁"],
["df80","還邅邆邇邉邊邌",4,"邒邔邖邘邚邜邞邟邠邤邥邧邨邩邫邭邲邷邼邽邿郀摺撷撸撙撺擀擐擗擤擢攉攥攮弋忒甙弑卟叱叽叩叨叻吒吖吆呋呒呓呔呖呃吡呗呙吣吲咂咔呷呱呤咚咛咄呶呦咝哐咭哂咴哒咧咦哓哔呲咣哕咻咿哌哙哚哜咩咪咤哝哏哞唛哧唠哽唔哳唢唣唏唑唧唪啧喏喵啉啭啁啕唿啐唼"],
["e040","郂郃郆郈郉郋郌郍郒郔郕郖郘郙郚郞郟郠郣郤郥郩郪郬郮郰郱郲郳郵郶郷郹郺郻郼郿鄀鄁鄃鄅",19,"鄚鄛鄜"],
["e080","鄝鄟鄠鄡鄤",10,"鄰鄲",6,"鄺",8,"酄唷啖啵啶啷唳唰啜喋嗒喃喱喹喈喁喟啾嗖喑啻嗟喽喾喔喙嗪嗷嗉嘟嗑嗫嗬嗔嗦嗝嗄嗯嗥嗲嗳嗌嗍嗨嗵嗤辔嘞嘈嘌嘁嘤嘣嗾嘀嘧嘭噘嘹噗嘬噍噢噙噜噌噔嚆噤噱噫噻噼嚅嚓嚯囔囗囝囡囵囫囹囿圄圊圉圜帏帙帔帑帱帻帼"],
["e140","酅酇酈酑酓酔酕酖酘酙酛酜酟酠酦酧酨酫酭酳酺酻酼醀",4,"醆醈醊醎醏醓",6,"醜",5,"醤",5,"醫醬醰醱醲醳醶醷醸醹醻"],
["e180","醼",10,"釈釋釐釒",9,"針",8,"帷幄幔幛幞幡岌屺岍岐岖岈岘岙岑岚岜岵岢岽岬岫岱岣峁岷峄峒峤峋峥崂崃崧崦崮崤崞崆崛嵘崾崴崽嵬嵛嵯嵝嵫嵋嵊嵩嵴嶂嶙嶝豳嶷巅彳彷徂徇徉後徕徙徜徨徭徵徼衢彡犭犰犴犷犸狃狁狎狍狒狨狯狩狲狴狷猁狳猃狺"],
["e240","釦",62],
["e280","鈥",32,"狻猗猓猡猊猞猝猕猢猹猥猬猸猱獐獍獗獠獬獯獾舛夥飧夤夂饣饧",5,"饴饷饽馀馄馇馊馍馐馑馓馔馕庀庑庋庖庥庠庹庵庾庳赓廒廑廛廨廪膺忄忉忖忏怃忮怄忡忤忾怅怆忪忭忸怙怵怦怛怏怍怩怫怊怿怡恸恹恻恺恂"],
["e340","鉆",45,"鉵",16],
["e380","銆",7,"銏",24,"恪恽悖悚悭悝悃悒悌悛惬悻悱惝惘惆惚悴愠愦愕愣惴愀愎愫慊慵憬憔憧憷懔懵忝隳闩闫闱闳闵闶闼闾阃阄阆阈阊阋阌阍阏阒阕阖阗阙阚丬爿戕氵汔汜汊沣沅沐沔沌汨汩汴汶沆沩泐泔沭泷泸泱泗沲泠泖泺泫泮沱泓泯泾"],
["e440","銨",5,"銯",24,"鋉",31],
["e480","鋩",32,"洹洧洌浃浈洇洄洙洎洫浍洮洵洚浏浒浔洳涑浯涞涠浞涓涔浜浠浼浣渚淇淅淞渎涿淠渑淦淝淙渖涫渌涮渫湮湎湫溲湟溆湓湔渲渥湄滟溱溘滠漭滢溥溧溽溻溷滗溴滏溏滂溟潢潆潇漤漕滹漯漶潋潴漪漉漩澉澍澌潸潲潼潺濑"],
["e540","錊",51,"錿",10],
["e580","鍊",31,"鍫濉澧澹澶濂濡濮濞濠濯瀚瀣瀛瀹瀵灏灞宀宄宕宓宥宸甯骞搴寤寮褰寰蹇謇辶迓迕迥迮迤迩迦迳迨逅逄逋逦逑逍逖逡逵逶逭逯遄遑遒遐遨遘遢遛暹遴遽邂邈邃邋彐彗彖彘尻咫屐屙孱屣屦羼弪弩弭艴弼鬻屮妁妃妍妩妪妣"],
["e640","鍬",34,"鎐",27],
["e680","鎬",29,"鏋鏌鏍妗姊妫妞妤姒妲妯姗妾娅娆姝娈姣姘姹娌娉娲娴娑娣娓婀婧婊婕娼婢婵胬媪媛婷婺媾嫫媲嫒嫔媸嫠嫣嫱嫖嫦嫘嫜嬉嬗嬖嬲嬷孀尕尜孚孥孳孑孓孢驵驷驸驺驿驽骀骁骅骈骊骐骒骓骖骘骛骜骝骟骠骢骣骥骧纟纡纣纥纨纩"],
["e740","鏎",7,"鏗",54],
["e780","鐎",32,"纭纰纾绀绁绂绉绋绌绐绔绗绛绠绡绨绫绮绯绱绲缍绶绺绻绾缁缂缃缇缈缋缌缏缑缒缗缙缜缛缟缡",6,"缪缫缬缭缯",4,"缵幺畿巛甾邕玎玑玮玢玟珏珂珑玷玳珀珉珈珥珙顼琊珩珧珞玺珲琏琪瑛琦琥琨琰琮琬"],
["e840","鐯",14,"鐿",43,"鑬鑭鑮鑯"],
["e880","鑰",20,"钑钖钘铇铏铓铔铚铦铻锜锠琛琚瑁瑜瑗瑕瑙瑷瑭瑾璜璎璀璁璇璋璞璨璩璐璧瓒璺韪韫韬杌杓杞杈杩枥枇杪杳枘枧杵枨枞枭枋杷杼柰栉柘栊柩枰栌柙枵柚枳柝栀柃枸柢栎柁柽栲栳桠桡桎桢桄桤梃栝桕桦桁桧桀栾桊桉栩梵梏桴桷梓桫棂楮棼椟椠棹"],
["e940","锧锳锽镃镈镋镕镚镠镮镴镵長",7,"門",42],
["e980","閫",32,"椤棰椋椁楗棣椐楱椹楠楂楝榄楫榀榘楸椴槌榇榈槎榉楦楣楹榛榧榻榫榭槔榱槁槊槟榕槠榍槿樯槭樗樘橥槲橄樾檠橐橛樵檎橹樽樨橘橼檑檐檩檗檫猷獒殁殂殇殄殒殓殍殚殛殡殪轫轭轱轲轳轵轶轸轷轹轺轼轾辁辂辄辇辋"],
["ea40","闌",27,"闬闿阇阓阘阛阞阠阣",6,"阫阬阭阯阰阷阸阹阺阾陁陃陊陎陏陑陒陓陖陗"],
["ea80","陘陙陚陜陝陞陠陣陥陦陫陭",4,"陳陸",12,"隇隉隊辍辎辏辘辚軎戋戗戛戟戢戡戥戤戬臧瓯瓴瓿甏甑甓攴旮旯旰昊昙杲昃昕昀炅曷昝昴昱昶昵耆晟晔晁晏晖晡晗晷暄暌暧暝暾曛曜曦曩贲贳贶贻贽赀赅赆赈赉赇赍赕赙觇觊觋觌觎觏觐觑牮犟牝牦牯牾牿犄犋犍犏犒挈挲掰"],
["eb40","隌階隑隒隓隕隖隚際隝",9,"隨",7,"隱隲隴隵隷隸隺隻隿雂雃雈雊雋雐雑雓雔雖",9,"雡",6,"雫"],
["eb80","雬雭雮雰雱雲雴雵雸雺電雼雽雿霂霃霅霊霋霌霐霑霒霔霕霗",4,"霝霟霠搿擘耄毪毳毽毵毹氅氇氆氍氕氘氙氚氡氩氤氪氲攵敕敫牍牒牖爰虢刖肟肜肓肼朊肽肱肫肭肴肷胧胨胩胪胛胂胄胙胍胗朐胝胫胱胴胭脍脎胲胼朕脒豚脶脞脬脘脲腈腌腓腴腙腚腱腠腩腼腽腭腧塍媵膈膂膑滕膣膪臌朦臊膻"],
["ec40","霡",8,"霫霬霮霯霱霳",4,"霺霻霼霽霿",18,"靔靕靗靘靚靜靝靟靣靤靦靧靨靪",7],
["ec80","靲靵靷",4,"靽",7,"鞆",4,"鞌鞎鞏鞐鞓鞕鞖鞗鞙",4,"臁膦欤欷欹歃歆歙飑飒飓飕飙飚殳彀毂觳斐齑斓於旆旄旃旌旎旒旖炀炜炖炝炻烀炷炫炱烨烊焐焓焖焯焱煳煜煨煅煲煊煸煺熘熳熵熨熠燠燔燧燹爝爨灬焘煦熹戾戽扃扈扉礻祀祆祉祛祜祓祚祢祗祠祯祧祺禅禊禚禧禳忑忐"],
["ed40","鞞鞟鞡鞢鞤",6,"鞬鞮鞰鞱鞳鞵",46],
["ed80","韤韥韨韮",4,"韴韷",23,"怼恝恚恧恁恙恣悫愆愍慝憩憝懋懑戆肀聿沓泶淼矶矸砀砉砗砘砑斫砭砜砝砹砺砻砟砼砥砬砣砩硎硭硖硗砦硐硇硌硪碛碓碚碇碜碡碣碲碹碥磔磙磉磬磲礅磴礓礤礞礴龛黹黻黼盱眄眍盹眇眈眚眢眙眭眦眵眸睐睑睇睃睚睨"],
["ee40","頏",62],
["ee80","顎",32,"睢睥睿瞍睽瞀瞌瞑瞟瞠瞰瞵瞽町畀畎畋畈畛畲畹疃罘罡罟詈罨罴罱罹羁罾盍盥蠲钅钆钇钋钊钌钍钏钐钔钗钕钚钛钜钣钤钫钪钭钬钯钰钲钴钶",4,"钼钽钿铄铈",6,"铐铑铒铕铖铗铙铘铛铞铟铠铢铤铥铧铨铪"],
["ef40","顯",5,"颋颎颒颕颙颣風",37,"飏飐飔飖飗飛飜飝飠",4],
["ef80","飥飦飩",30,"铩铫铮铯铳铴铵铷铹铼铽铿锃锂锆锇锉锊锍锎锏锒",4,"锘锛锝锞锟锢锪锫锩锬锱锲锴锶锷锸锼锾锿镂锵镄镅镆镉镌镎镏镒镓镔镖镗镘镙镛镞镟镝镡镢镤",8,"镯镱镲镳锺矧矬雉秕秭秣秫稆嵇稃稂稞稔"],
["f040","餈",4,"餎餏餑",28,"餯",26],
["f080","饊",9,"饖",12,"饤饦饳饸饹饻饾馂馃馉稹稷穑黏馥穰皈皎皓皙皤瓞瓠甬鸠鸢鸨",4,"鸲鸱鸶鸸鸷鸹鸺鸾鹁鹂鹄鹆鹇鹈鹉鹋鹌鹎鹑鹕鹗鹚鹛鹜鹞鹣鹦",6,"鹱鹭鹳疒疔疖疠疝疬疣疳疴疸痄疱疰痃痂痖痍痣痨痦痤痫痧瘃痱痼痿瘐瘀瘅瘌瘗瘊瘥瘘瘕瘙"],
["f140","馌馎馚",10,"馦馧馩",47],
["f180","駙",32,"瘛瘼瘢瘠癀瘭瘰瘿瘵癃瘾瘳癍癞癔癜癖癫癯翊竦穸穹窀窆窈窕窦窠窬窨窭窳衤衩衲衽衿袂袢裆袷袼裉裢裎裣裥裱褚裼裨裾裰褡褙褓褛褊褴褫褶襁襦襻疋胥皲皴矜耒耔耖耜耠耢耥耦耧耩耨耱耋耵聃聆聍聒聩聱覃顸颀颃"],
["f240","駺",62],
["f280","騹",32,"颉颌颍颏颔颚颛颞颟颡颢颥颦虍虔虬虮虿虺虼虻蚨蚍蚋蚬蚝蚧蚣蚪蚓蚩蚶蛄蚵蛎蚰蚺蚱蚯蛉蛏蚴蛩蛱蛲蛭蛳蛐蜓蛞蛴蛟蛘蛑蜃蜇蛸蜈蜊蜍蜉蜣蜻蜞蜥蜮蜚蜾蝈蜴蜱蜩蜷蜿螂蜢蝽蝾蝻蝠蝰蝌蝮螋蝓蝣蝼蝤蝙蝥螓螯螨蟒"],
["f340","驚",17,"驲骃骉骍骎骔骕骙骦骩",6,"骲骳骴骵骹骻骽骾骿髃髄髆",4,"髍髎髏髐髒體髕髖髗髙髚髛髜"],
["f380","髝髞髠髢髣髤髥髧髨髩髪髬髮髰",8,"髺髼",6,"鬄鬅鬆蟆螈螅螭螗螃螫蟥螬螵螳蟋蟓螽蟑蟀蟊蟛蟪蟠蟮蠖蠓蟾蠊蠛蠡蠹蠼缶罂罄罅舐竺竽笈笃笄笕笊笫笏筇笸笪笙笮笱笠笥笤笳笾笞筘筚筅筵筌筝筠筮筻筢筲筱箐箦箧箸箬箝箨箅箪箜箢箫箴篑篁篌篝篚篥篦篪簌篾篼簏簖簋"],
["f440","鬇鬉",5,"鬐鬑鬒鬔",10,"鬠鬡鬢鬤",10,"鬰鬱鬳",7,"鬽鬾鬿魀魆魊魋魌魎魐魒魓魕",5],
["f480","魛",32,"簟簪簦簸籁籀臾舁舂舄臬衄舡舢舣舭舯舨舫舸舻舳舴舾艄艉艋艏艚艟艨衾袅袈裘裟襞羝羟羧羯羰羲籼敉粑粝粜粞粢粲粼粽糁糇糌糍糈糅糗糨艮暨羿翎翕翥翡翦翩翮翳糸絷綦綮繇纛麸麴赳趄趔趑趱赧赭豇豉酊酐酎酏酤"],
["f540","魼",62],
["f580","鮻",32,"酢酡酰酩酯酽酾酲酴酹醌醅醐醍醑醢醣醪醭醮醯醵醴醺豕鹾趸跫踅蹙蹩趵趿趼趺跄跖跗跚跞跎跏跛跆跬跷跸跣跹跻跤踉跽踔踝踟踬踮踣踯踺蹀踹踵踽踱蹉蹁蹂蹑蹒蹊蹰蹶蹼蹯蹴躅躏躔躐躜躞豸貂貊貅貘貔斛觖觞觚觜"],
["f640","鯜",62],
["f680","鰛",32,"觥觫觯訾謦靓雩雳雯霆霁霈霏霎霪霭霰霾龀龃龅",5,"龌黾鼋鼍隹隼隽雎雒瞿雠銎銮鋈錾鍪鏊鎏鐾鑫鱿鲂鲅鲆鲇鲈稣鲋鲎鲐鲑鲒鲔鲕鲚鲛鲞",5,"鲥",4,"鲫鲭鲮鲰",7,"鲺鲻鲼鲽鳄鳅鳆鳇鳊鳋"],
["f740","鰼",62],
["f780","鱻鱽鱾鲀鲃鲄鲉鲊鲌鲏鲓鲖鲗鲘鲙鲝鲪鲬鲯鲹鲾",4,"鳈鳉鳑鳒鳚鳛鳠鳡鳌",4,"鳓鳔鳕鳗鳘鳙鳜鳝鳟鳢靼鞅鞑鞒鞔鞯鞫鞣鞲鞴骱骰骷鹘骶骺骼髁髀髅髂髋髌髑魅魃魇魉魈魍魑飨餍餮饕饔髟髡髦髯髫髻髭髹鬈鬏鬓鬟鬣麽麾縻麂麇麈麋麒鏖麝麟黛黜黝黠黟黢黩黧黥黪黯鼢鼬鼯鼹鼷鼽鼾齄"],
["f840","鳣",62],
["f880","鴢",32],
["f940","鵃",62],
["f980","鶂",32],
["fa40","鶣",62],
["fa80","鷢",32],
["fb40","鸃",27,"鸤鸧鸮鸰鸴鸻鸼鹀鹍鹐鹒鹓鹔鹖鹙鹝鹟鹠鹡鹢鹥鹮鹯鹲鹴",9,"麀"],
["fb80","麁麃麄麅麆麉麊麌",5,"麔",8,"麞麠",5,"麧麨麩麪"],
["fc40","麫",8,"麵麶麷麹麺麼麿",4,"黅黆黇黈黊黋黌黐黒黓黕黖黗黙黚點黡黣黤黦黨黫黬黭黮黰",8,"黺黽黿",6],
["fc80","鼆",4,"鼌鼏鼑鼒鼔鼕鼖鼘鼚",5,"鼡鼣",8,"鼭鼮鼰鼱"],
["fd40","鼲",4,"鼸鼺鼼鼿",4,"齅",10,"齒",38],
["fd80","齹",5,"龁龂龍",11,"龜龝龞龡",4,"郎凉秊裏隣"],
["fe40","兀嗀﨎﨏﨑﨓﨔礼﨟蘒﨡﨣﨤﨧﨨﨩"]
]

},{}],33:[function(require,module,exports){
module.exports=[
["0","\u0000",127],
["8141","갂갃갅갆갋",4,"갘갞갟갡갢갣갥",6,"갮갲갳갴"],
["8161","갵갶갷갺갻갽갾갿걁",9,"걌걎",5,"걕"],
["8181","걖걗걙걚걛걝",18,"걲걳걵걶걹걻",4,"겂겇겈겍겎겏겑겒겓겕",6,"겞겢",5,"겫겭겮겱",6,"겺겾겿곀곂곃곅곆곇곉곊곋곍",7,"곖곘",7,"곢곣곥곦곩곫곭곮곲곴곷",4,"곾곿괁괂괃괅괇",4,"괎괐괒괓"],
["8241","괔괕괖괗괙괚괛괝괞괟괡",7,"괪괫괮",5],
["8261","괶괷괹괺괻괽",6,"굆굈굊",5,"굑굒굓굕굖굗"],
["8281","굙",7,"굢굤",7,"굮굯굱굲굷굸굹굺굾궀궃",4,"궊궋궍궎궏궑",10,"궞",5,"궥",17,"궸",7,"귂귃귅귆귇귉",6,"귒귔",7,"귝귞귟귡귢귣귥",18],
["8341","귺귻귽귾긂",5,"긊긌긎",5,"긕",7],
["8361","긝",18,"긲긳긵긶긹긻긼"],
["8381","긽긾긿깂깄깇깈깉깋깏깑깒깓깕깗",4,"깞깢깣깤깦깧깪깫깭깮깯깱",6,"깺깾",5,"꺆",5,"꺍",46,"꺿껁껂껃껅",6,"껎껒",5,"껚껛껝",8],
["8441","껦껧껩껪껬껮",5,"껵껶껷껹껺껻껽",8],
["8461","꼆꼉꼊꼋꼌꼎꼏꼑",18],
["8481","꼤",7,"꼮꼯꼱꼳꼵",6,"꼾꽀꽄꽅꽆꽇꽊",5,"꽑",10,"꽞",5,"꽦",18,"꽺",5,"꾁꾂꾃꾅꾆꾇꾉",6,"꾒꾓꾔꾖",5,"꾝",26,"꾺꾻꾽꾾"],
["8541","꾿꿁",5,"꿊꿌꿏",4,"꿕",6,"꿝",4],
["8561","꿢",5,"꿪",5,"꿲꿳꿵꿶꿷꿹",6,"뀂뀃"],
["8581","뀅",6,"뀍뀎뀏뀑뀒뀓뀕",6,"뀞",9,"뀩",26,"끆끇끉끋끍끏끐끑끒끖끘끚끛끜끞",29,"끾끿낁낂낃낅",6,"낎낐낒",5,"낛낝낞낣낤"],
["8641","낥낦낧낪낰낲낶낷낹낺낻낽",6,"냆냊",5,"냒"],
["8661","냓냕냖냗냙",6,"냡냢냣냤냦",10],
["8681","냱",22,"넊넍넎넏넑넔넕넖넗넚넞",4,"넦넧넩넪넫넭",6,"넶넺",5,"녂녃녅녆녇녉",6,"녒녓녖녗녙녚녛녝녞녟녡",22,"녺녻녽녾녿놁놃",4,"놊놌놎놏놐놑놕놖놗놙놚놛놝"],
["8741","놞",9,"놩",15],
["8761","놹",18,"뇍뇎뇏뇑뇒뇓뇕"],
["8781","뇖",5,"뇞뇠",7,"뇪뇫뇭뇮뇯뇱",7,"뇺뇼뇾",5,"눆눇눉눊눍",6,"눖눘눚",5,"눡",18,"눵",6,"눽",26,"뉙뉚뉛뉝뉞뉟뉡",6,"뉪",4],
["8841","뉯",4,"뉶",5,"뉽",6,"늆늇늈늊",4],
["8861","늏늒늓늕늖늗늛",4,"늢늤늧늨늩늫늭늮늯늱늲늳늵늶늷"],
["8881","늸",15,"닊닋닍닎닏닑닓",4,"닚닜닞닟닠닡닣닧닩닪닰닱닲닶닼닽닾댂댃댅댆댇댉",6,"댒댖",5,"댝",54,"덗덙덚덝덠덡덢덣"],
["8941","덦덨덪덬덭덯덲덳덵덶덷덹",6,"뎂뎆",5,"뎍"],
["8961","뎎뎏뎑뎒뎓뎕",10,"뎢",5,"뎩뎪뎫뎭"],
["8981","뎮",21,"돆돇돉돊돍돏돑돒돓돖돘돚돜돞돟돡돢돣돥돦돧돩",18,"돽",18,"됑",6,"됙됚됛됝됞됟됡",6,"됪됬",7,"됵",15],
["8a41","둅",10,"둒둓둕둖둗둙",6,"둢둤둦"],
["8a61","둧",4,"둭",18,"뒁뒂"],
["8a81","뒃",4,"뒉",19,"뒞",5,"뒥뒦뒧뒩뒪뒫뒭",7,"뒶뒸뒺",5,"듁듂듃듅듆듇듉",6,"듑듒듓듔듖",5,"듞듟듡듢듥듧",4,"듮듰듲",5,"듹",26,"딖딗딙딚딝"],
["8b41","딞",5,"딦딫",4,"딲딳딵딶딷딹",6,"땂땆"],
["8b61","땇땈땉땊땎땏땑땒땓땕",6,"땞땢",8],
["8b81","땫",52,"떢떣떥떦떧떩떬떭떮떯떲떶",4,"떾떿뗁뗂뗃뗅",6,"뗎뗒",5,"뗙",18,"뗭",18],
["8c41","똀",15,"똒똓똕똖똗똙",4],
["8c61","똞",6,"똦",5,"똭",6,"똵",5],
["8c81","똻",12,"뙉",26,"뙥뙦뙧뙩",50,"뚞뚟뚡뚢뚣뚥",5,"뚭뚮뚯뚰뚲",16],
["8d41","뛃",16,"뛕",8],
["8d61","뛞",17,"뛱뛲뛳뛵뛶뛷뛹뛺"],
["8d81","뛻",4,"뜂뜃뜄뜆",33,"뜪뜫뜭뜮뜱",6,"뜺뜼",7,"띅띆띇띉띊띋띍",6,"띖",9,"띡띢띣띥띦띧띩",6,"띲띴띶",5,"띾띿랁랂랃랅",6,"랎랓랔랕랚랛랝랞"],
["8e41","랟랡",6,"랪랮",5,"랶랷랹",8],
["8e61","럂",4,"럈럊",19],
["8e81","럞",13,"럮럯럱럲럳럵",6,"럾렂",4,"렊렋렍렎렏렑",6,"렚렜렞",5,"렦렧렩렪렫렭",6,"렶렺",5,"롁롂롃롅",11,"롒롔",7,"롞롟롡롢롣롥",6,"롮롰롲",5,"롹롺롻롽",7],
["8f41","뢅",7,"뢎",17],
["8f61","뢠",7,"뢩",6,"뢱뢲뢳뢵뢶뢷뢹",4],
["8f81","뢾뢿룂룄룆",5,"룍룎룏룑룒룓룕",7,"룞룠룢",5,"룪룫룭룮룯룱",6,"룺룼룾",5,"뤅",18,"뤙",6,"뤡",26,"뤾뤿륁륂륃륅",6,"륍륎륐륒",5],
["9041","륚륛륝륞륟륡",6,"륪륬륮",5,"륶륷륹륺륻륽"],
["9061","륾",5,"릆릈릋릌릏",15],
["9081","릟",12,"릮릯릱릲릳릵",6,"릾맀맂",5,"맊맋맍맓",4,"맚맜맟맠맢맦맧맩맪맫맭",6,"맶맻",4,"먂",5,"먉",11,"먖",33,"먺먻먽먾먿멁멃멄멅멆"],
["9141","멇멊멌멏멐멑멒멖멗멙멚멛멝",6,"멦멪",5],
["9161","멲멳멵멶멷멹",9,"몆몈몉몊몋몍",5],
["9181","몓",20,"몪몭몮몯몱몳",4,"몺몼몾",5,"뫅뫆뫇뫉",14,"뫚",33,"뫽뫾뫿묁묂묃묅",7,"묎묐묒",5,"묙묚묛묝묞묟묡",6],
["9241","묨묪묬",7,"묷묹묺묿",4,"뭆뭈뭊뭋뭌뭎뭑뭒"],
["9261","뭓뭕뭖뭗뭙",7,"뭢뭤",7,"뭭",4],
["9281","뭲",21,"뮉뮊뮋뮍뮎뮏뮑",18,"뮥뮦뮧뮩뮪뮫뮭",6,"뮵뮶뮸",7,"믁믂믃믅믆믇믉",6,"믑믒믔",35,"믺믻믽믾밁"],
["9341","밃",4,"밊밎밐밒밓밙밚밠밡밢밣밦밨밪밫밬밮밯밲밳밵"],
["9361","밶밷밹",6,"뱂뱆뱇뱈뱊뱋뱎뱏뱑",8],
["9381","뱚뱛뱜뱞",37,"벆벇벉벊벍벏",4,"벖벘벛",4,"벢벣벥벦벩",6,"벲벶",5,"벾벿볁볂볃볅",7,"볎볒볓볔볖볗볙볚볛볝",22,"볷볹볺볻볽"],
["9441","볾",5,"봆봈봊",5,"봑봒봓봕",8],
["9461","봞",5,"봥",6,"봭",12],
["9481","봺",5,"뵁",6,"뵊뵋뵍뵎뵏뵑",6,"뵚",9,"뵥뵦뵧뵩",22,"붂붃붅붆붋",4,"붒붔붖붗붘붛붝",6,"붥",10,"붱",6,"붹",24],
["9541","뷒뷓뷖뷗뷙뷚뷛뷝",11,"뷪",5,"뷱"],
["9561","뷲뷳뷵뷶뷷뷹",6,"븁븂븄븆",5,"븎븏븑븒븓"],
["9581","븕",6,"븞븠",35,"빆빇빉빊빋빍빏",4,"빖빘빜빝빞빟빢빣빥빦빧빩빫",4,"빲빶",4,"빾빿뺁뺂뺃뺅",6,"뺎뺒",5,"뺚",13,"뺩",14],
["9641","뺸",23,"뻒뻓"],
["9661","뻕뻖뻙",6,"뻡뻢뻦",5,"뻭",8],
["9681","뻶",10,"뼂",5,"뼊",13,"뼚뼞",33,"뽂뽃뽅뽆뽇뽉",6,"뽒뽓뽔뽖",44],
["9741","뾃",16,"뾕",8],
["9761","뾞",17,"뾱",7],
["9781","뾹",11,"뿆",5,"뿎뿏뿑뿒뿓뿕",6,"뿝뿞뿠뿢",89,"쀽쀾쀿"],
["9841","쁀",16,"쁒",5,"쁙쁚쁛"],
["9861","쁝쁞쁟쁡",6,"쁪",15],
["9881","쁺",21,"삒삓삕삖삗삙",6,"삢삤삦",5,"삮삱삲삷",4,"삾샂샃샄샆샇샊샋샍샎샏샑",6,"샚샞",5,"샦샧샩샪샫샭",6,"샶샸샺",5,"섁섂섃섅섆섇섉",6,"섑섒섓섔섖",5,"섡섢섥섨섩섪섫섮"],
["9941","섲섳섴섵섷섺섻섽섾섿셁",6,"셊셎",5,"셖셗"],
["9961","셙셚셛셝",6,"셦셪",5,"셱셲셳셵셶셷셹셺셻"],
["9981","셼",8,"솆",5,"솏솑솒솓솕솗",4,"솞솠솢솣솤솦솧솪솫솭솮솯솱",11,"솾",5,"쇅쇆쇇쇉쇊쇋쇍",6,"쇕쇖쇙",6,"쇡쇢쇣쇥쇦쇧쇩",6,"쇲쇴",7,"쇾쇿숁숂숃숅",6,"숎숐숒",5,"숚숛숝숞숡숢숣"],
["9a41","숤숥숦숧숪숬숮숰숳숵",16],
["9a61","쉆쉇쉉",6,"쉒쉓쉕쉖쉗쉙",6,"쉡쉢쉣쉤쉦"],
["9a81","쉧",4,"쉮쉯쉱쉲쉳쉵",6,"쉾슀슂",5,"슊",5,"슑",6,"슙슚슜슞",5,"슦슧슩슪슫슮",5,"슶슸슺",33,"싞싟싡싢싥",5,"싮싰싲싳싴싵싷싺싽싾싿쌁",6,"쌊쌋쌎쌏"],
["9b41","쌐쌑쌒쌖쌗쌙쌚쌛쌝",6,"쌦쌧쌪",8],
["9b61","쌳",17,"썆",7],
["9b81","썎",25,"썪썫썭썮썯썱썳",4,"썺썻썾",5,"쎅쎆쎇쎉쎊쎋쎍",50,"쏁",22,"쏚"],
["9c41","쏛쏝쏞쏡쏣",4,"쏪쏫쏬쏮",5,"쏶쏷쏹",5],
["9c61","쏿",8,"쐉",6,"쐑",9],
["9c81","쐛",8,"쐥",6,"쐭쐮쐯쐱쐲쐳쐵",6,"쐾",9,"쑉",26,"쑦쑧쑩쑪쑫쑭",6,"쑶쑷쑸쑺",5,"쒁",18,"쒕",6,"쒝",12],
["9d41","쒪",13,"쒹쒺쒻쒽",8],
["9d61","쓆",25],
["9d81","쓠",8,"쓪",5,"쓲쓳쓵쓶쓷쓹쓻쓼쓽쓾씂",9,"씍씎씏씑씒씓씕",6,"씝",10,"씪씫씭씮씯씱",6,"씺씼씾",5,"앆앇앋앏앐앑앒앖앚앛앜앟앢앣앥앦앧앩",6,"앲앶",5,"앾앿얁얂얃얅얆얈얉얊얋얎얐얒얓얔"],
["9e41","얖얙얚얛얝얞얟얡",7,"얪",9,"얶"],
["9e61","얷얺얿",4,"엋엍엏엒엓엕엖엗엙",6,"엢엤엦엧"],
["9e81","엨엩엪엫엯엱엲엳엵엸엹엺엻옂옃옄옉옊옋옍옎옏옑",6,"옚옝",6,"옦옧옩옪옫옯옱옲옶옸옺옼옽옾옿왂왃왅왆왇왉",6,"왒왖",5,"왞왟왡",10,"왭왮왰왲",5,"왺왻왽왾왿욁",6,"욊욌욎",5,"욖욗욙욚욛욝",6,"욦"],
["9f41","욨욪",5,"욲욳욵욶욷욻",4,"웂웄웆",5,"웎"],
["9f61","웏웑웒웓웕",6,"웞웟웢",5,"웪웫웭웮웯웱웲"],
["9f81","웳",4,"웺웻웼웾",5,"윆윇윉윊윋윍",6,"윖윘윚",5,"윢윣윥윦윧윩",6,"윲윴윶윸윹윺윻윾윿읁읂읃읅",4,"읋읎읐읙읚읛읝읞읟읡",6,"읩읪읬",7,"읶읷읹읺읻읿잀잁잂잆잋잌잍잏잒잓잕잙잛",4,"잢잧",4,"잮잯잱잲잳잵잶잷"],
["a041","잸잹잺잻잾쟂",5,"쟊쟋쟍쟏쟑",6,"쟙쟚쟛쟜"],
["a061","쟞",5,"쟥쟦쟧쟩쟪쟫쟭",13],
["a081","쟻",4,"젂젃젅젆젇젉젋",4,"젒젔젗",4,"젞젟젡젢젣젥",6,"젮젰젲",5,"젹젺젻젽젾젿졁",6,"졊졋졎",5,"졕",26,"졲졳졵졶졷졹졻",4,"좂좄좈좉좊좎",5,"좕",7,"좞좠좢좣좤"],
["a141","좥좦좧좩",18,"좾좿죀죁"],
["a161","죂죃죅죆죇죉죊죋죍",6,"죖죘죚",5,"죢죣죥"],
["a181","죦",14,"죶",5,"죾죿줁줂줃줇",4,"줎　、。·‥…¨〃­―∥＼∼‘’“”〔〕〈",9,"±×÷≠≤≥∞∴°′″℃Å￠￡￥♂♀∠⊥⌒∂∇≡≒§※☆★○●◎◇◆□■△▲▽▼→←↑↓↔〓≪≫√∽∝∵∫∬∈∋⊆⊇⊂⊃∪∩∧∨￢"],
["a241","줐줒",5,"줙",18],
["a261","줭",6,"줵",18],
["a281","쥈",7,"쥒쥓쥕쥖쥗쥙",6,"쥢쥤",7,"쥭쥮쥯⇒⇔∀∃´～ˇ˘˝˚˙¸˛¡¿ː∮∑∏¤℉‰◁◀▷▶♤♠♡♥♧♣⊙◈▣◐◑▒▤▥▨▧▦▩♨☏☎☜☞¶†‡↕↗↙↖↘♭♩♪♬㉿㈜№㏇™㏂㏘℡€®"],
["a341","쥱쥲쥳쥵",6,"쥽",10,"즊즋즍즎즏"],
["a361","즑",6,"즚즜즞",16],
["a381","즯",16,"짂짃짅짆짉짋",4,"짒짔짗짘짛！",58,"￦］",32,"￣"],
["a441","짞짟짡짣짥짦짨짩짪짫짮짲",5,"짺짻짽짾짿쨁쨂쨃쨄"],
["a461","쨅쨆쨇쨊쨎",5,"쨕쨖쨗쨙",12],
["a481","쨦쨧쨨쨪",28,"ㄱ",93],
["a541","쩇",4,"쩎쩏쩑쩒쩓쩕",6,"쩞쩢",5,"쩩쩪"],
["a561","쩫",17,"쩾",5,"쪅쪆"],
["a581","쪇",16,"쪙",14,"ⅰ",9],
["a5b0","Ⅰ",9],
["a5c1","Α",16,"Σ",6],
["a5e1","α",16,"σ",6],
["a641","쪨",19,"쪾쪿쫁쫂쫃쫅"],
["a661","쫆",5,"쫎쫐쫒쫔쫕쫖쫗쫚",5,"쫡",6],
["a681","쫨쫩쫪쫫쫭",6,"쫵",18,"쬉쬊─│┌┐┘└├┬┤┴┼━┃┏┓┛┗┣┳┫┻╋┠┯┨┷┿┝┰┥┸╂┒┑┚┙┖┕┎┍┞┟┡┢┦┧┩┪┭┮┱┲┵┶┹┺┽┾╀╁╃",7],
["a741","쬋",4,"쬑쬒쬓쬕쬖쬗쬙",6,"쬢",7],
["a761","쬪",22,"쭂쭃쭄"],
["a781","쭅쭆쭇쭊쭋쭍쭎쭏쭑",6,"쭚쭛쭜쭞",5,"쭥",7,"㎕㎖㎗ℓ㎘㏄㎣㎤㎥㎦㎙",9,"㏊㎍㎎㎏㏏㎈㎉㏈㎧㎨㎰",9,"㎀",4,"㎺",5,"㎐",4,"Ω㏀㏁㎊㎋㎌㏖㏅㎭㎮㎯㏛㎩㎪㎫㎬㏝㏐㏓㏃㏉㏜㏆"],
["a841","쭭",10,"쭺",14],
["a861","쮉",18,"쮝",6],
["a881","쮤",19,"쮹",11,"ÆÐªĦ"],
["a8a6","Ĳ"],
["a8a8","ĿŁØŒºÞŦŊ"],
["a8b1","㉠",27,"ⓐ",25,"①",14,"½⅓⅔¼¾⅛⅜⅝⅞"],
["a941","쯅",14,"쯕",10],
["a961","쯠쯡쯢쯣쯥쯦쯨쯪",18],
["a981","쯽",14,"찎찏찑찒찓찕",6,"찞찟찠찣찤æđðħıĳĸŀłøœßþŧŋŉ㈀",27,"⒜",25,"⑴",14,"¹²³⁴ⁿ₁₂₃₄"],
["aa41","찥찦찪찫찭찯찱",6,"찺찿",4,"챆챇챉챊챋챍챎"],
["aa61","챏",4,"챖챚",5,"챡챢챣챥챧챩",6,"챱챲"],
["aa81","챳챴챶",29,"ぁ",82],
["ab41","첔첕첖첗첚첛첝첞첟첡",6,"첪첮",5,"첶첷첹"],
["ab61","첺첻첽",6,"쳆쳈쳊",5,"쳑쳒쳓쳕",5],
["ab81","쳛",8,"쳥",6,"쳭쳮쳯쳱",12,"ァ",85],
["ac41","쳾쳿촀촂",5,"촊촋촍촎촏촑",6,"촚촜촞촟촠"],
["ac61","촡촢촣촥촦촧촩촪촫촭",11,"촺",4],
["ac81","촿",28,"쵝쵞쵟А",5,"ЁЖ",25],
["acd1","а",5,"ёж",25],
["ad41","쵡쵢쵣쵥",6,"쵮쵰쵲",5,"쵹",7],
["ad61","춁",6,"춉",10,"춖춗춙춚춛춝춞춟"],
["ad81","춠춡춢춣춦춨춪",5,"춱",18,"췅"],
["ae41","췆",5,"췍췎췏췑",16],
["ae61","췢",5,"췩췪췫췭췮췯췱",6,"췺췼췾",4],
["ae81","츃츅츆츇츉츊츋츍",6,"츕츖츗츘츚",5,"츢츣츥츦츧츩츪츫"],
["af41","츬츭츮츯츲츴츶",19],
["af61","칊",13,"칚칛칝칞칢",5,"칪칬"],
["af81","칮",5,"칶칷칹칺칻칽",6,"캆캈캊",5,"캒캓캕캖캗캙"],
["b041","캚",5,"캢캦",5,"캮",12],
["b061","캻",5,"컂",19],
["b081","컖",13,"컦컧컩컪컭",6,"컶컺",5,"가각간갇갈갉갊감",7,"같",4,"갠갤갬갭갯갰갱갸갹갼걀걋걍걔걘걜거걱건걷걸걺검겁것겄겅겆겉겊겋게겐겔겜겝겟겠겡겨격겪견겯결겸겹겻겼경곁계곈곌곕곗고곡곤곧골곪곬곯곰곱곳공곶과곽관괄괆"],
["b141","켂켃켅켆켇켉",6,"켒켔켖",5,"켝켞켟켡켢켣"],
["b161","켥",6,"켮켲",5,"켹",11],
["b181","콅",14,"콖콗콙콚콛콝",6,"콦콨콪콫콬괌괍괏광괘괜괠괩괬괭괴괵괸괼굄굅굇굉교굔굘굡굣구국군굳굴굵굶굻굼굽굿궁궂궈궉권궐궜궝궤궷귀귁귄귈귐귑귓규균귤그극근귿글긁금급긋긍긔기긱긴긷길긺김깁깃깅깆깊까깍깎깐깔깖깜깝깟깠깡깥깨깩깬깰깸"],
["b241","콭콮콯콲콳콵콶콷콹",6,"쾁쾂쾃쾄쾆",5,"쾍"],
["b261","쾎",18,"쾢",5,"쾩"],
["b281","쾪",5,"쾱",18,"쿅",6,"깹깻깼깽꺄꺅꺌꺼꺽꺾껀껄껌껍껏껐껑께껙껜껨껫껭껴껸껼꼇꼈꼍꼐꼬꼭꼰꼲꼴꼼꼽꼿꽁꽂꽃꽈꽉꽐꽜꽝꽤꽥꽹꾀꾄꾈꾐꾑꾕꾜꾸꾹꾼꿀꿇꿈꿉꿋꿍꿎꿔꿜꿨꿩꿰꿱꿴꿸뀀뀁뀄뀌뀐뀔뀜뀝뀨끄끅끈끊끌끎끓끔끕끗끙"],
["b341","쿌",19,"쿢쿣쿥쿦쿧쿩"],
["b361","쿪",5,"쿲쿴쿶",5,"쿽쿾쿿퀁퀂퀃퀅",5],
["b381","퀋",5,"퀒",5,"퀙",19,"끝끼끽낀낄낌낍낏낑나낙낚난낟날낡낢남납낫",4,"낱낳내낵낸낼냄냅냇냈냉냐냑냔냘냠냥너넉넋넌널넒넓넘넙넛넜넝넣네넥넨넬넴넵넷넸넹녀녁년녈념녑녔녕녘녜녠노녹논놀놂놈놉놋농높놓놔놘놜놨뇌뇐뇔뇜뇝"],
["b441","퀮",5,"퀶퀷퀹퀺퀻퀽",6,"큆큈큊",5],
["b461","큑큒큓큕큖큗큙",6,"큡",10,"큮큯"],
["b481","큱큲큳큵",6,"큾큿킀킂",18,"뇟뇨뇩뇬뇰뇹뇻뇽누눅눈눋눌눔눕눗눙눠눴눼뉘뉜뉠뉨뉩뉴뉵뉼늄늅늉느늑는늘늙늚늠늡늣능늦늪늬늰늴니닉닌닐닒님닙닛닝닢다닥닦단닫",4,"닳담답닷",4,"닿대댁댄댈댐댑댓댔댕댜더덕덖던덛덜덞덟덤덥"],
["b541","킕",14,"킦킧킩킪킫킭",5],
["b561","킳킶킸킺",5,"탂탃탅탆탇탊",5,"탒탖",4],
["b581","탛탞탟탡탢탣탥",6,"탮탲",5,"탹",11,"덧덩덫덮데덱덴델뎀뎁뎃뎄뎅뎌뎐뎔뎠뎡뎨뎬도독돈돋돌돎돐돔돕돗동돛돝돠돤돨돼됐되된될됨됩됫됴두둑둔둘둠둡둣둥둬뒀뒈뒝뒤뒨뒬뒵뒷뒹듀듄듈듐듕드득든듣들듦듬듭듯등듸디딕딘딛딜딤딥딧딨딩딪따딱딴딸"],
["b641","턅",7,"턎",17],
["b661","턠",15,"턲턳턵턶턷턹턻턼턽턾"],
["b681","턿텂텆",5,"텎텏텑텒텓텕",6,"텞텠텢",5,"텩텪텫텭땀땁땃땄땅땋때땍땐땔땜땝땟땠땡떠떡떤떨떪떫떰떱떳떴떵떻떼떽뗀뗄뗌뗍뗏뗐뗑뗘뗬또똑똔똘똥똬똴뙈뙤뙨뚜뚝뚠뚤뚫뚬뚱뛔뛰뛴뛸뜀뜁뜅뜨뜩뜬뜯뜰뜸뜹뜻띄띈띌띔띕띠띤띨띰띱띳띵라락란랄람랍랏랐랑랒랖랗"],
["b741","텮",13,"텽",6,"톅톆톇톉톊"],
["b761","톋",20,"톢톣톥톦톧"],
["b781","톩",6,"톲톴톶톷톸톹톻톽톾톿퇁",14,"래랙랜랠램랩랫랬랭랴략랸럇량러럭런럴럼럽럿렀렁렇레렉렌렐렘렙렛렝려력련렬렴렵렷렸령례롄롑롓로록론롤롬롭롯롱롸롼뢍뢨뢰뢴뢸룀룁룃룅료룐룔룝룟룡루룩룬룰룸룹룻룽뤄뤘뤠뤼뤽륀륄륌륏륑류륙륜률륨륩"],
["b841","퇐",7,"퇙",17],
["b861","퇫",8,"퇵퇶퇷퇹",13],
["b881","툈툊",5,"툑",24,"륫륭르륵른를름릅릇릉릊릍릎리릭린릴림립릿링마막만많",4,"맘맙맛망맞맡맣매맥맨맬맴맵맷맸맹맺먀먁먈먕머먹먼멀멂멈멉멋멍멎멓메멕멘멜멤멥멧멨멩며멱면멸몃몄명몇몌모목몫몬몰몲몸몹못몽뫄뫈뫘뫙뫼"],
["b941","툪툫툮툯툱툲툳툵",6,"툾퉀퉂",5,"퉉퉊퉋퉌"],
["b961","퉍",14,"퉝",6,"퉥퉦퉧퉨"],
["b981","퉩",22,"튂튃튅튆튇튉튊튋튌묀묄묍묏묑묘묜묠묩묫무묵묶문묻물묽묾뭄뭅뭇뭉뭍뭏뭐뭔뭘뭡뭣뭬뮈뮌뮐뮤뮨뮬뮴뮷므믄믈믐믓미믹민믿밀밂밈밉밋밌밍및밑바",4,"받",4,"밤밥밧방밭배백밴밸뱀뱁뱃뱄뱅뱉뱌뱍뱐뱝버벅번벋벌벎범법벗"],
["ba41","튍튎튏튒튓튔튖",5,"튝튞튟튡튢튣튥",6,"튭"],
["ba61","튮튯튰튲",5,"튺튻튽튾틁틃",4,"틊틌",5],
["ba81","틒틓틕틖틗틙틚틛틝",6,"틦",9,"틲틳틵틶틷틹틺벙벚베벡벤벧벨벰벱벳벴벵벼벽변별볍볏볐병볕볘볜보복볶본볼봄봅봇봉봐봔봤봬뵀뵈뵉뵌뵐뵘뵙뵤뵨부북분붇불붉붊붐붑붓붕붙붚붜붤붰붸뷔뷕뷘뷜뷩뷰뷴뷸븀븃븅브븍븐블븜븝븟비빅빈빌빎빔빕빗빙빚빛빠빡빤"],
["bb41","틻",4,"팂팄팆",5,"팏팑팒팓팕팗",4,"팞팢팣"],
["bb61","팤팦팧팪팫팭팮팯팱",6,"팺팾",5,"퍆퍇퍈퍉"],
["bb81","퍊",31,"빨빪빰빱빳빴빵빻빼빽뺀뺄뺌뺍뺏뺐뺑뺘뺙뺨뻐뻑뻔뻗뻘뻠뻣뻤뻥뻬뼁뼈뼉뼘뼙뼛뼜뼝뽀뽁뽄뽈뽐뽑뽕뾔뾰뿅뿌뿍뿐뿔뿜뿟뿡쀼쁑쁘쁜쁠쁨쁩삐삑삔삘삠삡삣삥사삭삯산삳살삵삶삼삽삿샀상샅새색샌샐샘샙샛샜생샤"],
["bc41","퍪",17,"퍾퍿펁펂펃펅펆펇"],
["bc61","펈펉펊펋펎펒",5,"펚펛펝펞펟펡",6,"펪펬펮"],
["bc81","펯",4,"펵펶펷펹펺펻펽",6,"폆폇폊",5,"폑",5,"샥샨샬샴샵샷샹섀섄섈섐섕서",4,"섣설섦섧섬섭섯섰성섶세섹센셀셈셉셋셌셍셔셕션셜셤셥셧셨셩셰셴셸솅소속솎손솔솖솜솝솟송솥솨솩솬솰솽쇄쇈쇌쇔쇗쇘쇠쇤쇨쇰쇱쇳쇼쇽숀숄숌숍숏숑수숙순숟술숨숩숫숭"],
["bd41","폗폙",7,"폢폤",7,"폮폯폱폲폳폵폶폷"],
["bd61","폸폹폺폻폾퐀퐂",5,"퐉",13],
["bd81","퐗",5,"퐞",25,"숯숱숲숴쉈쉐쉑쉔쉘쉠쉥쉬쉭쉰쉴쉼쉽쉿슁슈슉슐슘슛슝스슥슨슬슭슴습슷승시식신싣실싫심십싯싱싶싸싹싻싼쌀쌈쌉쌌쌍쌓쌔쌕쌘쌜쌤쌥쌨쌩썅써썩썬썰썲썸썹썼썽쎄쎈쎌쏀쏘쏙쏜쏟쏠쏢쏨쏩쏭쏴쏵쏸쐈쐐쐤쐬쐰"],
["be41","퐸",7,"푁푂푃푅",14],
["be61","푔",7,"푝푞푟푡푢푣푥",7,"푮푰푱푲"],
["be81","푳",4,"푺푻푽푾풁풃",4,"풊풌풎",5,"풕",8,"쐴쐼쐽쑈쑤쑥쑨쑬쑴쑵쑹쒀쒔쒜쒸쒼쓩쓰쓱쓴쓸쓺쓿씀씁씌씐씔씜씨씩씬씰씸씹씻씽아악안앉않알앍앎앓암압앗았앙앝앞애액앤앨앰앱앳앴앵야약얀얄얇얌얍얏양얕얗얘얜얠얩어억언얹얻얼얽얾엄",6,"엌엎"],
["bf41","풞",10,"풪",14],
["bf61","풹",18,"퓍퓎퓏퓑퓒퓓퓕"],
["bf81","퓖",5,"퓝퓞퓠",7,"퓩퓪퓫퓭퓮퓯퓱",6,"퓹퓺퓼에엑엔엘엠엡엣엥여역엮연열엶엷염",5,"옅옆옇예옌옐옘옙옛옜오옥온올옭옮옰옳옴옵옷옹옻와왁완왈왐왑왓왔왕왜왝왠왬왯왱외왹왼욀욈욉욋욍요욕욘욜욤욥욧용우욱운울욹욺움웁웃웅워웍원월웜웝웠웡웨"],
["c041","퓾",5,"픅픆픇픉픊픋픍",6,"픖픘",5],
["c061","픞",25],
["c081","픸픹픺픻픾픿핁핂핃핅",6,"핎핐핒",5,"핚핛핝핞핟핡핢핣웩웬웰웸웹웽위윅윈윌윔윕윗윙유육윤율윰윱윳융윷으윽은을읊음읍읏응",7,"읜읠읨읫이익인일읽읾잃임입잇있잉잊잎자작잔잖잗잘잚잠잡잣잤장잦재잭잰잴잼잽잿쟀쟁쟈쟉쟌쟎쟐쟘쟝쟤쟨쟬저적전절젊"],
["c141","핤핦핧핪핬핮",5,"핶핷핹핺핻핽",6,"햆햊햋"],
["c161","햌햍햎햏햑",19,"햦햧"],
["c181","햨",31,"점접젓정젖제젝젠젤젬젭젯젱져젼졀졈졉졌졍졔조족존졸졺좀좁좃종좆좇좋좌좍좔좝좟좡좨좼좽죄죈죌죔죕죗죙죠죡죤죵주죽준줄줅줆줌줍줏중줘줬줴쥐쥑쥔쥘쥠쥡쥣쥬쥰쥴쥼즈즉즌즐즘즙즛증지직진짇질짊짐집짓"],
["c241","헊헋헍헎헏헑헓",4,"헚헜헞",5,"헦헧헩헪헫헭헮"],
["c261","헯",4,"헶헸헺",5,"혂혃혅혆혇혉",6,"혒"],
["c281","혖",5,"혝혞혟혡혢혣혥",7,"혮",9,"혺혻징짖짙짚짜짝짠짢짤짧짬짭짯짰짱째짹짼쨀쨈쨉쨋쨌쨍쨔쨘쨩쩌쩍쩐쩔쩜쩝쩟쩠쩡쩨쩽쪄쪘쪼쪽쫀쫄쫌쫍쫏쫑쫓쫘쫙쫠쫬쫴쬈쬐쬔쬘쬠쬡쭁쭈쭉쭌쭐쭘쭙쭝쭤쭸쭹쮜쮸쯔쯤쯧쯩찌찍찐찔찜찝찡찢찧차착찬찮찰참찹찻"],
["c341","혽혾혿홁홂홃홄홆홇홊홌홎홏홐홒홓홖홗홙홚홛홝",4],
["c361","홢",4,"홨홪",5,"홲홳홵",11],
["c381","횁횂횄횆",5,"횎횏횑횒횓횕",7,"횞횠횢",5,"횩횪찼창찾채책챈챌챔챕챗챘챙챠챤챦챨챰챵처척천철첨첩첫첬청체첵첸첼쳄쳅쳇쳉쳐쳔쳤쳬쳰촁초촉촌촐촘촙촛총촤촨촬촹최쵠쵤쵬쵭쵯쵱쵸춈추축춘출춤춥춧충춰췄췌췐취췬췰췸췹췻췽츄츈츌츔츙츠측츤츨츰츱츳층"],
["c441","횫횭횮횯횱",7,"횺횼",7,"훆훇훉훊훋"],
["c461","훍훎훏훐훒훓훕훖훘훚",5,"훡훢훣훥훦훧훩",4],
["c481","훮훯훱훲훳훴훶",5,"훾훿휁휂휃휅",11,"휒휓휔치칙친칟칠칡침칩칫칭카칵칸칼캄캅캇캉캐캑캔캘캠캡캣캤캥캬캭컁커컥컨컫컬컴컵컷컸컹케켁켄켈켐켑켓켕켜켠켤켬켭켯켰켱켸코콕콘콜콤콥콧콩콰콱콴콸쾀쾅쾌쾡쾨쾰쿄쿠쿡쿤쿨쿰쿱쿳쿵쿼퀀퀄퀑퀘퀭퀴퀵퀸퀼"],
["c541","휕휖휗휚휛휝휞휟휡",6,"휪휬휮",5,"휶휷휹"],
["c561","휺휻휽",6,"흅흆흈흊",5,"흒흓흕흚",4],
["c581","흟흢흤흦흧흨흪흫흭흮흯흱흲흳흵",6,"흾흿힀힂",5,"힊힋큄큅큇큉큐큔큘큠크큭큰클큼큽킁키킥킨킬킴킵킷킹타탁탄탈탉탐탑탓탔탕태택탠탤탬탭탯탰탱탸턍터턱턴털턺텀텁텃텄텅테텍텐텔템텝텟텡텨텬텼톄톈토톡톤톨톰톱톳통톺톼퇀퇘퇴퇸툇툉툐투툭툰툴툼툽툿퉁퉈퉜"],
["c641","힍힎힏힑",6,"힚힜힞",5],
["c6a1","퉤튀튁튄튈튐튑튕튜튠튤튬튱트특튼튿틀틂틈틉틋틔틘틜틤틥티틱틴틸팀팁팃팅파팍팎판팔팖팜팝팟팠팡팥패팩팬팰팸팹팻팼팽퍄퍅퍼퍽펀펄펌펍펏펐펑페펙펜펠펨펩펫펭펴편펼폄폅폈평폐폘폡폣포폭폰폴폼폽폿퐁"],
["c7a1","퐈퐝푀푄표푠푤푭푯푸푹푼푿풀풂품풉풋풍풔풩퓌퓐퓔퓜퓟퓨퓬퓰퓸퓻퓽프픈플픔픕픗피픽핀필핌핍핏핑하학한할핥함합핫항해핵핸핼햄햅햇했행햐향허헉헌헐헒험헙헛헝헤헥헨헬헴헵헷헹혀혁현혈혐협혓혔형혜혠"],
["c8a1","혤혭호혹혼홀홅홈홉홋홍홑화확환활홧황홰홱홴횃횅회획횐횔횝횟횡효횬횰횹횻후훅훈훌훑훔훗훙훠훤훨훰훵훼훽휀휄휑휘휙휜휠휨휩휫휭휴휵휸휼흄흇흉흐흑흔흖흗흘흙흠흡흣흥흩희흰흴흼흽힁히힉힌힐힘힙힛힝"],
["caa1","伽佳假價加可呵哥嘉嫁家暇架枷柯歌珂痂稼苛茄街袈訶賈跏軻迦駕刻却各恪慤殼珏脚覺角閣侃刊墾奸姦干幹懇揀杆柬桿澗癎看磵稈竿簡肝艮艱諫間乫喝曷渴碣竭葛褐蝎鞨勘坎堪嵌感憾戡敢柑橄減甘疳監瞰紺邯鑑鑒龕"],
["cba1","匣岬甲胛鉀閘剛堈姜岡崗康强彊慷江畺疆糠絳綱羌腔舡薑襁講鋼降鱇介价個凱塏愷愾慨改槪漑疥皆盖箇芥蓋豈鎧開喀客坑更粳羹醵倨去居巨拒据據擧渠炬祛距踞車遽鉅鋸乾件健巾建愆楗腱虔蹇鍵騫乞傑杰桀儉劍劒檢"],
["cca1","瞼鈐黔劫怯迲偈憩揭擊格檄激膈覡隔堅牽犬甄絹繭肩見譴遣鵑抉決潔結缺訣兼慊箝謙鉗鎌京俓倞傾儆勁勍卿坰境庚徑慶憬擎敬景暻更梗涇炅烱璟璥瓊痙硬磬竟競絅經耕耿脛莖警輕逕鏡頃頸驚鯨係啓堺契季屆悸戒桂械"],
["cda1","棨溪界癸磎稽系繫繼計誡谿階鷄古叩告呱固姑孤尻庫拷攷故敲暠枯槁沽痼皐睾稿羔考股膏苦苽菰藁蠱袴誥賈辜錮雇顧高鼓哭斛曲梏穀谷鵠困坤崑昆梱棍滾琨袞鯤汨滑骨供公共功孔工恐恭拱控攻珙空蚣貢鞏串寡戈果瓜"],
["cea1","科菓誇課跨過鍋顆廓槨藿郭串冠官寬慣棺款灌琯瓘管罐菅觀貫關館刮恝括适侊光匡壙廣曠洸炚狂珖筐胱鑛卦掛罫乖傀塊壞怪愧拐槐魁宏紘肱轟交僑咬喬嬌嶠巧攪敎校橋狡皎矯絞翹膠蕎蛟較轎郊餃驕鮫丘久九仇俱具勾"],
["cfa1","區口句咎嘔坵垢寇嶇廐懼拘救枸柩構歐毆毬求溝灸狗玖球瞿矩究絿耉臼舅舊苟衢謳購軀逑邱鉤銶駒驅鳩鷗龜國局菊鞠鞫麴君窘群裙軍郡堀屈掘窟宮弓穹窮芎躬倦券勸卷圈拳捲權淃眷厥獗蕨蹶闕机櫃潰詭軌饋句晷歸貴"],
["d0a1","鬼龜叫圭奎揆槻珪硅窺竅糾葵規赳逵閨勻均畇筠菌鈞龜橘克剋劇戟棘極隙僅劤勤懃斤根槿瑾筋芹菫覲謹近饉契今妗擒昑檎琴禁禽芩衾衿襟金錦伋及急扱汲級給亘兢矜肯企伎其冀嗜器圻基埼夔奇妓寄岐崎己幾忌技旗旣"],
["d1a1","朞期杞棋棄機欺氣汽沂淇玘琦琪璂璣畸畿碁磯祁祇祈祺箕紀綺羈耆耭肌記譏豈起錡錤飢饑騎騏驥麒緊佶吉拮桔金喫儺喇奈娜懦懶拏拿癩",5,"那樂",4,"諾酪駱亂卵暖欄煖爛蘭難鸞捏捺南嵐枏楠湳濫男藍襤拉"],
["d2a1","納臘蠟衲囊娘廊",4,"乃來內奈柰耐冷女年撚秊念恬拈捻寧寗努勞奴弩怒擄櫓爐瑙盧",5,"駑魯",10,"濃籠聾膿農惱牢磊腦賂雷尿壘",7,"嫩訥杻紐勒",5,"能菱陵尼泥匿溺多茶"],
["d3a1","丹亶但單團壇彖斷旦檀段湍短端簞緞蛋袒鄲鍛撻澾獺疸達啖坍憺擔曇淡湛潭澹痰聃膽蕁覃談譚錟沓畓答踏遝唐堂塘幢戇撞棠當糖螳黨代垈坮大對岱帶待戴擡玳臺袋貸隊黛宅德悳倒刀到圖堵塗導屠島嶋度徒悼挑掉搗桃"],
["d4a1","棹櫂淘渡滔濤燾盜睹禱稻萄覩賭跳蹈逃途道都鍍陶韜毒瀆牘犢獨督禿篤纛讀墩惇敦旽暾沌焞燉豚頓乭突仝冬凍動同憧東桐棟洞潼疼瞳童胴董銅兜斗杜枓痘竇荳讀豆逗頭屯臀芚遁遯鈍得嶝橙燈登等藤謄鄧騰喇懶拏癩羅"],
["d5a1","蘿螺裸邏樂洛烙珞絡落諾酪駱丹亂卵欄欒瀾爛蘭鸞剌辣嵐擥攬欖濫籃纜藍襤覽拉臘蠟廊朗浪狼琅瑯螂郞來崍徠萊冷掠略亮倆兩凉梁樑粮粱糧良諒輛量侶儷勵呂廬慮戾旅櫚濾礪藜蠣閭驢驪麗黎力曆歷瀝礫轢靂憐戀攣漣"],
["d6a1","煉璉練聯蓮輦連鍊冽列劣洌烈裂廉斂殮濂簾獵令伶囹寧岺嶺怜玲笭羚翎聆逞鈴零靈領齡例澧禮醴隷勞怒撈擄櫓潞瀘爐盧老蘆虜路輅露魯鷺鹵碌祿綠菉錄鹿麓論壟弄朧瀧瓏籠聾儡瀨牢磊賂賚賴雷了僚寮廖料燎療瞭聊蓼"],
["d7a1","遼鬧龍壘婁屢樓淚漏瘻累縷蔞褸鏤陋劉旒柳榴流溜瀏琉瑠留瘤硫謬類六戮陸侖倫崙淪綸輪律慄栗率隆勒肋凜凌楞稜綾菱陵俚利厘吏唎履悧李梨浬犁狸理璃異痢籬罹羸莉裏裡里釐離鯉吝潾燐璘藺躪隣鱗麟林淋琳臨霖砬"],
["d8a1","立笠粒摩瑪痲碼磨馬魔麻寞幕漠膜莫邈万卍娩巒彎慢挽晩曼滿漫灣瞞萬蔓蠻輓饅鰻唜抹末沫茉襪靺亡妄忘忙望網罔芒茫莽輞邙埋妹媒寐昧枚梅每煤罵買賣邁魅脈貊陌驀麥孟氓猛盲盟萌冪覓免冕勉棉沔眄眠綿緬面麵滅"],
["d9a1","蔑冥名命明暝椧溟皿瞑茗蓂螟酩銘鳴袂侮冒募姆帽慕摸摹暮某模母毛牟牡瑁眸矛耗芼茅謀謨貌木沐牧目睦穆鶩歿沒夢朦蒙卯墓妙廟描昴杳渺猫竗苗錨務巫憮懋戊拇撫无楙武毋無珷畝繆舞茂蕪誣貿霧鵡墨默們刎吻問文"],
["daa1","汶紊紋聞蚊門雯勿沕物味媚尾嵋彌微未梶楣渼湄眉米美薇謎迷靡黴岷悶愍憫敏旻旼民泯玟珉緡閔密蜜謐剝博拍搏撲朴樸泊珀璞箔粕縛膊舶薄迫雹駁伴半反叛拌搬攀斑槃泮潘班畔瘢盤盼磐磻礬絆般蟠返頒飯勃拔撥渤潑"],
["dba1","發跋醱鉢髮魃倣傍坊妨尨幇彷房放方旁昉枋榜滂磅紡肪膀舫芳蒡蚌訪謗邦防龐倍俳北培徘拜排杯湃焙盃背胚裴裵褙賠輩配陪伯佰帛柏栢白百魄幡樊煩燔番磻繁蕃藩飜伐筏罰閥凡帆梵氾汎泛犯範范法琺僻劈壁擘檗璧癖"],
["dca1","碧蘗闢霹便卞弁變辨辯邊別瞥鱉鼈丙倂兵屛幷昞昺柄棅炳甁病秉竝輧餠騈保堡報寶普步洑湺潽珤甫菩補褓譜輔伏僕匐卜宓復服福腹茯蔔複覆輹輻馥鰒本乶俸奉封峯峰捧棒烽熢琫縫蓬蜂逢鋒鳳不付俯傅剖副否咐埠夫婦"],
["dda1","孚孵富府復扶敷斧浮溥父符簿缶腐腑膚艀芙莩訃負賦賻赴趺部釜阜附駙鳧北分吩噴墳奔奮忿憤扮昐汾焚盆粉糞紛芬賁雰不佛弗彿拂崩朋棚硼繃鵬丕備匕匪卑妃婢庇悲憊扉批斐枇榧比毖毗毘沸泌琵痺砒碑秕秘粃緋翡肥"],
["dea1","脾臂菲蜚裨誹譬費鄙非飛鼻嚬嬪彬斌檳殯浜濱瀕牝玭貧賓頻憑氷聘騁乍事些仕伺似使俟僿史司唆嗣四士奢娑寫寺射巳師徙思捨斜斯柶査梭死沙泗渣瀉獅砂社祀祠私篩紗絲肆舍莎蓑蛇裟詐詞謝賜赦辭邪飼駟麝削數朔索"],
["dfa1","傘刪山散汕珊産疝算蒜酸霰乷撒殺煞薩三參杉森渗芟蔘衫揷澁鈒颯上傷像償商喪嘗孀尙峠常床庠廂想桑橡湘爽牀狀相祥箱翔裳觴詳象賞霜塞璽賽嗇塞穡索色牲生甥省笙墅壻嶼序庶徐恕抒捿敍暑曙書栖棲犀瑞筮絮緖署"],
["e0a1","胥舒薯西誓逝鋤黍鼠夕奭席惜昔晳析汐淅潟石碩蓆釋錫仙僊先善嬋宣扇敾旋渲煽琁瑄璇璿癬禪線繕羨腺膳船蘚蟬詵跣選銑鐥饍鮮卨屑楔泄洩渫舌薛褻設說雪齧剡暹殲纖蟾贍閃陝攝涉燮葉城姓宬性惺成星晟猩珹盛省筬"],
["e1a1","聖聲腥誠醒世勢歲洗稅笹細說貰召嘯塑宵小少巢所掃搔昭梳沼消溯瀟炤燒甦疏疎瘙笑篠簫素紹蔬蕭蘇訴逍遡邵銷韶騷俗屬束涑粟續謖贖速孫巽損蓀遜飡率宋悚松淞訟誦送頌刷殺灑碎鎖衰釗修受嗽囚垂壽嫂守岫峀帥愁"],
["e2a1","戍手授搜收數樹殊水洙漱燧狩獸琇璲瘦睡秀穗竪粹綏綬繡羞脩茱蒐蓚藪袖誰讐輸遂邃酬銖銹隋隧隨雖需須首髓鬚叔塾夙孰宿淑潚熟琡璹肅菽巡徇循恂旬栒楯橓殉洵淳珣盾瞬筍純脣舜荀蓴蕣詢諄醇錞順馴戌術述鉥崇崧"],
["e3a1","嵩瑟膝蝨濕拾習褶襲丞乘僧勝升承昇繩蠅陞侍匙嘶始媤尸屎屍市弑恃施是時枾柴猜矢示翅蒔蓍視試詩諡豕豺埴寔式息拭植殖湜熄篒蝕識軾食飾伸侁信呻娠宸愼新晨燼申神紳腎臣莘薪藎蜃訊身辛辰迅失室實悉審尋心沁"],
["e4a1","沈深瀋甚芯諶什十拾雙氏亞俄兒啞娥峨我牙芽莪蛾衙訝阿雅餓鴉鵝堊岳嶽幄惡愕握樂渥鄂鍔顎鰐齷安岸按晏案眼雁鞍顔鮟斡謁軋閼唵岩巖庵暗癌菴闇壓押狎鴨仰央怏昻殃秧鴦厓哀埃崖愛曖涯碍艾隘靄厄扼掖液縊腋額"],
["e5a1","櫻罌鶯鸚也倻冶夜惹揶椰爺耶若野弱掠略約若葯蒻藥躍亮佯兩凉壤孃恙揚攘敭暘梁楊樣洋瀁煬痒瘍禳穰糧羊良襄諒讓釀陽量養圄御於漁瘀禦語馭魚齬億憶抑檍臆偃堰彦焉言諺孼蘖俺儼嚴奄掩淹嶪業円予余勵呂女如廬"],
["e6a1","旅歟汝濾璵礖礪與艅茹輿轝閭餘驪麗黎亦力域役易曆歷疫繹譯轢逆驛嚥堧姸娟宴年延憐戀捐挻撚椽沇沿涎涓淵演漣烟然煙煉燃燕璉硏硯秊筵緣練縯聯衍軟輦蓮連鉛鍊鳶列劣咽悅涅烈熱裂說閱厭廉念捻染殮炎焰琰艶苒"],
["e7a1","簾閻髥鹽曄獵燁葉令囹塋寧嶺嶸影怜映暎楹榮永泳渶潁濚瀛瀯煐營獰玲瑛瑩瓔盈穎纓羚聆英詠迎鈴鍈零霙靈領乂倪例刈叡曳汭濊猊睿穢芮藝蘂禮裔詣譽豫醴銳隸霓預五伍俉傲午吾吳嗚塢墺奧娛寤悟惡懊敖旿晤梧汚澳"],
["e8a1","烏熬獒筽蜈誤鰲鼇屋沃獄玉鈺溫瑥瘟穩縕蘊兀壅擁瓮甕癰翁邕雍饔渦瓦窩窪臥蛙蝸訛婉完宛梡椀浣玩琓琬碗緩翫脘腕莞豌阮頑曰往旺枉汪王倭娃歪矮外嵬巍猥畏了僚僥凹堯夭妖姚寥寮尿嶢拗搖撓擾料曜樂橈燎燿瑤療"],
["e9a1","窈窯繇繞耀腰蓼蟯要謠遙遼邀饒慾欲浴縟褥辱俑傭冗勇埇墉容庸慂榕涌湧溶熔瑢用甬聳茸蓉踊鎔鏞龍于佑偶優又友右宇寓尤愚憂旴牛玗瑀盂祐禑禹紆羽芋藕虞迂遇郵釪隅雨雩勖彧旭昱栯煜稶郁頊云暈橒殞澐熉耘芸蕓"],
["eaa1","運隕雲韻蔚鬱亐熊雄元原員圓園垣媛嫄寃怨愿援沅洹湲源爰猿瑗苑袁轅遠阮院願鴛月越鉞位偉僞危圍委威尉慰暐渭爲瑋緯胃萎葦蔿蝟衛褘謂違韋魏乳侑儒兪劉唯喩孺宥幼幽庾悠惟愈愉揄攸有杻柔柚柳楡楢油洧流游溜"],
["eba1","濡猶猷琉瑜由留癒硫紐維臾萸裕誘諛諭踰蹂遊逾遺酉釉鍮類六堉戮毓肉育陸倫允奫尹崙淪潤玧胤贇輪鈗閏律慄栗率聿戎瀜絨融隆垠恩慇殷誾銀隱乙吟淫蔭陰音飮揖泣邑凝應膺鷹依倚儀宜意懿擬椅毅疑矣義艤薏蟻衣誼"],
["eca1","議醫二以伊利吏夷姨履已弛彛怡易李梨泥爾珥理異痍痢移罹而耳肄苡荑裏裡貽貳邇里離飴餌匿溺瀷益翊翌翼謚人仁刃印吝咽因姻寅引忍湮燐璘絪茵藺蚓認隣靭靷鱗麟一佚佾壹日溢逸鎰馹任壬妊姙恁林淋稔臨荏賃入卄"],
["eda1","立笠粒仍剩孕芿仔刺咨姉姿子字孜恣慈滋炙煮玆瓷疵磁紫者自茨蔗藉諮資雌作勺嚼斫昨灼炸爵綽芍酌雀鵲孱棧殘潺盞岑暫潛箴簪蠶雜丈仗匠場墻壯奬將帳庄張掌暲杖樟檣欌漿牆狀獐璋章粧腸臟臧莊葬蔣薔藏裝贓醬長"],
["eea1","障再哉在宰才材栽梓渽滓災縡裁財載齋齎爭箏諍錚佇低儲咀姐底抵杵楮樗沮渚狙猪疽箸紵苧菹著藷詛貯躇這邸雎齟勣吊嫡寂摘敵滴狄炙的積笛籍績翟荻謫賊赤跡蹟迪迹適鏑佃佺傳全典前剪塡塼奠專展廛悛戰栓殿氈澱"],
["efa1","煎琠田甸畑癲筌箋箭篆纏詮輾轉鈿銓錢鐫電顚顫餞切截折浙癤竊節絶占岾店漸点粘霑鮎點接摺蝶丁井亭停偵呈姃定幀庭廷征情挺政整旌晶晸柾楨檉正汀淀淨渟湞瀞炡玎珽町睛碇禎程穽精綎艇訂諪貞鄭酊釘鉦鋌錠霆靖"],
["f0a1","靜頂鼎制劑啼堤帝弟悌提梯濟祭第臍薺製諸蹄醍除際霽題齊俎兆凋助嘲弔彫措操早晁曺曹朝條棗槽漕潮照燥爪璪眺祖祚租稠窕粗糟組繰肇藻蚤詔調趙躁造遭釣阻雕鳥族簇足鏃存尊卒拙猝倧宗從悰慫棕淙琮種終綜縱腫"],
["f1a1","踪踵鍾鐘佐坐左座挫罪主住侏做姝胄呪周嗾奏宙州廚晝朱柱株注洲湊澍炷珠疇籌紂紬綢舟蛛註誅走躊輳週酎酒鑄駐竹粥俊儁准埈寯峻晙樽浚準濬焌畯竣蠢逡遵雋駿茁中仲衆重卽櫛楫汁葺增憎曾拯烝甑症繒蒸證贈之只"],
["f2a1","咫地址志持指摯支旨智枝枳止池沚漬知砥祉祗紙肢脂至芝芷蜘誌識贄趾遲直稙稷織職唇嗔塵振搢晉晋桭榛殄津溱珍瑨璡畛疹盡眞瞋秦縉縝臻蔯袗診賑軫辰進鎭陣陳震侄叱姪嫉帙桎瓆疾秩窒膣蛭質跌迭斟朕什執潗緝輯"],
["f3a1","鏶集徵懲澄且侘借叉嗟嵯差次此磋箚茶蹉車遮捉搾着窄錯鑿齪撰澯燦璨瓚竄簒纂粲纘讚贊鑽餐饌刹察擦札紮僭參塹慘慙懺斬站讒讖倉倡創唱娼廠彰愴敞昌昶暢槍滄漲猖瘡窓脹艙菖蒼債埰寀寨彩採砦綵菜蔡采釵冊柵策"],
["f4a1","責凄妻悽處倜刺剔尺慽戚拓擲斥滌瘠脊蹠陟隻仟千喘天川擅泉淺玔穿舛薦賤踐遷釧闡阡韆凸哲喆徹撤澈綴輟轍鐵僉尖沾添甛瞻簽籤詹諂堞妾帖捷牒疊睫諜貼輒廳晴淸聽菁請靑鯖切剃替涕滯締諦逮遞體初剿哨憔抄招梢"],
["f5a1","椒楚樵炒焦硝礁礎秒稍肖艸苕草蕉貂超酢醋醮促囑燭矗蜀觸寸忖村邨叢塚寵悤憁摠總聰蔥銃撮催崔最墜抽推椎楸樞湫皺秋芻萩諏趨追鄒酋醜錐錘鎚雛騶鰍丑畜祝竺筑築縮蓄蹙蹴軸逐春椿瑃出朮黜充忠沖蟲衝衷悴膵萃"],
["f6a1","贅取吹嘴娶就炊翠聚脆臭趣醉驟鷲側仄厠惻測層侈値嗤峙幟恥梔治淄熾痔痴癡稚穉緇緻置致蚩輜雉馳齒則勅飭親七柒漆侵寢枕沈浸琛砧針鍼蟄秤稱快他咤唾墮妥惰打拖朶楕舵陀馱駝倬卓啄坼度托拓擢晫柝濁濯琢琸託"],
["f7a1","鐸呑嘆坦彈憚歎灘炭綻誕奪脫探眈耽貪塔搭榻宕帑湯糖蕩兌台太怠態殆汰泰笞胎苔跆邰颱宅擇澤撑攄兎吐土討慟桶洞痛筒統通堆槌腿褪退頹偸套妬投透鬪慝特闖坡婆巴把播擺杷波派爬琶破罷芭跛頗判坂板版瓣販辦鈑"],
["f8a1","阪八叭捌佩唄悖敗沛浿牌狽稗覇貝彭澎烹膨愎便偏扁片篇編翩遍鞭騙貶坪平枰萍評吠嬖幣廢弊斃肺蔽閉陛佈包匍匏咆哺圃布怖抛抱捕暴泡浦疱砲胞脯苞葡蒲袍褒逋鋪飽鮑幅暴曝瀑爆輻俵剽彪慓杓標漂瓢票表豹飇飄驃"],
["f9a1","品稟楓諷豊風馮彼披疲皮被避陂匹弼必泌珌畢疋筆苾馝乏逼下何厦夏廈昰河瑕荷蝦賀遐霞鰕壑學虐謔鶴寒恨悍旱汗漢澣瀚罕翰閑閒限韓割轄函含咸啣喊檻涵緘艦銜陷鹹合哈盒蛤閤闔陜亢伉姮嫦巷恒抗杭桁沆港缸肛航"],
["faa1","行降項亥偕咳垓奚孩害懈楷海瀣蟹解該諧邂駭骸劾核倖幸杏荇行享向嚮珦鄕響餉饗香噓墟虛許憲櫶獻軒歇險驗奕爀赫革俔峴弦懸晛泫炫玄玹現眩睍絃絢縣舷衒見賢鉉顯孑穴血頁嫌俠協夾峽挾浹狹脅脇莢鋏頰亨兄刑型"],
["fba1","形泂滎瀅灐炯熒珩瑩荊螢衡逈邢鎣馨兮彗惠慧暳蕙蹊醯鞋乎互呼壕壺好岵弧戶扈昊晧毫浩淏湖滸澔濠濩灝狐琥瑚瓠皓祜糊縞胡芦葫蒿虎號蝴護豪鎬頀顥惑或酷婚昏混渾琿魂忽惚笏哄弘汞泓洪烘紅虹訌鴻化和嬅樺火畵"],
["fca1","禍禾花華話譁貨靴廓擴攫確碻穫丸喚奐宦幻患換歡晥桓渙煥環紈還驩鰥活滑猾豁闊凰幌徨恍惶愰慌晃晄榥況湟滉潢煌璜皇篁簧荒蝗遑隍黃匯回廻徊恢悔懷晦會檜淮澮灰獪繪膾茴蛔誨賄劃獲宖橫鐄哮嚆孝效斅曉梟涍淆"],
["fda1","爻肴酵驍侯候厚后吼喉嗅帿後朽煦珝逅勛勳塤壎焄熏燻薰訓暈薨喧暄煊萱卉喙毁彙徽揮暉煇諱輝麾休携烋畦虧恤譎鷸兇凶匈洶胸黑昕欣炘痕吃屹紇訖欠欽歆吸恰洽翕興僖凞喜噫囍姬嬉希憙憘戱晞曦熙熹熺犧禧稀羲詰"]
]

},{}],34:[function(require,module,exports){
module.exports=[
["0","\u0000",127],
["a140","　，、。．‧；：？！︰…‥﹐﹑﹒·﹔﹕﹖﹗｜–︱—︳╴︴﹏（）︵︶｛｝︷︸〔〕︹︺【】︻︼《》︽︾〈〉︿﹀「」﹁﹂『』﹃﹄﹙﹚"],
["a1a1","﹛﹜﹝﹞‘’“”〝〞‵′＃＆＊※§〃○●△▲◎☆★◇◆□■▽▼㊣℅¯￣＿ˍ﹉﹊﹍﹎﹋﹌﹟﹠﹡＋－×÷±√＜＞＝≦≧≠∞≒≡﹢",4,"～∩∪⊥∠∟⊿㏒㏑∫∮∵∴♀♂⊕⊙↑↓←→↖↗↙↘∥∣／"],
["a240","＼∕﹨＄￥〒￠￡％＠℃℉﹩﹪﹫㏕㎜㎝㎞㏎㎡㎎㎏㏄°兙兛兞兝兡兣嗧瓩糎▁",7,"▏▎▍▌▋▊▉┼┴┬┤├▔─│▕┌┐└┘╭"],
["a2a1","╮╰╯═╞╪╡◢◣◥◤╱╲╳０",9,"Ⅰ",9,"〡",8,"十卄卅Ａ",25,"ａ",21],
["a340","ｗｘｙｚΑ",16,"Σ",6,"α",16,"σ",6,"ㄅ",10],
["a3a1","ㄐ",25,"˙ˉˊˇˋ"],
["a3e1","€"],
["a440","一乙丁七乃九了二人儿入八几刀刁力匕十卜又三下丈上丫丸凡久么也乞于亡兀刃勺千叉口土士夕大女子孑孓寸小尢尸山川工己已巳巾干廾弋弓才"],
["a4a1","丑丐不中丰丹之尹予云井互五亢仁什仃仆仇仍今介仄元允內六兮公冗凶分切刈勻勾勿化匹午升卅卞厄友及反壬天夫太夭孔少尤尺屯巴幻廿弔引心戈戶手扎支文斗斤方日曰月木欠止歹毋比毛氏水火爪父爻片牙牛犬王丙"],
["a540","世丕且丘主乍乏乎以付仔仕他仗代令仙仞充兄冉冊冬凹出凸刊加功包匆北匝仟半卉卡占卯卮去可古右召叮叩叨叼司叵叫另只史叱台句叭叻四囚外"],
["a5a1","央失奴奶孕它尼巨巧左市布平幼弁弘弗必戊打扔扒扑斥旦朮本未末札正母民氐永汁汀氾犯玄玉瓜瓦甘生用甩田由甲申疋白皮皿目矛矢石示禾穴立丞丟乒乓乩亙交亦亥仿伉伙伊伕伍伐休伏仲件任仰仳份企伋光兇兆先全"],
["a640","共再冰列刑划刎刖劣匈匡匠印危吉吏同吊吐吁吋各向名合吃后吆吒因回囝圳地在圭圬圯圩夙多夷夸妄奸妃好她如妁字存宇守宅安寺尖屹州帆并年"],
["a6a1","式弛忙忖戎戌戍成扣扛托收早旨旬旭曲曳有朽朴朱朵次此死氖汝汗汙江池汐汕污汛汍汎灰牟牝百竹米糸缶羊羽老考而耒耳聿肉肋肌臣自至臼舌舛舟艮色艾虫血行衣西阡串亨位住佇佗佞伴佛何估佐佑伽伺伸佃佔似但佣"],
["a740","作你伯低伶余佝佈佚兌克免兵冶冷別判利刪刨劫助努劬匣即卵吝吭吞吾否呎吧呆呃吳呈呂君吩告吹吻吸吮吵吶吠吼呀吱含吟听囪困囤囫坊坑址坍"],
["a7a1","均坎圾坐坏圻壯夾妝妒妨妞妣妙妖妍妤妓妊妥孝孜孚孛完宋宏尬局屁尿尾岐岑岔岌巫希序庇床廷弄弟彤形彷役忘忌志忍忱快忸忪戒我抄抗抖技扶抉扭把扼找批扳抒扯折扮投抓抑抆改攻攸旱更束李杏材村杜杖杞杉杆杠"],
["a840","杓杗步每求汞沙沁沈沉沅沛汪決沐汰沌汨沖沒汽沃汲汾汴沆汶沍沔沘沂灶灼災灸牢牡牠狄狂玖甬甫男甸皂盯矣私秀禿究系罕肖肓肝肘肛肚育良芒"],
["a8a1","芋芍見角言谷豆豕貝赤走足身車辛辰迂迆迅迄巡邑邢邪邦那酉釆里防阮阱阪阬並乖乳事些亞享京佯依侍佳使佬供例來侃佰併侈佩佻侖佾侏侑佺兔兒兕兩具其典冽函刻券刷刺到刮制剁劾劻卒協卓卑卦卷卸卹取叔受味呵"],
["a940","咖呸咕咀呻呷咄咒咆呼咐呱呶和咚呢周咋命咎固垃坷坪坩坡坦坤坼夜奉奇奈奄奔妾妻委妹妮姑姆姐姍始姓姊妯妳姒姅孟孤季宗定官宜宙宛尚屈居"],
["a9a1","屆岷岡岸岩岫岱岳帘帚帖帕帛帑幸庚店府底庖延弦弧弩往征彿彼忝忠忽念忿怏怔怯怵怖怪怕怡性怩怫怛或戕房戾所承拉拌拄抿拂抹拒招披拓拔拋拈抨抽押拐拙拇拍抵拚抱拘拖拗拆抬拎放斧於旺昔易昌昆昂明昀昏昕昊"],
["aa40","昇服朋杭枋枕東果杳杷枇枝林杯杰板枉松析杵枚枓杼杪杲欣武歧歿氓氛泣注泳沱泌泥河沽沾沼波沫法泓沸泄油況沮泗泅泱沿治泡泛泊沬泯泜泖泠"],
["aaa1","炕炎炒炊炙爬爭爸版牧物狀狎狙狗狐玩玨玟玫玥甽疝疙疚的盂盲直知矽社祀祁秉秈空穹竺糾罔羌羋者肺肥肢肱股肫肩肴肪肯臥臾舍芳芝芙芭芽芟芹花芬芥芯芸芣芰芾芷虎虱初表軋迎返近邵邸邱邶采金長門阜陀阿阻附"],
["ab40","陂隹雨青非亟亭亮信侵侯便俠俑俏保促侶俘俟俊俗侮俐俄係俚俎俞侷兗冒冑冠剎剃削前剌剋則勇勉勃勁匍南卻厚叛咬哀咨哎哉咸咦咳哇哂咽咪品"],
["aba1","哄哈咯咫咱咻咩咧咿囿垂型垠垣垢城垮垓奕契奏奎奐姜姘姿姣姨娃姥姪姚姦威姻孩宣宦室客宥封屎屏屍屋峙峒巷帝帥帟幽庠度建弈弭彥很待徊律徇後徉怒思怠急怎怨恍恰恨恢恆恃恬恫恪恤扁拜挖按拼拭持拮拽指拱拷"],
["ac40","拯括拾拴挑挂政故斫施既春昭映昧是星昨昱昤曷柿染柱柔某柬架枯柵柩柯柄柑枴柚查枸柏柞柳枰柙柢柝柒歪殃殆段毒毗氟泉洋洲洪流津洌洱洞洗"],
["aca1","活洽派洶洛泵洹洧洸洩洮洵洎洫炫為炳炬炯炭炸炮炤爰牲牯牴狩狠狡玷珊玻玲珍珀玳甚甭畏界畎畋疫疤疥疢疣癸皆皇皈盈盆盃盅省盹相眉看盾盼眇矜砂研砌砍祆祉祈祇禹禺科秒秋穿突竿竽籽紂紅紀紉紇約紆缸美羿耄"],
["ad40","耐耍耑耶胖胥胚胃胄背胡胛胎胞胤胝致舢苧范茅苣苛苦茄若茂茉苒苗英茁苜苔苑苞苓苟苯茆虐虹虻虺衍衫要觔計訂訃貞負赴赳趴軍軌述迦迢迪迥"],
["ada1","迭迫迤迨郊郎郁郃酋酊重閂限陋陌降面革韋韭音頁風飛食首香乘亳倌倍倣俯倦倥俸倩倖倆值借倚倒們俺倀倔倨俱倡個候倘俳修倭倪俾倫倉兼冤冥冢凍凌准凋剖剜剔剛剝匪卿原厝叟哨唐唁唷哼哥哲唆哺唔哩哭員唉哮哪"],
["ae40","哦唧唇哽唏圃圄埂埔埋埃堉夏套奘奚娑娘娜娟娛娓姬娠娣娩娥娌娉孫屘宰害家宴宮宵容宸射屑展屐峭峽峻峪峨峰島崁峴差席師庫庭座弱徒徑徐恙"],
["aea1","恣恥恐恕恭恩息悄悟悚悍悔悌悅悖扇拳挈拿捎挾振捕捂捆捏捉挺捐挽挪挫挨捍捌效敉料旁旅時晉晏晃晒晌晅晁書朔朕朗校核案框桓根桂桔栩梳栗桌桑栽柴桐桀格桃株桅栓栘桁殊殉殷氣氧氨氦氤泰浪涕消涇浦浸海浙涓"],
["af40","浬涉浮浚浴浩涌涊浹涅浥涔烊烘烤烙烈烏爹特狼狹狽狸狷玆班琉珮珠珪珞畔畝畜畚留疾病症疲疳疽疼疹痂疸皋皰益盍盎眩真眠眨矩砰砧砸砝破砷"],
["afa1","砥砭砠砟砲祕祐祠祟祖神祝祗祚秤秣秧租秦秩秘窄窈站笆笑粉紡紗紋紊素索純紐紕級紜納紙紛缺罟羔翅翁耆耘耕耙耗耽耿胱脂胰脅胭胴脆胸胳脈能脊胼胯臭臬舀舐航舫舨般芻茫荒荔荊茸荐草茵茴荏茲茹茶茗荀茱茨荃"],
["b040","虔蚊蚪蚓蚤蚩蚌蚣蚜衰衷袁袂衽衹記訐討訌訕訊託訓訖訏訑豈豺豹財貢起躬軒軔軏辱送逆迷退迺迴逃追逅迸邕郡郝郢酒配酌釘針釗釜釙閃院陣陡"],
["b0a1","陛陝除陘陞隻飢馬骨高鬥鬲鬼乾偺偽停假偃偌做偉健偶偎偕偵側偷偏倏偯偭兜冕凰剪副勒務勘動匐匏匙匿區匾參曼商啪啦啄啞啡啃啊唱啖問啕唯啤唸售啜唬啣唳啁啗圈國圉域堅堊堆埠埤基堂堵執培夠奢娶婁婉婦婪婀"],
["b140","娼婢婚婆婊孰寇寅寄寂宿密尉專將屠屜屝崇崆崎崛崖崢崑崩崔崙崤崧崗巢常帶帳帷康庸庶庵庾張強彗彬彩彫得徙從徘御徠徜恿患悉悠您惋悴惦悽"],
["b1a1","情悻悵惜悼惘惕惆惟悸惚惇戚戛扈掠控捲掖探接捷捧掘措捱掩掉掃掛捫推掄授掙採掬排掏掀捻捩捨捺敝敖救教敗啟敏敘敕敔斜斛斬族旋旌旎晝晚晤晨晦晞曹勗望梁梯梢梓梵桿桶梱梧梗械梃棄梭梆梅梔條梨梟梡梂欲殺"],
["b240","毫毬氫涎涼淳淙液淡淌淤添淺清淇淋涯淑涮淞淹涸混淵淅淒渚涵淚淫淘淪深淮淨淆淄涪淬涿淦烹焉焊烽烯爽牽犁猜猛猖猓猙率琅琊球理現琍瓠瓶"],
["b2a1","瓷甜產略畦畢異疏痔痕疵痊痍皎盔盒盛眷眾眼眶眸眺硫硃硎祥票祭移窒窕笠笨笛第符笙笞笮粒粗粕絆絃統紮紹紼絀細紳組累終紲紱缽羞羚翌翎習耜聊聆脯脖脣脫脩脰脤舂舵舷舶船莎莞莘荸莢莖莽莫莒莊莓莉莠荷荻荼"],
["b340","莆莧處彪蛇蛀蚶蛄蚵蛆蛋蚱蚯蛉術袞袈被袒袖袍袋覓規訪訝訣訥許設訟訛訢豉豚販責貫貨貪貧赧赦趾趺軛軟這逍通逗連速逝逐逕逞造透逢逖逛途"],
["b3a1","部郭都酗野釵釦釣釧釭釩閉陪陵陳陸陰陴陶陷陬雀雪雩章竟頂頃魚鳥鹵鹿麥麻傢傍傅備傑傀傖傘傚最凱割剴創剩勞勝勛博厥啻喀喧啼喊喝喘喂喜喪喔喇喋喃喳單喟唾喲喚喻喬喱啾喉喫喙圍堯堪場堤堰報堡堝堠壹壺奠"],
["b440","婷媚婿媒媛媧孳孱寒富寓寐尊尋就嵌嵐崴嵇巽幅帽幀幃幾廊廁廂廄弼彭復循徨惑惡悲悶惠愜愣惺愕惰惻惴慨惱愎惶愉愀愒戟扉掣掌描揀揩揉揆揍"],
["b4a1","插揣提握揖揭揮捶援揪換摒揚揹敞敦敢散斑斐斯普晰晴晶景暑智晾晷曾替期朝棺棕棠棘棗椅棟棵森棧棹棒棲棣棋棍植椒椎棉棚楮棻款欺欽殘殖殼毯氮氯氬港游湔渡渲湧湊渠渥渣減湛湘渤湖湮渭渦湯渴湍渺測湃渝渾滋"],
["b540","溉渙湎湣湄湲湩湟焙焚焦焰無然煮焜牌犄犀猶猥猴猩琺琪琳琢琥琵琶琴琯琛琦琨甥甦畫番痢痛痣痙痘痞痠登發皖皓皴盜睏短硝硬硯稍稈程稅稀窘"],
["b5a1","窗窖童竣等策筆筐筒答筍筋筏筑粟粥絞結絨絕紫絮絲絡給絢絰絳善翔翕耋聒肅腕腔腋腑腎脹腆脾腌腓腴舒舜菩萃菸萍菠菅萋菁華菱菴著萊菰萌菌菽菲菊萸萎萄菜萇菔菟虛蛟蛙蛭蛔蛛蛤蛐蛞街裁裂袱覃視註詠評詞証詁"],
["b640","詔詛詐詆訴診訶詖象貂貯貼貳貽賁費賀貴買貶貿貸越超趁跎距跋跚跑跌跛跆軻軸軼辜逮逵週逸進逶鄂郵鄉郾酣酥量鈔鈕鈣鈉鈞鈍鈐鈇鈑閔閏開閑"],
["b6a1","間閒閎隊階隋陽隅隆隍陲隄雁雅雄集雇雯雲韌項順須飧飪飯飩飲飭馮馭黃黍黑亂傭債傲傳僅傾催傷傻傯僇剿剷剽募勦勤勢勣匯嗟嗨嗓嗦嗎嗜嗇嗑嗣嗤嗯嗚嗡嗅嗆嗥嗉園圓塞塑塘塗塚塔填塌塭塊塢塒塋奧嫁嫉嫌媾媽媼"],
["b740","媳嫂媲嵩嵯幌幹廉廈弒彙徬微愚意慈感想愛惹愁愈慎慌慄慍愾愴愧愍愆愷戡戢搓搾搞搪搭搽搬搏搜搔損搶搖搗搆敬斟新暗暉暇暈暖暄暘暍會榔業"],
["b7a1","楚楷楠楔極椰概楊楨楫楞楓楹榆楝楣楛歇歲毀殿毓毽溢溯滓溶滂源溝滇滅溥溘溼溺溫滑準溜滄滔溪溧溴煎煙煩煤煉照煜煬煦煌煥煞煆煨煖爺牒猷獅猿猾瑯瑚瑕瑟瑞瑁琿瑙瑛瑜當畸瘀痰瘁痲痱痺痿痴痳盞盟睛睫睦睞督"],
["b840","睹睪睬睜睥睨睢矮碎碰碗碘碌碉硼碑碓硿祺祿禁萬禽稜稚稠稔稟稞窟窠筷節筠筮筧粱粳粵經絹綑綁綏絛置罩罪署義羨群聖聘肆肄腱腰腸腥腮腳腫"],
["b8a1","腹腺腦舅艇蒂葷落萱葵葦葫葉葬葛萼萵葡董葩葭葆虞虜號蛹蜓蜈蜇蜀蛾蛻蜂蜃蜆蜊衙裟裔裙補裘裝裡裊裕裒覜解詫該詳試詩詰誇詼詣誠話誅詭詢詮詬詹詻訾詨豢貊貉賊資賈賄貲賃賂賅跡跟跨路跳跺跪跤跦躲較載軾輊"],
["b940","辟農運遊道遂達逼違遐遇遏過遍遑逾遁鄒鄗酬酪酩釉鈷鉗鈸鈽鉀鈾鉛鉋鉤鉑鈴鉉鉍鉅鈹鈿鉚閘隘隔隕雍雋雉雊雷電雹零靖靴靶預頑頓頊頒頌飼飴"],
["b9a1","飽飾馳馱馴髡鳩麂鼎鼓鼠僧僮僥僖僭僚僕像僑僱僎僩兢凳劃劂匱厭嗾嘀嘛嘗嗽嘔嘆嘉嘍嘎嗷嘖嘟嘈嘐嗶團圖塵塾境墓墊塹墅塽壽夥夢夤奪奩嫡嫦嫩嫗嫖嫘嫣孵寞寧寡寥實寨寢寤察對屢嶄嶇幛幣幕幗幔廓廖弊彆彰徹慇"],
["ba40","愿態慷慢慣慟慚慘慵截撇摘摔撤摸摟摺摑摧搴摭摻敲斡旗旖暢暨暝榜榨榕槁榮槓構榛榷榻榫榴槐槍榭槌榦槃榣歉歌氳漳演滾漓滴漩漾漠漬漏漂漢"],
["baa1","滿滯漆漱漸漲漣漕漫漯澈漪滬漁滲滌滷熔熙煽熊熄熒爾犒犖獄獐瑤瑣瑪瑰瑭甄疑瘧瘍瘋瘉瘓盡監瞄睽睿睡磁碟碧碳碩碣禎福禍種稱窪窩竭端管箕箋筵算箝箔箏箸箇箄粹粽精綻綰綜綽綾綠緊綴網綱綺綢綿綵綸維緒緇綬"],
["bb40","罰翠翡翟聞聚肇腐膀膏膈膊腿膂臧臺與舔舞艋蓉蒿蓆蓄蒙蒞蒲蒜蓋蒸蓀蓓蒐蒼蓑蓊蜿蜜蜻蜢蜥蜴蜘蝕蜷蜩裳褂裴裹裸製裨褚裯誦誌語誣認誡誓誤"],
["bba1","說誥誨誘誑誚誧豪貍貌賓賑賒赫趙趕跼輔輒輕輓辣遠遘遜遣遙遞遢遝遛鄙鄘鄞酵酸酷酴鉸銀銅銘銖鉻銓銜銨鉼銑閡閨閩閣閥閤隙障際雌雒需靼鞅韶頗領颯颱餃餅餌餉駁骯骰髦魁魂鳴鳶鳳麼鼻齊億儀僻僵價儂儈儉儅凜"],
["bc40","劇劈劉劍劊勰厲嘮嘻嘹嘲嘿嘴嘩噓噎噗噴嘶嘯嘰墀墟增墳墜墮墩墦奭嬉嫻嬋嫵嬌嬈寮寬審寫層履嶝嶔幢幟幡廢廚廟廝廣廠彈影德徵慶慧慮慝慕憂"],
["bca1","慼慰慫慾憧憐憫憎憬憚憤憔憮戮摩摯摹撞撲撈撐撰撥撓撕撩撒撮播撫撚撬撙撢撳敵敷數暮暫暴暱樣樟槨樁樞標槽模樓樊槳樂樅槭樑歐歎殤毅毆漿潼澄潑潦潔澆潭潛潸潮澎潺潰潤澗潘滕潯潠潟熟熬熱熨牖犛獎獗瑩璋璃"],
["bd40","瑾璀畿瘠瘩瘟瘤瘦瘡瘢皚皺盤瞎瞇瞌瞑瞋磋磅確磊碾磕碼磐稿稼穀稽稷稻窯窮箭箱範箴篆篇篁箠篌糊締練緯緻緘緬緝編緣線緞緩綞緙緲緹罵罷羯"],
["bda1","翩耦膛膜膝膠膚膘蔗蔽蔚蓮蔬蔭蔓蔑蔣蔡蔔蓬蔥蓿蔆螂蝴蝶蝠蝦蝸蝨蝙蝗蝌蝓衛衝褐複褒褓褕褊誼諒談諄誕請諸課諉諂調誰論諍誶誹諛豌豎豬賠賞賦賤賬賭賢賣賜質賡赭趟趣踫踐踝踢踏踩踟踡踞躺輝輛輟輩輦輪輜輞"],
["be40","輥適遮遨遭遷鄰鄭鄧鄱醇醉醋醃鋅銻銷鋪銬鋤鋁銳銼鋒鋇鋰銲閭閱霄霆震霉靠鞍鞋鞏頡頫頜颳養餓餒餘駝駐駟駛駑駕駒駙骷髮髯鬧魅魄魷魯鴆鴉"],
["bea1","鴃麩麾黎墨齒儒儘儔儐儕冀冪凝劑劓勳噙噫噹噩噤噸噪器噥噱噯噬噢噶壁墾壇壅奮嬝嬴學寰導彊憲憑憩憊懍憶憾懊懈戰擅擁擋撻撼據擄擇擂操撿擒擔撾整曆曉暹曄曇暸樽樸樺橙橫橘樹橄橢橡橋橇樵機橈歙歷氅濂澱澡"],
["bf40","濃澤濁澧澳激澹澶澦澠澴熾燉燐燒燈燕熹燎燙燜燃燄獨璜璣璘璟璞瓢甌甍瘴瘸瘺盧盥瞠瞞瞟瞥磨磚磬磧禦積穎穆穌穋窺篙簑築篤篛篡篩篦糕糖縊"],
["bfa1","縑縈縛縣縞縝縉縐罹羲翰翱翮耨膳膩膨臻興艘艙蕊蕙蕈蕨蕩蕃蕉蕭蕪蕞螃螟螞螢融衡褪褲褥褫褡親覦諦諺諫諱謀諜諧諮諾謁謂諷諭諳諶諼豫豭貓賴蹄踱踴蹂踹踵輻輯輸輳辨辦遵遴選遲遼遺鄴醒錠錶鋸錳錯錢鋼錫錄錚"],
["c040","錐錦錡錕錮錙閻隧隨險雕霎霑霖霍霓霏靛靜靦鞘頰頸頻頷頭頹頤餐館餞餛餡餚駭駢駱骸骼髻髭鬨鮑鴕鴣鴦鴨鴒鴛默黔龍龜優償儡儲勵嚎嚀嚐嚅嚇"],
["c0a1","嚏壕壓壑壎嬰嬪嬤孺尷屨嶼嶺嶽嶸幫彌徽應懂懇懦懋戲戴擎擊擘擠擰擦擬擱擢擭斂斃曙曖檀檔檄檢檜櫛檣橾檗檐檠歜殮毚氈濘濱濟濠濛濤濫濯澀濬濡濩濕濮濰燧營燮燦燥燭燬燴燠爵牆獰獲璩環璦璨癆療癌盪瞳瞪瞰瞬"],
["c140","瞧瞭矯磷磺磴磯礁禧禪穗窿簇簍篾篷簌篠糠糜糞糢糟糙糝縮績繆縷縲繃縫總縱繅繁縴縹繈縵縿縯罄翳翼聱聲聰聯聳臆臃膺臂臀膿膽臉膾臨舉艱薪"],
["c1a1","薄蕾薜薑薔薯薛薇薨薊虧蟀蟑螳蟒蟆螫螻螺蟈蟋褻褶襄褸褽覬謎謗謙講謊謠謝謄謐豁谿豳賺賽購賸賻趨蹉蹋蹈蹊轄輾轂轅輿避遽還邁邂邀鄹醣醞醜鍍鎂錨鍵鍊鍥鍋錘鍾鍬鍛鍰鍚鍔闊闋闌闈闆隱隸雖霜霞鞠韓顆颶餵騁"],
["c240","駿鮮鮫鮪鮭鴻鴿麋黏點黜黝黛鼾齋叢嚕嚮壙壘嬸彝懣戳擴擲擾攆擺擻擷斷曜朦檳檬櫃檻檸櫂檮檯歟歸殯瀉瀋濾瀆濺瀑瀏燻燼燾燸獷獵璧璿甕癖癘"],
["c2a1","癒瞽瞿瞻瞼礎禮穡穢穠竄竅簫簧簪簞簣簡糧織繕繞繚繡繒繙罈翹翻職聶臍臏舊藏薩藍藐藉薰薺薹薦蟯蟬蟲蟠覆覲觴謨謹謬謫豐贅蹙蹣蹦蹤蹟蹕軀轉轍邇邃邈醫醬釐鎔鎊鎖鎢鎳鎮鎬鎰鎘鎚鎗闔闖闐闕離雜雙雛雞霤鞣鞦"],
["c340","鞭韹額顏題顎顓颺餾餿餽餮馥騎髁鬃鬆魏魎魍鯊鯉鯽鯈鯀鵑鵝鵠黠鼕鼬儳嚥壞壟壢寵龐廬懲懷懶懵攀攏曠曝櫥櫝櫚櫓瀛瀟瀨瀚瀝瀕瀘爆爍牘犢獸"],
["c3a1","獺璽瓊瓣疇疆癟癡矇礙禱穫穩簾簿簸簽簷籀繫繭繹繩繪羅繳羶羹羸臘藩藝藪藕藤藥藷蟻蠅蠍蟹蟾襠襟襖襞譁譜識證譚譎譏譆譙贈贊蹼蹲躇蹶蹬蹺蹴轔轎辭邊邋醱醮鏡鏑鏟鏃鏈鏜鏝鏖鏢鏍鏘鏤鏗鏨關隴難霪霧靡韜韻類"],
["c440","願顛颼饅饉騖騙鬍鯨鯧鯖鯛鶉鵡鵲鵪鵬麒麗麓麴勸嚨嚷嚶嚴嚼壤孀孃孽寶巉懸懺攘攔攙曦朧櫬瀾瀰瀲爐獻瓏癢癥礦礪礬礫竇競籌籃籍糯糰辮繽繼"],
["c4a1","纂罌耀臚艦藻藹蘑藺蘆蘋蘇蘊蠔蠕襤覺觸議譬警譯譟譫贏贍躉躁躅躂醴釋鐘鐃鏽闡霰飄饒饑馨騫騰騷騵鰓鰍鹹麵黨鼯齟齣齡儷儸囁囀囂夔屬巍懼懾攝攜斕曩櫻欄櫺殲灌爛犧瓖瓔癩矓籐纏續羼蘗蘭蘚蠣蠢蠡蠟襪襬覽譴"],
["c540","護譽贓躊躍躋轟辯醺鐮鐳鐵鐺鐸鐲鐫闢霸霹露響顧顥饗驅驃驀騾髏魔魑鰭鰥鶯鶴鷂鶸麝黯鼙齜齦齧儼儻囈囊囉孿巔巒彎懿攤權歡灑灘玀瓤疊癮癬"],
["c5a1","禳籠籟聾聽臟襲襯觼讀贖贗躑躓轡酈鑄鑑鑒霽霾韃韁顫饕驕驍髒鬚鱉鰱鰾鰻鷓鷗鼴齬齪龔囌巖戀攣攫攪曬欐瓚竊籤籣籥纓纖纔臢蘸蘿蠱變邐邏鑣鑠鑤靨顯饜驚驛驗髓體髑鱔鱗鱖鷥麟黴囑壩攬灞癱癲矗罐羈蠶蠹衢讓讒"],
["c640","讖艷贛釀鑪靂靈靄韆顰驟鬢魘鱟鷹鷺鹼鹽鼇齷齲廳欖灣籬籮蠻觀躡釁鑲鑰顱饞髖鬣黌灤矚讚鑷韉驢驥纜讜躪釅鑽鑾鑼鱷鱸黷豔鑿鸚爨驪鬱鸛鸞籲"],
["c940","乂乜凵匚厂万丌乇亍囗兀屮彳丏冇与丮亓仂仉仈冘勼卬厹圠夃夬尐巿旡殳毌气爿丱丼仨仜仩仡仝仚刌匜卌圢圣夗夯宁宄尒尻屴屳帄庀庂忉戉扐氕"],
["c9a1","氶汃氿氻犮犰玊禸肊阞伎优伬仵伔仱伀价伈伝伂伅伢伓伄仴伒冱刓刉刐劦匢匟卍厊吇囡囟圮圪圴夼妀奼妅奻奾奷奿孖尕尥屼屺屻屾巟幵庄异弚彴忕忔忏扜扞扤扡扦扢扙扠扚扥旯旮朾朹朸朻机朿朼朳氘汆汒汜汏汊汔汋"],
["ca40","汌灱牞犴犵玎甪癿穵网艸艼芀艽艿虍襾邙邗邘邛邔阢阤阠阣佖伻佢佉体佤伾佧佒佟佁佘伭伳伿佡冏冹刜刞刡劭劮匉卣卲厎厏吰吷吪呔呅吙吜吥吘"],
["caa1","吽呏呁吨吤呇囮囧囥坁坅坌坉坋坒夆奀妦妘妠妗妎妢妐妏妧妡宎宒尨尪岍岏岈岋岉岒岊岆岓岕巠帊帎庋庉庌庈庍弅弝彸彶忒忑忐忭忨忮忳忡忤忣忺忯忷忻怀忴戺抃抌抎抏抔抇扱扻扺扰抁抈扷扽扲扴攷旰旴旳旲旵杅杇"],
["cb40","杙杕杌杈杝杍杚杋毐氙氚汸汧汫沄沋沏汱汯汩沚汭沇沕沜汦汳汥汻沎灴灺牣犿犽狃狆狁犺狅玕玗玓玔玒町甹疔疕皁礽耴肕肙肐肒肜芐芏芅芎芑芓"],
["cba1","芊芃芄豸迉辿邟邡邥邞邧邠阰阨阯阭丳侘佼侅佽侀侇佶佴侉侄佷佌侗佪侚佹侁佸侐侜侔侞侒侂侕佫佮冞冼冾刵刲刳剆刱劼匊匋匼厒厔咇呿咁咑咂咈呫呺呾呥呬呴呦咍呯呡呠咘呣呧呤囷囹坯坲坭坫坱坰坶垀坵坻坳坴坢"],
["cc40","坨坽夌奅妵妺姏姎妲姌姁妶妼姃姖妱妽姀姈妴姇孢孥宓宕屄屇岮岤岠岵岯岨岬岟岣岭岢岪岧岝岥岶岰岦帗帔帙弨弢弣弤彔徂彾彽忞忥怭怦怙怲怋"],
["cca1","怴怊怗怳怚怞怬怢怍怐怮怓怑怌怉怜戔戽抭抴拑抾抪抶拊抮抳抯抻抩抰抸攽斨斻昉旼昄昒昈旻昃昋昍昅旽昑昐曶朊枅杬枎枒杶杻枘枆构杴枍枌杺枟枑枙枃杽极杸杹枔欥殀歾毞氝沓泬泫泮泙沶泔沭泧沷泐泂沺泃泆泭泲"],
["cd40","泒泝沴沊沝沀泞泀洰泍泇沰泹泏泩泑炔炘炅炓炆炄炑炖炂炚炃牪狖狋狘狉狜狒狔狚狌狑玤玡玭玦玢玠玬玝瓝瓨甿畀甾疌疘皯盳盱盰盵矸矼矹矻矺"],
["cda1","矷祂礿秅穸穻竻籵糽耵肏肮肣肸肵肭舠芠苀芫芚芘芛芵芧芮芼芞芺芴芨芡芩苂芤苃芶芢虰虯虭虮豖迒迋迓迍迖迕迗邲邴邯邳邰阹阽阼阺陃俍俅俓侲俉俋俁俔俜俙侻侳俛俇俖侺俀侹俬剄剉勀勂匽卼厗厖厙厘咺咡咭咥哏"],
["ce40","哃茍咷咮哖咶哅哆咠呰咼咢咾呲哞咰垵垞垟垤垌垗垝垛垔垘垏垙垥垚垕壴复奓姡姞姮娀姱姝姺姽姼姶姤姲姷姛姩姳姵姠姾姴姭宨屌峐峘峌峗峋峛"],
["cea1","峞峚峉峇峊峖峓峔峏峈峆峎峟峸巹帡帢帣帠帤庰庤庢庛庣庥弇弮彖徆怷怹恔恲恞恅恓恇恉恛恌恀恂恟怤恄恘恦恮扂扃拏挍挋拵挎挃拫拹挏挌拸拶挀挓挔拺挕拻拰敁敃斪斿昶昡昲昵昜昦昢昳昫昺昝昴昹昮朏朐柁柲柈枺"],
["cf40","柜枻柸柘柀枷柅柫柤柟枵柍枳柷柶柮柣柂枹柎柧柰枲柼柆柭柌枮柦柛柺柉柊柃柪柋欨殂殄殶毖毘毠氠氡洨洴洭洟洼洿洒洊泚洳洄洙洺洚洑洀洝浂"],
["cfa1","洁洘洷洃洏浀洇洠洬洈洢洉洐炷炟炾炱炰炡炴炵炩牁牉牊牬牰牳牮狊狤狨狫狟狪狦狣玅珌珂珈珅玹玶玵玴珫玿珇玾珃珆玸珋瓬瓮甮畇畈疧疪癹盄眈眃眄眅眊盷盻盺矧矨砆砑砒砅砐砏砎砉砃砓祊祌祋祅祄秕种秏秖秎窀"],
["d040","穾竑笀笁籺籸籹籿粀粁紃紈紁罘羑羍羾耇耎耏耔耷胘胇胠胑胈胂胐胅胣胙胜胊胕胉胏胗胦胍臿舡芔苙苾苹茇苨茀苕茺苫苖苴苬苡苲苵茌苻苶苰苪"],
["d0a1","苤苠苺苳苭虷虴虼虳衁衎衧衪衩觓訄訇赲迣迡迮迠郱邽邿郕郅邾郇郋郈釔釓陔陏陑陓陊陎倞倅倇倓倢倰倛俵俴倳倷倬俶俷倗倜倠倧倵倯倱倎党冔冓凊凄凅凈凎剡剚剒剞剟剕剢勍匎厞唦哢唗唒哧哳哤唚哿唄唈哫唑唅哱"],
["d140","唊哻哷哸哠唎唃唋圁圂埌堲埕埒垺埆垽垼垸垶垿埇埐垹埁夎奊娙娖娭娮娕娏娗娊娞娳孬宧宭宬尃屖屔峬峿峮峱峷崀峹帩帨庨庮庪庬弳弰彧恝恚恧"],
["d1a1","恁悢悈悀悒悁悝悃悕悛悗悇悜悎戙扆拲挐捖挬捄捅挶捃揤挹捋捊挼挩捁挴捘捔捙挭捇挳捚捑挸捗捀捈敊敆旆旃旄旂晊晟晇晑朒朓栟栚桉栲栳栻桋桏栖栱栜栵栫栭栯桎桄栴栝栒栔栦栨栮桍栺栥栠欬欯欭欱欴歭肂殈毦毤"],
["d240","毨毣毢毧氥浺浣浤浶洍浡涒浘浢浭浯涑涍淯浿涆浞浧浠涗浰浼浟涂涘洯浨涋浾涀涄洖涃浻浽浵涐烜烓烑烝烋缹烢烗烒烞烠烔烍烅烆烇烚烎烡牂牸"],
["d2a1","牷牶猀狺狴狾狶狳狻猁珓珙珥珖玼珧珣珩珜珒珛珔珝珚珗珘珨瓞瓟瓴瓵甡畛畟疰痁疻痄痀疿疶疺皊盉眝眛眐眓眒眣眑眕眙眚眢眧砣砬砢砵砯砨砮砫砡砩砳砪砱祔祛祏祜祓祒祑秫秬秠秮秭秪秜秞秝窆窉窅窋窌窊窇竘笐"],
["d340","笄笓笅笏笈笊笎笉笒粄粑粊粌粈粍粅紞紝紑紎紘紖紓紟紒紏紌罜罡罞罠罝罛羖羒翃翂翀耖耾耹胺胲胹胵脁胻脀舁舯舥茳茭荄茙荑茥荖茿荁茦茜茢"],
["d3a1","荂荎茛茪茈茼荍茖茤茠茷茯茩荇荅荌荓茞茬荋茧荈虓虒蚢蚨蚖蚍蚑蚞蚇蚗蚆蚋蚚蚅蚥蚙蚡蚧蚕蚘蚎蚝蚐蚔衃衄衭衵衶衲袀衱衿衯袃衾衴衼訒豇豗豻貤貣赶赸趵趷趶軑軓迾迵适迿迻逄迼迶郖郠郙郚郣郟郥郘郛郗郜郤酐"],
["d440","酎酏釕釢釚陜陟隼飣髟鬯乿偰偪偡偞偠偓偋偝偲偈偍偁偛偊偢倕偅偟偩偫偣偤偆偀偮偳偗偑凐剫剭剬剮勖勓匭厜啵啶唼啍啐唴唪啑啢唶唵唰啒啅"],
["d4a1","唌唲啥啎唹啈唭唻啀啋圊圇埻堔埢埶埜埴堀埭埽堈埸堋埳埏堇埮埣埲埥埬埡堎埼堐埧堁堌埱埩埰堍堄奜婠婘婕婧婞娸娵婭婐婟婥婬婓婤婗婃婝婒婄婛婈媎娾婍娹婌婰婩婇婑婖婂婜孲孮寁寀屙崞崋崝崚崠崌崨崍崦崥崏"],
["d540","崰崒崣崟崮帾帴庱庴庹庲庳弶弸徛徖徟悊悐悆悾悰悺惓惔惏惤惙惝惈悱惛悷惊悿惃惍惀挲捥掊掂捽掽掞掭掝掗掫掎捯掇掐据掯捵掜捭掮捼掤挻掟"],
["d5a1","捸掅掁掑掍捰敓旍晥晡晛晙晜晢朘桹梇梐梜桭桮梮梫楖桯梣梬梩桵桴梲梏桷梒桼桫桲梪梀桱桾梛梖梋梠梉梤桸桻梑梌梊桽欶欳欷欸殑殏殍殎殌氪淀涫涴涳湴涬淩淢涷淶淔渀淈淠淟淖涾淥淜淝淛淴淊涽淭淰涺淕淂淏淉"],
["d640","淐淲淓淽淗淍淣涻烺焍烷焗烴焌烰焄烳焐烼烿焆焓焀烸烶焋焂焎牾牻牼牿猝猗猇猑猘猊猈狿猏猞玈珶珸珵琄琁珽琇琀珺珼珿琌琋珴琈畤畣痎痒痏"],
["d6a1","痋痌痑痐皏皉盓眹眯眭眱眲眴眳眽眥眻眵硈硒硉硍硊硌砦硅硐祤祧祩祪祣祫祡离秺秸秶秷窏窔窐笵筇笴笥笰笢笤笳笘笪笝笱笫笭笯笲笸笚笣粔粘粖粣紵紽紸紶紺絅紬紩絁絇紾紿絊紻紨罣羕羜羝羛翊翋翍翐翑翇翏翉耟"],
["d740","耞耛聇聃聈脘脥脙脛脭脟脬脞脡脕脧脝脢舑舸舳舺舴舲艴莐莣莨莍荺荳莤荴莏莁莕莙荵莔莩荽莃莌莝莛莪莋荾莥莯莈莗莰荿莦莇莮荶莚虙虖蚿蚷"],
["d7a1","蛂蛁蛅蚺蚰蛈蚹蚳蚸蛌蚴蚻蚼蛃蚽蚾衒袉袕袨袢袪袚袑袡袟袘袧袙袛袗袤袬袌袓袎覂觖觙觕訰訧訬訞谹谻豜豝豽貥赽赻赹趼跂趹趿跁軘軞軝軜軗軠軡逤逋逑逜逌逡郯郪郰郴郲郳郔郫郬郩酖酘酚酓酕釬釴釱釳釸釤釹釪"],
["d840","釫釷釨釮镺閆閈陼陭陫陱陯隿靪頄飥馗傛傕傔傞傋傣傃傌傎傝偨傜傒傂傇兟凔匒匑厤厧喑喨喥喭啷噅喢喓喈喏喵喁喣喒喤啽喌喦啿喕喡喎圌堩堷"],
["d8a1","堙堞堧堣堨埵塈堥堜堛堳堿堶堮堹堸堭堬堻奡媯媔媟婺媢媞婸媦婼媥媬媕媮娷媄媊媗媃媋媩婻婽媌媜媏媓媝寪寍寋寔寑寊寎尌尰崷嵃嵫嵁嵋崿崵嵑嵎嵕崳崺嵒崽崱嵙嵂崹嵉崸崼崲崶嵀嵅幄幁彘徦徥徫惉悹惌惢惎惄愔"],
["d940","惲愊愖愅惵愓惸惼惾惁愃愘愝愐惿愄愋扊掔掱掰揎揥揨揯揃撝揳揊揠揶揕揲揵摡揟掾揝揜揄揘揓揂揇揌揋揈揰揗揙攲敧敪敤敜敨敥斌斝斞斮旐旒"],
["d9a1","晼晬晻暀晱晹晪晲朁椌棓椄棜椪棬棪棱椏棖棷棫棤棶椓椐棳棡椇棌椈楰梴椑棯棆椔棸棐棽棼棨椋椊椗棎棈棝棞棦棴棑椆棔棩椕椥棇欹欻欿欼殔殗殙殕殽毰毲毳氰淼湆湇渟湉溈渼渽湅湢渫渿湁湝湳渜渳湋湀湑渻渃渮湞"],
["da40","湨湜湡渱渨湠湱湫渹渢渰湓湥渧湸湤湷湕湹湒湦渵渶湚焠焞焯烻焮焱焣焥焢焲焟焨焺焛牋牚犈犉犆犅犋猒猋猰猢猱猳猧猲猭猦猣猵猌琮琬琰琫琖"],
["daa1","琚琡琭琱琤琣琝琩琠琲瓻甯畯畬痧痚痡痦痝痟痤痗皕皒盚睆睇睄睍睅睊睎睋睌矞矬硠硤硥硜硭硱硪确硰硩硨硞硢祴祳祲祰稂稊稃稌稄窙竦竤筊笻筄筈筌筎筀筘筅粢粞粨粡絘絯絣絓絖絧絪絏絭絜絫絒絔絩絑絟絎缾缿罥"],
["db40","罦羢羠羡翗聑聏聐胾胔腃腊腒腏腇脽腍脺臦臮臷臸臹舄舼舽舿艵茻菏菹萣菀菨萒菧菤菼菶萐菆菈菫菣莿萁菝菥菘菿菡菋菎菖菵菉萉萏菞萑萆菂菳"],
["dba1","菕菺菇菑菪萓菃菬菮菄菻菗菢萛菛菾蛘蛢蛦蛓蛣蛚蛪蛝蛫蛜蛬蛩蛗蛨蛑衈衖衕袺裗袹袸裀袾袶袼袷袽袲褁裉覕覘覗觝觚觛詎詍訹詙詀詗詘詄詅詒詈詑詊詌詏豟貁貀貺貾貰貹貵趄趀趉跘跓跍跇跖跜跏跕跙跈跗跅軯軷軺"],
["dc40","軹軦軮軥軵軧軨軶軫軱軬軴軩逭逴逯鄆鄬鄄郿郼鄈郹郻鄁鄀鄇鄅鄃酡酤酟酢酠鈁鈊鈥鈃鈚鈦鈏鈌鈀鈒釿釽鈆鈄鈧鈂鈜鈤鈙鈗鈅鈖镻閍閌閐隇陾隈"],
["dca1","隉隃隀雂雈雃雱雰靬靰靮頇颩飫鳦黹亃亄亶傽傿僆傮僄僊傴僈僂傰僁傺傱僋僉傶傸凗剺剸剻剼嗃嗛嗌嗐嗋嗊嗝嗀嗔嗄嗩喿嗒喍嗏嗕嗢嗖嗈嗲嗍嗙嗂圔塓塨塤塏塍塉塯塕塎塝塙塥塛堽塣塱壼嫇嫄嫋媺媸媱媵媰媿嫈媻嫆"],
["dd40","媷嫀嫊媴媶嫍媹媐寖寘寙尟尳嵱嵣嵊嵥嵲嵬嵞嵨嵧嵢巰幏幎幊幍幋廅廌廆廋廇彀徯徭惷慉慊愫慅愶愲愮慆愯慏愩慀戠酨戣戥戤揅揱揫搐搒搉搠搤"],
["dda1","搳摃搟搕搘搹搷搢搣搌搦搰搨摁搵搯搊搚摀搥搧搋揧搛搮搡搎敯斒旓暆暌暕暐暋暊暙暔晸朠楦楟椸楎楢楱椿楅楪椹楂楗楙楺楈楉椵楬椳椽楥棰楸椴楩楀楯楄楶楘楁楴楌椻楋椷楜楏楑椲楒椯楻椼歆歅歃歂歈歁殛嗀毻毼"],
["de40","毹毷毸溛滖滈溏滀溟溓溔溠溱溹滆滒溽滁溞滉溷溰滍溦滏溲溾滃滜滘溙溒溎溍溤溡溿溳滐滊溗溮溣煇煔煒煣煠煁煝煢煲煸煪煡煂煘煃煋煰煟煐煓"],
["dea1","煄煍煚牏犍犌犑犐犎猼獂猻猺獀獊獉瑄瑊瑋瑒瑑瑗瑀瑏瑐瑎瑂瑆瑍瑔瓡瓿瓾瓽甝畹畷榃痯瘏瘃痷痾痼痹痸瘐痻痶痭痵痽皙皵盝睕睟睠睒睖睚睩睧睔睙睭矠碇碚碔碏碄碕碅碆碡碃硹碙碀碖硻祼禂祽祹稑稘稙稒稗稕稢稓"],
["df40","稛稐窣窢窞竫筦筤筭筴筩筲筥筳筱筰筡筸筶筣粲粴粯綈綆綀綍絿綅絺綎絻綃絼綌綔綄絽綒罭罫罧罨罬羦羥羧翛翜耡腤腠腷腜腩腛腢腲朡腞腶腧腯"],
["dfa1","腄腡舝艉艄艀艂艅蓱萿葖葶葹蒏蒍葥葑葀蒆葧萰葍葽葚葙葴葳葝蔇葞萷萺萴葺葃葸萲葅萩菙葋萯葂萭葟葰萹葎葌葒葯蓅蒎萻葇萶萳葨葾葄萫葠葔葮葐蜋蜄蛷蜌蛺蛖蛵蝍蛸蜎蜉蜁蛶蜍蜅裖裋裍裎裞裛裚裌裐覅覛觟觥觤"],
["e040","觡觠觢觜触詶誆詿詡訿詷誂誄詵誃誁詴詺谼豋豊豥豤豦貆貄貅賌赨赩趑趌趎趏趍趓趔趐趒跰跠跬跱跮跐跩跣跢跧跲跫跴輆軿輁輀輅輇輈輂輋遒逿"],
["e0a1","遄遉逽鄐鄍鄏鄑鄖鄔鄋鄎酮酯鉈鉒鈰鈺鉦鈳鉥鉞銃鈮鉊鉆鉭鉬鉏鉠鉧鉯鈶鉡鉰鈱鉔鉣鉐鉲鉎鉓鉌鉖鈲閟閜閞閛隒隓隑隗雎雺雽雸雵靳靷靸靲頏頍頎颬飶飹馯馲馰馵骭骫魛鳪鳭鳧麀黽僦僔僗僨僳僛僪僝僤僓僬僰僯僣僠"],
["e140","凘劀劁勩勫匰厬嘧嘕嘌嘒嗼嘏嘜嘁嘓嘂嗺嘝嘄嗿嗹墉塼墐墘墆墁塿塴墋塺墇墑墎塶墂墈塻墔墏壾奫嫜嫮嫥嫕嫪嫚嫭嫫嫳嫢嫠嫛嫬嫞嫝嫙嫨嫟孷寠"],
["e1a1","寣屣嶂嶀嵽嶆嵺嶁嵷嶊嶉嶈嵾嵼嶍嵹嵿幘幙幓廘廑廗廎廜廕廙廒廔彄彃彯徶愬愨慁慞慱慳慒慓慲慬憀慴慔慺慛慥愻慪慡慖戩戧戫搫摍摛摝摴摶摲摳摽摵摦撦摎撂摞摜摋摓摠摐摿搿摬摫摙摥摷敳斠暡暠暟朅朄朢榱榶槉"],
["e240","榠槎榖榰榬榼榑榙榎榧榍榩榾榯榿槄榽榤槔榹槊榚槏榳榓榪榡榞槙榗榐槂榵榥槆歊歍歋殞殟殠毃毄毾滎滵滱漃漥滸漷滻漮漉潎漙漚漧漘漻漒滭漊"],
["e2a1","漶潳滹滮漭潀漰漼漵滫漇漎潃漅滽滶漹漜滼漺漟漍漞漈漡熇熐熉熀熅熂熏煻熆熁熗牄牓犗犕犓獃獍獑獌瑢瑳瑱瑵瑲瑧瑮甀甂甃畽疐瘖瘈瘌瘕瘑瘊瘔皸瞁睼瞅瞂睮瞀睯睾瞃碲碪碴碭碨硾碫碞碥碠碬碢碤禘禊禋禖禕禔禓"],
["e340","禗禈禒禐稫穊稰稯稨稦窨窫窬竮箈箜箊箑箐箖箍箌箛箎箅箘劄箙箤箂粻粿粼粺綧綷緂綣綪緁緀緅綝緎緄緆緋緌綯綹綖綼綟綦綮綩綡緉罳翢翣翥翞"],
["e3a1","耤聝聜膉膆膃膇膍膌膋舕蒗蒤蒡蒟蒺蓎蓂蒬蒮蒫蒹蒴蓁蓍蒪蒚蒱蓐蒝蒧蒻蒢蒔蓇蓌蒛蒩蒯蒨蓖蒘蒶蓏蒠蓗蓔蓒蓛蒰蒑虡蜳蜣蜨蝫蝀蜮蜞蜡蜙蜛蝃蜬蝁蜾蝆蜠蜲蜪蜭蜼蜒蜺蜱蜵蝂蜦蜧蜸蜤蜚蜰蜑裷裧裱裲裺裾裮裼裶裻"],
["e440","裰裬裫覝覡覟覞觩觫觨誫誙誋誒誏誖谽豨豩賕賏賗趖踉踂跿踍跽踊踃踇踆踅跾踀踄輐輑輎輍鄣鄜鄠鄢鄟鄝鄚鄤鄡鄛酺酲酹酳銥銤鉶銛鉺銠銔銪銍"],
["e4a1","銦銚銫鉹銗鉿銣鋮銎銂銕銢鉽銈銡銊銆銌銙銧鉾銇銩銝銋鈭隞隡雿靘靽靺靾鞃鞀鞂靻鞄鞁靿韎韍頖颭颮餂餀餇馝馜駃馹馻馺駂馽駇骱髣髧鬾鬿魠魡魟鳱鳲鳵麧僿儃儰僸儆儇僶僾儋儌僽儊劋劌勱勯噈噂噌嘵噁噊噉噆噘"],
["e540","噚噀嘳嘽嘬嘾嘸嘪嘺圚墫墝墱墠墣墯墬墥墡壿嫿嫴嫽嫷嫶嬃嫸嬂嫹嬁嬇嬅嬏屧嶙嶗嶟嶒嶢嶓嶕嶠嶜嶡嶚嶞幩幝幠幜緳廛廞廡彉徲憋憃慹憱憰憢憉"],
["e5a1","憛憓憯憭憟憒憪憡憍慦憳戭摮摰撖撠撅撗撜撏撋撊撌撣撟摨撱撘敶敺敹敻斲斳暵暰暩暲暷暪暯樀樆樗槥槸樕槱槤樠槿槬槢樛樝槾樧槲槮樔槷槧橀樈槦槻樍槼槫樉樄樘樥樏槶樦樇槴樖歑殥殣殢殦氁氀毿氂潁漦潾澇濆澒"],
["e640","澍澉澌潢潏澅潚澖潶潬澂潕潲潒潐潗澔澓潝漀潡潫潽潧澐潓澋潩潿澕潣潷潪潻熲熯熛熰熠熚熩熵熝熥熞熤熡熪熜熧熳犘犚獘獒獞獟獠獝獛獡獚獙"],
["e6a1","獢璇璉璊璆璁瑽璅璈瑼瑹甈甇畾瘥瘞瘙瘝瘜瘣瘚瘨瘛皜皝皞皛瞍瞏瞉瞈磍碻磏磌磑磎磔磈磃磄磉禚禡禠禜禢禛歶稹窲窴窳箷篋箾箬篎箯箹篊箵糅糈糌糋緷緛緪緧緗緡縃緺緦緶緱緰緮緟罶羬羰羭翭翫翪翬翦翨聤聧膣膟"],
["e740","膞膕膢膙膗舖艏艓艒艐艎艑蔤蔻蔏蔀蔩蔎蔉蔍蔟蔊蔧蔜蓻蔫蓺蔈蔌蓴蔪蓲蔕蓷蓫蓳蓼蔒蓪蓩蔖蓾蔨蔝蔮蔂蓽蔞蓶蔱蔦蓧蓨蓰蓯蓹蔘蔠蔰蔋蔙蔯虢"],
["e7a1","蝖蝣蝤蝷蟡蝳蝘蝔蝛蝒蝡蝚蝑蝞蝭蝪蝐蝎蝟蝝蝯蝬蝺蝮蝜蝥蝏蝻蝵蝢蝧蝩衚褅褌褔褋褗褘褙褆褖褑褎褉覢覤覣觭觰觬諏諆誸諓諑諔諕誻諗誾諀諅諘諃誺誽諙谾豍貏賥賟賙賨賚賝賧趠趜趡趛踠踣踥踤踮踕踛踖踑踙踦踧"],
["e840","踔踒踘踓踜踗踚輬輤輘輚輠輣輖輗遳遰遯遧遫鄯鄫鄩鄪鄲鄦鄮醅醆醊醁醂醄醀鋐鋃鋄鋀鋙銶鋏鋱鋟鋘鋩鋗鋝鋌鋯鋂鋨鋊鋈鋎鋦鋍鋕鋉鋠鋞鋧鋑鋓"],
["e8a1","銵鋡鋆銴镼閬閫閮閰隤隢雓霅霈霂靚鞊鞎鞈韐韏頞頝頦頩頨頠頛頧颲餈飺餑餔餖餗餕駜駍駏駓駔駎駉駖駘駋駗駌骳髬髫髳髲髱魆魃魧魴魱魦魶魵魰魨魤魬鳼鳺鳽鳿鳷鴇鴀鳹鳻鴈鴅鴄麃黓鼏鼐儜儓儗儚儑凞匴叡噰噠噮"],
["e940","噳噦噣噭噲噞噷圜圛壈墽壉墿墺壂墼壆嬗嬙嬛嬡嬔嬓嬐嬖嬨嬚嬠嬞寯嶬嶱嶩嶧嶵嶰嶮嶪嶨嶲嶭嶯嶴幧幨幦幯廩廧廦廨廥彋徼憝憨憖懅憴懆懁懌憺"],
["e9a1","憿憸憌擗擖擐擏擉撽撉擃擛擳擙攳敿敼斢曈暾曀曊曋曏暽暻暺曌朣樴橦橉橧樲橨樾橝橭橶橛橑樨橚樻樿橁橪橤橐橏橔橯橩橠樼橞橖橕橍橎橆歕歔歖殧殪殫毈毇氄氃氆澭濋澣濇澼濎濈潞濄澽澞濊澨瀄澥澮澺澬澪濏澿澸"],
["ea40","澢濉澫濍澯澲澰燅燂熿熸燖燀燁燋燔燊燇燏熽燘熼燆燚燛犝犞獩獦獧獬獥獫獪瑿璚璠璔璒璕璡甋疀瘯瘭瘱瘽瘳瘼瘵瘲瘰皻盦瞚瞝瞡瞜瞛瞢瞣瞕瞙"],
["eaa1","瞗磝磩磥磪磞磣磛磡磢磭磟磠禤穄穈穇窶窸窵窱窷篞篣篧篝篕篥篚篨篹篔篪篢篜篫篘篟糒糔糗糐糑縒縡縗縌縟縠縓縎縜縕縚縢縋縏縖縍縔縥縤罃罻罼罺羱翯耪耩聬膱膦膮膹膵膫膰膬膴膲膷膧臲艕艖艗蕖蕅蕫蕍蕓蕡蕘"],
["eb40","蕀蕆蕤蕁蕢蕄蕑蕇蕣蔾蕛蕱蕎蕮蕵蕕蕧蕠薌蕦蕝蕔蕥蕬虣虥虤螛螏螗螓螒螈螁螖螘蝹螇螣螅螐螑螝螄螔螜螚螉褞褦褰褭褮褧褱褢褩褣褯褬褟觱諠"],
["eba1","諢諲諴諵諝謔諤諟諰諈諞諡諨諿諯諻貑貒貐賵賮賱賰賳赬赮趥趧踳踾踸蹀蹅踶踼踽蹁踰踿躽輶輮輵輲輹輷輴遶遹遻邆郺鄳鄵鄶醓醐醑醍醏錧錞錈錟錆錏鍺錸錼錛錣錒錁鍆錭錎錍鋋錝鋺錥錓鋹鋷錴錂錤鋿錩錹錵錪錔錌"],
["ec40","錋鋾錉錀鋻錖閼闍閾閹閺閶閿閵閽隩雔霋霒霐鞙鞗鞔韰韸頵頯頲餤餟餧餩馞駮駬駥駤駰駣駪駩駧骹骿骴骻髶髺髹髷鬳鮀鮅鮇魼魾魻鮂鮓鮒鮐魺鮕"],
["eca1","魽鮈鴥鴗鴠鴞鴔鴩鴝鴘鴢鴐鴙鴟麈麆麇麮麭黕黖黺鼒鼽儦儥儢儤儠儩勴嚓嚌嚍嚆嚄嚃噾嚂噿嚁壖壔壏壒嬭嬥嬲嬣嬬嬧嬦嬯嬮孻寱寲嶷幬幪徾徻懃憵憼懧懠懥懤懨懞擯擩擣擫擤擨斁斀斶旚曒檍檖檁檥檉檟檛檡檞檇檓檎"],
["ed40","檕檃檨檤檑橿檦檚檅檌檒歛殭氉濌澩濴濔濣濜濭濧濦濞濲濝濢濨燡燱燨燲燤燰燢獳獮獯璗璲璫璐璪璭璱璥璯甐甑甒甏疄癃癈癉癇皤盩瞵瞫瞲瞷瞶"],
["eda1","瞴瞱瞨矰磳磽礂磻磼磲礅磹磾礄禫禨穜穛穖穘穔穚窾竀竁簅簏篲簀篿篻簎篴簋篳簂簉簃簁篸篽簆篰篱簐簊糨縭縼繂縳顈縸縪繉繀繇縩繌縰縻縶繄縺罅罿罾罽翴翲耬膻臄臌臊臅臇膼臩艛艚艜薃薀薏薧薕薠薋薣蕻薤薚薞"],
["ee40","蕷蕼薉薡蕺蕸蕗薎薖薆薍薙薝薁薢薂薈薅蕹蕶薘薐薟虨螾螪螭蟅螰螬螹螵螼螮蟉蟃蟂蟌螷螯蟄蟊螴螶螿螸螽蟞螲褵褳褼褾襁襒褷襂覭覯覮觲觳謞"],
["eea1","謘謖謑謅謋謢謏謒謕謇謍謈謆謜謓謚豏豰豲豱豯貕貔賹赯蹎蹍蹓蹐蹌蹇轃轀邅遾鄸醚醢醛醙醟醡醝醠鎡鎃鎯鍤鍖鍇鍼鍘鍜鍶鍉鍐鍑鍠鍭鎏鍌鍪鍹鍗鍕鍒鍏鍱鍷鍻鍡鍞鍣鍧鎀鍎鍙闇闀闉闃闅閷隮隰隬霠霟霘霝霙鞚鞡鞜"],
["ef40","鞞鞝韕韔韱顁顄顊顉顅顃餥餫餬餪餳餲餯餭餱餰馘馣馡騂駺駴駷駹駸駶駻駽駾駼騃骾髾髽鬁髼魈鮚鮨鮞鮛鮦鮡鮥鮤鮆鮢鮠鮯鴳鵁鵧鴶鴮鴯鴱鴸鴰"],
["efa1","鵅鵂鵃鴾鴷鵀鴽翵鴭麊麉麍麰黈黚黻黿鼤鼣鼢齔龠儱儭儮嚘嚜嚗嚚嚝嚙奰嬼屩屪巀幭幮懘懟懭懮懱懪懰懫懖懩擿攄擽擸攁攃擼斔旛曚曛曘櫅檹檽櫡櫆檺檶檷櫇檴檭歞毉氋瀇瀌瀍瀁瀅瀔瀎濿瀀濻瀦濼濷瀊爁燿燹爃燽獶"],
["f040","璸瓀璵瓁璾璶璻瓂甔甓癜癤癙癐癓癗癚皦皽盬矂瞺磿礌礓礔礉礐礒礑禭禬穟簜簩簙簠簟簭簝簦簨簢簥簰繜繐繖繣繘繢繟繑繠繗繓羵羳翷翸聵臑臒"],
["f0a1","臐艟艞薴藆藀藃藂薳薵薽藇藄薿藋藎藈藅薱薶藒蘤薸薷薾虩蟧蟦蟢蟛蟫蟪蟥蟟蟳蟤蟔蟜蟓蟭蟘蟣螤蟗蟙蠁蟴蟨蟝襓襋襏襌襆襐襑襉謪謧謣謳謰謵譇謯謼謾謱謥謷謦謶謮謤謻謽謺豂豵貙貘貗賾贄贂贀蹜蹢蹠蹗蹖蹞蹥蹧"],
["f140","蹛蹚蹡蹝蹩蹔轆轇轈轋鄨鄺鄻鄾醨醥醧醯醪鎵鎌鎒鎷鎛鎝鎉鎧鎎鎪鎞鎦鎕鎈鎙鎟鎍鎱鎑鎲鎤鎨鎴鎣鎥闒闓闑隳雗雚巂雟雘雝霣霢霥鞬鞮鞨鞫鞤鞪"],
["f1a1","鞢鞥韗韙韖韘韺顐顑顒颸饁餼餺騏騋騉騍騄騑騊騅騇騆髀髜鬈鬄鬅鬩鬵魊魌魋鯇鯆鯃鮿鯁鮵鮸鯓鮶鯄鮹鮽鵜鵓鵏鵊鵛鵋鵙鵖鵌鵗鵒鵔鵟鵘鵚麎麌黟鼁鼀鼖鼥鼫鼪鼩鼨齌齕儴儵劖勷厴嚫嚭嚦嚧嚪嚬壚壝壛夒嬽嬾嬿巃幰"],
["f240","徿懻攇攐攍攉攌攎斄旞旝曞櫧櫠櫌櫑櫙櫋櫟櫜櫐櫫櫏櫍櫞歠殰氌瀙瀧瀠瀖瀫瀡瀢瀣瀩瀗瀤瀜瀪爌爊爇爂爅犥犦犤犣犡瓋瓅璷瓃甖癠矉矊矄矱礝礛"],
["f2a1","礡礜礗礞禰穧穨簳簼簹簬簻糬糪繶繵繸繰繷繯繺繲繴繨罋罊羃羆羷翽翾聸臗臕艤艡艣藫藱藭藙藡藨藚藗藬藲藸藘藟藣藜藑藰藦藯藞藢蠀蟺蠃蟶蟷蠉蠌蠋蠆蟼蠈蟿蠊蠂襢襚襛襗襡襜襘襝襙覈覷覶觶譐譈譊譀譓譖譔譋譕"],
["f340","譑譂譒譗豃豷豶貚贆贇贉趬趪趭趫蹭蹸蹳蹪蹯蹻軂轒轑轏轐轓辴酀鄿醰醭鏞鏇鏏鏂鏚鏐鏹鏬鏌鏙鎩鏦鏊鏔鏮鏣鏕鏄鏎鏀鏒鏧镽闚闛雡霩霫霬霨霦"],
["f3a1","鞳鞷鞶韝韞韟顜顙顝顗颿颽颻颾饈饇饃馦馧騚騕騥騝騤騛騢騠騧騣騞騜騔髂鬋鬊鬎鬌鬷鯪鯫鯠鯞鯤鯦鯢鯰鯔鯗鯬鯜鯙鯥鯕鯡鯚鵷鶁鶊鶄鶈鵱鶀鵸鶆鶋鶌鵽鵫鵴鵵鵰鵩鶅鵳鵻鶂鵯鵹鵿鶇鵨麔麑黀黼鼭齀齁齍齖齗齘匷嚲"],
["f440","嚵嚳壣孅巆巇廮廯忀忁懹攗攖攕攓旟曨曣曤櫳櫰櫪櫨櫹櫱櫮櫯瀼瀵瀯瀷瀴瀱灂瀸瀿瀺瀹灀瀻瀳灁爓爔犨獽獼璺皫皪皾盭矌矎矏矍矲礥礣礧礨礤礩"],
["f4a1","禲穮穬穭竷籉籈籊籇籅糮繻繾纁纀羺翿聹臛臙舋艨艩蘢藿蘁藾蘛蘀藶蘄蘉蘅蘌藽蠙蠐蠑蠗蠓蠖襣襦覹觷譠譪譝譨譣譥譧譭趮躆躈躄轙轖轗轕轘轚邍酃酁醷醵醲醳鐋鐓鏻鐠鐏鐔鏾鐕鐐鐨鐙鐍鏵鐀鏷鐇鐎鐖鐒鏺鐉鏸鐊鏿"],
["f540","鏼鐌鏶鐑鐆闞闠闟霮霯鞹鞻韽韾顠顢顣顟飁飂饐饎饙饌饋饓騲騴騱騬騪騶騩騮騸騭髇髊髆鬐鬒鬑鰋鰈鯷鰅鰒鯸鱀鰇鰎鰆鰗鰔鰉鶟鶙鶤鶝鶒鶘鶐鶛"],
["f5a1","鶠鶔鶜鶪鶗鶡鶚鶢鶨鶞鶣鶿鶩鶖鶦鶧麙麛麚黥黤黧黦鼰鼮齛齠齞齝齙龑儺儹劘劗囃嚽嚾孈孇巋巏廱懽攛欂櫼欃櫸欀灃灄灊灈灉灅灆爝爚爙獾甗癪矐礭礱礯籔籓糲纊纇纈纋纆纍罍羻耰臝蘘蘪蘦蘟蘣蘜蘙蘧蘮蘡蘠蘩蘞蘥"],
["f640","蠩蠝蠛蠠蠤蠜蠫衊襭襩襮襫觺譹譸譅譺譻贐贔趯躎躌轞轛轝酆酄酅醹鐿鐻鐶鐩鐽鐼鐰鐹鐪鐷鐬鑀鐱闥闤闣霵霺鞿韡顤飉飆飀饘饖騹騽驆驄驂驁騺"],
["f6a1","騿髍鬕鬗鬘鬖鬺魒鰫鰝鰜鰬鰣鰨鰩鰤鰡鶷鶶鶼鷁鷇鷊鷏鶾鷅鷃鶻鶵鷎鶹鶺鶬鷈鶱鶭鷌鶳鷍鶲鹺麜黫黮黭鼛鼘鼚鼱齎齥齤龒亹囆囅囋奱孋孌巕巑廲攡攠攦攢欋欈欉氍灕灖灗灒爞爟犩獿瓘瓕瓙瓗癭皭礵禴穰穱籗籜籙籛籚"],
["f740","糴糱纑罏羇臞艫蘴蘵蘳蘬蘲蘶蠬蠨蠦蠪蠥襱覿覾觻譾讄讂讆讅譿贕躕躔躚躒躐躖躗轠轢酇鑌鑐鑊鑋鑏鑇鑅鑈鑉鑆霿韣顪顩飋饔饛驎驓驔驌驏驈驊"],
["f7a1","驉驒驐髐鬙鬫鬻魖魕鱆鱈鰿鱄鰹鰳鱁鰼鰷鰴鰲鰽鰶鷛鷒鷞鷚鷋鷐鷜鷑鷟鷩鷙鷘鷖鷵鷕鷝麶黰鼵鼳鼲齂齫龕龢儽劙壨壧奲孍巘蠯彏戁戃戄攩攥斖曫欑欒欏毊灛灚爢玂玁玃癰矔籧籦纕艬蘺虀蘹蘼蘱蘻蘾蠰蠲蠮蠳襶襴襳觾"],
["f840","讌讎讋讈豅贙躘轤轣醼鑢鑕鑝鑗鑞韄韅頀驖驙鬞鬟鬠鱒鱘鱐鱊鱍鱋鱕鱙鱌鱎鷻鷷鷯鷣鷫鷸鷤鷶鷡鷮鷦鷲鷰鷢鷬鷴鷳鷨鷭黂黐黲黳鼆鼜鼸鼷鼶齃齏"],
["f8a1","齱齰齮齯囓囍孎屭攭曭曮欓灟灡灝灠爣瓛瓥矕礸禷禶籪纗羉艭虃蠸蠷蠵衋讔讕躞躟躠躝醾醽釂鑫鑨鑩雥靆靃靇韇韥驞髕魙鱣鱧鱦鱢鱞鱠鸂鷾鸇鸃鸆鸅鸀鸁鸉鷿鷽鸄麠鼞齆齴齵齶囔攮斸欘欙欗欚灢爦犪矘矙礹籩籫糶纚"],
["f940","纘纛纙臠臡虆虇虈襹襺襼襻觿讘讙躥躤躣鑮鑭鑯鑱鑳靉顲饟鱨鱮鱭鸋鸍鸐鸏鸒鸑麡黵鼉齇齸齻齺齹圞灦籯蠼趲躦釃鑴鑸鑶鑵驠鱴鱳鱱鱵鸔鸓黶鼊"],
["f9a1","龤灨灥糷虪蠾蠽蠿讞貜躩軉靋顳顴飌饡馫驤驦驧鬤鸕鸗齈戇欞爧虌躨钂钀钁驩驨鬮鸙爩虋讟钃鱹麷癵驫鱺鸝灩灪麤齾齉龘碁銹裏墻恒粧嫺╔╦╗╠╬╣╚╩╝╒╤╕╞╪╡╘╧╛╓╥╖╟╫╢╙╨╜║═╭╮╰╯▓"]
]

},{}],35:[function(require,module,exports){
module.exports=[
["0","\u0000",127],
["8ea1","｡",62],
["a1a1","　、。，．・：；？！゛゜´｀¨＾￣＿ヽヾゝゞ〃仝々〆〇ー―‐／＼～∥｜…‥‘’“”（）〔〕［］｛｝〈",9,"＋－±×÷＝≠＜＞≦≧∞∴♂♀°′″℃￥＄￠￡％＃＆＊＠§☆★○●◎◇"],
["a2a1","◆□■△▲▽▼※〒→←↑↓〓"],
["a2ba","∈∋⊆⊇⊂⊃∪∩"],
["a2ca","∧∨￢⇒⇔∀∃"],
["a2dc","∠⊥⌒∂∇≡≒≪≫√∽∝∵∫∬"],
["a2f2","Å‰♯♭♪†‡¶"],
["a2fe","◯"],
["a3b0","０",9],
["a3c1","Ａ",25],
["a3e1","ａ",25],
["a4a1","ぁ",82],
["a5a1","ァ",85],
["a6a1","Α",16,"Σ",6],
["a6c1","α",16,"σ",6],
["a7a1","А",5,"ЁЖ",25],
["a7d1","а",5,"ёж",25],
["a8a1","─│┌┐┘└├┬┤┴┼━┃┏┓┛┗┣┳┫┻╋┠┯┨┷┿┝┰┥┸╂"],
["ada1","①",19,"Ⅰ",9],
["adc0","㍉㌔㌢㍍㌘㌧㌃㌶㍑㍗㌍㌦㌣㌫㍊㌻㎜㎝㎞㎎㎏㏄㎡"],
["addf","㍻〝〟№㏍℡㊤",4,"㈱㈲㈹㍾㍽㍼≒≡∫∮∑√⊥∠∟⊿∵∩∪"],
["b0a1","亜唖娃阿哀愛挨姶逢葵茜穐悪握渥旭葦芦鯵梓圧斡扱宛姐虻飴絢綾鮎或粟袷安庵按暗案闇鞍杏以伊位依偉囲夷委威尉惟意慰易椅為畏異移維緯胃萎衣謂違遺医井亥域育郁磯一壱溢逸稲茨芋鰯允印咽員因姻引飲淫胤蔭"],
["b1a1","院陰隠韻吋右宇烏羽迂雨卯鵜窺丑碓臼渦嘘唄欝蔚鰻姥厩浦瓜閏噂云運雲荏餌叡営嬰影映曳栄永泳洩瑛盈穎頴英衛詠鋭液疫益駅悦謁越閲榎厭円園堰奄宴延怨掩援沿演炎焔煙燕猿縁艶苑薗遠鉛鴛塩於汚甥凹央奥往応"],
["b2a1","押旺横欧殴王翁襖鴬鴎黄岡沖荻億屋憶臆桶牡乙俺卸恩温穏音下化仮何伽価佳加可嘉夏嫁家寡科暇果架歌河火珂禍禾稼箇花苛茄荷華菓蝦課嘩貨迦過霞蚊俄峨我牙画臥芽蛾賀雅餓駕介会解回塊壊廻快怪悔恢懐戒拐改"],
["b3a1","魁晦械海灰界皆絵芥蟹開階貝凱劾外咳害崖慨概涯碍蓋街該鎧骸浬馨蛙垣柿蛎鈎劃嚇各廓拡撹格核殻獲確穫覚角赫較郭閣隔革学岳楽額顎掛笠樫橿梶鰍潟割喝恰括活渇滑葛褐轄且鰹叶椛樺鞄株兜竃蒲釜鎌噛鴨栢茅萱"],
["b4a1","粥刈苅瓦乾侃冠寒刊勘勧巻喚堪姦完官寛干幹患感慣憾換敢柑桓棺款歓汗漢澗潅環甘監看竿管簡緩缶翰肝艦莞観諌貫還鑑間閑関陥韓館舘丸含岸巌玩癌眼岩翫贋雁頑顔願企伎危喜器基奇嬉寄岐希幾忌揮机旗既期棋棄"],
["b5a1","機帰毅気汽畿祈季稀紀徽規記貴起軌輝飢騎鬼亀偽儀妓宜戯技擬欺犠疑祇義蟻誼議掬菊鞠吉吃喫桔橘詰砧杵黍却客脚虐逆丘久仇休及吸宮弓急救朽求汲泣灸球究窮笈級糾給旧牛去居巨拒拠挙渠虚許距鋸漁禦魚亨享京"],
["b6a1","供侠僑兇競共凶協匡卿叫喬境峡強彊怯恐恭挟教橋況狂狭矯胸脅興蕎郷鏡響饗驚仰凝尭暁業局曲極玉桐粁僅勤均巾錦斤欣欽琴禁禽筋緊芹菌衿襟謹近金吟銀九倶句区狗玖矩苦躯駆駈駒具愚虞喰空偶寓遇隅串櫛釧屑屈"],
["b7a1","掘窟沓靴轡窪熊隈粂栗繰桑鍬勲君薫訓群軍郡卦袈祁係傾刑兄啓圭珪型契形径恵慶慧憩掲携敬景桂渓畦稽系経継繋罫茎荊蛍計詣警軽頚鶏芸迎鯨劇戟撃激隙桁傑欠決潔穴結血訣月件倹倦健兼券剣喧圏堅嫌建憲懸拳捲"],
["b8a1","検権牽犬献研硯絹県肩見謙賢軒遣鍵険顕験鹸元原厳幻弦減源玄現絃舷言諺限乎個古呼固姑孤己庫弧戸故枯湖狐糊袴股胡菰虎誇跨鈷雇顧鼓五互伍午呉吾娯後御悟梧檎瑚碁語誤護醐乞鯉交佼侯候倖光公功効勾厚口向"],
["b9a1","后喉坑垢好孔孝宏工巧巷幸広庚康弘恒慌抗拘控攻昂晃更杭校梗構江洪浩港溝甲皇硬稿糠紅紘絞綱耕考肯肱腔膏航荒行衡講貢購郊酵鉱砿鋼閤降項香高鴻剛劫号合壕拷濠豪轟麹克刻告国穀酷鵠黒獄漉腰甑忽惚骨狛込"],
["baa1","此頃今困坤墾婚恨懇昏昆根梱混痕紺艮魂些佐叉唆嵯左差査沙瑳砂詐鎖裟坐座挫債催再最哉塞妻宰彩才採栽歳済災采犀砕砦祭斎細菜裁載際剤在材罪財冴坂阪堺榊肴咲崎埼碕鷺作削咋搾昨朔柵窄策索錯桜鮭笹匙冊刷"],
["bba1","察拶撮擦札殺薩雑皐鯖捌錆鮫皿晒三傘参山惨撒散桟燦珊産算纂蚕讃賛酸餐斬暫残仕仔伺使刺司史嗣四士始姉姿子屍市師志思指支孜斯施旨枝止死氏獅祉私糸紙紫肢脂至視詞詩試誌諮資賜雌飼歯事似侍児字寺慈持時"],
["bca1","次滋治爾璽痔磁示而耳自蒔辞汐鹿式識鴫竺軸宍雫七叱執失嫉室悉湿漆疾質実蔀篠偲柴芝屡蕊縞舎写射捨赦斜煮社紗者謝車遮蛇邪借勺尺杓灼爵酌釈錫若寂弱惹主取守手朱殊狩珠種腫趣酒首儒受呪寿授樹綬需囚収周"],
["bda1","宗就州修愁拾洲秀秋終繍習臭舟蒐衆襲讐蹴輯週酋酬集醜什住充十従戎柔汁渋獣縦重銃叔夙宿淑祝縮粛塾熟出術述俊峻春瞬竣舜駿准循旬楯殉淳準潤盾純巡遵醇順処初所暑曙渚庶緒署書薯藷諸助叙女序徐恕鋤除傷償"],
["bea1","勝匠升召哨商唱嘗奨妾娼宵将小少尚庄床廠彰承抄招掌捷昇昌昭晶松梢樟樵沼消渉湘焼焦照症省硝礁祥称章笑粧紹肖菖蒋蕉衝裳訟証詔詳象賞醤鉦鍾鐘障鞘上丈丞乗冗剰城場壌嬢常情擾条杖浄状畳穣蒸譲醸錠嘱埴飾"],
["bfa1","拭植殖燭織職色触食蝕辱尻伸信侵唇娠寝審心慎振新晋森榛浸深申疹真神秦紳臣芯薪親診身辛進針震人仁刃塵壬尋甚尽腎訊迅陣靭笥諏須酢図厨逗吹垂帥推水炊睡粋翠衰遂酔錐錘随瑞髄崇嵩数枢趨雛据杉椙菅頗雀裾"],
["c0a1","澄摺寸世瀬畝是凄制勢姓征性成政整星晴棲栖正清牲生盛精聖声製西誠誓請逝醒青静斉税脆隻席惜戚斥昔析石積籍績脊責赤跡蹟碩切拙接摂折設窃節説雪絶舌蝉仙先千占宣専尖川戦扇撰栓栴泉浅洗染潜煎煽旋穿箭線"],
["c1a1","繊羨腺舛船薦詮賎践選遷銭銑閃鮮前善漸然全禅繕膳糎噌塑岨措曾曽楚狙疏疎礎祖租粗素組蘇訴阻遡鼠僧創双叢倉喪壮奏爽宋層匝惣想捜掃挿掻操早曹巣槍槽漕燥争痩相窓糟総綜聡草荘葬蒼藻装走送遭鎗霜騒像増憎"],
["c2a1","臓蔵贈造促側則即息捉束測足速俗属賊族続卒袖其揃存孫尊損村遜他多太汰詑唾堕妥惰打柁舵楕陀駄騨体堆対耐岱帯待怠態戴替泰滞胎腿苔袋貸退逮隊黛鯛代台大第醍題鷹滝瀧卓啄宅托択拓沢濯琢託鐸濁諾茸凧蛸只"],
["c3a1","叩但達辰奪脱巽竪辿棚谷狸鱈樽誰丹単嘆坦担探旦歎淡湛炭短端箪綻耽胆蛋誕鍛団壇弾断暖檀段男談値知地弛恥智池痴稚置致蜘遅馳築畜竹筑蓄逐秩窒茶嫡着中仲宙忠抽昼柱注虫衷註酎鋳駐樗瀦猪苧著貯丁兆凋喋寵"],
["c4a1","帖帳庁弔張彫徴懲挑暢朝潮牒町眺聴脹腸蝶調諜超跳銚長頂鳥勅捗直朕沈珍賃鎮陳津墜椎槌追鎚痛通塚栂掴槻佃漬柘辻蔦綴鍔椿潰坪壷嬬紬爪吊釣鶴亭低停偵剃貞呈堤定帝底庭廷弟悌抵挺提梯汀碇禎程締艇訂諦蹄逓"],
["c5a1","邸鄭釘鼎泥摘擢敵滴的笛適鏑溺哲徹撤轍迭鉄典填天展店添纏甜貼転顛点伝殿澱田電兎吐堵塗妬屠徒斗杜渡登菟賭途都鍍砥砺努度土奴怒倒党冬凍刀唐塔塘套宕島嶋悼投搭東桃梼棟盗淘湯涛灯燈当痘祷等答筒糖統到"],
["c6a1","董蕩藤討謄豆踏逃透鐙陶頭騰闘働動同堂導憧撞洞瞳童胴萄道銅峠鴇匿得徳涜特督禿篤毒独読栃橡凸突椴届鳶苫寅酉瀞噸屯惇敦沌豚遁頓呑曇鈍奈那内乍凪薙謎灘捺鍋楢馴縄畷南楠軟難汝二尼弐迩匂賑肉虹廿日乳入"],
["c7a1","如尿韮任妊忍認濡禰祢寧葱猫熱年念捻撚燃粘乃廼之埜嚢悩濃納能脳膿農覗蚤巴把播覇杷波派琶破婆罵芭馬俳廃拝排敗杯盃牌背肺輩配倍培媒梅楳煤狽買売賠陪這蝿秤矧萩伯剥博拍柏泊白箔粕舶薄迫曝漠爆縛莫駁麦"],
["c8a1","函箱硲箸肇筈櫨幡肌畑畠八鉢溌発醗髪伐罰抜筏閥鳩噺塙蛤隼伴判半反叛帆搬斑板氾汎版犯班畔繁般藩販範釆煩頒飯挽晩番盤磐蕃蛮匪卑否妃庇彼悲扉批披斐比泌疲皮碑秘緋罷肥被誹費避非飛樋簸備尾微枇毘琵眉美"],
["c9a1","鼻柊稗匹疋髭彦膝菱肘弼必畢筆逼桧姫媛紐百謬俵彪標氷漂瓢票表評豹廟描病秒苗錨鋲蒜蛭鰭品彬斌浜瀕貧賓頻敏瓶不付埠夫婦富冨布府怖扶敷斧普浮父符腐膚芙譜負賦赴阜附侮撫武舞葡蕪部封楓風葺蕗伏副復幅服"],
["caa1","福腹複覆淵弗払沸仏物鮒分吻噴墳憤扮焚奮粉糞紛雰文聞丙併兵塀幣平弊柄並蔽閉陛米頁僻壁癖碧別瞥蔑箆偏変片篇編辺返遍便勉娩弁鞭保舗鋪圃捕歩甫補輔穂募墓慕戊暮母簿菩倣俸包呆報奉宝峰峯崩庖抱捧放方朋"],
["cba1","法泡烹砲縫胞芳萌蓬蜂褒訪豊邦鋒飽鳳鵬乏亡傍剖坊妨帽忘忙房暴望某棒冒紡肪膨謀貌貿鉾防吠頬北僕卜墨撲朴牧睦穆釦勃没殆堀幌奔本翻凡盆摩磨魔麻埋妹昧枚毎哩槙幕膜枕鮪柾鱒桝亦俣又抹末沫迄侭繭麿万慢満"],
["cca1","漫蔓味未魅巳箕岬密蜜湊蓑稔脈妙粍民眠務夢無牟矛霧鵡椋婿娘冥名命明盟迷銘鳴姪牝滅免棉綿緬面麺摸模茂妄孟毛猛盲網耗蒙儲木黙目杢勿餅尤戻籾貰問悶紋門匁也冶夜爺耶野弥矢厄役約薬訳躍靖柳薮鑓愉愈油癒"],
["cda1","諭輸唯佑優勇友宥幽悠憂揖有柚湧涌猶猷由祐裕誘遊邑郵雄融夕予余与誉輿預傭幼妖容庸揚揺擁曜楊様洋溶熔用窯羊耀葉蓉要謡踊遥陽養慾抑欲沃浴翌翼淀羅螺裸来莱頼雷洛絡落酪乱卵嵐欄濫藍蘭覧利吏履李梨理璃"],
["cea1","痢裏裡里離陸律率立葎掠略劉流溜琉留硫粒隆竜龍侶慮旅虜了亮僚両凌寮料梁涼猟療瞭稜糧良諒遼量陵領力緑倫厘林淋燐琳臨輪隣鱗麟瑠塁涙累類令伶例冷励嶺怜玲礼苓鈴隷零霊麗齢暦歴列劣烈裂廉恋憐漣煉簾練聯"],
["cfa1","蓮連錬呂魯櫓炉賂路露労婁廊弄朗楼榔浪漏牢狼篭老聾蝋郎六麓禄肋録論倭和話歪賄脇惑枠鷲亙亘鰐詫藁蕨椀湾碗腕"],
["d0a1","弌丐丕个丱丶丼丿乂乖乘亂亅豫亊舒弍于亞亟亠亢亰亳亶从仍仄仆仂仗仞仭仟价伉佚估佛佝佗佇佶侈侏侘佻佩佰侑佯來侖儘俔俟俎俘俛俑俚俐俤俥倚倨倔倪倥倅伜俶倡倩倬俾俯們倆偃假會偕偐偈做偖偬偸傀傚傅傴傲"],
["d1a1","僉僊傳僂僖僞僥僭僣僮價僵儉儁儂儖儕儔儚儡儺儷儼儻儿兀兒兌兔兢竸兩兪兮冀冂囘册冉冏冑冓冕冖冤冦冢冩冪冫决冱冲冰况冽凅凉凛几處凩凭凰凵凾刄刋刔刎刧刪刮刳刹剏剄剋剌剞剔剪剴剩剳剿剽劍劔劒剱劈劑辨"],
["d2a1","辧劬劭劼劵勁勍勗勞勣勦飭勠勳勵勸勹匆匈甸匍匐匏匕匚匣匯匱匳匸區卆卅丗卉卍凖卞卩卮夘卻卷厂厖厠厦厥厮厰厶參簒雙叟曼燮叮叨叭叺吁吽呀听吭吼吮吶吩吝呎咏呵咎呟呱呷呰咒呻咀呶咄咐咆哇咢咸咥咬哄哈咨"],
["d3a1","咫哂咤咾咼哘哥哦唏唔哽哮哭哺哢唹啀啣啌售啜啅啖啗唸唳啝喙喀咯喊喟啻啾喘喞單啼喃喩喇喨嗚嗅嗟嗄嗜嗤嗔嘔嗷嘖嗾嗽嘛嗹噎噐營嘴嘶嘲嘸噫噤嘯噬噪嚆嚀嚊嚠嚔嚏嚥嚮嚶嚴囂嚼囁囃囀囈囎囑囓囗囮囹圀囿圄圉"],
["d4a1","圈國圍圓團圖嗇圜圦圷圸坎圻址坏坩埀垈坡坿垉垓垠垳垤垪垰埃埆埔埒埓堊埖埣堋堙堝塲堡塢塋塰毀塒堽塹墅墹墟墫墺壞墻墸墮壅壓壑壗壙壘壥壜壤壟壯壺壹壻壼壽夂夊夐夛梦夥夬夭夲夸夾竒奕奐奎奚奘奢奠奧奬奩"],
["d5a1","奸妁妝佞侫妣妲姆姨姜妍姙姚娥娟娑娜娉娚婀婬婉娵娶婢婪媚媼媾嫋嫂媽嫣嫗嫦嫩嫖嫺嫻嬌嬋嬖嬲嫐嬪嬶嬾孃孅孀孑孕孚孛孥孩孰孳孵學斈孺宀它宦宸寃寇寉寔寐寤實寢寞寥寫寰寶寳尅將專對尓尠尢尨尸尹屁屆屎屓"],
["d6a1","屐屏孱屬屮乢屶屹岌岑岔妛岫岻岶岼岷峅岾峇峙峩峽峺峭嶌峪崋崕崗嵜崟崛崑崔崢崚崙崘嵌嵒嵎嵋嵬嵳嵶嶇嶄嶂嶢嶝嶬嶮嶽嶐嶷嶼巉巍巓巒巖巛巫已巵帋帚帙帑帛帶帷幄幃幀幎幗幔幟幢幤幇幵并幺麼广庠廁廂廈廐廏"],
["d7a1","廖廣廝廚廛廢廡廨廩廬廱廳廰廴廸廾弃弉彝彜弋弑弖弩弭弸彁彈彌彎弯彑彖彗彙彡彭彳彷徃徂彿徊很徑徇從徙徘徠徨徭徼忖忻忤忸忱忝悳忿怡恠怙怐怩怎怱怛怕怫怦怏怺恚恁恪恷恟恊恆恍恣恃恤恂恬恫恙悁悍惧悃悚"],
["d8a1","悄悛悖悗悒悧悋惡悸惠惓悴忰悽惆悵惘慍愕愆惶惷愀惴惺愃愡惻惱愍愎慇愾愨愧慊愿愼愬愴愽慂慄慳慷慘慙慚慫慴慯慥慱慟慝慓慵憙憖憇憬憔憚憊憑憫憮懌懊應懷懈懃懆憺懋罹懍懦懣懶懺懴懿懽懼懾戀戈戉戍戌戔戛"],
["d9a1","戞戡截戮戰戲戳扁扎扞扣扛扠扨扼抂抉找抒抓抖拔抃抔拗拑抻拏拿拆擔拈拜拌拊拂拇抛拉挌拮拱挧挂挈拯拵捐挾捍搜捏掖掎掀掫捶掣掏掉掟掵捫捩掾揩揀揆揣揉插揶揄搖搴搆搓搦搶攝搗搨搏摧摯摶摎攪撕撓撥撩撈撼"],
["daa1","據擒擅擇撻擘擂擱擧舉擠擡抬擣擯攬擶擴擲擺攀擽攘攜攅攤攣攫攴攵攷收攸畋效敖敕敍敘敞敝敲數斂斃變斛斟斫斷旃旆旁旄旌旒旛旙无旡旱杲昊昃旻杳昵昶昴昜晏晄晉晁晞晝晤晧晨晟晢晰暃暈暎暉暄暘暝曁暹曉暾暼"],
["dba1","曄暸曖曚曠昿曦曩曰曵曷朏朖朞朦朧霸朮朿朶杁朸朷杆杞杠杙杣杤枉杰枩杼杪枌枋枦枡枅枷柯枴柬枳柩枸柤柞柝柢柮枹柎柆柧檜栞框栩桀桍栲桎梳栫桙档桷桿梟梏梭梔條梛梃檮梹桴梵梠梺椏梍桾椁棊椈棘椢椦棡椌棍"],
["dca1","棔棧棕椶椒椄棗棣椥棹棠棯椨椪椚椣椡棆楹楷楜楸楫楔楾楮椹楴椽楙椰楡楞楝榁楪榲榮槐榿槁槓榾槎寨槊槝榻槃榧樮榑榠榜榕榴槞槨樂樛槿權槹槲槧樅榱樞槭樔槫樊樒櫁樣樓橄樌橲樶橸橇橢橙橦橈樸樢檐檍檠檄檢檣"],
["dda1","檗蘗檻櫃櫂檸檳檬櫞櫑櫟檪櫚櫪櫻欅蘖櫺欒欖鬱欟欸欷盜欹飮歇歃歉歐歙歔歛歟歡歸歹歿殀殄殃殍殘殕殞殤殪殫殯殲殱殳殷殼毆毋毓毟毬毫毳毯麾氈氓气氛氤氣汞汕汢汪沂沍沚沁沛汾汨汳沒沐泄泱泓沽泗泅泝沮沱沾"],
["dea1","沺泛泯泙泪洟衍洶洫洽洸洙洵洳洒洌浣涓浤浚浹浙涎涕濤涅淹渕渊涵淇淦涸淆淬淞淌淨淒淅淺淙淤淕淪淮渭湮渮渙湲湟渾渣湫渫湶湍渟湃渺湎渤滿渝游溂溪溘滉溷滓溽溯滄溲滔滕溏溥滂溟潁漑灌滬滸滾漿滲漱滯漲滌"],
["dfa1","漾漓滷澆潺潸澁澀潯潛濳潭澂潼潘澎澑濂潦澳澣澡澤澹濆澪濟濕濬濔濘濱濮濛瀉瀋濺瀑瀁瀏濾瀛瀚潴瀝瀘瀟瀰瀾瀲灑灣炙炒炯烱炬炸炳炮烟烋烝烙焉烽焜焙煥煕熈煦煢煌煖煬熏燻熄熕熨熬燗熹熾燒燉燔燎燠燬燧燵燼"],
["e0a1","燹燿爍爐爛爨爭爬爰爲爻爼爿牀牆牋牘牴牾犂犁犇犒犖犢犧犹犲狃狆狄狎狒狢狠狡狹狷倏猗猊猜猖猝猴猯猩猥猾獎獏默獗獪獨獰獸獵獻獺珈玳珎玻珀珥珮珞璢琅瑯琥珸琲琺瑕琿瑟瑙瑁瑜瑩瑰瑣瑪瑶瑾璋璞璧瓊瓏瓔珱"],
["e1a1","瓠瓣瓧瓩瓮瓲瓰瓱瓸瓷甄甃甅甌甎甍甕甓甞甦甬甼畄畍畊畉畛畆畚畩畤畧畫畭畸當疆疇畴疊疉疂疔疚疝疥疣痂疳痃疵疽疸疼疱痍痊痒痙痣痞痾痿痼瘁痰痺痲痳瘋瘍瘉瘟瘧瘠瘡瘢瘤瘴瘰瘻癇癈癆癜癘癡癢癨癩癪癧癬癰"],
["e2a1","癲癶癸發皀皃皈皋皎皖皓皙皚皰皴皸皹皺盂盍盖盒盞盡盥盧盪蘯盻眈眇眄眩眤眞眥眦眛眷眸睇睚睨睫睛睥睿睾睹瞎瞋瞑瞠瞞瞰瞶瞹瞿瞼瞽瞻矇矍矗矚矜矣矮矼砌砒礦砠礪硅碎硴碆硼碚碌碣碵碪碯磑磆磋磔碾碼磅磊磬"],
["e3a1","磧磚磽磴礇礒礑礙礬礫祀祠祗祟祚祕祓祺祿禊禝禧齋禪禮禳禹禺秉秕秧秬秡秣稈稍稘稙稠稟禀稱稻稾稷穃穗穉穡穢穩龝穰穹穽窈窗窕窘窖窩竈窰窶竅竄窿邃竇竊竍竏竕竓站竚竝竡竢竦竭竰笂笏笊笆笳笘笙笞笵笨笶筐"],
["e4a1","筺笄筍笋筌筅筵筥筴筧筰筱筬筮箝箘箟箍箜箚箋箒箏筝箙篋篁篌篏箴篆篝篩簑簔篦篥籠簀簇簓篳篷簗簍篶簣簧簪簟簷簫簽籌籃籔籏籀籐籘籟籤籖籥籬籵粃粐粤粭粢粫粡粨粳粲粱粮粹粽糀糅糂糘糒糜糢鬻糯糲糴糶糺紆"],
["e5a1","紂紜紕紊絅絋紮紲紿紵絆絳絖絎絲絨絮絏絣經綉絛綏絽綛綺綮綣綵緇綽綫總綢綯緜綸綟綰緘緝緤緞緻緲緡縅縊縣縡縒縱縟縉縋縢繆繦縻縵縹繃縷縲縺繧繝繖繞繙繚繹繪繩繼繻纃緕繽辮繿纈纉續纒纐纓纔纖纎纛纜缸缺"],
["e6a1","罅罌罍罎罐网罕罔罘罟罠罨罩罧罸羂羆羃羈羇羌羔羞羝羚羣羯羲羹羮羶羸譱翅翆翊翕翔翡翦翩翳翹飜耆耄耋耒耘耙耜耡耨耿耻聊聆聒聘聚聟聢聨聳聲聰聶聹聽聿肄肆肅肛肓肚肭冐肬胛胥胙胝胄胚胖脉胯胱脛脩脣脯腋"],
["e7a1","隋腆脾腓腑胼腱腮腥腦腴膃膈膊膀膂膠膕膤膣腟膓膩膰膵膾膸膽臀臂膺臉臍臑臙臘臈臚臟臠臧臺臻臾舁舂舅與舊舍舐舖舩舫舸舳艀艙艘艝艚艟艤艢艨艪艫舮艱艷艸艾芍芒芫芟芻芬苡苣苟苒苴苳苺莓范苻苹苞茆苜茉苙"],
["e8a1","茵茴茖茲茱荀茹荐荅茯茫茗茘莅莚莪莟莢莖茣莎莇莊荼莵荳荵莠莉莨菴萓菫菎菽萃菘萋菁菷萇菠菲萍萢萠莽萸蔆菻葭萪萼蕚蒄葷葫蒭葮蒂葩葆萬葯葹萵蓊葢蒹蒿蒟蓙蓍蒻蓚蓐蓁蓆蓖蒡蔡蓿蓴蔗蔘蔬蔟蔕蔔蓼蕀蕣蕘蕈"],
["e9a1","蕁蘂蕋蕕薀薤薈薑薊薨蕭薔薛藪薇薜蕷蕾薐藉薺藏薹藐藕藝藥藜藹蘊蘓蘋藾藺蘆蘢蘚蘰蘿虍乕虔號虧虱蚓蚣蚩蚪蚋蚌蚶蚯蛄蛆蚰蛉蠣蚫蛔蛞蛩蛬蛟蛛蛯蜒蜆蜈蜀蜃蛻蜑蜉蜍蛹蜊蜴蜿蜷蜻蜥蜩蜚蝠蝟蝸蝌蝎蝴蝗蝨蝮蝙"],
["eaa1","蝓蝣蝪蠅螢螟螂螯蟋螽蟀蟐雖螫蟄螳蟇蟆螻蟯蟲蟠蠏蠍蟾蟶蟷蠎蟒蠑蠖蠕蠢蠡蠱蠶蠹蠧蠻衄衂衒衙衞衢衫袁衾袞衵衽袵衲袂袗袒袮袙袢袍袤袰袿袱裃裄裔裘裙裝裹褂裼裴裨裲褄褌褊褓襃褞褥褪褫襁襄褻褶褸襌褝襠襞"],
["eba1","襦襤襭襪襯襴襷襾覃覈覊覓覘覡覩覦覬覯覲覺覽覿觀觚觜觝觧觴觸訃訖訐訌訛訝訥訶詁詛詒詆詈詼詭詬詢誅誂誄誨誡誑誥誦誚誣諄諍諂諚諫諳諧諤諱謔諠諢諷諞諛謌謇謚諡謖謐謗謠謳鞫謦謫謾謨譁譌譏譎證譖譛譚譫"],
["eca1","譟譬譯譴譽讀讌讎讒讓讖讙讚谺豁谿豈豌豎豐豕豢豬豸豺貂貉貅貊貍貎貔豼貘戝貭貪貽貲貳貮貶賈賁賤賣賚賽賺賻贄贅贊贇贏贍贐齎贓賍贔贖赧赭赱赳趁趙跂趾趺跏跚跖跌跛跋跪跫跟跣跼踈踉跿踝踞踐踟蹂踵踰踴蹊"],
["eda1","蹇蹉蹌蹐蹈蹙蹤蹠踪蹣蹕蹶蹲蹼躁躇躅躄躋躊躓躑躔躙躪躡躬躰軆躱躾軅軈軋軛軣軼軻軫軾輊輅輕輒輙輓輜輟輛輌輦輳輻輹轅轂輾轌轉轆轎轗轜轢轣轤辜辟辣辭辯辷迚迥迢迪迯邇迴逅迹迺逑逕逡逍逞逖逋逧逶逵逹迸"],
["eea1","遏遐遑遒逎遉逾遖遘遞遨遯遶隨遲邂遽邁邀邊邉邏邨邯邱邵郢郤扈郛鄂鄒鄙鄲鄰酊酖酘酣酥酩酳酲醋醉醂醢醫醯醪醵醴醺釀釁釉釋釐釖釟釡釛釼釵釶鈞釿鈔鈬鈕鈑鉞鉗鉅鉉鉤鉈銕鈿鉋鉐銜銖銓銛鉚鋏銹銷鋩錏鋺鍄錮"],
["efa1","錙錢錚錣錺錵錻鍜鍠鍼鍮鍖鎰鎬鎭鎔鎹鏖鏗鏨鏥鏘鏃鏝鏐鏈鏤鐚鐔鐓鐃鐇鐐鐶鐫鐵鐡鐺鑁鑒鑄鑛鑠鑢鑞鑪鈩鑰鑵鑷鑽鑚鑼鑾钁鑿閂閇閊閔閖閘閙閠閨閧閭閼閻閹閾闊濶闃闍闌闕闔闖關闡闥闢阡阨阮阯陂陌陏陋陷陜陞"],
["f0a1","陝陟陦陲陬隍隘隕隗險隧隱隲隰隴隶隸隹雎雋雉雍襍雜霍雕雹霄霆霈霓霎霑霏霖霙霤霪霰霹霽霾靄靆靈靂靉靜靠靤靦靨勒靫靱靹鞅靼鞁靺鞆鞋鞏鞐鞜鞨鞦鞣鞳鞴韃韆韈韋韜韭齏韲竟韶韵頏頌頸頤頡頷頽顆顏顋顫顯顰"],
["f1a1","顱顴顳颪颯颱颶飄飃飆飩飫餃餉餒餔餘餡餝餞餤餠餬餮餽餾饂饉饅饐饋饑饒饌饕馗馘馥馭馮馼駟駛駝駘駑駭駮駱駲駻駸騁騏騅駢騙騫騷驅驂驀驃騾驕驍驛驗驟驢驥驤驩驫驪骭骰骼髀髏髑髓體髞髟髢髣髦髯髫髮髴髱髷"],
["f2a1","髻鬆鬘鬚鬟鬢鬣鬥鬧鬨鬩鬪鬮鬯鬲魄魃魏魍魎魑魘魴鮓鮃鮑鮖鮗鮟鮠鮨鮴鯀鯊鮹鯆鯏鯑鯒鯣鯢鯤鯔鯡鰺鯲鯱鯰鰕鰔鰉鰓鰌鰆鰈鰒鰊鰄鰮鰛鰥鰤鰡鰰鱇鰲鱆鰾鱚鱠鱧鱶鱸鳧鳬鳰鴉鴈鳫鴃鴆鴪鴦鶯鴣鴟鵄鴕鴒鵁鴿鴾鵆鵈"],
["f3a1","鵝鵞鵤鵑鵐鵙鵲鶉鶇鶫鵯鵺鶚鶤鶩鶲鷄鷁鶻鶸鶺鷆鷏鷂鷙鷓鷸鷦鷭鷯鷽鸚鸛鸞鹵鹹鹽麁麈麋麌麒麕麑麝麥麩麸麪麭靡黌黎黏黐黔黜點黝黠黥黨黯黴黶黷黹黻黼黽鼇鼈皷鼕鼡鼬鼾齊齒齔齣齟齠齡齦齧齬齪齷齲齶龕龜龠"],
["f4a1","堯槇遙瑤凜熙"],
["f9a1","纊褜鍈銈蓜俉炻昱棈鋹曻彅丨仡仼伀伃伹佖侒侊侚侔俍偀倢俿倞偆偰偂傔僴僘兊兤冝冾凬刕劜劦勀勛匀匇匤卲厓厲叝﨎咜咊咩哿喆坙坥垬埈埇﨏塚增墲夋奓奛奝奣妤妺孖寀甯寘寬尞岦岺峵崧嵓﨑嵂嵭嶸嶹巐弡弴彧德"],
["faa1","忞恝悅悊惞惕愠惲愑愷愰憘戓抦揵摠撝擎敎昀昕昻昉昮昞昤晥晗晙晴晳暙暠暲暿曺朎朗杦枻桒柀栁桄棏﨓楨﨔榘槢樰橫橆橳橾櫢櫤毖氿汜沆汯泚洄涇浯涖涬淏淸淲淼渹湜渧渼溿澈澵濵瀅瀇瀨炅炫焏焄煜煆煇凞燁燾犱"],
["fba1","犾猤猪獷玽珉珖珣珒琇珵琦琪琩琮瑢璉璟甁畯皂皜皞皛皦益睆劯砡硎硤硺礰礼神祥禔福禛竑竧靖竫箞精絈絜綷綠緖繒罇羡羽茁荢荿菇菶葈蒴蕓蕙蕫﨟薰蘒﨡蠇裵訒訷詹誧誾諟諸諶譓譿賰賴贒赶﨣軏﨤逸遧郞都鄕鄧釚"],
["fca1","釗釞釭釮釤釥鈆鈐鈊鈺鉀鈼鉎鉙鉑鈹鉧銧鉷鉸鋧鋗鋙鋐﨧鋕鋠鋓錥錡鋻﨨錞鋿錝錂鍰鍗鎤鏆鏞鏸鐱鑅鑈閒隆﨩隝隯霳霻靃靍靏靑靕顗顥飯飼餧館馞驎髙髜魵魲鮏鮱鮻鰀鵰鵫鶴鸙黑"],
["fcf1","ⅰ",9,"￢￤＇＂"],
["8fa2af","˘ˇ¸˙˝¯˛˚～΄΅"],
["8fa2c2","¡¦¿"],
["8fa2eb","ºª©®™¤№"],
["8fa6e1","ΆΈΉΊΪ"],
["8fa6e7","Ό"],
["8fa6e9","ΎΫ"],
["8fa6ec","Ώ"],
["8fa6f1","άέήίϊΐόςύϋΰώ"],
["8fa7c2","Ђ",10,"ЎЏ"],
["8fa7f2","ђ",10,"ўџ"],
["8fa9a1","ÆĐ"],
["8fa9a4","Ħ"],
["8fa9a6","Ĳ"],
["8fa9a8","ŁĿ"],
["8fa9ab","ŊØŒ"],
["8fa9af","ŦÞ"],
["8fa9c1","æđðħıĳĸłŀŉŋøœßŧþ"],
["8faaa1","ÁÀÄÂĂǍĀĄÅÃĆĈČÇĊĎÉÈËÊĚĖĒĘ"],
["8faaba","ĜĞĢĠĤÍÌÏÎǏİĪĮĨĴĶĹĽĻŃŇŅÑÓÒÖÔǑŐŌÕŔŘŖŚŜŠŞŤŢÚÙÜÛŬǓŰŪŲŮŨǗǛǙǕŴÝŸŶŹŽŻ"],
["8faba1","áàäâăǎāąåãćĉčçċďéèëêěėēęǵĝğ"],
["8fabbd","ġĥíìïîǐ"],
["8fabc5","īįĩĵķĺľļńňņñóòöôǒőōõŕřŗśŝšşťţúùüûŭǔűūųůũǘǜǚǖŵýÿŷźžż"],
["8fb0a1","丂丄丅丌丒丟丣两丨丫丮丯丰丵乀乁乄乇乑乚乜乣乨乩乴乵乹乿亍亖亗亝亯亹仃仐仚仛仠仡仢仨仯仱仳仵份仾仿伀伂伃伈伋伌伒伕伖众伙伮伱你伳伵伷伹伻伾佀佂佈佉佋佌佒佔佖佘佟佣佪佬佮佱佷佸佹佺佽佾侁侂侄"],
["8fb1a1","侅侉侊侌侎侐侒侓侔侗侙侚侞侟侲侷侹侻侼侽侾俀俁俅俆俈俉俋俌俍俏俒俜俠俢俰俲俼俽俿倀倁倄倇倊倌倎倐倓倗倘倛倜倝倞倢倧倮倰倲倳倵偀偁偂偅偆偊偌偎偑偒偓偗偙偟偠偢偣偦偧偪偭偰偱倻傁傃傄傆傊傎傏傐"],
["8fb2a1","傒傓傔傖傛傜傞",4,"傪傯傰傹傺傽僀僃僄僇僌僎僐僓僔僘僜僝僟僢僤僦僨僩僯僱僶僺僾儃儆儇儈儋儌儍儎僲儐儗儙儛儜儝儞儣儧儨儬儭儯儱儳儴儵儸儹兂兊兏兓兕兗兘兟兤兦兾冃冄冋冎冘冝冡冣冭冸冺冼冾冿凂"],
["8fb3a1","凈减凑凒凓凕凘凞凢凥凮凲凳凴凷刁刂刅划刓刕刖刘刢刨刱刲刵刼剅剉剕剗剘剚剜剟剠剡剦剮剷剸剹劀劂劅劊劌劓劕劖劗劘劚劜劤劥劦劧劯劰劶劷劸劺劻劽勀勄勆勈勌勏勑勔勖勛勜勡勥勨勩勪勬勰勱勴勶勷匀匃匊匋"],
["8fb4a1","匌匑匓匘匛匜匞匟匥匧匨匩匫匬匭匰匲匵匼匽匾卂卌卋卙卛卡卣卥卬卭卲卹卾厃厇厈厎厓厔厙厝厡厤厪厫厯厲厴厵厷厸厺厽叀叅叏叒叓叕叚叝叞叠另叧叵吂吓吚吡吧吨吪启吱吴吵呃呄呇呍呏呞呢呤呦呧呩呫呭呮呴呿"],
["8fb5a1","咁咃咅咈咉咍咑咕咖咜咟咡咦咧咩咪咭咮咱咷咹咺咻咿哆哊响哎哠哪哬哯哶哼哾哿唀唁唅唈唉唌唍唎唕唪唫唲唵唶唻唼唽啁啇啉啊啍啐啑啘啚啛啞啠啡啤啦啿喁喂喆喈喎喏喑喒喓喔喗喣喤喭喲喿嗁嗃嗆嗉嗋嗌嗎嗑嗒"],
["8fb6a1","嗓嗗嗘嗛嗞嗢嗩嗶嗿嘅嘈嘊嘍",5,"嘙嘬嘰嘳嘵嘷嘹嘻嘼嘽嘿噀噁噃噄噆噉噋噍噏噔噞噠噡噢噣噦噩噭噯噱噲噵嚄嚅嚈嚋嚌嚕嚙嚚嚝嚞嚟嚦嚧嚨嚩嚫嚬嚭嚱嚳嚷嚾囅囉囊囋囏囐囌囍囙囜囝囟囡囤",4,"囱囫园"],
["8fb7a1","囶囷圁圂圇圊圌圑圕圚圛圝圠圢圣圤圥圩圪圬圮圯圳圴圽圾圿坅坆坌坍坒坢坥坧坨坫坭",4,"坳坴坵坷坹坺坻坼坾垁垃垌垔垗垙垚垜垝垞垟垡垕垧垨垩垬垸垽埇埈埌埏埕埝埞埤埦埧埩埭埰埵埶埸埽埾埿堃堄堈堉埡"],
["8fb8a1","堌堍堛堞堟堠堦堧堭堲堹堿塉塌塍塏塐塕塟塡塤塧塨塸塼塿墀墁墇墈墉墊墌墍墏墐墔墖墝墠墡墢墦墩墱墲壄墼壂壈壍壎壐壒壔壖壚壝壡壢壩壳夅夆夋夌夒夓夔虁夝夡夣夤夨夯夰夳夵夶夿奃奆奒奓奙奛奝奞奟奡奣奫奭"],
["8fb9a1","奯奲奵奶她奻奼妋妌妎妒妕妗妟妤妧妭妮妯妰妳妷妺妼姁姃姄姈姊姍姒姝姞姟姣姤姧姮姯姱姲姴姷娀娄娌娍娎娒娓娞娣娤娧娨娪娭娰婄婅婇婈婌婐婕婞婣婥婧婭婷婺婻婾媋媐媓媖媙媜媞媟媠媢媧媬媱媲媳媵媸媺媻媿"],
["8fbaa1","嫄嫆嫈嫏嫚嫜嫠嫥嫪嫮嫵嫶嫽嬀嬁嬈嬗嬴嬙嬛嬝嬡嬥嬭嬸孁孋孌孒孖孞孨孮孯孼孽孾孿宁宄宆宊宎宐宑宓宔宖宨宩宬宭宯宱宲宷宺宼寀寁寍寏寖",4,"寠寯寱寴寽尌尗尞尟尣尦尩尫尬尮尰尲尵尶屙屚屜屢屣屧屨屩"],
["8fbba1","屭屰屴屵屺屻屼屽岇岈岊岏岒岝岟岠岢岣岦岪岲岴岵岺峉峋峒峝峗峮峱峲峴崁崆崍崒崫崣崤崦崧崱崴崹崽崿嵂嵃嵆嵈嵕嵑嵙嵊嵟嵠嵡嵢嵤嵪嵭嵰嵹嵺嵾嵿嶁嶃嶈嶊嶒嶓嶔嶕嶙嶛嶟嶠嶧嶫嶰嶴嶸嶹巃巇巋巐巎巘巙巠巤"],
["8fbca1","巩巸巹帀帇帍帒帔帕帘帟帠帮帨帲帵帾幋幐幉幑幖幘幛幜幞幨幪",4,"幰庀庋庎庢庤庥庨庪庬庱庳庽庾庿廆廌廋廎廑廒廔廕廜廞廥廫异弆弇弈弎弙弜弝弡弢弣弤弨弫弬弮弰弴弶弻弽弿彀彄彅彇彍彐彔彘彛彠彣彤彧"],
["8fbda1","彯彲彴彵彸彺彽彾徉徍徏徖徜徝徢徧徫徤徬徯徰徱徸忄忇忈忉忋忐",4,"忞忡忢忨忩忪忬忭忮忯忲忳忶忺忼怇怊怍怓怔怗怘怚怟怤怭怳怵恀恇恈恉恌恑恔恖恗恝恡恧恱恾恿悂悆悈悊悎悑悓悕悘悝悞悢悤悥您悰悱悷"],
["8fbea1","悻悾惂惄惈惉惊惋惎惏惔惕惙惛惝惞惢惥惲惵惸惼惽愂愇愊愌愐",4,"愖愗愙愜愞愢愪愫愰愱愵愶愷愹慁慅慆慉慞慠慬慲慸慻慼慿憀憁憃憄憋憍憒憓憗憘憜憝憟憠憥憨憪憭憸憹憼懀懁懂懎懏懕懜懝懞懟懡懢懧懩懥"],
["8fbfa1","懬懭懯戁戃戄戇戓戕戜戠戢戣戧戩戫戹戽扂扃扄扆扌扐扑扒扔扖扚扜扤扭扯扳扺扽抍抎抏抐抦抨抳抶抷抺抾抿拄拎拕拖拚拪拲拴拼拽挃挄挊挋挍挐挓挖挘挩挪挭挵挶挹挼捁捂捃捄捆捊捋捎捒捓捔捘捛捥捦捬捭捱捴捵"],
["8fc0a1","捸捼捽捿掂掄掇掊掐掔掕掙掚掞掤掦掭掮掯掽揁揅揈揎揑揓揔揕揜揠揥揪揬揲揳揵揸揹搉搊搐搒搔搘搞搠搢搤搥搩搪搯搰搵搽搿摋摏摑摒摓摔摚摛摜摝摟摠摡摣摭摳摴摻摽撅撇撏撐撑撘撙撛撝撟撡撣撦撨撬撳撽撾撿"],
["8fc1a1","擄擉擊擋擌擎擐擑擕擗擤擥擩擪擭擰擵擷擻擿攁攄攈攉攊攏攓攔攖攙攛攞攟攢攦攩攮攱攺攼攽敃敇敉敐敒敔敟敠敧敫敺敽斁斅斊斒斕斘斝斠斣斦斮斲斳斴斿旂旈旉旎旐旔旖旘旟旰旲旴旵旹旾旿昀昄昈昉昍昑昒昕昖昝"],
["8fc2a1","昞昡昢昣昤昦昩昪昫昬昮昰昱昳昹昷晀晅晆晊晌晑晎晗晘晙晛晜晠晡曻晪晫晬晾晳晵晿晷晸晹晻暀晼暋暌暍暐暒暙暚暛暜暟暠暤暭暱暲暵暻暿曀曂曃曈曌曎曏曔曛曟曨曫曬曮曺朅朇朎朓朙朜朠朢朳朾杅杇杈杌杔杕杝"],
["8fc3a1","杦杬杮杴杶杻极构枎枏枑枓枖枘枙枛枰枱枲枵枻枼枽柹柀柂柃柅柈柉柒柗柙柜柡柦柰柲柶柷桒栔栙栝栟栨栧栬栭栯栰栱栳栻栿桄桅桊桌桕桗桘桛桫桮",4,"桵桹桺桻桼梂梄梆梈梖梘梚梜梡梣梥梩梪梮梲梻棅棈棌棏"],
["8fc4a1","棐棑棓棖棙棜棝棥棨棪棫棬棭棰棱棵棶棻棼棽椆椉椊椐椑椓椖椗椱椳椵椸椻楂楅楉楎楗楛楣楤楥楦楨楩楬楰楱楲楺楻楿榀榍榒榖榘榡榥榦榨榫榭榯榷榸榺榼槅槈槑槖槗槢槥槮槯槱槳槵槾樀樁樃樏樑樕樚樝樠樤樨樰樲"],
["8fc5a1","樴樷樻樾樿橅橆橉橊橎橐橑橒橕橖橛橤橧橪橱橳橾檁檃檆檇檉檋檑檛檝檞檟檥檫檯檰檱檴檽檾檿櫆櫉櫈櫌櫐櫔櫕櫖櫜櫝櫤櫧櫬櫰櫱櫲櫼櫽欂欃欆欇欉欏欐欑欗欛欞欤欨欫欬欯欵欶欻欿歆歊歍歒歖歘歝歠歧歫歮歰歵歽"],
["8fc6a1","歾殂殅殗殛殟殠殢殣殨殩殬殭殮殰殸殹殽殾毃毄毉毌毖毚毡毣毦毧毮毱毷毹毿氂氄氅氉氍氎氐氒氙氟氦氧氨氬氮氳氵氶氺氻氿汊汋汍汏汒汔汙汛汜汫汭汯汴汶汸汹汻沅沆沇沉沔沕沗沘沜沟沰沲沴泂泆泍泏泐泑泒泔泖"],
["8fc7a1","泚泜泠泧泩泫泬泮泲泴洄洇洊洎洏洑洓洚洦洧洨汧洮洯洱洹洼洿浗浞浟浡浥浧浯浰浼涂涇涑涒涔涖涗涘涪涬涴涷涹涽涿淄淈淊淎淏淖淛淝淟淠淢淥淩淯淰淴淶淼渀渄渞渢渧渲渶渹渻渼湄湅湈湉湋湏湑湒湓湔湗湜湝湞"],
["8fc8a1","湢湣湨湳湻湽溍溓溙溠溧溭溮溱溳溻溿滀滁滃滇滈滊滍滎滏滫滭滮滹滻滽漄漈漊漌漍漖漘漚漛漦漩漪漯漰漳漶漻漼漭潏潑潒潓潗潙潚潝潞潡潢潨潬潽潾澃澇澈澋澌澍澐澒澓澔澖澚澟澠澥澦澧澨澮澯澰澵澶澼濅濇濈濊"],
["8fc9a1","濚濞濨濩濰濵濹濼濽瀀瀅瀆瀇瀍瀗瀠瀣瀯瀴瀷瀹瀼灃灄灈灉灊灋灔灕灝灞灎灤灥灬灮灵灶灾炁炅炆炔",4,"炛炤炫炰炱炴炷烊烑烓烔烕烖烘烜烤烺焃",4,"焋焌焏焞焠焫焭焯焰焱焸煁煅煆煇煊煋煐煒煗煚煜煞煠"],
["8fcaa1","煨煹熀熅熇熌熒熚熛熠熢熯熰熲熳熺熿燀燁燄燋燌燓燖燙燚燜燸燾爀爇爈爉爓爗爚爝爟爤爫爯爴爸爹牁牂牃牅牎牏牐牓牕牖牚牜牞牠牣牨牫牮牯牱牷牸牻牼牿犄犉犍犎犓犛犨犭犮犱犴犾狁狇狉狌狕狖狘狟狥狳狴狺狻"],
["8fcba1","狾猂猄猅猇猋猍猒猓猘猙猞猢猤猧猨猬猱猲猵猺猻猽獃獍獐獒獖獘獝獞獟獠獦獧獩獫獬獮獯獱獷獹獼玀玁玃玅玆玎玐玓玕玗玘玜玞玟玠玢玥玦玪玫玭玵玷玹玼玽玿珅珆珉珋珌珏珒珓珖珙珝珡珣珦珧珩珴珵珷珹珺珻珽"],
["8fcca1","珿琀琁琄琇琊琑琚琛琤琦琨",9,"琹瑀瑃瑄瑆瑇瑋瑍瑑瑒瑗瑝瑢瑦瑧瑨瑫瑭瑮瑱瑲璀璁璅璆璇璉璏璐璑璒璘璙璚璜璟璠璡璣璦璨璩璪璫璮璯璱璲璵璹璻璿瓈瓉瓌瓐瓓瓘瓚瓛瓞瓟瓤瓨瓪瓫瓯瓴瓺瓻瓼瓿甆"],
["8fcda1","甒甖甗甠甡甤甧甩甪甯甶甹甽甾甿畀畃畇畈畎畐畒畗畞畟畡畯畱畹",5,"疁疅疐疒疓疕疙疜疢疤疴疺疿痀痁痄痆痌痎痏痗痜痟痠痡痤痧痬痮痯痱痹瘀瘂瘃瘄瘇瘈瘊瘌瘏瘒瘓瘕瘖瘙瘛瘜瘝瘞瘣瘥瘦瘩瘭瘲瘳瘵瘸瘹"],
["8fcea1","瘺瘼癊癀癁癃癄癅癉癋癕癙癟癤癥癭癮癯癱癴皁皅皌皍皕皛皜皝皟皠皢",6,"皪皭皽盁盅盉盋盌盎盔盙盠盦盨盬盰盱盶盹盼眀眆眊眎眒眔眕眗眙眚眜眢眨眭眮眯眴眵眶眹眽眾睂睅睆睊睍睎睏睒睖睗睜睞睟睠睢"],
["8fcfa1","睤睧睪睬睰睲睳睴睺睽瞀瞄瞌瞍瞔瞕瞖瞚瞟瞢瞧瞪瞮瞯瞱瞵瞾矃矉矑矒矕矙矞矟矠矤矦矪矬矰矱矴矸矻砅砆砉砍砎砑砝砡砢砣砭砮砰砵砷硃硄硇硈硌硎硒硜硞硠硡硣硤硨硪确硺硾碊碏碔碘碡碝碞碟碤碨碬碭碰碱碲碳"],
["8fd0a1","碻碽碿磇磈磉磌磎磒磓磕磖磤磛磟磠磡磦磪磲磳礀磶磷磺磻磿礆礌礐礚礜礞礟礠礥礧礩礭礱礴礵礻礽礿祄祅祆祊祋祏祑祔祘祛祜祧祩祫祲祹祻祼祾禋禌禑禓禔禕禖禘禛禜禡禨禩禫禯禱禴禸离秂秄秇秈秊秏秔秖秚秝秞"],
["8fd1a1","秠秢秥秪秫秭秱秸秼稂稃稇稉稊稌稑稕稛稞稡稧稫稭稯稰稴稵稸稹稺穄穅穇穈穌穕穖穙穜穝穟穠穥穧穪穭穵穸穾窀窂窅窆窊窋窐窑窔窞窠窣窬窳窵窹窻窼竆竉竌竎竑竛竨竩竫竬竱竴竻竽竾笇笔笟笣笧笩笪笫笭笮笯笰"],
["8fd2a1","笱笴笽笿筀筁筇筎筕筠筤筦筩筪筭筯筲筳筷箄箉箎箐箑箖箛箞箠箥箬箯箰箲箵箶箺箻箼箽篂篅篈篊篔篖篗篙篚篛篨篪篲篴篵篸篹篺篼篾簁簂簃簄簆簉簋簌簎簏簙簛簠簥簦簨簬簱簳簴簶簹簺籆籊籕籑籒籓籙",5],
["8fd3a1","籡籣籧籩籭籮籰籲籹籼籽粆粇粏粔粞粠粦粰粶粷粺粻粼粿糄糇糈糉糍糏糓糔糕糗糙糚糝糦糩糫糵紃紇紈紉紏紑紒紓紖紝紞紣紦紪紭紱紼紽紾絀絁絇絈絍絑絓絗絙絚絜絝絥絧絪絰絸絺絻絿綁綂綃綅綆綈綋綌綍綑綖綗綝"],
["8fd4a1","綞綦綧綪綳綶綷綹緂",4,"緌緍緎緗緙縀緢緥緦緪緫緭緱緵緶緹緺縈縐縑縕縗縜縝縠縧縨縬縭縯縳縶縿繄繅繇繎繐繒繘繟繡繢繥繫繮繯繳繸繾纁纆纇纊纍纑纕纘纚纝纞缼缻缽缾缿罃罄罇罏罒罓罛罜罝罡罣罤罥罦罭"],
["8fd5a1","罱罽罾罿羀羋羍羏羐羑羖羗羜羡羢羦羪羭羴羼羿翀翃翈翎翏翛翟翣翥翨翬翮翯翲翺翽翾翿耇耈耊耍耎耏耑耓耔耖耝耞耟耠耤耦耬耮耰耴耵耷耹耺耼耾聀聄聠聤聦聭聱聵肁肈肎肜肞肦肧肫肸肹胈胍胏胒胔胕胗胘胠胭胮"],
["8fd6a1","胰胲胳胶胹胺胾脃脋脖脗脘脜脞脠脤脧脬脰脵脺脼腅腇腊腌腒腗腠腡腧腨腩腭腯腷膁膐膄膅膆膋膎膖膘膛膞膢膮膲膴膻臋臃臅臊臎臏臕臗臛臝臞臡臤臫臬臰臱臲臵臶臸臹臽臿舀舃舏舓舔舙舚舝舡舢舨舲舴舺艃艄艅艆"],
["8fd7a1","艋艎艏艑艖艜艠艣艧艭艴艻艽艿芀芁芃芄芇芉芊芎芑芔芖芘芚芛芠芡芣芤芧芨芩芪芮芰芲芴芷芺芼芾芿苆苐苕苚苠苢苤苨苪苭苯苶苷苽苾茀茁茇茈茊茋荔茛茝茞茟茡茢茬茭茮茰茳茷茺茼茽荂荃荄荇荍荎荑荕荖荗荰荸"],
["8fd8a1","荽荿莀莂莄莆莍莒莔莕莘莙莛莜莝莦莧莩莬莾莿菀菇菉菏菐菑菔菝荓菨菪菶菸菹菼萁萆萊萏萑萕萙莭萯萹葅葇葈葊葍葏葑葒葖葘葙葚葜葠葤葥葧葪葰葳葴葶葸葼葽蒁蒅蒒蒓蒕蒞蒦蒨蒩蒪蒯蒱蒴蒺蒽蒾蓀蓂蓇蓈蓌蓏蓓"],
["8fd9a1","蓜蓧蓪蓯蓰蓱蓲蓷蔲蓺蓻蓽蔂蔃蔇蔌蔎蔐蔜蔞蔢蔣蔤蔥蔧蔪蔫蔯蔳蔴蔶蔿蕆蕏",4,"蕖蕙蕜",6,"蕤蕫蕯蕹蕺蕻蕽蕿薁薅薆薉薋薌薏薓薘薝薟薠薢薥薧薴薶薷薸薼薽薾薿藂藇藊藋藎薭藘藚藟藠藦藨藭藳藶藼"],
["8fdaa1","藿蘀蘄蘅蘍蘎蘐蘑蘒蘘蘙蘛蘞蘡蘧蘩蘶蘸蘺蘼蘽虀虂虆虒虓虖虗虘虙虝虠",4,"虩虬虯虵虶虷虺蚍蚑蚖蚘蚚蚜蚡蚦蚧蚨蚭蚱蚳蚴蚵蚷蚸蚹蚿蛀蛁蛃蛅蛑蛒蛕蛗蛚蛜蛠蛣蛥蛧蚈蛺蛼蛽蜄蜅蜇蜋蜎蜏蜐蜓蜔蜙蜞蜟蜡蜣"],
["8fdba1","蜨蜮蜯蜱蜲蜹蜺蜼蜽蜾蝀蝃蝅蝍蝘蝝蝡蝤蝥蝯蝱蝲蝻螃",6,"螋螌螐螓螕螗螘螙螞螠螣螧螬螭螮螱螵螾螿蟁蟈蟉蟊蟎蟕蟖蟙蟚蟜蟟蟢蟣蟤蟪蟫蟭蟱蟳蟸蟺蟿蠁蠃蠆蠉蠊蠋蠐蠙蠒蠓蠔蠘蠚蠛蠜蠞蠟蠨蠭蠮蠰蠲蠵"],
["8fdca1","蠺蠼衁衃衅衈衉衊衋衎衑衕衖衘衚衜衟衠衤衩衱衹衻袀袘袚袛袜袟袠袨袪袺袽袾裀裊",4,"裑裒裓裛裞裧裯裰裱裵裷褁褆褍褎褏褕褖褘褙褚褜褠褦褧褨褰褱褲褵褹褺褾襀襂襅襆襉襏襒襗襚襛襜襡襢襣襫襮襰襳襵襺"],
["8fdda1","襻襼襽覉覍覐覔覕覛覜覟覠覥覰覴覵覶覷覼觔",4,"觥觩觫觭觱觳觶觹觽觿訄訅訇訏訑訒訔訕訞訠訢訤訦訫訬訯訵訷訽訾詀詃詅詇詉詍詎詓詖詗詘詜詝詡詥詧詵詶詷詹詺詻詾詿誀誃誆誋誏誐誒誖誗誙誟誧誩誮誯誳"],
["8fdea1","誶誷誻誾諃諆諈諉諊諑諓諔諕諗諝諟諬諰諴諵諶諼諿謅謆謋謑謜謞謟謊謭謰謷謼譂",4,"譈譒譓譔譙譍譞譣譭譶譸譹譼譾讁讄讅讋讍讏讔讕讜讞讟谸谹谽谾豅豇豉豋豏豑豓豔豗豘豛豝豙豣豤豦豨豩豭豳豵豶豻豾貆"],
["8fdfa1","貇貋貐貒貓貙貛貜貤貹貺賅賆賉賋賏賖賕賙賝賡賨賬賯賰賲賵賷賸賾賿贁贃贉贒贗贛赥赩赬赮赿趂趄趈趍趐趑趕趞趟趠趦趫趬趯趲趵趷趹趻跀跅跆跇跈跊跎跑跔跕跗跙跤跥跧跬跰趼跱跲跴跽踁踄踅踆踋踑踔踖踠踡踢"],
["8fe0a1","踣踦踧踱踳踶踷踸踹踽蹀蹁蹋蹍蹎蹏蹔蹛蹜蹝蹞蹡蹢蹩蹬蹭蹯蹰蹱蹹蹺蹻躂躃躉躐躒躕躚躛躝躞躢躧躩躭躮躳躵躺躻軀軁軃軄軇軏軑軔軜軨軮軰軱軷軹軺軭輀輂輇輈輏輐輖輗輘輞輠輡輣輥輧輨輬輭輮輴輵輶輷輺轀轁"],
["8fe1a1","轃轇轏轑",4,"轘轝轞轥辝辠辡辤辥辦辵辶辸达迀迁迆迊迋迍运迒迓迕迠迣迤迨迮迱迵迶迻迾适逄逈逌逘逛逨逩逯逪逬逭逳逴逷逿遃遄遌遛遝遢遦遧遬遰遴遹邅邈邋邌邎邐邕邗邘邙邛邠邡邢邥邰邲邳邴邶邽郌邾郃"],
["8fe2a1","郄郅郇郈郕郗郘郙郜郝郟郥郒郶郫郯郰郴郾郿鄀鄄鄅鄆鄈鄍鄐鄔鄖鄗鄘鄚鄜鄞鄠鄥鄢鄣鄧鄩鄮鄯鄱鄴鄶鄷鄹鄺鄼鄽酃酇酈酏酓酗酙酚酛酡酤酧酭酴酹酺酻醁醃醅醆醊醎醑醓醔醕醘醞醡醦醨醬醭醮醰醱醲醳醶醻醼醽醿"],
["8fe3a1","釂釃釅釓釔釗釙釚釞釤釥釩釪釬",5,"釷釹釻釽鈀鈁鈄鈅鈆鈇鈉鈊鈌鈐鈒鈓鈖鈘鈜鈝鈣鈤鈥鈦鈨鈮鈯鈰鈳鈵鈶鈸鈹鈺鈼鈾鉀鉂鉃鉆鉇鉊鉍鉎鉏鉑鉘鉙鉜鉝鉠鉡鉥鉧鉨鉩鉮鉯鉰鉵",4,"鉻鉼鉽鉿銈銉銊銍銎銒銗"],
["8fe4a1","銙銟銠銤銥銧銨銫銯銲銶銸銺銻銼銽銿",4,"鋅鋆鋇鋈鋋鋌鋍鋎鋐鋓鋕鋗鋘鋙鋜鋝鋟鋠鋡鋣鋥鋧鋨鋬鋮鋰鋹鋻鋿錀錂錈錍錑錔錕錜錝錞錟錡錤錥錧錩錪錳錴錶錷鍇鍈鍉鍐鍑鍒鍕鍗鍘鍚鍞鍤鍥鍧鍩鍪鍭鍯鍰鍱鍳鍴鍶"],
["8fe5a1","鍺鍽鍿鎀鎁鎂鎈鎊鎋鎍鎏鎒鎕鎘鎛鎞鎡鎣鎤鎦鎨鎫鎴鎵鎶鎺鎩鏁鏄鏅鏆鏇鏉",4,"鏓鏙鏜鏞鏟鏢鏦鏧鏹鏷鏸鏺鏻鏽鐁鐂鐄鐈鐉鐍鐎鐏鐕鐖鐗鐟鐮鐯鐱鐲鐳鐴鐻鐿鐽鑃鑅鑈鑊鑌鑕鑙鑜鑟鑡鑣鑨鑫鑭鑮鑯鑱鑲钄钃镸镹"],
["8fe6a1","镾閄閈閌閍閎閝閞閟閡閦閩閫閬閴閶閺閽閿闆闈闉闋闐闑闒闓闙闚闝闞闟闠闤闦阝阞阢阤阥阦阬阱阳阷阸阹阺阼阽陁陒陔陖陗陘陡陮陴陻陼陾陿隁隂隃隄隉隑隖隚隝隟隤隥隦隩隮隯隳隺雊雒嶲雘雚雝雞雟雩雯雱雺霂"],
["8fe7a1","霃霅霉霚霛霝霡霢霣霨霱霳靁靃靊靎靏靕靗靘靚靛靣靧靪靮靳靶靷靸靻靽靿鞀鞉鞕鞖鞗鞙鞚鞞鞟鞢鞬鞮鞱鞲鞵鞶鞸鞹鞺鞼鞾鞿韁韄韅韇韉韊韌韍韎韐韑韔韗韘韙韝韞韠韛韡韤韯韱韴韷韸韺頇頊頙頍頎頔頖頜頞頠頣頦"],
["8fe8a1","頫頮頯頰頲頳頵頥頾顄顇顊顑顒顓顖顗顙顚顢顣顥顦顪顬颫颭颮颰颴颷颸颺颻颿飂飅飈飌飡飣飥飦飧飪飳飶餂餇餈餑餕餖餗餚餛餜餟餢餦餧餫餱",4,"餹餺餻餼饀饁饆饇饈饍饎饔饘饙饛饜饞饟饠馛馝馟馦馰馱馲馵"],
["8fe9a1","馹馺馽馿駃駉駓駔駙駚駜駞駧駪駫駬駰駴駵駹駽駾騂騃騄騋騌騐騑騖騞騠騢騣騤騧騭騮騳騵騶騸驇驁驄驊驋驌驎驑驔驖驝骪骬骮骯骲骴骵骶骹骻骾骿髁髃髆髈髎髐髒髕髖髗髛髜髠髤髥髧髩髬髲髳髵髹髺髽髿",4],
["8feaa1","鬄鬅鬈鬉鬋鬌鬍鬎鬐鬒鬖鬙鬛鬜鬠鬦鬫鬭鬳鬴鬵鬷鬹鬺鬽魈魋魌魕魖魗魛魞魡魣魥魦魨魪",4,"魳魵魷魸魹魿鮀鮄鮅鮆鮇鮉鮊鮋鮍鮏鮐鮔鮚鮝鮞鮦鮧鮩鮬鮰鮱鮲鮷鮸鮻鮼鮾鮿鯁鯇鯈鯎鯐鯗鯘鯝鯟鯥鯧鯪鯫鯯鯳鯷鯸"],
["8feba1","鯹鯺鯽鯿鰀鰂鰋鰏鰑鰖鰘鰙鰚鰜鰞鰢鰣鰦",4,"鰱鰵鰶鰷鰽鱁鱃鱄鱅鱉鱊鱎鱏鱐鱓鱔鱖鱘鱛鱝鱞鱟鱣鱩鱪鱜鱫鱨鱮鱰鱲鱵鱷鱻鳦鳲鳷鳹鴋鴂鴑鴗鴘鴜鴝鴞鴯鴰鴲鴳鴴鴺鴼鵅鴽鵂鵃鵇鵊鵓鵔鵟鵣鵢鵥鵩鵪鵫鵰鵶鵷鵻"],
["8feca1","鵼鵾鶃鶄鶆鶊鶍鶎鶒鶓鶕鶖鶗鶘鶡鶪鶬鶮鶱鶵鶹鶼鶿鷃鷇鷉鷊鷔鷕鷖鷗鷚鷞鷟鷠鷥鷧鷩鷫鷮鷰鷳鷴鷾鸊鸂鸇鸎鸐鸑鸒鸕鸖鸙鸜鸝鹺鹻鹼麀麂麃麄麅麇麎麏麖麘麛麞麤麨麬麮麯麰麳麴麵黆黈黋黕黟黤黧黬黭黮黰黱黲黵"],
["8feda1","黸黿鼂鼃鼉鼏鼐鼑鼒鼔鼖鼗鼙鼚鼛鼟鼢鼦鼪鼫鼯鼱鼲鼴鼷鼹鼺鼼鼽鼿齁齃",4,"齓齕齖齗齘齚齝齞齨齩齭",4,"齳齵齺齽龏龐龑龒龔龖龗龞龡龢龣龥"]
]

},{}],36:[function(require,module,exports){
module.exports={"uChars":[128,165,169,178,184,216,226,235,238,244,248,251,253,258,276,284,300,325,329,334,364,463,465,467,469,471,473,475,477,506,594,610,712,716,730,930,938,962,970,1026,1104,1106,8209,8215,8218,8222,8231,8241,8244,8246,8252,8365,8452,8454,8458,8471,8482,8556,8570,8596,8602,8713,8720,8722,8726,8731,8737,8740,8742,8748,8751,8760,8766,8777,8781,8787,8802,8808,8816,8854,8858,8870,8896,8979,9322,9372,9548,9588,9616,9622,9634,9652,9662,9672,9676,9680,9702,9735,9738,9793,9795,11906,11909,11913,11917,11928,11944,11947,11951,11956,11960,11964,11979,12284,12292,12312,12319,12330,12351,12436,12447,12535,12543,12586,12842,12850,12964,13200,13215,13218,13253,13263,13267,13270,13384,13428,13727,13839,13851,14617,14703,14801,14816,14964,15183,15471,15585,16471,16736,17208,17325,17330,17374,17623,17997,18018,18212,18218,18301,18318,18760,18811,18814,18820,18823,18844,18848,18872,19576,19620,19738,19887,40870,59244,59336,59367,59413,59417,59423,59431,59437,59443,59452,59460,59478,59493,63789,63866,63894,63976,63986,64016,64018,64021,64025,64034,64037,64042,65074,65093,65107,65112,65127,65132,65375,65510,65536],"gbChars":[0,36,38,45,50,81,89,95,96,100,103,104,105,109,126,133,148,172,175,179,208,306,307,308,309,310,311,312,313,341,428,443,544,545,558,741,742,749,750,805,819,820,7922,7924,7925,7927,7934,7943,7944,7945,7950,8062,8148,8149,8152,8164,8174,8236,8240,8262,8264,8374,8380,8381,8384,8388,8390,8392,8393,8394,8396,8401,8406,8416,8419,8424,8437,8439,8445,8482,8485,8496,8521,8603,8936,8946,9046,9050,9063,9066,9076,9092,9100,9108,9111,9113,9131,9162,9164,9218,9219,11329,11331,11334,11336,11346,11361,11363,11366,11370,11372,11375,11389,11682,11686,11687,11692,11694,11714,11716,11723,11725,11730,11736,11982,11989,12102,12336,12348,12350,12384,12393,12395,12397,12510,12553,12851,12962,12973,13738,13823,13919,13933,14080,14298,14585,14698,15583,15847,16318,16434,16438,16481,16729,17102,17122,17315,17320,17402,17418,17859,17909,17911,17915,17916,17936,17939,17961,18664,18703,18814,18962,19043,33469,33470,33471,33484,33485,33490,33497,33501,33505,33513,33520,33536,33550,37845,37921,37948,38029,38038,38064,38065,38066,38069,38075,38076,38078,39108,39109,39113,39114,39115,39116,39265,39394,189000]}
},{}],37:[function(require,module,exports){
module.exports=[
["a140","",62],
["a180","",32],
["a240","",62],
["a280","",32],
["a2ab","",5],
["a2e3","€"],
["a2ef",""],
["a2fd",""],
["a340","",62],
["a380","",31,"　"],
["a440","",62],
["a480","",32],
["a4f4","",10],
["a540","",62],
["a580","",32],
["a5f7","",7],
["a640","",62],
["a680","",32],
["a6b9","",7],
["a6d9","",6],
["a6ec",""],
["a6f3",""],
["a6f6","",8],
["a740","",62],
["a780","",32],
["a7c2","",14],
["a7f2","",12],
["a896","",10],
["a8bc","ḿ"],
["a8bf","ǹ"],
["a8c1",""],
["a8ea","",20],
["a958",""],
["a95b",""],
["a95d",""],
["a989","〾⿰",11],
["a997","",12],
["a9f0","",14],
["aaa1","",93],
["aba1","",93],
["aca1","",93],
["ada1","",93],
["aea1","",93],
["afa1","",93],
["d7fa","",4],
["f8a1","",93],
["f9a1","",93],
["faa1","",93],
["fba1","",93],
["fca1","",93],
["fda1","",93],
["fe50","⺁⺄㑳㑇⺈⺋㖞㘚㘎⺌⺗㥮㤘㧏㧟㩳㧐㭎㱮㳠⺧⺪䁖䅟⺮䌷⺳⺶⺷䎱䎬⺻䏝䓖䙡䙌"],
["fe80","䜣䜩䝼䞍⻊䥇䥺䥽䦂䦃䦅䦆䦟䦛䦷䦶䲣䲟䲠䲡䱷䲢䴓",6,"䶮",93],
["8135f437",""]
]

},{}],38:[function(require,module,exports){
module.exports=[
["0","\u0000",128],
["a1","｡",62],
["8140","　、。，．・：；？！゛゜´｀¨＾￣＿ヽヾゝゞ〃仝々〆〇ー―‐／＼～∥｜…‥‘’“”（）〔〕［］｛｝〈",9,"＋－±×"],
["8180","÷＝≠＜＞≦≧∞∴♂♀°′″℃￥＄￠￡％＃＆＊＠§☆★○●◎◇◆□■△▲▽▼※〒→←↑↓〓"],
["81b8","∈∋⊆⊇⊂⊃∪∩"],
["81c8","∧∨￢⇒⇔∀∃"],
["81da","∠⊥⌒∂∇≡≒≪≫√∽∝∵∫∬"],
["81f0","Å‰♯♭♪†‡¶"],
["81fc","◯"],
["824f","０",9],
["8260","Ａ",25],
["8281","ａ",25],
["829f","ぁ",82],
["8340","ァ",62],
["8380","ム",22],
["839f","Α",16,"Σ",6],
["83bf","α",16,"σ",6],
["8440","А",5,"ЁЖ",25],
["8470","а",5,"ёж",7],
["8480","о",17],
["849f","─│┌┐┘└├┬┤┴┼━┃┏┓┛┗┣┳┫┻╋┠┯┨┷┿┝┰┥┸╂"],
["8740","①",19,"Ⅰ",9],
["875f","㍉㌔㌢㍍㌘㌧㌃㌶㍑㍗㌍㌦㌣㌫㍊㌻㎜㎝㎞㎎㎏㏄㎡"],
["877e","㍻"],
["8780","〝〟№㏍℡㊤",4,"㈱㈲㈹㍾㍽㍼≒≡∫∮∑√⊥∠∟⊿∵∩∪"],
["889f","亜唖娃阿哀愛挨姶逢葵茜穐悪握渥旭葦芦鯵梓圧斡扱宛姐虻飴絢綾鮎或粟袷安庵按暗案闇鞍杏以伊位依偉囲夷委威尉惟意慰易椅為畏異移維緯胃萎衣謂違遺医井亥域育郁磯一壱溢逸稲茨芋鰯允印咽員因姻引飲淫胤蔭"],
["8940","院陰隠韻吋右宇烏羽迂雨卯鵜窺丑碓臼渦嘘唄欝蔚鰻姥厩浦瓜閏噂云運雲荏餌叡営嬰影映曳栄永泳洩瑛盈穎頴英衛詠鋭液疫益駅悦謁越閲榎厭円"],
["8980","園堰奄宴延怨掩援沿演炎焔煙燕猿縁艶苑薗遠鉛鴛塩於汚甥凹央奥往応押旺横欧殴王翁襖鴬鴎黄岡沖荻億屋憶臆桶牡乙俺卸恩温穏音下化仮何伽価佳加可嘉夏嫁家寡科暇果架歌河火珂禍禾稼箇花苛茄荷華菓蝦課嘩貨迦過霞蚊俄峨我牙画臥芽蛾賀雅餓駕介会解回塊壊廻快怪悔恢懐戒拐改"],
["8a40","魁晦械海灰界皆絵芥蟹開階貝凱劾外咳害崖慨概涯碍蓋街該鎧骸浬馨蛙垣柿蛎鈎劃嚇各廓拡撹格核殻獲確穫覚角赫較郭閣隔革学岳楽額顎掛笠樫"],
["8a80","橿梶鰍潟割喝恰括活渇滑葛褐轄且鰹叶椛樺鞄株兜竃蒲釜鎌噛鴨栢茅萱粥刈苅瓦乾侃冠寒刊勘勧巻喚堪姦完官寛干幹患感慣憾換敢柑桓棺款歓汗漢澗潅環甘監看竿管簡緩缶翰肝艦莞観諌貫還鑑間閑関陥韓館舘丸含岸巌玩癌眼岩翫贋雁頑顔願企伎危喜器基奇嬉寄岐希幾忌揮机旗既期棋棄"],
["8b40","機帰毅気汽畿祈季稀紀徽規記貴起軌輝飢騎鬼亀偽儀妓宜戯技擬欺犠疑祇義蟻誼議掬菊鞠吉吃喫桔橘詰砧杵黍却客脚虐逆丘久仇休及吸宮弓急救"],
["8b80","朽求汲泣灸球究窮笈級糾給旧牛去居巨拒拠挙渠虚許距鋸漁禦魚亨享京供侠僑兇競共凶協匡卿叫喬境峡強彊怯恐恭挟教橋況狂狭矯胸脅興蕎郷鏡響饗驚仰凝尭暁業局曲極玉桐粁僅勤均巾錦斤欣欽琴禁禽筋緊芹菌衿襟謹近金吟銀九倶句区狗玖矩苦躯駆駈駒具愚虞喰空偶寓遇隅串櫛釧屑屈"],
["8c40","掘窟沓靴轡窪熊隈粂栗繰桑鍬勲君薫訓群軍郡卦袈祁係傾刑兄啓圭珪型契形径恵慶慧憩掲携敬景桂渓畦稽系経継繋罫茎荊蛍計詣警軽頚鶏芸迎鯨"],
["8c80","劇戟撃激隙桁傑欠決潔穴結血訣月件倹倦健兼券剣喧圏堅嫌建憲懸拳捲検権牽犬献研硯絹県肩見謙賢軒遣鍵険顕験鹸元原厳幻弦減源玄現絃舷言諺限乎個古呼固姑孤己庫弧戸故枯湖狐糊袴股胡菰虎誇跨鈷雇顧鼓五互伍午呉吾娯後御悟梧檎瑚碁語誤護醐乞鯉交佼侯候倖光公功効勾厚口向"],
["8d40","后喉坑垢好孔孝宏工巧巷幸広庚康弘恒慌抗拘控攻昂晃更杭校梗構江洪浩港溝甲皇硬稿糠紅紘絞綱耕考肯肱腔膏航荒行衡講貢購郊酵鉱砿鋼閤降"],
["8d80","項香高鴻剛劫号合壕拷濠豪轟麹克刻告国穀酷鵠黒獄漉腰甑忽惚骨狛込此頃今困坤墾婚恨懇昏昆根梱混痕紺艮魂些佐叉唆嵯左差査沙瑳砂詐鎖裟坐座挫債催再最哉塞妻宰彩才採栽歳済災采犀砕砦祭斎細菜裁載際剤在材罪財冴坂阪堺榊肴咲崎埼碕鷺作削咋搾昨朔柵窄策索錯桜鮭笹匙冊刷"],
["8e40","察拶撮擦札殺薩雑皐鯖捌錆鮫皿晒三傘参山惨撒散桟燦珊産算纂蚕讃賛酸餐斬暫残仕仔伺使刺司史嗣四士始姉姿子屍市師志思指支孜斯施旨枝止"],
["8e80","死氏獅祉私糸紙紫肢脂至視詞詩試誌諮資賜雌飼歯事似侍児字寺慈持時次滋治爾璽痔磁示而耳自蒔辞汐鹿式識鴫竺軸宍雫七叱執失嫉室悉湿漆疾質実蔀篠偲柴芝屡蕊縞舎写射捨赦斜煮社紗者謝車遮蛇邪借勺尺杓灼爵酌釈錫若寂弱惹主取守手朱殊狩珠種腫趣酒首儒受呪寿授樹綬需囚収周"],
["8f40","宗就州修愁拾洲秀秋終繍習臭舟蒐衆襲讐蹴輯週酋酬集醜什住充十従戎柔汁渋獣縦重銃叔夙宿淑祝縮粛塾熟出術述俊峻春瞬竣舜駿准循旬楯殉淳"],
["8f80","準潤盾純巡遵醇順処初所暑曙渚庶緒署書薯藷諸助叙女序徐恕鋤除傷償勝匠升召哨商唱嘗奨妾娼宵将小少尚庄床廠彰承抄招掌捷昇昌昭晶松梢樟樵沼消渉湘焼焦照症省硝礁祥称章笑粧紹肖菖蒋蕉衝裳訟証詔詳象賞醤鉦鍾鐘障鞘上丈丞乗冗剰城場壌嬢常情擾条杖浄状畳穣蒸譲醸錠嘱埴飾"],
["9040","拭植殖燭織職色触食蝕辱尻伸信侵唇娠寝審心慎振新晋森榛浸深申疹真神秦紳臣芯薪親診身辛進針震人仁刃塵壬尋甚尽腎訊迅陣靭笥諏須酢図厨"],
["9080","逗吹垂帥推水炊睡粋翠衰遂酔錐錘随瑞髄崇嵩数枢趨雛据杉椙菅頗雀裾澄摺寸世瀬畝是凄制勢姓征性成政整星晴棲栖正清牲生盛精聖声製西誠誓請逝醒青静斉税脆隻席惜戚斥昔析石積籍績脊責赤跡蹟碩切拙接摂折設窃節説雪絶舌蝉仙先千占宣専尖川戦扇撰栓栴泉浅洗染潜煎煽旋穿箭線"],
["9140","繊羨腺舛船薦詮賎践選遷銭銑閃鮮前善漸然全禅繕膳糎噌塑岨措曾曽楚狙疏疎礎祖租粗素組蘇訴阻遡鼠僧創双叢倉喪壮奏爽宋層匝惣想捜掃挿掻"],
["9180","操早曹巣槍槽漕燥争痩相窓糟総綜聡草荘葬蒼藻装走送遭鎗霜騒像増憎臓蔵贈造促側則即息捉束測足速俗属賊族続卒袖其揃存孫尊損村遜他多太汰詑唾堕妥惰打柁舵楕陀駄騨体堆対耐岱帯待怠態戴替泰滞胎腿苔袋貸退逮隊黛鯛代台大第醍題鷹滝瀧卓啄宅托択拓沢濯琢託鐸濁諾茸凧蛸只"],
["9240","叩但達辰奪脱巽竪辿棚谷狸鱈樽誰丹単嘆坦担探旦歎淡湛炭短端箪綻耽胆蛋誕鍛団壇弾断暖檀段男談値知地弛恥智池痴稚置致蜘遅馳築畜竹筑蓄"],
["9280","逐秩窒茶嫡着中仲宙忠抽昼柱注虫衷註酎鋳駐樗瀦猪苧著貯丁兆凋喋寵帖帳庁弔張彫徴懲挑暢朝潮牒町眺聴脹腸蝶調諜超跳銚長頂鳥勅捗直朕沈珍賃鎮陳津墜椎槌追鎚痛通塚栂掴槻佃漬柘辻蔦綴鍔椿潰坪壷嬬紬爪吊釣鶴亭低停偵剃貞呈堤定帝底庭廷弟悌抵挺提梯汀碇禎程締艇訂諦蹄逓"],
["9340","邸鄭釘鼎泥摘擢敵滴的笛適鏑溺哲徹撤轍迭鉄典填天展店添纏甜貼転顛点伝殿澱田電兎吐堵塗妬屠徒斗杜渡登菟賭途都鍍砥砺努度土奴怒倒党冬"],
["9380","凍刀唐塔塘套宕島嶋悼投搭東桃梼棟盗淘湯涛灯燈当痘祷等答筒糖統到董蕩藤討謄豆踏逃透鐙陶頭騰闘働動同堂導憧撞洞瞳童胴萄道銅峠鴇匿得徳涜特督禿篤毒独読栃橡凸突椴届鳶苫寅酉瀞噸屯惇敦沌豚遁頓呑曇鈍奈那内乍凪薙謎灘捺鍋楢馴縄畷南楠軟難汝二尼弐迩匂賑肉虹廿日乳入"],
["9440","如尿韮任妊忍認濡禰祢寧葱猫熱年念捻撚燃粘乃廼之埜嚢悩濃納能脳膿農覗蚤巴把播覇杷波派琶破婆罵芭馬俳廃拝排敗杯盃牌背肺輩配倍培媒梅"],
["9480","楳煤狽買売賠陪這蝿秤矧萩伯剥博拍柏泊白箔粕舶薄迫曝漠爆縛莫駁麦函箱硲箸肇筈櫨幡肌畑畠八鉢溌発醗髪伐罰抜筏閥鳩噺塙蛤隼伴判半反叛帆搬斑板氾汎版犯班畔繁般藩販範釆煩頒飯挽晩番盤磐蕃蛮匪卑否妃庇彼悲扉批披斐比泌疲皮碑秘緋罷肥被誹費避非飛樋簸備尾微枇毘琵眉美"],
["9540","鼻柊稗匹疋髭彦膝菱肘弼必畢筆逼桧姫媛紐百謬俵彪標氷漂瓢票表評豹廟描病秒苗錨鋲蒜蛭鰭品彬斌浜瀕貧賓頻敏瓶不付埠夫婦富冨布府怖扶敷"],
["9580","斧普浮父符腐膚芙譜負賦赴阜附侮撫武舞葡蕪部封楓風葺蕗伏副復幅服福腹複覆淵弗払沸仏物鮒分吻噴墳憤扮焚奮粉糞紛雰文聞丙併兵塀幣平弊柄並蔽閉陛米頁僻壁癖碧別瞥蔑箆偏変片篇編辺返遍便勉娩弁鞭保舗鋪圃捕歩甫補輔穂募墓慕戊暮母簿菩倣俸包呆報奉宝峰峯崩庖抱捧放方朋"],
["9640","法泡烹砲縫胞芳萌蓬蜂褒訪豊邦鋒飽鳳鵬乏亡傍剖坊妨帽忘忙房暴望某棒冒紡肪膨謀貌貿鉾防吠頬北僕卜墨撲朴牧睦穆釦勃没殆堀幌奔本翻凡盆"],
["9680","摩磨魔麻埋妹昧枚毎哩槙幕膜枕鮪柾鱒桝亦俣又抹末沫迄侭繭麿万慢満漫蔓味未魅巳箕岬密蜜湊蓑稔脈妙粍民眠務夢無牟矛霧鵡椋婿娘冥名命明盟迷銘鳴姪牝滅免棉綿緬面麺摸模茂妄孟毛猛盲網耗蒙儲木黙目杢勿餅尤戻籾貰問悶紋門匁也冶夜爺耶野弥矢厄役約薬訳躍靖柳薮鑓愉愈油癒"],
["9740","諭輸唯佑優勇友宥幽悠憂揖有柚湧涌猶猷由祐裕誘遊邑郵雄融夕予余与誉輿預傭幼妖容庸揚揺擁曜楊様洋溶熔用窯羊耀葉蓉要謡踊遥陽養慾抑欲"],
["9780","沃浴翌翼淀羅螺裸来莱頼雷洛絡落酪乱卵嵐欄濫藍蘭覧利吏履李梨理璃痢裏裡里離陸律率立葎掠略劉流溜琉留硫粒隆竜龍侶慮旅虜了亮僚両凌寮料梁涼猟療瞭稜糧良諒遼量陵領力緑倫厘林淋燐琳臨輪隣鱗麟瑠塁涙累類令伶例冷励嶺怜玲礼苓鈴隷零霊麗齢暦歴列劣烈裂廉恋憐漣煉簾練聯"],
["9840","蓮連錬呂魯櫓炉賂路露労婁廊弄朗楼榔浪漏牢狼篭老聾蝋郎六麓禄肋録論倭和話歪賄脇惑枠鷲亙亘鰐詫藁蕨椀湾碗腕"],
["989f","弌丐丕个丱丶丼丿乂乖乘亂亅豫亊舒弍于亞亟亠亢亰亳亶从仍仄仆仂仗仞仭仟价伉佚估佛佝佗佇佶侈侏侘佻佩佰侑佯來侖儘俔俟俎俘俛俑俚俐俤俥倚倨倔倪倥倅伜俶倡倩倬俾俯們倆偃假會偕偐偈做偖偬偸傀傚傅傴傲"],
["9940","僉僊傳僂僖僞僥僭僣僮價僵儉儁儂儖儕儔儚儡儺儷儼儻儿兀兒兌兔兢竸兩兪兮冀冂囘册冉冏冑冓冕冖冤冦冢冩冪冫决冱冲冰况冽凅凉凛几處凩凭"],
["9980","凰凵凾刄刋刔刎刧刪刮刳刹剏剄剋剌剞剔剪剴剩剳剿剽劍劔劒剱劈劑辨辧劬劭劼劵勁勍勗勞勣勦飭勠勳勵勸勹匆匈甸匍匐匏匕匚匣匯匱匳匸區卆卅丗卉卍凖卞卩卮夘卻卷厂厖厠厦厥厮厰厶參簒雙叟曼燮叮叨叭叺吁吽呀听吭吼吮吶吩吝呎咏呵咎呟呱呷呰咒呻咀呶咄咐咆哇咢咸咥咬哄哈咨"],
["9a40","咫哂咤咾咼哘哥哦唏唔哽哮哭哺哢唹啀啣啌售啜啅啖啗唸唳啝喙喀咯喊喟啻啾喘喞單啼喃喩喇喨嗚嗅嗟嗄嗜嗤嗔嘔嗷嘖嗾嗽嘛嗹噎噐營嘴嘶嘲嘸"],
["9a80","噫噤嘯噬噪嚆嚀嚊嚠嚔嚏嚥嚮嚶嚴囂嚼囁囃囀囈囎囑囓囗囮囹圀囿圄圉圈國圍圓團圖嗇圜圦圷圸坎圻址坏坩埀垈坡坿垉垓垠垳垤垪垰埃埆埔埒埓堊埖埣堋堙堝塲堡塢塋塰毀塒堽塹墅墹墟墫墺壞墻墸墮壅壓壑壗壙壘壥壜壤壟壯壺壹壻壼壽夂夊夐夛梦夥夬夭夲夸夾竒奕奐奎奚奘奢奠奧奬奩"],
["9b40","奸妁妝佞侫妣妲姆姨姜妍姙姚娥娟娑娜娉娚婀婬婉娵娶婢婪媚媼媾嫋嫂媽嫣嫗嫦嫩嫖嫺嫻嬌嬋嬖嬲嫐嬪嬶嬾孃孅孀孑孕孚孛孥孩孰孳孵學斈孺宀"],
["9b80","它宦宸寃寇寉寔寐寤實寢寞寥寫寰寶寳尅將專對尓尠尢尨尸尹屁屆屎屓屐屏孱屬屮乢屶屹岌岑岔妛岫岻岶岼岷峅岾峇峙峩峽峺峭嶌峪崋崕崗嵜崟崛崑崔崢崚崙崘嵌嵒嵎嵋嵬嵳嵶嶇嶄嶂嶢嶝嶬嶮嶽嶐嶷嶼巉巍巓巒巖巛巫已巵帋帚帙帑帛帶帷幄幃幀幎幗幔幟幢幤幇幵并幺麼广庠廁廂廈廐廏"],
["9c40","廖廣廝廚廛廢廡廨廩廬廱廳廰廴廸廾弃弉彝彜弋弑弖弩弭弸彁彈彌彎弯彑彖彗彙彡彭彳彷徃徂彿徊很徑徇從徙徘徠徨徭徼忖忻忤忸忱忝悳忿怡恠"],
["9c80","怙怐怩怎怱怛怕怫怦怏怺恚恁恪恷恟恊恆恍恣恃恤恂恬恫恙悁悍惧悃悚悄悛悖悗悒悧悋惡悸惠惓悴忰悽惆悵惘慍愕愆惶惷愀惴惺愃愡惻惱愍愎慇愾愨愧慊愿愼愬愴愽慂慄慳慷慘慙慚慫慴慯慥慱慟慝慓慵憙憖憇憬憔憚憊憑憫憮懌懊應懷懈懃懆憺懋罹懍懦懣懶懺懴懿懽懼懾戀戈戉戍戌戔戛"],
["9d40","戞戡截戮戰戲戳扁扎扞扣扛扠扨扼抂抉找抒抓抖拔抃抔拗拑抻拏拿拆擔拈拜拌拊拂拇抛拉挌拮拱挧挂挈拯拵捐挾捍搜捏掖掎掀掫捶掣掏掉掟掵捫"],
["9d80","捩掾揩揀揆揣揉插揶揄搖搴搆搓搦搶攝搗搨搏摧摯摶摎攪撕撓撥撩撈撼據擒擅擇撻擘擂擱擧舉擠擡抬擣擯攬擶擴擲擺攀擽攘攜攅攤攣攫攴攵攷收攸畋效敖敕敍敘敞敝敲數斂斃變斛斟斫斷旃旆旁旄旌旒旛旙无旡旱杲昊昃旻杳昵昶昴昜晏晄晉晁晞晝晤晧晨晟晢晰暃暈暎暉暄暘暝曁暹曉暾暼"],
["9e40","曄暸曖曚曠昿曦曩曰曵曷朏朖朞朦朧霸朮朿朶杁朸朷杆杞杠杙杣杤枉杰枩杼杪枌枋枦枡枅枷柯枴柬枳柩枸柤柞柝柢柮枹柎柆柧檜栞框栩桀桍栲桎"],
["9e80","梳栫桙档桷桿梟梏梭梔條梛梃檮梹桴梵梠梺椏梍桾椁棊椈棘椢椦棡椌棍棔棧棕椶椒椄棗棣椥棹棠棯椨椪椚椣椡棆楹楷楜楸楫楔楾楮椹楴椽楙椰楡楞楝榁楪榲榮槐榿槁槓榾槎寨槊槝榻槃榧樮榑榠榜榕榴槞槨樂樛槿權槹槲槧樅榱樞槭樔槫樊樒櫁樣樓橄樌橲樶橸橇橢橙橦橈樸樢檐檍檠檄檢檣"],
["9f40","檗蘗檻櫃櫂檸檳檬櫞櫑櫟檪櫚櫪櫻欅蘖櫺欒欖鬱欟欸欷盜欹飮歇歃歉歐歙歔歛歟歡歸歹歿殀殄殃殍殘殕殞殤殪殫殯殲殱殳殷殼毆毋毓毟毬毫毳毯"],
["9f80","麾氈氓气氛氤氣汞汕汢汪沂沍沚沁沛汾汨汳沒沐泄泱泓沽泗泅泝沮沱沾沺泛泯泙泪洟衍洶洫洽洸洙洵洳洒洌浣涓浤浚浹浙涎涕濤涅淹渕渊涵淇淦涸淆淬淞淌淨淒淅淺淙淤淕淪淮渭湮渮渙湲湟渾渣湫渫湶湍渟湃渺湎渤滿渝游溂溪溘滉溷滓溽溯滄溲滔滕溏溥滂溟潁漑灌滬滸滾漿滲漱滯漲滌"],
["e040","漾漓滷澆潺潸澁澀潯潛濳潭澂潼潘澎澑濂潦澳澣澡澤澹濆澪濟濕濬濔濘濱濮濛瀉瀋濺瀑瀁瀏濾瀛瀚潴瀝瀘瀟瀰瀾瀲灑灣炙炒炯烱炬炸炳炮烟烋烝"],
["e080","烙焉烽焜焙煥煕熈煦煢煌煖煬熏燻熄熕熨熬燗熹熾燒燉燔燎燠燬燧燵燼燹燿爍爐爛爨爭爬爰爲爻爼爿牀牆牋牘牴牾犂犁犇犒犖犢犧犹犲狃狆狄狎狒狢狠狡狹狷倏猗猊猜猖猝猴猯猩猥猾獎獏默獗獪獨獰獸獵獻獺珈玳珎玻珀珥珮珞璢琅瑯琥珸琲琺瑕琿瑟瑙瑁瑜瑩瑰瑣瑪瑶瑾璋璞璧瓊瓏瓔珱"],
["e140","瓠瓣瓧瓩瓮瓲瓰瓱瓸瓷甄甃甅甌甎甍甕甓甞甦甬甼畄畍畊畉畛畆畚畩畤畧畫畭畸當疆疇畴疊疉疂疔疚疝疥疣痂疳痃疵疽疸疼疱痍痊痒痙痣痞痾痿"],
["e180","痼瘁痰痺痲痳瘋瘍瘉瘟瘧瘠瘡瘢瘤瘴瘰瘻癇癈癆癜癘癡癢癨癩癪癧癬癰癲癶癸發皀皃皈皋皎皖皓皙皚皰皴皸皹皺盂盍盖盒盞盡盥盧盪蘯盻眈眇眄眩眤眞眥眦眛眷眸睇睚睨睫睛睥睿睾睹瞎瞋瞑瞠瞞瞰瞶瞹瞿瞼瞽瞻矇矍矗矚矜矣矮矼砌砒礦砠礪硅碎硴碆硼碚碌碣碵碪碯磑磆磋磔碾碼磅磊磬"],
["e240","磧磚磽磴礇礒礑礙礬礫祀祠祗祟祚祕祓祺祿禊禝禧齋禪禮禳禹禺秉秕秧秬秡秣稈稍稘稙稠稟禀稱稻稾稷穃穗穉穡穢穩龝穰穹穽窈窗窕窘窖窩竈窰"],
["e280","窶竅竄窿邃竇竊竍竏竕竓站竚竝竡竢竦竭竰笂笏笊笆笳笘笙笞笵笨笶筐筺笄筍笋筌筅筵筥筴筧筰筱筬筮箝箘箟箍箜箚箋箒箏筝箙篋篁篌篏箴篆篝篩簑簔篦篥籠簀簇簓篳篷簗簍篶簣簧簪簟簷簫簽籌籃籔籏籀籐籘籟籤籖籥籬籵粃粐粤粭粢粫粡粨粳粲粱粮粹粽糀糅糂糘糒糜糢鬻糯糲糴糶糺紆"],
["e340","紂紜紕紊絅絋紮紲紿紵絆絳絖絎絲絨絮絏絣經綉絛綏絽綛綺綮綣綵緇綽綫總綢綯緜綸綟綰緘緝緤緞緻緲緡縅縊縣縡縒縱縟縉縋縢繆繦縻縵縹繃縷"],
["e380","縲縺繧繝繖繞繙繚繹繪繩繼繻纃緕繽辮繿纈纉續纒纐纓纔纖纎纛纜缸缺罅罌罍罎罐网罕罔罘罟罠罨罩罧罸羂羆羃羈羇羌羔羞羝羚羣羯羲羹羮羶羸譱翅翆翊翕翔翡翦翩翳翹飜耆耄耋耒耘耙耜耡耨耿耻聊聆聒聘聚聟聢聨聳聲聰聶聹聽聿肄肆肅肛肓肚肭冐肬胛胥胙胝胄胚胖脉胯胱脛脩脣脯腋"],
["e440","隋腆脾腓腑胼腱腮腥腦腴膃膈膊膀膂膠膕膤膣腟膓膩膰膵膾膸膽臀臂膺臉臍臑臙臘臈臚臟臠臧臺臻臾舁舂舅與舊舍舐舖舩舫舸舳艀艙艘艝艚艟艤"],
["e480","艢艨艪艫舮艱艷艸艾芍芒芫芟芻芬苡苣苟苒苴苳苺莓范苻苹苞茆苜茉苙茵茴茖茲茱荀茹荐荅茯茫茗茘莅莚莪莟莢莖茣莎莇莊荼莵荳荵莠莉莨菴萓菫菎菽萃菘萋菁菷萇菠菲萍萢萠莽萸蔆菻葭萪萼蕚蒄葷葫蒭葮蒂葩葆萬葯葹萵蓊葢蒹蒿蒟蓙蓍蒻蓚蓐蓁蓆蓖蒡蔡蓿蓴蔗蔘蔬蔟蔕蔔蓼蕀蕣蕘蕈"],
["e540","蕁蘂蕋蕕薀薤薈薑薊薨蕭薔薛藪薇薜蕷蕾薐藉薺藏薹藐藕藝藥藜藹蘊蘓蘋藾藺蘆蘢蘚蘰蘿虍乕虔號虧虱蚓蚣蚩蚪蚋蚌蚶蚯蛄蛆蚰蛉蠣蚫蛔蛞蛩蛬"],
["e580","蛟蛛蛯蜒蜆蜈蜀蜃蛻蜑蜉蜍蛹蜊蜴蜿蜷蜻蜥蜩蜚蝠蝟蝸蝌蝎蝴蝗蝨蝮蝙蝓蝣蝪蠅螢螟螂螯蟋螽蟀蟐雖螫蟄螳蟇蟆螻蟯蟲蟠蠏蠍蟾蟶蟷蠎蟒蠑蠖蠕蠢蠡蠱蠶蠹蠧蠻衄衂衒衙衞衢衫袁衾袞衵衽袵衲袂袗袒袮袙袢袍袤袰袿袱裃裄裔裘裙裝裹褂裼裴裨裲褄褌褊褓襃褞褥褪褫襁襄褻褶褸襌褝襠襞"],
["e640","襦襤襭襪襯襴襷襾覃覈覊覓覘覡覩覦覬覯覲覺覽覿觀觚觜觝觧觴觸訃訖訐訌訛訝訥訶詁詛詒詆詈詼詭詬詢誅誂誄誨誡誑誥誦誚誣諄諍諂諚諫諳諧"],
["e680","諤諱謔諠諢諷諞諛謌謇謚諡謖謐謗謠謳鞫謦謫謾謨譁譌譏譎證譖譛譚譫譟譬譯譴譽讀讌讎讒讓讖讙讚谺豁谿豈豌豎豐豕豢豬豸豺貂貉貅貊貍貎貔豼貘戝貭貪貽貲貳貮貶賈賁賤賣賚賽賺賻贄贅贊贇贏贍贐齎贓賍贔贖赧赭赱赳趁趙跂趾趺跏跚跖跌跛跋跪跫跟跣跼踈踉跿踝踞踐踟蹂踵踰踴蹊"],
["e740","蹇蹉蹌蹐蹈蹙蹤蹠踪蹣蹕蹶蹲蹼躁躇躅躄躋躊躓躑躔躙躪躡躬躰軆躱躾軅軈軋軛軣軼軻軫軾輊輅輕輒輙輓輜輟輛輌輦輳輻輹轅轂輾轌轉轆轎轗轜"],
["e780","轢轣轤辜辟辣辭辯辷迚迥迢迪迯邇迴逅迹迺逑逕逡逍逞逖逋逧逶逵逹迸遏遐遑遒逎遉逾遖遘遞遨遯遶隨遲邂遽邁邀邊邉邏邨邯邱邵郢郤扈郛鄂鄒鄙鄲鄰酊酖酘酣酥酩酳酲醋醉醂醢醫醯醪醵醴醺釀釁釉釋釐釖釟釡釛釼釵釶鈞釿鈔鈬鈕鈑鉞鉗鉅鉉鉤鉈銕鈿鉋鉐銜銖銓銛鉚鋏銹銷鋩錏鋺鍄錮"],
["e840","錙錢錚錣錺錵錻鍜鍠鍼鍮鍖鎰鎬鎭鎔鎹鏖鏗鏨鏥鏘鏃鏝鏐鏈鏤鐚鐔鐓鐃鐇鐐鐶鐫鐵鐡鐺鑁鑒鑄鑛鑠鑢鑞鑪鈩鑰鑵鑷鑽鑚鑼鑾钁鑿閂閇閊閔閖閘閙"],
["e880","閠閨閧閭閼閻閹閾闊濶闃闍闌闕闔闖關闡闥闢阡阨阮阯陂陌陏陋陷陜陞陝陟陦陲陬隍隘隕隗險隧隱隲隰隴隶隸隹雎雋雉雍襍雜霍雕雹霄霆霈霓霎霑霏霖霙霤霪霰霹霽霾靄靆靈靂靉靜靠靤靦靨勒靫靱靹鞅靼鞁靺鞆鞋鞏鞐鞜鞨鞦鞣鞳鞴韃韆韈韋韜韭齏韲竟韶韵頏頌頸頤頡頷頽顆顏顋顫顯顰"],
["e940","顱顴顳颪颯颱颶飄飃飆飩飫餃餉餒餔餘餡餝餞餤餠餬餮餽餾饂饉饅饐饋饑饒饌饕馗馘馥馭馮馼駟駛駝駘駑駭駮駱駲駻駸騁騏騅駢騙騫騷驅驂驀驃"],
["e980","騾驕驍驛驗驟驢驥驤驩驫驪骭骰骼髀髏髑髓體髞髟髢髣髦髯髫髮髴髱髷髻鬆鬘鬚鬟鬢鬣鬥鬧鬨鬩鬪鬮鬯鬲魄魃魏魍魎魑魘魴鮓鮃鮑鮖鮗鮟鮠鮨鮴鯀鯊鮹鯆鯏鯑鯒鯣鯢鯤鯔鯡鰺鯲鯱鯰鰕鰔鰉鰓鰌鰆鰈鰒鰊鰄鰮鰛鰥鰤鰡鰰鱇鰲鱆鰾鱚鱠鱧鱶鱸鳧鳬鳰鴉鴈鳫鴃鴆鴪鴦鶯鴣鴟鵄鴕鴒鵁鴿鴾鵆鵈"],
["ea40","鵝鵞鵤鵑鵐鵙鵲鶉鶇鶫鵯鵺鶚鶤鶩鶲鷄鷁鶻鶸鶺鷆鷏鷂鷙鷓鷸鷦鷭鷯鷽鸚鸛鸞鹵鹹鹽麁麈麋麌麒麕麑麝麥麩麸麪麭靡黌黎黏黐黔黜點黝黠黥黨黯"],
["ea80","黴黶黷黹黻黼黽鼇鼈皷鼕鼡鼬鼾齊齒齔齣齟齠齡齦齧齬齪齷齲齶龕龜龠堯槇遙瑤凜熙"],
["ed40","纊褜鍈銈蓜俉炻昱棈鋹曻彅丨仡仼伀伃伹佖侒侊侚侔俍偀倢俿倞偆偰偂傔僴僘兊兤冝冾凬刕劜劦勀勛匀匇匤卲厓厲叝﨎咜咊咩哿喆坙坥垬埈埇﨏"],
["ed80","塚增墲夋奓奛奝奣妤妺孖寀甯寘寬尞岦岺峵崧嵓﨑嵂嵭嶸嶹巐弡弴彧德忞恝悅悊惞惕愠惲愑愷愰憘戓抦揵摠撝擎敎昀昕昻昉昮昞昤晥晗晙晴晳暙暠暲暿曺朎朗杦枻桒柀栁桄棏﨓楨﨔榘槢樰橫橆橳橾櫢櫤毖氿汜沆汯泚洄涇浯涖涬淏淸淲淼渹湜渧渼溿澈澵濵瀅瀇瀨炅炫焏焄煜煆煇凞燁燾犱"],
["ee40","犾猤猪獷玽珉珖珣珒琇珵琦琪琩琮瑢璉璟甁畯皂皜皞皛皦益睆劯砡硎硤硺礰礼神祥禔福禛竑竧靖竫箞精絈絜綷綠緖繒罇羡羽茁荢荿菇菶葈蒴蕓蕙"],
["ee80","蕫﨟薰蘒﨡蠇裵訒訷詹誧誾諟諸諶譓譿賰賴贒赶﨣軏﨤逸遧郞都鄕鄧釚釗釞釭釮釤釥鈆鈐鈊鈺鉀鈼鉎鉙鉑鈹鉧銧鉷鉸鋧鋗鋙鋐﨧鋕鋠鋓錥錡鋻﨨錞鋿錝錂鍰鍗鎤鏆鏞鏸鐱鑅鑈閒隆﨩隝隯霳霻靃靍靏靑靕顗顥飯飼餧館馞驎髙髜魵魲鮏鮱鮻鰀鵰鵫鶴鸙黑"],
["eeef","ⅰ",9,"￢￤＇＂"],
["f040","",62],
["f080","",124],
["f140","",62],
["f180","",124],
["f240","",62],
["f280","",124],
["f340","",62],
["f380","",124],
["f440","",62],
["f480","",124],
["f540","",62],
["f580","",124],
["f640","",62],
["f680","",124],
["f740","",62],
["f780","",124],
["f840","",62],
["f880","",124],
["f940",""],
["fa40","ⅰ",9,"Ⅰ",9,"￢￤＇＂㈱№℡∵纊褜鍈銈蓜俉炻昱棈鋹曻彅丨仡仼伀伃伹佖侒侊侚侔俍偀倢俿倞偆偰偂傔僴僘兊"],
["fa80","兤冝冾凬刕劜劦勀勛匀匇匤卲厓厲叝﨎咜咊咩哿喆坙坥垬埈埇﨏塚增墲夋奓奛奝奣妤妺孖寀甯寘寬尞岦岺峵崧嵓﨑嵂嵭嶸嶹巐弡弴彧德忞恝悅悊惞惕愠惲愑愷愰憘戓抦揵摠撝擎敎昀昕昻昉昮昞昤晥晗晙晴晳暙暠暲暿曺朎朗杦枻桒柀栁桄棏﨓楨﨔榘槢樰橫橆橳橾櫢櫤毖氿汜沆汯泚洄涇浯"],
["fb40","涖涬淏淸淲淼渹湜渧渼溿澈澵濵瀅瀇瀨炅炫焏焄煜煆煇凞燁燾犱犾猤猪獷玽珉珖珣珒琇珵琦琪琩琮瑢璉璟甁畯皂皜皞皛皦益睆劯砡硎硤硺礰礼神"],
["fb80","祥禔福禛竑竧靖竫箞精絈絜綷綠緖繒罇羡羽茁荢荿菇菶葈蒴蕓蕙蕫﨟薰蘒﨡蠇裵訒訷詹誧誾諟諸諶譓譿賰賴贒赶﨣軏﨤逸遧郞都鄕鄧釚釗釞釭釮釤釥鈆鈐鈊鈺鉀鈼鉎鉙鉑鈹鉧銧鉷鉸鋧鋗鋙鋐﨧鋕鋠鋓錥錡鋻﨨錞鋿錝錂鍰鍗鎤鏆鏞鏸鐱鑅鑈閒隆﨩隝隯霳霻靃靍靏靑靕顗顥飯飼餧館馞驎髙"],
["fc40","髜魵魲鮏鮱鮻鰀鵰鵫鶴鸙黑"]
]

},{}],39:[function(require,module,exports){
"use strict";
var Buffer = require("safer-buffer").Buffer;

// Note: UTF16-LE (or UCS2) codec is Node.js native. See encodings/internal.js

// == UTF16-BE codec. ==========================================================

exports.utf16be = Utf16BECodec;
function Utf16BECodec() {
}

Utf16BECodec.prototype.encoder = Utf16BEEncoder;
Utf16BECodec.prototype.decoder = Utf16BEDecoder;
Utf16BECodec.prototype.bomAware = true;


// -- Encoding

function Utf16BEEncoder() {
}

Utf16BEEncoder.prototype.write = function(str) {
    var buf = Buffer.from(str, 'ucs2');
    for (var i = 0; i < buf.length; i += 2) {
        var tmp = buf[i]; buf[i] = buf[i+1]; buf[i+1] = tmp;
    }
    return buf;
}

Utf16BEEncoder.prototype.end = function() {
}


// -- Decoding

function Utf16BEDecoder() {
    this.overflowByte = -1;
}

Utf16BEDecoder.prototype.write = function(buf) {
    if (buf.length == 0)
        return '';

    var buf2 = Buffer.alloc(buf.length + 1),
        i = 0, j = 0;

    if (this.overflowByte !== -1) {
        buf2[0] = buf[0];
        buf2[1] = this.overflowByte;
        i = 1; j = 2;
    }

    for (; i < buf.length-1; i += 2, j+= 2) {
        buf2[j] = buf[i+1];
        buf2[j+1] = buf[i];
    }

    this.overflowByte = (i == buf.length-1) ? buf[buf.length-1] : -1;

    return buf2.slice(0, j).toString('ucs2');
}

Utf16BEDecoder.prototype.end = function() {
    this.overflowByte = -1;
}


// == UTF-16 codec =============================================================
// Decoder chooses automatically from UTF-16LE and UTF-16BE using BOM and space-based heuristic.
// Defaults to UTF-16LE, as it's prevalent and default in Node.
// http://en.wikipedia.org/wiki/UTF-16 and http://encoding.spec.whatwg.org/#utf-16le
// Decoder default can be changed: iconv.decode(buf, 'utf16', {defaultEncoding: 'utf-16be'});

// Encoder uses UTF-16LE and prepends BOM (which can be overridden with addBOM: false).

exports.utf16 = Utf16Codec;
function Utf16Codec(codecOptions, iconv) {
    this.iconv = iconv;
}

Utf16Codec.prototype.encoder = Utf16Encoder;
Utf16Codec.prototype.decoder = Utf16Decoder;


// -- Encoding (pass-through)

function Utf16Encoder(options, codec) {
    options = options || {};
    if (options.addBOM === undefined)
        options.addBOM = true;
    this.encoder = codec.iconv.getEncoder('utf-16le', options);
}

Utf16Encoder.prototype.write = function(str) {
    return this.encoder.write(str);
}

Utf16Encoder.prototype.end = function() {
    return this.encoder.end();
}


// -- Decoding

function Utf16Decoder(options, codec) {
    this.decoder = null;
    this.initialBufs = [];
    this.initialBufsLen = 0;

    this.options = options || {};
    this.iconv = codec.iconv;
}

Utf16Decoder.prototype.write = function(buf) {
    if (!this.decoder) {
        // Codec is not chosen yet. Accumulate initial bytes.
        this.initialBufs.push(buf);
        this.initialBufsLen += buf.length;
        
        if (this.initialBufsLen < 16) // We need more bytes to use space heuristic (see below)
            return '';

        // We have enough bytes -> detect endianness.
        var encoding = detectEncoding(this.initialBufs, this.options.defaultEncoding);
        this.decoder = this.iconv.getDecoder(encoding, this.options);

        var resStr = '';
        for (var i = 0; i < this.initialBufs.length; i++)
            resStr += this.decoder.write(this.initialBufs[i]);

        this.initialBufs.length = this.initialBufsLen = 0;
        return resStr;
    }

    return this.decoder.write(buf);
}

Utf16Decoder.prototype.end = function() {
    if (!this.decoder) {
        var encoding = detectEncoding(this.initialBufs, this.options.defaultEncoding);
        this.decoder = this.iconv.getDecoder(encoding, this.options);

        var resStr = '';
        for (var i = 0; i < this.initialBufs.length; i++)
            resStr += this.decoder.write(this.initialBufs[i]);

        var trail = this.decoder.end();
        if (trail)
            resStr += trail;

        this.initialBufs.length = this.initialBufsLen = 0;
        return resStr;
    }
    return this.decoder.end();
}

function detectEncoding(bufs, defaultEncoding) {
    var b = [];
    var charsProcessed = 0;
    var asciiCharsLE = 0, asciiCharsBE = 0; // Number of ASCII chars when decoded as LE or BE.

    outer_loop:
    for (var i = 0; i < bufs.length; i++) {
        var buf = bufs[i];
        for (var j = 0; j < buf.length; j++) {
            b.push(buf[j]);
            if (b.length === 2) {
                if (charsProcessed === 0) {
                    // Check BOM first.
                    if (b[0] === 0xFF && b[1] === 0xFE) return 'utf-16le';
                    if (b[0] === 0xFE && b[1] === 0xFF) return 'utf-16be';
                }

                if (b[0] === 0 && b[1] !== 0) asciiCharsBE++;
                if (b[0] !== 0 && b[1] === 0) asciiCharsLE++;

                b.length = 0;
                charsProcessed++;

                if (charsProcessed >= 100) {
                    break outer_loop;
                }
            }
        }
    }

    // Make decisions.
    // Most of the time, the content has ASCII chars (U+00**), but the opposite (U+**00) is uncommon.
    // So, we count ASCII as if it was LE or BE, and decide from that.
    if (asciiCharsBE > asciiCharsLE) return 'utf-16be';
    if (asciiCharsBE < asciiCharsLE) return 'utf-16le';

    // Couldn't decide (likely all zeros or not enough data).
    return defaultEncoding || 'utf-16le';
}



},{"safer-buffer":49}],40:[function(require,module,exports){
'use strict';

var Buffer = require('safer-buffer').Buffer;

// == UTF32-LE/BE codec. ==========================================================

exports._utf32 = Utf32Codec;

function Utf32Codec(codecOptions, iconv) {
    this.iconv = iconv;
    this.bomAware = true;
    this.isLE = codecOptions.isLE;
}

exports.utf32le = { type: '_utf32', isLE: true };
exports.utf32be = { type: '_utf32', isLE: false };

// Aliases
exports.ucs4le = 'utf32le';
exports.ucs4be = 'utf32be';

Utf32Codec.prototype.encoder = Utf32Encoder;
Utf32Codec.prototype.decoder = Utf32Decoder;

// -- Encoding

function Utf32Encoder(options, codec) {
    this.isLE = codec.isLE;
    this.highSurrogate = 0;
}

Utf32Encoder.prototype.write = function(str) {
    var src = Buffer.from(str, 'ucs2');
    var dst = Buffer.alloc(src.length * 2);
    var write32 = this.isLE ? dst.writeUInt32LE : dst.writeUInt32BE;
    var offset = 0;

    for (var i = 0; i < src.length; i += 2) {
        var code = src.readUInt16LE(i);
        var isHighSurrogate = (0xD800 <= code && code < 0xDC00);
        var isLowSurrogate = (0xDC00 <= code && code < 0xE000);

        if (this.highSurrogate) {
            if (isHighSurrogate || !isLowSurrogate) {
                // There shouldn't be two high surrogates in a row, nor a high surrogate which isn't followed by a low
                // surrogate. If this happens, keep the pending high surrogate as a stand-alone semi-invalid character
                // (technically wrong, but expected by some applications, like Windows file names).
                write32.call(dst, this.highSurrogate, offset);
                offset += 4;
            }
            else {
                // Create 32-bit value from high and low surrogates;
                var codepoint = (((this.highSurrogate - 0xD800) << 10) | (code - 0xDC00)) + 0x10000;

                write32.call(dst, codepoint, offset);
                offset += 4;
                this.highSurrogate = 0;

                continue;
            }
        }

        if (isHighSurrogate)
            this.highSurrogate = code;
        else {
            // Even if the current character is a low surrogate, with no previous high surrogate, we'll
            // encode it as a semi-invalid stand-alone character for the same reasons expressed above for
            // unpaired high surrogates.
            write32.call(dst, code, offset);
            offset += 4;
            this.highSurrogate = 0;
        }
    }

    if (offset < dst.length)
        dst = dst.slice(0, offset);

    return dst;
};

Utf32Encoder.prototype.end = function() {
    // Treat any leftover high surrogate as a semi-valid independent character.
    if (!this.highSurrogate)
        return;

    var buf = Buffer.alloc(4);

    if (this.isLE)
        buf.writeUInt32LE(this.highSurrogate, 0);
    else
        buf.writeUInt32BE(this.highSurrogate, 0);

    this.highSurrogate = 0;

    return buf;
};

// -- Decoding

function Utf32Decoder(options, codec) {
    this.isLE = codec.isLE;
    this.badChar = codec.iconv.defaultCharUnicode.charCodeAt(0);
    this.overflow = [];
}

Utf32Decoder.prototype.write = function(src) {
    if (src.length === 0)
        return '';

    var i = 0;
    var codepoint = 0;
    var dst = Buffer.alloc(src.length + 4);
    var offset = 0;
    var isLE = this.isLE;
    var overflow = this.overflow;
    var badChar = this.badChar;

    if (overflow.length > 0) {
        for (; i < src.length && overflow.length < 4; i++)
            overflow.push(src[i]);
        
        if (overflow.length === 4) {
            // NOTE: codepoint is a signed int32 and can be negative.
            // NOTE: We copied this block from below to help V8 optimize it (it works with array, not buffer).
            if (isLE) {
                codepoint = overflow[i] | (overflow[i+1] << 8) | (overflow[i+2] << 16) | (overflow[i+3] << 24);
            } else {
                codepoint = overflow[i+3] | (overflow[i+2] << 8) | (overflow[i+1] << 16) | (overflow[i] << 24);
            }
            overflow.length = 0;

            offset = _writeCodepoint(dst, offset, codepoint, badChar);
        }
    }

    // Main loop. Should be as optimized as possible.
    for (; i < src.length - 3; i += 4) {
        // NOTE: codepoint is a signed int32 and can be negative.
        if (isLE) {
            codepoint = src[i] | (src[i+1] << 8) | (src[i+2] << 16) | (src[i+3] << 24);
        } else {
            codepoint = src[i+3] | (src[i+2] << 8) | (src[i+1] << 16) | (src[i] << 24);
        }
        offset = _writeCodepoint(dst, offset, codepoint, badChar);
    }

    // Keep overflowing bytes.
    for (; i < src.length; i++) {
        overflow.push(src[i]);
    }

    return dst.slice(0, offset).toString('ucs2');
};

function _writeCodepoint(dst, offset, codepoint, badChar) {
    // NOTE: codepoint is signed int32 and can be negative. We keep it that way to help V8 with optimizations.
    if (codepoint < 0 || codepoint > 0x10FFFF) {
        // Not a valid Unicode codepoint
        codepoint = badChar;
    } 

    // Ephemeral Planes: Write high surrogate.
    if (codepoint >= 0x10000) {
        codepoint -= 0x10000;

        var high = 0xD800 | (codepoint >> 10);
        dst[offset++] = high & 0xff;
        dst[offset++] = high >> 8;

        // Low surrogate is written below.
        var codepoint = 0xDC00 | (codepoint & 0x3FF);
    }

    // Write BMP char or low surrogate.
    dst[offset++] = codepoint & 0xff;
    dst[offset++] = codepoint >> 8;

    return offset;
};

Utf32Decoder.prototype.end = function() {
    this.overflow.length = 0;
};

// == UTF-32 Auto codec =============================================================
// Decoder chooses automatically from UTF-32LE and UTF-32BE using BOM and space-based heuristic.
// Defaults to UTF-32LE. http://en.wikipedia.org/wiki/UTF-32
// Encoder/decoder default can be changed: iconv.decode(buf, 'utf32', {defaultEncoding: 'utf-32be'});

// Encoder prepends BOM (which can be overridden with (addBOM: false}).

exports.utf32 = Utf32AutoCodec;
exports.ucs4 = 'utf32';

function Utf32AutoCodec(options, iconv) {
    this.iconv = iconv;
}

Utf32AutoCodec.prototype.encoder = Utf32AutoEncoder;
Utf32AutoCodec.prototype.decoder = Utf32AutoDecoder;

// -- Encoding

function Utf32AutoEncoder(options, codec) {
    options = options || {};

    if (options.addBOM === undefined)
        options.addBOM = true;

    this.encoder = codec.iconv.getEncoder(options.defaultEncoding || 'utf-32le', options);
}

Utf32AutoEncoder.prototype.write = function(str) {
    return this.encoder.write(str);
};

Utf32AutoEncoder.prototype.end = function() {
    return this.encoder.end();
};

// -- Decoding

function Utf32AutoDecoder(options, codec) {
    this.decoder = null;
    this.initialBufs = [];
    this.initialBufsLen = 0;
    this.options = options || {};
    this.iconv = codec.iconv;
}

Utf32AutoDecoder.prototype.write = function(buf) {
    if (!this.decoder) { 
        // Codec is not chosen yet. Accumulate initial bytes.
        this.initialBufs.push(buf);
        this.initialBufsLen += buf.length;

        if (this.initialBufsLen < 32) // We need more bytes to use space heuristic (see below)
            return '';

        // We have enough bytes -> detect endianness.
        var encoding = detectEncoding(this.initialBufs, this.options.defaultEncoding);
        this.decoder = this.iconv.getDecoder(encoding, this.options);

        var resStr = '';
        for (var i = 0; i < this.initialBufs.length; i++)
            resStr += this.decoder.write(this.initialBufs[i]);

        this.initialBufs.length = this.initialBufsLen = 0;
        return resStr;
    }

    return this.decoder.write(buf);
};

Utf32AutoDecoder.prototype.end = function() {
    if (!this.decoder) {
        var encoding = detectEncoding(this.initialBufs, this.options.defaultEncoding);
        this.decoder = this.iconv.getDecoder(encoding, this.options);

        var resStr = '';
        for (var i = 0; i < this.initialBufs.length; i++)
            resStr += this.decoder.write(this.initialBufs[i]);

        var trail = this.decoder.end();
        if (trail)
            resStr += trail;

        this.initialBufs.length = this.initialBufsLen = 0;
        return resStr;
    }

    return this.decoder.end();
};

function detectEncoding(bufs, defaultEncoding) {
    var b = [];
    var charsProcessed = 0;
    var invalidLE = 0, invalidBE = 0;   // Number of invalid chars when decoded as LE or BE.
    var bmpCharsLE = 0, bmpCharsBE = 0; // Number of BMP chars when decoded as LE or BE.

    outer_loop:
    for (var i = 0; i < bufs.length; i++) {
        var buf = bufs[i];
        for (var j = 0; j < buf.length; j++) {
            b.push(buf[j]);
            if (b.length === 4) {
                if (charsProcessed === 0) {
                    // Check BOM first.
                    if (b[0] === 0xFF && b[1] === 0xFE && b[2] === 0 && b[3] === 0) {
                        return 'utf-32le';
                    }
                    if (b[0] === 0 && b[1] === 0 && b[2] === 0xFE && b[3] === 0xFF) {
                        return 'utf-32be';
                    }
                }

                if (b[0] !== 0 || b[1] > 0x10) invalidBE++;
                if (b[3] !== 0 || b[2] > 0x10) invalidLE++;

                if (b[0] === 0 && b[1] === 0 && (b[2] !== 0 || b[3] !== 0)) bmpCharsBE++;
                if ((b[0] !== 0 || b[1] !== 0) && b[2] === 0 && b[3] === 0) bmpCharsLE++;

                b.length = 0;
                charsProcessed++;

                if (charsProcessed >= 100) {
                    break outer_loop;
                }
            }
        }
    }

    // Make decisions.
    if (bmpCharsBE - invalidBE > bmpCharsLE - invalidLE)  return 'utf-32be';
    if (bmpCharsBE - invalidBE < bmpCharsLE - invalidLE)  return 'utf-32le';

    // Couldn't decide (likely all zeros or not enough data).
    return defaultEncoding || 'utf-32le';
}

},{"safer-buffer":49}],41:[function(require,module,exports){
"use strict";
var Buffer = require("safer-buffer").Buffer;

// UTF-7 codec, according to https://tools.ietf.org/html/rfc2152
// See also below a UTF-7-IMAP codec, according to http://tools.ietf.org/html/rfc3501#section-5.1.3

exports.utf7 = Utf7Codec;
exports.unicode11utf7 = 'utf7'; // Alias UNICODE-1-1-UTF-7
function Utf7Codec(codecOptions, iconv) {
    this.iconv = iconv;
};

Utf7Codec.prototype.encoder = Utf7Encoder;
Utf7Codec.prototype.decoder = Utf7Decoder;
Utf7Codec.prototype.bomAware = true;


// -- Encoding

var nonDirectChars = /[^A-Za-z0-9'\(\),-\.\/:\? \n\r\t]+/g;

function Utf7Encoder(options, codec) {
    this.iconv = codec.iconv;
}

Utf7Encoder.prototype.write = function(str) {
    // Naive implementation.
    // Non-direct chars are encoded as "+<base64>-"; single "+" char is encoded as "+-".
    return Buffer.from(str.replace(nonDirectChars, function(chunk) {
        return "+" + (chunk === '+' ? '' : 
            this.iconv.encode(chunk, 'utf16-be').toString('base64').replace(/=+$/, '')) 
            + "-";
    }.bind(this)));
}

Utf7Encoder.prototype.end = function() {
}


// -- Decoding

function Utf7Decoder(options, codec) {
    this.iconv = codec.iconv;
    this.inBase64 = false;
    this.base64Accum = '';
}

var base64Regex = /[A-Za-z0-9\/+]/;
var base64Chars = [];
for (var i = 0; i < 256; i++)
    base64Chars[i] = base64Regex.test(String.fromCharCode(i));

var plusChar = '+'.charCodeAt(0), 
    minusChar = '-'.charCodeAt(0),
    andChar = '&'.charCodeAt(0);

Utf7Decoder.prototype.write = function(buf) {
    var res = "", lastI = 0,
        inBase64 = this.inBase64,
        base64Accum = this.base64Accum;

    // The decoder is more involved as we must handle chunks in stream.

    for (var i = 0; i < buf.length; i++) {
        if (!inBase64) { // We're in direct mode.
            // Write direct chars until '+'
            if (buf[i] == plusChar) {
                res += this.iconv.decode(buf.slice(lastI, i), "ascii"); // Write direct chars.
                lastI = i+1;
                inBase64 = true;
            }
        } else { // We decode base64.
            if (!base64Chars[buf[i]]) { // Base64 ended.
                if (i == lastI && buf[i] == minusChar) {// "+-" -> "+"
                    res += "+";
                } else {
                    var b64str = base64Accum + this.iconv.decode(buf.slice(lastI, i), "ascii");
                    res += this.iconv.decode(Buffer.from(b64str, 'base64'), "utf16-be");
                }

                if (buf[i] != minusChar) // Minus is absorbed after base64.
                    i--;

                lastI = i+1;
                inBase64 = false;
                base64Accum = '';
            }
        }
    }

    if (!inBase64) {
        res += this.iconv.decode(buf.slice(lastI), "ascii"); // Write direct chars.
    } else {
        var b64str = base64Accum + this.iconv.decode(buf.slice(lastI), "ascii");

        var canBeDecoded = b64str.length - (b64str.length % 8); // Minimal chunk: 2 quads -> 2x3 bytes -> 3 chars.
        base64Accum = b64str.slice(canBeDecoded); // The rest will be decoded in future.
        b64str = b64str.slice(0, canBeDecoded);

        res += this.iconv.decode(Buffer.from(b64str, 'base64'), "utf16-be");
    }

    this.inBase64 = inBase64;
    this.base64Accum = base64Accum;

    return res;
}

Utf7Decoder.prototype.end = function() {
    var res = "";
    if (this.inBase64 && this.base64Accum.length > 0)
        res = this.iconv.decode(Buffer.from(this.base64Accum, 'base64'), "utf16-be");

    this.inBase64 = false;
    this.base64Accum = '';
    return res;
}


// UTF-7-IMAP codec.
// RFC3501 Sec. 5.1.3 Modified UTF-7 (http://tools.ietf.org/html/rfc3501#section-5.1.3)
// Differences:
//  * Base64 part is started by "&" instead of "+"
//  * Direct characters are 0x20-0x7E, except "&" (0x26)
//  * In Base64, "," is used instead of "/"
//  * Base64 must not be used to represent direct characters.
//  * No implicit shift back from Base64 (should always end with '-')
//  * String must end in non-shifted position.
//  * "-&" while in base64 is not allowed.


exports.utf7imap = Utf7IMAPCodec;
function Utf7IMAPCodec(codecOptions, iconv) {
    this.iconv = iconv;
};

Utf7IMAPCodec.prototype.encoder = Utf7IMAPEncoder;
Utf7IMAPCodec.prototype.decoder = Utf7IMAPDecoder;
Utf7IMAPCodec.prototype.bomAware = true;


// -- Encoding

function Utf7IMAPEncoder(options, codec) {
    this.iconv = codec.iconv;
    this.inBase64 = false;
    this.base64Accum = Buffer.alloc(6);
    this.base64AccumIdx = 0;
}

Utf7IMAPEncoder.prototype.write = function(str) {
    var inBase64 = this.inBase64,
        base64Accum = this.base64Accum,
        base64AccumIdx = this.base64AccumIdx,
        buf = Buffer.alloc(str.length*5 + 10), bufIdx = 0;

    for (var i = 0; i < str.length; i++) {
        var uChar = str.charCodeAt(i);
        if (0x20 <= uChar && uChar <= 0x7E) { // Direct character or '&'.
            if (inBase64) {
                if (base64AccumIdx > 0) {
                    bufIdx += buf.write(base64Accum.slice(0, base64AccumIdx).toString('base64').replace(/\//g, ',').replace(/=+$/, ''), bufIdx);
                    base64AccumIdx = 0;
                }

                buf[bufIdx++] = minusChar; // Write '-', then go to direct mode.
                inBase64 = false;
            }

            if (!inBase64) {
                buf[bufIdx++] = uChar; // Write direct character

                if (uChar === andChar)  // Ampersand -> '&-'
                    buf[bufIdx++] = minusChar;
            }

        } else { // Non-direct character
            if (!inBase64) {
                buf[bufIdx++] = andChar; // Write '&', then go to base64 mode.
                inBase64 = true;
            }
            if (inBase64) {
                base64Accum[base64AccumIdx++] = uChar >> 8;
                base64Accum[base64AccumIdx++] = uChar & 0xFF;

                if (base64AccumIdx == base64Accum.length) {
                    bufIdx += buf.write(base64Accum.toString('base64').replace(/\//g, ','), bufIdx);
                    base64AccumIdx = 0;
                }
            }
        }
    }

    this.inBase64 = inBase64;
    this.base64AccumIdx = base64AccumIdx;

    return buf.slice(0, bufIdx);
}

Utf7IMAPEncoder.prototype.end = function() {
    var buf = Buffer.alloc(10), bufIdx = 0;
    if (this.inBase64) {
        if (this.base64AccumIdx > 0) {
            bufIdx += buf.write(this.base64Accum.slice(0, this.base64AccumIdx).toString('base64').replace(/\//g, ',').replace(/=+$/, ''), bufIdx);
            this.base64AccumIdx = 0;
        }

        buf[bufIdx++] = minusChar; // Write '-', then go to direct mode.
        this.inBase64 = false;
    }

    return buf.slice(0, bufIdx);
}


// -- Decoding

function Utf7IMAPDecoder(options, codec) {
    this.iconv = codec.iconv;
    this.inBase64 = false;
    this.base64Accum = '';
}

var base64IMAPChars = base64Chars.slice();
base64IMAPChars[','.charCodeAt(0)] = true;

Utf7IMAPDecoder.prototype.write = function(buf) {
    var res = "", lastI = 0,
        inBase64 = this.inBase64,
        base64Accum = this.base64Accum;

    // The decoder is more involved as we must handle chunks in stream.
    // It is forgiving, closer to standard UTF-7 (for example, '-' is optional at the end).

    for (var i = 0; i < buf.length; i++) {
        if (!inBase64) { // We're in direct mode.
            // Write direct chars until '&'
            if (buf[i] == andChar) {
                res += this.iconv.decode(buf.slice(lastI, i), "ascii"); // Write direct chars.
                lastI = i+1;
                inBase64 = true;
            }
        } else { // We decode base64.
            if (!base64IMAPChars[buf[i]]) { // Base64 ended.
                if (i == lastI && buf[i] == minusChar) { // "&-" -> "&"
                    res += "&";
                } else {
                    var b64str = base64Accum + this.iconv.decode(buf.slice(lastI, i), "ascii").replace(/,/g, '/');
                    res += this.iconv.decode(Buffer.from(b64str, 'base64'), "utf16-be");
                }

                if (buf[i] != minusChar) // Minus may be absorbed after base64.
                    i--;

                lastI = i+1;
                inBase64 = false;
                base64Accum = '';
            }
        }
    }

    if (!inBase64) {
        res += this.iconv.decode(buf.slice(lastI), "ascii"); // Write direct chars.
    } else {
        var b64str = base64Accum + this.iconv.decode(buf.slice(lastI), "ascii").replace(/,/g, '/');

        var canBeDecoded = b64str.length - (b64str.length % 8); // Minimal chunk: 2 quads -> 2x3 bytes -> 3 chars.
        base64Accum = b64str.slice(canBeDecoded); // The rest will be decoded in future.
        b64str = b64str.slice(0, canBeDecoded);

        res += this.iconv.decode(Buffer.from(b64str, 'base64'), "utf16-be");
    }

    this.inBase64 = inBase64;
    this.base64Accum = base64Accum;

    return res;
}

Utf7IMAPDecoder.prototype.end = function() {
    var res = "";
    if (this.inBase64 && this.base64Accum.length > 0)
        res = this.iconv.decode(Buffer.from(this.base64Accum, 'base64'), "utf16-be");

    this.inBase64 = false;
    this.base64Accum = '';
    return res;
}



},{"safer-buffer":49}],42:[function(require,module,exports){
"use strict";

var BOMChar = '\uFEFF';

exports.PrependBOM = PrependBOMWrapper
function PrependBOMWrapper(encoder, options) {
    this.encoder = encoder;
    this.addBOM = true;
}

PrependBOMWrapper.prototype.write = function(str) {
    if (this.addBOM) {
        str = BOMChar + str;
        this.addBOM = false;
    }

    return this.encoder.write(str);
}

PrependBOMWrapper.prototype.end = function() {
    return this.encoder.end();
}


//------------------------------------------------------------------------------

exports.StripBOM = StripBOMWrapper;
function StripBOMWrapper(decoder, options) {
    this.decoder = decoder;
    this.pass = false;
    this.options = options || {};
}

StripBOMWrapper.prototype.write = function(buf) {
    var res = this.decoder.write(buf);
    if (this.pass || !res)
        return res;

    if (res[0] === BOMChar) {
        res = res.slice(1);
        if (typeof this.options.stripBOM === 'function')
            this.options.stripBOM();
    }

    this.pass = true;
    return res;
}

StripBOMWrapper.prototype.end = function() {
    return this.decoder.end();
}


},{}],43:[function(require,module,exports){
"use strict";

var Buffer = require("safer-buffer").Buffer;

var bomHandling = require("./bom-handling"),
    iconv = module.exports;

// All codecs and aliases are kept here, keyed by encoding name/alias.
// They are lazy loaded in `iconv.getCodec` from `encodings/index.js`.
iconv.encodings = null;

// Characters emitted in case of error.
iconv.defaultCharUnicode = '�';
iconv.defaultCharSingleByte = '?';

// Public API.
iconv.encode = function encode(str, encoding, options) {
    str = "" + (str || ""); // Ensure string.

    var encoder = iconv.getEncoder(encoding, options);

    var res = encoder.write(str);
    var trail = encoder.end();
    
    return (trail && trail.length > 0) ? Buffer.concat([res, trail]) : res;
}

iconv.decode = function decode(buf, encoding, options) {
    if (typeof buf === 'string') {
        if (!iconv.skipDecodeWarning) {
            console.error('Iconv-lite warning: decode()-ing strings is deprecated. Refer to https://github.com/ashtuchkin/iconv-lite/wiki/Use-Buffers-when-decoding');
            iconv.skipDecodeWarning = true;
        }

        buf = Buffer.from("" + (buf || ""), "binary"); // Ensure buffer.
    }

    var decoder = iconv.getDecoder(encoding, options);

    var res = decoder.write(buf);
    var trail = decoder.end();

    return trail ? (res + trail) : res;
}

iconv.encodingExists = function encodingExists(enc) {
    try {
        iconv.getCodec(enc);
        return true;
    } catch (e) {
        return false;
    }
}

// Legacy aliases to convert functions
iconv.toEncoding = iconv.encode;
iconv.fromEncoding = iconv.decode;

// Search for a codec in iconv.encodings. Cache codec data in iconv._codecDataCache.
iconv._codecDataCache = {};
iconv.getCodec = function getCodec(encoding) {
    if (!iconv.encodings)
        iconv.encodings = require("../encodings"); // Lazy load all encoding definitions.
    
    // Canonicalize encoding name: strip all non-alphanumeric chars and appended year.
    var enc = iconv._canonicalizeEncoding(encoding);

    // Traverse iconv.encodings to find actual codec.
    var codecOptions = {};
    while (true) {
        var codec = iconv._codecDataCache[enc];
        if (codec)
            return codec;

        var codecDef = iconv.encodings[enc];

        switch (typeof codecDef) {
            case "string": // Direct alias to other encoding.
                enc = codecDef;
                break;

            case "object": // Alias with options. Can be layered.
                for (var key in codecDef)
                    codecOptions[key] = codecDef[key];

                if (!codecOptions.encodingName)
                    codecOptions.encodingName = enc;
                
                enc = codecDef.type;
                break;

            case "function": // Codec itself.
                if (!codecOptions.encodingName)
                    codecOptions.encodingName = enc;

                // The codec function must load all tables and return object with .encoder and .decoder methods.
                // It'll be called only once (for each different options object).
                codec = new codecDef(codecOptions, iconv);

                iconv._codecDataCache[codecOptions.encodingName] = codec; // Save it to be reused later.
                return codec;

            default:
                throw new Error("Encoding not recognized: '" + encoding + "' (searched as: '"+enc+"')");
        }
    }
}

iconv._canonicalizeEncoding = function(encoding) {
    // Canonicalize encoding name: strip all non-alphanumeric chars and appended year.
    return (''+encoding).toLowerCase().replace(/:\d{4}$|[^0-9a-z]/g, "");
}

iconv.getEncoder = function getEncoder(encoding, options) {
    var codec = iconv.getCodec(encoding),
        encoder = new codec.encoder(options, codec);

    if (codec.bomAware && options && options.addBOM)
        encoder = new bomHandling.PrependBOM(encoder, options);

    return encoder;
}

iconv.getDecoder = function getDecoder(encoding, options) {
    var codec = iconv.getCodec(encoding),
        decoder = new codec.decoder(options, codec);

    if (codec.bomAware && !(options && options.stripBOM === false))
        decoder = new bomHandling.StripBOM(decoder, options);

    return decoder;
}

// Streaming API
// NOTE: Streaming API naturally depends on 'stream' module from Node.js. Unfortunately in browser environments this module can add
// up to 100Kb to the output bundle. To avoid unnecessary code bloat, we don't enable Streaming API in browser by default.
// If you would like to enable it explicitly, please add the following code to your app:
// > iconv.enableStreamingAPI(require('stream'));
iconv.enableStreamingAPI = function enableStreamingAPI(stream_module) {
    if (iconv.supportsStreams)
        return;

    // Dependency-inject stream module to create IconvLite stream classes.
    var streams = require("./streams")(stream_module);

    // Not public API yet, but expose the stream classes.
    iconv.IconvLiteEncoderStream = streams.IconvLiteEncoderStream;
    iconv.IconvLiteDecoderStream = streams.IconvLiteDecoderStream;

    // Streaming API.
    iconv.encodeStream = function encodeStream(encoding, options) {
        return new iconv.IconvLiteEncoderStream(iconv.getEncoder(encoding, options), options);
    }

    iconv.decodeStream = function decodeStream(encoding, options) {
        return new iconv.IconvLiteDecoderStream(iconv.getDecoder(encoding, options), options);
    }

    iconv.supportsStreams = true;
}

// Enable Streaming API automatically if 'stream' module is available and non-empty (the majority of environments).
var stream_module;
try {
    stream_module = require("stream");
} catch (e) {}

if (stream_module && stream_module.Transform) {
    iconv.enableStreamingAPI(stream_module);

} else {
    // In rare cases where 'stream' module is not available by default, throw a helpful exception.
    iconv.encodeStream = iconv.decodeStream = function() {
        throw new Error("iconv-lite Streaming API is not enabled. Use iconv.enableStreamingAPI(require('stream')); to enable it.");
    };
}

if ("Ā" != "\u0100") {
    console.error("iconv-lite warning: js files use non-utf8 encoding. See https://github.com/ashtuchkin/iconv-lite/wiki/Javascript-source-file-encodings for more info.");
}

},{"../encodings":26,"./bom-handling":42,"./streams":44,"safer-buffer":49,"stream":undefined}],44:[function(require,module,exports){
"use strict";

var Buffer = require("safer-buffer").Buffer;

// NOTE: Due to 'stream' module being pretty large (~100Kb, significant in browser environments), 
// we opt to dependency-inject it instead of creating a hard dependency.
module.exports = function(stream_module) {
    var Transform = stream_module.Transform;

    // == Encoder stream =======================================================

    function IconvLiteEncoderStream(conv, options) {
        this.conv = conv;
        options = options || {};
        options.decodeStrings = false; // We accept only strings, so we don't need to decode them.
        Transform.call(this, options);
    }

    IconvLiteEncoderStream.prototype = Object.create(Transform.prototype, {
        constructor: { value: IconvLiteEncoderStream }
    });

    IconvLiteEncoderStream.prototype._transform = function(chunk, encoding, done) {
        if (typeof chunk != 'string')
            return done(new Error("Iconv encoding stream needs strings as its input."));
        try {
            var res = this.conv.write(chunk);
            if (res && res.length) this.push(res);
            done();
        }
        catch (e) {
            done(e);
        }
    }

    IconvLiteEncoderStream.prototype._flush = function(done) {
        try {
            var res = this.conv.end();
            if (res && res.length) this.push(res);
            done();
        }
        catch (e) {
            done(e);
        }
    }

    IconvLiteEncoderStream.prototype.collect = function(cb) {
        var chunks = [];
        this.on('error', cb);
        this.on('data', function(chunk) { chunks.push(chunk); });
        this.on('end', function() {
            cb(null, Buffer.concat(chunks));
        });
        return this;
    }


    // == Decoder stream =======================================================

    function IconvLiteDecoderStream(conv, options) {
        this.conv = conv;
        options = options || {};
        options.encoding = this.encoding = 'utf8'; // We output strings.
        Transform.call(this, options);
    }

    IconvLiteDecoderStream.prototype = Object.create(Transform.prototype, {
        constructor: { value: IconvLiteDecoderStream }
    });

    IconvLiteDecoderStream.prototype._transform = function(chunk, encoding, done) {
        if (!Buffer.isBuffer(chunk) && !(chunk instanceof Uint8Array))
            return done(new Error("Iconv decoding stream needs buffers as its input."));
        try {
            var res = this.conv.write(chunk);
            if (res && res.length) this.push(res, this.encoding);
            done();
        }
        catch (e) {
            done(e);
        }
    }

    IconvLiteDecoderStream.prototype._flush = function(done) {
        try {
            var res = this.conv.end();
            if (res && res.length) this.push(res, this.encoding);                
            done();
        }
        catch (e) {
            done(e);
        }
    }

    IconvLiteDecoderStream.prototype.collect = function(cb) {
        var res = '';
        this.on('error', cb);
        this.on('data', function(chunk) { res += chunk; });
        this.on('end', function() {
            cb(null, res);
        });
        return this;
    }

    return {
        IconvLiteEncoderStream: IconvLiteEncoderStream,
        IconvLiteDecoderStream: IconvLiteDecoderStream,
    };
};

},{"safer-buffer":49}],45:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var Stream = _interopDefault(require('stream'));
var http = _interopDefault(require('http'));
var Url = _interopDefault(require('url'));
var whatwgUrl = _interopDefault(require('whatwg-url'));
var https = _interopDefault(require('https'));
var zlib = _interopDefault(require('zlib'));

// Based on https://github.com/tmpvar/jsdom/blob/aa85b2abf07766ff7bf5c1f6daafb3726f2f2db5/lib/jsdom/living/blob.js

// fix for "Readable" isn't a named export issue
const Readable = Stream.Readable;

const BUFFER = Symbol('buffer');
const TYPE = Symbol('type');

class Blob {
	constructor() {
		this[TYPE] = '';

		const blobParts = arguments[0];
		const options = arguments[1];

		const buffers = [];
		let size = 0;

		if (blobParts) {
			const a = blobParts;
			const length = Number(a.length);
			for (let i = 0; i < length; i++) {
				const element = a[i];
				let buffer;
				if (element instanceof Buffer) {
					buffer = element;
				} else if (ArrayBuffer.isView(element)) {
					buffer = Buffer.from(element.buffer, element.byteOffset, element.byteLength);
				} else if (element instanceof ArrayBuffer) {
					buffer = Buffer.from(element);
				} else if (element instanceof Blob) {
					buffer = element[BUFFER];
				} else {
					buffer = Buffer.from(typeof element === 'string' ? element : String(element));
				}
				size += buffer.length;
				buffers.push(buffer);
			}
		}

		this[BUFFER] = Buffer.concat(buffers);

		let type = options && options.type !== undefined && String(options.type).toLowerCase();
		if (type && !/[^\u0020-\u007E]/.test(type)) {
			this[TYPE] = type;
		}
	}
	get size() {
		return this[BUFFER].length;
	}
	get type() {
		return this[TYPE];
	}
	text() {
		return Promise.resolve(this[BUFFER].toString());
	}
	arrayBuffer() {
		const buf = this[BUFFER];
		const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
		return Promise.resolve(ab);
	}
	stream() {
		const readable = new Readable();
		readable._read = function () {};
		readable.push(this[BUFFER]);
		readable.push(null);
		return readable;
	}
	toString() {
		return '[object Blob]';
	}
	slice() {
		const size = this.size;

		const start = arguments[0];
		const end = arguments[1];
		let relativeStart, relativeEnd;
		if (start === undefined) {
			relativeStart = 0;
		} else if (start < 0) {
			relativeStart = Math.max(size + start, 0);
		} else {
			relativeStart = Math.min(start, size);
		}
		if (end === undefined) {
			relativeEnd = size;
		} else if (end < 0) {
			relativeEnd = Math.max(size + end, 0);
		} else {
			relativeEnd = Math.min(end, size);
		}
		const span = Math.max(relativeEnd - relativeStart, 0);

		const buffer = this[BUFFER];
		const slicedBuffer = buffer.slice(relativeStart, relativeStart + span);
		const blob = new Blob([], { type: arguments[2] });
		blob[BUFFER] = slicedBuffer;
		return blob;
	}
}

Object.defineProperties(Blob.prototype, {
	size: { enumerable: true },
	type: { enumerable: true },
	slice: { enumerable: true }
});

Object.defineProperty(Blob.prototype, Symbol.toStringTag, {
	value: 'Blob',
	writable: false,
	enumerable: false,
	configurable: true
});

/**
 * fetch-error.js
 *
 * FetchError interface for operational errors
 */

/**
 * Create FetchError instance
 *
 * @param   String      message      Error message for human
 * @param   String      type         Error type for machine
 * @param   String      systemError  For Node.js system error
 * @return  FetchError
 */
function FetchError(message, type, systemError) {
  Error.call(this, message);

  this.message = message;
  this.type = type;

  // when err.type is `system`, err.code contains system error code
  if (systemError) {
    this.code = this.errno = systemError.code;
  }

  // hide custom error implementation details from end-users
  Error.captureStackTrace(this, this.constructor);
}

FetchError.prototype = Object.create(Error.prototype);
FetchError.prototype.constructor = FetchError;
FetchError.prototype.name = 'FetchError';

let convert;
try {
	convert = require('encoding').convert;
} catch (e) {}

const INTERNALS = Symbol('Body internals');

// fix an issue where "PassThrough" isn't a named export for node <10
const PassThrough = Stream.PassThrough;

/**
 * Body mixin
 *
 * Ref: https://fetch.spec.whatwg.org/#body
 *
 * @param   Stream  body  Readable stream
 * @param   Object  opts  Response options
 * @return  Void
 */
function Body(body) {
	var _this = this;

	var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
	    _ref$size = _ref.size;

	let size = _ref$size === undefined ? 0 : _ref$size;
	var _ref$timeout = _ref.timeout;
	let timeout = _ref$timeout === undefined ? 0 : _ref$timeout;

	if (body == null) {
		// body is undefined or null
		body = null;
	} else if (isURLSearchParams(body)) {
		// body is a URLSearchParams
		body = Buffer.from(body.toString());
	} else if (isBlob(body)) ; else if (Buffer.isBuffer(body)) ; else if (Object.prototype.toString.call(body) === '[object ArrayBuffer]') {
		// body is ArrayBuffer
		body = Buffer.from(body);
	} else if (ArrayBuffer.isView(body)) {
		// body is ArrayBufferView
		body = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
	} else if (body instanceof Stream) ; else {
		// none of the above
		// coerce to string then buffer
		body = Buffer.from(String(body));
	}
	this[INTERNALS] = {
		body,
		disturbed: false,
		error: null
	};
	this.size = size;
	this.timeout = timeout;

	if (body instanceof Stream) {
		body.on('error', function (err) {
			const error = err.name === 'AbortError' ? err : new FetchError(`Invalid response body while trying to fetch ${_this.url}: ${err.message}`, 'system', err);
			_this[INTERNALS].error = error;
		});
	}
}

Body.prototype = {
	get body() {
		return this[INTERNALS].body;
	},

	get bodyUsed() {
		return this[INTERNALS].disturbed;
	},

	/**
  * Decode response as ArrayBuffer
  *
  * @return  Promise
  */
	arrayBuffer() {
		return consumeBody.call(this).then(function (buf) {
			return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
		});
	},

	/**
  * Return raw response as Blob
  *
  * @return Promise
  */
	blob() {
		let ct = this.headers && this.headers.get('content-type') || '';
		return consumeBody.call(this).then(function (buf) {
			return Object.assign(
			// Prevent copying
			new Blob([], {
				type: ct.toLowerCase()
			}), {
				[BUFFER]: buf
			});
		});
	},

	/**
  * Decode response as json
  *
  * @return  Promise
  */
	json() {
		var _this2 = this;

		return consumeBody.call(this).then(function (buffer) {
			try {
				return JSON.parse(buffer.toString());
			} catch (err) {
				return Body.Promise.reject(new FetchError(`invalid json response body at ${_this2.url} reason: ${err.message}`, 'invalid-json'));
			}
		});
	},

	/**
  * Decode response as text
  *
  * @return  Promise
  */
	text() {
		return consumeBody.call(this).then(function (buffer) {
			return buffer.toString();
		});
	},

	/**
  * Decode response as buffer (non-spec api)
  *
  * @return  Promise
  */
	buffer() {
		return consumeBody.call(this);
	},

	/**
  * Decode response as text, while automatically detecting the encoding and
  * trying to decode to UTF-8 (non-spec api)
  *
  * @return  Promise
  */
	textConverted() {
		var _this3 = this;

		return consumeBody.call(this).then(function (buffer) {
			return convertBody(buffer, _this3.headers);
		});
	}
};

// In browsers, all properties are enumerable.
Object.defineProperties(Body.prototype, {
	body: { enumerable: true },
	bodyUsed: { enumerable: true },
	arrayBuffer: { enumerable: true },
	blob: { enumerable: true },
	json: { enumerable: true },
	text: { enumerable: true }
});

Body.mixIn = function (proto) {
	for (const name of Object.getOwnPropertyNames(Body.prototype)) {
		// istanbul ignore else: future proof
		if (!(name in proto)) {
			const desc = Object.getOwnPropertyDescriptor(Body.prototype, name);
			Object.defineProperty(proto, name, desc);
		}
	}
};

/**
 * Consume and convert an entire Body to a Buffer.
 *
 * Ref: https://fetch.spec.whatwg.org/#concept-body-consume-body
 *
 * @return  Promise
 */
function consumeBody() {
	var _this4 = this;

	if (this[INTERNALS].disturbed) {
		return Body.Promise.reject(new TypeError(`body used already for: ${this.url}`));
	}

	this[INTERNALS].disturbed = true;

	if (this[INTERNALS].error) {
		return Body.Promise.reject(this[INTERNALS].error);
	}

	let body = this.body;

	// body is null
	if (body === null) {
		return Body.Promise.resolve(Buffer.alloc(0));
	}

	// body is blob
	if (isBlob(body)) {
		body = body.stream();
	}

	// body is buffer
	if (Buffer.isBuffer(body)) {
		return Body.Promise.resolve(body);
	}

	// istanbul ignore if: should never happen
	if (!(body instanceof Stream)) {
		return Body.Promise.resolve(Buffer.alloc(0));
	}

	// body is stream
	// get ready to actually consume the body
	let accum = [];
	let accumBytes = 0;
	let abort = false;

	return new Body.Promise(function (resolve, reject) {
		let resTimeout;

		// allow timeout on slow response body
		if (_this4.timeout) {
			resTimeout = setTimeout(function () {
				abort = true;
				reject(new FetchError(`Response timeout while trying to fetch ${_this4.url} (over ${_this4.timeout}ms)`, 'body-timeout'));
			}, _this4.timeout);
		}

		// handle stream errors
		body.on('error', function (err) {
			if (err.name === 'AbortError') {
				// if the request was aborted, reject with this Error
				abort = true;
				reject(err);
			} else {
				// other errors, such as incorrect content-encoding
				reject(new FetchError(`Invalid response body while trying to fetch ${_this4.url}: ${err.message}`, 'system', err));
			}
		});

		body.on('data', function (chunk) {
			if (abort || chunk === null) {
				return;
			}

			if (_this4.size && accumBytes + chunk.length > _this4.size) {
				abort = true;
				reject(new FetchError(`content size at ${_this4.url} over limit: ${_this4.size}`, 'max-size'));
				return;
			}

			accumBytes += chunk.length;
			accum.push(chunk);
		});

		body.on('end', function () {
			if (abort) {
				return;
			}

			clearTimeout(resTimeout);

			try {
				resolve(Buffer.concat(accum, accumBytes));
			} catch (err) {
				// handle streams that have accumulated too much data (issue #414)
				reject(new FetchError(`Could not create Buffer from response body for ${_this4.url}: ${err.message}`, 'system', err));
			}
		});
	});
}

/**
 * Detect buffer encoding and convert to target encoding
 * ref: http://www.w3.org/TR/2011/WD-html5-20110113/parsing.html#determining-the-character-encoding
 *
 * @param   Buffer  buffer    Incoming buffer
 * @param   String  encoding  Target encoding
 * @return  String
 */
function convertBody(buffer, headers) {
	if (typeof convert !== 'function') {
		throw new Error('The package `encoding` must be installed to use the textConverted() function');
	}

	const ct = headers.get('content-type');
	let charset = 'utf-8';
	let res, str;

	// header
	if (ct) {
		res = /charset=([^;]*)/i.exec(ct);
	}

	// no charset in content type, peek at response body for at most 1024 bytes
	str = buffer.slice(0, 1024).toString();

	// html5
	if (!res && str) {
		res = /<meta.+?charset=(['"])(.+?)\1/i.exec(str);
	}

	// html4
	if (!res && str) {
		res = /<meta[\s]+?http-equiv=(['"])content-type\1[\s]+?content=(['"])(.+?)\2/i.exec(str);
		if (!res) {
			res = /<meta[\s]+?content=(['"])(.+?)\1[\s]+?http-equiv=(['"])content-type\3/i.exec(str);
			if (res) {
				res.pop(); // drop last quote
			}
		}

		if (res) {
			res = /charset=(.*)/i.exec(res.pop());
		}
	}

	// xml
	if (!res && str) {
		res = /<\?xml.+?encoding=(['"])(.+?)\1/i.exec(str);
	}

	// found charset
	if (res) {
		charset = res.pop();

		// prevent decode issues when sites use incorrect encoding
		// ref: https://hsivonen.fi/encoding-menu/
		if (charset === 'gb2312' || charset === 'gbk') {
			charset = 'gb18030';
		}
	}

	// turn raw buffers into a single utf-8 buffer
	return convert(buffer, 'UTF-8', charset).toString();
}

/**
 * Detect a URLSearchParams object
 * ref: https://github.com/bitinn/node-fetch/issues/296#issuecomment-307598143
 *
 * @param   Object  obj     Object to detect by type or brand
 * @return  String
 */
function isURLSearchParams(obj) {
	// Duck-typing as a necessary condition.
	if (typeof obj !== 'object' || typeof obj.append !== 'function' || typeof obj.delete !== 'function' || typeof obj.get !== 'function' || typeof obj.getAll !== 'function' || typeof obj.has !== 'function' || typeof obj.set !== 'function') {
		return false;
	}

	// Brand-checking and more duck-typing as optional condition.
	return obj.constructor.name === 'URLSearchParams' || Object.prototype.toString.call(obj) === '[object URLSearchParams]' || typeof obj.sort === 'function';
}

/**
 * Check if `obj` is a W3C `Blob` object (which `File` inherits from)
 * @param  {*} obj
 * @return {boolean}
 */
function isBlob(obj) {
	return typeof obj === 'object' && typeof obj.arrayBuffer === 'function' && typeof obj.type === 'string' && typeof obj.stream === 'function' && typeof obj.constructor === 'function' && typeof obj.constructor.name === 'string' && /^(Blob|File)$/.test(obj.constructor.name) && /^(Blob|File)$/.test(obj[Symbol.toStringTag]);
}

/**
 * Clone body given Res/Req instance
 *
 * @param   Mixed  instance  Response or Request instance
 * @return  Mixed
 */
function clone(instance) {
	let p1, p2;
	let body = instance.body;

	// don't allow cloning a used body
	if (instance.bodyUsed) {
		throw new Error('cannot clone body after it is used');
	}

	// check that body is a stream and not form-data object
	// note: we can't clone the form-data object without having it as a dependency
	if (body instanceof Stream && typeof body.getBoundary !== 'function') {
		// tee instance body
		p1 = new PassThrough();
		p2 = new PassThrough();
		body.pipe(p1);
		body.pipe(p2);
		// set instance body to teed body and return the other teed body
		instance[INTERNALS].body = p1;
		body = p2;
	}

	return body;
}

/**
 * Performs the operation "extract a `Content-Type` value from |object|" as
 * specified in the specification:
 * https://fetch.spec.whatwg.org/#concept-bodyinit-extract
 *
 * This function assumes that instance.body is present.
 *
 * @param   Mixed  instance  Any options.body input
 */
function extractContentType(body) {
	if (body === null) {
		// body is null
		return null;
	} else if (typeof body === 'string') {
		// body is string
		return 'text/plain;charset=UTF-8';
	} else if (isURLSearchParams(body)) {
		// body is a URLSearchParams
		return 'application/x-www-form-urlencoded;charset=UTF-8';
	} else if (isBlob(body)) {
		// body is blob
		return body.type || null;
	} else if (Buffer.isBuffer(body)) {
		// body is buffer
		return null;
	} else if (Object.prototype.toString.call(body) === '[object ArrayBuffer]') {
		// body is ArrayBuffer
		return null;
	} else if (ArrayBuffer.isView(body)) {
		// body is ArrayBufferView
		return null;
	} else if (typeof body.getBoundary === 'function') {
		// detect form data input from form-data module
		return `multipart/form-data;boundary=${body.getBoundary()}`;
	} else if (body instanceof Stream) {
		// body is stream
		// can't really do much about this
		return null;
	} else {
		// Body constructor defaults other things to string
		return 'text/plain;charset=UTF-8';
	}
}

/**
 * The Fetch Standard treats this as if "total bytes" is a property on the body.
 * For us, we have to explicitly get it with a function.
 *
 * ref: https://fetch.spec.whatwg.org/#concept-body-total-bytes
 *
 * @param   Body    instance   Instance of Body
 * @return  Number?            Number of bytes, or null if not possible
 */
function getTotalBytes(instance) {
	const body = instance.body;


	if (body === null) {
		// body is null
		return 0;
	} else if (isBlob(body)) {
		return body.size;
	} else if (Buffer.isBuffer(body)) {
		// body is buffer
		return body.length;
	} else if (body && typeof body.getLengthSync === 'function') {
		// detect form data input from form-data module
		if (body._lengthRetrievers && body._lengthRetrievers.length == 0 || // 1.x
		body.hasKnownLength && body.hasKnownLength()) {
			// 2.x
			return body.getLengthSync();
		}
		return null;
	} else {
		// body is stream
		return null;
	}
}

/**
 * Write a Body to a Node.js WritableStream (e.g. http.Request) object.
 *
 * @param   Body    instance   Instance of Body
 * @return  Void
 */
function writeToStream(dest, instance) {
	const body = instance.body;


	if (body === null) {
		// body is null
		dest.end();
	} else if (isBlob(body)) {
		body.stream().pipe(dest);
	} else if (Buffer.isBuffer(body)) {
		// body is buffer
		dest.write(body);
		dest.end();
	} else {
		// body is stream
		body.pipe(dest);
	}
}

// expose Promise
Body.Promise = global.Promise;

/**
 * headers.js
 *
 * Headers class offers convenient helpers
 */

const invalidTokenRegex = /[^\^_`a-zA-Z\-0-9!#$%&'*+.|~]/;
const invalidHeaderCharRegex = /[^\t\x20-\x7e\x80-\xff]/;

function validateName(name) {
	name = `${name}`;
	if (invalidTokenRegex.test(name) || name === '') {
		throw new TypeError(`${name} is not a legal HTTP header name`);
	}
}

function validateValue(value) {
	value = `${value}`;
	if (invalidHeaderCharRegex.test(value)) {
		throw new TypeError(`${value} is not a legal HTTP header value`);
	}
}

/**
 * Find the key in the map object given a header name.
 *
 * Returns undefined if not found.
 *
 * @param   String  name  Header name
 * @return  String|Undefined
 */
function find(map, name) {
	name = name.toLowerCase();
	for (const key in map) {
		if (key.toLowerCase() === name) {
			return key;
		}
	}
	return undefined;
}

const MAP = Symbol('map');
class Headers {
	/**
  * Headers class
  *
  * @param   Object  headers  Response headers
  * @return  Void
  */
	constructor() {
		let init = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : undefined;

		this[MAP] = Object.create(null);

		if (init instanceof Headers) {
			const rawHeaders = init.raw();
			const headerNames = Object.keys(rawHeaders);

			for (const headerName of headerNames) {
				for (const value of rawHeaders[headerName]) {
					this.append(headerName, value);
				}
			}

			return;
		}

		// We don't worry about converting prop to ByteString here as append()
		// will handle it.
		if (init == null) ; else if (typeof init === 'object') {
			const method = init[Symbol.iterator];
			if (method != null) {
				if (typeof method !== 'function') {
					throw new TypeError('Header pairs must be iterable');
				}

				// sequence<sequence<ByteString>>
				// Note: per spec we have to first exhaust the lists then process them
				const pairs = [];
				for (const pair of init) {
					if (typeof pair !== 'object' || typeof pair[Symbol.iterator] !== 'function') {
						throw new TypeError('Each header pair must be iterable');
					}
					pairs.push(Array.from(pair));
				}

				for (const pair of pairs) {
					if (pair.length !== 2) {
						throw new TypeError('Each header pair must be a name/value tuple');
					}
					this.append(pair[0], pair[1]);
				}
			} else {
				// record<ByteString, ByteString>
				for (const key of Object.keys(init)) {
					const value = init[key];
					this.append(key, value);
				}
			}
		} else {
			throw new TypeError('Provided initializer must be an object');
		}
	}

	/**
  * Return combined header value given name
  *
  * @param   String  name  Header name
  * @return  Mixed
  */
	get(name) {
		name = `${name}`;
		validateName(name);
		const key = find(this[MAP], name);
		if (key === undefined) {
			return null;
		}

		return this[MAP][key].join(', ');
	}

	/**
  * Iterate over all headers
  *
  * @param   Function  callback  Executed for each item with parameters (value, name, thisArg)
  * @param   Boolean   thisArg   `this` context for callback function
  * @return  Void
  */
	forEach(callback) {
		let thisArg = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : undefined;

		let pairs = getHeaders(this);
		let i = 0;
		while (i < pairs.length) {
			var _pairs$i = pairs[i];
			const name = _pairs$i[0],
			      value = _pairs$i[1];

			callback.call(thisArg, value, name, this);
			pairs = getHeaders(this);
			i++;
		}
	}

	/**
  * Overwrite header values given name
  *
  * @param   String  name   Header name
  * @param   String  value  Header value
  * @return  Void
  */
	set(name, value) {
		name = `${name}`;
		value = `${value}`;
		validateName(name);
		validateValue(value);
		const key = find(this[MAP], name);
		this[MAP][key !== undefined ? key : name] = [value];
	}

	/**
  * Append a value onto existing header
  *
  * @param   String  name   Header name
  * @param   String  value  Header value
  * @return  Void
  */
	append(name, value) {
		name = `${name}`;
		value = `${value}`;
		validateName(name);
		validateValue(value);
		const key = find(this[MAP], name);
		if (key !== undefined) {
			this[MAP][key].push(value);
		} else {
			this[MAP][name] = [value];
		}
	}

	/**
  * Check for header name existence
  *
  * @param   String   name  Header name
  * @return  Boolean
  */
	has(name) {
		name = `${name}`;
		validateName(name);
		return find(this[MAP], name) !== undefined;
	}

	/**
  * Delete all header values given name
  *
  * @param   String  name  Header name
  * @return  Void
  */
	delete(name) {
		name = `${name}`;
		validateName(name);
		const key = find(this[MAP], name);
		if (key !== undefined) {
			delete this[MAP][key];
		}
	}

	/**
  * Return raw headers (non-spec api)
  *
  * @return  Object
  */
	raw() {
		return this[MAP];
	}

	/**
  * Get an iterator on keys.
  *
  * @return  Iterator
  */
	keys() {
		return createHeadersIterator(this, 'key');
	}

	/**
  * Get an iterator on values.
  *
  * @return  Iterator
  */
	values() {
		return createHeadersIterator(this, 'value');
	}

	/**
  * Get an iterator on entries.
  *
  * This is the default iterator of the Headers object.
  *
  * @return  Iterator
  */
	[Symbol.iterator]() {
		return createHeadersIterator(this, 'key+value');
	}
}
Headers.prototype.entries = Headers.prototype[Symbol.iterator];

Object.defineProperty(Headers.prototype, Symbol.toStringTag, {
	value: 'Headers',
	writable: false,
	enumerable: false,
	configurable: true
});

Object.defineProperties(Headers.prototype, {
	get: { enumerable: true },
	forEach: { enumerable: true },
	set: { enumerable: true },
	append: { enumerable: true },
	has: { enumerable: true },
	delete: { enumerable: true },
	keys: { enumerable: true },
	values: { enumerable: true },
	entries: { enumerable: true }
});

function getHeaders(headers) {
	let kind = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'key+value';

	const keys = Object.keys(headers[MAP]).sort();
	return keys.map(kind === 'key' ? function (k) {
		return k.toLowerCase();
	} : kind === 'value' ? function (k) {
		return headers[MAP][k].join(', ');
	} : function (k) {
		return [k.toLowerCase(), headers[MAP][k].join(', ')];
	});
}

const INTERNAL = Symbol('internal');

function createHeadersIterator(target, kind) {
	const iterator = Object.create(HeadersIteratorPrototype);
	iterator[INTERNAL] = {
		target,
		kind,
		index: 0
	};
	return iterator;
}

const HeadersIteratorPrototype = Object.setPrototypeOf({
	next() {
		// istanbul ignore if
		if (!this || Object.getPrototypeOf(this) !== HeadersIteratorPrototype) {
			throw new TypeError('Value of `this` is not a HeadersIterator');
		}

		var _INTERNAL = this[INTERNAL];
		const target = _INTERNAL.target,
		      kind = _INTERNAL.kind,
		      index = _INTERNAL.index;

		const values = getHeaders(target, kind);
		const len = values.length;
		if (index >= len) {
			return {
				value: undefined,
				done: true
			};
		}

		this[INTERNAL].index = index + 1;

		return {
			value: values[index],
			done: false
		};
	}
}, Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]())));

Object.defineProperty(HeadersIteratorPrototype, Symbol.toStringTag, {
	value: 'HeadersIterator',
	writable: false,
	enumerable: false,
	configurable: true
});

/**
 * Export the Headers object in a form that Node.js can consume.
 *
 * @param   Headers  headers
 * @return  Object
 */
function exportNodeCompatibleHeaders(headers) {
	const obj = Object.assign({ __proto__: null }, headers[MAP]);

	// http.request() only supports string as Host header. This hack makes
	// specifying custom Host header possible.
	const hostHeaderKey = find(headers[MAP], 'Host');
	if (hostHeaderKey !== undefined) {
		obj[hostHeaderKey] = obj[hostHeaderKey][0];
	}

	return obj;
}

/**
 * Create a Headers object from an object of headers, ignoring those that do
 * not conform to HTTP grammar productions.
 *
 * @param   Object  obj  Object of headers
 * @return  Headers
 */
function createHeadersLenient(obj) {
	const headers = new Headers();
	for (const name of Object.keys(obj)) {
		if (invalidTokenRegex.test(name)) {
			continue;
		}
		if (Array.isArray(obj[name])) {
			for (const val of obj[name]) {
				if (invalidHeaderCharRegex.test(val)) {
					continue;
				}
				if (headers[MAP][name] === undefined) {
					headers[MAP][name] = [val];
				} else {
					headers[MAP][name].push(val);
				}
			}
		} else if (!invalidHeaderCharRegex.test(obj[name])) {
			headers[MAP][name] = [obj[name]];
		}
	}
	return headers;
}

const INTERNALS$1 = Symbol('Response internals');

// fix an issue where "STATUS_CODES" aren't a named export for node <10
const STATUS_CODES = http.STATUS_CODES;

/**
 * Response class
 *
 * @param   Stream  body  Readable stream
 * @param   Object  opts  Response options
 * @return  Void
 */
class Response {
	constructor() {
		let body = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
		let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

		Body.call(this, body, opts);

		const status = opts.status || 200;
		const headers = new Headers(opts.headers);

		if (body != null && !headers.has('Content-Type')) {
			const contentType = extractContentType(body);
			if (contentType) {
				headers.append('Content-Type', contentType);
			}
		}

		this[INTERNALS$1] = {
			url: opts.url,
			status,
			statusText: opts.statusText || STATUS_CODES[status],
			headers,
			counter: opts.counter
		};
	}

	get url() {
		return this[INTERNALS$1].url || '';
	}

	get status() {
		return this[INTERNALS$1].status;
	}

	/**
  * Convenience property representing if the request ended normally
  */
	get ok() {
		return this[INTERNALS$1].status >= 200 && this[INTERNALS$1].status < 300;
	}

	get redirected() {
		return this[INTERNALS$1].counter > 0;
	}

	get statusText() {
		return this[INTERNALS$1].statusText;
	}

	get headers() {
		return this[INTERNALS$1].headers;
	}

	/**
  * Clone this response
  *
  * @return  Response
  */
	clone() {
		return new Response(clone(this), {
			url: this.url,
			status: this.status,
			statusText: this.statusText,
			headers: this.headers,
			ok: this.ok,
			redirected: this.redirected
		});
	}
}

Body.mixIn(Response.prototype);

Object.defineProperties(Response.prototype, {
	url: { enumerable: true },
	status: { enumerable: true },
	ok: { enumerable: true },
	redirected: { enumerable: true },
	statusText: { enumerable: true },
	headers: { enumerable: true },
	clone: { enumerable: true }
});

Object.defineProperty(Response.prototype, Symbol.toStringTag, {
	value: 'Response',
	writable: false,
	enumerable: false,
	configurable: true
});

const INTERNALS$2 = Symbol('Request internals');
const URL = Url.URL || whatwgUrl.URL;

// fix an issue where "format", "parse" aren't a named export for node <10
const parse_url = Url.parse;
const format_url = Url.format;

/**
 * Wrapper around `new URL` to handle arbitrary URLs
 *
 * @param  {string} urlStr
 * @return {void}
 */
function parseURL(urlStr) {
	/*
 	Check whether the URL is absolute or not
 		Scheme: https://tools.ietf.org/html/rfc3986#section-3.1
 	Absolute URL: https://tools.ietf.org/html/rfc3986#section-4.3
 */
	if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.exec(urlStr)) {
		urlStr = new URL(urlStr).toString();
	}

	// Fallback to old implementation for arbitrary URLs
	return parse_url(urlStr);
}

const streamDestructionSupported = 'destroy' in Stream.Readable.prototype;

/**
 * Check if a value is an instance of Request.
 *
 * @param   Mixed   input
 * @return  Boolean
 */
function isRequest(input) {
	return typeof input === 'object' && typeof input[INTERNALS$2] === 'object';
}

function isAbortSignal(signal) {
	const proto = signal && typeof signal === 'object' && Object.getPrototypeOf(signal);
	return !!(proto && proto.constructor.name === 'AbortSignal');
}

/**
 * Request class
 *
 * @param   Mixed   input  Url or Request instance
 * @param   Object  init   Custom options
 * @return  Void
 */
class Request {
	constructor(input) {
		let init = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

		let parsedURL;

		// normalize input
		if (!isRequest(input)) {
			if (input && input.href) {
				// in order to support Node.js' Url objects; though WHATWG's URL objects
				// will fall into this branch also (since their `toString()` will return
				// `href` property anyway)
				parsedURL = parseURL(input.href);
			} else {
				// coerce input to a string before attempting to parse
				parsedURL = parseURL(`${input}`);
			}
			input = {};
		} else {
			parsedURL = parseURL(input.url);
		}

		let method = init.method || input.method || 'GET';
		method = method.toUpperCase();

		if ((init.body != null || isRequest(input) && input.body !== null) && (method === 'GET' || method === 'HEAD')) {
			throw new TypeError('Request with GET/HEAD method cannot have body');
		}

		let inputBody = init.body != null ? init.body : isRequest(input) && input.body !== null ? clone(input) : null;

		Body.call(this, inputBody, {
			timeout: init.timeout || input.timeout || 0,
			size: init.size || input.size || 0
		});

		const headers = new Headers(init.headers || input.headers || {});

		if (inputBody != null && !headers.has('Content-Type')) {
			const contentType = extractContentType(inputBody);
			if (contentType) {
				headers.append('Content-Type', contentType);
			}
		}

		let signal = isRequest(input) ? input.signal : null;
		if ('signal' in init) signal = init.signal;

		if (signal != null && !isAbortSignal(signal)) {
			throw new TypeError('Expected signal to be an instanceof AbortSignal');
		}

		this[INTERNALS$2] = {
			method,
			redirect: init.redirect || input.redirect || 'follow',
			headers,
			parsedURL,
			signal
		};

		// node-fetch-only options
		this.follow = init.follow !== undefined ? init.follow : input.follow !== undefined ? input.follow : 20;
		this.compress = init.compress !== undefined ? init.compress : input.compress !== undefined ? input.compress : true;
		this.counter = init.counter || input.counter || 0;
		this.agent = init.agent || input.agent;
	}

	get method() {
		return this[INTERNALS$2].method;
	}

	get url() {
		return format_url(this[INTERNALS$2].parsedURL);
	}

	get headers() {
		return this[INTERNALS$2].headers;
	}

	get redirect() {
		return this[INTERNALS$2].redirect;
	}

	get signal() {
		return this[INTERNALS$2].signal;
	}

	/**
  * Clone this request
  *
  * @return  Request
  */
	clone() {
		return new Request(this);
	}
}

Body.mixIn(Request.prototype);

Object.defineProperty(Request.prototype, Symbol.toStringTag, {
	value: 'Request',
	writable: false,
	enumerable: false,
	configurable: true
});

Object.defineProperties(Request.prototype, {
	method: { enumerable: true },
	url: { enumerable: true },
	headers: { enumerable: true },
	redirect: { enumerable: true },
	clone: { enumerable: true },
	signal: { enumerable: true }
});

/**
 * Convert a Request to Node.js http request options.
 *
 * @param   Request  A Request instance
 * @return  Object   The options object to be passed to http.request
 */
function getNodeRequestOptions(request) {
	const parsedURL = request[INTERNALS$2].parsedURL;
	const headers = new Headers(request[INTERNALS$2].headers);

	// fetch step 1.3
	if (!headers.has('Accept')) {
		headers.set('Accept', '*/*');
	}

	// Basic fetch
	if (!parsedURL.protocol || !parsedURL.hostname) {
		throw new TypeError('Only absolute URLs are supported');
	}

	if (!/^https?:$/.test(parsedURL.protocol)) {
		throw new TypeError('Only HTTP(S) protocols are supported');
	}

	if (request.signal && request.body instanceof Stream.Readable && !streamDestructionSupported) {
		throw new Error('Cancellation of streamed requests with AbortSignal is not supported in node < 8');
	}

	// HTTP-network-or-cache fetch steps 2.4-2.7
	let contentLengthValue = null;
	if (request.body == null && /^(POST|PUT)$/i.test(request.method)) {
		contentLengthValue = '0';
	}
	if (request.body != null) {
		const totalBytes = getTotalBytes(request);
		if (typeof totalBytes === 'number') {
			contentLengthValue = String(totalBytes);
		}
	}
	if (contentLengthValue) {
		headers.set('Content-Length', contentLengthValue);
	}

	// HTTP-network-or-cache fetch step 2.11
	if (!headers.has('User-Agent')) {
		headers.set('User-Agent', 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)');
	}

	// HTTP-network-or-cache fetch step 2.15
	if (request.compress && !headers.has('Accept-Encoding')) {
		headers.set('Accept-Encoding', 'gzip,deflate');
	}

	let agent = request.agent;
	if (typeof agent === 'function') {
		agent = agent(parsedURL);
	}

	// HTTP-network fetch step 4.2
	// chunked encoding is handled by Node.js

	return Object.assign({}, parsedURL, {
		method: request.method,
		headers: exportNodeCompatibleHeaders(headers),
		agent
	});
}

/**
 * abort-error.js
 *
 * AbortError interface for cancelled requests
 */

/**
 * Create AbortError instance
 *
 * @param   String      message      Error message for human
 * @return  AbortError
 */
function AbortError(message) {
  Error.call(this, message);

  this.type = 'aborted';
  this.message = message;

  // hide custom error implementation details from end-users
  Error.captureStackTrace(this, this.constructor);
}

AbortError.prototype = Object.create(Error.prototype);
AbortError.prototype.constructor = AbortError;
AbortError.prototype.name = 'AbortError';

const URL$1 = Url.URL || whatwgUrl.URL;

// fix an issue where "PassThrough", "resolve" aren't a named export for node <10
const PassThrough$1 = Stream.PassThrough;

const isDomainOrSubdomain = function isDomainOrSubdomain(destination, original) {
	const orig = new URL$1(original).hostname;
	const dest = new URL$1(destination).hostname;

	return orig === dest || orig[orig.length - dest.length - 1] === '.' && orig.endsWith(dest);
};

/**
 * isSameProtocol reports whether the two provided URLs use the same protocol.
 *
 * Both domains must already be in canonical form.
 * @param {string|URL} original
 * @param {string|URL} destination
 */
const isSameProtocol = function isSameProtocol(destination, original) {
	const orig = new URL$1(original).protocol;
	const dest = new URL$1(destination).protocol;

	return orig === dest;
};

/**
 * Fetch function
 *
 * @param   Mixed    url   Absolute url or Request instance
 * @param   Object   opts  Fetch options
 * @return  Promise
 */
function fetch(url, opts) {

	// allow custom promise
	if (!fetch.Promise) {
		throw new Error('native promise missing, set fetch.Promise to your favorite alternative');
	}

	Body.Promise = fetch.Promise;

	// wrap http.request into fetch
	return new fetch.Promise(function (resolve, reject) {
		// build request object
		const request = new Request(url, opts);
		const options = getNodeRequestOptions(request);

		const send = (options.protocol === 'https:' ? https : http).request;
		const signal = request.signal;

		let response = null;

		const abort = function abort() {
			let error = new AbortError('The user aborted a request.');
			reject(error);
			if (request.body && request.body instanceof Stream.Readable) {
				destroyStream(request.body, error);
			}
			if (!response || !response.body) return;
			response.body.emit('error', error);
		};

		if (signal && signal.aborted) {
			abort();
			return;
		}

		const abortAndFinalize = function abortAndFinalize() {
			abort();
			finalize();
		};

		// send request
		const req = send(options);
		let reqTimeout;

		if (signal) {
			signal.addEventListener('abort', abortAndFinalize);
		}

		function finalize() {
			req.abort();
			if (signal) signal.removeEventListener('abort', abortAndFinalize);
			clearTimeout(reqTimeout);
		}

		if (request.timeout) {
			req.once('socket', function (socket) {
				reqTimeout = setTimeout(function () {
					reject(new FetchError(`network timeout at: ${request.url}`, 'request-timeout'));
					finalize();
				}, request.timeout);
			});
		}

		req.on('error', function (err) {
			reject(new FetchError(`request to ${request.url} failed, reason: ${err.message}`, 'system', err));

			if (response && response.body) {
				destroyStream(response.body, err);
			}

			finalize();
		});

		fixResponseChunkedTransferBadEnding(req, function (err) {
			if (signal && signal.aborted) {
				return;
			}

			if (response && response.body) {
				destroyStream(response.body, err);
			}
		});

		/* c8 ignore next 18 */
		if (parseInt(process.version.substring(1)) < 14) {
			// Before Node.js 14, pipeline() does not fully support async iterators and does not always
			// properly handle when the socket close/end events are out of order.
			req.on('socket', function (s) {
				s.addListener('close', function (hadError) {
					// if a data listener is still present we didn't end cleanly
					const hasDataListener = s.listenerCount('data') > 0;

					// if end happened before close but the socket didn't emit an error, do it now
					if (response && hasDataListener && !hadError && !(signal && signal.aborted)) {
						const err = new Error('Premature close');
						err.code = 'ERR_STREAM_PREMATURE_CLOSE';
						response.body.emit('error', err);
					}
				});
			});
		}

		req.on('response', function (res) {
			clearTimeout(reqTimeout);

			const headers = createHeadersLenient(res.headers);

			// HTTP fetch step 5
			if (fetch.isRedirect(res.statusCode)) {
				// HTTP fetch step 5.2
				const location = headers.get('Location');

				// HTTP fetch step 5.3
				let locationURL = null;
				try {
					locationURL = location === null ? null : new URL$1(location, request.url).toString();
				} catch (err) {
					// error here can only be invalid URL in Location: header
					// do not throw when options.redirect == manual
					// let the user extract the errorneous redirect URL
					if (request.redirect !== 'manual') {
						reject(new FetchError(`uri requested responds with an invalid redirect URL: ${location}`, 'invalid-redirect'));
						finalize();
						return;
					}
				}

				// HTTP fetch step 5.5
				switch (request.redirect) {
					case 'error':
						reject(new FetchError(`uri requested responds with a redirect, redirect mode is set to error: ${request.url}`, 'no-redirect'));
						finalize();
						return;
					case 'manual':
						// node-fetch-specific step: make manual redirect a bit easier to use by setting the Location header value to the resolved URL.
						if (locationURL !== null) {
							// handle corrupted header
							try {
								headers.set('Location', locationURL);
							} catch (err) {
								// istanbul ignore next: nodejs server prevent invalid response headers, we can't test this through normal request
								reject(err);
							}
						}
						break;
					case 'follow':
						// HTTP-redirect fetch step 2
						if (locationURL === null) {
							break;
						}

						// HTTP-redirect fetch step 5
						if (request.counter >= request.follow) {
							reject(new FetchError(`maximum redirect reached at: ${request.url}`, 'max-redirect'));
							finalize();
							return;
						}

						// HTTP-redirect fetch step 6 (counter increment)
						// Create a new Request object.
						const requestOpts = {
							headers: new Headers(request.headers),
							follow: request.follow,
							counter: request.counter + 1,
							agent: request.agent,
							compress: request.compress,
							method: request.method,
							body: request.body,
							signal: request.signal,
							timeout: request.timeout,
							size: request.size
						};

						if (!isDomainOrSubdomain(request.url, locationURL) || !isSameProtocol(request.url, locationURL)) {
							for (const name of ['authorization', 'www-authenticate', 'cookie', 'cookie2']) {
								requestOpts.headers.delete(name);
							}
						}

						// HTTP-redirect fetch step 9
						if (res.statusCode !== 303 && request.body && getTotalBytes(request) === null) {
							reject(new FetchError('Cannot follow redirect with body being a readable stream', 'unsupported-redirect'));
							finalize();
							return;
						}

						// HTTP-redirect fetch step 11
						if (res.statusCode === 303 || (res.statusCode === 301 || res.statusCode === 302) && request.method === 'POST') {
							requestOpts.method = 'GET';
							requestOpts.body = undefined;
							requestOpts.headers.delete('content-length');
						}

						// HTTP-redirect fetch step 15
						resolve(fetch(new Request(locationURL, requestOpts)));
						finalize();
						return;
				}
			}

			// prepare response
			res.once('end', function () {
				if (signal) signal.removeEventListener('abort', abortAndFinalize);
			});
			let body = res.pipe(new PassThrough$1());

			const response_options = {
				url: request.url,
				status: res.statusCode,
				statusText: res.statusMessage,
				headers: headers,
				size: request.size,
				timeout: request.timeout,
				counter: request.counter
			};

			// HTTP-network fetch step 12.1.1.3
			const codings = headers.get('Content-Encoding');

			// HTTP-network fetch step 12.1.1.4: handle content codings

			// in following scenarios we ignore compression support
			// 1. compression support is disabled
			// 2. HEAD request
			// 3. no Content-Encoding header
			// 4. no content response (204)
			// 5. content not modified response (304)
			if (!request.compress || request.method === 'HEAD' || codings === null || res.statusCode === 204 || res.statusCode === 304) {
				response = new Response(body, response_options);
				resolve(response);
				return;
			}

			// For Node v6+
			// Be less strict when decoding compressed responses, since sometimes
			// servers send slightly invalid responses that are still accepted
			// by common browsers.
			// Always using Z_SYNC_FLUSH is what cURL does.
			const zlibOptions = {
				flush: zlib.Z_SYNC_FLUSH,
				finishFlush: zlib.Z_SYNC_FLUSH
			};

			// for gzip
			if (codings == 'gzip' || codings == 'x-gzip') {
				body = body.pipe(zlib.createGunzip(zlibOptions));
				response = new Response(body, response_options);
				resolve(response);
				return;
			}

			// for deflate
			if (codings == 'deflate' || codings == 'x-deflate') {
				// handle the infamous raw deflate response from old servers
				// a hack for old IIS and Apache servers
				const raw = res.pipe(new PassThrough$1());
				raw.once('data', function (chunk) {
					// see http://stackoverflow.com/questions/37519828
					if ((chunk[0] & 0x0F) === 0x08) {
						body = body.pipe(zlib.createInflate());
					} else {
						body = body.pipe(zlib.createInflateRaw());
					}
					response = new Response(body, response_options);
					resolve(response);
				});
				raw.on('end', function () {
					// some old IIS servers return zero-length OK deflate responses, so 'data' is never emitted.
					if (!response) {
						response = new Response(body, response_options);
						resolve(response);
					}
				});
				return;
			}

			// for br
			if (codings == 'br' && typeof zlib.createBrotliDecompress === 'function') {
				body = body.pipe(zlib.createBrotliDecompress());
				response = new Response(body, response_options);
				resolve(response);
				return;
			}

			// otherwise, use response as-is
			response = new Response(body, response_options);
			resolve(response);
		});

		writeToStream(req, request);
	});
}
function fixResponseChunkedTransferBadEnding(request, errorCallback) {
	let socket;

	request.on('socket', function (s) {
		socket = s;
	});

	request.on('response', function (response) {
		const headers = response.headers;

		if (headers['transfer-encoding'] === 'chunked' && !headers['content-length']) {
			response.once('close', function (hadError) {
				// tests for socket presence, as in some situations the
				// the 'socket' event is not triggered for the request
				// (happens in deno), avoids `TypeError`
				// if a data listener is still present we didn't end cleanly
				const hasDataListener = socket && socket.listenerCount('data') > 0;

				if (hasDataListener && !hadError) {
					const err = new Error('Premature close');
					err.code = 'ERR_STREAM_PREMATURE_CLOSE';
					errorCallback(err);
				}
			});
		}
	});
}

function destroyStream(stream, err) {
	if (stream.destroy) {
		stream.destroy(err);
	} else {
		// node < 8
		stream.emit('error', err);
		stream.end();
	}
}

/**
 * Redirect code matching
 *
 * @param   Number   code  Status code
 * @return  Boolean
 */
fetch.isRedirect = function (code) {
	return code === 301 || code === 302 || code === 303 || code === 307 || code === 308;
};

// expose Promise
fetch.Promise = global.Promise;

module.exports = exports = fetch;
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports;
exports.Headers = Headers;
exports.Request = Request;
exports.Response = Response;
exports.FetchError = FetchError;
exports.AbortError = AbortError;

},{"encoding":21,"http":undefined,"https":undefined,"stream":undefined,"url":undefined,"whatwg-url":59,"zlib":undefined}],46:[function(require,module,exports){
const runtimeRequire = typeof __webpack_require__ === 'function' ? __non_webpack_require__ : require // eslint-disable-line
if (typeof runtimeRequire.addon === 'function') { // if the platform supports native resolving prefer that
  module.exports = runtimeRequire.addon.bind(runtimeRequire)
} else { // else use the runtime version here
  module.exports = require('./node-gyp-build.js')
}

},{"./node-gyp-build.js":47}],47:[function(require,module,exports){
var fs = require('fs')
var path = require('path')
var os = require('os')

// Workaround to fix webpack's build warnings: 'the request of a dependency is an expression'
var runtimeRequire = typeof __webpack_require__ === 'function' ? __non_webpack_require__ : require // eslint-disable-line

var vars = (process.config && process.config.variables) || {}
var prebuildsOnly = !!process.env.PREBUILDS_ONLY
var abi = process.versions.modules // TODO: support old node where this is undef
var runtime = isElectron() ? 'electron' : (isNwjs() ? 'node-webkit' : 'node')

var arch = process.env.npm_config_arch || os.arch()
var platform = process.env.npm_config_platform || os.platform()
var libc = process.env.LIBC || (isAlpine(platform) ? 'musl' : 'glibc')
var armv = process.env.ARM_VERSION || (arch === 'arm64' ? '8' : vars.arm_version) || ''
var uv = (process.versions.uv || '').split('.')[0]

module.exports = load

function load (dir) {
  return runtimeRequire(load.resolve(dir))
}

load.resolve = load.path = function (dir) {
  dir = path.resolve(dir || '.')

  try {
    var name = runtimeRequire(path.join(dir, 'package.json')).name.toUpperCase().replace(/-/g, '_')
    if (process.env[name + '_PREBUILD']) dir = process.env[name + '_PREBUILD']
  } catch (err) {}

  if (!prebuildsOnly) {
    var release = getFirst(path.join(dir, 'build/Release'), matchBuild)
    if (release) return release

    var debug = getFirst(path.join(dir, 'build/Debug'), matchBuild)
    if (debug) return debug
  }

  var prebuild = resolve(dir)
  if (prebuild) return prebuild

  var nearby = resolve(path.dirname(process.execPath))
  if (nearby) return nearby

  var target = [
    'platform=' + platform,
    'arch=' + arch,
    'runtime=' + runtime,
    'abi=' + abi,
    'uv=' + uv,
    armv ? 'armv=' + armv : '',
    'libc=' + libc,
    'node=' + process.versions.node,
    process.versions.electron ? 'electron=' + process.versions.electron : '',
    typeof __webpack_require__ === 'function' ? 'webpack=true' : '' // eslint-disable-line
  ].filter(Boolean).join(' ')

  throw new Error('No native build was found for ' + target + '\n    loaded from: ' + dir + '\n')

  function resolve (dir) {
    // Find matching "prebuilds/<platform>-<arch>" directory
    var tuples = readdirSync(path.join(dir, 'prebuilds')).map(parseTuple)
    var tuple = tuples.filter(matchTuple(platform, arch)).sort(compareTuples)[0]
    if (!tuple) return

    // Find most specific flavor first
    var prebuilds = path.join(dir, 'prebuilds', tuple.name)
    var parsed = readdirSync(prebuilds).map(parseTags)
    var candidates = parsed.filter(matchTags(runtime, abi))
    var winner = candidates.sort(compareTags(runtime))[0]
    if (winner) return path.join(prebuilds, winner.file)
  }
}

function readdirSync (dir) {
  try {
    return fs.readdirSync(dir)
  } catch (err) {
    return []
  }
}

function getFirst (dir, filter) {
  var files = readdirSync(dir).filter(filter)
  return files[0] && path.join(dir, files[0])
}

function matchBuild (name) {
  return /\.node$/.test(name)
}

function parseTuple (name) {
  // Example: darwin-x64+arm64
  var arr = name.split('-')
  if (arr.length !== 2) return

  var platform = arr[0]
  var architectures = arr[1].split('+')

  if (!platform) return
  if (!architectures.length) return
  if (!architectures.every(Boolean)) return

  return { name, platform, architectures }
}

function matchTuple (platform, arch) {
  return function (tuple) {
    if (tuple == null) return false
    if (tuple.platform !== platform) return false
    return tuple.architectures.includes(arch)
  }
}

function compareTuples (a, b) {
  // Prefer single-arch prebuilds over multi-arch
  return a.architectures.length - b.architectures.length
}

function parseTags (file) {
  var arr = file.split('.')
  var extension = arr.pop()
  var tags = { file: file, specificity: 0 }

  if (extension !== 'node') return

  for (var i = 0; i < arr.length; i++) {
    var tag = arr[i]

    if (tag === 'node' || tag === 'electron' || tag === 'node-webkit') {
      tags.runtime = tag
    } else if (tag === 'napi') {
      tags.napi = true
    } else if (tag.slice(0, 3) === 'abi') {
      tags.abi = tag.slice(3)
    } else if (tag.slice(0, 2) === 'uv') {
      tags.uv = tag.slice(2)
    } else if (tag.slice(0, 4) === 'armv') {
      tags.armv = tag.slice(4)
    } else if (tag === 'glibc' || tag === 'musl') {
      tags.libc = tag
    } else {
      continue
    }

    tags.specificity++
  }

  return tags
}

function matchTags (runtime, abi) {
  return function (tags) {
    if (tags == null) return false
    if (tags.runtime !== runtime && !runtimeAgnostic(tags)) return false
    if (tags.abi !== abi && !tags.napi) return false
    if (tags.uv && tags.uv !== uv) return false
    if (tags.armv && tags.armv !== armv) return false
    if (tags.libc && tags.libc !== libc) return false

    return true
  }
}

function runtimeAgnostic (tags) {
  return tags.runtime === 'node' && tags.napi
}

function compareTags (runtime) {
  // Precedence: non-agnostic runtime, abi over napi, then by specificity.
  return function (a, b) {
    if (a.runtime !== b.runtime) {
      return a.runtime === runtime ? -1 : 1
    } else if (a.abi !== b.abi) {
      return a.abi ? -1 : 1
    } else if (a.specificity !== b.specificity) {
      return a.specificity > b.specificity ? -1 : 1
    } else {
      return 0
    }
  }
}

function isNwjs () {
  return !!(process.versions && process.versions.nw)
}

function isElectron () {
  if (process.versions && process.versions.electron) return true
  if (process.env.ELECTRON_RUN_AS_NODE) return true
  return typeof window !== 'undefined' && window.process && window.process.type === 'renderer'
}

function isAlpine (platform) {
  return platform === 'linux' && fs.existsSync('/etc/alpine-release')
}

// Exposed for unit tests
// TODO: move to lib
load.parseTags = parseTags
load.matchTags = matchTags
load.compareTags = compareTags
load.parseTuple = parseTuple
load.matchTuple = matchTuple
load.compareTuples = compareTuples

},{"fs":undefined,"os":undefined,"path":undefined}],48:[function(require,module,exports){
module.exports = require('bindings')('register-protocol-handler').registerProtocolHandler;

},{"bindings":3}],49:[function(require,module,exports){
/* eslint-disable node/no-deprecated-api */

'use strict'

var buffer = require('buffer')
var Buffer = buffer.Buffer

var safer = {}

var key

for (key in buffer) {
  if (!buffer.hasOwnProperty(key)) continue
  if (key === 'SlowBuffer' || key === 'Buffer') continue
  safer[key] = buffer[key]
}

var Safer = safer.Buffer = {}
for (key in Buffer) {
  if (!Buffer.hasOwnProperty(key)) continue
  if (key === 'allocUnsafe' || key === 'allocUnsafeSlow') continue
  Safer[key] = Buffer[key]
}

safer.Buffer.prototype = Buffer.prototype

if (!Safer.from || Safer.from === Uint8Array.from) {
  Safer.from = function (value, encodingOrOffset, length) {
    if (typeof value === 'number') {
      throw new TypeError('The "value" argument must not be of type number. Received type ' + typeof value)
    }
    if (value && typeof value.length === 'undefined') {
      throw new TypeError('The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type ' + typeof value)
    }
    return Buffer(value, encodingOrOffset, length)
  }
}

if (!Safer.alloc) {
  Safer.alloc = function (size, fill, encoding) {
    if (typeof size !== 'number') {
      throw new TypeError('The "size" argument must be of type number. Received type ' + typeof size)
    }
    if (size < 0 || size >= 2 * (1 << 30)) {
      throw new RangeError('The value "' + size + '" is invalid for option "size"')
    }
    var buf = Buffer(size)
    if (!fill || fill.length === 0) {
      buf.fill(0)
    } else if (typeof encoding === 'string') {
      buf.fill(fill, encoding)
    } else {
      buf.fill(fill)
    }
    return buf
  }
}

if (!safer.kStringMaxLength) {
  try {
    safer.kStringMaxLength = process.binding('buffer').kStringMaxLength
  } catch (e) {
    // we can't determine kStringMaxLength in environments where process.binding
    // is unsupported, so let's not set it
  }
}

if (!safer.constants) {
  safer.constants = {
    MAX_LENGTH: safer.kMaxLength
  }
  if (safer.kStringMaxLength) {
    safer.constants.MAX_STRING_LENGTH = safer.kStringMaxLength
  }
}

module.exports = safer

},{"buffer":undefined}],50:[function(require,module,exports){
'use strict';
const os = require('os');
const tty = require('tty');
const hasFlag = require('has-flag');

const {env} = process;

let forceColor;
if (hasFlag('no-color') ||
	hasFlag('no-colors') ||
	hasFlag('color=false') ||
	hasFlag('color=never')) {
	forceColor = 0;
} else if (hasFlag('color') ||
	hasFlag('colors') ||
	hasFlag('color=true') ||
	hasFlag('color=always')) {
	forceColor = 1;
}

if ('FORCE_COLOR' in env) {
	if (env.FORCE_COLOR === 'true') {
		forceColor = 1;
	} else if (env.FORCE_COLOR === 'false') {
		forceColor = 0;
	} else {
		forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
	}
}

function translateLevel(level) {
	if (level === 0) {
		return false;
	}

	return {
		level,
		hasBasic: true,
		has256: level >= 2,
		has16m: level >= 3
	};
}

function supportsColor(haveStream, streamIsTTY) {
	if (forceColor === 0) {
		return 0;
	}

	if (hasFlag('color=16m') ||
		hasFlag('color=full') ||
		hasFlag('color=truecolor')) {
		return 3;
	}

	if (hasFlag('color=256')) {
		return 2;
	}

	if (haveStream && !streamIsTTY && forceColor === undefined) {
		return 0;
	}

	const min = forceColor || 0;

	if (env.TERM === 'dumb') {
		return min;
	}

	if (process.platform === 'win32') {
		// Windows 10 build 10586 is the first Windows release that supports 256 colors.
		// Windows 10 build 14931 is the first release that supports 16m/TrueColor.
		const osRelease = os.release().split('.');
		if (
			Number(osRelease[0]) >= 10 &&
			Number(osRelease[2]) >= 10586
		) {
			return Number(osRelease[2]) >= 14931 ? 3 : 2;
		}

		return 1;
	}

	if ('CI' in env) {
		if (['TRAVIS', 'CIRCLECI', 'APPVEYOR', 'GITLAB_CI', 'GITHUB_ACTIONS', 'BUILDKITE'].some(sign => sign in env) || env.CI_NAME === 'codeship') {
			return 1;
		}

		return min;
	}

	if ('TEAMCITY_VERSION' in env) {
		return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
	}

	if (env.COLORTERM === 'truecolor') {
		return 3;
	}

	if ('TERM_PROGRAM' in env) {
		const version = parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);

		switch (env.TERM_PROGRAM) {
			case 'iTerm.app':
				return version >= 3 ? 3 : 2;
			case 'Apple_Terminal':
				return 2;
			// No default
		}
	}

	if (/-256(color)?$/i.test(env.TERM)) {
		return 2;
	}

	if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
		return 1;
	}

	if ('COLORTERM' in env) {
		return 1;
	}

	return min;
}

function getSupportLevel(stream) {
	const level = supportsColor(stream, stream && stream.isTTY);
	return translateLevel(level);
}

module.exports = {
	supportsColor: getSupportLevel,
	stdout: translateLevel(supportsColor(true, tty.isatty(1))),
	stderr: translateLevel(supportsColor(true, tty.isatty(2)))
};

},{"has-flag":23,"os":undefined,"tty":undefined}],51:[function(require,module,exports){
"use strict";

const punycode = require("punycode/");
const regexes = require("./lib/regexes.js");
const mappingTable = require("./lib/mappingTable.json");
const { STATUS_MAPPING } = require("./lib/statusMapping.js");

function containsNonASCII(str) {
  return /[^\x00-\x7F]/u.test(str);
}

function findStatus(val, { useSTD3ASCIIRules }) {
  let start = 0;
  let end = mappingTable.length - 1;

  while (start <= end) {
    const mid = Math.floor((start + end) / 2);

    const target = mappingTable[mid];
    const min = Array.isArray(target[0]) ? target[0][0] : target[0];
    const max = Array.isArray(target[0]) ? target[0][1] : target[0];

    if (min <= val && max >= val) {
      if (useSTD3ASCIIRules &&
          (target[1] === STATUS_MAPPING.disallowed_STD3_valid || target[1] === STATUS_MAPPING.disallowed_STD3_mapped)) {
        return [STATUS_MAPPING.disallowed, ...target.slice(2)];
      } else if (target[1] === STATUS_MAPPING.disallowed_STD3_valid) {
        return [STATUS_MAPPING.valid, ...target.slice(2)];
      } else if (target[1] === STATUS_MAPPING.disallowed_STD3_mapped) {
        return [STATUS_MAPPING.mapped, ...target.slice(2)];
      }

      return target.slice(1);
    } else if (min > val) {
      end = mid - 1;
    } else {
      start = mid + 1;
    }
  }

  return null;
}

function mapChars(domainName, { useSTD3ASCIIRules, transitionalProcessing }) {
  let processed = "";

  for (const ch of domainName) {
    const [status, mapping] = findStatus(ch.codePointAt(0), { useSTD3ASCIIRules });

    switch (status) {
      case STATUS_MAPPING.disallowed:
        processed += ch;
        break;
      case STATUS_MAPPING.ignored:
        break;
      case STATUS_MAPPING.mapped:
        if (transitionalProcessing && ch === "ẞ") {
          processed += "ss";
        } else {
          processed += mapping;
        }
        break;
      case STATUS_MAPPING.deviation:
        if (transitionalProcessing) {
          processed += mapping;
        } else {
          processed += ch;
        }
        break;
      case STATUS_MAPPING.valid:
        processed += ch;
        break;
    }
  }

  return processed;
}

function validateLabel(label, {
  checkHyphens,
  checkBidi,
  checkJoiners,
  transitionalProcessing,
  useSTD3ASCIIRules,
  isBidi
}) {
  // "must be satisfied for a non-empty label"
  if (label.length === 0) {
    return true;
  }

  // "1. The label must be in Unicode Normalization Form NFC."
  if (label.normalize("NFC") !== label) {
    return false;
  }

  const codePoints = Array.from(label);

  // "2. If CheckHyphens, the label must not contain a U+002D HYPHEN-MINUS character in both the
  // third and fourth positions."
  //
  // "3. If CheckHyphens, the label must neither begin nor end with a U+002D HYPHEN-MINUS character."
  if (checkHyphens) {
    if ((codePoints[2] === "-" && codePoints[3] === "-") ||
        (label.startsWith("-") || label.endsWith("-"))) {
      return false;
    }
  }

  // "4. If not CheckHyphens, the label must not begin with “xn--”."
  // Disabled while we figure out https://github.com/whatwg/url/issues/803.
  // if (!checkHyphens) {
  //   if (label.startsWith("xn--")) {
  //     return false;
  //   }
  // }

  // "5. The label must not contain a U+002E ( . ) FULL STOP."
  if (label.includes(".")) {
    return false;
  }

  // "6. The label must not begin with a combining mark, that is: General_Category=Mark."
  if (regexes.combiningMarks.test(codePoints[0])) {
    return false;
  }

  // "7. Each code point in the label must only have certain Status values according to Section 5"
  for (const ch of codePoints) {
    const [status] = findStatus(ch.codePointAt(0), { useSTD3ASCIIRules });
    if (transitionalProcessing) {
      // "For Transitional Processing (deprecated), each value must be valid."
      if (status !== STATUS_MAPPING.valid) {
        return false;
      }
    } else if (status !== STATUS_MAPPING.valid && status !== STATUS_MAPPING.deviation) {
      // "For Nontransitional Processing, each value must be either valid or deviation."
      return false;
    }
  }

  // "8. If CheckJoiners, the label must satisify the ContextJ rules"
  // https://tools.ietf.org/html/rfc5892#appendix-A
  if (checkJoiners) {
    let last = 0;
    for (const [i, ch] of codePoints.entries()) {
      if (ch === "\u200C" || ch === "\u200D") {
        if (i > 0) {
          if (regexes.combiningClassVirama.test(codePoints[i - 1])) {
            continue;
          }
          if (ch === "\u200C") {
            // TODO: make this more efficient
            const next = codePoints.indexOf("\u200C", i + 1);
            const test = next < 0 ? codePoints.slice(last) : codePoints.slice(last, next);
            if (regexes.validZWNJ.test(test.join(""))) {
              last = i + 1;
              continue;
            }
          }
        }
        return false;
      }
    }
  }

  // "9. If CheckBidi, and if the domain name is a Bidi domain name, then the label must satisfy..."
  // https://tools.ietf.org/html/rfc5893#section-2
  if (checkBidi && isBidi) {
    let rtl;

    // 1
    if (regexes.bidiS1LTR.test(codePoints[0])) {
      rtl = false;
    } else if (regexes.bidiS1RTL.test(codePoints[0])) {
      rtl = true;
    } else {
      return false;
    }

    if (rtl) {
      // 2-4
      if (!regexes.bidiS2.test(label) ||
          !regexes.bidiS3.test(label) ||
          (regexes.bidiS4EN.test(label) && regexes.bidiS4AN.test(label))) {
        return false;
      }
    } else if (!regexes.bidiS5.test(label) ||
               !regexes.bidiS6.test(label)) { // 5-6
      return false;
    }
  }

  return true;
}

function isBidiDomain(labels) {
  const domain = labels.map(label => {
    if (label.startsWith("xn--")) {
      try {
        return punycode.decode(label.substring(4));
      } catch (err) {
        return "";
      }
    }
    return label;
  }).join(".");
  return regexes.bidiDomain.test(domain);
}

function processing(domainName, options) {
  // 1. Map.
  let string = mapChars(domainName, options);

  // 2. Normalize.
  string = string.normalize("NFC");

  // 3. Break.
  const labels = string.split(".");
  const isBidi = isBidiDomain(labels);

  // 4. Convert/Validate.
  let error = false;
  for (const [i, origLabel] of labels.entries()) {
    let label = origLabel;
    let transitionalProcessingForThisLabel = options.transitionalProcessing;
    if (label.startsWith("xn--")) {
      if (containsNonASCII(label)) {
        error = true;
        continue;
      }

      try {
        label = punycode.decode(label.substring(4));
      } catch {
        if (!options.ignoreInvalidPunycode) {
          error = true;
          continue;
        }
      }
      labels[i] = label;
      transitionalProcessingForThisLabel = false;
    }

    // No need to validate if we already know there is an error.
    if (error) {
      continue;
    }
    const validation = validateLabel(label, {
      ...options,
      transitionalProcessing: transitionalProcessingForThisLabel,
      isBidi
    });
    if (!validation) {
      error = true;
    }
  }

  return {
    string: labels.join("."),
    error
  };
}

function toASCII(domainName, {
  checkHyphens = false,
  checkBidi = false,
  checkJoiners = false,
  useSTD3ASCIIRules = false,
  verifyDNSLength = false,
  transitionalProcessing = false,
  ignoreInvalidPunycode = false
} = {}) {
  const result = processing(domainName, {
    checkHyphens,
    checkBidi,
    checkJoiners,
    useSTD3ASCIIRules,
    transitionalProcessing,
    ignoreInvalidPunycode
  });
  let labels = result.string.split(".");
  labels = labels.map(l => {
    if (containsNonASCII(l)) {
      try {
        return `xn--${punycode.encode(l)}`;
      } catch (e) {
        result.error = true;
      }
    }
    return l;
  });

  if (verifyDNSLength) {
    const total = labels.join(".").length;
    if (total > 253 || total === 0) {
      result.error = true;
    }

    for (let i = 0; i < labels.length; ++i) {
      if (labels[i].length > 63 || labels[i].length === 0) {
        result.error = true;
        break;
      }
    }
  }

  if (result.error) {
    return null;
  }
  return labels.join(".");
}

function toUnicode(domainName, {
  checkHyphens = false,
  checkBidi = false,
  checkJoiners = false,
  useSTD3ASCIIRules = false,
  transitionalProcessing = false,
  ignoreInvalidPunycode = false
} = {}) {
  const result = processing(domainName, {
    checkHyphens,
    checkBidi,
    checkJoiners,
    useSTD3ASCIIRules,
    transitionalProcessing,
    ignoreInvalidPunycode
  });

  return {
    domain: result.string,
    error: result.error
  };
}

module.exports = {
  toASCII,
  toUnicode
};

},{"./lib/mappingTable.json":52,"./lib/regexes.js":53,"./lib/statusMapping.js":54,"punycode/":55}],52:[function(require,module,exports){
module.exports=[[[0,44],4],[[45,46],2],[47,4],[[48,57],2],[[58,64],4],[65,1,"a"],[66,1,"b"],[67,1,"c"],[68,1,"d"],[69,1,"e"],[70,1,"f"],[71,1,"g"],[72,1,"h"],[73,1,"i"],[74,1,"j"],[75,1,"k"],[76,1,"l"],[77,1,"m"],[78,1,"n"],[79,1,"o"],[80,1,"p"],[81,1,"q"],[82,1,"r"],[83,1,"s"],[84,1,"t"],[85,1,"u"],[86,1,"v"],[87,1,"w"],[88,1,"x"],[89,1,"y"],[90,1,"z"],[[91,96],4],[[97,122],2],[[123,127],4],[[128,159],3],[160,5," "],[[161,167],2],[168,5," ̈"],[169,2],[170,1,"a"],[[171,172],2],[173,7],[174,2],[175,5," ̄"],[[176,177],2],[178,1,"2"],[179,1,"3"],[180,5," ́"],[181,1,"μ"],[182,2],[183,2],[184,5," ̧"],[185,1,"1"],[186,1,"o"],[187,2],[188,1,"1⁄4"],[189,1,"1⁄2"],[190,1,"3⁄4"],[191,2],[192,1,"à"],[193,1,"á"],[194,1,"â"],[195,1,"ã"],[196,1,"ä"],[197,1,"å"],[198,1,"æ"],[199,1,"ç"],[200,1,"è"],[201,1,"é"],[202,1,"ê"],[203,1,"ë"],[204,1,"ì"],[205,1,"í"],[206,1,"î"],[207,1,"ï"],[208,1,"ð"],[209,1,"ñ"],[210,1,"ò"],[211,1,"ó"],[212,1,"ô"],[213,1,"õ"],[214,1,"ö"],[215,2],[216,1,"ø"],[217,1,"ù"],[218,1,"ú"],[219,1,"û"],[220,1,"ü"],[221,1,"ý"],[222,1,"þ"],[223,6,"ss"],[[224,246],2],[247,2],[[248,255],2],[256,1,"ā"],[257,2],[258,1,"ă"],[259,2],[260,1,"ą"],[261,2],[262,1,"ć"],[263,2],[264,1,"ĉ"],[265,2],[266,1,"ċ"],[267,2],[268,1,"č"],[269,2],[270,1,"ď"],[271,2],[272,1,"đ"],[273,2],[274,1,"ē"],[275,2],[276,1,"ĕ"],[277,2],[278,1,"ė"],[279,2],[280,1,"ę"],[281,2],[282,1,"ě"],[283,2],[284,1,"ĝ"],[285,2],[286,1,"ğ"],[287,2],[288,1,"ġ"],[289,2],[290,1,"ģ"],[291,2],[292,1,"ĥ"],[293,2],[294,1,"ħ"],[295,2],[296,1,"ĩ"],[297,2],[298,1,"ī"],[299,2],[300,1,"ĭ"],[301,2],[302,1,"į"],[303,2],[304,1,"i̇"],[305,2],[[306,307],1,"ij"],[308,1,"ĵ"],[309,2],[310,1,"ķ"],[[311,312],2],[313,1,"ĺ"],[314,2],[315,1,"ļ"],[316,2],[317,1,"ľ"],[318,2],[[319,320],1,"l·"],[321,1,"ł"],[322,2],[323,1,"ń"],[324,2],[325,1,"ņ"],[326,2],[327,1,"ň"],[328,2],[329,1,"ʼn"],[330,1,"ŋ"],[331,2],[332,1,"ō"],[333,2],[334,1,"ŏ"],[335,2],[336,1,"ő"],[337,2],[338,1,"œ"],[339,2],[340,1,"ŕ"],[341,2],[342,1,"ŗ"],[343,2],[344,1,"ř"],[345,2],[346,1,"ś"],[347,2],[348,1,"ŝ"],[349,2],[350,1,"ş"],[351,2],[352,1,"š"],[353,2],[354,1,"ţ"],[355,2],[356,1,"ť"],[357,2],[358,1,"ŧ"],[359,2],[360,1,"ũ"],[361,2],[362,1,"ū"],[363,2],[364,1,"ŭ"],[365,2],[366,1,"ů"],[367,2],[368,1,"ű"],[369,2],[370,1,"ų"],[371,2],[372,1,"ŵ"],[373,2],[374,1,"ŷ"],[375,2],[376,1,"ÿ"],[377,1,"ź"],[378,2],[379,1,"ż"],[380,2],[381,1,"ž"],[382,2],[383,1,"s"],[384,2],[385,1,"ɓ"],[386,1,"ƃ"],[387,2],[388,1,"ƅ"],[389,2],[390,1,"ɔ"],[391,1,"ƈ"],[392,2],[393,1,"ɖ"],[394,1,"ɗ"],[395,1,"ƌ"],[[396,397],2],[398,1,"ǝ"],[399,1,"ə"],[400,1,"ɛ"],[401,1,"ƒ"],[402,2],[403,1,"ɠ"],[404,1,"ɣ"],[405,2],[406,1,"ɩ"],[407,1,"ɨ"],[408,1,"ƙ"],[[409,411],2],[412,1,"ɯ"],[413,1,"ɲ"],[414,2],[415,1,"ɵ"],[416,1,"ơ"],[417,2],[418,1,"ƣ"],[419,2],[420,1,"ƥ"],[421,2],[422,1,"ʀ"],[423,1,"ƨ"],[424,2],[425,1,"ʃ"],[[426,427],2],[428,1,"ƭ"],[429,2],[430,1,"ʈ"],[431,1,"ư"],[432,2],[433,1,"ʊ"],[434,1,"ʋ"],[435,1,"ƴ"],[436,2],[437,1,"ƶ"],[438,2],[439,1,"ʒ"],[440,1,"ƹ"],[[441,443],2],[444,1,"ƽ"],[[445,451],2],[[452,454],1,"dž"],[[455,457],1,"lj"],[[458,460],1,"nj"],[461,1,"ǎ"],[462,2],[463,1,"ǐ"],[464,2],[465,1,"ǒ"],[466,2],[467,1,"ǔ"],[468,2],[469,1,"ǖ"],[470,2],[471,1,"ǘ"],[472,2],[473,1,"ǚ"],[474,2],[475,1,"ǜ"],[[476,477],2],[478,1,"ǟ"],[479,2],[480,1,"ǡ"],[481,2],[482,1,"ǣ"],[483,2],[484,1,"ǥ"],[485,2],[486,1,"ǧ"],[487,2],[488,1,"ǩ"],[489,2],[490,1,"ǫ"],[491,2],[492,1,"ǭ"],[493,2],[494,1,"ǯ"],[[495,496],2],[[497,499],1,"dz"],[500,1,"ǵ"],[501,2],[502,1,"ƕ"],[503,1,"ƿ"],[504,1,"ǹ"],[505,2],[506,1,"ǻ"],[507,2],[508,1,"ǽ"],[509,2],[510,1,"ǿ"],[511,2],[512,1,"ȁ"],[513,2],[514,1,"ȃ"],[515,2],[516,1,"ȅ"],[517,2],[518,1,"ȇ"],[519,2],[520,1,"ȉ"],[521,2],[522,1,"ȋ"],[523,2],[524,1,"ȍ"],[525,2],[526,1,"ȏ"],[527,2],[528,1,"ȑ"],[529,2],[530,1,"ȓ"],[531,2],[532,1,"ȕ"],[533,2],[534,1,"ȗ"],[535,2],[536,1,"ș"],[537,2],[538,1,"ț"],[539,2],[540,1,"ȝ"],[541,2],[542,1,"ȟ"],[543,2],[544,1,"ƞ"],[545,2],[546,1,"ȣ"],[547,2],[548,1,"ȥ"],[549,2],[550,1,"ȧ"],[551,2],[552,1,"ȩ"],[553,2],[554,1,"ȫ"],[555,2],[556,1,"ȭ"],[557,2],[558,1,"ȯ"],[559,2],[560,1,"ȱ"],[561,2],[562,1,"ȳ"],[563,2],[[564,566],2],[[567,569],2],[570,1,"ⱥ"],[571,1,"ȼ"],[572,2],[573,1,"ƚ"],[574,1,"ⱦ"],[[575,576],2],[577,1,"ɂ"],[578,2],[579,1,"ƀ"],[580,1,"ʉ"],[581,1,"ʌ"],[582,1,"ɇ"],[583,2],[584,1,"ɉ"],[585,2],[586,1,"ɋ"],[587,2],[588,1,"ɍ"],[589,2],[590,1,"ɏ"],[591,2],[[592,680],2],[[681,685],2],[[686,687],2],[688,1,"h"],[689,1,"ɦ"],[690,1,"j"],[691,1,"r"],[692,1,"ɹ"],[693,1,"ɻ"],[694,1,"ʁ"],[695,1,"w"],[696,1,"y"],[[697,705],2],[[706,709],2],[[710,721],2],[[722,727],2],[728,5," ̆"],[729,5," ̇"],[730,5," ̊"],[731,5," ̨"],[732,5," ̃"],[733,5," ̋"],[734,2],[735,2],[736,1,"ɣ"],[737,1,"l"],[738,1,"s"],[739,1,"x"],[740,1,"ʕ"],[[741,745],2],[[746,747],2],[748,2],[749,2],[750,2],[[751,767],2],[[768,831],2],[832,1,"̀"],[833,1,"́"],[834,2],[835,1,"̓"],[836,1,"̈́"],[837,1,"ι"],[[838,846],2],[847,7],[[848,855],2],[[856,860],2],[[861,863],2],[[864,865],2],[866,2],[[867,879],2],[880,1,"ͱ"],[881,2],[882,1,"ͳ"],[883,2],[884,1,"ʹ"],[885,2],[886,1,"ͷ"],[887,2],[[888,889],3],[890,5," ι"],[[891,893],2],[894,5,";"],[895,1,"ϳ"],[[896,899],3],[900,5," ́"],[901,5," ̈́"],[902,1,"ά"],[903,1,"·"],[904,1,"έ"],[905,1,"ή"],[906,1,"ί"],[907,3],[908,1,"ό"],[909,3],[910,1,"ύ"],[911,1,"ώ"],[912,2],[913,1,"α"],[914,1,"β"],[915,1,"γ"],[916,1,"δ"],[917,1,"ε"],[918,1,"ζ"],[919,1,"η"],[920,1,"θ"],[921,1,"ι"],[922,1,"κ"],[923,1,"λ"],[924,1,"μ"],[925,1,"ν"],[926,1,"ξ"],[927,1,"ο"],[928,1,"π"],[929,1,"ρ"],[930,3],[931,1,"σ"],[932,1,"τ"],[933,1,"υ"],[934,1,"φ"],[935,1,"χ"],[936,1,"ψ"],[937,1,"ω"],[938,1,"ϊ"],[939,1,"ϋ"],[[940,961],2],[962,6,"σ"],[[963,974],2],[975,1,"ϗ"],[976,1,"β"],[977,1,"θ"],[978,1,"υ"],[979,1,"ύ"],[980,1,"ϋ"],[981,1,"φ"],[982,1,"π"],[983,2],[984,1,"ϙ"],[985,2],[986,1,"ϛ"],[987,2],[988,1,"ϝ"],[989,2],[990,1,"ϟ"],[991,2],[992,1,"ϡ"],[993,2],[994,1,"ϣ"],[995,2],[996,1,"ϥ"],[997,2],[998,1,"ϧ"],[999,2],[1000,1,"ϩ"],[1001,2],[1002,1,"ϫ"],[1003,2],[1004,1,"ϭ"],[1005,2],[1006,1,"ϯ"],[1007,2],[1008,1,"κ"],[1009,1,"ρ"],[1010,1,"σ"],[1011,2],[1012,1,"θ"],[1013,1,"ε"],[1014,2],[1015,1,"ϸ"],[1016,2],[1017,1,"σ"],[1018,1,"ϻ"],[1019,2],[1020,2],[1021,1,"ͻ"],[1022,1,"ͼ"],[1023,1,"ͽ"],[1024,1,"ѐ"],[1025,1,"ё"],[1026,1,"ђ"],[1027,1,"ѓ"],[1028,1,"є"],[1029,1,"ѕ"],[1030,1,"і"],[1031,1,"ї"],[1032,1,"ј"],[1033,1,"љ"],[1034,1,"њ"],[1035,1,"ћ"],[1036,1,"ќ"],[1037,1,"ѝ"],[1038,1,"ў"],[1039,1,"џ"],[1040,1,"а"],[1041,1,"б"],[1042,1,"в"],[1043,1,"г"],[1044,1,"д"],[1045,1,"е"],[1046,1,"ж"],[1047,1,"з"],[1048,1,"и"],[1049,1,"й"],[1050,1,"к"],[1051,1,"л"],[1052,1,"м"],[1053,1,"н"],[1054,1,"о"],[1055,1,"п"],[1056,1,"р"],[1057,1,"с"],[1058,1,"т"],[1059,1,"у"],[1060,1,"ф"],[1061,1,"х"],[1062,1,"ц"],[1063,1,"ч"],[1064,1,"ш"],[1065,1,"щ"],[1066,1,"ъ"],[1067,1,"ы"],[1068,1,"ь"],[1069,1,"э"],[1070,1,"ю"],[1071,1,"я"],[[1072,1103],2],[1104,2],[[1105,1116],2],[1117,2],[[1118,1119],2],[1120,1,"ѡ"],[1121,2],[1122,1,"ѣ"],[1123,2],[1124,1,"ѥ"],[1125,2],[1126,1,"ѧ"],[1127,2],[1128,1,"ѩ"],[1129,2],[1130,1,"ѫ"],[1131,2],[1132,1,"ѭ"],[1133,2],[1134,1,"ѯ"],[1135,2],[1136,1,"ѱ"],[1137,2],[1138,1,"ѳ"],[1139,2],[1140,1,"ѵ"],[1141,2],[1142,1,"ѷ"],[1143,2],[1144,1,"ѹ"],[1145,2],[1146,1,"ѻ"],[1147,2],[1148,1,"ѽ"],[1149,2],[1150,1,"ѿ"],[1151,2],[1152,1,"ҁ"],[1153,2],[1154,2],[[1155,1158],2],[1159,2],[[1160,1161],2],[1162,1,"ҋ"],[1163,2],[1164,1,"ҍ"],[1165,2],[1166,1,"ҏ"],[1167,2],[1168,1,"ґ"],[1169,2],[1170,1,"ғ"],[1171,2],[1172,1,"ҕ"],[1173,2],[1174,1,"җ"],[1175,2],[1176,1,"ҙ"],[1177,2],[1178,1,"қ"],[1179,2],[1180,1,"ҝ"],[1181,2],[1182,1,"ҟ"],[1183,2],[1184,1,"ҡ"],[1185,2],[1186,1,"ң"],[1187,2],[1188,1,"ҥ"],[1189,2],[1190,1,"ҧ"],[1191,2],[1192,1,"ҩ"],[1193,2],[1194,1,"ҫ"],[1195,2],[1196,1,"ҭ"],[1197,2],[1198,1,"ү"],[1199,2],[1200,1,"ұ"],[1201,2],[1202,1,"ҳ"],[1203,2],[1204,1,"ҵ"],[1205,2],[1206,1,"ҷ"],[1207,2],[1208,1,"ҹ"],[1209,2],[1210,1,"һ"],[1211,2],[1212,1,"ҽ"],[1213,2],[1214,1,"ҿ"],[1215,2],[1216,3],[1217,1,"ӂ"],[1218,2],[1219,1,"ӄ"],[1220,2],[1221,1,"ӆ"],[1222,2],[1223,1,"ӈ"],[1224,2],[1225,1,"ӊ"],[1226,2],[1227,1,"ӌ"],[1228,2],[1229,1,"ӎ"],[1230,2],[1231,2],[1232,1,"ӑ"],[1233,2],[1234,1,"ӓ"],[1235,2],[1236,1,"ӕ"],[1237,2],[1238,1,"ӗ"],[1239,2],[1240,1,"ә"],[1241,2],[1242,1,"ӛ"],[1243,2],[1244,1,"ӝ"],[1245,2],[1246,1,"ӟ"],[1247,2],[1248,1,"ӡ"],[1249,2],[1250,1,"ӣ"],[1251,2],[1252,1,"ӥ"],[1253,2],[1254,1,"ӧ"],[1255,2],[1256,1,"ө"],[1257,2],[1258,1,"ӫ"],[1259,2],[1260,1,"ӭ"],[1261,2],[1262,1,"ӯ"],[1263,2],[1264,1,"ӱ"],[1265,2],[1266,1,"ӳ"],[1267,2],[1268,1,"ӵ"],[1269,2],[1270,1,"ӷ"],[1271,2],[1272,1,"ӹ"],[1273,2],[1274,1,"ӻ"],[1275,2],[1276,1,"ӽ"],[1277,2],[1278,1,"ӿ"],[1279,2],[1280,1,"ԁ"],[1281,2],[1282,1,"ԃ"],[1283,2],[1284,1,"ԅ"],[1285,2],[1286,1,"ԇ"],[1287,2],[1288,1,"ԉ"],[1289,2],[1290,1,"ԋ"],[1291,2],[1292,1,"ԍ"],[1293,2],[1294,1,"ԏ"],[1295,2],[1296,1,"ԑ"],[1297,2],[1298,1,"ԓ"],[1299,2],[1300,1,"ԕ"],[1301,2],[1302,1,"ԗ"],[1303,2],[1304,1,"ԙ"],[1305,2],[1306,1,"ԛ"],[1307,2],[1308,1,"ԝ"],[1309,2],[1310,1,"ԟ"],[1311,2],[1312,1,"ԡ"],[1313,2],[1314,1,"ԣ"],[1315,2],[1316,1,"ԥ"],[1317,2],[1318,1,"ԧ"],[1319,2],[1320,1,"ԩ"],[1321,2],[1322,1,"ԫ"],[1323,2],[1324,1,"ԭ"],[1325,2],[1326,1,"ԯ"],[1327,2],[1328,3],[1329,1,"ա"],[1330,1,"բ"],[1331,1,"գ"],[1332,1,"դ"],[1333,1,"ե"],[1334,1,"զ"],[1335,1,"է"],[1336,1,"ը"],[1337,1,"թ"],[1338,1,"ժ"],[1339,1,"ի"],[1340,1,"լ"],[1341,1,"խ"],[1342,1,"ծ"],[1343,1,"կ"],[1344,1,"հ"],[1345,1,"ձ"],[1346,1,"ղ"],[1347,1,"ճ"],[1348,1,"մ"],[1349,1,"յ"],[1350,1,"ն"],[1351,1,"շ"],[1352,1,"ո"],[1353,1,"չ"],[1354,1,"պ"],[1355,1,"ջ"],[1356,1,"ռ"],[1357,1,"ս"],[1358,1,"վ"],[1359,1,"տ"],[1360,1,"ր"],[1361,1,"ց"],[1362,1,"ւ"],[1363,1,"փ"],[1364,1,"ք"],[1365,1,"օ"],[1366,1,"ֆ"],[[1367,1368],3],[1369,2],[[1370,1375],2],[1376,2],[[1377,1414],2],[1415,1,"եւ"],[1416,2],[1417,2],[1418,2],[[1419,1420],3],[[1421,1422],2],[1423,2],[1424,3],[[1425,1441],2],[1442,2],[[1443,1455],2],[[1456,1465],2],[1466,2],[[1467,1469],2],[1470,2],[1471,2],[1472,2],[[1473,1474],2],[1475,2],[1476,2],[1477,2],[1478,2],[1479,2],[[1480,1487],3],[[1488,1514],2],[[1515,1518],3],[1519,2],[[1520,1524],2],[[1525,1535],3],[[1536,1539],3],[1540,3],[1541,3],[[1542,1546],2],[1547,2],[1548,2],[[1549,1551],2],[[1552,1557],2],[[1558,1562],2],[1563,2],[1564,3],[1565,2],[1566,2],[1567,2],[1568,2],[[1569,1594],2],[[1595,1599],2],[1600,2],[[1601,1618],2],[[1619,1621],2],[[1622,1624],2],[[1625,1630],2],[1631,2],[[1632,1641],2],[[1642,1645],2],[[1646,1647],2],[[1648,1652],2],[1653,1,"اٴ"],[1654,1,"وٴ"],[1655,1,"ۇٴ"],[1656,1,"يٴ"],[[1657,1719],2],[[1720,1721],2],[[1722,1726],2],[1727,2],[[1728,1742],2],[1743,2],[[1744,1747],2],[1748,2],[[1749,1756],2],[1757,3],[1758,2],[[1759,1768],2],[1769,2],[[1770,1773],2],[[1774,1775],2],[[1776,1785],2],[[1786,1790],2],[1791,2],[[1792,1805],2],[1806,3],[1807,3],[[1808,1836],2],[[1837,1839],2],[[1840,1866],2],[[1867,1868],3],[[1869,1871],2],[[1872,1901],2],[[1902,1919],2],[[1920,1968],2],[1969,2],[[1970,1983],3],[[1984,2037],2],[[2038,2042],2],[[2043,2044],3],[2045,2],[[2046,2047],2],[[2048,2093],2],[[2094,2095],3],[[2096,2110],2],[2111,3],[[2112,2139],2],[[2140,2141],3],[2142,2],[2143,3],[[2144,2154],2],[[2155,2159],3],[[2160,2183],2],[2184,2],[[2185,2190],2],[2191,3],[[2192,2193],3],[[2194,2199],3],[[2200,2207],2],[2208,2],[2209,2],[[2210,2220],2],[[2221,2226],2],[[2227,2228],2],[2229,2],[[2230,2237],2],[[2238,2247],2],[[2248,2258],2],[2259,2],[[2260,2273],2],[2274,3],[2275,2],[[2276,2302],2],[2303,2],[2304,2],[[2305,2307],2],[2308,2],[[2309,2361],2],[[2362,2363],2],[[2364,2381],2],[2382,2],[2383,2],[[2384,2388],2],[2389,2],[[2390,2391],2],[2392,1,"क़"],[2393,1,"ख़"],[2394,1,"ग़"],[2395,1,"ज़"],[2396,1,"ड़"],[2397,1,"ढ़"],[2398,1,"फ़"],[2399,1,"य़"],[[2400,2403],2],[[2404,2405],2],[[2406,2415],2],[2416,2],[[2417,2418],2],[[2419,2423],2],[2424,2],[[2425,2426],2],[[2427,2428],2],[2429,2],[[2430,2431],2],[2432,2],[[2433,2435],2],[2436,3],[[2437,2444],2],[[2445,2446],3],[[2447,2448],2],[[2449,2450],3],[[2451,2472],2],[2473,3],[[2474,2480],2],[2481,3],[2482,2],[[2483,2485],3],[[2486,2489],2],[[2490,2491],3],[2492,2],[2493,2],[[2494,2500],2],[[2501,2502],3],[[2503,2504],2],[[2505,2506],3],[[2507,2509],2],[2510,2],[[2511,2518],3],[2519,2],[[2520,2523],3],[2524,1,"ড়"],[2525,1,"ঢ়"],[2526,3],[2527,1,"য়"],[[2528,2531],2],[[2532,2533],3],[[2534,2545],2],[[2546,2554],2],[2555,2],[2556,2],[2557,2],[2558,2],[[2559,2560],3],[2561,2],[2562,2],[2563,2],[2564,3],[[2565,2570],2],[[2571,2574],3],[[2575,2576],2],[[2577,2578],3],[[2579,2600],2],[2601,3],[[2602,2608],2],[2609,3],[2610,2],[2611,1,"ਲ਼"],[2612,3],[2613,2],[2614,1,"ਸ਼"],[2615,3],[[2616,2617],2],[[2618,2619],3],[2620,2],[2621,3],[[2622,2626],2],[[2627,2630],3],[[2631,2632],2],[[2633,2634],3],[[2635,2637],2],[[2638,2640],3],[2641,2],[[2642,2648],3],[2649,1,"ਖ਼"],[2650,1,"ਗ਼"],[2651,1,"ਜ਼"],[2652,2],[2653,3],[2654,1,"ਫ਼"],[[2655,2661],3],[[2662,2676],2],[2677,2],[2678,2],[[2679,2688],3],[[2689,2691],2],[2692,3],[[2693,2699],2],[2700,2],[2701,2],[2702,3],[[2703,2705],2],[2706,3],[[2707,2728],2],[2729,3],[[2730,2736],2],[2737,3],[[2738,2739],2],[2740,3],[[2741,2745],2],[[2746,2747],3],[[2748,2757],2],[2758,3],[[2759,2761],2],[2762,3],[[2763,2765],2],[[2766,2767],3],[2768,2],[[2769,2783],3],[2784,2],[[2785,2787],2],[[2788,2789],3],[[2790,2799],2],[2800,2],[2801,2],[[2802,2808],3],[2809,2],[[2810,2815],2],[2816,3],[[2817,2819],2],[2820,3],[[2821,2828],2],[[2829,2830],3],[[2831,2832],2],[[2833,2834],3],[[2835,2856],2],[2857,3],[[2858,2864],2],[2865,3],[[2866,2867],2],[2868,3],[2869,2],[[2870,2873],2],[[2874,2875],3],[[2876,2883],2],[2884,2],[[2885,2886],3],[[2887,2888],2],[[2889,2890],3],[[2891,2893],2],[[2894,2900],3],[2901,2],[[2902,2903],2],[[2904,2907],3],[2908,1,"ଡ଼"],[2909,1,"ଢ଼"],[2910,3],[[2911,2913],2],[[2914,2915],2],[[2916,2917],3],[[2918,2927],2],[2928,2],[2929,2],[[2930,2935],2],[[2936,2945],3],[[2946,2947],2],[2948,3],[[2949,2954],2],[[2955,2957],3],[[2958,2960],2],[2961,3],[[2962,2965],2],[[2966,2968],3],[[2969,2970],2],[2971,3],[2972,2],[2973,3],[[2974,2975],2],[[2976,2978],3],[[2979,2980],2],[[2981,2983],3],[[2984,2986],2],[[2987,2989],3],[[2990,2997],2],[2998,2],[[2999,3001],2],[[3002,3005],3],[[3006,3010],2],[[3011,3013],3],[[3014,3016],2],[3017,3],[[3018,3021],2],[[3022,3023],3],[3024,2],[[3025,3030],3],[3031,2],[[3032,3045],3],[3046,2],[[3047,3055],2],[[3056,3058],2],[[3059,3066],2],[[3067,3071],3],[3072,2],[[3073,3075],2],[3076,2],[[3077,3084],2],[3085,3],[[3086,3088],2],[3089,3],[[3090,3112],2],[3113,3],[[3114,3123],2],[3124,2],[[3125,3129],2],[[3130,3131],3],[3132,2],[3133,2],[[3134,3140],2],[3141,3],[[3142,3144],2],[3145,3],[[3146,3149],2],[[3150,3156],3],[[3157,3158],2],[3159,3],[[3160,3161],2],[3162,2],[[3163,3164],3],[3165,2],[[3166,3167],3],[[3168,3169],2],[[3170,3171],2],[[3172,3173],3],[[3174,3183],2],[[3184,3190],3],[3191,2],[[3192,3199],2],[3200,2],[3201,2],[[3202,3203],2],[3204,2],[[3205,3212],2],[3213,3],[[3214,3216],2],[3217,3],[[3218,3240],2],[3241,3],[[3242,3251],2],[3252,3],[[3253,3257],2],[[3258,3259],3],[[3260,3261],2],[[3262,3268],2],[3269,3],[[3270,3272],2],[3273,3],[[3274,3277],2],[[3278,3284],3],[[3285,3286],2],[[3287,3292],3],[3293,2],[3294,2],[3295,3],[[3296,3297],2],[[3298,3299],2],[[3300,3301],3],[[3302,3311],2],[3312,3],[[3313,3314],2],[3315,2],[[3316,3327],3],[3328,2],[3329,2],[[3330,3331],2],[3332,2],[[3333,3340],2],[3341,3],[[3342,3344],2],[3345,3],[[3346,3368],2],[3369,2],[[3370,3385],2],[3386,2],[[3387,3388],2],[3389,2],[[3390,3395],2],[3396,2],[3397,3],[[3398,3400],2],[3401,3],[[3402,3405],2],[3406,2],[3407,2],[[3408,3411],3],[[3412,3414],2],[3415,2],[[3416,3422],2],[3423,2],[[3424,3425],2],[[3426,3427],2],[[3428,3429],3],[[3430,3439],2],[[3440,3445],2],[[3446,3448],2],[3449,2],[[3450,3455],2],[3456,3],[3457,2],[[3458,3459],2],[3460,3],[[3461,3478],2],[[3479,3481],3],[[3482,3505],2],[3506,3],[[3507,3515],2],[3516,3],[3517,2],[[3518,3519],3],[[3520,3526],2],[[3527,3529],3],[3530,2],[[3531,3534],3],[[3535,3540],2],[3541,3],[3542,2],[3543,3],[[3544,3551],2],[[3552,3557],3],[[3558,3567],2],[[3568,3569],3],[[3570,3571],2],[3572,2],[[3573,3584],3],[[3585,3634],2],[3635,1,"ํา"],[[3636,3642],2],[[3643,3646],3],[3647,2],[[3648,3662],2],[3663,2],[[3664,3673],2],[[3674,3675],2],[[3676,3712],3],[[3713,3714],2],[3715,3],[3716,2],[3717,3],[3718,2],[[3719,3720],2],[3721,2],[3722,2],[3723,3],[3724,2],[3725,2],[[3726,3731],2],[[3732,3735],2],[3736,2],[[3737,3743],2],[3744,2],[[3745,3747],2],[3748,3],[3749,2],[3750,3],[3751,2],[[3752,3753],2],[[3754,3755],2],[3756,2],[[3757,3762],2],[3763,1,"ໍາ"],[[3764,3769],2],[3770,2],[[3771,3773],2],[[3774,3775],3],[[3776,3780],2],[3781,3],[3782,2],[3783,3],[[3784,3789],2],[3790,2],[3791,3],[[3792,3801],2],[[3802,3803],3],[3804,1,"ຫນ"],[3805,1,"ຫມ"],[[3806,3807],2],[[3808,3839],3],[3840,2],[[3841,3850],2],[3851,2],[3852,1,"་"],[[3853,3863],2],[[3864,3865],2],[[3866,3871],2],[[3872,3881],2],[[3882,3892],2],[3893,2],[3894,2],[3895,2],[3896,2],[3897,2],[[3898,3901],2],[[3902,3906],2],[3907,1,"གྷ"],[[3908,3911],2],[3912,3],[[3913,3916],2],[3917,1,"ཌྷ"],[[3918,3921],2],[3922,1,"དྷ"],[[3923,3926],2],[3927,1,"བྷ"],[[3928,3931],2],[3932,1,"ཛྷ"],[[3933,3944],2],[3945,1,"ཀྵ"],[3946,2],[[3947,3948],2],[[3949,3952],3],[[3953,3954],2],[3955,1,"ཱི"],[3956,2],[3957,1,"ཱུ"],[3958,1,"ྲྀ"],[3959,1,"ྲཱྀ"],[3960,1,"ླྀ"],[3961,1,"ླཱྀ"],[[3962,3968],2],[3969,1,"ཱྀ"],[[3970,3972],2],[3973,2],[[3974,3979],2],[[3980,3983],2],[[3984,3986],2],[3987,1,"ྒྷ"],[[3988,3989],2],[3990,2],[3991,2],[3992,3],[[3993,3996],2],[3997,1,"ྜྷ"],[[3998,4001],2],[4002,1,"ྡྷ"],[[4003,4006],2],[4007,1,"ྦྷ"],[[4008,4011],2],[4012,1,"ྫྷ"],[4013,2],[[4014,4016],2],[[4017,4023],2],[4024,2],[4025,1,"ྐྵ"],[[4026,4028],2],[4029,3],[[4030,4037],2],[4038,2],[[4039,4044],2],[4045,3],[4046,2],[4047,2],[[4048,4049],2],[[4050,4052],2],[[4053,4056],2],[[4057,4058],2],[[4059,4095],3],[[4096,4129],2],[4130,2],[[4131,4135],2],[4136,2],[[4137,4138],2],[4139,2],[[4140,4146],2],[[4147,4149],2],[[4150,4153],2],[[4154,4159],2],[[4160,4169],2],[[4170,4175],2],[[4176,4185],2],[[4186,4249],2],[[4250,4253],2],[[4254,4255],2],[[4256,4293],3],[4294,3],[4295,1,"ⴧ"],[[4296,4300],3],[4301,1,"ⴭ"],[[4302,4303],3],[[4304,4342],2],[[4343,4344],2],[[4345,4346],2],[4347,2],[4348,1,"ნ"],[[4349,4351],2],[[4352,4441],2],[[4442,4446],2],[[4447,4448],3],[[4449,4514],2],[[4515,4519],2],[[4520,4601],2],[[4602,4607],2],[[4608,4614],2],[4615,2],[[4616,4678],2],[4679,2],[4680,2],[4681,3],[[4682,4685],2],[[4686,4687],3],[[4688,4694],2],[4695,3],[4696,2],[4697,3],[[4698,4701],2],[[4702,4703],3],[[4704,4742],2],[4743,2],[4744,2],[4745,3],[[4746,4749],2],[[4750,4751],3],[[4752,4782],2],[4783,2],[4784,2],[4785,3],[[4786,4789],2],[[4790,4791],3],[[4792,4798],2],[4799,3],[4800,2],[4801,3],[[4802,4805],2],[[4806,4807],3],[[4808,4814],2],[4815,2],[[4816,4822],2],[4823,3],[[4824,4846],2],[4847,2],[[4848,4878],2],[4879,2],[4880,2],[4881,3],[[4882,4885],2],[[4886,4887],3],[[4888,4894],2],[4895,2],[[4896,4934],2],[4935,2],[[4936,4954],2],[[4955,4956],3],[[4957,4958],2],[4959,2],[4960,2],[[4961,4988],2],[[4989,4991],3],[[4992,5007],2],[[5008,5017],2],[[5018,5023],3],[[5024,5108],2],[5109,2],[[5110,5111],3],[5112,1,"Ᏸ"],[5113,1,"Ᏹ"],[5114,1,"Ᏺ"],[5115,1,"Ᏻ"],[5116,1,"Ᏼ"],[5117,1,"Ᏽ"],[[5118,5119],3],[5120,2],[[5121,5740],2],[[5741,5742],2],[[5743,5750],2],[[5751,5759],2],[5760,3],[[5761,5786],2],[[5787,5788],2],[[5789,5791],3],[[5792,5866],2],[[5867,5872],2],[[5873,5880],2],[[5881,5887],3],[[5888,5900],2],[5901,2],[[5902,5908],2],[5909,2],[[5910,5918],3],[5919,2],[[5920,5940],2],[[5941,5942],2],[[5943,5951],3],[[5952,5971],2],[[5972,5983],3],[[5984,5996],2],[5997,3],[[5998,6000],2],[6001,3],[[6002,6003],2],[[6004,6015],3],[[6016,6067],2],[[6068,6069],3],[[6070,6099],2],[[6100,6102],2],[6103,2],[[6104,6107],2],[6108,2],[6109,2],[[6110,6111],3],[[6112,6121],2],[[6122,6127],3],[[6128,6137],2],[[6138,6143],3],[[6144,6149],2],[6150,3],[[6151,6154],2],[[6155,6157],7],[6158,3],[6159,7],[[6160,6169],2],[[6170,6175],3],[[6176,6263],2],[6264,2],[[6265,6271],3],[[6272,6313],2],[6314,2],[[6315,6319],3],[[6320,6389],2],[[6390,6399],3],[[6400,6428],2],[[6429,6430],2],[6431,3],[[6432,6443],2],[[6444,6447],3],[[6448,6459],2],[[6460,6463],3],[6464,2],[[6465,6467],3],[[6468,6469],2],[[6470,6509],2],[[6510,6511],3],[[6512,6516],2],[[6517,6527],3],[[6528,6569],2],[[6570,6571],2],[[6572,6575],3],[[6576,6601],2],[[6602,6607],3],[[6608,6617],2],[6618,2],[[6619,6621],3],[[6622,6623],2],[[6624,6655],2],[[6656,6683],2],[[6684,6685],3],[[6686,6687],2],[[6688,6750],2],[6751,3],[[6752,6780],2],[[6781,6782],3],[[6783,6793],2],[[6794,6799],3],[[6800,6809],2],[[6810,6815],3],[[6816,6822],2],[6823,2],[[6824,6829],2],[[6830,6831],3],[[6832,6845],2],[6846,2],[[6847,6848],2],[[6849,6862],2],[[6863,6911],3],[[6912,6987],2],[6988,2],[[6989,6991],3],[[6992,7001],2],[[7002,7018],2],[[7019,7027],2],[[7028,7036],2],[[7037,7038],2],[7039,3],[[7040,7082],2],[[7083,7085],2],[[7086,7097],2],[[7098,7103],2],[[7104,7155],2],[[7156,7163],3],[[7164,7167],2],[[7168,7223],2],[[7224,7226],3],[[7227,7231],2],[[7232,7241],2],[[7242,7244],3],[[7245,7293],2],[[7294,7295],2],[7296,1,"в"],[7297,1,"д"],[7298,1,"о"],[7299,1,"с"],[[7300,7301],1,"т"],[7302,1,"ъ"],[7303,1,"ѣ"],[7304,1,"ꙋ"],[[7305,7311],3],[7312,1,"ა"],[7313,1,"ბ"],[7314,1,"გ"],[7315,1,"დ"],[7316,1,"ე"],[7317,1,"ვ"],[7318,1,"ზ"],[7319,1,"თ"],[7320,1,"ი"],[7321,1,"კ"],[7322,1,"ლ"],[7323,1,"მ"],[7324,1,"ნ"],[7325,1,"ო"],[7326,1,"პ"],[7327,1,"ჟ"],[7328,1,"რ"],[7329,1,"ს"],[7330,1,"ტ"],[7331,1,"უ"],[7332,1,"ფ"],[7333,1,"ქ"],[7334,1,"ღ"],[7335,1,"ყ"],[7336,1,"შ"],[7337,1,"ჩ"],[7338,1,"ც"],[7339,1,"ძ"],[7340,1,"წ"],[7341,1,"ჭ"],[7342,1,"ხ"],[7343,1,"ჯ"],[7344,1,"ჰ"],[7345,1,"ჱ"],[7346,1,"ჲ"],[7347,1,"ჳ"],[7348,1,"ჴ"],[7349,1,"ჵ"],[7350,1,"ჶ"],[7351,1,"ჷ"],[7352,1,"ჸ"],[7353,1,"ჹ"],[7354,1,"ჺ"],[[7355,7356],3],[7357,1,"ჽ"],[7358,1,"ჾ"],[7359,1,"ჿ"],[[7360,7367],2],[[7368,7375],3],[[7376,7378],2],[7379,2],[[7380,7410],2],[[7411,7414],2],[7415,2],[[7416,7417],2],[7418,2],[[7419,7423],3],[[7424,7467],2],[7468,1,"a"],[7469,1,"æ"],[7470,1,"b"],[7471,2],[7472,1,"d"],[7473,1,"e"],[7474,1,"ǝ"],[7475,1,"g"],[7476,1,"h"],[7477,1,"i"],[7478,1,"j"],[7479,1,"k"],[7480,1,"l"],[7481,1,"m"],[7482,1,"n"],[7483,2],[7484,1,"o"],[7485,1,"ȣ"],[7486,1,"p"],[7487,1,"r"],[7488,1,"t"],[7489,1,"u"],[7490,1,"w"],[7491,1,"a"],[7492,1,"ɐ"],[7493,1,"ɑ"],[7494,1,"ᴂ"],[7495,1,"b"],[7496,1,"d"],[7497,1,"e"],[7498,1,"ə"],[7499,1,"ɛ"],[7500,1,"ɜ"],[7501,1,"g"],[7502,2],[7503,1,"k"],[7504,1,"m"],[7505,1,"ŋ"],[7506,1,"o"],[7507,1,"ɔ"],[7508,1,"ᴖ"],[7509,1,"ᴗ"],[7510,1,"p"],[7511,1,"t"],[7512,1,"u"],[7513,1,"ᴝ"],[7514,1,"ɯ"],[7515,1,"v"],[7516,1,"ᴥ"],[7517,1,"β"],[7518,1,"γ"],[7519,1,"δ"],[7520,1,"φ"],[7521,1,"χ"],[7522,1,"i"],[7523,1,"r"],[7524,1,"u"],[7525,1,"v"],[7526,1,"β"],[7527,1,"γ"],[7528,1,"ρ"],[7529,1,"φ"],[7530,1,"χ"],[7531,2],[[7532,7543],2],[7544,1,"н"],[[7545,7578],2],[7579,1,"ɒ"],[7580,1,"c"],[7581,1,"ɕ"],[7582,1,"ð"],[7583,1,"ɜ"],[7584,1,"f"],[7585,1,"ɟ"],[7586,1,"ɡ"],[7587,1,"ɥ"],[7588,1,"ɨ"],[7589,1,"ɩ"],[7590,1,"ɪ"],[7591,1,"ᵻ"],[7592,1,"ʝ"],[7593,1,"ɭ"],[7594,1,"ᶅ"],[7595,1,"ʟ"],[7596,1,"ɱ"],[7597,1,"ɰ"],[7598,1,"ɲ"],[7599,1,"ɳ"],[7600,1,"ɴ"],[7601,1,"ɵ"],[7602,1,"ɸ"],[7603,1,"ʂ"],[7604,1,"ʃ"],[7605,1,"ƫ"],[7606,1,"ʉ"],[7607,1,"ʊ"],[7608,1,"ᴜ"],[7609,1,"ʋ"],[7610,1,"ʌ"],[7611,1,"z"],[7612,1,"ʐ"],[7613,1,"ʑ"],[7614,1,"ʒ"],[7615,1,"θ"],[[7616,7619],2],[[7620,7626],2],[[7627,7654],2],[[7655,7669],2],[[7670,7673],2],[7674,2],[7675,2],[7676,2],[7677,2],[[7678,7679],2],[7680,1,"ḁ"],[7681,2],[7682,1,"ḃ"],[7683,2],[7684,1,"ḅ"],[7685,2],[7686,1,"ḇ"],[7687,2],[7688,1,"ḉ"],[7689,2],[7690,1,"ḋ"],[7691,2],[7692,1,"ḍ"],[7693,2],[7694,1,"ḏ"],[7695,2],[7696,1,"ḑ"],[7697,2],[7698,1,"ḓ"],[7699,2],[7700,1,"ḕ"],[7701,2],[7702,1,"ḗ"],[7703,2],[7704,1,"ḙ"],[7705,2],[7706,1,"ḛ"],[7707,2],[7708,1,"ḝ"],[7709,2],[7710,1,"ḟ"],[7711,2],[7712,1,"ḡ"],[7713,2],[7714,1,"ḣ"],[7715,2],[7716,1,"ḥ"],[7717,2],[7718,1,"ḧ"],[7719,2],[7720,1,"ḩ"],[7721,2],[7722,1,"ḫ"],[7723,2],[7724,1,"ḭ"],[7725,2],[7726,1,"ḯ"],[7727,2],[7728,1,"ḱ"],[7729,2],[7730,1,"ḳ"],[7731,2],[7732,1,"ḵ"],[7733,2],[7734,1,"ḷ"],[7735,2],[7736,1,"ḹ"],[7737,2],[7738,1,"ḻ"],[7739,2],[7740,1,"ḽ"],[7741,2],[7742,1,"ḿ"],[7743,2],[7744,1,"ṁ"],[7745,2],[7746,1,"ṃ"],[7747,2],[7748,1,"ṅ"],[7749,2],[7750,1,"ṇ"],[7751,2],[7752,1,"ṉ"],[7753,2],[7754,1,"ṋ"],[7755,2],[7756,1,"ṍ"],[7757,2],[7758,1,"ṏ"],[7759,2],[7760,1,"ṑ"],[7761,2],[7762,1,"ṓ"],[7763,2],[7764,1,"ṕ"],[7765,2],[7766,1,"ṗ"],[7767,2],[7768,1,"ṙ"],[7769,2],[7770,1,"ṛ"],[7771,2],[7772,1,"ṝ"],[7773,2],[7774,1,"ṟ"],[7775,2],[7776,1,"ṡ"],[7777,2],[7778,1,"ṣ"],[7779,2],[7780,1,"ṥ"],[7781,2],[7782,1,"ṧ"],[7783,2],[7784,1,"ṩ"],[7785,2],[7786,1,"ṫ"],[7787,2],[7788,1,"ṭ"],[7789,2],[7790,1,"ṯ"],[7791,2],[7792,1,"ṱ"],[7793,2],[7794,1,"ṳ"],[7795,2],[7796,1,"ṵ"],[7797,2],[7798,1,"ṷ"],[7799,2],[7800,1,"ṹ"],[7801,2],[7802,1,"ṻ"],[7803,2],[7804,1,"ṽ"],[7805,2],[7806,1,"ṿ"],[7807,2],[7808,1,"ẁ"],[7809,2],[7810,1,"ẃ"],[7811,2],[7812,1,"ẅ"],[7813,2],[7814,1,"ẇ"],[7815,2],[7816,1,"ẉ"],[7817,2],[7818,1,"ẋ"],[7819,2],[7820,1,"ẍ"],[7821,2],[7822,1,"ẏ"],[7823,2],[7824,1,"ẑ"],[7825,2],[7826,1,"ẓ"],[7827,2],[7828,1,"ẕ"],[[7829,7833],2],[7834,1,"aʾ"],[7835,1,"ṡ"],[[7836,7837],2],[7838,1,"ß"],[7839,2],[7840,1,"ạ"],[7841,2],[7842,1,"ả"],[7843,2],[7844,1,"ấ"],[7845,2],[7846,1,"ầ"],[7847,2],[7848,1,"ẩ"],[7849,2],[7850,1,"ẫ"],[7851,2],[7852,1,"ậ"],[7853,2],[7854,1,"ắ"],[7855,2],[7856,1,"ằ"],[7857,2],[7858,1,"ẳ"],[7859,2],[7860,1,"ẵ"],[7861,2],[7862,1,"ặ"],[7863,2],[7864,1,"ẹ"],[7865,2],[7866,1,"ẻ"],[7867,2],[7868,1,"ẽ"],[7869,2],[7870,1,"ế"],[7871,2],[7872,1,"ề"],[7873,2],[7874,1,"ể"],[7875,2],[7876,1,"ễ"],[7877,2],[7878,1,"ệ"],[7879,2],[7880,1,"ỉ"],[7881,2],[7882,1,"ị"],[7883,2],[7884,1,"ọ"],[7885,2],[7886,1,"ỏ"],[7887,2],[7888,1,"ố"],[7889,2],[7890,1,"ồ"],[7891,2],[7892,1,"ổ"],[7893,2],[7894,1,"ỗ"],[7895,2],[7896,1,"ộ"],[7897,2],[7898,1,"ớ"],[7899,2],[7900,1,"ờ"],[7901,2],[7902,1,"ở"],[7903,2],[7904,1,"ỡ"],[7905,2],[7906,1,"ợ"],[7907,2],[7908,1,"ụ"],[7909,2],[7910,1,"ủ"],[7911,2],[7912,1,"ứ"],[7913,2],[7914,1,"ừ"],[7915,2],[7916,1,"ử"],[7917,2],[7918,1,"ữ"],[7919,2],[7920,1,"ự"],[7921,2],[7922,1,"ỳ"],[7923,2],[7924,1,"ỵ"],[7925,2],[7926,1,"ỷ"],[7927,2],[7928,1,"ỹ"],[7929,2],[7930,1,"ỻ"],[7931,2],[7932,1,"ỽ"],[7933,2],[7934,1,"ỿ"],[7935,2],[[7936,7943],2],[7944,1,"ἀ"],[7945,1,"ἁ"],[7946,1,"ἂ"],[7947,1,"ἃ"],[7948,1,"ἄ"],[7949,1,"ἅ"],[7950,1,"ἆ"],[7951,1,"ἇ"],[[7952,7957],2],[[7958,7959],3],[7960,1,"ἐ"],[7961,1,"ἑ"],[7962,1,"ἒ"],[7963,1,"ἓ"],[7964,1,"ἔ"],[7965,1,"ἕ"],[[7966,7967],3],[[7968,7975],2],[7976,1,"ἠ"],[7977,1,"ἡ"],[7978,1,"ἢ"],[7979,1,"ἣ"],[7980,1,"ἤ"],[7981,1,"ἥ"],[7982,1,"ἦ"],[7983,1,"ἧ"],[[7984,7991],2],[7992,1,"ἰ"],[7993,1,"ἱ"],[7994,1,"ἲ"],[7995,1,"ἳ"],[7996,1,"ἴ"],[7997,1,"ἵ"],[7998,1,"ἶ"],[7999,1,"ἷ"],[[8000,8005],2],[[8006,8007],3],[8008,1,"ὀ"],[8009,1,"ὁ"],[8010,1,"ὂ"],[8011,1,"ὃ"],[8012,1,"ὄ"],[8013,1,"ὅ"],[[8014,8015],3],[[8016,8023],2],[8024,3],[8025,1,"ὑ"],[8026,3],[8027,1,"ὓ"],[8028,3],[8029,1,"ὕ"],[8030,3],[8031,1,"ὗ"],[[8032,8039],2],[8040,1,"ὠ"],[8041,1,"ὡ"],[8042,1,"ὢ"],[8043,1,"ὣ"],[8044,1,"ὤ"],[8045,1,"ὥ"],[8046,1,"ὦ"],[8047,1,"ὧ"],[8048,2],[8049,1,"ά"],[8050,2],[8051,1,"έ"],[8052,2],[8053,1,"ή"],[8054,2],[8055,1,"ί"],[8056,2],[8057,1,"ό"],[8058,2],[8059,1,"ύ"],[8060,2],[8061,1,"ώ"],[[8062,8063],3],[8064,1,"ἀι"],[8065,1,"ἁι"],[8066,1,"ἂι"],[8067,1,"ἃι"],[8068,1,"ἄι"],[8069,1,"ἅι"],[8070,1,"ἆι"],[8071,1,"ἇι"],[8072,1,"ἀι"],[8073,1,"ἁι"],[8074,1,"ἂι"],[8075,1,"ἃι"],[8076,1,"ἄι"],[8077,1,"ἅι"],[8078,1,"ἆι"],[8079,1,"ἇι"],[8080,1,"ἠι"],[8081,1,"ἡι"],[8082,1,"ἢι"],[8083,1,"ἣι"],[8084,1,"ἤι"],[8085,1,"ἥι"],[8086,1,"ἦι"],[8087,1,"ἧι"],[8088,1,"ἠι"],[8089,1,"ἡι"],[8090,1,"ἢι"],[8091,1,"ἣι"],[8092,1,"ἤι"],[8093,1,"ἥι"],[8094,1,"ἦι"],[8095,1,"ἧι"],[8096,1,"ὠι"],[8097,1,"ὡι"],[8098,1,"ὢι"],[8099,1,"ὣι"],[8100,1,"ὤι"],[8101,1,"ὥι"],[8102,1,"ὦι"],[8103,1,"ὧι"],[8104,1,"ὠι"],[8105,1,"ὡι"],[8106,1,"ὢι"],[8107,1,"ὣι"],[8108,1,"ὤι"],[8109,1,"ὥι"],[8110,1,"ὦι"],[8111,1,"ὧι"],[[8112,8113],2],[8114,1,"ὰι"],[8115,1,"αι"],[8116,1,"άι"],[8117,3],[8118,2],[8119,1,"ᾶι"],[8120,1,"ᾰ"],[8121,1,"ᾱ"],[8122,1,"ὰ"],[8123,1,"ά"],[8124,1,"αι"],[8125,5," ̓"],[8126,1,"ι"],[8127,5," ̓"],[8128,5," ͂"],[8129,5," ̈͂"],[8130,1,"ὴι"],[8131,1,"ηι"],[8132,1,"ήι"],[8133,3],[8134,2],[8135,1,"ῆι"],[8136,1,"ὲ"],[8137,1,"έ"],[8138,1,"ὴ"],[8139,1,"ή"],[8140,1,"ηι"],[8141,5," ̓̀"],[8142,5," ̓́"],[8143,5," ̓͂"],[[8144,8146],2],[8147,1,"ΐ"],[[8148,8149],3],[[8150,8151],2],[8152,1,"ῐ"],[8153,1,"ῑ"],[8154,1,"ὶ"],[8155,1,"ί"],[8156,3],[8157,5," ̔̀"],[8158,5," ̔́"],[8159,5," ̔͂"],[[8160,8162],2],[8163,1,"ΰ"],[[8164,8167],2],[8168,1,"ῠ"],[8169,1,"ῡ"],[8170,1,"ὺ"],[8171,1,"ύ"],[8172,1,"ῥ"],[8173,5," ̈̀"],[8174,5," ̈́"],[8175,5,"`"],[[8176,8177],3],[8178,1,"ὼι"],[8179,1,"ωι"],[8180,1,"ώι"],[8181,3],[8182,2],[8183,1,"ῶι"],[8184,1,"ὸ"],[8185,1,"ό"],[8186,1,"ὼ"],[8187,1,"ώ"],[8188,1,"ωι"],[8189,5," ́"],[8190,5," ̔"],[8191,3],[[8192,8202],5," "],[8203,7],[[8204,8205],6,""],[[8206,8207],3],[8208,2],[8209,1,"‐"],[[8210,8214],2],[8215,5," ̳"],[[8216,8227],2],[[8228,8230],3],[8231,2],[[8232,8238],3],[8239,5," "],[[8240,8242],2],[8243,1,"′′"],[8244,1,"′′′"],[8245,2],[8246,1,"‵‵"],[8247,1,"‵‵‵"],[[8248,8251],2],[8252,5,"!!"],[8253,2],[8254,5," ̅"],[[8255,8262],2],[8263,5,"??"],[8264,5,"?!"],[8265,5,"!?"],[[8266,8269],2],[[8270,8274],2],[[8275,8276],2],[[8277,8278],2],[8279,1,"′′′′"],[[8280,8286],2],[8287,5," "],[8288,7],[[8289,8291],3],[8292,7],[8293,3],[[8294,8297],3],[[8298,8303],3],[8304,1,"0"],[8305,1,"i"],[[8306,8307],3],[8308,1,"4"],[8309,1,"5"],[8310,1,"6"],[8311,1,"7"],[8312,1,"8"],[8313,1,"9"],[8314,5,"+"],[8315,1,"−"],[8316,5,"="],[8317,5,"("],[8318,5,")"],[8319,1,"n"],[8320,1,"0"],[8321,1,"1"],[8322,1,"2"],[8323,1,"3"],[8324,1,"4"],[8325,1,"5"],[8326,1,"6"],[8327,1,"7"],[8328,1,"8"],[8329,1,"9"],[8330,5,"+"],[8331,1,"−"],[8332,5,"="],[8333,5,"("],[8334,5,")"],[8335,3],[8336,1,"a"],[8337,1,"e"],[8338,1,"o"],[8339,1,"x"],[8340,1,"ə"],[8341,1,"h"],[8342,1,"k"],[8343,1,"l"],[8344,1,"m"],[8345,1,"n"],[8346,1,"p"],[8347,1,"s"],[8348,1,"t"],[[8349,8351],3],[[8352,8359],2],[8360,1,"rs"],[[8361,8362],2],[8363,2],[8364,2],[[8365,8367],2],[[8368,8369],2],[[8370,8373],2],[[8374,8376],2],[8377,2],[8378,2],[[8379,8381],2],[8382,2],[8383,2],[8384,2],[[8385,8399],3],[[8400,8417],2],[[8418,8419],2],[[8420,8426],2],[8427,2],[[8428,8431],2],[8432,2],[[8433,8447],3],[8448,5,"a/c"],[8449,5,"a/s"],[8450,1,"c"],[8451,1,"°c"],[8452,2],[8453,5,"c/o"],[8454,5,"c/u"],[8455,1,"ɛ"],[8456,2],[8457,1,"°f"],[8458,1,"g"],[[8459,8462],1,"h"],[8463,1,"ħ"],[[8464,8465],1,"i"],[[8466,8467],1,"l"],[8468,2],[8469,1,"n"],[8470,1,"no"],[[8471,8472],2],[8473,1,"p"],[8474,1,"q"],[[8475,8477],1,"r"],[[8478,8479],2],[8480,1,"sm"],[8481,1,"tel"],[8482,1,"tm"],[8483,2],[8484,1,"z"],[8485,2],[8486,1,"ω"],[8487,2],[8488,1,"z"],[8489,2],[8490,1,"k"],[8491,1,"å"],[8492,1,"b"],[8493,1,"c"],[8494,2],[[8495,8496],1,"e"],[8497,1,"f"],[8498,3],[8499,1,"m"],[8500,1,"o"],[8501,1,"א"],[8502,1,"ב"],[8503,1,"ג"],[8504,1,"ד"],[8505,1,"i"],[8506,2],[8507,1,"fax"],[8508,1,"π"],[[8509,8510],1,"γ"],[8511,1,"π"],[8512,1,"∑"],[[8513,8516],2],[[8517,8518],1,"d"],[8519,1,"e"],[8520,1,"i"],[8521,1,"j"],[[8522,8523],2],[8524,2],[8525,2],[8526,2],[8527,2],[8528,1,"1⁄7"],[8529,1,"1⁄9"],[8530,1,"1⁄10"],[8531,1,"1⁄3"],[8532,1,"2⁄3"],[8533,1,"1⁄5"],[8534,1,"2⁄5"],[8535,1,"3⁄5"],[8536,1,"4⁄5"],[8537,1,"1⁄6"],[8538,1,"5⁄6"],[8539,1,"1⁄8"],[8540,1,"3⁄8"],[8541,1,"5⁄8"],[8542,1,"7⁄8"],[8543,1,"1⁄"],[8544,1,"i"],[8545,1,"ii"],[8546,1,"iii"],[8547,1,"iv"],[8548,1,"v"],[8549,1,"vi"],[8550,1,"vii"],[8551,1,"viii"],[8552,1,"ix"],[8553,1,"x"],[8554,1,"xi"],[8555,1,"xii"],[8556,1,"l"],[8557,1,"c"],[8558,1,"d"],[8559,1,"m"],[8560,1,"i"],[8561,1,"ii"],[8562,1,"iii"],[8563,1,"iv"],[8564,1,"v"],[8565,1,"vi"],[8566,1,"vii"],[8567,1,"viii"],[8568,1,"ix"],[8569,1,"x"],[8570,1,"xi"],[8571,1,"xii"],[8572,1,"l"],[8573,1,"c"],[8574,1,"d"],[8575,1,"m"],[[8576,8578],2],[8579,3],[8580,2],[[8581,8584],2],[8585,1,"0⁄3"],[[8586,8587],2],[[8588,8591],3],[[8592,8682],2],[[8683,8691],2],[[8692,8703],2],[[8704,8747],2],[8748,1,"∫∫"],[8749,1,"∫∫∫"],[8750,2],[8751,1,"∮∮"],[8752,1,"∮∮∮"],[[8753,8945],2],[[8946,8959],2],[8960,2],[8961,2],[[8962,9000],2],[9001,1,"〈"],[9002,1,"〉"],[[9003,9082],2],[9083,2],[9084,2],[[9085,9114],2],[[9115,9166],2],[[9167,9168],2],[[9169,9179],2],[[9180,9191],2],[9192,2],[[9193,9203],2],[[9204,9210],2],[[9211,9214],2],[9215,2],[[9216,9252],2],[[9253,9254],2],[[9255,9279],3],[[9280,9290],2],[[9291,9311],3],[9312,1,"1"],[9313,1,"2"],[9314,1,"3"],[9315,1,"4"],[9316,1,"5"],[9317,1,"6"],[9318,1,"7"],[9319,1,"8"],[9320,1,"9"],[9321,1,"10"],[9322,1,"11"],[9323,1,"12"],[9324,1,"13"],[9325,1,"14"],[9326,1,"15"],[9327,1,"16"],[9328,1,"17"],[9329,1,"18"],[9330,1,"19"],[9331,1,"20"],[9332,5,"(1)"],[9333,5,"(2)"],[9334,5,"(3)"],[9335,5,"(4)"],[9336,5,"(5)"],[9337,5,"(6)"],[9338,5,"(7)"],[9339,5,"(8)"],[9340,5,"(9)"],[9341,5,"(10)"],[9342,5,"(11)"],[9343,5,"(12)"],[9344,5,"(13)"],[9345,5,"(14)"],[9346,5,"(15)"],[9347,5,"(16)"],[9348,5,"(17)"],[9349,5,"(18)"],[9350,5,"(19)"],[9351,5,"(20)"],[[9352,9371],3],[9372,5,"(a)"],[9373,5,"(b)"],[9374,5,"(c)"],[9375,5,"(d)"],[9376,5,"(e)"],[9377,5,"(f)"],[9378,5,"(g)"],[9379,5,"(h)"],[9380,5,"(i)"],[9381,5,"(j)"],[9382,5,"(k)"],[9383,5,"(l)"],[9384,5,"(m)"],[9385,5,"(n)"],[9386,5,"(o)"],[9387,5,"(p)"],[9388,5,"(q)"],[9389,5,"(r)"],[9390,5,"(s)"],[9391,5,"(t)"],[9392,5,"(u)"],[9393,5,"(v)"],[9394,5,"(w)"],[9395,5,"(x)"],[9396,5,"(y)"],[9397,5,"(z)"],[9398,1,"a"],[9399,1,"b"],[9400,1,"c"],[9401,1,"d"],[9402,1,"e"],[9403,1,"f"],[9404,1,"g"],[9405,1,"h"],[9406,1,"i"],[9407,1,"j"],[9408,1,"k"],[9409,1,"l"],[9410,1,"m"],[9411,1,"n"],[9412,1,"o"],[9413,1,"p"],[9414,1,"q"],[9415,1,"r"],[9416,1,"s"],[9417,1,"t"],[9418,1,"u"],[9419,1,"v"],[9420,1,"w"],[9421,1,"x"],[9422,1,"y"],[9423,1,"z"],[9424,1,"a"],[9425,1,"b"],[9426,1,"c"],[9427,1,"d"],[9428,1,"e"],[9429,1,"f"],[9430,1,"g"],[9431,1,"h"],[9432,1,"i"],[9433,1,"j"],[9434,1,"k"],[9435,1,"l"],[9436,1,"m"],[9437,1,"n"],[9438,1,"o"],[9439,1,"p"],[9440,1,"q"],[9441,1,"r"],[9442,1,"s"],[9443,1,"t"],[9444,1,"u"],[9445,1,"v"],[9446,1,"w"],[9447,1,"x"],[9448,1,"y"],[9449,1,"z"],[9450,1,"0"],[[9451,9470],2],[9471,2],[[9472,9621],2],[[9622,9631],2],[[9632,9711],2],[[9712,9719],2],[[9720,9727],2],[[9728,9747],2],[[9748,9749],2],[[9750,9751],2],[9752,2],[9753,2],[[9754,9839],2],[[9840,9841],2],[[9842,9853],2],[[9854,9855],2],[[9856,9865],2],[[9866,9873],2],[[9874,9884],2],[9885,2],[[9886,9887],2],[[9888,9889],2],[[9890,9905],2],[9906,2],[[9907,9916],2],[[9917,9919],2],[[9920,9923],2],[[9924,9933],2],[9934,2],[[9935,9953],2],[9954,2],[9955,2],[[9956,9959],2],[[9960,9983],2],[9984,2],[[9985,9988],2],[9989,2],[[9990,9993],2],[[9994,9995],2],[[9996,10023],2],[10024,2],[[10025,10059],2],[10060,2],[10061,2],[10062,2],[[10063,10066],2],[[10067,10069],2],[10070,2],[10071,2],[[10072,10078],2],[[10079,10080],2],[[10081,10087],2],[[10088,10101],2],[[10102,10132],2],[[10133,10135],2],[[10136,10159],2],[10160,2],[[10161,10174],2],[10175,2],[[10176,10182],2],[[10183,10186],2],[10187,2],[10188,2],[10189,2],[[10190,10191],2],[[10192,10219],2],[[10220,10223],2],[[10224,10239],2],[[10240,10495],2],[[10496,10763],2],[10764,1,"∫∫∫∫"],[[10765,10867],2],[10868,5,"::="],[10869,5,"=="],[10870,5,"==="],[[10871,10971],2],[10972,1,"⫝̸"],[[10973,11007],2],[[11008,11021],2],[[11022,11027],2],[[11028,11034],2],[[11035,11039],2],[[11040,11043],2],[[11044,11084],2],[[11085,11087],2],[[11088,11092],2],[[11093,11097],2],[[11098,11123],2],[[11124,11125],3],[[11126,11157],2],[11158,3],[11159,2],[[11160,11193],2],[[11194,11196],2],[[11197,11208],2],[11209,2],[[11210,11217],2],[11218,2],[[11219,11243],2],[[11244,11247],2],[[11248,11262],2],[11263,2],[11264,1,"ⰰ"],[11265,1,"ⰱ"],[11266,1,"ⰲ"],[11267,1,"ⰳ"],[11268,1,"ⰴ"],[11269,1,"ⰵ"],[11270,1,"ⰶ"],[11271,1,"ⰷ"],[11272,1,"ⰸ"],[11273,1,"ⰹ"],[11274,1,"ⰺ"],[11275,1,"ⰻ"],[11276,1,"ⰼ"],[11277,1,"ⰽ"],[11278,1,"ⰾ"],[11279,1,"ⰿ"],[11280,1,"ⱀ"],[11281,1,"ⱁ"],[11282,1,"ⱂ"],[11283,1,"ⱃ"],[11284,1,"ⱄ"],[11285,1,"ⱅ"],[11286,1,"ⱆ"],[11287,1,"ⱇ"],[11288,1,"ⱈ"],[11289,1,"ⱉ"],[11290,1,"ⱊ"],[11291,1,"ⱋ"],[11292,1,"ⱌ"],[11293,1,"ⱍ"],[11294,1,"ⱎ"],[11295,1,"ⱏ"],[11296,1,"ⱐ"],[11297,1,"ⱑ"],[11298,1,"ⱒ"],[11299,1,"ⱓ"],[11300,1,"ⱔ"],[11301,1,"ⱕ"],[11302,1,"ⱖ"],[11303,1,"ⱗ"],[11304,1,"ⱘ"],[11305,1,"ⱙ"],[11306,1,"ⱚ"],[11307,1,"ⱛ"],[11308,1,"ⱜ"],[11309,1,"ⱝ"],[11310,1,"ⱞ"],[11311,1,"ⱟ"],[[11312,11358],2],[11359,2],[11360,1,"ⱡ"],[11361,2],[11362,1,"ɫ"],[11363,1,"ᵽ"],[11364,1,"ɽ"],[[11365,11366],2],[11367,1,"ⱨ"],[11368,2],[11369,1,"ⱪ"],[11370,2],[11371,1,"ⱬ"],[11372,2],[11373,1,"ɑ"],[11374,1,"ɱ"],[11375,1,"ɐ"],[11376,1,"ɒ"],[11377,2],[11378,1,"ⱳ"],[11379,2],[11380,2],[11381,1,"ⱶ"],[[11382,11383],2],[[11384,11387],2],[11388,1,"j"],[11389,1,"v"],[11390,1,"ȿ"],[11391,1,"ɀ"],[11392,1,"ⲁ"],[11393,2],[11394,1,"ⲃ"],[11395,2],[11396,1,"ⲅ"],[11397,2],[11398,1,"ⲇ"],[11399,2],[11400,1,"ⲉ"],[11401,2],[11402,1,"ⲋ"],[11403,2],[11404,1,"ⲍ"],[11405,2],[11406,1,"ⲏ"],[11407,2],[11408,1,"ⲑ"],[11409,2],[11410,1,"ⲓ"],[11411,2],[11412,1,"ⲕ"],[11413,2],[11414,1,"ⲗ"],[11415,2],[11416,1,"ⲙ"],[11417,2],[11418,1,"ⲛ"],[11419,2],[11420,1,"ⲝ"],[11421,2],[11422,1,"ⲟ"],[11423,2],[11424,1,"ⲡ"],[11425,2],[11426,1,"ⲣ"],[11427,2],[11428,1,"ⲥ"],[11429,2],[11430,1,"ⲧ"],[11431,2],[11432,1,"ⲩ"],[11433,2],[11434,1,"ⲫ"],[11435,2],[11436,1,"ⲭ"],[11437,2],[11438,1,"ⲯ"],[11439,2],[11440,1,"ⲱ"],[11441,2],[11442,1,"ⲳ"],[11443,2],[11444,1,"ⲵ"],[11445,2],[11446,1,"ⲷ"],[11447,2],[11448,1,"ⲹ"],[11449,2],[11450,1,"ⲻ"],[11451,2],[11452,1,"ⲽ"],[11453,2],[11454,1,"ⲿ"],[11455,2],[11456,1,"ⳁ"],[11457,2],[11458,1,"ⳃ"],[11459,2],[11460,1,"ⳅ"],[11461,2],[11462,1,"ⳇ"],[11463,2],[11464,1,"ⳉ"],[11465,2],[11466,1,"ⳋ"],[11467,2],[11468,1,"ⳍ"],[11469,2],[11470,1,"ⳏ"],[11471,2],[11472,1,"ⳑ"],[11473,2],[11474,1,"ⳓ"],[11475,2],[11476,1,"ⳕ"],[11477,2],[11478,1,"ⳗ"],[11479,2],[11480,1,"ⳙ"],[11481,2],[11482,1,"ⳛ"],[11483,2],[11484,1,"ⳝ"],[11485,2],[11486,1,"ⳟ"],[11487,2],[11488,1,"ⳡ"],[11489,2],[11490,1,"ⳣ"],[[11491,11492],2],[[11493,11498],2],[11499,1,"ⳬ"],[11500,2],[11501,1,"ⳮ"],[[11502,11505],2],[11506,1,"ⳳ"],[11507,2],[[11508,11512],3],[[11513,11519],2],[[11520,11557],2],[11558,3],[11559,2],[[11560,11564],3],[11565,2],[[11566,11567],3],[[11568,11621],2],[[11622,11623],2],[[11624,11630],3],[11631,1,"ⵡ"],[11632,2],[[11633,11646],3],[11647,2],[[11648,11670],2],[[11671,11679],3],[[11680,11686],2],[11687,3],[[11688,11694],2],[11695,3],[[11696,11702],2],[11703,3],[[11704,11710],2],[11711,3],[[11712,11718],2],[11719,3],[[11720,11726],2],[11727,3],[[11728,11734],2],[11735,3],[[11736,11742],2],[11743,3],[[11744,11775],2],[[11776,11799],2],[[11800,11803],2],[[11804,11805],2],[[11806,11822],2],[11823,2],[11824,2],[11825,2],[[11826,11835],2],[[11836,11842],2],[[11843,11844],2],[[11845,11849],2],[[11850,11854],2],[11855,2],[[11856,11858],2],[[11859,11869],2],[[11870,11903],3],[[11904,11929],2],[11930,3],[[11931,11934],2],[11935,1,"母"],[[11936,12018],2],[12019,1,"龟"],[[12020,12031],3],[12032,1,"一"],[12033,1,"丨"],[12034,1,"丶"],[12035,1,"丿"],[12036,1,"乙"],[12037,1,"亅"],[12038,1,"二"],[12039,1,"亠"],[12040,1,"人"],[12041,1,"儿"],[12042,1,"入"],[12043,1,"八"],[12044,1,"冂"],[12045,1,"冖"],[12046,1,"冫"],[12047,1,"几"],[12048,1,"凵"],[12049,1,"刀"],[12050,1,"力"],[12051,1,"勹"],[12052,1,"匕"],[12053,1,"匚"],[12054,1,"匸"],[12055,1,"十"],[12056,1,"卜"],[12057,1,"卩"],[12058,1,"厂"],[12059,1,"厶"],[12060,1,"又"],[12061,1,"口"],[12062,1,"囗"],[12063,1,"土"],[12064,1,"士"],[12065,1,"夂"],[12066,1,"夊"],[12067,1,"夕"],[12068,1,"大"],[12069,1,"女"],[12070,1,"子"],[12071,1,"宀"],[12072,1,"寸"],[12073,1,"小"],[12074,1,"尢"],[12075,1,"尸"],[12076,1,"屮"],[12077,1,"山"],[12078,1,"巛"],[12079,1,"工"],[12080,1,"己"],[12081,1,"巾"],[12082,1,"干"],[12083,1,"幺"],[12084,1,"广"],[12085,1,"廴"],[12086,1,"廾"],[12087,1,"弋"],[12088,1,"弓"],[12089,1,"彐"],[12090,1,"彡"],[12091,1,"彳"],[12092,1,"心"],[12093,1,"戈"],[12094,1,"戶"],[12095,1,"手"],[12096,1,"支"],[12097,1,"攴"],[12098,1,"文"],[12099,1,"斗"],[12100,1,"斤"],[12101,1,"方"],[12102,1,"无"],[12103,1,"日"],[12104,1,"曰"],[12105,1,"月"],[12106,1,"木"],[12107,1,"欠"],[12108,1,"止"],[12109,1,"歹"],[12110,1,"殳"],[12111,1,"毋"],[12112,1,"比"],[12113,1,"毛"],[12114,1,"氏"],[12115,1,"气"],[12116,1,"水"],[12117,1,"火"],[12118,1,"爪"],[12119,1,"父"],[12120,1,"爻"],[12121,1,"爿"],[12122,1,"片"],[12123,1,"牙"],[12124,1,"牛"],[12125,1,"犬"],[12126,1,"玄"],[12127,1,"玉"],[12128,1,"瓜"],[12129,1,"瓦"],[12130,1,"甘"],[12131,1,"生"],[12132,1,"用"],[12133,1,"田"],[12134,1,"疋"],[12135,1,"疒"],[12136,1,"癶"],[12137,1,"白"],[12138,1,"皮"],[12139,1,"皿"],[12140,1,"目"],[12141,1,"矛"],[12142,1,"矢"],[12143,1,"石"],[12144,1,"示"],[12145,1,"禸"],[12146,1,"禾"],[12147,1,"穴"],[12148,1,"立"],[12149,1,"竹"],[12150,1,"米"],[12151,1,"糸"],[12152,1,"缶"],[12153,1,"网"],[12154,1,"羊"],[12155,1,"羽"],[12156,1,"老"],[12157,1,"而"],[12158,1,"耒"],[12159,1,"耳"],[12160,1,"聿"],[12161,1,"肉"],[12162,1,"臣"],[12163,1,"自"],[12164,1,"至"],[12165,1,"臼"],[12166,1,"舌"],[12167,1,"舛"],[12168,1,"舟"],[12169,1,"艮"],[12170,1,"色"],[12171,1,"艸"],[12172,1,"虍"],[12173,1,"虫"],[12174,1,"血"],[12175,1,"行"],[12176,1,"衣"],[12177,1,"襾"],[12178,1,"見"],[12179,1,"角"],[12180,1,"言"],[12181,1,"谷"],[12182,1,"豆"],[12183,1,"豕"],[12184,1,"豸"],[12185,1,"貝"],[12186,1,"赤"],[12187,1,"走"],[12188,1,"足"],[12189,1,"身"],[12190,1,"車"],[12191,1,"辛"],[12192,1,"辰"],[12193,1,"辵"],[12194,1,"邑"],[12195,1,"酉"],[12196,1,"釆"],[12197,1,"里"],[12198,1,"金"],[12199,1,"長"],[12200,1,"門"],[12201,1,"阜"],[12202,1,"隶"],[12203,1,"隹"],[12204,1,"雨"],[12205,1,"靑"],[12206,1,"非"],[12207,1,"面"],[12208,1,"革"],[12209,1,"韋"],[12210,1,"韭"],[12211,1,"音"],[12212,1,"頁"],[12213,1,"風"],[12214,1,"飛"],[12215,1,"食"],[12216,1,"首"],[12217,1,"香"],[12218,1,"馬"],[12219,1,"骨"],[12220,1,"高"],[12221,1,"髟"],[12222,1,"鬥"],[12223,1,"鬯"],[12224,1,"鬲"],[12225,1,"鬼"],[12226,1,"魚"],[12227,1,"鳥"],[12228,1,"鹵"],[12229,1,"鹿"],[12230,1,"麥"],[12231,1,"麻"],[12232,1,"黃"],[12233,1,"黍"],[12234,1,"黑"],[12235,1,"黹"],[12236,1,"黽"],[12237,1,"鼎"],[12238,1,"鼓"],[12239,1,"鼠"],[12240,1,"鼻"],[12241,1,"齊"],[12242,1,"齒"],[12243,1,"龍"],[12244,1,"龜"],[12245,1,"龠"],[[12246,12271],3],[[12272,12283],3],[[12284,12287],3],[12288,5," "],[12289,2],[12290,1,"."],[[12291,12292],2],[[12293,12295],2],[[12296,12329],2],[[12330,12333],2],[[12334,12341],2],[12342,1,"〒"],[12343,2],[12344,1,"十"],[12345,1,"卄"],[12346,1,"卅"],[12347,2],[12348,2],[12349,2],[12350,2],[12351,2],[12352,3],[[12353,12436],2],[[12437,12438],2],[[12439,12440],3],[[12441,12442],2],[12443,5," ゙"],[12444,5," ゚"],[[12445,12446],2],[12447,1,"より"],[12448,2],[[12449,12542],2],[12543,1,"コト"],[[12544,12548],3],[[12549,12588],2],[12589,2],[12590,2],[12591,2],[12592,3],[12593,1,"ᄀ"],[12594,1,"ᄁ"],[12595,1,"ᆪ"],[12596,1,"ᄂ"],[12597,1,"ᆬ"],[12598,1,"ᆭ"],[12599,1,"ᄃ"],[12600,1,"ᄄ"],[12601,1,"ᄅ"],[12602,1,"ᆰ"],[12603,1,"ᆱ"],[12604,1,"ᆲ"],[12605,1,"ᆳ"],[12606,1,"ᆴ"],[12607,1,"ᆵ"],[12608,1,"ᄚ"],[12609,1,"ᄆ"],[12610,1,"ᄇ"],[12611,1,"ᄈ"],[12612,1,"ᄡ"],[12613,1,"ᄉ"],[12614,1,"ᄊ"],[12615,1,"ᄋ"],[12616,1,"ᄌ"],[12617,1,"ᄍ"],[12618,1,"ᄎ"],[12619,1,"ᄏ"],[12620,1,"ᄐ"],[12621,1,"ᄑ"],[12622,1,"ᄒ"],[12623,1,"ᅡ"],[12624,1,"ᅢ"],[12625,1,"ᅣ"],[12626,1,"ᅤ"],[12627,1,"ᅥ"],[12628,1,"ᅦ"],[12629,1,"ᅧ"],[12630,1,"ᅨ"],[12631,1,"ᅩ"],[12632,1,"ᅪ"],[12633,1,"ᅫ"],[12634,1,"ᅬ"],[12635,1,"ᅭ"],[12636,1,"ᅮ"],[12637,1,"ᅯ"],[12638,1,"ᅰ"],[12639,1,"ᅱ"],[12640,1,"ᅲ"],[12641,1,"ᅳ"],[12642,1,"ᅴ"],[12643,1,"ᅵ"],[12644,3],[12645,1,"ᄔ"],[12646,1,"ᄕ"],[12647,1,"ᇇ"],[12648,1,"ᇈ"],[12649,1,"ᇌ"],[12650,1,"ᇎ"],[12651,1,"ᇓ"],[12652,1,"ᇗ"],[12653,1,"ᇙ"],[12654,1,"ᄜ"],[12655,1,"ᇝ"],[12656,1,"ᇟ"],[12657,1,"ᄝ"],[12658,1,"ᄞ"],[12659,1,"ᄠ"],[12660,1,"ᄢ"],[12661,1,"ᄣ"],[12662,1,"ᄧ"],[12663,1,"ᄩ"],[12664,1,"ᄫ"],[12665,1,"ᄬ"],[12666,1,"ᄭ"],[12667,1,"ᄮ"],[12668,1,"ᄯ"],[12669,1,"ᄲ"],[12670,1,"ᄶ"],[12671,1,"ᅀ"],[12672,1,"ᅇ"],[12673,1,"ᅌ"],[12674,1,"ᇱ"],[12675,1,"ᇲ"],[12676,1,"ᅗ"],[12677,1,"ᅘ"],[12678,1,"ᅙ"],[12679,1,"ᆄ"],[12680,1,"ᆅ"],[12681,1,"ᆈ"],[12682,1,"ᆑ"],[12683,1,"ᆒ"],[12684,1,"ᆔ"],[12685,1,"ᆞ"],[12686,1,"ᆡ"],[12687,3],[[12688,12689],2],[12690,1,"一"],[12691,1,"二"],[12692,1,"三"],[12693,1,"四"],[12694,1,"上"],[12695,1,"中"],[12696,1,"下"],[12697,1,"甲"],[12698,1,"乙"],[12699,1,"丙"],[12700,1,"丁"],[12701,1,"天"],[12702,1,"地"],[12703,1,"人"],[[12704,12727],2],[[12728,12730],2],[[12731,12735],2],[[12736,12751],2],[[12752,12771],2],[[12772,12782],3],[12783,3],[[12784,12799],2],[12800,5,"(ᄀ)"],[12801,5,"(ᄂ)"],[12802,5,"(ᄃ)"],[12803,5,"(ᄅ)"],[12804,5,"(ᄆ)"],[12805,5,"(ᄇ)"],[12806,5,"(ᄉ)"],[12807,5,"(ᄋ)"],[12808,5,"(ᄌ)"],[12809,5,"(ᄎ)"],[12810,5,"(ᄏ)"],[12811,5,"(ᄐ)"],[12812,5,"(ᄑ)"],[12813,5,"(ᄒ)"],[12814,5,"(가)"],[12815,5,"(나)"],[12816,5,"(다)"],[12817,5,"(라)"],[12818,5,"(마)"],[12819,5,"(바)"],[12820,5,"(사)"],[12821,5,"(아)"],[12822,5,"(자)"],[12823,5,"(차)"],[12824,5,"(카)"],[12825,5,"(타)"],[12826,5,"(파)"],[12827,5,"(하)"],[12828,5,"(주)"],[12829,5,"(오전)"],[12830,5,"(오후)"],[12831,3],[12832,5,"(一)"],[12833,5,"(二)"],[12834,5,"(三)"],[12835,5,"(四)"],[12836,5,"(五)"],[12837,5,"(六)"],[12838,5,"(七)"],[12839,5,"(八)"],[12840,5,"(九)"],[12841,5,"(十)"],[12842,5,"(月)"],[12843,5,"(火)"],[12844,5,"(水)"],[12845,5,"(木)"],[12846,5,"(金)"],[12847,5,"(土)"],[12848,5,"(日)"],[12849,5,"(株)"],[12850,5,"(有)"],[12851,5,"(社)"],[12852,5,"(名)"],[12853,5,"(特)"],[12854,5,"(財)"],[12855,5,"(祝)"],[12856,5,"(労)"],[12857,5,"(代)"],[12858,5,"(呼)"],[12859,5,"(学)"],[12860,5,"(監)"],[12861,5,"(企)"],[12862,5,"(資)"],[12863,5,"(協)"],[12864,5,"(祭)"],[12865,5,"(休)"],[12866,5,"(自)"],[12867,5,"(至)"],[12868,1,"問"],[12869,1,"幼"],[12870,1,"文"],[12871,1,"箏"],[[12872,12879],2],[12880,1,"pte"],[12881,1,"21"],[12882,1,"22"],[12883,1,"23"],[12884,1,"24"],[12885,1,"25"],[12886,1,"26"],[12887,1,"27"],[12888,1,"28"],[12889,1,"29"],[12890,1,"30"],[12891,1,"31"],[12892,1,"32"],[12893,1,"33"],[12894,1,"34"],[12895,1,"35"],[12896,1,"ᄀ"],[12897,1,"ᄂ"],[12898,1,"ᄃ"],[12899,1,"ᄅ"],[12900,1,"ᄆ"],[12901,1,"ᄇ"],[12902,1,"ᄉ"],[12903,1,"ᄋ"],[12904,1,"ᄌ"],[12905,1,"ᄎ"],[12906,1,"ᄏ"],[12907,1,"ᄐ"],[12908,1,"ᄑ"],[12909,1,"ᄒ"],[12910,1,"가"],[12911,1,"나"],[12912,1,"다"],[12913,1,"라"],[12914,1,"마"],[12915,1,"바"],[12916,1,"사"],[12917,1,"아"],[12918,1,"자"],[12919,1,"차"],[12920,1,"카"],[12921,1,"타"],[12922,1,"파"],[12923,1,"하"],[12924,1,"참고"],[12925,1,"주의"],[12926,1,"우"],[12927,2],[12928,1,"一"],[12929,1,"二"],[12930,1,"三"],[12931,1,"四"],[12932,1,"五"],[12933,1,"六"],[12934,1,"七"],[12935,1,"八"],[12936,1,"九"],[12937,1,"十"],[12938,1,"月"],[12939,1,"火"],[12940,1,"水"],[12941,1,"木"],[12942,1,"金"],[12943,1,"土"],[12944,1,"日"],[12945,1,"株"],[12946,1,"有"],[12947,1,"社"],[12948,1,"名"],[12949,1,"特"],[12950,1,"財"],[12951,1,"祝"],[12952,1,"労"],[12953,1,"秘"],[12954,1,"男"],[12955,1,"女"],[12956,1,"適"],[12957,1,"優"],[12958,1,"印"],[12959,1,"注"],[12960,1,"項"],[12961,1,"休"],[12962,1,"写"],[12963,1,"正"],[12964,1,"上"],[12965,1,"中"],[12966,1,"下"],[12967,1,"左"],[12968,1,"右"],[12969,1,"医"],[12970,1,"宗"],[12971,1,"学"],[12972,1,"監"],[12973,1,"企"],[12974,1,"資"],[12975,1,"協"],[12976,1,"夜"],[12977,1,"36"],[12978,1,"37"],[12979,1,"38"],[12980,1,"39"],[12981,1,"40"],[12982,1,"41"],[12983,1,"42"],[12984,1,"43"],[12985,1,"44"],[12986,1,"45"],[12987,1,"46"],[12988,1,"47"],[12989,1,"48"],[12990,1,"49"],[12991,1,"50"],[12992,1,"1月"],[12993,1,"2月"],[12994,1,"3月"],[12995,1,"4月"],[12996,1,"5月"],[12997,1,"6月"],[12998,1,"7月"],[12999,1,"8月"],[13000,1,"9月"],[13001,1,"10月"],[13002,1,"11月"],[13003,1,"12月"],[13004,1,"hg"],[13005,1,"erg"],[13006,1,"ev"],[13007,1,"ltd"],[13008,1,"ア"],[13009,1,"イ"],[13010,1,"ウ"],[13011,1,"エ"],[13012,1,"オ"],[13013,1,"カ"],[13014,1,"キ"],[13015,1,"ク"],[13016,1,"ケ"],[13017,1,"コ"],[13018,1,"サ"],[13019,1,"シ"],[13020,1,"ス"],[13021,1,"セ"],[13022,1,"ソ"],[13023,1,"タ"],[13024,1,"チ"],[13025,1,"ツ"],[13026,1,"テ"],[13027,1,"ト"],[13028,1,"ナ"],[13029,1,"ニ"],[13030,1,"ヌ"],[13031,1,"ネ"],[13032,1,"ノ"],[13033,1,"ハ"],[13034,1,"ヒ"],[13035,1,"フ"],[13036,1,"ヘ"],[13037,1,"ホ"],[13038,1,"マ"],[13039,1,"ミ"],[13040,1,"ム"],[13041,1,"メ"],[13042,1,"モ"],[13043,1,"ヤ"],[13044,1,"ユ"],[13045,1,"ヨ"],[13046,1,"ラ"],[13047,1,"リ"],[13048,1,"ル"],[13049,1,"レ"],[13050,1,"ロ"],[13051,1,"ワ"],[13052,1,"ヰ"],[13053,1,"ヱ"],[13054,1,"ヲ"],[13055,1,"令和"],[13056,1,"アパート"],[13057,1,"アルファ"],[13058,1,"アンペア"],[13059,1,"アール"],[13060,1,"イニング"],[13061,1,"インチ"],[13062,1,"ウォン"],[13063,1,"エスクード"],[13064,1,"エーカー"],[13065,1,"オンス"],[13066,1,"オーム"],[13067,1,"カイリ"],[13068,1,"カラット"],[13069,1,"カロリー"],[13070,1,"ガロン"],[13071,1,"ガンマ"],[13072,1,"ギガ"],[13073,1,"ギニー"],[13074,1,"キュリー"],[13075,1,"ギルダー"],[13076,1,"キロ"],[13077,1,"キログラム"],[13078,1,"キロメートル"],[13079,1,"キロワット"],[13080,1,"グラム"],[13081,1,"グラムトン"],[13082,1,"クルゼイロ"],[13083,1,"クローネ"],[13084,1,"ケース"],[13085,1,"コルナ"],[13086,1,"コーポ"],[13087,1,"サイクル"],[13088,1,"サンチーム"],[13089,1,"シリング"],[13090,1,"センチ"],[13091,1,"セント"],[13092,1,"ダース"],[13093,1,"デシ"],[13094,1,"ドル"],[13095,1,"トン"],[13096,1,"ナノ"],[13097,1,"ノット"],[13098,1,"ハイツ"],[13099,1,"パーセント"],[13100,1,"パーツ"],[13101,1,"バーレル"],[13102,1,"ピアストル"],[13103,1,"ピクル"],[13104,1,"ピコ"],[13105,1,"ビル"],[13106,1,"ファラッド"],[13107,1,"フィート"],[13108,1,"ブッシェル"],[13109,1,"フラン"],[13110,1,"ヘクタール"],[13111,1,"ペソ"],[13112,1,"ペニヒ"],[13113,1,"ヘルツ"],[13114,1,"ペンス"],[13115,1,"ページ"],[13116,1,"ベータ"],[13117,1,"ポイント"],[13118,1,"ボルト"],[13119,1,"ホン"],[13120,1,"ポンド"],[13121,1,"ホール"],[13122,1,"ホーン"],[13123,1,"マイクロ"],[13124,1,"マイル"],[13125,1,"マッハ"],[13126,1,"マルク"],[13127,1,"マンション"],[13128,1,"ミクロン"],[13129,1,"ミリ"],[13130,1,"ミリバール"],[13131,1,"メガ"],[13132,1,"メガトン"],[13133,1,"メートル"],[13134,1,"ヤード"],[13135,1,"ヤール"],[13136,1,"ユアン"],[13137,1,"リットル"],[13138,1,"リラ"],[13139,1,"ルピー"],[13140,1,"ルーブル"],[13141,1,"レム"],[13142,1,"レントゲン"],[13143,1,"ワット"],[13144,1,"0点"],[13145,1,"1点"],[13146,1,"2点"],[13147,1,"3点"],[13148,1,"4点"],[13149,1,"5点"],[13150,1,"6点"],[13151,1,"7点"],[13152,1,"8点"],[13153,1,"9点"],[13154,1,"10点"],[13155,1,"11点"],[13156,1,"12点"],[13157,1,"13点"],[13158,1,"14点"],[13159,1,"15点"],[13160,1,"16点"],[13161,1,"17点"],[13162,1,"18点"],[13163,1,"19点"],[13164,1,"20点"],[13165,1,"21点"],[13166,1,"22点"],[13167,1,"23点"],[13168,1,"24点"],[13169,1,"hpa"],[13170,1,"da"],[13171,1,"au"],[13172,1,"bar"],[13173,1,"ov"],[13174,1,"pc"],[13175,1,"dm"],[13176,1,"dm2"],[13177,1,"dm3"],[13178,1,"iu"],[13179,1,"平成"],[13180,1,"昭和"],[13181,1,"大正"],[13182,1,"明治"],[13183,1,"株式会社"],[13184,1,"pa"],[13185,1,"na"],[13186,1,"μa"],[13187,1,"ma"],[13188,1,"ka"],[13189,1,"kb"],[13190,1,"mb"],[13191,1,"gb"],[13192,1,"cal"],[13193,1,"kcal"],[13194,1,"pf"],[13195,1,"nf"],[13196,1,"μf"],[13197,1,"μg"],[13198,1,"mg"],[13199,1,"kg"],[13200,1,"hz"],[13201,1,"khz"],[13202,1,"mhz"],[13203,1,"ghz"],[13204,1,"thz"],[13205,1,"μl"],[13206,1,"ml"],[13207,1,"dl"],[13208,1,"kl"],[13209,1,"fm"],[13210,1,"nm"],[13211,1,"μm"],[13212,1,"mm"],[13213,1,"cm"],[13214,1,"km"],[13215,1,"mm2"],[13216,1,"cm2"],[13217,1,"m2"],[13218,1,"km2"],[13219,1,"mm3"],[13220,1,"cm3"],[13221,1,"m3"],[13222,1,"km3"],[13223,1,"m∕s"],[13224,1,"m∕s2"],[13225,1,"pa"],[13226,1,"kpa"],[13227,1,"mpa"],[13228,1,"gpa"],[13229,1,"rad"],[13230,1,"rad∕s"],[13231,1,"rad∕s2"],[13232,1,"ps"],[13233,1,"ns"],[13234,1,"μs"],[13235,1,"ms"],[13236,1,"pv"],[13237,1,"nv"],[13238,1,"μv"],[13239,1,"mv"],[13240,1,"kv"],[13241,1,"mv"],[13242,1,"pw"],[13243,1,"nw"],[13244,1,"μw"],[13245,1,"mw"],[13246,1,"kw"],[13247,1,"mw"],[13248,1,"kω"],[13249,1,"mω"],[13250,3],[13251,1,"bq"],[13252,1,"cc"],[13253,1,"cd"],[13254,1,"c∕kg"],[13255,3],[13256,1,"db"],[13257,1,"gy"],[13258,1,"ha"],[13259,1,"hp"],[13260,1,"in"],[13261,1,"kk"],[13262,1,"km"],[13263,1,"kt"],[13264,1,"lm"],[13265,1,"ln"],[13266,1,"log"],[13267,1,"lx"],[13268,1,"mb"],[13269,1,"mil"],[13270,1,"mol"],[13271,1,"ph"],[13272,3],[13273,1,"ppm"],[13274,1,"pr"],[13275,1,"sr"],[13276,1,"sv"],[13277,1,"wb"],[13278,1,"v∕m"],[13279,1,"a∕m"],[13280,1,"1日"],[13281,1,"2日"],[13282,1,"3日"],[13283,1,"4日"],[13284,1,"5日"],[13285,1,"6日"],[13286,1,"7日"],[13287,1,"8日"],[13288,1,"9日"],[13289,1,"10日"],[13290,1,"11日"],[13291,1,"12日"],[13292,1,"13日"],[13293,1,"14日"],[13294,1,"15日"],[13295,1,"16日"],[13296,1,"17日"],[13297,1,"18日"],[13298,1,"19日"],[13299,1,"20日"],[13300,1,"21日"],[13301,1,"22日"],[13302,1,"23日"],[13303,1,"24日"],[13304,1,"25日"],[13305,1,"26日"],[13306,1,"27日"],[13307,1,"28日"],[13308,1,"29日"],[13309,1,"30日"],[13310,1,"31日"],[13311,1,"gal"],[[13312,19893],2],[[19894,19903],2],[[19904,19967],2],[[19968,40869],2],[[40870,40891],2],[[40892,40899],2],[[40900,40907],2],[40908,2],[[40909,40917],2],[[40918,40938],2],[[40939,40943],2],[[40944,40956],2],[[40957,40959],2],[[40960,42124],2],[[42125,42127],3],[[42128,42145],2],[[42146,42147],2],[[42148,42163],2],[42164,2],[[42165,42176],2],[42177,2],[[42178,42180],2],[42181,2],[42182,2],[[42183,42191],3],[[42192,42237],2],[[42238,42239],2],[[42240,42508],2],[[42509,42511],2],[[42512,42539],2],[[42540,42559],3],[42560,1,"ꙁ"],[42561,2],[42562,1,"ꙃ"],[42563,2],[42564,1,"ꙅ"],[42565,2],[42566,1,"ꙇ"],[42567,2],[42568,1,"ꙉ"],[42569,2],[42570,1,"ꙋ"],[42571,2],[42572,1,"ꙍ"],[42573,2],[42574,1,"ꙏ"],[42575,2],[42576,1,"ꙑ"],[42577,2],[42578,1,"ꙓ"],[42579,2],[42580,1,"ꙕ"],[42581,2],[42582,1,"ꙗ"],[42583,2],[42584,1,"ꙙ"],[42585,2],[42586,1,"ꙛ"],[42587,2],[42588,1,"ꙝ"],[42589,2],[42590,1,"ꙟ"],[42591,2],[42592,1,"ꙡ"],[42593,2],[42594,1,"ꙣ"],[42595,2],[42596,1,"ꙥ"],[42597,2],[42598,1,"ꙧ"],[42599,2],[42600,1,"ꙩ"],[42601,2],[42602,1,"ꙫ"],[42603,2],[42604,1,"ꙭ"],[[42605,42607],2],[[42608,42611],2],[[42612,42619],2],[[42620,42621],2],[42622,2],[42623,2],[42624,1,"ꚁ"],[42625,2],[42626,1,"ꚃ"],[42627,2],[42628,1,"ꚅ"],[42629,2],[42630,1,"ꚇ"],[42631,2],[42632,1,"ꚉ"],[42633,2],[42634,1,"ꚋ"],[42635,2],[42636,1,"ꚍ"],[42637,2],[42638,1,"ꚏ"],[42639,2],[42640,1,"ꚑ"],[42641,2],[42642,1,"ꚓ"],[42643,2],[42644,1,"ꚕ"],[42645,2],[42646,1,"ꚗ"],[42647,2],[42648,1,"ꚙ"],[42649,2],[42650,1,"ꚛ"],[42651,2],[42652,1,"ъ"],[42653,1,"ь"],[42654,2],[42655,2],[[42656,42725],2],[[42726,42735],2],[[42736,42737],2],[[42738,42743],2],[[42744,42751],3],[[42752,42774],2],[[42775,42778],2],[[42779,42783],2],[[42784,42785],2],[42786,1,"ꜣ"],[42787,2],[42788,1,"ꜥ"],[42789,2],[42790,1,"ꜧ"],[42791,2],[42792,1,"ꜩ"],[42793,2],[42794,1,"ꜫ"],[42795,2],[42796,1,"ꜭ"],[42797,2],[42798,1,"ꜯ"],[[42799,42801],2],[42802,1,"ꜳ"],[42803,2],[42804,1,"ꜵ"],[42805,2],[42806,1,"ꜷ"],[42807,2],[42808,1,"ꜹ"],[42809,2],[42810,1,"ꜻ"],[42811,2],[42812,1,"ꜽ"],[42813,2],[42814,1,"ꜿ"],[42815,2],[42816,1,"ꝁ"],[42817,2],[42818,1,"ꝃ"],[42819,2],[42820,1,"ꝅ"],[42821,2],[42822,1,"ꝇ"],[42823,2],[42824,1,"ꝉ"],[42825,2],[42826,1,"ꝋ"],[42827,2],[42828,1,"ꝍ"],[42829,2],[42830,1,"ꝏ"],[42831,2],[42832,1,"ꝑ"],[42833,2],[42834,1,"ꝓ"],[42835,2],[42836,1,"ꝕ"],[42837,2],[42838,1,"ꝗ"],[42839,2],[42840,1,"ꝙ"],[42841,2],[42842,1,"ꝛ"],[42843,2],[42844,1,"ꝝ"],[42845,2],[42846,1,"ꝟ"],[42847,2],[42848,1,"ꝡ"],[42849,2],[42850,1,"ꝣ"],[42851,2],[42852,1,"ꝥ"],[42853,2],[42854,1,"ꝧ"],[42855,2],[42856,1,"ꝩ"],[42857,2],[42858,1,"ꝫ"],[42859,2],[42860,1,"ꝭ"],[42861,2],[42862,1,"ꝯ"],[42863,2],[42864,1,"ꝯ"],[[42865,42872],2],[42873,1,"ꝺ"],[42874,2],[42875,1,"ꝼ"],[42876,2],[42877,1,"ᵹ"],[42878,1,"ꝿ"],[42879,2],[42880,1,"ꞁ"],[42881,2],[42882,1,"ꞃ"],[42883,2],[42884,1,"ꞅ"],[42885,2],[42886,1,"ꞇ"],[[42887,42888],2],[[42889,42890],2],[42891,1,"ꞌ"],[42892,2],[42893,1,"ɥ"],[42894,2],[42895,2],[42896,1,"ꞑ"],[42897,2],[42898,1,"ꞓ"],[42899,2],[[42900,42901],2],[42902,1,"ꞗ"],[42903,2],[42904,1,"ꞙ"],[42905,2],[42906,1,"ꞛ"],[42907,2],[42908,1,"ꞝ"],[42909,2],[42910,1,"ꞟ"],[42911,2],[42912,1,"ꞡ"],[42913,2],[42914,1,"ꞣ"],[42915,2],[42916,1,"ꞥ"],[42917,2],[42918,1,"ꞧ"],[42919,2],[42920,1,"ꞩ"],[42921,2],[42922,1,"ɦ"],[42923,1,"ɜ"],[42924,1,"ɡ"],[42925,1,"ɬ"],[42926,1,"ɪ"],[42927,2],[42928,1,"ʞ"],[42929,1,"ʇ"],[42930,1,"ʝ"],[42931,1,"ꭓ"],[42932,1,"ꞵ"],[42933,2],[42934,1,"ꞷ"],[42935,2],[42936,1,"ꞹ"],[42937,2],[42938,1,"ꞻ"],[42939,2],[42940,1,"ꞽ"],[42941,2],[42942,1,"ꞿ"],[42943,2],[42944,1,"ꟁ"],[42945,2],[42946,1,"ꟃ"],[42947,2],[42948,1,"ꞔ"],[42949,1,"ʂ"],[42950,1,"ᶎ"],[42951,1,"ꟈ"],[42952,2],[42953,1,"ꟊ"],[42954,2],[[42955,42959],3],[42960,1,"ꟑ"],[42961,2],[42962,3],[42963,2],[42964,3],[42965,2],[42966,1,"ꟗ"],[42967,2],[42968,1,"ꟙ"],[42969,2],[[42970,42993],3],[42994,1,"c"],[42995,1,"f"],[42996,1,"q"],[42997,1,"ꟶ"],[42998,2],[42999,2],[43000,1,"ħ"],[43001,1,"œ"],[43002,2],[[43003,43007],2],[[43008,43047],2],[[43048,43051],2],[43052,2],[[43053,43055],3],[[43056,43065],2],[[43066,43071],3],[[43072,43123],2],[[43124,43127],2],[[43128,43135],3],[[43136,43204],2],[43205,2],[[43206,43213],3],[[43214,43215],2],[[43216,43225],2],[[43226,43231],3],[[43232,43255],2],[[43256,43258],2],[43259,2],[43260,2],[43261,2],[[43262,43263],2],[[43264,43309],2],[[43310,43311],2],[[43312,43347],2],[[43348,43358],3],[43359,2],[[43360,43388],2],[[43389,43391],3],[[43392,43456],2],[[43457,43469],2],[43470,3],[[43471,43481],2],[[43482,43485],3],[[43486,43487],2],[[43488,43518],2],[43519,3],[[43520,43574],2],[[43575,43583],3],[[43584,43597],2],[[43598,43599],3],[[43600,43609],2],[[43610,43611],3],[[43612,43615],2],[[43616,43638],2],[[43639,43641],2],[[43642,43643],2],[[43644,43647],2],[[43648,43714],2],[[43715,43738],3],[[43739,43741],2],[[43742,43743],2],[[43744,43759],2],[[43760,43761],2],[[43762,43766],2],[[43767,43776],3],[[43777,43782],2],[[43783,43784],3],[[43785,43790],2],[[43791,43792],3],[[43793,43798],2],[[43799,43807],3],[[43808,43814],2],[43815,3],[[43816,43822],2],[43823,3],[[43824,43866],2],[43867,2],[43868,1,"ꜧ"],[43869,1,"ꬷ"],[43870,1,"ɫ"],[43871,1,"ꭒ"],[[43872,43875],2],[[43876,43877],2],[[43878,43879],2],[43880,2],[43881,1,"ʍ"],[[43882,43883],2],[[43884,43887],3],[43888,1,"Ꭰ"],[43889,1,"Ꭱ"],[43890,1,"Ꭲ"],[43891,1,"Ꭳ"],[43892,1,"Ꭴ"],[43893,1,"Ꭵ"],[43894,1,"Ꭶ"],[43895,1,"Ꭷ"],[43896,1,"Ꭸ"],[43897,1,"Ꭹ"],[43898,1,"Ꭺ"],[43899,1,"Ꭻ"],[43900,1,"Ꭼ"],[43901,1,"Ꭽ"],[43902,1,"Ꭾ"],[43903,1,"Ꭿ"],[43904,1,"Ꮀ"],[43905,1,"Ꮁ"],[43906,1,"Ꮂ"],[43907,1,"Ꮃ"],[43908,1,"Ꮄ"],[43909,1,"Ꮅ"],[43910,1,"Ꮆ"],[43911,1,"Ꮇ"],[43912,1,"Ꮈ"],[43913,1,"Ꮉ"],[43914,1,"Ꮊ"],[43915,1,"Ꮋ"],[43916,1,"Ꮌ"],[43917,1,"Ꮍ"],[43918,1,"Ꮎ"],[43919,1,"Ꮏ"],[43920,1,"Ꮐ"],[43921,1,"Ꮑ"],[43922,1,"Ꮒ"],[43923,1,"Ꮓ"],[43924,1,"Ꮔ"],[43925,1,"Ꮕ"],[43926,1,"Ꮖ"],[43927,1,"Ꮗ"],[43928,1,"Ꮘ"],[43929,1,"Ꮙ"],[43930,1,"Ꮚ"],[43931,1,"Ꮛ"],[43932,1,"Ꮜ"],[43933,1,"Ꮝ"],[43934,1,"Ꮞ"],[43935,1,"Ꮟ"],[43936,1,"Ꮠ"],[43937,1,"Ꮡ"],[43938,1,"Ꮢ"],[43939,1,"Ꮣ"],[43940,1,"Ꮤ"],[43941,1,"Ꮥ"],[43942,1,"Ꮦ"],[43943,1,"Ꮧ"],[43944,1,"Ꮨ"],[43945,1,"Ꮩ"],[43946,1,"Ꮪ"],[43947,1,"Ꮫ"],[43948,1,"Ꮬ"],[43949,1,"Ꮭ"],[43950,1,"Ꮮ"],[43951,1,"Ꮯ"],[43952,1,"Ꮰ"],[43953,1,"Ꮱ"],[43954,1,"Ꮲ"],[43955,1,"Ꮳ"],[43956,1,"Ꮴ"],[43957,1,"Ꮵ"],[43958,1,"Ꮶ"],[43959,1,"Ꮷ"],[43960,1,"Ꮸ"],[43961,1,"Ꮹ"],[43962,1,"Ꮺ"],[43963,1,"Ꮻ"],[43964,1,"Ꮼ"],[43965,1,"Ꮽ"],[43966,1,"Ꮾ"],[43967,1,"Ꮿ"],[[43968,44010],2],[44011,2],[[44012,44013],2],[[44014,44015],3],[[44016,44025],2],[[44026,44031],3],[[44032,55203],2],[[55204,55215],3],[[55216,55238],2],[[55239,55242],3],[[55243,55291],2],[[55292,55295],3],[[55296,57343],3],[[57344,63743],3],[63744,1,"豈"],[63745,1,"更"],[63746,1,"車"],[63747,1,"賈"],[63748,1,"滑"],[63749,1,"串"],[63750,1,"句"],[[63751,63752],1,"龜"],[63753,1,"契"],[63754,1,"金"],[63755,1,"喇"],[63756,1,"奈"],[63757,1,"懶"],[63758,1,"癩"],[63759,1,"羅"],[63760,1,"蘿"],[63761,1,"螺"],[63762,1,"裸"],[63763,1,"邏"],[63764,1,"樂"],[63765,1,"洛"],[63766,1,"烙"],[63767,1,"珞"],[63768,1,"落"],[63769,1,"酪"],[63770,1,"駱"],[63771,1,"亂"],[63772,1,"卵"],[63773,1,"欄"],[63774,1,"爛"],[63775,1,"蘭"],[63776,1,"鸞"],[63777,1,"嵐"],[63778,1,"濫"],[63779,1,"藍"],[63780,1,"襤"],[63781,1,"拉"],[63782,1,"臘"],[63783,1,"蠟"],[63784,1,"廊"],[63785,1,"朗"],[63786,1,"浪"],[63787,1,"狼"],[63788,1,"郎"],[63789,1,"來"],[63790,1,"冷"],[63791,1,"勞"],[63792,1,"擄"],[63793,1,"櫓"],[63794,1,"爐"],[63795,1,"盧"],[63796,1,"老"],[63797,1,"蘆"],[63798,1,"虜"],[63799,1,"路"],[63800,1,"露"],[63801,1,"魯"],[63802,1,"鷺"],[63803,1,"碌"],[63804,1,"祿"],[63805,1,"綠"],[63806,1,"菉"],[63807,1,"錄"],[63808,1,"鹿"],[63809,1,"論"],[63810,1,"壟"],[63811,1,"弄"],[63812,1,"籠"],[63813,1,"聾"],[63814,1,"牢"],[63815,1,"磊"],[63816,1,"賂"],[63817,1,"雷"],[63818,1,"壘"],[63819,1,"屢"],[63820,1,"樓"],[63821,1,"淚"],[63822,1,"漏"],[63823,1,"累"],[63824,1,"縷"],[63825,1,"陋"],[63826,1,"勒"],[63827,1,"肋"],[63828,1,"凜"],[63829,1,"凌"],[63830,1,"稜"],[63831,1,"綾"],[63832,1,"菱"],[63833,1,"陵"],[63834,1,"讀"],[63835,1,"拏"],[63836,1,"樂"],[63837,1,"諾"],[63838,1,"丹"],[63839,1,"寧"],[63840,1,"怒"],[63841,1,"率"],[63842,1,"異"],[63843,1,"北"],[63844,1,"磻"],[63845,1,"便"],[63846,1,"復"],[63847,1,"不"],[63848,1,"泌"],[63849,1,"數"],[63850,1,"索"],[63851,1,"參"],[63852,1,"塞"],[63853,1,"省"],[63854,1,"葉"],[63855,1,"說"],[63856,1,"殺"],[63857,1,"辰"],[63858,1,"沈"],[63859,1,"拾"],[63860,1,"若"],[63861,1,"掠"],[63862,1,"略"],[63863,1,"亮"],[63864,1,"兩"],[63865,1,"凉"],[63866,1,"梁"],[63867,1,"糧"],[63868,1,"良"],[63869,1,"諒"],[63870,1,"量"],[63871,1,"勵"],[63872,1,"呂"],[63873,1,"女"],[63874,1,"廬"],[63875,1,"旅"],[63876,1,"濾"],[63877,1,"礪"],[63878,1,"閭"],[63879,1,"驪"],[63880,1,"麗"],[63881,1,"黎"],[63882,1,"力"],[63883,1,"曆"],[63884,1,"歷"],[63885,1,"轢"],[63886,1,"年"],[63887,1,"憐"],[63888,1,"戀"],[63889,1,"撚"],[63890,1,"漣"],[63891,1,"煉"],[63892,1,"璉"],[63893,1,"秊"],[63894,1,"練"],[63895,1,"聯"],[63896,1,"輦"],[63897,1,"蓮"],[63898,1,"連"],[63899,1,"鍊"],[63900,1,"列"],[63901,1,"劣"],[63902,1,"咽"],[63903,1,"烈"],[63904,1,"裂"],[63905,1,"說"],[63906,1,"廉"],[63907,1,"念"],[63908,1,"捻"],[63909,1,"殮"],[63910,1,"簾"],[63911,1,"獵"],[63912,1,"令"],[63913,1,"囹"],[63914,1,"寧"],[63915,1,"嶺"],[63916,1,"怜"],[63917,1,"玲"],[63918,1,"瑩"],[63919,1,"羚"],[63920,1,"聆"],[63921,1,"鈴"],[63922,1,"零"],[63923,1,"靈"],[63924,1,"領"],[63925,1,"例"],[63926,1,"禮"],[63927,1,"醴"],[63928,1,"隸"],[63929,1,"惡"],[63930,1,"了"],[63931,1,"僚"],[63932,1,"寮"],[63933,1,"尿"],[63934,1,"料"],[63935,1,"樂"],[63936,1,"燎"],[63937,1,"療"],[63938,1,"蓼"],[63939,1,"遼"],[63940,1,"龍"],[63941,1,"暈"],[63942,1,"阮"],[63943,1,"劉"],[63944,1,"杻"],[63945,1,"柳"],[63946,1,"流"],[63947,1,"溜"],[63948,1,"琉"],[63949,1,"留"],[63950,1,"硫"],[63951,1,"紐"],[63952,1,"類"],[63953,1,"六"],[63954,1,"戮"],[63955,1,"陸"],[63956,1,"倫"],[63957,1,"崙"],[63958,1,"淪"],[63959,1,"輪"],[63960,1,"律"],[63961,1,"慄"],[63962,1,"栗"],[63963,1,"率"],[63964,1,"隆"],[63965,1,"利"],[63966,1,"吏"],[63967,1,"履"],[63968,1,"易"],[63969,1,"李"],[63970,1,"梨"],[63971,1,"泥"],[63972,1,"理"],[63973,1,"痢"],[63974,1,"罹"],[63975,1,"裏"],[63976,1,"裡"],[63977,1,"里"],[63978,1,"離"],[63979,1,"匿"],[63980,1,"溺"],[63981,1,"吝"],[63982,1,"燐"],[63983,1,"璘"],[63984,1,"藺"],[63985,1,"隣"],[63986,1,"鱗"],[63987,1,"麟"],[63988,1,"林"],[63989,1,"淋"],[63990,1,"臨"],[63991,1,"立"],[63992,1,"笠"],[63993,1,"粒"],[63994,1,"狀"],[63995,1,"炙"],[63996,1,"識"],[63997,1,"什"],[63998,1,"茶"],[63999,1,"刺"],[64000,1,"切"],[64001,1,"度"],[64002,1,"拓"],[64003,1,"糖"],[64004,1,"宅"],[64005,1,"洞"],[64006,1,"暴"],[64007,1,"輻"],[64008,1,"行"],[64009,1,"降"],[64010,1,"見"],[64011,1,"廓"],[64012,1,"兀"],[64013,1,"嗀"],[[64014,64015],2],[64016,1,"塚"],[64017,2],[64018,1,"晴"],[[64019,64020],2],[64021,1,"凞"],[64022,1,"猪"],[64023,1,"益"],[64024,1,"礼"],[64025,1,"神"],[64026,1,"祥"],[64027,1,"福"],[64028,1,"靖"],[64029,1,"精"],[64030,1,"羽"],[64031,2],[64032,1,"蘒"],[64033,2],[64034,1,"諸"],[[64035,64036],2],[64037,1,"逸"],[64038,1,"都"],[[64039,64041],2],[64042,1,"飯"],[64043,1,"飼"],[64044,1,"館"],[64045,1,"鶴"],[64046,1,"郞"],[64047,1,"隷"],[64048,1,"侮"],[64049,1,"僧"],[64050,1,"免"],[64051,1,"勉"],[64052,1,"勤"],[64053,1,"卑"],[64054,1,"喝"],[64055,1,"嘆"],[64056,1,"器"],[64057,1,"塀"],[64058,1,"墨"],[64059,1,"層"],[64060,1,"屮"],[64061,1,"悔"],[64062,1,"慨"],[64063,1,"憎"],[64064,1,"懲"],[64065,1,"敏"],[64066,1,"既"],[64067,1,"暑"],[64068,1,"梅"],[64069,1,"海"],[64070,1,"渚"],[64071,1,"漢"],[64072,1,"煮"],[64073,1,"爫"],[64074,1,"琢"],[64075,1,"碑"],[64076,1,"社"],[64077,1,"祉"],[64078,1,"祈"],[64079,1,"祐"],[64080,1,"祖"],[64081,1,"祝"],[64082,1,"禍"],[64083,1,"禎"],[64084,1,"穀"],[64085,1,"突"],[64086,1,"節"],[64087,1,"練"],[64088,1,"縉"],[64089,1,"繁"],[64090,1,"署"],[64091,1,"者"],[64092,1,"臭"],[[64093,64094],1,"艹"],[64095,1,"著"],[64096,1,"褐"],[64097,1,"視"],[64098,1,"謁"],[64099,1,"謹"],[64100,1,"賓"],[64101,1,"贈"],[64102,1,"辶"],[64103,1,"逸"],[64104,1,"難"],[64105,1,"響"],[64106,1,"頻"],[64107,1,"恵"],[64108,1,"𤋮"],[64109,1,"舘"],[[64110,64111],3],[64112,1,"並"],[64113,1,"况"],[64114,1,"全"],[64115,1,"侀"],[64116,1,"充"],[64117,1,"冀"],[64118,1,"勇"],[64119,1,"勺"],[64120,1,"喝"],[64121,1,"啕"],[64122,1,"喙"],[64123,1,"嗢"],[64124,1,"塚"],[64125,1,"墳"],[64126,1,"奄"],[64127,1,"奔"],[64128,1,"婢"],[64129,1,"嬨"],[64130,1,"廒"],[64131,1,"廙"],[64132,1,"彩"],[64133,1,"徭"],[64134,1,"惘"],[64135,1,"慎"],[64136,1,"愈"],[64137,1,"憎"],[64138,1,"慠"],[64139,1,"懲"],[64140,1,"戴"],[64141,1,"揄"],[64142,1,"搜"],[64143,1,"摒"],[64144,1,"敖"],[64145,1,"晴"],[64146,1,"朗"],[64147,1,"望"],[64148,1,"杖"],[64149,1,"歹"],[64150,1,"殺"],[64151,1,"流"],[64152,1,"滛"],[64153,1,"滋"],[64154,1,"漢"],[64155,1,"瀞"],[64156,1,"煮"],[64157,1,"瞧"],[64158,1,"爵"],[64159,1,"犯"],[64160,1,"猪"],[64161,1,"瑱"],[64162,1,"甆"],[64163,1,"画"],[64164,1,"瘝"],[64165,1,"瘟"],[64166,1,"益"],[64167,1,"盛"],[64168,1,"直"],[64169,1,"睊"],[64170,1,"着"],[64171,1,"磌"],[64172,1,"窱"],[64173,1,"節"],[64174,1,"类"],[64175,1,"絛"],[64176,1,"練"],[64177,1,"缾"],[64178,1,"者"],[64179,1,"荒"],[64180,1,"華"],[64181,1,"蝹"],[64182,1,"襁"],[64183,1,"覆"],[64184,1,"視"],[64185,1,"調"],[64186,1,"諸"],[64187,1,"請"],[64188,1,"謁"],[64189,1,"諾"],[64190,1,"諭"],[64191,1,"謹"],[64192,1,"變"],[64193,1,"贈"],[64194,1,"輸"],[64195,1,"遲"],[64196,1,"醙"],[64197,1,"鉶"],[64198,1,"陼"],[64199,1,"難"],[64200,1,"靖"],[64201,1,"韛"],[64202,1,"響"],[64203,1,"頋"],[64204,1,"頻"],[64205,1,"鬒"],[64206,1,"龜"],[64207,1,"𢡊"],[64208,1,"𢡄"],[64209,1,"𣏕"],[64210,1,"㮝"],[64211,1,"䀘"],[64212,1,"䀹"],[64213,1,"𥉉"],[64214,1,"𥳐"],[64215,1,"𧻓"],[64216,1,"齃"],[64217,1,"龎"],[[64218,64255],3],[64256,1,"ff"],[64257,1,"fi"],[64258,1,"fl"],[64259,1,"ffi"],[64260,1,"ffl"],[[64261,64262],1,"st"],[[64263,64274],3],[64275,1,"մն"],[64276,1,"մե"],[64277,1,"մի"],[64278,1,"վն"],[64279,1,"մխ"],[[64280,64284],3],[64285,1,"יִ"],[64286,2],[64287,1,"ײַ"],[64288,1,"ע"],[64289,1,"א"],[64290,1,"ד"],[64291,1,"ה"],[64292,1,"כ"],[64293,1,"ל"],[64294,1,"ם"],[64295,1,"ר"],[64296,1,"ת"],[64297,5,"+"],[64298,1,"שׁ"],[64299,1,"שׂ"],[64300,1,"שּׁ"],[64301,1,"שּׂ"],[64302,1,"אַ"],[64303,1,"אָ"],[64304,1,"אּ"],[64305,1,"בּ"],[64306,1,"גּ"],[64307,1,"דּ"],[64308,1,"הּ"],[64309,1,"וּ"],[64310,1,"זּ"],[64311,3],[64312,1,"טּ"],[64313,1,"יּ"],[64314,1,"ךּ"],[64315,1,"כּ"],[64316,1,"לּ"],[64317,3],[64318,1,"מּ"],[64319,3],[64320,1,"נּ"],[64321,1,"סּ"],[64322,3],[64323,1,"ףּ"],[64324,1,"פּ"],[64325,3],[64326,1,"צּ"],[64327,1,"קּ"],[64328,1,"רּ"],[64329,1,"שּ"],[64330,1,"תּ"],[64331,1,"וֹ"],[64332,1,"בֿ"],[64333,1,"כֿ"],[64334,1,"פֿ"],[64335,1,"אל"],[[64336,64337],1,"ٱ"],[[64338,64341],1,"ٻ"],[[64342,64345],1,"پ"],[[64346,64349],1,"ڀ"],[[64350,64353],1,"ٺ"],[[64354,64357],1,"ٿ"],[[64358,64361],1,"ٹ"],[[64362,64365],1,"ڤ"],[[64366,64369],1,"ڦ"],[[64370,64373],1,"ڄ"],[[64374,64377],1,"ڃ"],[[64378,64381],1,"چ"],[[64382,64385],1,"ڇ"],[[64386,64387],1,"ڍ"],[[64388,64389],1,"ڌ"],[[64390,64391],1,"ڎ"],[[64392,64393],1,"ڈ"],[[64394,64395],1,"ژ"],[[64396,64397],1,"ڑ"],[[64398,64401],1,"ک"],[[64402,64405],1,"گ"],[[64406,64409],1,"ڳ"],[[64410,64413],1,"ڱ"],[[64414,64415],1,"ں"],[[64416,64419],1,"ڻ"],[[64420,64421],1,"ۀ"],[[64422,64425],1,"ہ"],[[64426,64429],1,"ھ"],[[64430,64431],1,"ے"],[[64432,64433],1,"ۓ"],[[64434,64449],2],[64450,2],[[64451,64466],3],[[64467,64470],1,"ڭ"],[[64471,64472],1,"ۇ"],[[64473,64474],1,"ۆ"],[[64475,64476],1,"ۈ"],[64477,1,"ۇٴ"],[[64478,64479],1,"ۋ"],[[64480,64481],1,"ۅ"],[[64482,64483],1,"ۉ"],[[64484,64487],1,"ې"],[[64488,64489],1,"ى"],[[64490,64491],1,"ئا"],[[64492,64493],1,"ئە"],[[64494,64495],1,"ئو"],[[64496,64497],1,"ئۇ"],[[64498,64499],1,"ئۆ"],[[64500,64501],1,"ئۈ"],[[64502,64504],1,"ئې"],[[64505,64507],1,"ئى"],[[64508,64511],1,"ی"],[64512,1,"ئج"],[64513,1,"ئح"],[64514,1,"ئم"],[64515,1,"ئى"],[64516,1,"ئي"],[64517,1,"بج"],[64518,1,"بح"],[64519,1,"بخ"],[64520,1,"بم"],[64521,1,"بى"],[64522,1,"بي"],[64523,1,"تج"],[64524,1,"تح"],[64525,1,"تخ"],[64526,1,"تم"],[64527,1,"تى"],[64528,1,"تي"],[64529,1,"ثج"],[64530,1,"ثم"],[64531,1,"ثى"],[64532,1,"ثي"],[64533,1,"جح"],[64534,1,"جم"],[64535,1,"حج"],[64536,1,"حم"],[64537,1,"خج"],[64538,1,"خح"],[64539,1,"خم"],[64540,1,"سج"],[64541,1,"سح"],[64542,1,"سخ"],[64543,1,"سم"],[64544,1,"صح"],[64545,1,"صم"],[64546,1,"ضج"],[64547,1,"ضح"],[64548,1,"ضخ"],[64549,1,"ضم"],[64550,1,"طح"],[64551,1,"طم"],[64552,1,"ظم"],[64553,1,"عج"],[64554,1,"عم"],[64555,1,"غج"],[64556,1,"غم"],[64557,1,"فج"],[64558,1,"فح"],[64559,1,"فخ"],[64560,1,"فم"],[64561,1,"فى"],[64562,1,"في"],[64563,1,"قح"],[64564,1,"قم"],[64565,1,"قى"],[64566,1,"قي"],[64567,1,"كا"],[64568,1,"كج"],[64569,1,"كح"],[64570,1,"كخ"],[64571,1,"كل"],[64572,1,"كم"],[64573,1,"كى"],[64574,1,"كي"],[64575,1,"لج"],[64576,1,"لح"],[64577,1,"لخ"],[64578,1,"لم"],[64579,1,"لى"],[64580,1,"لي"],[64581,1,"مج"],[64582,1,"مح"],[64583,1,"مخ"],[64584,1,"مم"],[64585,1,"مى"],[64586,1,"مي"],[64587,1,"نج"],[64588,1,"نح"],[64589,1,"نخ"],[64590,1,"نم"],[64591,1,"نى"],[64592,1,"ني"],[64593,1,"هج"],[64594,1,"هم"],[64595,1,"هى"],[64596,1,"هي"],[64597,1,"يج"],[64598,1,"يح"],[64599,1,"يخ"],[64600,1,"يم"],[64601,1,"يى"],[64602,1,"يي"],[64603,1,"ذٰ"],[64604,1,"رٰ"],[64605,1,"ىٰ"],[64606,5," ٌّ"],[64607,5," ٍّ"],[64608,5," َّ"],[64609,5," ُّ"],[64610,5," ِّ"],[64611,5," ّٰ"],[64612,1,"ئر"],[64613,1,"ئز"],[64614,1,"ئم"],[64615,1,"ئن"],[64616,1,"ئى"],[64617,1,"ئي"],[64618,1,"بر"],[64619,1,"بز"],[64620,1,"بم"],[64621,1,"بن"],[64622,1,"بى"],[64623,1,"بي"],[64624,1,"تر"],[64625,1,"تز"],[64626,1,"تم"],[64627,1,"تن"],[64628,1,"تى"],[64629,1,"تي"],[64630,1,"ثر"],[64631,1,"ثز"],[64632,1,"ثم"],[64633,1,"ثن"],[64634,1,"ثى"],[64635,1,"ثي"],[64636,1,"فى"],[64637,1,"في"],[64638,1,"قى"],[64639,1,"قي"],[64640,1,"كا"],[64641,1,"كل"],[64642,1,"كم"],[64643,1,"كى"],[64644,1,"كي"],[64645,1,"لم"],[64646,1,"لى"],[64647,1,"لي"],[64648,1,"ما"],[64649,1,"مم"],[64650,1,"نر"],[64651,1,"نز"],[64652,1,"نم"],[64653,1,"نن"],[64654,1,"نى"],[64655,1,"ني"],[64656,1,"ىٰ"],[64657,1,"ير"],[64658,1,"يز"],[64659,1,"يم"],[64660,1,"ين"],[64661,1,"يى"],[64662,1,"يي"],[64663,1,"ئج"],[64664,1,"ئح"],[64665,1,"ئخ"],[64666,1,"ئم"],[64667,1,"ئه"],[64668,1,"بج"],[64669,1,"بح"],[64670,1,"بخ"],[64671,1,"بم"],[64672,1,"به"],[64673,1,"تج"],[64674,1,"تح"],[64675,1,"تخ"],[64676,1,"تم"],[64677,1,"ته"],[64678,1,"ثم"],[64679,1,"جح"],[64680,1,"جم"],[64681,1,"حج"],[64682,1,"حم"],[64683,1,"خج"],[64684,1,"خم"],[64685,1,"سج"],[64686,1,"سح"],[64687,1,"سخ"],[64688,1,"سم"],[64689,1,"صح"],[64690,1,"صخ"],[64691,1,"صم"],[64692,1,"ضج"],[64693,1,"ضح"],[64694,1,"ضخ"],[64695,1,"ضم"],[64696,1,"طح"],[64697,1,"ظم"],[64698,1,"عج"],[64699,1,"عم"],[64700,1,"غج"],[64701,1,"غم"],[64702,1,"فج"],[64703,1,"فح"],[64704,1,"فخ"],[64705,1,"فم"],[64706,1,"قح"],[64707,1,"قم"],[64708,1,"كج"],[64709,1,"كح"],[64710,1,"كخ"],[64711,1,"كل"],[64712,1,"كم"],[64713,1,"لج"],[64714,1,"لح"],[64715,1,"لخ"],[64716,1,"لم"],[64717,1,"له"],[64718,1,"مج"],[64719,1,"مح"],[64720,1,"مخ"],[64721,1,"مم"],[64722,1,"نج"],[64723,1,"نح"],[64724,1,"نخ"],[64725,1,"نم"],[64726,1,"نه"],[64727,1,"هج"],[64728,1,"هم"],[64729,1,"هٰ"],[64730,1,"يج"],[64731,1,"يح"],[64732,1,"يخ"],[64733,1,"يم"],[64734,1,"يه"],[64735,1,"ئم"],[64736,1,"ئه"],[64737,1,"بم"],[64738,1,"به"],[64739,1,"تم"],[64740,1,"ته"],[64741,1,"ثم"],[64742,1,"ثه"],[64743,1,"سم"],[64744,1,"سه"],[64745,1,"شم"],[64746,1,"شه"],[64747,1,"كل"],[64748,1,"كم"],[64749,1,"لم"],[64750,1,"نم"],[64751,1,"نه"],[64752,1,"يم"],[64753,1,"يه"],[64754,1,"ـَّ"],[64755,1,"ـُّ"],[64756,1,"ـِّ"],[64757,1,"طى"],[64758,1,"طي"],[64759,1,"عى"],[64760,1,"عي"],[64761,1,"غى"],[64762,1,"غي"],[64763,1,"سى"],[64764,1,"سي"],[64765,1,"شى"],[64766,1,"شي"],[64767,1,"حى"],[64768,1,"حي"],[64769,1,"جى"],[64770,1,"جي"],[64771,1,"خى"],[64772,1,"خي"],[64773,1,"صى"],[64774,1,"صي"],[64775,1,"ضى"],[64776,1,"ضي"],[64777,1,"شج"],[64778,1,"شح"],[64779,1,"شخ"],[64780,1,"شم"],[64781,1,"شر"],[64782,1,"سر"],[64783,1,"صر"],[64784,1,"ضر"],[64785,1,"طى"],[64786,1,"طي"],[64787,1,"عى"],[64788,1,"عي"],[64789,1,"غى"],[64790,1,"غي"],[64791,1,"سى"],[64792,1,"سي"],[64793,1,"شى"],[64794,1,"شي"],[64795,1,"حى"],[64796,1,"حي"],[64797,1,"جى"],[64798,1,"جي"],[64799,1,"خى"],[64800,1,"خي"],[64801,1,"صى"],[64802,1,"صي"],[64803,1,"ضى"],[64804,1,"ضي"],[64805,1,"شج"],[64806,1,"شح"],[64807,1,"شخ"],[64808,1,"شم"],[64809,1,"شر"],[64810,1,"سر"],[64811,1,"صر"],[64812,1,"ضر"],[64813,1,"شج"],[64814,1,"شح"],[64815,1,"شخ"],[64816,1,"شم"],[64817,1,"سه"],[64818,1,"شه"],[64819,1,"طم"],[64820,1,"سج"],[64821,1,"سح"],[64822,1,"سخ"],[64823,1,"شج"],[64824,1,"شح"],[64825,1,"شخ"],[64826,1,"طم"],[64827,1,"ظم"],[[64828,64829],1,"اً"],[[64830,64831],2],[[64832,64847],2],[64848,1,"تجم"],[[64849,64850],1,"تحج"],[64851,1,"تحم"],[64852,1,"تخم"],[64853,1,"تمج"],[64854,1,"تمح"],[64855,1,"تمخ"],[[64856,64857],1,"جمح"],[64858,1,"حمي"],[64859,1,"حمى"],[64860,1,"سحج"],[64861,1,"سجح"],[64862,1,"سجى"],[[64863,64864],1,"سمح"],[64865,1,"سمج"],[[64866,64867],1,"سمم"],[[64868,64869],1,"صحح"],[64870,1,"صمم"],[[64871,64872],1,"شحم"],[64873,1,"شجي"],[[64874,64875],1,"شمخ"],[[64876,64877],1,"شمم"],[64878,1,"ضحى"],[[64879,64880],1,"ضخم"],[[64881,64882],1,"طمح"],[64883,1,"طمم"],[64884,1,"طمي"],[64885,1,"عجم"],[[64886,64887],1,"عمم"],[64888,1,"عمى"],[64889,1,"غمم"],[64890,1,"غمي"],[64891,1,"غمى"],[[64892,64893],1,"فخم"],[64894,1,"قمح"],[64895,1,"قمم"],[64896,1,"لحم"],[64897,1,"لحي"],[64898,1,"لحى"],[[64899,64900],1,"لجج"],[[64901,64902],1,"لخم"],[[64903,64904],1,"لمح"],[64905,1,"محج"],[64906,1,"محم"],[64907,1,"محي"],[64908,1,"مجح"],[64909,1,"مجم"],[64910,1,"مخج"],[64911,1,"مخم"],[[64912,64913],3],[64914,1,"مجخ"],[64915,1,"همج"],[64916,1,"همم"],[64917,1,"نحم"],[64918,1,"نحى"],[[64919,64920],1,"نجم"],[64921,1,"نجى"],[64922,1,"نمي"],[64923,1,"نمى"],[[64924,64925],1,"يمم"],[64926,1,"بخي"],[64927,1,"تجي"],[64928,1,"تجى"],[64929,1,"تخي"],[64930,1,"تخى"],[64931,1,"تمي"],[64932,1,"تمى"],[64933,1,"جمي"],[64934,1,"جحى"],[64935,1,"جمى"],[64936,1,"سخى"],[64937,1,"صحي"],[64938,1,"شحي"],[64939,1,"ضحي"],[64940,1,"لجي"],[64941,1,"لمي"],[64942,1,"يحي"],[64943,1,"يجي"],[64944,1,"يمي"],[64945,1,"ممي"],[64946,1,"قمي"],[64947,1,"نحي"],[64948,1,"قمح"],[64949,1,"لحم"],[64950,1,"عمي"],[64951,1,"كمي"],[64952,1,"نجح"],[64953,1,"مخي"],[64954,1,"لجم"],[64955,1,"كمم"],[64956,1,"لجم"],[64957,1,"نجح"],[64958,1,"جحي"],[64959,1,"حجي"],[64960,1,"مجي"],[64961,1,"فمي"],[64962,1,"بحي"],[64963,1,"كمم"],[64964,1,"عجم"],[64965,1,"صمم"],[64966,1,"سخي"],[64967,1,"نجي"],[[64968,64974],3],[64975,2],[[64976,65007],3],[65008,1,"صلے"],[65009,1,"قلے"],[65010,1,"الله"],[65011,1,"اكبر"],[65012,1,"محمد"],[65013,1,"صلعم"],[65014,1,"رسول"],[65015,1,"عليه"],[65016,1,"وسلم"],[65017,1,"صلى"],[65018,5,"صلى الله عليه وسلم"],[65019,5,"جل جلاله"],[65020,1,"ریال"],[65021,2],[[65022,65023],2],[[65024,65039],7],[65040,5,","],[65041,1,"、"],[65042,3],[65043,5,":"],[65044,5,";"],[65045,5,"!"],[65046,5,"?"],[65047,1,"〖"],[65048,1,"〗"],[65049,3],[[65050,65055],3],[[65056,65059],2],[[65060,65062],2],[[65063,65069],2],[[65070,65071],2],[65072,3],[65073,1,"—"],[65074,1,"–"],[[65075,65076],5,"_"],[65077,5,"("],[65078,5,")"],[65079,5,"{"],[65080,5,"}"],[65081,1,"〔"],[65082,1,"〕"],[65083,1,"【"],[65084,1,"】"],[65085,1,"《"],[65086,1,"》"],[65087,1,"〈"],[65088,1,"〉"],[65089,1,"「"],[65090,1,"」"],[65091,1,"『"],[65092,1,"』"],[[65093,65094],2],[65095,5,"["],[65096,5,"]"],[[65097,65100],5," ̅"],[[65101,65103],5,"_"],[65104,5,","],[65105,1,"、"],[65106,3],[65107,3],[65108,5,";"],[65109,5,":"],[65110,5,"?"],[65111,5,"!"],[65112,1,"—"],[65113,5,"("],[65114,5,")"],[65115,5,"{"],[65116,5,"}"],[65117,1,"〔"],[65118,1,"〕"],[65119,5,"#"],[65120,5,"&"],[65121,5,"*"],[65122,5,"+"],[65123,1,"-"],[65124,5,"<"],[65125,5,">"],[65126,5,"="],[65127,3],[65128,5,"\\"],[65129,5,"$"],[65130,5,"%"],[65131,5,"@"],[[65132,65135],3],[65136,5," ً"],[65137,1,"ـً"],[65138,5," ٌ"],[65139,2],[65140,5," ٍ"],[65141,3],[65142,5," َ"],[65143,1,"ـَ"],[65144,5," ُ"],[65145,1,"ـُ"],[65146,5," ِ"],[65147,1,"ـِ"],[65148,5," ّ"],[65149,1,"ـّ"],[65150,5," ْ"],[65151,1,"ـْ"],[65152,1,"ء"],[[65153,65154],1,"آ"],[[65155,65156],1,"أ"],[[65157,65158],1,"ؤ"],[[65159,65160],1,"إ"],[[65161,65164],1,"ئ"],[[65165,65166],1,"ا"],[[65167,65170],1,"ب"],[[65171,65172],1,"ة"],[[65173,65176],1,"ت"],[[65177,65180],1,"ث"],[[65181,65184],1,"ج"],[[65185,65188],1,"ح"],[[65189,65192],1,"خ"],[[65193,65194],1,"د"],[[65195,65196],1,"ذ"],[[65197,65198],1,"ر"],[[65199,65200],1,"ز"],[[65201,65204],1,"س"],[[65205,65208],1,"ش"],[[65209,65212],1,"ص"],[[65213,65216],1,"ض"],[[65217,65220],1,"ط"],[[65221,65224],1,"ظ"],[[65225,65228],1,"ع"],[[65229,65232],1,"غ"],[[65233,65236],1,"ف"],[[65237,65240],1,"ق"],[[65241,65244],1,"ك"],[[65245,65248],1,"ل"],[[65249,65252],1,"م"],[[65253,65256],1,"ن"],[[65257,65260],1,"ه"],[[65261,65262],1,"و"],[[65263,65264],1,"ى"],[[65265,65268],1,"ي"],[[65269,65270],1,"لآ"],[[65271,65272],1,"لأ"],[[65273,65274],1,"لإ"],[[65275,65276],1,"لا"],[[65277,65278],3],[65279,7],[65280,3],[65281,5,"!"],[65282,5,"\""],[65283,5,"#"],[65284,5,"$"],[65285,5,"%"],[65286,5,"&"],[65287,5,"'"],[65288,5,"("],[65289,5,")"],[65290,5,"*"],[65291,5,"+"],[65292,5,","],[65293,1,"-"],[65294,1,"."],[65295,5,"/"],[65296,1,"0"],[65297,1,"1"],[65298,1,"2"],[65299,1,"3"],[65300,1,"4"],[65301,1,"5"],[65302,1,"6"],[65303,1,"7"],[65304,1,"8"],[65305,1,"9"],[65306,5,":"],[65307,5,";"],[65308,5,"<"],[65309,5,"="],[65310,5,">"],[65311,5,"?"],[65312,5,"@"],[65313,1,"a"],[65314,1,"b"],[65315,1,"c"],[65316,1,"d"],[65317,1,"e"],[65318,1,"f"],[65319,1,"g"],[65320,1,"h"],[65321,1,"i"],[65322,1,"j"],[65323,1,"k"],[65324,1,"l"],[65325,1,"m"],[65326,1,"n"],[65327,1,"o"],[65328,1,"p"],[65329,1,"q"],[65330,1,"r"],[65331,1,"s"],[65332,1,"t"],[65333,1,"u"],[65334,1,"v"],[65335,1,"w"],[65336,1,"x"],[65337,1,"y"],[65338,1,"z"],[65339,5,"["],[65340,5,"\\"],[65341,5,"]"],[65342,5,"^"],[65343,5,"_"],[65344,5,"`"],[65345,1,"a"],[65346,1,"b"],[65347,1,"c"],[65348,1,"d"],[65349,1,"e"],[65350,1,"f"],[65351,1,"g"],[65352,1,"h"],[65353,1,"i"],[65354,1,"j"],[65355,1,"k"],[65356,1,"l"],[65357,1,"m"],[65358,1,"n"],[65359,1,"o"],[65360,1,"p"],[65361,1,"q"],[65362,1,"r"],[65363,1,"s"],[65364,1,"t"],[65365,1,"u"],[65366,1,"v"],[65367,1,"w"],[65368,1,"x"],[65369,1,"y"],[65370,1,"z"],[65371,5,"{"],[65372,5,"|"],[65373,5,"}"],[65374,5,"~"],[65375,1,"⦅"],[65376,1,"⦆"],[65377,1,"."],[65378,1,"「"],[65379,1,"」"],[65380,1,"、"],[65381,1,"・"],[65382,1,"ヲ"],[65383,1,"ァ"],[65384,1,"ィ"],[65385,1,"ゥ"],[65386,1,"ェ"],[65387,1,"ォ"],[65388,1,"ャ"],[65389,1,"ュ"],[65390,1,"ョ"],[65391,1,"ッ"],[65392,1,"ー"],[65393,1,"ア"],[65394,1,"イ"],[65395,1,"ウ"],[65396,1,"エ"],[65397,1,"オ"],[65398,1,"カ"],[65399,1,"キ"],[65400,1,"ク"],[65401,1,"ケ"],[65402,1,"コ"],[65403,1,"サ"],[65404,1,"シ"],[65405,1,"ス"],[65406,1,"セ"],[65407,1,"ソ"],[65408,1,"タ"],[65409,1,"チ"],[65410,1,"ツ"],[65411,1,"テ"],[65412,1,"ト"],[65413,1,"ナ"],[65414,1,"ニ"],[65415,1,"ヌ"],[65416,1,"ネ"],[65417,1,"ノ"],[65418,1,"ハ"],[65419,1,"ヒ"],[65420,1,"フ"],[65421,1,"ヘ"],[65422,1,"ホ"],[65423,1,"マ"],[65424,1,"ミ"],[65425,1,"ム"],[65426,1,"メ"],[65427,1,"モ"],[65428,1,"ヤ"],[65429,1,"ユ"],[65430,1,"ヨ"],[65431,1,"ラ"],[65432,1,"リ"],[65433,1,"ル"],[65434,1,"レ"],[65435,1,"ロ"],[65436,1,"ワ"],[65437,1,"ン"],[65438,1,"゙"],[65439,1,"゚"],[65440,3],[65441,1,"ᄀ"],[65442,1,"ᄁ"],[65443,1,"ᆪ"],[65444,1,"ᄂ"],[65445,1,"ᆬ"],[65446,1,"ᆭ"],[65447,1,"ᄃ"],[65448,1,"ᄄ"],[65449,1,"ᄅ"],[65450,1,"ᆰ"],[65451,1,"ᆱ"],[65452,1,"ᆲ"],[65453,1,"ᆳ"],[65454,1,"ᆴ"],[65455,1,"ᆵ"],[65456,1,"ᄚ"],[65457,1,"ᄆ"],[65458,1,"ᄇ"],[65459,1,"ᄈ"],[65460,1,"ᄡ"],[65461,1,"ᄉ"],[65462,1,"ᄊ"],[65463,1,"ᄋ"],[65464,1,"ᄌ"],[65465,1,"ᄍ"],[65466,1,"ᄎ"],[65467,1,"ᄏ"],[65468,1,"ᄐ"],[65469,1,"ᄑ"],[65470,1,"ᄒ"],[[65471,65473],3],[65474,1,"ᅡ"],[65475,1,"ᅢ"],[65476,1,"ᅣ"],[65477,1,"ᅤ"],[65478,1,"ᅥ"],[65479,1,"ᅦ"],[[65480,65481],3],[65482,1,"ᅧ"],[65483,1,"ᅨ"],[65484,1,"ᅩ"],[65485,1,"ᅪ"],[65486,1,"ᅫ"],[65487,1,"ᅬ"],[[65488,65489],3],[65490,1,"ᅭ"],[65491,1,"ᅮ"],[65492,1,"ᅯ"],[65493,1,"ᅰ"],[65494,1,"ᅱ"],[65495,1,"ᅲ"],[[65496,65497],3],[65498,1,"ᅳ"],[65499,1,"ᅴ"],[65500,1,"ᅵ"],[[65501,65503],3],[65504,1,"¢"],[65505,1,"£"],[65506,1,"¬"],[65507,5," ̄"],[65508,1,"¦"],[65509,1,"¥"],[65510,1,"₩"],[65511,3],[65512,1,"│"],[65513,1,"←"],[65514,1,"↑"],[65515,1,"→"],[65516,1,"↓"],[65517,1,"■"],[65518,1,"○"],[[65519,65528],3],[[65529,65531],3],[65532,3],[65533,3],[[65534,65535],3],[[65536,65547],2],[65548,3],[[65549,65574],2],[65575,3],[[65576,65594],2],[65595,3],[[65596,65597],2],[65598,3],[[65599,65613],2],[[65614,65615],3],[[65616,65629],2],[[65630,65663],3],[[65664,65786],2],[[65787,65791],3],[[65792,65794],2],[[65795,65798],3],[[65799,65843],2],[[65844,65846],3],[[65847,65855],2],[[65856,65930],2],[[65931,65932],2],[[65933,65934],2],[65935,3],[[65936,65947],2],[65948,2],[[65949,65951],3],[65952,2],[[65953,65999],3],[[66000,66044],2],[66045,2],[[66046,66175],3],[[66176,66204],2],[[66205,66207],3],[[66208,66256],2],[[66257,66271],3],[66272,2],[[66273,66299],2],[[66300,66303],3],[[66304,66334],2],[66335,2],[[66336,66339],2],[[66340,66348],3],[[66349,66351],2],[[66352,66368],2],[66369,2],[[66370,66377],2],[66378,2],[[66379,66383],3],[[66384,66426],2],[[66427,66431],3],[[66432,66461],2],[66462,3],[66463,2],[[66464,66499],2],[[66500,66503],3],[[66504,66511],2],[[66512,66517],2],[[66518,66559],3],[66560,1,"𐐨"],[66561,1,"𐐩"],[66562,1,"𐐪"],[66563,1,"𐐫"],[66564,1,"𐐬"],[66565,1,"𐐭"],[66566,1,"𐐮"],[66567,1,"𐐯"],[66568,1,"𐐰"],[66569,1,"𐐱"],[66570,1,"𐐲"],[66571,1,"𐐳"],[66572,1,"𐐴"],[66573,1,"𐐵"],[66574,1,"𐐶"],[66575,1,"𐐷"],[66576,1,"𐐸"],[66577,1,"𐐹"],[66578,1,"𐐺"],[66579,1,"𐐻"],[66580,1,"𐐼"],[66581,1,"𐐽"],[66582,1,"𐐾"],[66583,1,"𐐿"],[66584,1,"𐑀"],[66585,1,"𐑁"],[66586,1,"𐑂"],[66587,1,"𐑃"],[66588,1,"𐑄"],[66589,1,"𐑅"],[66590,1,"𐑆"],[66591,1,"𐑇"],[66592,1,"𐑈"],[66593,1,"𐑉"],[66594,1,"𐑊"],[66595,1,"𐑋"],[66596,1,"𐑌"],[66597,1,"𐑍"],[66598,1,"𐑎"],[66599,1,"𐑏"],[[66600,66637],2],[[66638,66717],2],[[66718,66719],3],[[66720,66729],2],[[66730,66735],3],[66736,1,"𐓘"],[66737,1,"𐓙"],[66738,1,"𐓚"],[66739,1,"𐓛"],[66740,1,"𐓜"],[66741,1,"𐓝"],[66742,1,"𐓞"],[66743,1,"𐓟"],[66744,1,"𐓠"],[66745,1,"𐓡"],[66746,1,"𐓢"],[66747,1,"𐓣"],[66748,1,"𐓤"],[66749,1,"𐓥"],[66750,1,"𐓦"],[66751,1,"𐓧"],[66752,1,"𐓨"],[66753,1,"𐓩"],[66754,1,"𐓪"],[66755,1,"𐓫"],[66756,1,"𐓬"],[66757,1,"𐓭"],[66758,1,"𐓮"],[66759,1,"𐓯"],[66760,1,"𐓰"],[66761,1,"𐓱"],[66762,1,"𐓲"],[66763,1,"𐓳"],[66764,1,"𐓴"],[66765,1,"𐓵"],[66766,1,"𐓶"],[66767,1,"𐓷"],[66768,1,"𐓸"],[66769,1,"𐓹"],[66770,1,"𐓺"],[66771,1,"𐓻"],[[66772,66775],3],[[66776,66811],2],[[66812,66815],3],[[66816,66855],2],[[66856,66863],3],[[66864,66915],2],[[66916,66926],3],[66927,2],[66928,1,"𐖗"],[66929,1,"𐖘"],[66930,1,"𐖙"],[66931,1,"𐖚"],[66932,1,"𐖛"],[66933,1,"𐖜"],[66934,1,"𐖝"],[66935,1,"𐖞"],[66936,1,"𐖟"],[66937,1,"𐖠"],[66938,1,"𐖡"],[66939,3],[66940,1,"𐖣"],[66941,1,"𐖤"],[66942,1,"𐖥"],[66943,1,"𐖦"],[66944,1,"𐖧"],[66945,1,"𐖨"],[66946,1,"𐖩"],[66947,1,"𐖪"],[66948,1,"𐖫"],[66949,1,"𐖬"],[66950,1,"𐖭"],[66951,1,"𐖮"],[66952,1,"𐖯"],[66953,1,"𐖰"],[66954,1,"𐖱"],[66955,3],[66956,1,"𐖳"],[66957,1,"𐖴"],[66958,1,"𐖵"],[66959,1,"𐖶"],[66960,1,"𐖷"],[66961,1,"𐖸"],[66962,1,"𐖹"],[66963,3],[66964,1,"𐖻"],[66965,1,"𐖼"],[66966,3],[[66967,66977],2],[66978,3],[[66979,66993],2],[66994,3],[[66995,67001],2],[67002,3],[[67003,67004],2],[[67005,67071],3],[[67072,67382],2],[[67383,67391],3],[[67392,67413],2],[[67414,67423],3],[[67424,67431],2],[[67432,67455],3],[67456,2],[67457,1,"ː"],[67458,1,"ˑ"],[67459,1,"æ"],[67460,1,"ʙ"],[67461,1,"ɓ"],[67462,3],[67463,1,"ʣ"],[67464,1,"ꭦ"],[67465,1,"ʥ"],[67466,1,"ʤ"],[67467,1,"ɖ"],[67468,1,"ɗ"],[67469,1,"ᶑ"],[67470,1,"ɘ"],[67471,1,"ɞ"],[67472,1,"ʩ"],[67473,1,"ɤ"],[67474,1,"ɢ"],[67475,1,"ɠ"],[67476,1,"ʛ"],[67477,1,"ħ"],[67478,1,"ʜ"],[67479,1,"ɧ"],[67480,1,"ʄ"],[67481,1,"ʪ"],[67482,1,"ʫ"],[67483,1,"ɬ"],[67484,1,"𝼄"],[67485,1,"ꞎ"],[67486,1,"ɮ"],[67487,1,"𝼅"],[67488,1,"ʎ"],[67489,1,"𝼆"],[67490,1,"ø"],[67491,1,"ɶ"],[67492,1,"ɷ"],[67493,1,"q"],[67494,1,"ɺ"],[67495,1,"𝼈"],[67496,1,"ɽ"],[67497,1,"ɾ"],[67498,1,"ʀ"],[67499,1,"ʨ"],[67500,1,"ʦ"],[67501,1,"ꭧ"],[67502,1,"ʧ"],[67503,1,"ʈ"],[67504,1,"ⱱ"],[67505,3],[67506,1,"ʏ"],[67507,1,"ʡ"],[67508,1,"ʢ"],[67509,1,"ʘ"],[67510,1,"ǀ"],[67511,1,"ǁ"],[67512,1,"ǂ"],[67513,1,"𝼊"],[67514,1,"𝼞"],[[67515,67583],3],[[67584,67589],2],[[67590,67591],3],[67592,2],[67593,3],[[67594,67637],2],[67638,3],[[67639,67640],2],[[67641,67643],3],[67644,2],[[67645,67646],3],[67647,2],[[67648,67669],2],[67670,3],[[67671,67679],2],[[67680,67702],2],[[67703,67711],2],[[67712,67742],2],[[67743,67750],3],[[67751,67759],2],[[67760,67807],3],[[67808,67826],2],[67827,3],[[67828,67829],2],[[67830,67834],3],[[67835,67839],2],[[67840,67861],2],[[67862,67865],2],[[67866,67867],2],[[67868,67870],3],[67871,2],[[67872,67897],2],[[67898,67902],3],[67903,2],[[67904,67967],3],[[67968,68023],2],[[68024,68027],3],[[68028,68029],2],[[68030,68031],2],[[68032,68047],2],[[68048,68049],3],[[68050,68095],2],[[68096,68099],2],[68100,3],[[68101,68102],2],[[68103,68107],3],[[68108,68115],2],[68116,3],[[68117,68119],2],[68120,3],[[68121,68147],2],[[68148,68149],2],[[68150,68151],3],[[68152,68154],2],[[68155,68158],3],[68159,2],[[68160,68167],2],[68168,2],[[68169,68175],3],[[68176,68184],2],[[68185,68191],3],[[68192,68220],2],[[68221,68223],2],[[68224,68252],2],[[68253,68255],2],[[68256,68287],3],[[68288,68295],2],[68296,2],[[68297,68326],2],[[68327,68330],3],[[68331,68342],2],[[68343,68351],3],[[68352,68405],2],[[68406,68408],3],[[68409,68415],2],[[68416,68437],2],[[68438,68439],3],[[68440,68447],2],[[68448,68466],2],[[68467,68471],3],[[68472,68479],2],[[68480,68497],2],[[68498,68504],3],[[68505,68508],2],[[68509,68520],3],[[68521,68527],2],[[68528,68607],3],[[68608,68680],2],[[68681,68735],3],[68736,1,"𐳀"],[68737,1,"𐳁"],[68738,1,"𐳂"],[68739,1,"𐳃"],[68740,1,"𐳄"],[68741,1,"𐳅"],[68742,1,"𐳆"],[68743,1,"𐳇"],[68744,1,"𐳈"],[68745,1,"𐳉"],[68746,1,"𐳊"],[68747,1,"𐳋"],[68748,1,"𐳌"],[68749,1,"𐳍"],[68750,1,"𐳎"],[68751,1,"𐳏"],[68752,1,"𐳐"],[68753,1,"𐳑"],[68754,1,"𐳒"],[68755,1,"𐳓"],[68756,1,"𐳔"],[68757,1,"𐳕"],[68758,1,"𐳖"],[68759,1,"𐳗"],[68760,1,"𐳘"],[68761,1,"𐳙"],[68762,1,"𐳚"],[68763,1,"𐳛"],[68764,1,"𐳜"],[68765,1,"𐳝"],[68766,1,"𐳞"],[68767,1,"𐳟"],[68768,1,"𐳠"],[68769,1,"𐳡"],[68770,1,"𐳢"],[68771,1,"𐳣"],[68772,1,"𐳤"],[68773,1,"𐳥"],[68774,1,"𐳦"],[68775,1,"𐳧"],[68776,1,"𐳨"],[68777,1,"𐳩"],[68778,1,"𐳪"],[68779,1,"𐳫"],[68780,1,"𐳬"],[68781,1,"𐳭"],[68782,1,"𐳮"],[68783,1,"𐳯"],[68784,1,"𐳰"],[68785,1,"𐳱"],[68786,1,"𐳲"],[[68787,68799],3],[[68800,68850],2],[[68851,68857],3],[[68858,68863],2],[[68864,68903],2],[[68904,68911],3],[[68912,68921],2],[[68922,69215],3],[[69216,69246],2],[69247,3],[[69248,69289],2],[69290,3],[[69291,69292],2],[69293,2],[[69294,69295],3],[[69296,69297],2],[[69298,69372],3],[[69373,69375],2],[[69376,69404],2],[[69405,69414],2],[69415,2],[[69416,69423],3],[[69424,69456],2],[[69457,69465],2],[[69466,69487],3],[[69488,69509],2],[[69510,69513],2],[[69514,69551],3],[[69552,69572],2],[[69573,69579],2],[[69580,69599],3],[[69600,69622],2],[[69623,69631],3],[[69632,69702],2],[[69703,69709],2],[[69710,69713],3],[[69714,69733],2],[[69734,69743],2],[[69744,69749],2],[[69750,69758],3],[69759,2],[[69760,69818],2],[[69819,69820],2],[69821,3],[[69822,69825],2],[69826,2],[[69827,69836],3],[69837,3],[[69838,69839],3],[[69840,69864],2],[[69865,69871],3],[[69872,69881],2],[[69882,69887],3],[[69888,69940],2],[69941,3],[[69942,69951],2],[[69952,69955],2],[[69956,69958],2],[69959,2],[[69960,69967],3],[[69968,70003],2],[[70004,70005],2],[70006,2],[[70007,70015],3],[[70016,70084],2],[[70085,70088],2],[[70089,70092],2],[70093,2],[[70094,70095],2],[[70096,70105],2],[70106,2],[70107,2],[70108,2],[[70109,70111],2],[70112,3],[[70113,70132],2],[[70133,70143],3],[[70144,70161],2],[70162,3],[[70163,70199],2],[[70200,70205],2],[70206,2],[[70207,70209],2],[[70210,70271],3],[[70272,70278],2],[70279,3],[70280,2],[70281,3],[[70282,70285],2],[70286,3],[[70287,70301],2],[70302,3],[[70303,70312],2],[70313,2],[[70314,70319],3],[[70320,70378],2],[[70379,70383],3],[[70384,70393],2],[[70394,70399],3],[70400,2],[[70401,70403],2],[70404,3],[[70405,70412],2],[[70413,70414],3],[[70415,70416],2],[[70417,70418],3],[[70419,70440],2],[70441,3],[[70442,70448],2],[70449,3],[[70450,70451],2],[70452,3],[[70453,70457],2],[70458,3],[70459,2],[[70460,70468],2],[[70469,70470],3],[[70471,70472],2],[[70473,70474],3],[[70475,70477],2],[[70478,70479],3],[70480,2],[[70481,70486],3],[70487,2],[[70488,70492],3],[[70493,70499],2],[[70500,70501],3],[[70502,70508],2],[[70509,70511],3],[[70512,70516],2],[[70517,70655],3],[[70656,70730],2],[[70731,70735],2],[[70736,70745],2],[70746,2],[70747,2],[70748,3],[70749,2],[70750,2],[70751,2],[[70752,70753],2],[[70754,70783],3],[[70784,70853],2],[70854,2],[70855,2],[[70856,70863],3],[[70864,70873],2],[[70874,71039],3],[[71040,71093],2],[[71094,71095],3],[[71096,71104],2],[[71105,71113],2],[[71114,71127],2],[[71128,71133],2],[[71134,71167],3],[[71168,71232],2],[[71233,71235],2],[71236,2],[[71237,71247],3],[[71248,71257],2],[[71258,71263],3],[[71264,71276],2],[[71277,71295],3],[[71296,71351],2],[71352,2],[71353,2],[[71354,71359],3],[[71360,71369],2],[[71370,71423],3],[[71424,71449],2],[71450,2],[[71451,71452],3],[[71453,71467],2],[[71468,71471],3],[[71472,71481],2],[[71482,71487],2],[[71488,71494],2],[[71495,71679],3],[[71680,71738],2],[71739,2],[[71740,71839],3],[71840,1,"𑣀"],[71841,1,"𑣁"],[71842,1,"𑣂"],[71843,1,"𑣃"],[71844,1,"𑣄"],[71845,1,"𑣅"],[71846,1,"𑣆"],[71847,1,"𑣇"],[71848,1,"𑣈"],[71849,1,"𑣉"],[71850,1,"𑣊"],[71851,1,"𑣋"],[71852,1,"𑣌"],[71853,1,"𑣍"],[71854,1,"𑣎"],[71855,1,"𑣏"],[71856,1,"𑣐"],[71857,1,"𑣑"],[71858,1,"𑣒"],[71859,1,"𑣓"],[71860,1,"𑣔"],[71861,1,"𑣕"],[71862,1,"𑣖"],[71863,1,"𑣗"],[71864,1,"𑣘"],[71865,1,"𑣙"],[71866,1,"𑣚"],[71867,1,"𑣛"],[71868,1,"𑣜"],[71869,1,"𑣝"],[71870,1,"𑣞"],[71871,1,"𑣟"],[[71872,71913],2],[[71914,71922],2],[[71923,71934],3],[71935,2],[[71936,71942],2],[[71943,71944],3],[71945,2],[[71946,71947],3],[[71948,71955],2],[71956,3],[[71957,71958],2],[71959,3],[[71960,71989],2],[71990,3],[[71991,71992],2],[[71993,71994],3],[[71995,72003],2],[[72004,72006],2],[[72007,72015],3],[[72016,72025],2],[[72026,72095],3],[[72096,72103],2],[[72104,72105],3],[[72106,72151],2],[[72152,72153],3],[[72154,72161],2],[72162,2],[[72163,72164],2],[[72165,72191],3],[[72192,72254],2],[[72255,72262],2],[72263,2],[[72264,72271],3],[[72272,72323],2],[[72324,72325],2],[[72326,72345],2],[[72346,72348],2],[72349,2],[[72350,72354],2],[[72355,72367],3],[[72368,72383],2],[[72384,72440],2],[[72441,72447],3],[[72448,72457],2],[[72458,72703],3],[[72704,72712],2],[72713,3],[[72714,72758],2],[72759,3],[[72760,72768],2],[[72769,72773],2],[[72774,72783],3],[[72784,72793],2],[[72794,72812],2],[[72813,72815],3],[[72816,72817],2],[[72818,72847],2],[[72848,72849],3],[[72850,72871],2],[72872,3],[[72873,72886],2],[[72887,72959],3],[[72960,72966],2],[72967,3],[[72968,72969],2],[72970,3],[[72971,73014],2],[[73015,73017],3],[73018,2],[73019,3],[[73020,73021],2],[73022,3],[[73023,73031],2],[[73032,73039],3],[[73040,73049],2],[[73050,73055],3],[[73056,73061],2],[73062,3],[[73063,73064],2],[73065,3],[[73066,73102],2],[73103,3],[[73104,73105],2],[73106,3],[[73107,73112],2],[[73113,73119],3],[[73120,73129],2],[[73130,73439],3],[[73440,73462],2],[[73463,73464],2],[[73465,73471],3],[[73472,73488],2],[73489,3],[[73490,73530],2],[[73531,73533],3],[[73534,73538],2],[[73539,73551],2],[[73552,73561],2],[[73562,73647],3],[73648,2],[[73649,73663],3],[[73664,73713],2],[[73714,73726],3],[73727,2],[[73728,74606],2],[[74607,74648],2],[74649,2],[[74650,74751],3],[[74752,74850],2],[[74851,74862],2],[74863,3],[[74864,74867],2],[74868,2],[[74869,74879],3],[[74880,75075],2],[[75076,77711],3],[[77712,77808],2],[[77809,77810],2],[[77811,77823],3],[[77824,78894],2],[78895,2],[[78896,78904],3],[[78905,78911],3],[[78912,78933],2],[[78934,82943],3],[[82944,83526],2],[[83527,92159],3],[[92160,92728],2],[[92729,92735],3],[[92736,92766],2],[92767,3],[[92768,92777],2],[[92778,92781],3],[[92782,92783],2],[[92784,92862],2],[92863,3],[[92864,92873],2],[[92874,92879],3],[[92880,92909],2],[[92910,92911],3],[[92912,92916],2],[92917,2],[[92918,92927],3],[[92928,92982],2],[[92983,92991],2],[[92992,92995],2],[[92996,92997],2],[[92998,93007],3],[[93008,93017],2],[93018,3],[[93019,93025],2],[93026,3],[[93027,93047],2],[[93048,93052],3],[[93053,93071],2],[[93072,93759],3],[93760,1,"𖹠"],[93761,1,"𖹡"],[93762,1,"𖹢"],[93763,1,"𖹣"],[93764,1,"𖹤"],[93765,1,"𖹥"],[93766,1,"𖹦"],[93767,1,"𖹧"],[93768,1,"𖹨"],[93769,1,"𖹩"],[93770,1,"𖹪"],[93771,1,"𖹫"],[93772,1,"𖹬"],[93773,1,"𖹭"],[93774,1,"𖹮"],[93775,1,"𖹯"],[93776,1,"𖹰"],[93777,1,"𖹱"],[93778,1,"𖹲"],[93779,1,"𖹳"],[93780,1,"𖹴"],[93781,1,"𖹵"],[93782,1,"𖹶"],[93783,1,"𖹷"],[93784,1,"𖹸"],[93785,1,"𖹹"],[93786,1,"𖹺"],[93787,1,"𖹻"],[93788,1,"𖹼"],[93789,1,"𖹽"],[93790,1,"𖹾"],[93791,1,"𖹿"],[[93792,93823],2],[[93824,93850],2],[[93851,93951],3],[[93952,94020],2],[[94021,94026],2],[[94027,94030],3],[94031,2],[[94032,94078],2],[[94079,94087],2],[[94088,94094],3],[[94095,94111],2],[[94112,94175],3],[94176,2],[94177,2],[94178,2],[94179,2],[94180,2],[[94181,94191],3],[[94192,94193],2],[[94194,94207],3],[[94208,100332],2],[[100333,100337],2],[[100338,100343],2],[[100344,100351],3],[[100352,101106],2],[[101107,101589],2],[[101590,101631],3],[[101632,101640],2],[[101641,110575],3],[[110576,110579],2],[110580,3],[[110581,110587],2],[110588,3],[[110589,110590],2],[110591,3],[[110592,110593],2],[[110594,110878],2],[[110879,110882],2],[[110883,110897],3],[110898,2],[[110899,110927],3],[[110928,110930],2],[[110931,110932],3],[110933,2],[[110934,110947],3],[[110948,110951],2],[[110952,110959],3],[[110960,111355],2],[[111356,113663],3],[[113664,113770],2],[[113771,113775],3],[[113776,113788],2],[[113789,113791],3],[[113792,113800],2],[[113801,113807],3],[[113808,113817],2],[[113818,113819],3],[113820,2],[[113821,113822],2],[113823,2],[[113824,113827],7],[[113828,118527],3],[[118528,118573],2],[[118574,118575],3],[[118576,118598],2],[[118599,118607],3],[[118608,118723],2],[[118724,118783],3],[[118784,119029],2],[[119030,119039],3],[[119040,119078],2],[[119079,119080],3],[119081,2],[[119082,119133],2],[119134,1,"𝅗𝅥"],[119135,1,"𝅘𝅥"],[119136,1,"𝅘𝅥𝅮"],[119137,1,"𝅘𝅥𝅯"],[119138,1,"𝅘𝅥𝅰"],[119139,1,"𝅘𝅥𝅱"],[119140,1,"𝅘𝅥𝅲"],[[119141,119154],2],[[119155,119162],3],[[119163,119226],2],[119227,1,"𝆹𝅥"],[119228,1,"𝆺𝅥"],[119229,1,"𝆹𝅥𝅮"],[119230,1,"𝆺𝅥𝅮"],[119231,1,"𝆹𝅥𝅯"],[119232,1,"𝆺𝅥𝅯"],[[119233,119261],2],[[119262,119272],2],[[119273,119274],2],[[119275,119295],3],[[119296,119365],2],[[119366,119487],3],[[119488,119507],2],[[119508,119519],3],[[119520,119539],2],[[119540,119551],3],[[119552,119638],2],[[119639,119647],3],[[119648,119665],2],[[119666,119672],2],[[119673,119807],3],[119808,1,"a"],[119809,1,"b"],[119810,1,"c"],[119811,1,"d"],[119812,1,"e"],[119813,1,"f"],[119814,1,"g"],[119815,1,"h"],[119816,1,"i"],[119817,1,"j"],[119818,1,"k"],[119819,1,"l"],[119820,1,"m"],[119821,1,"n"],[119822,1,"o"],[119823,1,"p"],[119824,1,"q"],[119825,1,"r"],[119826,1,"s"],[119827,1,"t"],[119828,1,"u"],[119829,1,"v"],[119830,1,"w"],[119831,1,"x"],[119832,1,"y"],[119833,1,"z"],[119834,1,"a"],[119835,1,"b"],[119836,1,"c"],[119837,1,"d"],[119838,1,"e"],[119839,1,"f"],[119840,1,"g"],[119841,1,"h"],[119842,1,"i"],[119843,1,"j"],[119844,1,"k"],[119845,1,"l"],[119846,1,"m"],[119847,1,"n"],[119848,1,"o"],[119849,1,"p"],[119850,1,"q"],[119851,1,"r"],[119852,1,"s"],[119853,1,"t"],[119854,1,"u"],[119855,1,"v"],[119856,1,"w"],[119857,1,"x"],[119858,1,"y"],[119859,1,"z"],[119860,1,"a"],[119861,1,"b"],[119862,1,"c"],[119863,1,"d"],[119864,1,"e"],[119865,1,"f"],[119866,1,"g"],[119867,1,"h"],[119868,1,"i"],[119869,1,"j"],[119870,1,"k"],[119871,1,"l"],[119872,1,"m"],[119873,1,"n"],[119874,1,"o"],[119875,1,"p"],[119876,1,"q"],[119877,1,"r"],[119878,1,"s"],[119879,1,"t"],[119880,1,"u"],[119881,1,"v"],[119882,1,"w"],[119883,1,"x"],[119884,1,"y"],[119885,1,"z"],[119886,1,"a"],[119887,1,"b"],[119888,1,"c"],[119889,1,"d"],[119890,1,"e"],[119891,1,"f"],[119892,1,"g"],[119893,3],[119894,1,"i"],[119895,1,"j"],[119896,1,"k"],[119897,1,"l"],[119898,1,"m"],[119899,1,"n"],[119900,1,"o"],[119901,1,"p"],[119902,1,"q"],[119903,1,"r"],[119904,1,"s"],[119905,1,"t"],[119906,1,"u"],[119907,1,"v"],[119908,1,"w"],[119909,1,"x"],[119910,1,"y"],[119911,1,"z"],[119912,1,"a"],[119913,1,"b"],[119914,1,"c"],[119915,1,"d"],[119916,1,"e"],[119917,1,"f"],[119918,1,"g"],[119919,1,"h"],[119920,1,"i"],[119921,1,"j"],[119922,1,"k"],[119923,1,"l"],[119924,1,"m"],[119925,1,"n"],[119926,1,"o"],[119927,1,"p"],[119928,1,"q"],[119929,1,"r"],[119930,1,"s"],[119931,1,"t"],[119932,1,"u"],[119933,1,"v"],[119934,1,"w"],[119935,1,"x"],[119936,1,"y"],[119937,1,"z"],[119938,1,"a"],[119939,1,"b"],[119940,1,"c"],[119941,1,"d"],[119942,1,"e"],[119943,1,"f"],[119944,1,"g"],[119945,1,"h"],[119946,1,"i"],[119947,1,"j"],[119948,1,"k"],[119949,1,"l"],[119950,1,"m"],[119951,1,"n"],[119952,1,"o"],[119953,1,"p"],[119954,1,"q"],[119955,1,"r"],[119956,1,"s"],[119957,1,"t"],[119958,1,"u"],[119959,1,"v"],[119960,1,"w"],[119961,1,"x"],[119962,1,"y"],[119963,1,"z"],[119964,1,"a"],[119965,3],[119966,1,"c"],[119967,1,"d"],[[119968,119969],3],[119970,1,"g"],[[119971,119972],3],[119973,1,"j"],[119974,1,"k"],[[119975,119976],3],[119977,1,"n"],[119978,1,"o"],[119979,1,"p"],[119980,1,"q"],[119981,3],[119982,1,"s"],[119983,1,"t"],[119984,1,"u"],[119985,1,"v"],[119986,1,"w"],[119987,1,"x"],[119988,1,"y"],[119989,1,"z"],[119990,1,"a"],[119991,1,"b"],[119992,1,"c"],[119993,1,"d"],[119994,3],[119995,1,"f"],[119996,3],[119997,1,"h"],[119998,1,"i"],[119999,1,"j"],[120000,1,"k"],[120001,1,"l"],[120002,1,"m"],[120003,1,"n"],[120004,3],[120005,1,"p"],[120006,1,"q"],[120007,1,"r"],[120008,1,"s"],[120009,1,"t"],[120010,1,"u"],[120011,1,"v"],[120012,1,"w"],[120013,1,"x"],[120014,1,"y"],[120015,1,"z"],[120016,1,"a"],[120017,1,"b"],[120018,1,"c"],[120019,1,"d"],[120020,1,"e"],[120021,1,"f"],[120022,1,"g"],[120023,1,"h"],[120024,1,"i"],[120025,1,"j"],[120026,1,"k"],[120027,1,"l"],[120028,1,"m"],[120029,1,"n"],[120030,1,"o"],[120031,1,"p"],[120032,1,"q"],[120033,1,"r"],[120034,1,"s"],[120035,1,"t"],[120036,1,"u"],[120037,1,"v"],[120038,1,"w"],[120039,1,"x"],[120040,1,"y"],[120041,1,"z"],[120042,1,"a"],[120043,1,"b"],[120044,1,"c"],[120045,1,"d"],[120046,1,"e"],[120047,1,"f"],[120048,1,"g"],[120049,1,"h"],[120050,1,"i"],[120051,1,"j"],[120052,1,"k"],[120053,1,"l"],[120054,1,"m"],[120055,1,"n"],[120056,1,"o"],[120057,1,"p"],[120058,1,"q"],[120059,1,"r"],[120060,1,"s"],[120061,1,"t"],[120062,1,"u"],[120063,1,"v"],[120064,1,"w"],[120065,1,"x"],[120066,1,"y"],[120067,1,"z"],[120068,1,"a"],[120069,1,"b"],[120070,3],[120071,1,"d"],[120072,1,"e"],[120073,1,"f"],[120074,1,"g"],[[120075,120076],3],[120077,1,"j"],[120078,1,"k"],[120079,1,"l"],[120080,1,"m"],[120081,1,"n"],[120082,1,"o"],[120083,1,"p"],[120084,1,"q"],[120085,3],[120086,1,"s"],[120087,1,"t"],[120088,1,"u"],[120089,1,"v"],[120090,1,"w"],[120091,1,"x"],[120092,1,"y"],[120093,3],[120094,1,"a"],[120095,1,"b"],[120096,1,"c"],[120097,1,"d"],[120098,1,"e"],[120099,1,"f"],[120100,1,"g"],[120101,1,"h"],[120102,1,"i"],[120103,1,"j"],[120104,1,"k"],[120105,1,"l"],[120106,1,"m"],[120107,1,"n"],[120108,1,"o"],[120109,1,"p"],[120110,1,"q"],[120111,1,"r"],[120112,1,"s"],[120113,1,"t"],[120114,1,"u"],[120115,1,"v"],[120116,1,"w"],[120117,1,"x"],[120118,1,"y"],[120119,1,"z"],[120120,1,"a"],[120121,1,"b"],[120122,3],[120123,1,"d"],[120124,1,"e"],[120125,1,"f"],[120126,1,"g"],[120127,3],[120128,1,"i"],[120129,1,"j"],[120130,1,"k"],[120131,1,"l"],[120132,1,"m"],[120133,3],[120134,1,"o"],[[120135,120137],3],[120138,1,"s"],[120139,1,"t"],[120140,1,"u"],[120141,1,"v"],[120142,1,"w"],[120143,1,"x"],[120144,1,"y"],[120145,3],[120146,1,"a"],[120147,1,"b"],[120148,1,"c"],[120149,1,"d"],[120150,1,"e"],[120151,1,"f"],[120152,1,"g"],[120153,1,"h"],[120154,1,"i"],[120155,1,"j"],[120156,1,"k"],[120157,1,"l"],[120158,1,"m"],[120159,1,"n"],[120160,1,"o"],[120161,1,"p"],[120162,1,"q"],[120163,1,"r"],[120164,1,"s"],[120165,1,"t"],[120166,1,"u"],[120167,1,"v"],[120168,1,"w"],[120169,1,"x"],[120170,1,"y"],[120171,1,"z"],[120172,1,"a"],[120173,1,"b"],[120174,1,"c"],[120175,1,"d"],[120176,1,"e"],[120177,1,"f"],[120178,1,"g"],[120179,1,"h"],[120180,1,"i"],[120181,1,"j"],[120182,1,"k"],[120183,1,"l"],[120184,1,"m"],[120185,1,"n"],[120186,1,"o"],[120187,1,"p"],[120188,1,"q"],[120189,1,"r"],[120190,1,"s"],[120191,1,"t"],[120192,1,"u"],[120193,1,"v"],[120194,1,"w"],[120195,1,"x"],[120196,1,"y"],[120197,1,"z"],[120198,1,"a"],[120199,1,"b"],[120200,1,"c"],[120201,1,"d"],[120202,1,"e"],[120203,1,"f"],[120204,1,"g"],[120205,1,"h"],[120206,1,"i"],[120207,1,"j"],[120208,1,"k"],[120209,1,"l"],[120210,1,"m"],[120211,1,"n"],[120212,1,"o"],[120213,1,"p"],[120214,1,"q"],[120215,1,"r"],[120216,1,"s"],[120217,1,"t"],[120218,1,"u"],[120219,1,"v"],[120220,1,"w"],[120221,1,"x"],[120222,1,"y"],[120223,1,"z"],[120224,1,"a"],[120225,1,"b"],[120226,1,"c"],[120227,1,"d"],[120228,1,"e"],[120229,1,"f"],[120230,1,"g"],[120231,1,"h"],[120232,1,"i"],[120233,1,"j"],[120234,1,"k"],[120235,1,"l"],[120236,1,"m"],[120237,1,"n"],[120238,1,"o"],[120239,1,"p"],[120240,1,"q"],[120241,1,"r"],[120242,1,"s"],[120243,1,"t"],[120244,1,"u"],[120245,1,"v"],[120246,1,"w"],[120247,1,"x"],[120248,1,"y"],[120249,1,"z"],[120250,1,"a"],[120251,1,"b"],[120252,1,"c"],[120253,1,"d"],[120254,1,"e"],[120255,1,"f"],[120256,1,"g"],[120257,1,"h"],[120258,1,"i"],[120259,1,"j"],[120260,1,"k"],[120261,1,"l"],[120262,1,"m"],[120263,1,"n"],[120264,1,"o"],[120265,1,"p"],[120266,1,"q"],[120267,1,"r"],[120268,1,"s"],[120269,1,"t"],[120270,1,"u"],[120271,1,"v"],[120272,1,"w"],[120273,1,"x"],[120274,1,"y"],[120275,1,"z"],[120276,1,"a"],[120277,1,"b"],[120278,1,"c"],[120279,1,"d"],[120280,1,"e"],[120281,1,"f"],[120282,1,"g"],[120283,1,"h"],[120284,1,"i"],[120285,1,"j"],[120286,1,"k"],[120287,1,"l"],[120288,1,"m"],[120289,1,"n"],[120290,1,"o"],[120291,1,"p"],[120292,1,"q"],[120293,1,"r"],[120294,1,"s"],[120295,1,"t"],[120296,1,"u"],[120297,1,"v"],[120298,1,"w"],[120299,1,"x"],[120300,1,"y"],[120301,1,"z"],[120302,1,"a"],[120303,1,"b"],[120304,1,"c"],[120305,1,"d"],[120306,1,"e"],[120307,1,"f"],[120308,1,"g"],[120309,1,"h"],[120310,1,"i"],[120311,1,"j"],[120312,1,"k"],[120313,1,"l"],[120314,1,"m"],[120315,1,"n"],[120316,1,"o"],[120317,1,"p"],[120318,1,"q"],[120319,1,"r"],[120320,1,"s"],[120321,1,"t"],[120322,1,"u"],[120323,1,"v"],[120324,1,"w"],[120325,1,"x"],[120326,1,"y"],[120327,1,"z"],[120328,1,"a"],[120329,1,"b"],[120330,1,"c"],[120331,1,"d"],[120332,1,"e"],[120333,1,"f"],[120334,1,"g"],[120335,1,"h"],[120336,1,"i"],[120337,1,"j"],[120338,1,"k"],[120339,1,"l"],[120340,1,"m"],[120341,1,"n"],[120342,1,"o"],[120343,1,"p"],[120344,1,"q"],[120345,1,"r"],[120346,1,"s"],[120347,1,"t"],[120348,1,"u"],[120349,1,"v"],[120350,1,"w"],[120351,1,"x"],[120352,1,"y"],[120353,1,"z"],[120354,1,"a"],[120355,1,"b"],[120356,1,"c"],[120357,1,"d"],[120358,1,"e"],[120359,1,"f"],[120360,1,"g"],[120361,1,"h"],[120362,1,"i"],[120363,1,"j"],[120364,1,"k"],[120365,1,"l"],[120366,1,"m"],[120367,1,"n"],[120368,1,"o"],[120369,1,"p"],[120370,1,"q"],[120371,1,"r"],[120372,1,"s"],[120373,1,"t"],[120374,1,"u"],[120375,1,"v"],[120376,1,"w"],[120377,1,"x"],[120378,1,"y"],[120379,1,"z"],[120380,1,"a"],[120381,1,"b"],[120382,1,"c"],[120383,1,"d"],[120384,1,"e"],[120385,1,"f"],[120386,1,"g"],[120387,1,"h"],[120388,1,"i"],[120389,1,"j"],[120390,1,"k"],[120391,1,"l"],[120392,1,"m"],[120393,1,"n"],[120394,1,"o"],[120395,1,"p"],[120396,1,"q"],[120397,1,"r"],[120398,1,"s"],[120399,1,"t"],[120400,1,"u"],[120401,1,"v"],[120402,1,"w"],[120403,1,"x"],[120404,1,"y"],[120405,1,"z"],[120406,1,"a"],[120407,1,"b"],[120408,1,"c"],[120409,1,"d"],[120410,1,"e"],[120411,1,"f"],[120412,1,"g"],[120413,1,"h"],[120414,1,"i"],[120415,1,"j"],[120416,1,"k"],[120417,1,"l"],[120418,1,"m"],[120419,1,"n"],[120420,1,"o"],[120421,1,"p"],[120422,1,"q"],[120423,1,"r"],[120424,1,"s"],[120425,1,"t"],[120426,1,"u"],[120427,1,"v"],[120428,1,"w"],[120429,1,"x"],[120430,1,"y"],[120431,1,"z"],[120432,1,"a"],[120433,1,"b"],[120434,1,"c"],[120435,1,"d"],[120436,1,"e"],[120437,1,"f"],[120438,1,"g"],[120439,1,"h"],[120440,1,"i"],[120441,1,"j"],[120442,1,"k"],[120443,1,"l"],[120444,1,"m"],[120445,1,"n"],[120446,1,"o"],[120447,1,"p"],[120448,1,"q"],[120449,1,"r"],[120450,1,"s"],[120451,1,"t"],[120452,1,"u"],[120453,1,"v"],[120454,1,"w"],[120455,1,"x"],[120456,1,"y"],[120457,1,"z"],[120458,1,"a"],[120459,1,"b"],[120460,1,"c"],[120461,1,"d"],[120462,1,"e"],[120463,1,"f"],[120464,1,"g"],[120465,1,"h"],[120466,1,"i"],[120467,1,"j"],[120468,1,"k"],[120469,1,"l"],[120470,1,"m"],[120471,1,"n"],[120472,1,"o"],[120473,1,"p"],[120474,1,"q"],[120475,1,"r"],[120476,1,"s"],[120477,1,"t"],[120478,1,"u"],[120479,1,"v"],[120480,1,"w"],[120481,1,"x"],[120482,1,"y"],[120483,1,"z"],[120484,1,"ı"],[120485,1,"ȷ"],[[120486,120487],3],[120488,1,"α"],[120489,1,"β"],[120490,1,"γ"],[120491,1,"δ"],[120492,1,"ε"],[120493,1,"ζ"],[120494,1,"η"],[120495,1,"θ"],[120496,1,"ι"],[120497,1,"κ"],[120498,1,"λ"],[120499,1,"μ"],[120500,1,"ν"],[120501,1,"ξ"],[120502,1,"ο"],[120503,1,"π"],[120504,1,"ρ"],[120505,1,"θ"],[120506,1,"σ"],[120507,1,"τ"],[120508,1,"υ"],[120509,1,"φ"],[120510,1,"χ"],[120511,1,"ψ"],[120512,1,"ω"],[120513,1,"∇"],[120514,1,"α"],[120515,1,"β"],[120516,1,"γ"],[120517,1,"δ"],[120518,1,"ε"],[120519,1,"ζ"],[120520,1,"η"],[120521,1,"θ"],[120522,1,"ι"],[120523,1,"κ"],[120524,1,"λ"],[120525,1,"μ"],[120526,1,"ν"],[120527,1,"ξ"],[120528,1,"ο"],[120529,1,"π"],[120530,1,"ρ"],[[120531,120532],1,"σ"],[120533,1,"τ"],[120534,1,"υ"],[120535,1,"φ"],[120536,1,"χ"],[120537,1,"ψ"],[120538,1,"ω"],[120539,1,"∂"],[120540,1,"ε"],[120541,1,"θ"],[120542,1,"κ"],[120543,1,"φ"],[120544,1,"ρ"],[120545,1,"π"],[120546,1,"α"],[120547,1,"β"],[120548,1,"γ"],[120549,1,"δ"],[120550,1,"ε"],[120551,1,"ζ"],[120552,1,"η"],[120553,1,"θ"],[120554,1,"ι"],[120555,1,"κ"],[120556,1,"λ"],[120557,1,"μ"],[120558,1,"ν"],[120559,1,"ξ"],[120560,1,"ο"],[120561,1,"π"],[120562,1,"ρ"],[120563,1,"θ"],[120564,1,"σ"],[120565,1,"τ"],[120566,1,"υ"],[120567,1,"φ"],[120568,1,"χ"],[120569,1,"ψ"],[120570,1,"ω"],[120571,1,"∇"],[120572,1,"α"],[120573,1,"β"],[120574,1,"γ"],[120575,1,"δ"],[120576,1,"ε"],[120577,1,"ζ"],[120578,1,"η"],[120579,1,"θ"],[120580,1,"ι"],[120581,1,"κ"],[120582,1,"λ"],[120583,1,"μ"],[120584,1,"ν"],[120585,1,"ξ"],[120586,1,"ο"],[120587,1,"π"],[120588,1,"ρ"],[[120589,120590],1,"σ"],[120591,1,"τ"],[120592,1,"υ"],[120593,1,"φ"],[120594,1,"χ"],[120595,1,"ψ"],[120596,1,"ω"],[120597,1,"∂"],[120598,1,"ε"],[120599,1,"θ"],[120600,1,"κ"],[120601,1,"φ"],[120602,1,"ρ"],[120603,1,"π"],[120604,1,"α"],[120605,1,"β"],[120606,1,"γ"],[120607,1,"δ"],[120608,1,"ε"],[120609,1,"ζ"],[120610,1,"η"],[120611,1,"θ"],[120612,1,"ι"],[120613,1,"κ"],[120614,1,"λ"],[120615,1,"μ"],[120616,1,"ν"],[120617,1,"ξ"],[120618,1,"ο"],[120619,1,"π"],[120620,1,"ρ"],[120621,1,"θ"],[120622,1,"σ"],[120623,1,"τ"],[120624,1,"υ"],[120625,1,"φ"],[120626,1,"χ"],[120627,1,"ψ"],[120628,1,"ω"],[120629,1,"∇"],[120630,1,"α"],[120631,1,"β"],[120632,1,"γ"],[120633,1,"δ"],[120634,1,"ε"],[120635,1,"ζ"],[120636,1,"η"],[120637,1,"θ"],[120638,1,"ι"],[120639,1,"κ"],[120640,1,"λ"],[120641,1,"μ"],[120642,1,"ν"],[120643,1,"ξ"],[120644,1,"ο"],[120645,1,"π"],[120646,1,"ρ"],[[120647,120648],1,"σ"],[120649,1,"τ"],[120650,1,"υ"],[120651,1,"φ"],[120652,1,"χ"],[120653,1,"ψ"],[120654,1,"ω"],[120655,1,"∂"],[120656,1,"ε"],[120657,1,"θ"],[120658,1,"κ"],[120659,1,"φ"],[120660,1,"ρ"],[120661,1,"π"],[120662,1,"α"],[120663,1,"β"],[120664,1,"γ"],[120665,1,"δ"],[120666,1,"ε"],[120667,1,"ζ"],[120668,1,"η"],[120669,1,"θ"],[120670,1,"ι"],[120671,1,"κ"],[120672,1,"λ"],[120673,1,"μ"],[120674,1,"ν"],[120675,1,"ξ"],[120676,1,"ο"],[120677,1,"π"],[120678,1,"ρ"],[120679,1,"θ"],[120680,1,"σ"],[120681,1,"τ"],[120682,1,"υ"],[120683,1,"φ"],[120684,1,"χ"],[120685,1,"ψ"],[120686,1,"ω"],[120687,1,"∇"],[120688,1,"α"],[120689,1,"β"],[120690,1,"γ"],[120691,1,"δ"],[120692,1,"ε"],[120693,1,"ζ"],[120694,1,"η"],[120695,1,"θ"],[120696,1,"ι"],[120697,1,"κ"],[120698,1,"λ"],[120699,1,"μ"],[120700,1,"ν"],[120701,1,"ξ"],[120702,1,"ο"],[120703,1,"π"],[120704,1,"ρ"],[[120705,120706],1,"σ"],[120707,1,"τ"],[120708,1,"υ"],[120709,1,"φ"],[120710,1,"χ"],[120711,1,"ψ"],[120712,1,"ω"],[120713,1,"∂"],[120714,1,"ε"],[120715,1,"θ"],[120716,1,"κ"],[120717,1,"φ"],[120718,1,"ρ"],[120719,1,"π"],[120720,1,"α"],[120721,1,"β"],[120722,1,"γ"],[120723,1,"δ"],[120724,1,"ε"],[120725,1,"ζ"],[120726,1,"η"],[120727,1,"θ"],[120728,1,"ι"],[120729,1,"κ"],[120730,1,"λ"],[120731,1,"μ"],[120732,1,"ν"],[120733,1,"ξ"],[120734,1,"ο"],[120735,1,"π"],[120736,1,"ρ"],[120737,1,"θ"],[120738,1,"σ"],[120739,1,"τ"],[120740,1,"υ"],[120741,1,"φ"],[120742,1,"χ"],[120743,1,"ψ"],[120744,1,"ω"],[120745,1,"∇"],[120746,1,"α"],[120747,1,"β"],[120748,1,"γ"],[120749,1,"δ"],[120750,1,"ε"],[120751,1,"ζ"],[120752,1,"η"],[120753,1,"θ"],[120754,1,"ι"],[120755,1,"κ"],[120756,1,"λ"],[120757,1,"μ"],[120758,1,"ν"],[120759,1,"ξ"],[120760,1,"ο"],[120761,1,"π"],[120762,1,"ρ"],[[120763,120764],1,"σ"],[120765,1,"τ"],[120766,1,"υ"],[120767,1,"φ"],[120768,1,"χ"],[120769,1,"ψ"],[120770,1,"ω"],[120771,1,"∂"],[120772,1,"ε"],[120773,1,"θ"],[120774,1,"κ"],[120775,1,"φ"],[120776,1,"ρ"],[120777,1,"π"],[[120778,120779],1,"ϝ"],[[120780,120781],3],[120782,1,"0"],[120783,1,"1"],[120784,1,"2"],[120785,1,"3"],[120786,1,"4"],[120787,1,"5"],[120788,1,"6"],[120789,1,"7"],[120790,1,"8"],[120791,1,"9"],[120792,1,"0"],[120793,1,"1"],[120794,1,"2"],[120795,1,"3"],[120796,1,"4"],[120797,1,"5"],[120798,1,"6"],[120799,1,"7"],[120800,1,"8"],[120801,1,"9"],[120802,1,"0"],[120803,1,"1"],[120804,1,"2"],[120805,1,"3"],[120806,1,"4"],[120807,1,"5"],[120808,1,"6"],[120809,1,"7"],[120810,1,"8"],[120811,1,"9"],[120812,1,"0"],[120813,1,"1"],[120814,1,"2"],[120815,1,"3"],[120816,1,"4"],[120817,1,"5"],[120818,1,"6"],[120819,1,"7"],[120820,1,"8"],[120821,1,"9"],[120822,1,"0"],[120823,1,"1"],[120824,1,"2"],[120825,1,"3"],[120826,1,"4"],[120827,1,"5"],[120828,1,"6"],[120829,1,"7"],[120830,1,"8"],[120831,1,"9"],[[120832,121343],2],[[121344,121398],2],[[121399,121402],2],[[121403,121452],2],[[121453,121460],2],[121461,2],[[121462,121475],2],[121476,2],[[121477,121483],2],[[121484,121498],3],[[121499,121503],2],[121504,3],[[121505,121519],2],[[121520,122623],3],[[122624,122654],2],[[122655,122660],3],[[122661,122666],2],[[122667,122879],3],[[122880,122886],2],[122887,3],[[122888,122904],2],[[122905,122906],3],[[122907,122913],2],[122914,3],[[122915,122916],2],[122917,3],[[122918,122922],2],[[122923,122927],3],[122928,1,"а"],[122929,1,"б"],[122930,1,"в"],[122931,1,"г"],[122932,1,"д"],[122933,1,"е"],[122934,1,"ж"],[122935,1,"з"],[122936,1,"и"],[122937,1,"к"],[122938,1,"л"],[122939,1,"м"],[122940,1,"о"],[122941,1,"п"],[122942,1,"р"],[122943,1,"с"],[122944,1,"т"],[122945,1,"у"],[122946,1,"ф"],[122947,1,"х"],[122948,1,"ц"],[122949,1,"ч"],[122950,1,"ш"],[122951,1,"ы"],[122952,1,"э"],[122953,1,"ю"],[122954,1,"ꚉ"],[122955,1,"ә"],[122956,1,"і"],[122957,1,"ј"],[122958,1,"ө"],[122959,1,"ү"],[122960,1,"ӏ"],[122961,1,"а"],[122962,1,"б"],[122963,1,"в"],[122964,1,"г"],[122965,1,"д"],[122966,1,"е"],[122967,1,"ж"],[122968,1,"з"],[122969,1,"и"],[122970,1,"к"],[122971,1,"л"],[122972,1,"о"],[122973,1,"п"],[122974,1,"с"],[122975,1,"у"],[122976,1,"ф"],[122977,1,"х"],[122978,1,"ц"],[122979,1,"ч"],[122980,1,"ш"],[122981,1,"ъ"],[122982,1,"ы"],[122983,1,"ґ"],[122984,1,"і"],[122985,1,"ѕ"],[122986,1,"џ"],[122987,1,"ҫ"],[122988,1,"ꙑ"],[122989,1,"ұ"],[[122990,123022],3],[123023,2],[[123024,123135],3],[[123136,123180],2],[[123181,123183],3],[[123184,123197],2],[[123198,123199],3],[[123200,123209],2],[[123210,123213],3],[123214,2],[123215,2],[[123216,123535],3],[[123536,123566],2],[[123567,123583],3],[[123584,123641],2],[[123642,123646],3],[123647,2],[[123648,124111],3],[[124112,124153],2],[[124154,124895],3],[[124896,124902],2],[124903,3],[[124904,124907],2],[124908,3],[[124909,124910],2],[124911,3],[[124912,124926],2],[124927,3],[[124928,125124],2],[[125125,125126],3],[[125127,125135],2],[[125136,125142],2],[[125143,125183],3],[125184,1,"𞤢"],[125185,1,"𞤣"],[125186,1,"𞤤"],[125187,1,"𞤥"],[125188,1,"𞤦"],[125189,1,"𞤧"],[125190,1,"𞤨"],[125191,1,"𞤩"],[125192,1,"𞤪"],[125193,1,"𞤫"],[125194,1,"𞤬"],[125195,1,"𞤭"],[125196,1,"𞤮"],[125197,1,"𞤯"],[125198,1,"𞤰"],[125199,1,"𞤱"],[125200,1,"𞤲"],[125201,1,"𞤳"],[125202,1,"𞤴"],[125203,1,"𞤵"],[125204,1,"𞤶"],[125205,1,"𞤷"],[125206,1,"𞤸"],[125207,1,"𞤹"],[125208,1,"𞤺"],[125209,1,"𞤻"],[125210,1,"𞤼"],[125211,1,"𞤽"],[125212,1,"𞤾"],[125213,1,"𞤿"],[125214,1,"𞥀"],[125215,1,"𞥁"],[125216,1,"𞥂"],[125217,1,"𞥃"],[[125218,125258],2],[125259,2],[[125260,125263],3],[[125264,125273],2],[[125274,125277],3],[[125278,125279],2],[[125280,126064],3],[[126065,126132],2],[[126133,126208],3],[[126209,126269],2],[[126270,126463],3],[126464,1,"ا"],[126465,1,"ب"],[126466,1,"ج"],[126467,1,"د"],[126468,3],[126469,1,"و"],[126470,1,"ز"],[126471,1,"ح"],[126472,1,"ط"],[126473,1,"ي"],[126474,1,"ك"],[126475,1,"ل"],[126476,1,"م"],[126477,1,"ن"],[126478,1,"س"],[126479,1,"ع"],[126480,1,"ف"],[126481,1,"ص"],[126482,1,"ق"],[126483,1,"ر"],[126484,1,"ش"],[126485,1,"ت"],[126486,1,"ث"],[126487,1,"خ"],[126488,1,"ذ"],[126489,1,"ض"],[126490,1,"ظ"],[126491,1,"غ"],[126492,1,"ٮ"],[126493,1,"ں"],[126494,1,"ڡ"],[126495,1,"ٯ"],[126496,3],[126497,1,"ب"],[126498,1,"ج"],[126499,3],[126500,1,"ه"],[[126501,126502],3],[126503,1,"ح"],[126504,3],[126505,1,"ي"],[126506,1,"ك"],[126507,1,"ل"],[126508,1,"م"],[126509,1,"ن"],[126510,1,"س"],[126511,1,"ع"],[126512,1,"ف"],[126513,1,"ص"],[126514,1,"ق"],[126515,3],[126516,1,"ش"],[126517,1,"ت"],[126518,1,"ث"],[126519,1,"خ"],[126520,3],[126521,1,"ض"],[126522,3],[126523,1,"غ"],[[126524,126529],3],[126530,1,"ج"],[[126531,126534],3],[126535,1,"ح"],[126536,3],[126537,1,"ي"],[126538,3],[126539,1,"ل"],[126540,3],[126541,1,"ن"],[126542,1,"س"],[126543,1,"ع"],[126544,3],[126545,1,"ص"],[126546,1,"ق"],[126547,3],[126548,1,"ش"],[[126549,126550],3],[126551,1,"خ"],[126552,3],[126553,1,"ض"],[126554,3],[126555,1,"غ"],[126556,3],[126557,1,"ں"],[126558,3],[126559,1,"ٯ"],[126560,3],[126561,1,"ب"],[126562,1,"ج"],[126563,3],[126564,1,"ه"],[[126565,126566],3],[126567,1,"ح"],[126568,1,"ط"],[126569,1,"ي"],[126570,1,"ك"],[126571,3],[126572,1,"م"],[126573,1,"ن"],[126574,1,"س"],[126575,1,"ع"],[126576,1,"ف"],[126577,1,"ص"],[126578,1,"ق"],[126579,3],[126580,1,"ش"],[126581,1,"ت"],[126582,1,"ث"],[126583,1,"خ"],[126584,3],[126585,1,"ض"],[126586,1,"ظ"],[126587,1,"غ"],[126588,1,"ٮ"],[126589,3],[126590,1,"ڡ"],[126591,3],[126592,1,"ا"],[126593,1,"ب"],[126594,1,"ج"],[126595,1,"د"],[126596,1,"ه"],[126597,1,"و"],[126598,1,"ز"],[126599,1,"ح"],[126600,1,"ط"],[126601,1,"ي"],[126602,3],[126603,1,"ل"],[126604,1,"م"],[126605,1,"ن"],[126606,1,"س"],[126607,1,"ع"],[126608,1,"ف"],[126609,1,"ص"],[126610,1,"ق"],[126611,1,"ر"],[126612,1,"ش"],[126613,1,"ت"],[126614,1,"ث"],[126615,1,"خ"],[126616,1,"ذ"],[126617,1,"ض"],[126618,1,"ظ"],[126619,1,"غ"],[[126620,126624],3],[126625,1,"ب"],[126626,1,"ج"],[126627,1,"د"],[126628,3],[126629,1,"و"],[126630,1,"ز"],[126631,1,"ح"],[126632,1,"ط"],[126633,1,"ي"],[126634,3],[126635,1,"ل"],[126636,1,"م"],[126637,1,"ن"],[126638,1,"س"],[126639,1,"ع"],[126640,1,"ف"],[126641,1,"ص"],[126642,1,"ق"],[126643,1,"ر"],[126644,1,"ش"],[126645,1,"ت"],[126646,1,"ث"],[126647,1,"خ"],[126648,1,"ذ"],[126649,1,"ض"],[126650,1,"ظ"],[126651,1,"غ"],[[126652,126703],3],[[126704,126705],2],[[126706,126975],3],[[126976,127019],2],[[127020,127023],3],[[127024,127123],2],[[127124,127135],3],[[127136,127150],2],[[127151,127152],3],[[127153,127166],2],[127167,2],[127168,3],[[127169,127183],2],[127184,3],[[127185,127199],2],[[127200,127221],2],[[127222,127231],3],[127232,3],[127233,5,"0,"],[127234,5,"1,"],[127235,5,"2,"],[127236,5,"3,"],[127237,5,"4,"],[127238,5,"5,"],[127239,5,"6,"],[127240,5,"7,"],[127241,5,"8,"],[127242,5,"9,"],[[127243,127244],2],[[127245,127247],2],[127248,5,"(a)"],[127249,5,"(b)"],[127250,5,"(c)"],[127251,5,"(d)"],[127252,5,"(e)"],[127253,5,"(f)"],[127254,5,"(g)"],[127255,5,"(h)"],[127256,5,"(i)"],[127257,5,"(j)"],[127258,5,"(k)"],[127259,5,"(l)"],[127260,5,"(m)"],[127261,5,"(n)"],[127262,5,"(o)"],[127263,5,"(p)"],[127264,5,"(q)"],[127265,5,"(r)"],[127266,5,"(s)"],[127267,5,"(t)"],[127268,5,"(u)"],[127269,5,"(v)"],[127270,5,"(w)"],[127271,5,"(x)"],[127272,5,"(y)"],[127273,5,"(z)"],[127274,1,"〔s〕"],[127275,1,"c"],[127276,1,"r"],[127277,1,"cd"],[127278,1,"wz"],[127279,2],[127280,1,"a"],[127281,1,"b"],[127282,1,"c"],[127283,1,"d"],[127284,1,"e"],[127285,1,"f"],[127286,1,"g"],[127287,1,"h"],[127288,1,"i"],[127289,1,"j"],[127290,1,"k"],[127291,1,"l"],[127292,1,"m"],[127293,1,"n"],[127294,1,"o"],[127295,1,"p"],[127296,1,"q"],[127297,1,"r"],[127298,1,"s"],[127299,1,"t"],[127300,1,"u"],[127301,1,"v"],[127302,1,"w"],[127303,1,"x"],[127304,1,"y"],[127305,1,"z"],[127306,1,"hv"],[127307,1,"mv"],[127308,1,"sd"],[127309,1,"ss"],[127310,1,"ppv"],[127311,1,"wc"],[[127312,127318],2],[127319,2],[[127320,127326],2],[127327,2],[[127328,127337],2],[127338,1,"mc"],[127339,1,"md"],[127340,1,"mr"],[[127341,127343],2],[[127344,127352],2],[127353,2],[127354,2],[[127355,127356],2],[[127357,127358],2],[127359,2],[[127360,127369],2],[[127370,127373],2],[[127374,127375],2],[127376,1,"dj"],[[127377,127386],2],[[127387,127404],2],[127405,2],[[127406,127461],3],[[127462,127487],2],[127488,1,"ほか"],[127489,1,"ココ"],[127490,1,"サ"],[[127491,127503],3],[127504,1,"手"],[127505,1,"字"],[127506,1,"双"],[127507,1,"デ"],[127508,1,"二"],[127509,1,"多"],[127510,1,"解"],[127511,1,"天"],[127512,1,"交"],[127513,1,"映"],[127514,1,"無"],[127515,1,"料"],[127516,1,"前"],[127517,1,"後"],[127518,1,"再"],[127519,1,"新"],[127520,1,"初"],[127521,1,"終"],[127522,1,"生"],[127523,1,"販"],[127524,1,"声"],[127525,1,"吹"],[127526,1,"演"],[127527,1,"投"],[127528,1,"捕"],[127529,1,"一"],[127530,1,"三"],[127531,1,"遊"],[127532,1,"左"],[127533,1,"中"],[127534,1,"右"],[127535,1,"指"],[127536,1,"走"],[127537,1,"打"],[127538,1,"禁"],[127539,1,"空"],[127540,1,"合"],[127541,1,"満"],[127542,1,"有"],[127543,1,"月"],[127544,1,"申"],[127545,1,"割"],[127546,1,"営"],[127547,1,"配"],[[127548,127551],3],[127552,1,"〔本〕"],[127553,1,"〔三〕"],[127554,1,"〔二〕"],[127555,1,"〔安〕"],[127556,1,"〔点〕"],[127557,1,"〔打〕"],[127558,1,"〔盗〕"],[127559,1,"〔勝〕"],[127560,1,"〔敗〕"],[[127561,127567],3],[127568,1,"得"],[127569,1,"可"],[[127570,127583],3],[[127584,127589],2],[[127590,127743],3],[[127744,127776],2],[[127777,127788],2],[[127789,127791],2],[[127792,127797],2],[127798,2],[[127799,127868],2],[127869,2],[[127870,127871],2],[[127872,127891],2],[[127892,127903],2],[[127904,127940],2],[127941,2],[[127942,127946],2],[[127947,127950],2],[[127951,127955],2],[[127956,127967],2],[[127968,127984],2],[[127985,127991],2],[[127992,127999],2],[[128000,128062],2],[128063,2],[128064,2],[128065,2],[[128066,128247],2],[128248,2],[[128249,128252],2],[[128253,128254],2],[128255,2],[[128256,128317],2],[[128318,128319],2],[[128320,128323],2],[[128324,128330],2],[[128331,128335],2],[[128336,128359],2],[[128360,128377],2],[128378,2],[[128379,128419],2],[128420,2],[[128421,128506],2],[[128507,128511],2],[128512,2],[[128513,128528],2],[128529,2],[[128530,128532],2],[128533,2],[128534,2],[128535,2],[128536,2],[128537,2],[128538,2],[128539,2],[[128540,128542],2],[128543,2],[[128544,128549],2],[[128550,128551],2],[[128552,128555],2],[128556,2],[128557,2],[[128558,128559],2],[[128560,128563],2],[128564,2],[[128565,128576],2],[[128577,128578],2],[[128579,128580],2],[[128581,128591],2],[[128592,128639],2],[[128640,128709],2],[[128710,128719],2],[128720,2],[[128721,128722],2],[[128723,128724],2],[128725,2],[[128726,128727],2],[[128728,128731],3],[128732,2],[[128733,128735],2],[[128736,128748],2],[[128749,128751],3],[[128752,128755],2],[[128756,128758],2],[[128759,128760],2],[128761,2],[128762,2],[[128763,128764],2],[[128765,128767],3],[[128768,128883],2],[[128884,128886],2],[[128887,128890],3],[[128891,128895],2],[[128896,128980],2],[[128981,128984],2],[128985,2],[[128986,128991],3],[[128992,129003],2],[[129004,129007],3],[129008,2],[[129009,129023],3],[[129024,129035],2],[[129036,129039],3],[[129040,129095],2],[[129096,129103],3],[[129104,129113],2],[[129114,129119],3],[[129120,129159],2],[[129160,129167],3],[[129168,129197],2],[[129198,129199],3],[[129200,129201],2],[[129202,129279],3],[[129280,129291],2],[129292,2],[[129293,129295],2],[[129296,129304],2],[[129305,129310],2],[129311,2],[[129312,129319],2],[[129320,129327],2],[129328,2],[[129329,129330],2],[[129331,129342],2],[129343,2],[[129344,129355],2],[129356,2],[[129357,129359],2],[[129360,129374],2],[[129375,129387],2],[[129388,129392],2],[129393,2],[129394,2],[[129395,129398],2],[[129399,129400],2],[129401,2],[129402,2],[129403,2],[[129404,129407],2],[[129408,129412],2],[[129413,129425],2],[[129426,129431],2],[[129432,129442],2],[[129443,129444],2],[[129445,129450],2],[[129451,129453],2],[[129454,129455],2],[[129456,129465],2],[[129466,129471],2],[129472,2],[[129473,129474],2],[[129475,129482],2],[129483,2],[129484,2],[[129485,129487],2],[[129488,129510],2],[[129511,129535],2],[[129536,129619],2],[[129620,129631],3],[[129632,129645],2],[[129646,129647],3],[[129648,129651],2],[129652,2],[[129653,129655],2],[[129656,129658],2],[[129659,129660],2],[[129661,129663],3],[[129664,129666],2],[[129667,129670],2],[[129671,129672],2],[[129673,129679],3],[[129680,129685],2],[[129686,129704],2],[[129705,129708],2],[[129709,129711],2],[[129712,129718],2],[[129719,129722],2],[[129723,129725],2],[129726,3],[129727,2],[[129728,129730],2],[[129731,129733],2],[[129734,129741],3],[[129742,129743],2],[[129744,129750],2],[[129751,129753],2],[[129754,129755],2],[[129756,129759],3],[[129760,129767],2],[129768,2],[[129769,129775],3],[[129776,129782],2],[[129783,129784],2],[[129785,129791],3],[[129792,129938],2],[129939,3],[[129940,129994],2],[[129995,130031],3],[130032,1,"0"],[130033,1,"1"],[130034,1,"2"],[130035,1,"3"],[130036,1,"4"],[130037,1,"5"],[130038,1,"6"],[130039,1,"7"],[130040,1,"8"],[130041,1,"9"],[[130042,131069],3],[[131070,131071],3],[[131072,173782],2],[[173783,173789],2],[[173790,173791],2],[[173792,173823],3],[[173824,177972],2],[[177973,177976],2],[177977,2],[[177978,177983],3],[[177984,178205],2],[[178206,178207],3],[[178208,183969],2],[[183970,183983],3],[[183984,191456],2],[[191457,191471],3],[[191472,192093],2],[[192094,194559],3],[194560,1,"丽"],[194561,1,"丸"],[194562,1,"乁"],[194563,1,"𠄢"],[194564,1,"你"],[194565,1,"侮"],[194566,1,"侻"],[194567,1,"倂"],[194568,1,"偺"],[194569,1,"備"],[194570,1,"僧"],[194571,1,"像"],[194572,1,"㒞"],[194573,1,"𠘺"],[194574,1,"免"],[194575,1,"兔"],[194576,1,"兤"],[194577,1,"具"],[194578,1,"𠔜"],[194579,1,"㒹"],[194580,1,"內"],[194581,1,"再"],[194582,1,"𠕋"],[194583,1,"冗"],[194584,1,"冤"],[194585,1,"仌"],[194586,1,"冬"],[194587,1,"况"],[194588,1,"𩇟"],[194589,1,"凵"],[194590,1,"刃"],[194591,1,"㓟"],[194592,1,"刻"],[194593,1,"剆"],[194594,1,"割"],[194595,1,"剷"],[194596,1,"㔕"],[194597,1,"勇"],[194598,1,"勉"],[194599,1,"勤"],[194600,1,"勺"],[194601,1,"包"],[194602,1,"匆"],[194603,1,"北"],[194604,1,"卉"],[194605,1,"卑"],[194606,1,"博"],[194607,1,"即"],[194608,1,"卽"],[[194609,194611],1,"卿"],[194612,1,"𠨬"],[194613,1,"灰"],[194614,1,"及"],[194615,1,"叟"],[194616,1,"𠭣"],[194617,1,"叫"],[194618,1,"叱"],[194619,1,"吆"],[194620,1,"咞"],[194621,1,"吸"],[194622,1,"呈"],[194623,1,"周"],[194624,1,"咢"],[194625,1,"哶"],[194626,1,"唐"],[194627,1,"啓"],[194628,1,"啣"],[[194629,194630],1,"善"],[194631,1,"喙"],[194632,1,"喫"],[194633,1,"喳"],[194634,1,"嗂"],[194635,1,"圖"],[194636,1,"嘆"],[194637,1,"圗"],[194638,1,"噑"],[194639,1,"噴"],[194640,1,"切"],[194641,1,"壮"],[194642,1,"城"],[194643,1,"埴"],[194644,1,"堍"],[194645,1,"型"],[194646,1,"堲"],[194647,1,"報"],[194648,1,"墬"],[194649,1,"𡓤"],[194650,1,"売"],[194651,1,"壷"],[194652,1,"夆"],[194653,1,"多"],[194654,1,"夢"],[194655,1,"奢"],[194656,1,"𡚨"],[194657,1,"𡛪"],[194658,1,"姬"],[194659,1,"娛"],[194660,1,"娧"],[194661,1,"姘"],[194662,1,"婦"],[194663,1,"㛮"],[194664,3],[194665,1,"嬈"],[[194666,194667],1,"嬾"],[194668,1,"𡧈"],[194669,1,"寃"],[194670,1,"寘"],[194671,1,"寧"],[194672,1,"寳"],[194673,1,"𡬘"],[194674,1,"寿"],[194675,1,"将"],[194676,3],[194677,1,"尢"],[194678,1,"㞁"],[194679,1,"屠"],[194680,1,"屮"],[194681,1,"峀"],[194682,1,"岍"],[194683,1,"𡷤"],[194684,1,"嵃"],[194685,1,"𡷦"],[194686,1,"嵮"],[194687,1,"嵫"],[194688,1,"嵼"],[194689,1,"巡"],[194690,1,"巢"],[194691,1,"㠯"],[194692,1,"巽"],[194693,1,"帨"],[194694,1,"帽"],[194695,1,"幩"],[194696,1,"㡢"],[194697,1,"𢆃"],[194698,1,"㡼"],[194699,1,"庰"],[194700,1,"庳"],[194701,1,"庶"],[194702,1,"廊"],[194703,1,"𪎒"],[194704,1,"廾"],[[194705,194706],1,"𢌱"],[194707,1,"舁"],[[194708,194709],1,"弢"],[194710,1,"㣇"],[194711,1,"𣊸"],[194712,1,"𦇚"],[194713,1,"形"],[194714,1,"彫"],[194715,1,"㣣"],[194716,1,"徚"],[194717,1,"忍"],[194718,1,"志"],[194719,1,"忹"],[194720,1,"悁"],[194721,1,"㤺"],[194722,1,"㤜"],[194723,1,"悔"],[194724,1,"𢛔"],[194725,1,"惇"],[194726,1,"慈"],[194727,1,"慌"],[194728,1,"慎"],[194729,1,"慌"],[194730,1,"慺"],[194731,1,"憎"],[194732,1,"憲"],[194733,1,"憤"],[194734,1,"憯"],[194735,1,"懞"],[194736,1,"懲"],[194737,1,"懶"],[194738,1,"成"],[194739,1,"戛"],[194740,1,"扝"],[194741,1,"抱"],[194742,1,"拔"],[194743,1,"捐"],[194744,1,"𢬌"],[194745,1,"挽"],[194746,1,"拼"],[194747,1,"捨"],[194748,1,"掃"],[194749,1,"揤"],[194750,1,"𢯱"],[194751,1,"搢"],[194752,1,"揅"],[194753,1,"掩"],[194754,1,"㨮"],[194755,1,"摩"],[194756,1,"摾"],[194757,1,"撝"],[194758,1,"摷"],[194759,1,"㩬"],[194760,1,"敏"],[194761,1,"敬"],[194762,1,"𣀊"],[194763,1,"旣"],[194764,1,"書"],[194765,1,"晉"],[194766,1,"㬙"],[194767,1,"暑"],[194768,1,"㬈"],[194769,1,"㫤"],[194770,1,"冒"],[194771,1,"冕"],[194772,1,"最"],[194773,1,"暜"],[194774,1,"肭"],[194775,1,"䏙"],[194776,1,"朗"],[194777,1,"望"],[194778,1,"朡"],[194779,1,"杞"],[194780,1,"杓"],[194781,1,"𣏃"],[194782,1,"㭉"],[194783,1,"柺"],[194784,1,"枅"],[194785,1,"桒"],[194786,1,"梅"],[194787,1,"𣑭"],[194788,1,"梎"],[194789,1,"栟"],[194790,1,"椔"],[194791,1,"㮝"],[194792,1,"楂"],[194793,1,"榣"],[194794,1,"槪"],[194795,1,"檨"],[194796,1,"𣚣"],[194797,1,"櫛"],[194798,1,"㰘"],[194799,1,"次"],[194800,1,"𣢧"],[194801,1,"歔"],[194802,1,"㱎"],[194803,1,"歲"],[194804,1,"殟"],[194805,1,"殺"],[194806,1,"殻"],[194807,1,"𣪍"],[194808,1,"𡴋"],[194809,1,"𣫺"],[194810,1,"汎"],[194811,1,"𣲼"],[194812,1,"沿"],[194813,1,"泍"],[194814,1,"汧"],[194815,1,"洖"],[194816,1,"派"],[194817,1,"海"],[194818,1,"流"],[194819,1,"浩"],[194820,1,"浸"],[194821,1,"涅"],[194822,1,"𣴞"],[194823,1,"洴"],[194824,1,"港"],[194825,1,"湮"],[194826,1,"㴳"],[194827,1,"滋"],[194828,1,"滇"],[194829,1,"𣻑"],[194830,1,"淹"],[194831,1,"潮"],[194832,1,"𣽞"],[194833,1,"𣾎"],[194834,1,"濆"],[194835,1,"瀹"],[194836,1,"瀞"],[194837,1,"瀛"],[194838,1,"㶖"],[194839,1,"灊"],[194840,1,"災"],[194841,1,"灷"],[194842,1,"炭"],[194843,1,"𠔥"],[194844,1,"煅"],[194845,1,"𤉣"],[194846,1,"熜"],[194847,3],[194848,1,"爨"],[194849,1,"爵"],[194850,1,"牐"],[194851,1,"𤘈"],[194852,1,"犀"],[194853,1,"犕"],[194854,1,"𤜵"],[194855,1,"𤠔"],[194856,1,"獺"],[194857,1,"王"],[194858,1,"㺬"],[194859,1,"玥"],[[194860,194861],1,"㺸"],[194862,1,"瑇"],[194863,1,"瑜"],[194864,1,"瑱"],[194865,1,"璅"],[194866,1,"瓊"],[194867,1,"㼛"],[194868,1,"甤"],[194869,1,"𤰶"],[194870,1,"甾"],[194871,1,"𤲒"],[194872,1,"異"],[194873,1,"𢆟"],[194874,1,"瘐"],[194875,1,"𤾡"],[194876,1,"𤾸"],[194877,1,"𥁄"],[194878,1,"㿼"],[194879,1,"䀈"],[194880,1,"直"],[194881,1,"𥃳"],[194882,1,"𥃲"],[194883,1,"𥄙"],[194884,1,"𥄳"],[194885,1,"眞"],[[194886,194887],1,"真"],[194888,1,"睊"],[194889,1,"䀹"],[194890,1,"瞋"],[194891,1,"䁆"],[194892,1,"䂖"],[194893,1,"𥐝"],[194894,1,"硎"],[194895,1,"碌"],[194896,1,"磌"],[194897,1,"䃣"],[194898,1,"𥘦"],[194899,1,"祖"],[194900,1,"𥚚"],[194901,1,"𥛅"],[194902,1,"福"],[194903,1,"秫"],[194904,1,"䄯"],[194905,1,"穀"],[194906,1,"穊"],[194907,1,"穏"],[194908,1,"𥥼"],[[194909,194910],1,"𥪧"],[194911,3],[194912,1,"䈂"],[194913,1,"𥮫"],[194914,1,"篆"],[194915,1,"築"],[194916,1,"䈧"],[194917,1,"𥲀"],[194918,1,"糒"],[194919,1,"䊠"],[194920,1,"糨"],[194921,1,"糣"],[194922,1,"紀"],[194923,1,"𥾆"],[194924,1,"絣"],[194925,1,"䌁"],[194926,1,"緇"],[194927,1,"縂"],[194928,1,"繅"],[194929,1,"䌴"],[194930,1,"𦈨"],[194931,1,"𦉇"],[194932,1,"䍙"],[194933,1,"𦋙"],[194934,1,"罺"],[194935,1,"𦌾"],[194936,1,"羕"],[194937,1,"翺"],[194938,1,"者"],[194939,1,"𦓚"],[194940,1,"𦔣"],[194941,1,"聠"],[194942,1,"𦖨"],[194943,1,"聰"],[194944,1,"𣍟"],[194945,1,"䏕"],[194946,1,"育"],[194947,1,"脃"],[194948,1,"䐋"],[194949,1,"脾"],[194950,1,"媵"],[194951,1,"𦞧"],[194952,1,"𦞵"],[194953,1,"𣎓"],[194954,1,"𣎜"],[194955,1,"舁"],[194956,1,"舄"],[194957,1,"辞"],[194958,1,"䑫"],[194959,1,"芑"],[194960,1,"芋"],[194961,1,"芝"],[194962,1,"劳"],[194963,1,"花"],[194964,1,"芳"],[194965,1,"芽"],[194966,1,"苦"],[194967,1,"𦬼"],[194968,1,"若"],[194969,1,"茝"],[194970,1,"荣"],[194971,1,"莭"],[194972,1,"茣"],[194973,1,"莽"],[194974,1,"菧"],[194975,1,"著"],[194976,1,"荓"],[194977,1,"菊"],[194978,1,"菌"],[194979,1,"菜"],[194980,1,"𦰶"],[194981,1,"𦵫"],[194982,1,"𦳕"],[194983,1,"䔫"],[194984,1,"蓱"],[194985,1,"蓳"],[194986,1,"蔖"],[194987,1,"𧏊"],[194988,1,"蕤"],[194989,1,"𦼬"],[194990,1,"䕝"],[194991,1,"䕡"],[194992,1,"𦾱"],[194993,1,"𧃒"],[194994,1,"䕫"],[194995,1,"虐"],[194996,1,"虜"],[194997,1,"虧"],[194998,1,"虩"],[194999,1,"蚩"],[195000,1,"蚈"],[195001,1,"蜎"],[195002,1,"蛢"],[195003,1,"蝹"],[195004,1,"蜨"],[195005,1,"蝫"],[195006,1,"螆"],[195007,3],[195008,1,"蟡"],[195009,1,"蠁"],[195010,1,"䗹"],[195011,1,"衠"],[195012,1,"衣"],[195013,1,"𧙧"],[195014,1,"裗"],[195015,1,"裞"],[195016,1,"䘵"],[195017,1,"裺"],[195018,1,"㒻"],[195019,1,"𧢮"],[195020,1,"𧥦"],[195021,1,"䚾"],[195022,1,"䛇"],[195023,1,"誠"],[195024,1,"諭"],[195025,1,"變"],[195026,1,"豕"],[195027,1,"𧲨"],[195028,1,"貫"],[195029,1,"賁"],[195030,1,"贛"],[195031,1,"起"],[195032,1,"𧼯"],[195033,1,"𠠄"],[195034,1,"跋"],[195035,1,"趼"],[195036,1,"跰"],[195037,1,"𠣞"],[195038,1,"軔"],[195039,1,"輸"],[195040,1,"𨗒"],[195041,1,"𨗭"],[195042,1,"邔"],[195043,1,"郱"],[195044,1,"鄑"],[195045,1,"𨜮"],[195046,1,"鄛"],[195047,1,"鈸"],[195048,1,"鋗"],[195049,1,"鋘"],[195050,1,"鉼"],[195051,1,"鏹"],[195052,1,"鐕"],[195053,1,"𨯺"],[195054,1,"開"],[195055,1,"䦕"],[195056,1,"閷"],[195057,1,"𨵷"],[195058,1,"䧦"],[195059,1,"雃"],[195060,1,"嶲"],[195061,1,"霣"],[195062,1,"𩅅"],[195063,1,"𩈚"],[195064,1,"䩮"],[195065,1,"䩶"],[195066,1,"韠"],[195067,1,"𩐊"],[195068,1,"䪲"],[195069,1,"𩒖"],[[195070,195071],1,"頋"],[195072,1,"頩"],[195073,1,"𩖶"],[195074,1,"飢"],[195075,1,"䬳"],[195076,1,"餩"],[195077,1,"馧"],[195078,1,"駂"],[195079,1,"駾"],[195080,1,"䯎"],[195081,1,"𩬰"],[195082,1,"鬒"],[195083,1,"鱀"],[195084,1,"鳽"],[195085,1,"䳎"],[195086,1,"䳭"],[195087,1,"鵧"],[195088,1,"𪃎"],[195089,1,"䳸"],[195090,1,"𪄅"],[195091,1,"𪈎"],[195092,1,"𪊑"],[195093,1,"麻"],[195094,1,"䵖"],[195095,1,"黹"],[195096,1,"黾"],[195097,1,"鼅"],[195098,1,"鼏"],[195099,1,"鼖"],[195100,1,"鼻"],[195101,1,"𪘀"],[[195102,196605],3],[[196606,196607],3],[[196608,201546],2],[[201547,201551],3],[[201552,205743],2],[[205744,262141],3],[[262142,262143],3],[[262144,327677],3],[[327678,327679],3],[[327680,393213],3],[[393214,393215],3],[[393216,458749],3],[[458750,458751],3],[[458752,524285],3],[[524286,524287],3],[[524288,589821],3],[[589822,589823],3],[[589824,655357],3],[[655358,655359],3],[[655360,720893],3],[[720894,720895],3],[[720896,786429],3],[[786430,786431],3],[[786432,851965],3],[[851966,851967],3],[[851968,917501],3],[[917502,917503],3],[917504,3],[917505,3],[[917506,917535],3],[[917536,917631],3],[[917632,917759],3],[[917760,917999],7],[[918000,983037],3],[[983038,983039],3],[[983040,1048573],3],[[1048574,1048575],3],[[1048576,1114109],3],[[1114110,1114111],3]]
},{}],53:[function(require,module,exports){
"use strict";

const combiningMarks = /[\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u0898-\u089F\u08CA-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B55-\u0B57\u0B62\u0B63\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0C00-\u0C04\u0C3C\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0CF3\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D81-\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECE\u0F18\u0F19\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F\u109A-\u109D\u135D-\u135F\u1712-\u1715\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u180B-\u180D\u180F\u1885\u1886\u18A9\u1920-\u192B\u1930-\u193B\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F\u1AB0-\u1ACE\u1B00-\u1B04\u1B34-\u1B44\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BE6-\u1BF3\u1C24-\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA82C\uA880\uA881\uA8B4-\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9E5\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F\u{101FD}\u{102E0}\u{10376}-\u{1037A}\u{10A01}-\u{10A03}\u{10A05}\u{10A06}\u{10A0C}-\u{10A0F}\u{10A38}-\u{10A3A}\u{10A3F}\u{10AE5}\u{10AE6}\u{10D24}-\u{10D27}\u{10EAB}\u{10EAC}\u{10EFD}-\u{10EFF}\u{10F46}-\u{10F50}\u{10F82}-\u{10F85}\u{11000}-\u{11002}\u{11038}-\u{11046}\u{11070}\u{11073}\u{11074}\u{1107F}-\u{11082}\u{110B0}-\u{110BA}\u{110C2}\u{11100}-\u{11102}\u{11127}-\u{11134}\u{11145}\u{11146}\u{11173}\u{11180}-\u{11182}\u{111B3}-\u{111C0}\u{111C9}-\u{111CC}\u{111CE}\u{111CF}\u{1122C}-\u{11237}\u{1123E}\u{11241}\u{112DF}-\u{112EA}\u{11300}-\u{11303}\u{1133B}\u{1133C}\u{1133E}-\u{11344}\u{11347}\u{11348}\u{1134B}-\u{1134D}\u{11357}\u{11362}\u{11363}\u{11366}-\u{1136C}\u{11370}-\u{11374}\u{11435}-\u{11446}\u{1145E}\u{114B0}-\u{114C3}\u{115AF}-\u{115B5}\u{115B8}-\u{115C0}\u{115DC}\u{115DD}\u{11630}-\u{11640}\u{116AB}-\u{116B7}\u{1171D}-\u{1172B}\u{1182C}-\u{1183A}\u{11930}-\u{11935}\u{11937}\u{11938}\u{1193B}-\u{1193E}\u{11940}\u{11942}\u{11943}\u{119D1}-\u{119D7}\u{119DA}-\u{119E0}\u{119E4}\u{11A01}-\u{11A0A}\u{11A33}-\u{11A39}\u{11A3B}-\u{11A3E}\u{11A47}\u{11A51}-\u{11A5B}\u{11A8A}-\u{11A99}\u{11C2F}-\u{11C36}\u{11C38}-\u{11C3F}\u{11C92}-\u{11CA7}\u{11CA9}-\u{11CB6}\u{11D31}-\u{11D36}\u{11D3A}\u{11D3C}\u{11D3D}\u{11D3F}-\u{11D45}\u{11D47}\u{11D8A}-\u{11D8E}\u{11D90}\u{11D91}\u{11D93}-\u{11D97}\u{11EF3}-\u{11EF6}\u{11F00}\u{11F01}\u{11F03}\u{11F34}-\u{11F3A}\u{11F3E}-\u{11F42}\u{13440}\u{13447}-\u{13455}\u{16AF0}-\u{16AF4}\u{16B30}-\u{16B36}\u{16F4F}\u{16F51}-\u{16F87}\u{16F8F}-\u{16F92}\u{16FE4}\u{16FF0}\u{16FF1}\u{1BC9D}\u{1BC9E}\u{1CF00}-\u{1CF2D}\u{1CF30}-\u{1CF46}\u{1D165}-\u{1D169}\u{1D16D}-\u{1D172}\u{1D17B}-\u{1D182}\u{1D185}-\u{1D18B}\u{1D1AA}-\u{1D1AD}\u{1D242}-\u{1D244}\u{1DA00}-\u{1DA36}\u{1DA3B}-\u{1DA6C}\u{1DA75}\u{1DA84}\u{1DA9B}-\u{1DA9F}\u{1DAA1}-\u{1DAAF}\u{1E000}-\u{1E006}\u{1E008}-\u{1E018}\u{1E01B}-\u{1E021}\u{1E023}\u{1E024}\u{1E026}-\u{1E02A}\u{1E08F}\u{1E130}-\u{1E136}\u{1E2AE}\u{1E2EC}-\u{1E2EF}\u{1E4EC}-\u{1E4EF}\u{1E8D0}-\u{1E8D6}\u{1E944}-\u{1E94A}\u{E0100}-\u{E01EF}]/u;
const combiningClassVirama = /[\u094D\u09CD\u0A4D\u0ACD\u0B4D\u0BCD\u0C4D\u0CCD\u0D3B\u0D3C\u0D4D\u0DCA\u0E3A\u0EBA\u0F84\u1039\u103A\u1714\u1715\u1734\u17D2\u1A60\u1B44\u1BAA\u1BAB\u1BF2\u1BF3\u2D7F\uA806\uA82C\uA8C4\uA953\uA9C0\uAAF6\uABED\u{10A3F}\u{11046}\u{11070}\u{1107F}\u{110B9}\u{11133}\u{11134}\u{111C0}\u{11235}\u{112EA}\u{1134D}\u{11442}\u{114C2}\u{115BF}\u{1163F}\u{116B6}\u{1172B}\u{11839}\u{1193D}\u{1193E}\u{119E0}\u{11A34}\u{11A47}\u{11A99}\u{11C3F}\u{11D44}\u{11D45}\u{11D97}\u{11F41}\u{11F42}]/u;
const validZWNJ = /[\u0620\u0626\u0628\u062A-\u062E\u0633-\u063F\u0641-\u0647\u0649\u064A\u066E\u066F\u0678-\u0687\u069A-\u06BF\u06C1\u06C2\u06CC\u06CE\u06D0\u06D1\u06FA-\u06FC\u06FF\u0712-\u0714\u071A-\u071D\u071F-\u0727\u0729\u072B\u072D\u072E\u074E-\u0758\u075C-\u076A\u076D-\u0770\u0772\u0775-\u0777\u077A-\u077F\u07CA-\u07EA\u0841-\u0845\u0848\u084A-\u0853\u0855\u0860\u0862-\u0865\u0868\u0886\u0889-\u088D\u08A0-\u08A9\u08AF\u08B0\u08B3-\u08B8\u08BA-\u08C8\u1807\u1820-\u1878\u1887-\u18A8\u18AA\uA840-\uA872\u{10AC0}-\u{10AC4}\u{10ACD}\u{10AD3}-\u{10ADC}\u{10ADE}-\u{10AE0}\u{10AEB}-\u{10AEE}\u{10B80}\u{10B82}\u{10B86}-\u{10B88}\u{10B8A}\u{10B8B}\u{10B8D}\u{10B90}\u{10BAD}\u{10BAE}\u{10D00}-\u{10D21}\u{10D23}\u{10F30}-\u{10F32}\u{10F34}-\u{10F44}\u{10F51}-\u{10F53}\u{10F70}-\u{10F73}\u{10F76}-\u{10F81}\u{10FB0}\u{10FB2}\u{10FB3}\u{10FB8}\u{10FBB}\u{10FBC}\u{10FBE}\u{10FBF}\u{10FC1}\u{10FC4}\u{10FCA}\u{10FCB}\u{1E900}-\u{1E943}][\xAD\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u061C\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u070F\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u0898-\u089F\u08CA-\u08E1\u08E3-\u0902\u093A\u093C\u0941-\u0948\u094D\u0951-\u0957\u0962\u0963\u0981\u09BC\u09C1-\u09C4\u09CD\u09E2\u09E3\u09FE\u0A01\u0A02\u0A3C\u0A41\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81\u0A82\u0ABC\u0AC1-\u0AC5\u0AC7\u0AC8\u0ACD\u0AE2\u0AE3\u0AFA-\u0AFF\u0B01\u0B3C\u0B3F\u0B41-\u0B44\u0B4D\u0B55\u0B56\u0B62\u0B63\u0B82\u0BC0\u0BCD\u0C00\u0C04\u0C3C\u0C3E-\u0C40\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81\u0CBC\u0CBF\u0CC6\u0CCC\u0CCD\u0CE2\u0CE3\u0D00\u0D01\u0D3B\u0D3C\u0D41-\u0D44\u0D4D\u0D62\u0D63\u0D81\u0DCA\u0DD2-\u0DD4\u0DD6\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECE\u0F18\u0F19\u0F35\u0F37\u0F39\u0F71-\u0F7E\u0F80-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102D-\u1030\u1032-\u1037\u1039\u103A\u103D\u103E\u1058\u1059\u105E-\u1060\u1071-\u1074\u1082\u1085\u1086\u108D\u109D\u135D-\u135F\u1712-\u1714\u1732\u1733\u1752\u1753\u1772\u1773\u17B4\u17B5\u17B7-\u17BD\u17C6\u17C9-\u17D3\u17DD\u180B-\u180D\u180F\u1885\u1886\u18A9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193B\u1A17\u1A18\u1A1B\u1A56\u1A58-\u1A5E\u1A60\u1A62\u1A65-\u1A6C\u1A73-\u1A7C\u1A7F\u1AB0-\u1ACE\u1B00-\u1B03\u1B34\u1B36-\u1B3A\u1B3C\u1B42\u1B6B-\u1B73\u1B80\u1B81\u1BA2-\u1BA5\u1BA8\u1BA9\u1BAB-\u1BAD\u1BE6\u1BE8\u1BE9\u1BED\u1BEF-\u1BF1\u1C2C-\u1C33\u1C36\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE0\u1CE2-\u1CE8\u1CED\u1CF4\u1CF8\u1CF9\u1DC0-\u1DFF\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u206A-\u206F\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302D\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA825\uA826\uA82C\uA8C4\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA951\uA980-\uA982\uA9B3\uA9B6-\uA9B9\uA9BC\uA9BD\uA9E5\uAA29-\uAA2E\uAA31\uAA32\uAA35\uAA36\uAA43\uAA4C\uAA7C\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEC\uAAED\uAAF6\uABE5\uABE8\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F\uFEFF\uFFF9-\uFFFB\u{101FD}\u{102E0}\u{10376}-\u{1037A}\u{10A01}-\u{10A03}\u{10A05}\u{10A06}\u{10A0C}-\u{10A0F}\u{10A38}-\u{10A3A}\u{10A3F}\u{10AE5}\u{10AE6}\u{10D24}-\u{10D27}\u{10EAB}\u{10EAC}\u{10EFD}-\u{10EFF}\u{10F46}-\u{10F50}\u{10F82}-\u{10F85}\u{11001}\u{11038}-\u{11046}\u{11070}\u{11073}\u{11074}\u{1107F}-\u{11081}\u{110B3}-\u{110B6}\u{110B9}\u{110BA}\u{110C2}\u{11100}-\u{11102}\u{11127}-\u{1112B}\u{1112D}-\u{11134}\u{11173}\u{11180}\u{11181}\u{111B6}-\u{111BE}\u{111C9}-\u{111CC}\u{111CF}\u{1122F}-\u{11231}\u{11234}\u{11236}\u{11237}\u{1123E}\u{11241}\u{112DF}\u{112E3}-\u{112EA}\u{11300}\u{11301}\u{1133B}\u{1133C}\u{11340}\u{11366}-\u{1136C}\u{11370}-\u{11374}\u{11438}-\u{1143F}\u{11442}-\u{11444}\u{11446}\u{1145E}\u{114B3}-\u{114B8}\u{114BA}\u{114BF}\u{114C0}\u{114C2}\u{114C3}\u{115B2}-\u{115B5}\u{115BC}\u{115BD}\u{115BF}\u{115C0}\u{115DC}\u{115DD}\u{11633}-\u{1163A}\u{1163D}\u{1163F}\u{11640}\u{116AB}\u{116AD}\u{116B0}-\u{116B5}\u{116B7}\u{1171D}-\u{1171F}\u{11722}-\u{11725}\u{11727}-\u{1172B}\u{1182F}-\u{11837}\u{11839}\u{1183A}\u{1193B}\u{1193C}\u{1193E}\u{11943}\u{119D4}-\u{119D7}\u{119DA}\u{119DB}\u{119E0}\u{11A01}-\u{11A0A}\u{11A33}-\u{11A38}\u{11A3B}-\u{11A3E}\u{11A47}\u{11A51}-\u{11A56}\u{11A59}-\u{11A5B}\u{11A8A}-\u{11A96}\u{11A98}\u{11A99}\u{11C30}-\u{11C36}\u{11C38}-\u{11C3D}\u{11C3F}\u{11C92}-\u{11CA7}\u{11CAA}-\u{11CB0}\u{11CB2}\u{11CB3}\u{11CB5}\u{11CB6}\u{11D31}-\u{11D36}\u{11D3A}\u{11D3C}\u{11D3D}\u{11D3F}-\u{11D45}\u{11D47}\u{11D90}\u{11D91}\u{11D95}\u{11D97}\u{11EF3}\u{11EF4}\u{11F00}\u{11F01}\u{11F36}-\u{11F3A}\u{11F40}\u{11F42}\u{13430}-\u{13440}\u{13447}-\u{13455}\u{16AF0}-\u{16AF4}\u{16B30}-\u{16B36}\u{16F4F}\u{16F8F}-\u{16F92}\u{16FE4}\u{1BC9D}\u{1BC9E}\u{1BCA0}-\u{1BCA3}\u{1CF00}-\u{1CF2D}\u{1CF30}-\u{1CF46}\u{1D167}-\u{1D169}\u{1D173}-\u{1D182}\u{1D185}-\u{1D18B}\u{1D1AA}-\u{1D1AD}\u{1D242}-\u{1D244}\u{1DA00}-\u{1DA36}\u{1DA3B}-\u{1DA6C}\u{1DA75}\u{1DA84}\u{1DA9B}-\u{1DA9F}\u{1DAA1}-\u{1DAAF}\u{1E000}-\u{1E006}\u{1E008}-\u{1E018}\u{1E01B}-\u{1E021}\u{1E023}\u{1E024}\u{1E026}-\u{1E02A}\u{1E08F}\u{1E130}-\u{1E136}\u{1E2AE}\u{1E2EC}-\u{1E2EF}\u{1E4EC}-\u{1E4EF}\u{1E8D0}-\u{1E8D6}\u{1E944}-\u{1E94B}\u{E0001}\u{E0020}-\u{E007F}\u{E0100}-\u{E01EF}]*\u200C[\xAD\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u061C\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u070F\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u0898-\u089F\u08CA-\u08E1\u08E3-\u0902\u093A\u093C\u0941-\u0948\u094D\u0951-\u0957\u0962\u0963\u0981\u09BC\u09C1-\u09C4\u09CD\u09E2\u09E3\u09FE\u0A01\u0A02\u0A3C\u0A41\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81\u0A82\u0ABC\u0AC1-\u0AC5\u0AC7\u0AC8\u0ACD\u0AE2\u0AE3\u0AFA-\u0AFF\u0B01\u0B3C\u0B3F\u0B41-\u0B44\u0B4D\u0B55\u0B56\u0B62\u0B63\u0B82\u0BC0\u0BCD\u0C00\u0C04\u0C3C\u0C3E-\u0C40\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81\u0CBC\u0CBF\u0CC6\u0CCC\u0CCD\u0CE2\u0CE3\u0D00\u0D01\u0D3B\u0D3C\u0D41-\u0D44\u0D4D\u0D62\u0D63\u0D81\u0DCA\u0DD2-\u0DD4\u0DD6\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECE\u0F18\u0F19\u0F35\u0F37\u0F39\u0F71-\u0F7E\u0F80-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102D-\u1030\u1032-\u1037\u1039\u103A\u103D\u103E\u1058\u1059\u105E-\u1060\u1071-\u1074\u1082\u1085\u1086\u108D\u109D\u135D-\u135F\u1712-\u1714\u1732\u1733\u1752\u1753\u1772\u1773\u17B4\u17B5\u17B7-\u17BD\u17C6\u17C9-\u17D3\u17DD\u180B-\u180D\u180F\u1885\u1886\u18A9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193B\u1A17\u1A18\u1A1B\u1A56\u1A58-\u1A5E\u1A60\u1A62\u1A65-\u1A6C\u1A73-\u1A7C\u1A7F\u1AB0-\u1ACE\u1B00-\u1B03\u1B34\u1B36-\u1B3A\u1B3C\u1B42\u1B6B-\u1B73\u1B80\u1B81\u1BA2-\u1BA5\u1BA8\u1BA9\u1BAB-\u1BAD\u1BE6\u1BE8\u1BE9\u1BED\u1BEF-\u1BF1\u1C2C-\u1C33\u1C36\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE0\u1CE2-\u1CE8\u1CED\u1CF4\u1CF8\u1CF9\u1DC0-\u1DFF\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u206A-\u206F\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302D\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA825\uA826\uA82C\uA8C4\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA951\uA980-\uA982\uA9B3\uA9B6-\uA9B9\uA9BC\uA9BD\uA9E5\uAA29-\uAA2E\uAA31\uAA32\uAA35\uAA36\uAA43\uAA4C\uAA7C\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEC\uAAED\uAAF6\uABE5\uABE8\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F\uFEFF\uFFF9-\uFFFB\u{101FD}\u{102E0}\u{10376}-\u{1037A}\u{10A01}-\u{10A03}\u{10A05}\u{10A06}\u{10A0C}-\u{10A0F}\u{10A38}-\u{10A3A}\u{10A3F}\u{10AE5}\u{10AE6}\u{10D24}-\u{10D27}\u{10EAB}\u{10EAC}\u{10EFD}-\u{10EFF}\u{10F46}-\u{10F50}\u{10F82}-\u{10F85}\u{11001}\u{11038}-\u{11046}\u{11070}\u{11073}\u{11074}\u{1107F}-\u{11081}\u{110B3}-\u{110B6}\u{110B9}\u{110BA}\u{110C2}\u{11100}-\u{11102}\u{11127}-\u{1112B}\u{1112D}-\u{11134}\u{11173}\u{11180}\u{11181}\u{111B6}-\u{111BE}\u{111C9}-\u{111CC}\u{111CF}\u{1122F}-\u{11231}\u{11234}\u{11236}\u{11237}\u{1123E}\u{11241}\u{112DF}\u{112E3}-\u{112EA}\u{11300}\u{11301}\u{1133B}\u{1133C}\u{11340}\u{11366}-\u{1136C}\u{11370}-\u{11374}\u{11438}-\u{1143F}\u{11442}-\u{11444}\u{11446}\u{1145E}\u{114B3}-\u{114B8}\u{114BA}\u{114BF}\u{114C0}\u{114C2}\u{114C3}\u{115B2}-\u{115B5}\u{115BC}\u{115BD}\u{115BF}\u{115C0}\u{115DC}\u{115DD}\u{11633}-\u{1163A}\u{1163D}\u{1163F}\u{11640}\u{116AB}\u{116AD}\u{116B0}-\u{116B5}\u{116B7}\u{1171D}-\u{1171F}\u{11722}-\u{11725}\u{11727}-\u{1172B}\u{1182F}-\u{11837}\u{11839}\u{1183A}\u{1193B}\u{1193C}\u{1193E}\u{11943}\u{119D4}-\u{119D7}\u{119DA}\u{119DB}\u{119E0}\u{11A01}-\u{11A0A}\u{11A33}-\u{11A38}\u{11A3B}-\u{11A3E}\u{11A47}\u{11A51}-\u{11A56}\u{11A59}-\u{11A5B}\u{11A8A}-\u{11A96}\u{11A98}\u{11A99}\u{11C30}-\u{11C36}\u{11C38}-\u{11C3D}\u{11C3F}\u{11C92}-\u{11CA7}\u{11CAA}-\u{11CB0}\u{11CB2}\u{11CB3}\u{11CB5}\u{11CB6}\u{11D31}-\u{11D36}\u{11D3A}\u{11D3C}\u{11D3D}\u{11D3F}-\u{11D45}\u{11D47}\u{11D90}\u{11D91}\u{11D95}\u{11D97}\u{11EF3}\u{11EF4}\u{11F00}\u{11F01}\u{11F36}-\u{11F3A}\u{11F40}\u{11F42}\u{13430}-\u{13440}\u{13447}-\u{13455}\u{16AF0}-\u{16AF4}\u{16B30}-\u{16B36}\u{16F4F}\u{16F8F}-\u{16F92}\u{16FE4}\u{1BC9D}\u{1BC9E}\u{1BCA0}-\u{1BCA3}\u{1CF00}-\u{1CF2D}\u{1CF30}-\u{1CF46}\u{1D167}-\u{1D169}\u{1D173}-\u{1D182}\u{1D185}-\u{1D18B}\u{1D1AA}-\u{1D1AD}\u{1D242}-\u{1D244}\u{1DA00}-\u{1DA36}\u{1DA3B}-\u{1DA6C}\u{1DA75}\u{1DA84}\u{1DA9B}-\u{1DA9F}\u{1DAA1}-\u{1DAAF}\u{1E000}-\u{1E006}\u{1E008}-\u{1E018}\u{1E01B}-\u{1E021}\u{1E023}\u{1E024}\u{1E026}-\u{1E02A}\u{1E08F}\u{1E130}-\u{1E136}\u{1E2AE}\u{1E2EC}-\u{1E2EF}\u{1E4EC}-\u{1E4EF}\u{1E8D0}-\u{1E8D6}\u{1E944}-\u{1E94B}\u{E0001}\u{E0020}-\u{E007F}\u{E0100}-\u{E01EF}]*[\u0620\u0622-\u063F\u0641-\u064A\u066E\u066F\u0671-\u0673\u0675-\u06D3\u06D5\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u077F\u07CA-\u07EA\u0840-\u0858\u0860\u0862-\u0865\u0867-\u086A\u0870-\u0882\u0886\u0889-\u088E\u08A0-\u08AC\u08AE-\u08C8\u1807\u1820-\u1878\u1887-\u18A8\u18AA\uA840-\uA871\u{10AC0}-\u{10AC5}\u{10AC7}\u{10AC9}\u{10ACA}\u{10ACE}-\u{10AD6}\u{10AD8}-\u{10AE1}\u{10AE4}\u{10AEB}-\u{10AEF}\u{10B80}-\u{10B91}\u{10BA9}-\u{10BAE}\u{10D01}-\u{10D23}\u{10F30}-\u{10F44}\u{10F51}-\u{10F54}\u{10F70}-\u{10F81}\u{10FB0}\u{10FB2}-\u{10FB6}\u{10FB8}-\u{10FBF}\u{10FC1}-\u{10FC4}\u{10FC9}\u{10FCA}\u{1E900}-\u{1E943}]/u;
const bidiDomain = /[\u05BE\u05C0\u05C3\u05C6\u05D0-\u05EA\u05EF-\u05F4\u0600-\u0605\u0608\u060B\u060D\u061B-\u064A\u0660-\u0669\u066B-\u066F\u0671-\u06D5\u06DD\u06E5\u06E6\u06EE\u06EF\u06FA-\u070D\u070F\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07C0-\u07EA\u07F4\u07F5\u07FA\u07FE-\u0815\u081A\u0824\u0828\u0830-\u083E\u0840-\u0858\u085E\u0860-\u086A\u0870-\u088E\u0890\u0891\u08A0-\u08C9\u08E2\u200F\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBC2\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFC\uFE70-\uFE74\uFE76-\uFEFC\u{10800}-\u{10805}\u{10808}\u{1080A}-\u{10835}\u{10837}\u{10838}\u{1083C}\u{1083F}-\u{10855}\u{10857}-\u{1089E}\u{108A7}-\u{108AF}\u{108E0}-\u{108F2}\u{108F4}\u{108F5}\u{108FB}-\u{1091B}\u{10920}-\u{10939}\u{1093F}\u{10980}-\u{109B7}\u{109BC}-\u{109CF}\u{109D2}-\u{10A00}\u{10A10}-\u{10A13}\u{10A15}-\u{10A17}\u{10A19}-\u{10A35}\u{10A40}-\u{10A48}\u{10A50}-\u{10A58}\u{10A60}-\u{10A9F}\u{10AC0}-\u{10AE4}\u{10AEB}-\u{10AF6}\u{10B00}-\u{10B35}\u{10B40}-\u{10B55}\u{10B58}-\u{10B72}\u{10B78}-\u{10B91}\u{10B99}-\u{10B9C}\u{10BA9}-\u{10BAF}\u{10C00}-\u{10C48}\u{10C80}-\u{10CB2}\u{10CC0}-\u{10CF2}\u{10CFA}-\u{10D23}\u{10D30}-\u{10D39}\u{10E60}-\u{10E7E}\u{10E80}-\u{10EA9}\u{10EAD}\u{10EB0}\u{10EB1}\u{10F00}-\u{10F27}\u{10F30}-\u{10F45}\u{10F51}-\u{10F59}\u{10F70}-\u{10F81}\u{10F86}-\u{10F89}\u{10FB0}-\u{10FCB}\u{10FE0}-\u{10FF6}\u{1E800}-\u{1E8C4}\u{1E8C7}-\u{1E8CF}\u{1E900}-\u{1E943}\u{1E94B}\u{1E950}-\u{1E959}\u{1E95E}\u{1E95F}\u{1EC71}-\u{1ECB4}\u{1ED01}-\u{1ED3D}\u{1EE00}-\u{1EE03}\u{1EE05}-\u{1EE1F}\u{1EE21}\u{1EE22}\u{1EE24}\u{1EE27}\u{1EE29}-\u{1EE32}\u{1EE34}-\u{1EE37}\u{1EE39}\u{1EE3B}\u{1EE42}\u{1EE47}\u{1EE49}\u{1EE4B}\u{1EE4D}-\u{1EE4F}\u{1EE51}\u{1EE52}\u{1EE54}\u{1EE57}\u{1EE59}\u{1EE5B}\u{1EE5D}\u{1EE5F}\u{1EE61}\u{1EE62}\u{1EE64}\u{1EE67}-\u{1EE6A}\u{1EE6C}-\u{1EE72}\u{1EE74}-\u{1EE77}\u{1EE79}-\u{1EE7C}\u{1EE7E}\u{1EE80}-\u{1EE89}\u{1EE8B}-\u{1EE9B}\u{1EEA1}-\u{1EEA3}\u{1EEA5}-\u{1EEA9}\u{1EEAB}-\u{1EEBB}]/u;
const bidiS1LTR = /[A-Za-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02B8\u02BB-\u02C1\u02D0\u02D1\u02E0-\u02E4\u02EE\u0370-\u0373\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0482\u048A-\u052F\u0531-\u0556\u0559-\u0589\u0903-\u0939\u093B\u093D-\u0940\u0949-\u094C\u094E-\u0950\u0958-\u0961\u0964-\u0980\u0982\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD-\u09C0\u09C7\u09C8\u09CB\u09CC\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E1\u09E6-\u09F1\u09F4-\u09FA\u09FC\u09FD\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3E-\u0A40\u0A59-\u0A5C\u0A5E\u0A66-\u0A6F\u0A72-\u0A74\u0A76\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD-\u0AC0\u0AC9\u0ACB\u0ACC\u0AD0\u0AE0\u0AE1\u0AE6-\u0AF0\u0AF9\u0B02\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B3E\u0B40\u0B47\u0B48\u0B4B\u0B4C\u0B57\u0B5C\u0B5D\u0B5F-\u0B61\u0B66-\u0B77\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE\u0BBF\u0BC1\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCC\u0BD0\u0BD7\u0BE6-\u0BF2\u0C01-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C41-\u0C44\u0C58-\u0C5A\u0C5D\u0C60\u0C61\u0C66-\u0C6F\u0C77\u0C7F\u0C80\u0C82-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD-\u0CC4\u0CC6-\u0CC8\u0CCA\u0CCB\u0CD5\u0CD6\u0CDD\u0CDE\u0CE0\u0CE1\u0CE6-\u0CEF\u0CF1-\u0CF3\u0D02-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D40\u0D46-\u0D48\u0D4A-\u0D4C\u0D4E\u0D4F\u0D54-\u0D61\u0D66-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCF-\u0DD1\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2-\u0DF4\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E4F-\u0E5B\u0E81\u0E82\u0E84\u0E86-\u0E8A\u0E8C-\u0EA3\u0EA5\u0EA7-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00-\u0F17\u0F1A-\u0F34\u0F36\u0F38\u0F3E-\u0F47\u0F49-\u0F6C\u0F7F\u0F85\u0F88-\u0F8C\u0FBE-\u0FC5\u0FC7-\u0FCC\u0FCE-\u0FDA\u1000-\u102C\u1031\u1038\u103B\u103C\u103F-\u1057\u105A-\u105D\u1061-\u1070\u1075-\u1081\u1083\u1084\u1087-\u108C\u108E-\u109C\u109E-\u10C5\u10C7\u10CD\u10D0-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1360-\u137C\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u167F\u1681-\u169A\u16A0-\u16F8\u1700-\u1711\u1715\u171F-\u1731\u1734-\u1736\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17B6\u17BE-\u17C5\u17C7\u17C8\u17D4-\u17DA\u17DC\u17E0-\u17E9\u1810-\u1819\u1820-\u1878\u1880-\u1884\u1887-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1923-\u1926\u1929-\u192B\u1930\u1931\u1933-\u1938\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19DA\u1A00-\u1A16\u1A19\u1A1A\u1A1E-\u1A55\u1A57\u1A61\u1A63\u1A64\u1A6D-\u1A72\u1A80-\u1A89\u1A90-\u1A99\u1AA0-\u1AAD\u1B04-\u1B33\u1B35\u1B3B\u1B3D-\u1B41\u1B43-\u1B4C\u1B50-\u1B6A\u1B74-\u1B7E\u1B82-\u1BA1\u1BA6\u1BA7\u1BAA\u1BAE-\u1BE5\u1BE7\u1BEA-\u1BEC\u1BEE\u1BF2\u1BF3\u1BFC-\u1C2B\u1C34\u1C35\u1C3B-\u1C49\u1C4D-\u1C88\u1C90-\u1CBA\u1CBD-\u1CC7\u1CD3\u1CE1\u1CE9-\u1CEC\u1CEE-\u1CF3\u1CF5-\u1CF7\u1CFA\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200E\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u214F\u2160-\u2188\u2336-\u237A\u2395\u249C-\u24E9\u26AC\u2800-\u28FF\u2C00-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D70\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u302E\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312F\u3131-\u318E\u3190-\u31BF\u31F0-\u321C\u3220-\u324F\u3260-\u327B\u327F-\u32B0\u32C0-\u32CB\u32D0-\u3376\u337B-\u33DD\u33E0-\u33FE\u3400-\u4DBF\u4E00-\uA48C\uA4D0-\uA60C\uA610-\uA62B\uA640-\uA66E\uA680-\uA69D\uA6A0-\uA6EF\uA6F2-\uA6F7\uA722-\uA787\uA789-\uA7CA\uA7D0\uA7D1\uA7D3\uA7D5-\uA7D9\uA7F2-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA824\uA827\uA830-\uA837\uA840-\uA873\uA880-\uA8C3\uA8CE-\uA8D9\uA8F2-\uA8FE\uA900-\uA925\uA92E-\uA946\uA952\uA953\uA95F-\uA97C\uA983-\uA9B2\uA9B4\uA9B5\uA9BA\uA9BB\uA9BE-\uA9CD\uA9CF-\uA9D9\uA9DE-\uA9E4\uA9E6-\uA9FE\uAA00-\uAA28\uAA2F\uAA30\uAA33\uAA34\uAA40-\uAA42\uAA44-\uAA4B\uAA4D\uAA50-\uAA59\uAA5C-\uAA7B\uAA7D-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAAEB\uAAEE-\uAAF5\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB69\uAB70-\uABE4\uABE6\uABE7\uABE9-\uABEC\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uD800-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC\u{10000}-\u{1000B}\u{1000D}-\u{10026}\u{10028}-\u{1003A}\u{1003C}\u{1003D}\u{1003F}-\u{1004D}\u{10050}-\u{1005D}\u{10080}-\u{100FA}\u{10100}\u{10102}\u{10107}-\u{10133}\u{10137}-\u{1013F}\u{1018D}\u{1018E}\u{101D0}-\u{101FC}\u{10280}-\u{1029C}\u{102A0}-\u{102D0}\u{10300}-\u{10323}\u{1032D}-\u{1034A}\u{10350}-\u{10375}\u{10380}-\u{1039D}\u{1039F}-\u{103C3}\u{103C8}-\u{103D5}\u{10400}-\u{1049D}\u{104A0}-\u{104A9}\u{104B0}-\u{104D3}\u{104D8}-\u{104FB}\u{10500}-\u{10527}\u{10530}-\u{10563}\u{1056F}-\u{1057A}\u{1057C}-\u{1058A}\u{1058C}-\u{10592}\u{10594}\u{10595}\u{10597}-\u{105A1}\u{105A3}-\u{105B1}\u{105B3}-\u{105B9}\u{105BB}\u{105BC}\u{10600}-\u{10736}\u{10740}-\u{10755}\u{10760}-\u{10767}\u{10780}-\u{10785}\u{10787}-\u{107B0}\u{107B2}-\u{107BA}\u{11000}\u{11002}-\u{11037}\u{11047}-\u{1104D}\u{11066}-\u{1106F}\u{11071}\u{11072}\u{11075}\u{11082}-\u{110B2}\u{110B7}\u{110B8}\u{110BB}-\u{110C1}\u{110CD}\u{110D0}-\u{110E8}\u{110F0}-\u{110F9}\u{11103}-\u{11126}\u{1112C}\u{11136}-\u{11147}\u{11150}-\u{11172}\u{11174}-\u{11176}\u{11182}-\u{111B5}\u{111BF}-\u{111C8}\u{111CD}\u{111CE}\u{111D0}-\u{111DF}\u{111E1}-\u{111F4}\u{11200}-\u{11211}\u{11213}-\u{1122E}\u{11232}\u{11233}\u{11235}\u{11238}-\u{1123D}\u{1123F}\u{11240}\u{11280}-\u{11286}\u{11288}\u{1128A}-\u{1128D}\u{1128F}-\u{1129D}\u{1129F}-\u{112A9}\u{112B0}-\u{112DE}\u{112E0}-\u{112E2}\u{112F0}-\u{112F9}\u{11302}\u{11303}\u{11305}-\u{1130C}\u{1130F}\u{11310}\u{11313}-\u{11328}\u{1132A}-\u{11330}\u{11332}\u{11333}\u{11335}-\u{11339}\u{1133D}-\u{1133F}\u{11341}-\u{11344}\u{11347}\u{11348}\u{1134B}-\u{1134D}\u{11350}\u{11357}\u{1135D}-\u{11363}\u{11400}-\u{11437}\u{11440}\u{11441}\u{11445}\u{11447}-\u{1145B}\u{1145D}\u{1145F}-\u{11461}\u{11480}-\u{114B2}\u{114B9}\u{114BB}-\u{114BE}\u{114C1}\u{114C4}-\u{114C7}\u{114D0}-\u{114D9}\u{11580}-\u{115B1}\u{115B8}-\u{115BB}\u{115BE}\u{115C1}-\u{115DB}\u{11600}-\u{11632}\u{1163B}\u{1163C}\u{1163E}\u{11641}-\u{11644}\u{11650}-\u{11659}\u{11680}-\u{116AA}\u{116AC}\u{116AE}\u{116AF}\u{116B6}\u{116B8}\u{116B9}\u{116C0}-\u{116C9}\u{11700}-\u{1171A}\u{11720}\u{11721}\u{11726}\u{11730}-\u{11746}\u{11800}-\u{1182E}\u{11838}\u{1183B}\u{118A0}-\u{118F2}\u{118FF}-\u{11906}\u{11909}\u{1190C}-\u{11913}\u{11915}\u{11916}\u{11918}-\u{11935}\u{11937}\u{11938}\u{1193D}\u{1193F}-\u{11942}\u{11944}-\u{11946}\u{11950}-\u{11959}\u{119A0}-\u{119A7}\u{119AA}-\u{119D3}\u{119DC}-\u{119DF}\u{119E1}-\u{119E4}\u{11A00}\u{11A07}\u{11A08}\u{11A0B}-\u{11A32}\u{11A39}\u{11A3A}\u{11A3F}-\u{11A46}\u{11A50}\u{11A57}\u{11A58}\u{11A5C}-\u{11A89}\u{11A97}\u{11A9A}-\u{11AA2}\u{11AB0}-\u{11AF8}\u{11B00}-\u{11B09}\u{11C00}-\u{11C08}\u{11C0A}-\u{11C2F}\u{11C3E}-\u{11C45}\u{11C50}-\u{11C6C}\u{11C70}-\u{11C8F}\u{11CA9}\u{11CB1}\u{11CB4}\u{11D00}-\u{11D06}\u{11D08}\u{11D09}\u{11D0B}-\u{11D30}\u{11D46}\u{11D50}-\u{11D59}\u{11D60}-\u{11D65}\u{11D67}\u{11D68}\u{11D6A}-\u{11D8E}\u{11D93}\u{11D94}\u{11D96}\u{11D98}\u{11DA0}-\u{11DA9}\u{11EE0}-\u{11EF2}\u{11EF5}-\u{11EF8}\u{11F02}-\u{11F10}\u{11F12}-\u{11F35}\u{11F3E}\u{11F3F}\u{11F41}\u{11F43}-\u{11F59}\u{11FB0}\u{11FC0}-\u{11FD4}\u{11FFF}-\u{12399}\u{12400}-\u{1246E}\u{12470}-\u{12474}\u{12480}-\u{12543}\u{12F90}-\u{12FF2}\u{13000}-\u{1343F}\u{13441}-\u{13446}\u{14400}-\u{14646}\u{16800}-\u{16A38}\u{16A40}-\u{16A5E}\u{16A60}-\u{16A69}\u{16A6E}-\u{16ABE}\u{16AC0}-\u{16AC9}\u{16AD0}-\u{16AED}\u{16AF5}\u{16B00}-\u{16B2F}\u{16B37}-\u{16B45}\u{16B50}-\u{16B59}\u{16B5B}-\u{16B61}\u{16B63}-\u{16B77}\u{16B7D}-\u{16B8F}\u{16E40}-\u{16E9A}\u{16F00}-\u{16F4A}\u{16F50}-\u{16F87}\u{16F93}-\u{16F9F}\u{16FE0}\u{16FE1}\u{16FE3}\u{16FF0}\u{16FF1}\u{17000}-\u{187F7}\u{18800}-\u{18CD5}\u{18D00}-\u{18D08}\u{1AFF0}-\u{1AFF3}\u{1AFF5}-\u{1AFFB}\u{1AFFD}\u{1AFFE}\u{1B000}-\u{1B122}\u{1B132}\u{1B150}-\u{1B152}\u{1B155}\u{1B164}-\u{1B167}\u{1B170}-\u{1B2FB}\u{1BC00}-\u{1BC6A}\u{1BC70}-\u{1BC7C}\u{1BC80}-\u{1BC88}\u{1BC90}-\u{1BC99}\u{1BC9C}\u{1BC9F}\u{1CF50}-\u{1CFC3}\u{1D000}-\u{1D0F5}\u{1D100}-\u{1D126}\u{1D129}-\u{1D166}\u{1D16A}-\u{1D172}\u{1D183}\u{1D184}\u{1D18C}-\u{1D1A9}\u{1D1AE}-\u{1D1E8}\u{1D2C0}-\u{1D2D3}\u{1D2E0}-\u{1D2F3}\u{1D360}-\u{1D378}\u{1D400}-\u{1D454}\u{1D456}-\u{1D49C}\u{1D49E}\u{1D49F}\u{1D4A2}\u{1D4A5}\u{1D4A6}\u{1D4A9}-\u{1D4AC}\u{1D4AE}-\u{1D4B9}\u{1D4BB}\u{1D4BD}-\u{1D4C3}\u{1D4C5}-\u{1D505}\u{1D507}-\u{1D50A}\u{1D50D}-\u{1D514}\u{1D516}-\u{1D51C}\u{1D51E}-\u{1D539}\u{1D53B}-\u{1D53E}\u{1D540}-\u{1D544}\u{1D546}\u{1D54A}-\u{1D550}\u{1D552}-\u{1D6A5}\u{1D6A8}-\u{1D6DA}\u{1D6DC}-\u{1D714}\u{1D716}-\u{1D74E}\u{1D750}-\u{1D788}\u{1D78A}-\u{1D7C2}\u{1D7C4}-\u{1D7CB}\u{1D800}-\u{1D9FF}\u{1DA37}-\u{1DA3A}\u{1DA6D}-\u{1DA74}\u{1DA76}-\u{1DA83}\u{1DA85}-\u{1DA8B}\u{1DF00}-\u{1DF1E}\u{1DF25}-\u{1DF2A}\u{1E030}-\u{1E06D}\u{1E100}-\u{1E12C}\u{1E137}-\u{1E13D}\u{1E140}-\u{1E149}\u{1E14E}\u{1E14F}\u{1E290}-\u{1E2AD}\u{1E2C0}-\u{1E2EB}\u{1E2F0}-\u{1E2F9}\u{1E4D0}-\u{1E4EB}\u{1E4F0}-\u{1E4F9}\u{1E7E0}-\u{1E7E6}\u{1E7E8}-\u{1E7EB}\u{1E7ED}\u{1E7EE}\u{1E7F0}-\u{1E7FE}\u{1F110}-\u{1F12E}\u{1F130}-\u{1F169}\u{1F170}-\u{1F1AC}\u{1F1E6}-\u{1F202}\u{1F210}-\u{1F23B}\u{1F240}-\u{1F248}\u{1F250}\u{1F251}\u{20000}-\u{2A6DF}\u{2A700}-\u{2B739}\u{2B740}-\u{2B81D}\u{2B820}-\u{2CEA1}\u{2CEB0}-\u{2EBE0}\u{2EBF0}-\u{2EE5D}\u{2F800}-\u{2FA1D}\u{30000}-\u{3134A}\u{31350}-\u{323AF}\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/u;
const bidiS1RTL = /[\u05BE\u05C0\u05C3\u05C6\u05D0-\u05EA\u05EF-\u05F4\u0608\u060B\u060D\u061B-\u064A\u066D-\u066F\u0671-\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u070D\u070F\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07C0-\u07EA\u07F4\u07F5\u07FA\u07FE-\u0815\u081A\u0824\u0828\u0830-\u083E\u0840-\u0858\u085E\u0860-\u086A\u0870-\u088E\u08A0-\u08C9\u200F\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBC2\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFC\uFE70-\uFE74\uFE76-\uFEFC\u{10800}-\u{10805}\u{10808}\u{1080A}-\u{10835}\u{10837}\u{10838}\u{1083C}\u{1083F}-\u{10855}\u{10857}-\u{1089E}\u{108A7}-\u{108AF}\u{108E0}-\u{108F2}\u{108F4}\u{108F5}\u{108FB}-\u{1091B}\u{10920}-\u{10939}\u{1093F}\u{10980}-\u{109B7}\u{109BC}-\u{109CF}\u{109D2}-\u{10A00}\u{10A10}-\u{10A13}\u{10A15}-\u{10A17}\u{10A19}-\u{10A35}\u{10A40}-\u{10A48}\u{10A50}-\u{10A58}\u{10A60}-\u{10A9F}\u{10AC0}-\u{10AE4}\u{10AEB}-\u{10AF6}\u{10B00}-\u{10B35}\u{10B40}-\u{10B55}\u{10B58}-\u{10B72}\u{10B78}-\u{10B91}\u{10B99}-\u{10B9C}\u{10BA9}-\u{10BAF}\u{10C00}-\u{10C48}\u{10C80}-\u{10CB2}\u{10CC0}-\u{10CF2}\u{10CFA}-\u{10D23}\u{10E80}-\u{10EA9}\u{10EAD}\u{10EB0}\u{10EB1}\u{10F00}-\u{10F27}\u{10F30}-\u{10F45}\u{10F51}-\u{10F59}\u{10F70}-\u{10F81}\u{10F86}-\u{10F89}\u{10FB0}-\u{10FCB}\u{10FE0}-\u{10FF6}\u{1E800}-\u{1E8C4}\u{1E8C7}-\u{1E8CF}\u{1E900}-\u{1E943}\u{1E94B}\u{1E950}-\u{1E959}\u{1E95E}\u{1E95F}\u{1EC71}-\u{1ECB4}\u{1ED01}-\u{1ED3D}\u{1EE00}-\u{1EE03}\u{1EE05}-\u{1EE1F}\u{1EE21}\u{1EE22}\u{1EE24}\u{1EE27}\u{1EE29}-\u{1EE32}\u{1EE34}-\u{1EE37}\u{1EE39}\u{1EE3B}\u{1EE42}\u{1EE47}\u{1EE49}\u{1EE4B}\u{1EE4D}-\u{1EE4F}\u{1EE51}\u{1EE52}\u{1EE54}\u{1EE57}\u{1EE59}\u{1EE5B}\u{1EE5D}\u{1EE5F}\u{1EE61}\u{1EE62}\u{1EE64}\u{1EE67}-\u{1EE6A}\u{1EE6C}-\u{1EE72}\u{1EE74}-\u{1EE77}\u{1EE79}-\u{1EE7C}\u{1EE7E}\u{1EE80}-\u{1EE89}\u{1EE8B}-\u{1EE9B}\u{1EEA1}-\u{1EEA3}\u{1EEA5}-\u{1EEA9}\u{1EEAB}-\u{1EEBB}]/u;
const bidiS2 = /^[\0-\x08\x0E-\x1B!-@\[-`\{-\x84\x86-\xA9\xAB-\xB4\xB6-\xB9\xBB-\xBF\xD7\xF7\u02B9\u02BA\u02C2-\u02CF\u02D2-\u02DF\u02E5-\u02ED\u02EF-\u036F\u0374\u0375\u037E\u0384\u0385\u0387\u03F6\u0483-\u0489\u058A\u058D-\u058F\u0591-\u05C7\u05D0-\u05EA\u05EF-\u05F4\u0600-\u070D\u070F-\u074A\u074D-\u07B1\u07C0-\u07FA\u07FD-\u082D\u0830-\u083E\u0840-\u085B\u085E\u0860-\u086A\u0870-\u088E\u0890\u0891\u0898-\u0902\u093A\u093C\u0941-\u0948\u094D\u0951-\u0957\u0962\u0963\u0981\u09BC\u09C1-\u09C4\u09CD\u09E2\u09E3\u09F2\u09F3\u09FB\u09FE\u0A01\u0A02\u0A3C\u0A41\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81\u0A82\u0ABC\u0AC1-\u0AC5\u0AC7\u0AC8\u0ACD\u0AE2\u0AE3\u0AF1\u0AFA-\u0AFF\u0B01\u0B3C\u0B3F\u0B41-\u0B44\u0B4D\u0B55\u0B56\u0B62\u0B63\u0B82\u0BC0\u0BCD\u0BF3-\u0BFA\u0C00\u0C04\u0C3C\u0C3E-\u0C40\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C78-\u0C7E\u0C81\u0CBC\u0CCC\u0CCD\u0CE2\u0CE3\u0D00\u0D01\u0D3B\u0D3C\u0D41-\u0D44\u0D4D\u0D62\u0D63\u0D81\u0DCA\u0DD2-\u0DD4\u0DD6\u0E31\u0E34-\u0E3A\u0E3F\u0E47-\u0E4E\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECE\u0F18\u0F19\u0F35\u0F37\u0F39-\u0F3D\u0F71-\u0F7E\u0F80-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102D-\u1030\u1032-\u1037\u1039\u103A\u103D\u103E\u1058\u1059\u105E-\u1060\u1071-\u1074\u1082\u1085\u1086\u108D\u109D\u135D-\u135F\u1390-\u1399\u1400\u169B\u169C\u1712-\u1714\u1732\u1733\u1752\u1753\u1772\u1773\u17B4\u17B5\u17B7-\u17BD\u17C6\u17C9-\u17D3\u17DB\u17DD\u17F0-\u17F9\u1800-\u180F\u1885\u1886\u18A9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193B\u1940\u1944\u1945\u19DE-\u19FF\u1A17\u1A18\u1A1B\u1A56\u1A58-\u1A5E\u1A60\u1A62\u1A65-\u1A6C\u1A73-\u1A7C\u1A7F\u1AB0-\u1ACE\u1B00-\u1B03\u1B34\u1B36-\u1B3A\u1B3C\u1B42\u1B6B-\u1B73\u1B80\u1B81\u1BA2-\u1BA5\u1BA8\u1BA9\u1BAB-\u1BAD\u1BE6\u1BE8\u1BE9\u1BED\u1BEF-\u1BF1\u1C2C-\u1C33\u1C36\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE0\u1CE2-\u1CE8\u1CED\u1CF4\u1CF8\u1CF9\u1DC0-\u1DFF\u1FBD\u1FBF-\u1FC1\u1FCD-\u1FCF\u1FDD-\u1FDF\u1FED-\u1FEF\u1FFD\u1FFE\u200B-\u200D\u200F-\u2027\u202F-\u205E\u2060-\u2064\u206A-\u2070\u2074-\u207E\u2080-\u208E\u20A0-\u20C0\u20D0-\u20F0\u2100\u2101\u2103-\u2106\u2108\u2109\u2114\u2116-\u2118\u211E-\u2123\u2125\u2127\u2129\u212E\u213A\u213B\u2140-\u2144\u214A-\u214D\u2150-\u215F\u2189-\u218B\u2190-\u2335\u237B-\u2394\u2396-\u2426\u2440-\u244A\u2460-\u249B\u24EA-\u26AB\u26AD-\u27FF\u2900-\u2B73\u2B76-\u2B95\u2B97-\u2BFF\u2CE5-\u2CEA\u2CEF-\u2CF1\u2CF9-\u2CFF\u2D7F\u2DE0-\u2E5D\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u2FF0-\u2FFF\u3001-\u3004\u3008-\u3020\u302A-\u302D\u3030\u3036\u3037\u303D-\u303F\u3099-\u309C\u30A0\u30FB\u31C0-\u31E3\u31EF\u321D\u321E\u3250-\u325F\u327C-\u327E\u32B1-\u32BF\u32CC-\u32CF\u3377-\u337A\u33DE\u33DF\u33FF\u4DC0-\u4DFF\uA490-\uA4C6\uA60D-\uA60F\uA66F-\uA67F\uA69E\uA69F\uA6F0\uA6F1\uA700-\uA721\uA788\uA802\uA806\uA80B\uA825\uA826\uA828-\uA82C\uA838\uA839\uA874-\uA877\uA8C4\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA951\uA980-\uA982\uA9B3\uA9B6-\uA9B9\uA9BC\uA9BD\uA9E5\uAA29-\uAA2E\uAA31\uAA32\uAA35\uAA36\uAA43\uAA4C\uAA7C\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEC\uAAED\uAAF6\uAB6A\uAB6B\uABE5\uABE8\uABED\uFB1D-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBC2\uFBD3-\uFD8F\uFD92-\uFDC7\uFDCF\uFDF0-\uFE19\uFE20-\uFE52\uFE54-\uFE66\uFE68-\uFE6B\uFE70-\uFE74\uFE76-\uFEFC\uFEFF\uFF01-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65\uFFE0-\uFFE6\uFFE8-\uFFEE\uFFF9-\uFFFD\u{10101}\u{10140}-\u{1018C}\u{10190}-\u{1019C}\u{101A0}\u{101FD}\u{102E0}-\u{102FB}\u{10376}-\u{1037A}\u{10800}-\u{10805}\u{10808}\u{1080A}-\u{10835}\u{10837}\u{10838}\u{1083C}\u{1083F}-\u{10855}\u{10857}-\u{1089E}\u{108A7}-\u{108AF}\u{108E0}-\u{108F2}\u{108F4}\u{108F5}\u{108FB}-\u{1091B}\u{1091F}-\u{10939}\u{1093F}\u{10980}-\u{109B7}\u{109BC}-\u{109CF}\u{109D2}-\u{10A03}\u{10A05}\u{10A06}\u{10A0C}-\u{10A13}\u{10A15}-\u{10A17}\u{10A19}-\u{10A35}\u{10A38}-\u{10A3A}\u{10A3F}-\u{10A48}\u{10A50}-\u{10A58}\u{10A60}-\u{10A9F}\u{10AC0}-\u{10AE6}\u{10AEB}-\u{10AF6}\u{10B00}-\u{10B35}\u{10B39}-\u{10B55}\u{10B58}-\u{10B72}\u{10B78}-\u{10B91}\u{10B99}-\u{10B9C}\u{10BA9}-\u{10BAF}\u{10C00}-\u{10C48}\u{10C80}-\u{10CB2}\u{10CC0}-\u{10CF2}\u{10CFA}-\u{10D27}\u{10D30}-\u{10D39}\u{10E60}-\u{10E7E}\u{10E80}-\u{10EA9}\u{10EAB}-\u{10EAD}\u{10EB0}\u{10EB1}\u{10EFD}-\u{10F27}\u{10F30}-\u{10F59}\u{10F70}-\u{10F89}\u{10FB0}-\u{10FCB}\u{10FE0}-\u{10FF6}\u{11001}\u{11038}-\u{11046}\u{11052}-\u{11065}\u{11070}\u{11073}\u{11074}\u{1107F}-\u{11081}\u{110B3}-\u{110B6}\u{110B9}\u{110BA}\u{110C2}\u{11100}-\u{11102}\u{11127}-\u{1112B}\u{1112D}-\u{11134}\u{11173}\u{11180}\u{11181}\u{111B6}-\u{111BE}\u{111C9}-\u{111CC}\u{111CF}\u{1122F}-\u{11231}\u{11234}\u{11236}\u{11237}\u{1123E}\u{11241}\u{112DF}\u{112E3}-\u{112EA}\u{11300}\u{11301}\u{1133B}\u{1133C}\u{11340}\u{11366}-\u{1136C}\u{11370}-\u{11374}\u{11438}-\u{1143F}\u{11442}-\u{11444}\u{11446}\u{1145E}\u{114B3}-\u{114B8}\u{114BA}\u{114BF}\u{114C0}\u{114C2}\u{114C3}\u{115B2}-\u{115B5}\u{115BC}\u{115BD}\u{115BF}\u{115C0}\u{115DC}\u{115DD}\u{11633}-\u{1163A}\u{1163D}\u{1163F}\u{11640}\u{11660}-\u{1166C}\u{116AB}\u{116AD}\u{116B0}-\u{116B5}\u{116B7}\u{1171D}-\u{1171F}\u{11722}-\u{11725}\u{11727}-\u{1172B}\u{1182F}-\u{11837}\u{11839}\u{1183A}\u{1193B}\u{1193C}\u{1193E}\u{11943}\u{119D4}-\u{119D7}\u{119DA}\u{119DB}\u{119E0}\u{11A01}-\u{11A06}\u{11A09}\u{11A0A}\u{11A33}-\u{11A38}\u{11A3B}-\u{11A3E}\u{11A47}\u{11A51}-\u{11A56}\u{11A59}-\u{11A5B}\u{11A8A}-\u{11A96}\u{11A98}\u{11A99}\u{11C30}-\u{11C36}\u{11C38}-\u{11C3D}\u{11C92}-\u{11CA7}\u{11CAA}-\u{11CB0}\u{11CB2}\u{11CB3}\u{11CB5}\u{11CB6}\u{11D31}-\u{11D36}\u{11D3A}\u{11D3C}\u{11D3D}\u{11D3F}-\u{11D45}\u{11D47}\u{11D90}\u{11D91}\u{11D95}\u{11D97}\u{11EF3}\u{11EF4}\u{11F00}\u{11F01}\u{11F36}-\u{11F3A}\u{11F40}\u{11F42}\u{11FD5}-\u{11FF1}\u{13440}\u{13447}-\u{13455}\u{16AF0}-\u{16AF4}\u{16B30}-\u{16B36}\u{16F4F}\u{16F8F}-\u{16F92}\u{16FE2}\u{16FE4}\u{1BC9D}\u{1BC9E}\u{1BCA0}-\u{1BCA3}\u{1CF00}-\u{1CF2D}\u{1CF30}-\u{1CF46}\u{1D167}-\u{1D169}\u{1D173}-\u{1D182}\u{1D185}-\u{1D18B}\u{1D1AA}-\u{1D1AD}\u{1D1E9}\u{1D1EA}\u{1D200}-\u{1D245}\u{1D300}-\u{1D356}\u{1D6DB}\u{1D715}\u{1D74F}\u{1D789}\u{1D7C3}\u{1D7CE}-\u{1D7FF}\u{1DA00}-\u{1DA36}\u{1DA3B}-\u{1DA6C}\u{1DA75}\u{1DA84}\u{1DA9B}-\u{1DA9F}\u{1DAA1}-\u{1DAAF}\u{1E000}-\u{1E006}\u{1E008}-\u{1E018}\u{1E01B}-\u{1E021}\u{1E023}\u{1E024}\u{1E026}-\u{1E02A}\u{1E08F}\u{1E130}-\u{1E136}\u{1E2AE}\u{1E2EC}-\u{1E2EF}\u{1E2FF}\u{1E4EC}-\u{1E4EF}\u{1E800}-\u{1E8C4}\u{1E8C7}-\u{1E8D6}\u{1E900}-\u{1E94B}\u{1E950}-\u{1E959}\u{1E95E}\u{1E95F}\u{1EC71}-\u{1ECB4}\u{1ED01}-\u{1ED3D}\u{1EE00}-\u{1EE03}\u{1EE05}-\u{1EE1F}\u{1EE21}\u{1EE22}\u{1EE24}\u{1EE27}\u{1EE29}-\u{1EE32}\u{1EE34}-\u{1EE37}\u{1EE39}\u{1EE3B}\u{1EE42}\u{1EE47}\u{1EE49}\u{1EE4B}\u{1EE4D}-\u{1EE4F}\u{1EE51}\u{1EE52}\u{1EE54}\u{1EE57}\u{1EE59}\u{1EE5B}\u{1EE5D}\u{1EE5F}\u{1EE61}\u{1EE62}\u{1EE64}\u{1EE67}-\u{1EE6A}\u{1EE6C}-\u{1EE72}\u{1EE74}-\u{1EE77}\u{1EE79}-\u{1EE7C}\u{1EE7E}\u{1EE80}-\u{1EE89}\u{1EE8B}-\u{1EE9B}\u{1EEA1}-\u{1EEA3}\u{1EEA5}-\u{1EEA9}\u{1EEAB}-\u{1EEBB}\u{1EEF0}\u{1EEF1}\u{1F000}-\u{1F02B}\u{1F030}-\u{1F093}\u{1F0A0}-\u{1F0AE}\u{1F0B1}-\u{1F0BF}\u{1F0C1}-\u{1F0CF}\u{1F0D1}-\u{1F0F5}\u{1F100}-\u{1F10F}\u{1F12F}\u{1F16A}-\u{1F16F}\u{1F1AD}\u{1F260}-\u{1F265}\u{1F300}-\u{1F6D7}\u{1F6DC}-\u{1F6EC}\u{1F6F0}-\u{1F6FC}\u{1F700}-\u{1F776}\u{1F77B}-\u{1F7D9}\u{1F7E0}-\u{1F7EB}\u{1F7F0}\u{1F800}-\u{1F80B}\u{1F810}-\u{1F847}\u{1F850}-\u{1F859}\u{1F860}-\u{1F887}\u{1F890}-\u{1F8AD}\u{1F8B0}\u{1F8B1}\u{1F900}-\u{1FA53}\u{1FA60}-\u{1FA6D}\u{1FA70}-\u{1FA7C}\u{1FA80}-\u{1FA88}\u{1FA90}-\u{1FABD}\u{1FABF}-\u{1FAC5}\u{1FACE}-\u{1FADB}\u{1FAE0}-\u{1FAE8}\u{1FAF0}-\u{1FAF8}\u{1FB00}-\u{1FB92}\u{1FB94}-\u{1FBCA}\u{1FBF0}-\u{1FBF9}\u{E0001}\u{E0020}-\u{E007F}\u{E0100}-\u{E01EF}]*$/u;
const bidiS3 = /[0-9\xB2\xB3\xB9\u05BE\u05C0\u05C3\u05C6\u05D0-\u05EA\u05EF-\u05F4\u0600-\u0605\u0608\u060B\u060D\u061B-\u064A\u0660-\u0669\u066B-\u066F\u0671-\u06D5\u06DD\u06E5\u06E6\u06EE-\u070D\u070F\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07C0-\u07EA\u07F4\u07F5\u07FA\u07FE-\u0815\u081A\u0824\u0828\u0830-\u083E\u0840-\u0858\u085E\u0860-\u086A\u0870-\u088E\u0890\u0891\u08A0-\u08C9\u08E2\u200F\u2070\u2074-\u2079\u2080-\u2089\u2488-\u249B\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBC2\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFC\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\u{102E1}-\u{102FB}\u{10800}-\u{10805}\u{10808}\u{1080A}-\u{10835}\u{10837}\u{10838}\u{1083C}\u{1083F}-\u{10855}\u{10857}-\u{1089E}\u{108A7}-\u{108AF}\u{108E0}-\u{108F2}\u{108F4}\u{108F5}\u{108FB}-\u{1091B}\u{10920}-\u{10939}\u{1093F}\u{10980}-\u{109B7}\u{109BC}-\u{109CF}\u{109D2}-\u{10A00}\u{10A10}-\u{10A13}\u{10A15}-\u{10A17}\u{10A19}-\u{10A35}\u{10A40}-\u{10A48}\u{10A50}-\u{10A58}\u{10A60}-\u{10A9F}\u{10AC0}-\u{10AE4}\u{10AEB}-\u{10AF6}\u{10B00}-\u{10B35}\u{10B40}-\u{10B55}\u{10B58}-\u{10B72}\u{10B78}-\u{10B91}\u{10B99}-\u{10B9C}\u{10BA9}-\u{10BAF}\u{10C00}-\u{10C48}\u{10C80}-\u{10CB2}\u{10CC0}-\u{10CF2}\u{10CFA}-\u{10D23}\u{10D30}-\u{10D39}\u{10E60}-\u{10E7E}\u{10E80}-\u{10EA9}\u{10EAD}\u{10EB0}\u{10EB1}\u{10F00}-\u{10F27}\u{10F30}-\u{10F45}\u{10F51}-\u{10F59}\u{10F70}-\u{10F81}\u{10F86}-\u{10F89}\u{10FB0}-\u{10FCB}\u{10FE0}-\u{10FF6}\u{1D7CE}-\u{1D7FF}\u{1E800}-\u{1E8C4}\u{1E8C7}-\u{1E8CF}\u{1E900}-\u{1E943}\u{1E94B}\u{1E950}-\u{1E959}\u{1E95E}\u{1E95F}\u{1EC71}-\u{1ECB4}\u{1ED01}-\u{1ED3D}\u{1EE00}-\u{1EE03}\u{1EE05}-\u{1EE1F}\u{1EE21}\u{1EE22}\u{1EE24}\u{1EE27}\u{1EE29}-\u{1EE32}\u{1EE34}-\u{1EE37}\u{1EE39}\u{1EE3B}\u{1EE42}\u{1EE47}\u{1EE49}\u{1EE4B}\u{1EE4D}-\u{1EE4F}\u{1EE51}\u{1EE52}\u{1EE54}\u{1EE57}\u{1EE59}\u{1EE5B}\u{1EE5D}\u{1EE5F}\u{1EE61}\u{1EE62}\u{1EE64}\u{1EE67}-\u{1EE6A}\u{1EE6C}-\u{1EE72}\u{1EE74}-\u{1EE77}\u{1EE79}-\u{1EE7C}\u{1EE7E}\u{1EE80}-\u{1EE89}\u{1EE8B}-\u{1EE9B}\u{1EEA1}-\u{1EEA3}\u{1EEA5}-\u{1EEA9}\u{1EEAB}-\u{1EEBB}\u{1F100}-\u{1F10A}\u{1FBF0}-\u{1FBF9}][\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u0898-\u089F\u08CA-\u08E1\u08E3-\u0902\u093A\u093C\u0941-\u0948\u094D\u0951-\u0957\u0962\u0963\u0981\u09BC\u09C1-\u09C4\u09CD\u09E2\u09E3\u09FE\u0A01\u0A02\u0A3C\u0A41\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81\u0A82\u0ABC\u0AC1-\u0AC5\u0AC7\u0AC8\u0ACD\u0AE2\u0AE3\u0AFA-\u0AFF\u0B01\u0B3C\u0B3F\u0B41-\u0B44\u0B4D\u0B55\u0B56\u0B62\u0B63\u0B82\u0BC0\u0BCD\u0C00\u0C04\u0C3C\u0C3E-\u0C40\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81\u0CBC\u0CCC\u0CCD\u0CE2\u0CE3\u0D00\u0D01\u0D3B\u0D3C\u0D41-\u0D44\u0D4D\u0D62\u0D63\u0D81\u0DCA\u0DD2-\u0DD4\u0DD6\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECE\u0F18\u0F19\u0F35\u0F37\u0F39\u0F71-\u0F7E\u0F80-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102D-\u1030\u1032-\u1037\u1039\u103A\u103D\u103E\u1058\u1059\u105E-\u1060\u1071-\u1074\u1082\u1085\u1086\u108D\u109D\u135D-\u135F\u1712-\u1714\u1732\u1733\u1752\u1753\u1772\u1773\u17B4\u17B5\u17B7-\u17BD\u17C6\u17C9-\u17D3\u17DD\u180B-\u180D\u180F\u1885\u1886\u18A9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193B\u1A17\u1A18\u1A1B\u1A56\u1A58-\u1A5E\u1A60\u1A62\u1A65-\u1A6C\u1A73-\u1A7C\u1A7F\u1AB0-\u1ACE\u1B00-\u1B03\u1B34\u1B36-\u1B3A\u1B3C\u1B42\u1B6B-\u1B73\u1B80\u1B81\u1BA2-\u1BA5\u1BA8\u1BA9\u1BAB-\u1BAD\u1BE6\u1BE8\u1BE9\u1BED\u1BEF-\u1BF1\u1C2C-\u1C33\u1C36\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE0\u1CE2-\u1CE8\u1CED\u1CF4\u1CF8\u1CF9\u1DC0-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302D\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA825\uA826\uA82C\uA8C4\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA951\uA980-\uA982\uA9B3\uA9B6-\uA9B9\uA9BC\uA9BD\uA9E5\uAA29-\uAA2E\uAA31\uAA32\uAA35\uAA36\uAA43\uAA4C\uAA7C\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEC\uAAED\uAAF6\uABE5\uABE8\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F\u{101FD}\u{102E0}\u{10376}-\u{1037A}\u{10A01}-\u{10A03}\u{10A05}\u{10A06}\u{10A0C}-\u{10A0F}\u{10A38}-\u{10A3A}\u{10A3F}\u{10AE5}\u{10AE6}\u{10D24}-\u{10D27}\u{10EAB}\u{10EAC}\u{10EFD}-\u{10EFF}\u{10F46}-\u{10F50}\u{10F82}-\u{10F85}\u{11001}\u{11038}-\u{11046}\u{11070}\u{11073}\u{11074}\u{1107F}-\u{11081}\u{110B3}-\u{110B6}\u{110B9}\u{110BA}\u{110C2}\u{11100}-\u{11102}\u{11127}-\u{1112B}\u{1112D}-\u{11134}\u{11173}\u{11180}\u{11181}\u{111B6}-\u{111BE}\u{111C9}-\u{111CC}\u{111CF}\u{1122F}-\u{11231}\u{11234}\u{11236}\u{11237}\u{1123E}\u{11241}\u{112DF}\u{112E3}-\u{112EA}\u{11300}\u{11301}\u{1133B}\u{1133C}\u{11340}\u{11366}-\u{1136C}\u{11370}-\u{11374}\u{11438}-\u{1143F}\u{11442}-\u{11444}\u{11446}\u{1145E}\u{114B3}-\u{114B8}\u{114BA}\u{114BF}\u{114C0}\u{114C2}\u{114C3}\u{115B2}-\u{115B5}\u{115BC}\u{115BD}\u{115BF}\u{115C0}\u{115DC}\u{115DD}\u{11633}-\u{1163A}\u{1163D}\u{1163F}\u{11640}\u{116AB}\u{116AD}\u{116B0}-\u{116B5}\u{116B7}\u{1171D}-\u{1171F}\u{11722}-\u{11725}\u{11727}-\u{1172B}\u{1182F}-\u{11837}\u{11839}\u{1183A}\u{1193B}\u{1193C}\u{1193E}\u{11943}\u{119D4}-\u{119D7}\u{119DA}\u{119DB}\u{119E0}\u{11A01}-\u{11A06}\u{11A09}\u{11A0A}\u{11A33}-\u{11A38}\u{11A3B}-\u{11A3E}\u{11A47}\u{11A51}-\u{11A56}\u{11A59}-\u{11A5B}\u{11A8A}-\u{11A96}\u{11A98}\u{11A99}\u{11C30}-\u{11C36}\u{11C38}-\u{11C3D}\u{11C92}-\u{11CA7}\u{11CAA}-\u{11CB0}\u{11CB2}\u{11CB3}\u{11CB5}\u{11CB6}\u{11D31}-\u{11D36}\u{11D3A}\u{11D3C}\u{11D3D}\u{11D3F}-\u{11D45}\u{11D47}\u{11D90}\u{11D91}\u{11D95}\u{11D97}\u{11EF3}\u{11EF4}\u{11F00}\u{11F01}\u{11F36}-\u{11F3A}\u{11F40}\u{11F42}\u{13440}\u{13447}-\u{13455}\u{16AF0}-\u{16AF4}\u{16B30}-\u{16B36}\u{16F4F}\u{16F8F}-\u{16F92}\u{16FE4}\u{1BC9D}\u{1BC9E}\u{1CF00}-\u{1CF2D}\u{1CF30}-\u{1CF46}\u{1D167}-\u{1D169}\u{1D17B}-\u{1D182}\u{1D185}-\u{1D18B}\u{1D1AA}-\u{1D1AD}\u{1D242}-\u{1D244}\u{1DA00}-\u{1DA36}\u{1DA3B}-\u{1DA6C}\u{1DA75}\u{1DA84}\u{1DA9B}-\u{1DA9F}\u{1DAA1}-\u{1DAAF}\u{1E000}-\u{1E006}\u{1E008}-\u{1E018}\u{1E01B}-\u{1E021}\u{1E023}\u{1E024}\u{1E026}-\u{1E02A}\u{1E08F}\u{1E130}-\u{1E136}\u{1E2AE}\u{1E2EC}-\u{1E2EF}\u{1E4EC}-\u{1E4EF}\u{1E8D0}-\u{1E8D6}\u{1E944}-\u{1E94A}\u{E0100}-\u{E01EF}]*$/u;
const bidiS4EN = /[0-9\xB2\xB3\xB9\u06F0-\u06F9\u2070\u2074-\u2079\u2080-\u2089\u2488-\u249B\uFF10-\uFF19\u{102E1}-\u{102FB}\u{1D7CE}-\u{1D7FF}\u{1F100}-\u{1F10A}\u{1FBF0}-\u{1FBF9}]/u;
const bidiS4AN = /[\u0600-\u0605\u0660-\u0669\u066B\u066C\u06DD\u0890\u0891\u08E2\u{10D30}-\u{10D39}\u{10E60}-\u{10E7E}]/u;
const bidiS5 = /^[\0-\x08\x0E-\x1B!-\x84\x86-\u0377\u037A-\u037F\u0384-\u038A\u038C\u038E-\u03A1\u03A3-\u052F\u0531-\u0556\u0559-\u058A\u058D-\u058F\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0606\u0607\u0609\u060A\u060C\u060E-\u061A\u064B-\u065F\u066A\u0670\u06D6-\u06DC\u06DE-\u06E4\u06E7-\u06ED\u06F0-\u06F9\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07F6-\u07F9\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u0898-\u089F\u08CA-\u08E1\u08E3-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09FE\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A76\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AF1\u0AF9-\u0AFF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B55-\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B77\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BFA\u0C00-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3C-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C5D\u0C60-\u0C63\u0C66-\u0C6F\u0C77-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDD\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1-\u0CF3\u0D00-\u0D0C\u0D0E-\u0D10\u0D12-\u0D44\u0D46-\u0D48\u0D4A-\u0D4F\u0D54-\u0D63\u0D66-\u0D7F\u0D81-\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2-\u0DF4\u0E01-\u0E3A\u0E3F-\u0E5B\u0E81\u0E82\u0E84\u0E86-\u0E8A\u0E8C-\u0EA3\u0EA5\u0EA7-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECE\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00-\u0F47\u0F49-\u0F6C\u0F71-\u0F97\u0F99-\u0FBC\u0FBE-\u0FCC\u0FCE-\u0FDA\u1000-\u10C5\u10C7\u10CD\u10D0-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u137C\u1380-\u1399\u13A0-\u13F5\u13F8-\u13FD\u1400-\u167F\u1681-\u169C\u16A0-\u16F8\u1700-\u1715\u171F-\u1736\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17DD\u17E0-\u17E9\u17F0-\u17F9\u1800-\u1819\u1820-\u1878\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1940\u1944-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19DA\u19DE-\u1A1B\u1A1E-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA0-\u1AAD\u1AB0-\u1ACE\u1B00-\u1B4C\u1B50-\u1B7E\u1B80-\u1BF3\u1BFC-\u1C37\u1C3B-\u1C49\u1C4D-\u1C88\u1C90-\u1CBA\u1CBD-\u1CC7\u1CD0-\u1CFA\u1D00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FC4\u1FC6-\u1FD3\u1FD6-\u1FDB\u1FDD-\u1FEF\u1FF2-\u1FF4\u1FF6-\u1FFE\u200B-\u200E\u2010-\u2027\u202F-\u205E\u2060-\u2064\u206A-\u2071\u2074-\u208E\u2090-\u209C\u20A0-\u20C0\u20D0-\u20F0\u2100-\u218B\u2190-\u2426\u2440-\u244A\u2460-\u2B73\u2B76-\u2B95\u2B97-\u2CF3\u2CF9-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D70\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2E5D\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u2FF0-\u2FFF\u3001-\u303F\u3041-\u3096\u3099-\u30FF\u3105-\u312F\u3131-\u318E\u3190-\u31E3\u31EF-\u321E\u3220-\uA48C\uA490-\uA4C6\uA4D0-\uA62B\uA640-\uA6F7\uA700-\uA7CA\uA7D0\uA7D1\uA7D3\uA7D5-\uA7D9\uA7F2-\uA82C\uA830-\uA839\uA840-\uA877\uA880-\uA8C5\uA8CE-\uA8D9\uA8E0-\uA953\uA95F-\uA97C\uA980-\uA9CD\uA9CF-\uA9D9\uA9DE-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA5C-\uAAC2\uAADB-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB6B\uAB70-\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uD800-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1E\uFB29\uFD3E-\uFD4F\uFDCF\uFDFD-\uFE19\uFE20-\uFE52\uFE54-\uFE66\uFE68-\uFE6B\uFEFF\uFF01-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC\uFFE0-\uFFE6\uFFE8-\uFFEE\uFFF9-\uFFFD\u{10000}-\u{1000B}\u{1000D}-\u{10026}\u{10028}-\u{1003A}\u{1003C}\u{1003D}\u{1003F}-\u{1004D}\u{10050}-\u{1005D}\u{10080}-\u{100FA}\u{10100}-\u{10102}\u{10107}-\u{10133}\u{10137}-\u{1018E}\u{10190}-\u{1019C}\u{101A0}\u{101D0}-\u{101FD}\u{10280}-\u{1029C}\u{102A0}-\u{102D0}\u{102E0}-\u{102FB}\u{10300}-\u{10323}\u{1032D}-\u{1034A}\u{10350}-\u{1037A}\u{10380}-\u{1039D}\u{1039F}-\u{103C3}\u{103C8}-\u{103D5}\u{10400}-\u{1049D}\u{104A0}-\u{104A9}\u{104B0}-\u{104D3}\u{104D8}-\u{104FB}\u{10500}-\u{10527}\u{10530}-\u{10563}\u{1056F}-\u{1057A}\u{1057C}-\u{1058A}\u{1058C}-\u{10592}\u{10594}\u{10595}\u{10597}-\u{105A1}\u{105A3}-\u{105B1}\u{105B3}-\u{105B9}\u{105BB}\u{105BC}\u{10600}-\u{10736}\u{10740}-\u{10755}\u{10760}-\u{10767}\u{10780}-\u{10785}\u{10787}-\u{107B0}\u{107B2}-\u{107BA}\u{1091F}\u{10A01}-\u{10A03}\u{10A05}\u{10A06}\u{10A0C}-\u{10A0F}\u{10A38}-\u{10A3A}\u{10A3F}\u{10AE5}\u{10AE6}\u{10B39}-\u{10B3F}\u{10D24}-\u{10D27}\u{10EAB}\u{10EAC}\u{10EFD}-\u{10EFF}\u{10F46}-\u{10F50}\u{10F82}-\u{10F85}\u{11000}-\u{1104D}\u{11052}-\u{11075}\u{1107F}-\u{110C2}\u{110CD}\u{110D0}-\u{110E8}\u{110F0}-\u{110F9}\u{11100}-\u{11134}\u{11136}-\u{11147}\u{11150}-\u{11176}\u{11180}-\u{111DF}\u{111E1}-\u{111F4}\u{11200}-\u{11211}\u{11213}-\u{11241}\u{11280}-\u{11286}\u{11288}\u{1128A}-\u{1128D}\u{1128F}-\u{1129D}\u{1129F}-\u{112A9}\u{112B0}-\u{112EA}\u{112F0}-\u{112F9}\u{11300}-\u{11303}\u{11305}-\u{1130C}\u{1130F}\u{11310}\u{11313}-\u{11328}\u{1132A}-\u{11330}\u{11332}\u{11333}\u{11335}-\u{11339}\u{1133B}-\u{11344}\u{11347}\u{11348}\u{1134B}-\u{1134D}\u{11350}\u{11357}\u{1135D}-\u{11363}\u{11366}-\u{1136C}\u{11370}-\u{11374}\u{11400}-\u{1145B}\u{1145D}-\u{11461}\u{11480}-\u{114C7}\u{114D0}-\u{114D9}\u{11580}-\u{115B5}\u{115B8}-\u{115DD}\u{11600}-\u{11644}\u{11650}-\u{11659}\u{11660}-\u{1166C}\u{11680}-\u{116B9}\u{116C0}-\u{116C9}\u{11700}-\u{1171A}\u{1171D}-\u{1172B}\u{11730}-\u{11746}\u{11800}-\u{1183B}\u{118A0}-\u{118F2}\u{118FF}-\u{11906}\u{11909}\u{1190C}-\u{11913}\u{11915}\u{11916}\u{11918}-\u{11935}\u{11937}\u{11938}\u{1193B}-\u{11946}\u{11950}-\u{11959}\u{119A0}-\u{119A7}\u{119AA}-\u{119D7}\u{119DA}-\u{119E4}\u{11A00}-\u{11A47}\u{11A50}-\u{11AA2}\u{11AB0}-\u{11AF8}\u{11B00}-\u{11B09}\u{11C00}-\u{11C08}\u{11C0A}-\u{11C36}\u{11C38}-\u{11C45}\u{11C50}-\u{11C6C}\u{11C70}-\u{11C8F}\u{11C92}-\u{11CA7}\u{11CA9}-\u{11CB6}\u{11D00}-\u{11D06}\u{11D08}\u{11D09}\u{11D0B}-\u{11D36}\u{11D3A}\u{11D3C}\u{11D3D}\u{11D3F}-\u{11D47}\u{11D50}-\u{11D59}\u{11D60}-\u{11D65}\u{11D67}\u{11D68}\u{11D6A}-\u{11D8E}\u{11D90}\u{11D91}\u{11D93}-\u{11D98}\u{11DA0}-\u{11DA9}\u{11EE0}-\u{11EF8}\u{11F00}-\u{11F10}\u{11F12}-\u{11F3A}\u{11F3E}-\u{11F59}\u{11FB0}\u{11FC0}-\u{11FF1}\u{11FFF}-\u{12399}\u{12400}-\u{1246E}\u{12470}-\u{12474}\u{12480}-\u{12543}\u{12F90}-\u{12FF2}\u{13000}-\u{13455}\u{14400}-\u{14646}\u{16800}-\u{16A38}\u{16A40}-\u{16A5E}\u{16A60}-\u{16A69}\u{16A6E}-\u{16ABE}\u{16AC0}-\u{16AC9}\u{16AD0}-\u{16AED}\u{16AF0}-\u{16AF5}\u{16B00}-\u{16B45}\u{16B50}-\u{16B59}\u{16B5B}-\u{16B61}\u{16B63}-\u{16B77}\u{16B7D}-\u{16B8F}\u{16E40}-\u{16E9A}\u{16F00}-\u{16F4A}\u{16F4F}-\u{16F87}\u{16F8F}-\u{16F9F}\u{16FE0}-\u{16FE4}\u{16FF0}\u{16FF1}\u{17000}-\u{187F7}\u{18800}-\u{18CD5}\u{18D00}-\u{18D08}\u{1AFF0}-\u{1AFF3}\u{1AFF5}-\u{1AFFB}\u{1AFFD}\u{1AFFE}\u{1B000}-\u{1B122}\u{1B132}\u{1B150}-\u{1B152}\u{1B155}\u{1B164}-\u{1B167}\u{1B170}-\u{1B2FB}\u{1BC00}-\u{1BC6A}\u{1BC70}-\u{1BC7C}\u{1BC80}-\u{1BC88}\u{1BC90}-\u{1BC99}\u{1BC9C}-\u{1BCA3}\u{1CF00}-\u{1CF2D}\u{1CF30}-\u{1CF46}\u{1CF50}-\u{1CFC3}\u{1D000}-\u{1D0F5}\u{1D100}-\u{1D126}\u{1D129}-\u{1D1EA}\u{1D200}-\u{1D245}\u{1D2C0}-\u{1D2D3}\u{1D2E0}-\u{1D2F3}\u{1D300}-\u{1D356}\u{1D360}-\u{1D378}\u{1D400}-\u{1D454}\u{1D456}-\u{1D49C}\u{1D49E}\u{1D49F}\u{1D4A2}\u{1D4A5}\u{1D4A6}\u{1D4A9}-\u{1D4AC}\u{1D4AE}-\u{1D4B9}\u{1D4BB}\u{1D4BD}-\u{1D4C3}\u{1D4C5}-\u{1D505}\u{1D507}-\u{1D50A}\u{1D50D}-\u{1D514}\u{1D516}-\u{1D51C}\u{1D51E}-\u{1D539}\u{1D53B}-\u{1D53E}\u{1D540}-\u{1D544}\u{1D546}\u{1D54A}-\u{1D550}\u{1D552}-\u{1D6A5}\u{1D6A8}-\u{1D7CB}\u{1D7CE}-\u{1DA8B}\u{1DA9B}-\u{1DA9F}\u{1DAA1}-\u{1DAAF}\u{1DF00}-\u{1DF1E}\u{1DF25}-\u{1DF2A}\u{1E000}-\u{1E006}\u{1E008}-\u{1E018}\u{1E01B}-\u{1E021}\u{1E023}\u{1E024}\u{1E026}-\u{1E02A}\u{1E030}-\u{1E06D}\u{1E08F}\u{1E100}-\u{1E12C}\u{1E130}-\u{1E13D}\u{1E140}-\u{1E149}\u{1E14E}\u{1E14F}\u{1E290}-\u{1E2AE}\u{1E2C0}-\u{1E2F9}\u{1E2FF}\u{1E4D0}-\u{1E4F9}\u{1E7E0}-\u{1E7E6}\u{1E7E8}-\u{1E7EB}\u{1E7ED}\u{1E7EE}\u{1E7F0}-\u{1E7FE}\u{1E8D0}-\u{1E8D6}\u{1E944}-\u{1E94A}\u{1EEF0}\u{1EEF1}\u{1F000}-\u{1F02B}\u{1F030}-\u{1F093}\u{1F0A0}-\u{1F0AE}\u{1F0B1}-\u{1F0BF}\u{1F0C1}-\u{1F0CF}\u{1F0D1}-\u{1F0F5}\u{1F100}-\u{1F1AD}\u{1F1E6}-\u{1F202}\u{1F210}-\u{1F23B}\u{1F240}-\u{1F248}\u{1F250}\u{1F251}\u{1F260}-\u{1F265}\u{1F300}-\u{1F6D7}\u{1F6DC}-\u{1F6EC}\u{1F6F0}-\u{1F6FC}\u{1F700}-\u{1F776}\u{1F77B}-\u{1F7D9}\u{1F7E0}-\u{1F7EB}\u{1F7F0}\u{1F800}-\u{1F80B}\u{1F810}-\u{1F847}\u{1F850}-\u{1F859}\u{1F860}-\u{1F887}\u{1F890}-\u{1F8AD}\u{1F8B0}\u{1F8B1}\u{1F900}-\u{1FA53}\u{1FA60}-\u{1FA6D}\u{1FA70}-\u{1FA7C}\u{1FA80}-\u{1FA88}\u{1FA90}-\u{1FABD}\u{1FABF}-\u{1FAC5}\u{1FACE}-\u{1FADB}\u{1FAE0}-\u{1FAE8}\u{1FAF0}-\u{1FAF8}\u{1FB00}-\u{1FB92}\u{1FB94}-\u{1FBCA}\u{1FBF0}-\u{1FBF9}\u{20000}-\u{2A6DF}\u{2A700}-\u{2B739}\u{2B740}-\u{2B81D}\u{2B820}-\u{2CEA1}\u{2CEB0}-\u{2EBE0}\u{2EBF0}-\u{2EE5D}\u{2F800}-\u{2FA1D}\u{30000}-\u{3134A}\u{31350}-\u{323AF}\u{E0001}\u{E0020}-\u{E007F}\u{E0100}-\u{E01EF}\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]*$/u;
const bidiS6 = /[0-9A-Za-z\xAA\xB2\xB3\xB5\xB9\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02B8\u02BB-\u02C1\u02D0\u02D1\u02E0-\u02E4\u02EE\u0370-\u0373\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0482\u048A-\u052F\u0531-\u0556\u0559-\u0589\u06F0-\u06F9\u0903-\u0939\u093B\u093D-\u0940\u0949-\u094C\u094E-\u0950\u0958-\u0961\u0964-\u0980\u0982\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD-\u09C0\u09C7\u09C8\u09CB\u09CC\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E1\u09E6-\u09F1\u09F4-\u09FA\u09FC\u09FD\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3E-\u0A40\u0A59-\u0A5C\u0A5E\u0A66-\u0A6F\u0A72-\u0A74\u0A76\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD-\u0AC0\u0AC9\u0ACB\u0ACC\u0AD0\u0AE0\u0AE1\u0AE6-\u0AF0\u0AF9\u0B02\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B3E\u0B40\u0B47\u0B48\u0B4B\u0B4C\u0B57\u0B5C\u0B5D\u0B5F-\u0B61\u0B66-\u0B77\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE\u0BBF\u0BC1\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCC\u0BD0\u0BD7\u0BE6-\u0BF2\u0C01-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C41-\u0C44\u0C58-\u0C5A\u0C5D\u0C60\u0C61\u0C66-\u0C6F\u0C77\u0C7F\u0C80\u0C82-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD-\u0CC4\u0CC6-\u0CC8\u0CCA\u0CCB\u0CD5\u0CD6\u0CDD\u0CDE\u0CE0\u0CE1\u0CE6-\u0CEF\u0CF1-\u0CF3\u0D02-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D40\u0D46-\u0D48\u0D4A-\u0D4C\u0D4E\u0D4F\u0D54-\u0D61\u0D66-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCF-\u0DD1\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2-\u0DF4\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E4F-\u0E5B\u0E81\u0E82\u0E84\u0E86-\u0E8A\u0E8C-\u0EA3\u0EA5\u0EA7-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00-\u0F17\u0F1A-\u0F34\u0F36\u0F38\u0F3E-\u0F47\u0F49-\u0F6C\u0F7F\u0F85\u0F88-\u0F8C\u0FBE-\u0FC5\u0FC7-\u0FCC\u0FCE-\u0FDA\u1000-\u102C\u1031\u1038\u103B\u103C\u103F-\u1057\u105A-\u105D\u1061-\u1070\u1075-\u1081\u1083\u1084\u1087-\u108C\u108E-\u109C\u109E-\u10C5\u10C7\u10CD\u10D0-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1360-\u137C\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u167F\u1681-\u169A\u16A0-\u16F8\u1700-\u1711\u1715\u171F-\u1731\u1734-\u1736\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17B6\u17BE-\u17C5\u17C7\u17C8\u17D4-\u17DA\u17DC\u17E0-\u17E9\u1810-\u1819\u1820-\u1878\u1880-\u1884\u1887-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1923-\u1926\u1929-\u192B\u1930\u1931\u1933-\u1938\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19DA\u1A00-\u1A16\u1A19\u1A1A\u1A1E-\u1A55\u1A57\u1A61\u1A63\u1A64\u1A6D-\u1A72\u1A80-\u1A89\u1A90-\u1A99\u1AA0-\u1AAD\u1B04-\u1B33\u1B35\u1B3B\u1B3D-\u1B41\u1B43-\u1B4C\u1B50-\u1B6A\u1B74-\u1B7E\u1B82-\u1BA1\u1BA6\u1BA7\u1BAA\u1BAE-\u1BE5\u1BE7\u1BEA-\u1BEC\u1BEE\u1BF2\u1BF3\u1BFC-\u1C2B\u1C34\u1C35\u1C3B-\u1C49\u1C4D-\u1C88\u1C90-\u1CBA\u1CBD-\u1CC7\u1CD3\u1CE1\u1CE9-\u1CEC\u1CEE-\u1CF3\u1CF5-\u1CF7\u1CFA\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200E\u2070\u2071\u2074-\u2079\u207F-\u2089\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u214F\u2160-\u2188\u2336-\u237A\u2395\u2488-\u24E9\u26AC\u2800-\u28FF\u2C00-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D70\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u302E\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312F\u3131-\u318E\u3190-\u31BF\u31F0-\u321C\u3220-\u324F\u3260-\u327B\u327F-\u32B0\u32C0-\u32CB\u32D0-\u3376\u337B-\u33DD\u33E0-\u33FE\u3400-\u4DBF\u4E00-\uA48C\uA4D0-\uA60C\uA610-\uA62B\uA640-\uA66E\uA680-\uA69D\uA6A0-\uA6EF\uA6F2-\uA6F7\uA722-\uA787\uA789-\uA7CA\uA7D0\uA7D1\uA7D3\uA7D5-\uA7D9\uA7F2-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA824\uA827\uA830-\uA837\uA840-\uA873\uA880-\uA8C3\uA8CE-\uA8D9\uA8F2-\uA8FE\uA900-\uA925\uA92E-\uA946\uA952\uA953\uA95F-\uA97C\uA983-\uA9B2\uA9B4\uA9B5\uA9BA\uA9BB\uA9BE-\uA9CD\uA9CF-\uA9D9\uA9DE-\uA9E4\uA9E6-\uA9FE\uAA00-\uAA28\uAA2F\uAA30\uAA33\uAA34\uAA40-\uAA42\uAA44-\uAA4B\uAA4D\uAA50-\uAA59\uAA5C-\uAA7B\uAA7D-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAAEB\uAAEE-\uAAF5\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB69\uAB70-\uABE4\uABE6\uABE7\uABE9-\uABEC\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uD800-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC\u{10000}-\u{1000B}\u{1000D}-\u{10026}\u{10028}-\u{1003A}\u{1003C}\u{1003D}\u{1003F}-\u{1004D}\u{10050}-\u{1005D}\u{10080}-\u{100FA}\u{10100}\u{10102}\u{10107}-\u{10133}\u{10137}-\u{1013F}\u{1018D}\u{1018E}\u{101D0}-\u{101FC}\u{10280}-\u{1029C}\u{102A0}-\u{102D0}\u{102E1}-\u{102FB}\u{10300}-\u{10323}\u{1032D}-\u{1034A}\u{10350}-\u{10375}\u{10380}-\u{1039D}\u{1039F}-\u{103C3}\u{103C8}-\u{103D5}\u{10400}-\u{1049D}\u{104A0}-\u{104A9}\u{104B0}-\u{104D3}\u{104D8}-\u{104FB}\u{10500}-\u{10527}\u{10530}-\u{10563}\u{1056F}-\u{1057A}\u{1057C}-\u{1058A}\u{1058C}-\u{10592}\u{10594}\u{10595}\u{10597}-\u{105A1}\u{105A3}-\u{105B1}\u{105B3}-\u{105B9}\u{105BB}\u{105BC}\u{10600}-\u{10736}\u{10740}-\u{10755}\u{10760}-\u{10767}\u{10780}-\u{10785}\u{10787}-\u{107B0}\u{107B2}-\u{107BA}\u{11000}\u{11002}-\u{11037}\u{11047}-\u{1104D}\u{11066}-\u{1106F}\u{11071}\u{11072}\u{11075}\u{11082}-\u{110B2}\u{110B7}\u{110B8}\u{110BB}-\u{110C1}\u{110CD}\u{110D0}-\u{110E8}\u{110F0}-\u{110F9}\u{11103}-\u{11126}\u{1112C}\u{11136}-\u{11147}\u{11150}-\u{11172}\u{11174}-\u{11176}\u{11182}-\u{111B5}\u{111BF}-\u{111C8}\u{111CD}\u{111CE}\u{111D0}-\u{111DF}\u{111E1}-\u{111F4}\u{11200}-\u{11211}\u{11213}-\u{1122E}\u{11232}\u{11233}\u{11235}\u{11238}-\u{1123D}\u{1123F}\u{11240}\u{11280}-\u{11286}\u{11288}\u{1128A}-\u{1128D}\u{1128F}-\u{1129D}\u{1129F}-\u{112A9}\u{112B0}-\u{112DE}\u{112E0}-\u{112E2}\u{112F0}-\u{112F9}\u{11302}\u{11303}\u{11305}-\u{1130C}\u{1130F}\u{11310}\u{11313}-\u{11328}\u{1132A}-\u{11330}\u{11332}\u{11333}\u{11335}-\u{11339}\u{1133D}-\u{1133F}\u{11341}-\u{11344}\u{11347}\u{11348}\u{1134B}-\u{1134D}\u{11350}\u{11357}\u{1135D}-\u{11363}\u{11400}-\u{11437}\u{11440}\u{11441}\u{11445}\u{11447}-\u{1145B}\u{1145D}\u{1145F}-\u{11461}\u{11480}-\u{114B2}\u{114B9}\u{114BB}-\u{114BE}\u{114C1}\u{114C4}-\u{114C7}\u{114D0}-\u{114D9}\u{11580}-\u{115B1}\u{115B8}-\u{115BB}\u{115BE}\u{115C1}-\u{115DB}\u{11600}-\u{11632}\u{1163B}\u{1163C}\u{1163E}\u{11641}-\u{11644}\u{11650}-\u{11659}\u{11680}-\u{116AA}\u{116AC}\u{116AE}\u{116AF}\u{116B6}\u{116B8}\u{116B9}\u{116C0}-\u{116C9}\u{11700}-\u{1171A}\u{11720}\u{11721}\u{11726}\u{11730}-\u{11746}\u{11800}-\u{1182E}\u{11838}\u{1183B}\u{118A0}-\u{118F2}\u{118FF}-\u{11906}\u{11909}\u{1190C}-\u{11913}\u{11915}\u{11916}\u{11918}-\u{11935}\u{11937}\u{11938}\u{1193D}\u{1193F}-\u{11942}\u{11944}-\u{11946}\u{11950}-\u{11959}\u{119A0}-\u{119A7}\u{119AA}-\u{119D3}\u{119DC}-\u{119DF}\u{119E1}-\u{119E4}\u{11A00}\u{11A07}\u{11A08}\u{11A0B}-\u{11A32}\u{11A39}\u{11A3A}\u{11A3F}-\u{11A46}\u{11A50}\u{11A57}\u{11A58}\u{11A5C}-\u{11A89}\u{11A97}\u{11A9A}-\u{11AA2}\u{11AB0}-\u{11AF8}\u{11B00}-\u{11B09}\u{11C00}-\u{11C08}\u{11C0A}-\u{11C2F}\u{11C3E}-\u{11C45}\u{11C50}-\u{11C6C}\u{11C70}-\u{11C8F}\u{11CA9}\u{11CB1}\u{11CB4}\u{11D00}-\u{11D06}\u{11D08}\u{11D09}\u{11D0B}-\u{11D30}\u{11D46}\u{11D50}-\u{11D59}\u{11D60}-\u{11D65}\u{11D67}\u{11D68}\u{11D6A}-\u{11D8E}\u{11D93}\u{11D94}\u{11D96}\u{11D98}\u{11DA0}-\u{11DA9}\u{11EE0}-\u{11EF2}\u{11EF5}-\u{11EF8}\u{11F02}-\u{11F10}\u{11F12}-\u{11F35}\u{11F3E}\u{11F3F}\u{11F41}\u{11F43}-\u{11F59}\u{11FB0}\u{11FC0}-\u{11FD4}\u{11FFF}-\u{12399}\u{12400}-\u{1246E}\u{12470}-\u{12474}\u{12480}-\u{12543}\u{12F90}-\u{12FF2}\u{13000}-\u{1343F}\u{13441}-\u{13446}\u{14400}-\u{14646}\u{16800}-\u{16A38}\u{16A40}-\u{16A5E}\u{16A60}-\u{16A69}\u{16A6E}-\u{16ABE}\u{16AC0}-\u{16AC9}\u{16AD0}-\u{16AED}\u{16AF5}\u{16B00}-\u{16B2F}\u{16B37}-\u{16B45}\u{16B50}-\u{16B59}\u{16B5B}-\u{16B61}\u{16B63}-\u{16B77}\u{16B7D}-\u{16B8F}\u{16E40}-\u{16E9A}\u{16F00}-\u{16F4A}\u{16F50}-\u{16F87}\u{16F93}-\u{16F9F}\u{16FE0}\u{16FE1}\u{16FE3}\u{16FF0}\u{16FF1}\u{17000}-\u{187F7}\u{18800}-\u{18CD5}\u{18D00}-\u{18D08}\u{1AFF0}-\u{1AFF3}\u{1AFF5}-\u{1AFFB}\u{1AFFD}\u{1AFFE}\u{1B000}-\u{1B122}\u{1B132}\u{1B150}-\u{1B152}\u{1B155}\u{1B164}-\u{1B167}\u{1B170}-\u{1B2FB}\u{1BC00}-\u{1BC6A}\u{1BC70}-\u{1BC7C}\u{1BC80}-\u{1BC88}\u{1BC90}-\u{1BC99}\u{1BC9C}\u{1BC9F}\u{1CF50}-\u{1CFC3}\u{1D000}-\u{1D0F5}\u{1D100}-\u{1D126}\u{1D129}-\u{1D166}\u{1D16A}-\u{1D172}\u{1D183}\u{1D184}\u{1D18C}-\u{1D1A9}\u{1D1AE}-\u{1D1E8}\u{1D2C0}-\u{1D2D3}\u{1D2E0}-\u{1D2F3}\u{1D360}-\u{1D378}\u{1D400}-\u{1D454}\u{1D456}-\u{1D49C}\u{1D49E}\u{1D49F}\u{1D4A2}\u{1D4A5}\u{1D4A6}\u{1D4A9}-\u{1D4AC}\u{1D4AE}-\u{1D4B9}\u{1D4BB}\u{1D4BD}-\u{1D4C3}\u{1D4C5}-\u{1D505}\u{1D507}-\u{1D50A}\u{1D50D}-\u{1D514}\u{1D516}-\u{1D51C}\u{1D51E}-\u{1D539}\u{1D53B}-\u{1D53E}\u{1D540}-\u{1D544}\u{1D546}\u{1D54A}-\u{1D550}\u{1D552}-\u{1D6A5}\u{1D6A8}-\u{1D6DA}\u{1D6DC}-\u{1D714}\u{1D716}-\u{1D74E}\u{1D750}-\u{1D788}\u{1D78A}-\u{1D7C2}\u{1D7C4}-\u{1D7CB}\u{1D7CE}-\u{1D9FF}\u{1DA37}-\u{1DA3A}\u{1DA6D}-\u{1DA74}\u{1DA76}-\u{1DA83}\u{1DA85}-\u{1DA8B}\u{1DF00}-\u{1DF1E}\u{1DF25}-\u{1DF2A}\u{1E030}-\u{1E06D}\u{1E100}-\u{1E12C}\u{1E137}-\u{1E13D}\u{1E140}-\u{1E149}\u{1E14E}\u{1E14F}\u{1E290}-\u{1E2AD}\u{1E2C0}-\u{1E2EB}\u{1E2F0}-\u{1E2F9}\u{1E4D0}-\u{1E4EB}\u{1E4F0}-\u{1E4F9}\u{1E7E0}-\u{1E7E6}\u{1E7E8}-\u{1E7EB}\u{1E7ED}\u{1E7EE}\u{1E7F0}-\u{1E7FE}\u{1F100}-\u{1F10A}\u{1F110}-\u{1F12E}\u{1F130}-\u{1F169}\u{1F170}-\u{1F1AC}\u{1F1E6}-\u{1F202}\u{1F210}-\u{1F23B}\u{1F240}-\u{1F248}\u{1F250}\u{1F251}\u{1FBF0}-\u{1FBF9}\u{20000}-\u{2A6DF}\u{2A700}-\u{2B739}\u{2B740}-\u{2B81D}\u{2B820}-\u{2CEA1}\u{2CEB0}-\u{2EBE0}\u{2EBF0}-\u{2EE5D}\u{2F800}-\u{2FA1D}\u{30000}-\u{3134A}\u{31350}-\u{323AF}\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}][\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u0898-\u089F\u08CA-\u08E1\u08E3-\u0902\u093A\u093C\u0941-\u0948\u094D\u0951-\u0957\u0962\u0963\u0981\u09BC\u09C1-\u09C4\u09CD\u09E2\u09E3\u09FE\u0A01\u0A02\u0A3C\u0A41\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81\u0A82\u0ABC\u0AC1-\u0AC5\u0AC7\u0AC8\u0ACD\u0AE2\u0AE3\u0AFA-\u0AFF\u0B01\u0B3C\u0B3F\u0B41-\u0B44\u0B4D\u0B55\u0B56\u0B62\u0B63\u0B82\u0BC0\u0BCD\u0C00\u0C04\u0C3C\u0C3E-\u0C40\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81\u0CBC\u0CCC\u0CCD\u0CE2\u0CE3\u0D00\u0D01\u0D3B\u0D3C\u0D41-\u0D44\u0D4D\u0D62\u0D63\u0D81\u0DCA\u0DD2-\u0DD4\u0DD6\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECE\u0F18\u0F19\u0F35\u0F37\u0F39\u0F71-\u0F7E\u0F80-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102D-\u1030\u1032-\u1037\u1039\u103A\u103D\u103E\u1058\u1059\u105E-\u1060\u1071-\u1074\u1082\u1085\u1086\u108D\u109D\u135D-\u135F\u1712-\u1714\u1732\u1733\u1752\u1753\u1772\u1773\u17B4\u17B5\u17B7-\u17BD\u17C6\u17C9-\u17D3\u17DD\u180B-\u180D\u180F\u1885\u1886\u18A9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193B\u1A17\u1A18\u1A1B\u1A56\u1A58-\u1A5E\u1A60\u1A62\u1A65-\u1A6C\u1A73-\u1A7C\u1A7F\u1AB0-\u1ACE\u1B00-\u1B03\u1B34\u1B36-\u1B3A\u1B3C\u1B42\u1B6B-\u1B73\u1B80\u1B81\u1BA2-\u1BA5\u1BA8\u1BA9\u1BAB-\u1BAD\u1BE6\u1BE8\u1BE9\u1BED\u1BEF-\u1BF1\u1C2C-\u1C33\u1C36\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE0\u1CE2-\u1CE8\u1CED\u1CF4\u1CF8\u1CF9\u1DC0-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302D\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA825\uA826\uA82C\uA8C4\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA951\uA980-\uA982\uA9B3\uA9B6-\uA9B9\uA9BC\uA9BD\uA9E5\uAA29-\uAA2E\uAA31\uAA32\uAA35\uAA36\uAA43\uAA4C\uAA7C\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEC\uAAED\uAAF6\uABE5\uABE8\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F\u{101FD}\u{102E0}\u{10376}-\u{1037A}\u{10A01}-\u{10A03}\u{10A05}\u{10A06}\u{10A0C}-\u{10A0F}\u{10A38}-\u{10A3A}\u{10A3F}\u{10AE5}\u{10AE6}\u{10D24}-\u{10D27}\u{10EAB}\u{10EAC}\u{10EFD}-\u{10EFF}\u{10F46}-\u{10F50}\u{10F82}-\u{10F85}\u{11001}\u{11038}-\u{11046}\u{11070}\u{11073}\u{11074}\u{1107F}-\u{11081}\u{110B3}-\u{110B6}\u{110B9}\u{110BA}\u{110C2}\u{11100}-\u{11102}\u{11127}-\u{1112B}\u{1112D}-\u{11134}\u{11173}\u{11180}\u{11181}\u{111B6}-\u{111BE}\u{111C9}-\u{111CC}\u{111CF}\u{1122F}-\u{11231}\u{11234}\u{11236}\u{11237}\u{1123E}\u{11241}\u{112DF}\u{112E3}-\u{112EA}\u{11300}\u{11301}\u{1133B}\u{1133C}\u{11340}\u{11366}-\u{1136C}\u{11370}-\u{11374}\u{11438}-\u{1143F}\u{11442}-\u{11444}\u{11446}\u{1145E}\u{114B3}-\u{114B8}\u{114BA}\u{114BF}\u{114C0}\u{114C2}\u{114C3}\u{115B2}-\u{115B5}\u{115BC}\u{115BD}\u{115BF}\u{115C0}\u{115DC}\u{115DD}\u{11633}-\u{1163A}\u{1163D}\u{1163F}\u{11640}\u{116AB}\u{116AD}\u{116B0}-\u{116B5}\u{116B7}\u{1171D}-\u{1171F}\u{11722}-\u{11725}\u{11727}-\u{1172B}\u{1182F}-\u{11837}\u{11839}\u{1183A}\u{1193B}\u{1193C}\u{1193E}\u{11943}\u{119D4}-\u{119D7}\u{119DA}\u{119DB}\u{119E0}\u{11A01}-\u{11A06}\u{11A09}\u{11A0A}\u{11A33}-\u{11A38}\u{11A3B}-\u{11A3E}\u{11A47}\u{11A51}-\u{11A56}\u{11A59}-\u{11A5B}\u{11A8A}-\u{11A96}\u{11A98}\u{11A99}\u{11C30}-\u{11C36}\u{11C38}-\u{11C3D}\u{11C92}-\u{11CA7}\u{11CAA}-\u{11CB0}\u{11CB2}\u{11CB3}\u{11CB5}\u{11CB6}\u{11D31}-\u{11D36}\u{11D3A}\u{11D3C}\u{11D3D}\u{11D3F}-\u{11D45}\u{11D47}\u{11D90}\u{11D91}\u{11D95}\u{11D97}\u{11EF3}\u{11EF4}\u{11F00}\u{11F01}\u{11F36}-\u{11F3A}\u{11F40}\u{11F42}\u{13440}\u{13447}-\u{13455}\u{16AF0}-\u{16AF4}\u{16B30}-\u{16B36}\u{16F4F}\u{16F8F}-\u{16F92}\u{16FE4}\u{1BC9D}\u{1BC9E}\u{1CF00}-\u{1CF2D}\u{1CF30}-\u{1CF46}\u{1D167}-\u{1D169}\u{1D17B}-\u{1D182}\u{1D185}-\u{1D18B}\u{1D1AA}-\u{1D1AD}\u{1D242}-\u{1D244}\u{1DA00}-\u{1DA36}\u{1DA3B}-\u{1DA6C}\u{1DA75}\u{1DA84}\u{1DA9B}-\u{1DA9F}\u{1DAA1}-\u{1DAAF}\u{1E000}-\u{1E006}\u{1E008}-\u{1E018}\u{1E01B}-\u{1E021}\u{1E023}\u{1E024}\u{1E026}-\u{1E02A}\u{1E08F}\u{1E130}-\u{1E136}\u{1E2AE}\u{1E2EC}-\u{1E2EF}\u{1E4EC}-\u{1E4EF}\u{1E8D0}-\u{1E8D6}\u{1E944}-\u{1E94A}\u{E0100}-\u{E01EF}]*$/u;

module.exports = {
    combiningMarks,
  combiningClassVirama,
  validZWNJ,
  bidiDomain,
  bidiS1LTR,
  bidiS1RTL,
  bidiS2,
  bidiS3,
  bidiS4EN,
  bidiS4AN,
  bidiS5,
  bidiS6
  };

},{}],54:[function(require,module,exports){
"use strict";

module.exports.STATUS_MAPPING = {
  mapped: 1,
  valid: 2,
  disallowed: 3,
  disallowed_STD3_valid: 4,
  disallowed_STD3_mapped: 5,
  deviation: 6,
  ignored: 7
};

},{}],55:[function(require,module,exports){
'use strict';

/** Highest positive signed 32-bit float value */
const maxInt = 2147483647; // aka. 0x7FFFFFFF or 2^31-1

/** Bootstring parameters */
const base = 36;
const tMin = 1;
const tMax = 26;
const skew = 38;
const damp = 700;
const initialBias = 72;
const initialN = 128; // 0x80
const delimiter = '-'; // '\x2D'

/** Regular expressions */
const regexPunycode = /^xn--/;
const regexNonASCII = /[^\0-\x7F]/; // Note: U+007F DEL is excluded too.
const regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g; // RFC 3490 separators

/** Error messages */
const errors = {
	'overflow': 'Overflow: input needs wider integers to process',
	'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
	'invalid-input': 'Invalid input'
};

/** Convenience shortcuts */
const baseMinusTMin = base - tMin;
const floor = Math.floor;
const stringFromCharCode = String.fromCharCode;

/*--------------------------------------------------------------------------*/

/**
 * A generic error utility function.
 * @private
 * @param {String} type The error type.
 * @returns {Error} Throws a `RangeError` with the applicable error message.
 */
function error(type) {
	throw new RangeError(errors[type]);
}

/**
 * A generic `Array#map` utility function.
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} callback The function that gets called for every array
 * item.
 * @returns {Array} A new array of values returned by the callback function.
 */
function map(array, callback) {
	const result = [];
	let length = array.length;
	while (length--) {
		result[length] = callback(array[length]);
	}
	return result;
}

/**
 * A simple `Array#map`-like wrapper to work with domain name strings or email
 * addresses.
 * @private
 * @param {String} domain The domain name or email address.
 * @param {Function} callback The function that gets called for every
 * character.
 * @returns {String} A new string of characters returned by the callback
 * function.
 */
function mapDomain(domain, callback) {
	const parts = domain.split('@');
	let result = '';
	if (parts.length > 1) {
		// In email addresses, only the domain name should be punycoded. Leave
		// the local part (i.e. everything up to `@`) intact.
		result = parts[0] + '@';
		domain = parts[1];
	}
	// Avoid `split(regex)` for IE8 compatibility. See #17.
	domain = domain.replace(regexSeparators, '\x2E');
	const labels = domain.split('.');
	const encoded = map(labels, callback).join('.');
	return result + encoded;
}

/**
 * Creates an array containing the numeric code points of each Unicode
 * character in the string. While JavaScript uses UCS-2 internally,
 * this function will convert a pair of surrogate halves (each of which
 * UCS-2 exposes as separate characters) into a single code point,
 * matching UTF-16.
 * @see `punycode.ucs2.encode`
 * @see <https://mathiasbynens.be/notes/javascript-encoding>
 * @memberOf punycode.ucs2
 * @name decode
 * @param {String} string The Unicode input string (UCS-2).
 * @returns {Array} The new array of code points.
 */
function ucs2decode(string) {
	const output = [];
	let counter = 0;
	const length = string.length;
	while (counter < length) {
		const value = string.charCodeAt(counter++);
		if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
			// It's a high surrogate, and there is a next character.
			const extra = string.charCodeAt(counter++);
			if ((extra & 0xFC00) == 0xDC00) { // Low surrogate.
				output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
			} else {
				// It's an unmatched surrogate; only append this code unit, in case the
				// next code unit is the high surrogate of a surrogate pair.
				output.push(value);
				counter--;
			}
		} else {
			output.push(value);
		}
	}
	return output;
}

/**
 * Creates a string based on an array of numeric code points.
 * @see `punycode.ucs2.decode`
 * @memberOf punycode.ucs2
 * @name encode
 * @param {Array} codePoints The array of numeric code points.
 * @returns {String} The new Unicode string (UCS-2).
 */
const ucs2encode = codePoints => String.fromCodePoint(...codePoints);

/**
 * Converts a basic code point into a digit/integer.
 * @see `digitToBasic()`
 * @private
 * @param {Number} codePoint The basic numeric code point value.
 * @returns {Number} The numeric value of a basic code point (for use in
 * representing integers) in the range `0` to `base - 1`, or `base` if
 * the code point does not represent a value.
 */
const basicToDigit = function(codePoint) {
	if (codePoint >= 0x30 && codePoint < 0x3A) {
		return 26 + (codePoint - 0x30);
	}
	if (codePoint >= 0x41 && codePoint < 0x5B) {
		return codePoint - 0x41;
	}
	if (codePoint >= 0x61 && codePoint < 0x7B) {
		return codePoint - 0x61;
	}
	return base;
};

/**
 * Converts a digit/integer into a basic code point.
 * @see `basicToDigit()`
 * @private
 * @param {Number} digit The numeric value of a basic code point.
 * @returns {Number} The basic code point whose value (when used for
 * representing integers) is `digit`, which needs to be in the range
 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
 * used; else, the lowercase form is used. The behavior is undefined
 * if `flag` is non-zero and `digit` has no uppercase form.
 */
const digitToBasic = function(digit, flag) {
	//  0..25 map to ASCII a..z or A..Z
	// 26..35 map to ASCII 0..9
	return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
};

/**
 * Bias adaptation function as per section 3.4 of RFC 3492.
 * https://tools.ietf.org/html/rfc3492#section-3.4
 * @private
 */
const adapt = function(delta, numPoints, firstTime) {
	let k = 0;
	delta = firstTime ? floor(delta / damp) : delta >> 1;
	delta += floor(delta / numPoints);
	for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
		delta = floor(delta / baseMinusTMin);
	}
	return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
};

/**
 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
 * symbols.
 * @memberOf punycode
 * @param {String} input The Punycode string of ASCII-only symbols.
 * @returns {String} The resulting string of Unicode symbols.
 */
const decode = function(input) {
	// Don't use UCS-2.
	const output = [];
	const inputLength = input.length;
	let i = 0;
	let n = initialN;
	let bias = initialBias;

	// Handle the basic code points: let `basic` be the number of input code
	// points before the last delimiter, or `0` if there is none, then copy
	// the first basic code points to the output.

	let basic = input.lastIndexOf(delimiter);
	if (basic < 0) {
		basic = 0;
	}

	for (let j = 0; j < basic; ++j) {
		// if it's not a basic code point
		if (input.charCodeAt(j) >= 0x80) {
			error('not-basic');
		}
		output.push(input.charCodeAt(j));
	}

	// Main decoding loop: start just after the last delimiter if any basic code
	// points were copied; start at the beginning otherwise.

	for (let index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

		// `index` is the index of the next character to be consumed.
		// Decode a generalized variable-length integer into `delta`,
		// which gets added to `i`. The overflow checking is easier
		// if we increase `i` as we go, then subtract off its starting
		// value at the end to obtain `delta`.
		const oldi = i;
		for (let w = 1, k = base; /* no condition */; k += base) {

			if (index >= inputLength) {
				error('invalid-input');
			}

			const digit = basicToDigit(input.charCodeAt(index++));

			if (digit >= base) {
				error('invalid-input');
			}
			if (digit > floor((maxInt - i) / w)) {
				error('overflow');
			}

			i += digit * w;
			const t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

			if (digit < t) {
				break;
			}

			const baseMinusT = base - t;
			if (w > floor(maxInt / baseMinusT)) {
				error('overflow');
			}

			w *= baseMinusT;

		}

		const out = output.length + 1;
		bias = adapt(i - oldi, out, oldi == 0);

		// `i` was supposed to wrap around from `out` to `0`,
		// incrementing `n` each time, so we'll fix that now:
		if (floor(i / out) > maxInt - n) {
			error('overflow');
		}

		n += floor(i / out);
		i %= out;

		// Insert `n` at position `i` of the output.
		output.splice(i++, 0, n);

	}

	return String.fromCodePoint(...output);
};

/**
 * Converts a string of Unicode symbols (e.g. a domain name label) to a
 * Punycode string of ASCII-only symbols.
 * @memberOf punycode
 * @param {String} input The string of Unicode symbols.
 * @returns {String} The resulting Punycode string of ASCII-only symbols.
 */
const encode = function(input) {
	const output = [];

	// Convert the input in UCS-2 to an array of Unicode code points.
	input = ucs2decode(input);

	// Cache the length.
	const inputLength = input.length;

	// Initialize the state.
	let n = initialN;
	let delta = 0;
	let bias = initialBias;

	// Handle the basic code points.
	for (const currentValue of input) {
		if (currentValue < 0x80) {
			output.push(stringFromCharCode(currentValue));
		}
	}

	const basicLength = output.length;
	let handledCPCount = basicLength;

	// `handledCPCount` is the number of code points that have been handled;
	// `basicLength` is the number of basic code points.

	// Finish the basic string with a delimiter unless it's empty.
	if (basicLength) {
		output.push(delimiter);
	}

	// Main encoding loop:
	while (handledCPCount < inputLength) {

		// All non-basic code points < n have been handled already. Find the next
		// larger one:
		let m = maxInt;
		for (const currentValue of input) {
			if (currentValue >= n && currentValue < m) {
				m = currentValue;
			}
		}

		// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
		// but guard against overflow.
		const handledCPCountPlusOne = handledCPCount + 1;
		if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
			error('overflow');
		}

		delta += (m - n) * handledCPCountPlusOne;
		n = m;

		for (const currentValue of input) {
			if (currentValue < n && ++delta > maxInt) {
				error('overflow');
			}
			if (currentValue === n) {
				// Represent delta as a generalized variable-length integer.
				let q = delta;
				for (let k = base; /* no condition */; k += base) {
					const t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
					if (q < t) {
						break;
					}
					const qMinusT = q - t;
					const baseMinusT = base - t;
					output.push(
						stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
					);
					q = floor(qMinusT / baseMinusT);
				}

				output.push(stringFromCharCode(digitToBasic(q, 0)));
				bias = adapt(delta, handledCPCountPlusOne, handledCPCount === basicLength);
				delta = 0;
				++handledCPCount;
			}
		}

		++delta;
		++n;

	}
	return output.join('');
};

/**
 * Converts a Punycode string representing a domain name or an email address
 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
 * it doesn't matter if you call it on a string that has already been
 * converted to Unicode.
 * @memberOf punycode
 * @param {String} input The Punycoded domain name or email address to
 * convert to Unicode.
 * @returns {String} The Unicode representation of the given Punycode
 * string.
 */
const toUnicode = function(input) {
	return mapDomain(input, function(string) {
		return regexPunycode.test(string)
			? decode(string.slice(4).toLowerCase())
			: string;
	});
};

/**
 * Converts a Unicode string representing a domain name or an email address to
 * Punycode. Only the non-ASCII parts of the domain name will be converted,
 * i.e. it doesn't matter if you call it with a domain that's already in
 * ASCII.
 * @memberOf punycode
 * @param {String} input The domain name or email address to convert, as a
 * Unicode string.
 * @returns {String} The Punycode representation of the given domain name or
 * email address.
 */
const toASCII = function(input) {
	return mapDomain(input, function(string) {
		return regexNonASCII.test(string)
			? 'xn--' + encode(string)
			: string;
	});
};

/*--------------------------------------------------------------------------*/

/** Define the public API */
const punycode = {
	/**
	 * A string representing the current Punycode.js version number.
	 * @memberOf punycode
	 * @type String
	 */
	'version': '2.3.1',
	/**
	 * An object of methods to convert from JavaScript's internal character
	 * representation (UCS-2) to Unicode code points, and back.
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode
	 * @type Object
	 */
	'ucs2': {
		'decode': ucs2decode,
		'encode': ucs2encode
	},
	'decode': decode,
	'encode': encode,
	'toASCII': toASCII,
	'toUnicode': toUnicode
};

module.exports = punycode;

},{}],56:[function(require,module,exports){
'use strict';

/**
 * Checks if a given buffer contains only correct UTF-8.
 * Ported from https://www.cl.cam.ac.uk/%7Emgk25/ucs/utf8_check.c by
 * Markus Kuhn.
 *
 * @param {Buffer} buf The buffer to check
 * @return {Boolean} `true` if `buf` contains only correct UTF-8, else `false`
 * @public
 */
function isValidUTF8(buf) {
  const len = buf.length;
  let i = 0;

  while (i < len) {
    if ((buf[i] & 0x80) === 0x00) {  // 0xxxxxxx
      i++;
    } else if ((buf[i] & 0xe0) === 0xc0) {  // 110xxxxx 10xxxxxx
      if (
        i + 1 === len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i] & 0xfe) === 0xc0  // overlong
      ) {
        return false;
      }

      i += 2;
    } else if ((buf[i] & 0xf0) === 0xe0) {  // 1110xxxx 10xxxxxx 10xxxxxx
      if (
        i + 2 >= len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i + 2] & 0xc0) !== 0x80 ||
        buf[i] === 0xe0 && (buf[i + 1] & 0xe0) === 0x80 ||  // overlong
        buf[i] === 0xed && (buf[i + 1] & 0xe0) === 0xa0  // surrogate (U+D800 - U+DFFF)
      ) {
        return false;
      }

      i += 3;
    } else if ((buf[i] & 0xf8) === 0xf0) {  // 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
      if (
        i + 3 >= len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i + 2] & 0xc0) !== 0x80 ||
        (buf[i + 3] & 0xc0) !== 0x80 ||
        buf[i] === 0xf0 && (buf[i + 1] & 0xf0) === 0x80 ||  // overlong
        buf[i] === 0xf4 && buf[i + 1] > 0x8f || buf[i] > 0xf4  // > U+10FFFF
      ) {
        return false;
      }

      i += 4;
    } else {
      return false;
    }
  }

  return true;
}

module.exports = isValidUTF8;

},{}],57:[function(require,module,exports){
(function (__dirname){(function (){
'use strict';

try {
  module.exports = require('node-gyp-build')(__dirname);
} catch (e) {
  module.exports = require('./fallback');
}

}).call(this)}).call(this,require("path").join(__dirname,"node_modules","utf-8-validate"))
},{"./fallback":56,"node-gyp-build":46,"path":undefined}],58:[function(require,module,exports){
"use strict";

function makeException(ErrorType, message, options) {
  if (options.globals) {
    ErrorType = options.globals[ErrorType.name];
  }
  return new ErrorType(`${options.context ? options.context : "Value"} ${message}.`);
}

function toNumber(value, options) {
  if (typeof value === "bigint") {
    throw makeException(TypeError, "is a BigInt which cannot be converted to a number", options);
  }
  if (!options.globals) {
    return Number(value);
  }
  return options.globals.Number(value);
}

// Round x to the nearest integer, choosing the even integer if it lies halfway between two.
function evenRound(x) {
  // There are four cases for numbers with fractional part being .5:
  //
  // case |     x     | floor(x) | round(x) | expected | x <> 0 | x % 1 | x & 1 |   example
  //   1  |  2n + 0.5 |  2n      |  2n + 1  |  2n      |   >    |  0.5  |   0   |  0.5 ->  0
  //   2  |  2n + 1.5 |  2n + 1  |  2n + 2  |  2n + 2  |   >    |  0.5  |   1   |  1.5 ->  2
  //   3  | -2n - 0.5 | -2n - 1  | -2n      | -2n      |   <    | -0.5  |   0   | -0.5 ->  0
  //   4  | -2n - 1.5 | -2n - 2  | -2n - 1  | -2n - 2  |   <    | -0.5  |   1   | -1.5 -> -2
  // (where n is a non-negative integer)
  //
  // Branch here for cases 1 and 4
  if ((x > 0 && (x % 1) === +0.5 && (x & 1) === 0) ||
        (x < 0 && (x % 1) === -0.5 && (x & 1) === 1)) {
    return censorNegativeZero(Math.floor(x));
  }

  return censorNegativeZero(Math.round(x));
}

function integerPart(n) {
  return censorNegativeZero(Math.trunc(n));
}

function sign(x) {
  return x < 0 ? -1 : 1;
}

function modulo(x, y) {
  // https://tc39.github.io/ecma262/#eqn-modulo
  // Note that http://stackoverflow.com/a/4467559/3191 does NOT work for large modulos
  const signMightNotMatch = x % y;
  if (sign(y) !== sign(signMightNotMatch)) {
    return signMightNotMatch + y;
  }
  return signMightNotMatch;
}

function censorNegativeZero(x) {
  return x === 0 ? 0 : x;
}

function createIntegerConversion(bitLength, { unsigned }) {
  let lowerBound, upperBound;
  if (unsigned) {
    lowerBound = 0;
    upperBound = 2 ** bitLength - 1;
  } else {
    lowerBound = -(2 ** (bitLength - 1));
    upperBound = 2 ** (bitLength - 1) - 1;
  }

  const twoToTheBitLength = 2 ** bitLength;
  const twoToOneLessThanTheBitLength = 2 ** (bitLength - 1);

  return (value, options = {}) => {
    let x = toNumber(value, options);
    x = censorNegativeZero(x);

    if (options.enforceRange) {
      if (!Number.isFinite(x)) {
        throw makeException(TypeError, "is not a finite number", options);
      }

      x = integerPart(x);

      if (x < lowerBound || x > upperBound) {
        throw makeException(
          TypeError,
          `is outside the accepted range of ${lowerBound} to ${upperBound}, inclusive`,
          options
        );
      }

      return x;
    }

    if (!Number.isNaN(x) && options.clamp) {
      x = Math.min(Math.max(x, lowerBound), upperBound);
      x = evenRound(x);
      return x;
    }

    if (!Number.isFinite(x) || x === 0) {
      return 0;
    }
    x = integerPart(x);

    // Math.pow(2, 64) is not accurately representable in JavaScript, so try to avoid these per-spec operations if
    // possible. Hopefully it's an optimization for the non-64-bitLength cases too.
    if (x >= lowerBound && x <= upperBound) {
      return x;
    }

    // These will not work great for bitLength of 64, but oh well. See the README for more details.
    x = modulo(x, twoToTheBitLength);
    if (!unsigned && x >= twoToOneLessThanTheBitLength) {
      return x - twoToTheBitLength;
    }
    return x;
  };
}

function createLongLongConversion(bitLength, { unsigned }) {
  const upperBound = Number.MAX_SAFE_INTEGER;
  const lowerBound = unsigned ? 0 : Number.MIN_SAFE_INTEGER;
  const asBigIntN = unsigned ? BigInt.asUintN : BigInt.asIntN;

  return (value, options = {}) => {
    let x = toNumber(value, options);
    x = censorNegativeZero(x);

    if (options.enforceRange) {
      if (!Number.isFinite(x)) {
        throw makeException(TypeError, "is not a finite number", options);
      }

      x = integerPart(x);

      if (x < lowerBound || x > upperBound) {
        throw makeException(
          TypeError,
          `is outside the accepted range of ${lowerBound} to ${upperBound}, inclusive`,
          options
        );
      }

      return x;
    }

    if (!Number.isNaN(x) && options.clamp) {
      x = Math.min(Math.max(x, lowerBound), upperBound);
      x = evenRound(x);
      return x;
    }

    if (!Number.isFinite(x) || x === 0) {
      return 0;
    }

    let xBigInt = BigInt(integerPart(x));
    xBigInt = asBigIntN(bitLength, xBigInt);
    return Number(xBigInt);
  };
}

exports.any = value => {
  return value;
};

exports.undefined = () => {
  return undefined;
};

exports.boolean = value => {
  return Boolean(value);
};

exports.byte = createIntegerConversion(8, { unsigned: false });
exports.octet = createIntegerConversion(8, { unsigned: true });

exports.short = createIntegerConversion(16, { unsigned: false });
exports["unsigned short"] = createIntegerConversion(16, { unsigned: true });

exports.long = createIntegerConversion(32, { unsigned: false });
exports["unsigned long"] = createIntegerConversion(32, { unsigned: true });

exports["long long"] = createLongLongConversion(64, { unsigned: false });
exports["unsigned long long"] = createLongLongConversion(64, { unsigned: true });

exports.double = (value, options = {}) => {
  const x = toNumber(value, options);

  if (!Number.isFinite(x)) {
    throw makeException(TypeError, "is not a finite floating-point value", options);
  }

  return x;
};

exports["unrestricted double"] = (value, options = {}) => {
  const x = toNumber(value, options);

  return x;
};

exports.float = (value, options = {}) => {
  const x = toNumber(value, options);

  if (!Number.isFinite(x)) {
    throw makeException(TypeError, "is not a finite floating-point value", options);
  }

  if (Object.is(x, -0)) {
    return x;
  }

  const y = Math.fround(x);

  if (!Number.isFinite(y)) {
    throw makeException(TypeError, "is outside the range of a single-precision floating-point value", options);
  }

  return y;
};

exports["unrestricted float"] = (value, options = {}) => {
  const x = toNumber(value, options);

  if (isNaN(x)) {
    return x;
  }

  if (Object.is(x, -0)) {
    return x;
  }

  return Math.fround(x);
};

exports.DOMString = (value, options = {}) => {
  if (options.treatNullAsEmptyString && value === null) {
    return "";
  }

  if (typeof value === "symbol") {
    throw makeException(TypeError, "is a symbol, which cannot be converted to a string", options);
  }

  const StringCtor = options.globals ? options.globals.String : String;
  return StringCtor(value);
};

exports.ByteString = (value, options = {}) => {
  const x = exports.DOMString(value, options);
  let c;
  for (let i = 0; (c = x.codePointAt(i)) !== undefined; ++i) {
    if (c > 255) {
      throw makeException(TypeError, "is not a valid ByteString", options);
    }
  }

  return x;
};

exports.USVString = (value, options = {}) => {
  const S = exports.DOMString(value, options);
  const n = S.length;
  const U = [];
  for (let i = 0; i < n; ++i) {
    const c = S.charCodeAt(i);
    if (c < 0xD800 || c > 0xDFFF) {
      U.push(String.fromCodePoint(c));
    } else if (0xDC00 <= c && c <= 0xDFFF) {
      U.push(String.fromCodePoint(0xFFFD));
    } else if (i === n - 1) {
      U.push(String.fromCodePoint(0xFFFD));
    } else {
      const d = S.charCodeAt(i + 1);
      if (0xDC00 <= d && d <= 0xDFFF) {
        const a = c & 0x3FF;
        const b = d & 0x3FF;
        U.push(String.fromCodePoint((2 << 15) + ((2 << 9) * a) + b));
        ++i;
      } else {
        U.push(String.fromCodePoint(0xFFFD));
      }
    }
  }

  return U.join("");
};

exports.object = (value, options = {}) => {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    throw makeException(TypeError, "is not an object", options);
  }

  return value;
};

const abByteLengthGetter =
    Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength").get;
const sabByteLengthGetter =
    typeof SharedArrayBuffer === "function" ?
      Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "byteLength").get :
      null;

function isNonSharedArrayBuffer(value) {
  try {
    // This will throw on SharedArrayBuffers, but not detached ArrayBuffers.
    // (The spec says it should throw, but the spec conflicts with implementations: https://github.com/tc39/ecma262/issues/678)
    abByteLengthGetter.call(value);

    return true;
  } catch {
    return false;
  }
}

function isSharedArrayBuffer(value) {
  try {
    sabByteLengthGetter.call(value);
    return true;
  } catch {
    return false;
  }
}

function isArrayBufferDetached(value) {
  try {
    // eslint-disable-next-line no-new
    new Uint8Array(value);
    return false;
  } catch {
    return true;
  }
}

exports.ArrayBuffer = (value, options = {}) => {
  if (!isNonSharedArrayBuffer(value)) {
    if (options.allowShared && !isSharedArrayBuffer(value)) {
      throw makeException(TypeError, "is not an ArrayBuffer or SharedArrayBuffer", options);
    }
    throw makeException(TypeError, "is not an ArrayBuffer", options);
  }
  if (isArrayBufferDetached(value)) {
    throw makeException(TypeError, "is a detached ArrayBuffer", options);
  }

  return value;
};

const dvByteLengthGetter =
    Object.getOwnPropertyDescriptor(DataView.prototype, "byteLength").get;
exports.DataView = (value, options = {}) => {
  try {
    dvByteLengthGetter.call(value);
  } catch (e) {
    throw makeException(TypeError, "is not a DataView", options);
  }

  if (!options.allowShared && isSharedArrayBuffer(value.buffer)) {
    throw makeException(TypeError, "is backed by a SharedArrayBuffer, which is not allowed", options);
  }
  if (isArrayBufferDetached(value.buffer)) {
    throw makeException(TypeError, "is backed by a detached ArrayBuffer", options);
  }

  return value;
};

// Returns the unforgeable `TypedArray` constructor name or `undefined`,
// if the `this` value isn't a valid `TypedArray` object.
//
// https://tc39.es/ecma262/#sec-get-%typedarray%.prototype-@@tostringtag
const typedArrayNameGetter = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array).prototype,
  Symbol.toStringTag
).get;
[
  Int8Array,
  Int16Array,
  Int32Array,
  Uint8Array,
  Uint16Array,
  Uint32Array,
  Uint8ClampedArray,
  Float32Array,
  Float64Array
].forEach(func => {
  const { name } = func;
  const article = /^[AEIOU]/u.test(name) ? "an" : "a";
  exports[name] = (value, options = {}) => {
    if (!ArrayBuffer.isView(value) || typedArrayNameGetter.call(value) !== name) {
      throw makeException(TypeError, `is not ${article} ${name} object`, options);
    }
    if (!options.allowShared && isSharedArrayBuffer(value.buffer)) {
      throw makeException(TypeError, "is a view on a SharedArrayBuffer, which is not allowed", options);
    }
    if (isArrayBufferDetached(value.buffer)) {
      throw makeException(TypeError, "is a view on a detached ArrayBuffer", options);
    }

    return value;
  };
});

// Common definitions

exports.ArrayBufferView = (value, options = {}) => {
  if (!ArrayBuffer.isView(value)) {
    throw makeException(TypeError, "is not a view on an ArrayBuffer or SharedArrayBuffer", options);
  }

  if (!options.allowShared && isSharedArrayBuffer(value.buffer)) {
    throw makeException(TypeError, "is a view on a SharedArrayBuffer, which is not allowed", options);
  }

  if (isArrayBufferDetached(value.buffer)) {
    throw makeException(TypeError, "is a view on a detached ArrayBuffer", options);
  }
  return value;
};

exports.BufferSource = (value, options = {}) => {
  if (ArrayBuffer.isView(value)) {
    if (!options.allowShared && isSharedArrayBuffer(value.buffer)) {
      throw makeException(TypeError, "is a view on a SharedArrayBuffer, which is not allowed", options);
    }

    if (isArrayBufferDetached(value.buffer)) {
      throw makeException(TypeError, "is a view on a detached ArrayBuffer", options);
    }
    return value;
  }

  if (!options.allowShared && !isNonSharedArrayBuffer(value)) {
    throw makeException(TypeError, "is not an ArrayBuffer or a view on one", options);
  }
  if (options.allowShared && !isSharedArrayBuffer(value) && !isNonSharedArrayBuffer(value)) {
    throw makeException(TypeError, "is not an ArrayBuffer, SharedArrayBuffer, or a view on one", options);
  }
  if (isArrayBufferDetached(value)) {
    throw makeException(TypeError, "is a detached ArrayBuffer", options);
  }

  return value;
};

exports.DOMTimeStamp = exports["unsigned long long"];

},{}],59:[function(require,module,exports){
"use strict";

const { URL, URLSearchParams } = require("./webidl2js-wrapper");
const urlStateMachine = require("./lib/url-state-machine");
const percentEncoding = require("./lib/percent-encoding");

const sharedGlobalObject = { Array, Object, Promise, String, TypeError };
URL.install(sharedGlobalObject, ["Window"]);
URLSearchParams.install(sharedGlobalObject, ["Window"]);

exports.URL = sharedGlobalObject.URL;
exports.URLSearchParams = sharedGlobalObject.URLSearchParams;

exports.parseURL = urlStateMachine.parseURL;
exports.basicURLParse = urlStateMachine.basicURLParse;
exports.serializeURL = urlStateMachine.serializeURL;
exports.serializePath = urlStateMachine.serializePath;
exports.serializeHost = urlStateMachine.serializeHost;
exports.serializeInteger = urlStateMachine.serializeInteger;
exports.serializeURLOrigin = urlStateMachine.serializeURLOrigin;
exports.setTheUsername = urlStateMachine.setTheUsername;
exports.setThePassword = urlStateMachine.setThePassword;
exports.cannotHaveAUsernamePasswordPort = urlStateMachine.cannotHaveAUsernamePasswordPort;
exports.hasAnOpaquePath = urlStateMachine.hasAnOpaquePath;

exports.percentDecodeString = percentEncoding.percentDecodeString;
exports.percentDecodeBytes = percentEncoding.percentDecodeBytes;

},{"./lib/percent-encoding":67,"./lib/url-state-machine":68,"./webidl2js-wrapper":71}],60:[function(require,module,exports){
"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

exports.convert = (globalObject, value, { context = "The provided value" } = {}) => {
  if (typeof value !== "function") {
    throw new globalObject.TypeError(context + " is not a function");
  }

  function invokeTheCallbackFunction(...args) {
    const thisArg = utils.tryWrapperForImpl(this);
    let callResult;

    for (let i = 0; i < args.length; i++) {
      args[i] = utils.tryWrapperForImpl(args[i]);
    }

    callResult = Reflect.apply(value, thisArg, args);

    callResult = conversions["any"](callResult, { context: context, globals: globalObject });

    return callResult;
  }

  invokeTheCallbackFunction.construct = (...args) => {
    for (let i = 0; i < args.length; i++) {
      args[i] = utils.tryWrapperForImpl(args[i]);
    }

    let callResult = Reflect.construct(value, args);

    callResult = conversions["any"](callResult, { context: context, globals: globalObject });

    return callResult;
  };

  invokeTheCallbackFunction[utils.wrapperSymbol] = value;
  invokeTheCallbackFunction.objectReference = value;

  return invokeTheCallbackFunction;
};

},{"./utils.js":70,"webidl-conversions":58}],61:[function(require,module,exports){
"use strict";
const usm = require("./url-state-machine");
const urlencoded = require("./urlencoded");
const URLSearchParams = require("./URLSearchParams");

exports.implementation = class URLImpl {
  // Unlike the spec, we duplicate some code between the constructor and canParse, because we want to give useful error
  // messages in the constructor that distinguish between the different causes of failure.
  constructor(globalObject, constructorArgs) {
    const url = constructorArgs[0];
    const base = constructorArgs[1];

    let parsedBase = null;
    if (base !== undefined) {
      parsedBase = usm.basicURLParse(base);
      if (parsedBase === null) {
        throw new TypeError(`Invalid base URL: ${base}`);
      }
    }

    const parsedURL = usm.basicURLParse(url, { baseURL: parsedBase });
    if (parsedURL === null) {
      throw new TypeError(`Invalid URL: ${url}`);
    }

    const query = parsedURL.query !== null ? parsedURL.query : "";

    this._url = parsedURL;

    // We cannot invoke the "new URLSearchParams object" algorithm without going through the constructor, which strips
    // question mark by default. Therefore the doNotStripQMark hack is used.
    this._query = URLSearchParams.createImpl(globalObject, [query], { doNotStripQMark: true });
    this._query._url = this;
  }

  static canParse(url, base) {
    let parsedBase = null;
    if (base !== undefined) {
      parsedBase = usm.basicURLParse(base);
      if (parsedBase === null) {
        return false;
      }
    }

    const parsedURL = usm.basicURLParse(url, { baseURL: parsedBase });
    if (parsedURL === null) {
      return false;
    }

    return true;
  }

  get href() {
    return usm.serializeURL(this._url);
  }

  set href(v) {
    const parsedURL = usm.basicURLParse(v);
    if (parsedURL === null) {
      throw new TypeError(`Invalid URL: ${v}`);
    }

    this._url = parsedURL;

    this._query._list.splice(0);
    const { query } = parsedURL;
    if (query !== null) {
      this._query._list = urlencoded.parseUrlencodedString(query);
    }
  }

  get origin() {
    return usm.serializeURLOrigin(this._url);
  }

  get protocol() {
    return `${this._url.scheme}:`;
  }

  set protocol(v) {
    usm.basicURLParse(`${v}:`, { url: this._url, stateOverride: "scheme start" });
  }

  get username() {
    return this._url.username;
  }

  set username(v) {
    if (usm.cannotHaveAUsernamePasswordPort(this._url)) {
      return;
    }

    usm.setTheUsername(this._url, v);
  }

  get password() {
    return this._url.password;
  }

  set password(v) {
    if (usm.cannotHaveAUsernamePasswordPort(this._url)) {
      return;
    }

    usm.setThePassword(this._url, v);
  }

  get host() {
    const url = this._url;

    if (url.host === null) {
      return "";
    }

    if (url.port === null) {
      return usm.serializeHost(url.host);
    }

    return `${usm.serializeHost(url.host)}:${usm.serializeInteger(url.port)}`;
  }

  set host(v) {
    if (usm.hasAnOpaquePath(this._url)) {
      return;
    }

    usm.basicURLParse(v, { url: this._url, stateOverride: "host" });
  }

  get hostname() {
    if (this._url.host === null) {
      return "";
    }

    return usm.serializeHost(this._url.host);
  }

  set hostname(v) {
    if (usm.hasAnOpaquePath(this._url)) {
      return;
    }

    usm.basicURLParse(v, { url: this._url, stateOverride: "hostname" });
  }

  get port() {
    if (this._url.port === null) {
      return "";
    }

    return usm.serializeInteger(this._url.port);
  }

  set port(v) {
    if (usm.cannotHaveAUsernamePasswordPort(this._url)) {
      return;
    }

    if (v === "") {
      this._url.port = null;
    } else {
      usm.basicURLParse(v, { url: this._url, stateOverride: "port" });
    }
  }

  get pathname() {
    return usm.serializePath(this._url);
  }

  set pathname(v) {
    if (usm.hasAnOpaquePath(this._url)) {
      return;
    }

    this._url.path = [];
    usm.basicURLParse(v, { url: this._url, stateOverride: "path start" });
  }

  get search() {
    if (this._url.query === null || this._url.query === "") {
      return "";
    }

    return `?${this._url.query}`;
  }

  set search(v) {
    const url = this._url;

    if (v === "") {
      url.query = null;
      this._query._list = [];
      this._potentiallyStripTrailingSpacesFromAnOpaquePath();
      return;
    }

    const input = v[0] === "?" ? v.substring(1) : v;
    url.query = "";
    usm.basicURLParse(input, { url, stateOverride: "query" });
    this._query._list = urlencoded.parseUrlencodedString(input);
  }

  get searchParams() {
    return this._query;
  }

  get hash() {
    if (this._url.fragment === null || this._url.fragment === "") {
      return "";
    }

    return `#${this._url.fragment}`;
  }

  set hash(v) {
    if (v === "") {
      this._url.fragment = null;
      this._potentiallyStripTrailingSpacesFromAnOpaquePath();
      return;
    }

    const input = v[0] === "#" ? v.substring(1) : v;
    this._url.fragment = "";
    usm.basicURLParse(input, { url: this._url, stateOverride: "fragment" });
  }

  toJSON() {
    return this.href;
  }

  _potentiallyStripTrailingSpacesFromAnOpaquePath() {
    if (!usm.hasAnOpaquePath(this._url)) {
      return;
    }

    if (this._url.fragment !== null) {
      return;
    }

    if (this._url.query !== null) {
      return;
    }

    this._url.path = this._url.path.replace(/\u0020+$/u, "");
  }
};

},{"./URLSearchParams":64,"./url-state-machine":68,"./urlencoded":69}],62:[function(require,module,exports){
"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const implSymbol = utils.implSymbol;
const ctorRegistrySymbol = utils.ctorRegistrySymbol;

const interfaceName = "URL";

exports.is = value => {
  return utils.isObject(value) && utils.hasOwn(value, implSymbol) && value[implSymbol] instanceof Impl.implementation;
};
exports.isImpl = value => {
  return utils.isObject(value) && value instanceof Impl.implementation;
};
exports.convert = (globalObject, value, { context = "The provided value" } = {}) => {
  if (exports.is(value)) {
    return utils.implForWrapper(value);
  }
  throw new globalObject.TypeError(`${context} is not of type 'URL'.`);
};

function makeWrapper(globalObject, newTarget) {
  let proto;
  if (newTarget !== undefined) {
    proto = newTarget.prototype;
  }

  if (!utils.isObject(proto)) {
    proto = globalObject[ctorRegistrySymbol]["URL"].prototype;
  }

  return Object.create(proto);
}

exports.create = (globalObject, constructorArgs, privateData) => {
  const wrapper = makeWrapper(globalObject);
  return exports.setup(wrapper, globalObject, constructorArgs, privateData);
};

exports.createImpl = (globalObject, constructorArgs, privateData) => {
  const wrapper = exports.create(globalObject, constructorArgs, privateData);
  return utils.implForWrapper(wrapper);
};

exports._internalSetup = (wrapper, globalObject) => {};

exports.setup = (wrapper, globalObject, constructorArgs = [], privateData = {}) => {
  privateData.wrapper = wrapper;

  exports._internalSetup(wrapper, globalObject);
  Object.defineProperty(wrapper, implSymbol, {
    value: new Impl.implementation(globalObject, constructorArgs, privateData),
    configurable: true
  });

  wrapper[implSymbol][utils.wrapperSymbol] = wrapper;
  if (Impl.init) {
    Impl.init(wrapper[implSymbol]);
  }
  return wrapper;
};

exports.new = (globalObject, newTarget) => {
  const wrapper = makeWrapper(globalObject, newTarget);

  exports._internalSetup(wrapper, globalObject);
  Object.defineProperty(wrapper, implSymbol, {
    value: Object.create(Impl.implementation.prototype),
    configurable: true
  });

  wrapper[implSymbol][utils.wrapperSymbol] = wrapper;
  if (Impl.init) {
    Impl.init(wrapper[implSymbol]);
  }
  return wrapper[implSymbol];
};

const exposed = new Set(["Window", "Worker"]);

exports.install = (globalObject, globalNames) => {
  if (!globalNames.some(globalName => exposed.has(globalName))) {
    return;
  }

  const ctorRegistry = utils.initCtorRegistry(globalObject);
  class URL {
    constructor(url) {
      if (arguments.length < 1) {
        throw new globalObject.TypeError(
          `Failed to construct 'URL': 1 argument required, but only ${arguments.length} present.`
        );
      }
      const args = [];
      {
        let curArg = arguments[0];
        curArg = conversions["USVString"](curArg, {
          context: "Failed to construct 'URL': parameter 1",
          globals: globalObject
        });
        args.push(curArg);
      }
      {
        let curArg = arguments[1];
        if (curArg !== undefined) {
          curArg = conversions["USVString"](curArg, {
            context: "Failed to construct 'URL': parameter 2",
            globals: globalObject
          });
        }
        args.push(curArg);
      }
      return exports.setup(Object.create(new.target.prototype), globalObject, args);
    }

    toJSON() {
      const esValue = this !== null && this !== undefined ? this : globalObject;
      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'toJSON' called on an object that is not a valid instance of URL.");
      }

      return esValue[implSymbol].toJSON();
    }

    get href() {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'get href' called on an object that is not a valid instance of URL.");
      }

      return esValue[implSymbol]["href"];
    }

    set href(V) {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'set href' called on an object that is not a valid instance of URL.");
      }

      V = conversions["USVString"](V, {
        context: "Failed to set the 'href' property on 'URL': The provided value",
        globals: globalObject
      });

      esValue[implSymbol]["href"] = V;
    }

    toString() {
      const esValue = this;
      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'toString' called on an object that is not a valid instance of URL.");
      }

      return esValue[implSymbol]["href"];
    }

    get origin() {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'get origin' called on an object that is not a valid instance of URL.");
      }

      return esValue[implSymbol]["origin"];
    }

    get protocol() {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'get protocol' called on an object that is not a valid instance of URL.");
      }

      return esValue[implSymbol]["protocol"];
    }

    set protocol(V) {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'set protocol' called on an object that is not a valid instance of URL.");
      }

      V = conversions["USVString"](V, {
        context: "Failed to set the 'protocol' property on 'URL': The provided value",
        globals: globalObject
      });

      esValue[implSymbol]["protocol"] = V;
    }

    get username() {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'get username' called on an object that is not a valid instance of URL.");
      }

      return esValue[implSymbol]["username"];
    }

    set username(V) {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'set username' called on an object that is not a valid instance of URL.");
      }

      V = conversions["USVString"](V, {
        context: "Failed to set the 'username' property on 'URL': The provided value",
        globals: globalObject
      });

      esValue[implSymbol]["username"] = V;
    }

    get password() {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'get password' called on an object that is not a valid instance of URL.");
      }

      return esValue[implSymbol]["password"];
    }

    set password(V) {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'set password' called on an object that is not a valid instance of URL.");
      }

      V = conversions["USVString"](V, {
        context: "Failed to set the 'password' property on 'URL': The provided value",
        globals: globalObject
      });

      esValue[implSymbol]["password"] = V;
    }

    get host() {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'get host' called on an object that is not a valid instance of URL.");
      }

      return esValue[implSymbol]["host"];
    }

    set host(V) {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'set host' called on an object that is not a valid instance of URL.");
      }

      V = conversions["USVString"](V, {
        context: "Failed to set the 'host' property on 'URL': The provided value",
        globals: globalObject
      });

      esValue[implSymbol]["host"] = V;
    }

    get hostname() {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'get hostname' called on an object that is not a valid instance of URL.");
      }

      return esValue[implSymbol]["hostname"];
    }

    set hostname(V) {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'set hostname' called on an object that is not a valid instance of URL.");
      }

      V = conversions["USVString"](V, {
        context: "Failed to set the 'hostname' property on 'URL': The provided value",
        globals: globalObject
      });

      esValue[implSymbol]["hostname"] = V;
    }

    get port() {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'get port' called on an object that is not a valid instance of URL.");
      }

      return esValue[implSymbol]["port"];
    }

    set port(V) {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'set port' called on an object that is not a valid instance of URL.");
      }

      V = conversions["USVString"](V, {
        context: "Failed to set the 'port' property on 'URL': The provided value",
        globals: globalObject
      });

      esValue[implSymbol]["port"] = V;
    }

    get pathname() {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'get pathname' called on an object that is not a valid instance of URL.");
      }

      return esValue[implSymbol]["pathname"];
    }

    set pathname(V) {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'set pathname' called on an object that is not a valid instance of URL.");
      }

      V = conversions["USVString"](V, {
        context: "Failed to set the 'pathname' property on 'URL': The provided value",
        globals: globalObject
      });

      esValue[implSymbol]["pathname"] = V;
    }

    get search() {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'get search' called on an object that is not a valid instance of URL.");
      }

      return esValue[implSymbol]["search"];
    }

    set search(V) {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'set search' called on an object that is not a valid instance of URL.");
      }

      V = conversions["USVString"](V, {
        context: "Failed to set the 'search' property on 'URL': The provided value",
        globals: globalObject
      });

      esValue[implSymbol]["search"] = V;
    }

    get searchParams() {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'get searchParams' called on an object that is not a valid instance of URL.");
      }

      return utils.getSameObject(this, "searchParams", () => {
        return utils.tryWrapperForImpl(esValue[implSymbol]["searchParams"]);
      });
    }

    get hash() {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'get hash' called on an object that is not a valid instance of URL.");
      }

      return esValue[implSymbol]["hash"];
    }

    set hash(V) {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'set hash' called on an object that is not a valid instance of URL.");
      }

      V = conversions["USVString"](V, {
        context: "Failed to set the 'hash' property on 'URL': The provided value",
        globals: globalObject
      });

      esValue[implSymbol]["hash"] = V;
    }

    static canParse(url) {
      if (arguments.length < 1) {
        throw new globalObject.TypeError(
          `Failed to execute 'canParse' on 'URL': 1 argument required, but only ${arguments.length} present.`
        );
      }
      const args = [];
      {
        let curArg = arguments[0];
        curArg = conversions["USVString"](curArg, {
          context: "Failed to execute 'canParse' on 'URL': parameter 1",
          globals: globalObject
        });
        args.push(curArg);
      }
      {
        let curArg = arguments[1];
        if (curArg !== undefined) {
          curArg = conversions["USVString"](curArg, {
            context: "Failed to execute 'canParse' on 'URL': parameter 2",
            globals: globalObject
          });
        }
        args.push(curArg);
      }
      return Impl.implementation.canParse(...args);
    }
  }
  Object.defineProperties(URL.prototype, {
    toJSON: { enumerable: true },
    href: { enumerable: true },
    toString: { enumerable: true },
    origin: { enumerable: true },
    protocol: { enumerable: true },
    username: { enumerable: true },
    password: { enumerable: true },
    host: { enumerable: true },
    hostname: { enumerable: true },
    port: { enumerable: true },
    pathname: { enumerable: true },
    search: { enumerable: true },
    searchParams: { enumerable: true },
    hash: { enumerable: true },
    [Symbol.toStringTag]: { value: "URL", configurable: true }
  });
  Object.defineProperties(URL, { canParse: { enumerable: true } });
  ctorRegistry[interfaceName] = URL;

  Object.defineProperty(globalObject, interfaceName, {
    configurable: true,
    writable: true,
    value: URL
  });

  if (globalNames.includes("Window")) {
    Object.defineProperty(globalObject, "webkitURL", {
      configurable: true,
      writable: true,
      value: URL
    });
  }
};

const Impl = require("./URL-impl.js");

},{"./URL-impl.js":61,"./utils.js":70,"webidl-conversions":58}],63:[function(require,module,exports){
"use strict";
const urlencoded = require("./urlencoded");

exports.implementation = class URLSearchParamsImpl {
  constructor(globalObject, constructorArgs, { doNotStripQMark = false }) {
    let init = constructorArgs[0];
    this._list = [];
    this._url = null;

    if (!doNotStripQMark && typeof init === "string" && init[0] === "?") {
      init = init.slice(1);
    }

    if (Array.isArray(init)) {
      for (const pair of init) {
        if (pair.length !== 2) {
          throw new TypeError("Failed to construct 'URLSearchParams': parameter 1 sequence's element does not " +
                              "contain exactly two elements.");
        }
        this._list.push([pair[0], pair[1]]);
      }
    } else if (typeof init === "object" && Object.getPrototypeOf(init) === null) {
      for (const name of Object.keys(init)) {
        const value = init[name];
        this._list.push([name, value]);
      }
    } else {
      this._list = urlencoded.parseUrlencodedString(init);
    }
  }

  _updateSteps() {
    if (this._url !== null) {
      let serializedQuery = urlencoded.serializeUrlencoded(this._list);
      if (serializedQuery === "") {
        serializedQuery = null;
      }

      this._url._url.query = serializedQuery;

      if (serializedQuery === null) {
        this._url._potentiallyStripTrailingSpacesFromAnOpaquePath();
      }
    }
  }

  get size() {
    return this._list.length;
  }

  append(name, value) {
    this._list.push([name, value]);
    this._updateSteps();
  }

  delete(name, value) {
    let i = 0;
    while (i < this._list.length) {
      if (this._list[i][0] === name && (value === undefined || this._list[i][1] === value)) {
        this._list.splice(i, 1);
      } else {
        i++;
      }
    }
    this._updateSteps();
  }

  get(name) {
    for (const tuple of this._list) {
      if (tuple[0] === name) {
        return tuple[1];
      }
    }
    return null;
  }

  getAll(name) {
    const output = [];
    for (const tuple of this._list) {
      if (tuple[0] === name) {
        output.push(tuple[1]);
      }
    }
    return output;
  }

  has(name, value) {
    for (const tuple of this._list) {
      if (tuple[0] === name && (value === undefined || tuple[1] === value)) {
        return true;
      }
    }
    return false;
  }

  set(name, value) {
    let found = false;
    let i = 0;
    while (i < this._list.length) {
      if (this._list[i][0] === name) {
        if (found) {
          this._list.splice(i, 1);
        } else {
          found = true;
          this._list[i][1] = value;
          i++;
        }
      } else {
        i++;
      }
    }
    if (!found) {
      this._list.push([name, value]);
    }
    this._updateSteps();
  }

  sort() {
    this._list.sort((a, b) => {
      if (a[0] < b[0]) {
        return -1;
      }
      if (a[0] > b[0]) {
        return 1;
      }
      return 0;
    });

    this._updateSteps();
  }

  [Symbol.iterator]() {
    return this._list[Symbol.iterator]();
  }

  toString() {
    return urlencoded.serializeUrlencoded(this._list);
  }
};

},{"./urlencoded":69}],64:[function(require,module,exports){
"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const Function = require("./Function.js");
const newObjectInRealm = utils.newObjectInRealm;
const implSymbol = utils.implSymbol;
const ctorRegistrySymbol = utils.ctorRegistrySymbol;

const interfaceName = "URLSearchParams";

exports.is = value => {
  return utils.isObject(value) && utils.hasOwn(value, implSymbol) && value[implSymbol] instanceof Impl.implementation;
};
exports.isImpl = value => {
  return utils.isObject(value) && value instanceof Impl.implementation;
};
exports.convert = (globalObject, value, { context = "The provided value" } = {}) => {
  if (exports.is(value)) {
    return utils.implForWrapper(value);
  }
  throw new globalObject.TypeError(`${context} is not of type 'URLSearchParams'.`);
};

exports.createDefaultIterator = (globalObject, target, kind) => {
  const ctorRegistry = globalObject[ctorRegistrySymbol];
  const iteratorPrototype = ctorRegistry["URLSearchParams Iterator"];
  const iterator = Object.create(iteratorPrototype);
  Object.defineProperty(iterator, utils.iterInternalSymbol, {
    value: { target, kind, index: 0 },
    configurable: true
  });
  return iterator;
};

function makeWrapper(globalObject, newTarget) {
  let proto;
  if (newTarget !== undefined) {
    proto = newTarget.prototype;
  }

  if (!utils.isObject(proto)) {
    proto = globalObject[ctorRegistrySymbol]["URLSearchParams"].prototype;
  }

  return Object.create(proto);
}

exports.create = (globalObject, constructorArgs, privateData) => {
  const wrapper = makeWrapper(globalObject);
  return exports.setup(wrapper, globalObject, constructorArgs, privateData);
};

exports.createImpl = (globalObject, constructorArgs, privateData) => {
  const wrapper = exports.create(globalObject, constructorArgs, privateData);
  return utils.implForWrapper(wrapper);
};

exports._internalSetup = (wrapper, globalObject) => {};

exports.setup = (wrapper, globalObject, constructorArgs = [], privateData = {}) => {
  privateData.wrapper = wrapper;

  exports._internalSetup(wrapper, globalObject);
  Object.defineProperty(wrapper, implSymbol, {
    value: new Impl.implementation(globalObject, constructorArgs, privateData),
    configurable: true
  });

  wrapper[implSymbol][utils.wrapperSymbol] = wrapper;
  if (Impl.init) {
    Impl.init(wrapper[implSymbol]);
  }
  return wrapper;
};

exports.new = (globalObject, newTarget) => {
  const wrapper = makeWrapper(globalObject, newTarget);

  exports._internalSetup(wrapper, globalObject);
  Object.defineProperty(wrapper, implSymbol, {
    value: Object.create(Impl.implementation.prototype),
    configurable: true
  });

  wrapper[implSymbol][utils.wrapperSymbol] = wrapper;
  if (Impl.init) {
    Impl.init(wrapper[implSymbol]);
  }
  return wrapper[implSymbol];
};

const exposed = new Set(["Window", "Worker"]);

exports.install = (globalObject, globalNames) => {
  if (!globalNames.some(globalName => exposed.has(globalName))) {
    return;
  }

  const ctorRegistry = utils.initCtorRegistry(globalObject);
  class URLSearchParams {
    constructor() {
      const args = [];
      {
        let curArg = arguments[0];
        if (curArg !== undefined) {
          if (utils.isObject(curArg)) {
            if (curArg[Symbol.iterator] !== undefined) {
              if (!utils.isObject(curArg)) {
                throw new globalObject.TypeError(
                  "Failed to construct 'URLSearchParams': parameter 1" + " sequence" + " is not an iterable object."
                );
              } else {
                const V = [];
                const tmp = curArg;
                for (let nextItem of tmp) {
                  if (!utils.isObject(nextItem)) {
                    throw new globalObject.TypeError(
                      "Failed to construct 'URLSearchParams': parameter 1" +
                        " sequence" +
                        "'s element" +
                        " is not an iterable object."
                    );
                  } else {
                    const V = [];
                    const tmp = nextItem;
                    for (let nextItem of tmp) {
                      nextItem = conversions["USVString"](nextItem, {
                        context:
                          "Failed to construct 'URLSearchParams': parameter 1" +
                          " sequence" +
                          "'s element" +
                          "'s element",
                        globals: globalObject
                      });

                      V.push(nextItem);
                    }
                    nextItem = V;
                  }

                  V.push(nextItem);
                }
                curArg = V;
              }
            } else {
              if (!utils.isObject(curArg)) {
                throw new globalObject.TypeError(
                  "Failed to construct 'URLSearchParams': parameter 1" + " record" + " is not an object."
                );
              } else {
                const result = Object.create(null);
                for (const key of Reflect.ownKeys(curArg)) {
                  const desc = Object.getOwnPropertyDescriptor(curArg, key);
                  if (desc && desc.enumerable) {
                    let typedKey = key;

                    typedKey = conversions["USVString"](typedKey, {
                      context: "Failed to construct 'URLSearchParams': parameter 1" + " record" + "'s key",
                      globals: globalObject
                    });

                    let typedValue = curArg[key];

                    typedValue = conversions["USVString"](typedValue, {
                      context: "Failed to construct 'URLSearchParams': parameter 1" + " record" + "'s value",
                      globals: globalObject
                    });

                    result[typedKey] = typedValue;
                  }
                }
                curArg = result;
              }
            }
          } else {
            curArg = conversions["USVString"](curArg, {
              context: "Failed to construct 'URLSearchParams': parameter 1",
              globals: globalObject
            });
          }
        } else {
          curArg = "";
        }
        args.push(curArg);
      }
      return exports.setup(Object.create(new.target.prototype), globalObject, args);
    }

    append(name, value) {
      const esValue = this !== null && this !== undefined ? this : globalObject;
      if (!exports.is(esValue)) {
        throw new globalObject.TypeError(
          "'append' called on an object that is not a valid instance of URLSearchParams."
        );
      }

      if (arguments.length < 2) {
        throw new globalObject.TypeError(
          `Failed to execute 'append' on 'URLSearchParams': 2 arguments required, but only ${arguments.length} present.`
        );
      }
      const args = [];
      {
        let curArg = arguments[0];
        curArg = conversions["USVString"](curArg, {
          context: "Failed to execute 'append' on 'URLSearchParams': parameter 1",
          globals: globalObject
        });
        args.push(curArg);
      }
      {
        let curArg = arguments[1];
        curArg = conversions["USVString"](curArg, {
          context: "Failed to execute 'append' on 'URLSearchParams': parameter 2",
          globals: globalObject
        });
        args.push(curArg);
      }
      return utils.tryWrapperForImpl(esValue[implSymbol].append(...args));
    }

    delete(name) {
      const esValue = this !== null && this !== undefined ? this : globalObject;
      if (!exports.is(esValue)) {
        throw new globalObject.TypeError(
          "'delete' called on an object that is not a valid instance of URLSearchParams."
        );
      }

      if (arguments.length < 1) {
        throw new globalObject.TypeError(
          `Failed to execute 'delete' on 'URLSearchParams': 1 argument required, but only ${arguments.length} present.`
        );
      }
      const args = [];
      {
        let curArg = arguments[0];
        curArg = conversions["USVString"](curArg, {
          context: "Failed to execute 'delete' on 'URLSearchParams': parameter 1",
          globals: globalObject
        });
        args.push(curArg);
      }
      {
        let curArg = arguments[1];
        if (curArg !== undefined) {
          curArg = conversions["USVString"](curArg, {
            context: "Failed to execute 'delete' on 'URLSearchParams': parameter 2",
            globals: globalObject
          });
        }
        args.push(curArg);
      }
      return utils.tryWrapperForImpl(esValue[implSymbol].delete(...args));
    }

    get(name) {
      const esValue = this !== null && this !== undefined ? this : globalObject;
      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'get' called on an object that is not a valid instance of URLSearchParams.");
      }

      if (arguments.length < 1) {
        throw new globalObject.TypeError(
          `Failed to execute 'get' on 'URLSearchParams': 1 argument required, but only ${arguments.length} present.`
        );
      }
      const args = [];
      {
        let curArg = arguments[0];
        curArg = conversions["USVString"](curArg, {
          context: "Failed to execute 'get' on 'URLSearchParams': parameter 1",
          globals: globalObject
        });
        args.push(curArg);
      }
      return esValue[implSymbol].get(...args);
    }

    getAll(name) {
      const esValue = this !== null && this !== undefined ? this : globalObject;
      if (!exports.is(esValue)) {
        throw new globalObject.TypeError(
          "'getAll' called on an object that is not a valid instance of URLSearchParams."
        );
      }

      if (arguments.length < 1) {
        throw new globalObject.TypeError(
          `Failed to execute 'getAll' on 'URLSearchParams': 1 argument required, but only ${arguments.length} present.`
        );
      }
      const args = [];
      {
        let curArg = arguments[0];
        curArg = conversions["USVString"](curArg, {
          context: "Failed to execute 'getAll' on 'URLSearchParams': parameter 1",
          globals: globalObject
        });
        args.push(curArg);
      }
      return utils.tryWrapperForImpl(esValue[implSymbol].getAll(...args));
    }

    has(name) {
      const esValue = this !== null && this !== undefined ? this : globalObject;
      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'has' called on an object that is not a valid instance of URLSearchParams.");
      }

      if (arguments.length < 1) {
        throw new globalObject.TypeError(
          `Failed to execute 'has' on 'URLSearchParams': 1 argument required, but only ${arguments.length} present.`
        );
      }
      const args = [];
      {
        let curArg = arguments[0];
        curArg = conversions["USVString"](curArg, {
          context: "Failed to execute 'has' on 'URLSearchParams': parameter 1",
          globals: globalObject
        });
        args.push(curArg);
      }
      {
        let curArg = arguments[1];
        if (curArg !== undefined) {
          curArg = conversions["USVString"](curArg, {
            context: "Failed to execute 'has' on 'URLSearchParams': parameter 2",
            globals: globalObject
          });
        }
        args.push(curArg);
      }
      return esValue[implSymbol].has(...args);
    }

    set(name, value) {
      const esValue = this !== null && this !== undefined ? this : globalObject;
      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'set' called on an object that is not a valid instance of URLSearchParams.");
      }

      if (arguments.length < 2) {
        throw new globalObject.TypeError(
          `Failed to execute 'set' on 'URLSearchParams': 2 arguments required, but only ${arguments.length} present.`
        );
      }
      const args = [];
      {
        let curArg = arguments[0];
        curArg = conversions["USVString"](curArg, {
          context: "Failed to execute 'set' on 'URLSearchParams': parameter 1",
          globals: globalObject
        });
        args.push(curArg);
      }
      {
        let curArg = arguments[1];
        curArg = conversions["USVString"](curArg, {
          context: "Failed to execute 'set' on 'URLSearchParams': parameter 2",
          globals: globalObject
        });
        args.push(curArg);
      }
      return utils.tryWrapperForImpl(esValue[implSymbol].set(...args));
    }

    sort() {
      const esValue = this !== null && this !== undefined ? this : globalObject;
      if (!exports.is(esValue)) {
        throw new globalObject.TypeError("'sort' called on an object that is not a valid instance of URLSearchParams.");
      }

      return utils.tryWrapperForImpl(esValue[implSymbol].sort());
    }

    toString() {
      const esValue = this !== null && this !== undefined ? this : globalObject;
      if (!exports.is(esValue)) {
        throw new globalObject.TypeError(
          "'toString' called on an object that is not a valid instance of URLSearchParams."
        );
      }

      return esValue[implSymbol].toString();
    }

    keys() {
      if (!exports.is(this)) {
        throw new globalObject.TypeError("'keys' called on an object that is not a valid instance of URLSearchParams.");
      }
      return exports.createDefaultIterator(globalObject, this, "key");
    }

    values() {
      if (!exports.is(this)) {
        throw new globalObject.TypeError(
          "'values' called on an object that is not a valid instance of URLSearchParams."
        );
      }
      return exports.createDefaultIterator(globalObject, this, "value");
    }

    entries() {
      if (!exports.is(this)) {
        throw new globalObject.TypeError(
          "'entries' called on an object that is not a valid instance of URLSearchParams."
        );
      }
      return exports.createDefaultIterator(globalObject, this, "key+value");
    }

    forEach(callback) {
      if (!exports.is(this)) {
        throw new globalObject.TypeError(
          "'forEach' called on an object that is not a valid instance of URLSearchParams."
        );
      }
      if (arguments.length < 1) {
        throw new globalObject.TypeError(
          "Failed to execute 'forEach' on 'iterable': 1 argument required, but only 0 present."
        );
      }
      callback = Function.convert(globalObject, callback, {
        context: "Failed to execute 'forEach' on 'iterable': The callback provided as parameter 1"
      });
      const thisArg = arguments[1];
      let pairs = Array.from(this[implSymbol]);
      let i = 0;
      while (i < pairs.length) {
        const [key, value] = pairs[i].map(utils.tryWrapperForImpl);
        callback.call(thisArg, value, key, this);
        pairs = Array.from(this[implSymbol]);
        i++;
      }
    }

    get size() {
      const esValue = this !== null && this !== undefined ? this : globalObject;

      if (!exports.is(esValue)) {
        throw new globalObject.TypeError(
          "'get size' called on an object that is not a valid instance of URLSearchParams."
        );
      }

      return esValue[implSymbol]["size"];
    }
  }
  Object.defineProperties(URLSearchParams.prototype, {
    append: { enumerable: true },
    delete: { enumerable: true },
    get: { enumerable: true },
    getAll: { enumerable: true },
    has: { enumerable: true },
    set: { enumerable: true },
    sort: { enumerable: true },
    toString: { enumerable: true },
    keys: { enumerable: true },
    values: { enumerable: true },
    entries: { enumerable: true },
    forEach: { enumerable: true },
    size: { enumerable: true },
    [Symbol.toStringTag]: { value: "URLSearchParams", configurable: true },
    [Symbol.iterator]: { value: URLSearchParams.prototype.entries, configurable: true, writable: true }
  });
  ctorRegistry[interfaceName] = URLSearchParams;

  ctorRegistry["URLSearchParams Iterator"] = Object.create(ctorRegistry["%IteratorPrototype%"], {
    [Symbol.toStringTag]: {
      configurable: true,
      value: "URLSearchParams Iterator"
    }
  });
  utils.define(ctorRegistry["URLSearchParams Iterator"], {
    next() {
      const internal = this && this[utils.iterInternalSymbol];
      if (!internal) {
        throw new globalObject.TypeError("next() called on a value that is not a URLSearchParams iterator object");
      }

      const { target, kind, index } = internal;
      const values = Array.from(target[implSymbol]);
      const len = values.length;
      if (index >= len) {
        return newObjectInRealm(globalObject, { value: undefined, done: true });
      }

      const pair = values[index];
      internal.index = index + 1;
      return newObjectInRealm(globalObject, utils.iteratorResult(pair.map(utils.tryWrapperForImpl), kind));
    }
  });

  Object.defineProperty(globalObject, interfaceName, {
    configurable: true,
    writable: true,
    value: URLSearchParams
  });
};

const Impl = require("./URLSearchParams-impl.js");

},{"./Function.js":60,"./URLSearchParams-impl.js":63,"./utils.js":70,"webidl-conversions":58}],65:[function(require,module,exports){
"use strict";
const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder("utf-8", { ignoreBOM: true });

function utf8Encode(string) {
  return utf8Encoder.encode(string);
}

function utf8DecodeWithoutBOM(bytes) {
  return utf8Decoder.decode(bytes);
}

module.exports = {
  utf8Encode,
  utf8DecodeWithoutBOM
};

},{}],66:[function(require,module,exports){
"use strict";

// Note that we take code points as JS numbers, not JS strings.

function isASCIIDigit(c) {
  return c >= 0x30 && c <= 0x39;
}

function isASCIIAlpha(c) {
  return (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A);
}

function isASCIIAlphanumeric(c) {
  return isASCIIAlpha(c) || isASCIIDigit(c);
}

function isASCIIHex(c) {
  return isASCIIDigit(c) || (c >= 0x41 && c <= 0x46) || (c >= 0x61 && c <= 0x66);
}

module.exports = {
  isASCIIDigit,
  isASCIIAlpha,
  isASCIIAlphanumeric,
  isASCIIHex
};

},{}],67:[function(require,module,exports){
"use strict";
const { isASCIIHex } = require("./infra");
const { utf8Encode } = require("./encoding");

function p(char) {
  return char.codePointAt(0);
}

// https://url.spec.whatwg.org/#percent-encode
function percentEncode(c) {
  let hex = c.toString(16).toUpperCase();
  if (hex.length === 1) {
    hex = `0${hex}`;
  }

  return `%${hex}`;
}

// https://url.spec.whatwg.org/#percent-decode
function percentDecodeBytes(input) {
  const output = new Uint8Array(input.byteLength);
  let outputIndex = 0;
  for (let i = 0; i < input.byteLength; ++i) {
    const byte = input[i];
    if (byte !== 0x25) {
      output[outputIndex++] = byte;
    } else if (byte === 0x25 && (!isASCIIHex(input[i + 1]) || !isASCIIHex(input[i + 2]))) {
      output[outputIndex++] = byte;
    } else {
      const bytePoint = parseInt(String.fromCodePoint(input[i + 1], input[i + 2]), 16);
      output[outputIndex++] = bytePoint;
      i += 2;
    }
  }

  return output.slice(0, outputIndex);
}

// https://url.spec.whatwg.org/#string-percent-decode
function percentDecodeString(input) {
  const bytes = utf8Encode(input);
  return percentDecodeBytes(bytes);
}

// https://url.spec.whatwg.org/#c0-control-percent-encode-set
function isC0ControlPercentEncode(c) {
  return c <= 0x1F || c > 0x7E;
}

// https://url.spec.whatwg.org/#fragment-percent-encode-set
const extraFragmentPercentEncodeSet = new Set([p(" "), p("\""), p("<"), p(">"), p("`")]);
function isFragmentPercentEncode(c) {
  return isC0ControlPercentEncode(c) || extraFragmentPercentEncodeSet.has(c);
}

// https://url.spec.whatwg.org/#query-percent-encode-set
const extraQueryPercentEncodeSet = new Set([p(" "), p("\""), p("#"), p("<"), p(">")]);
function isQueryPercentEncode(c) {
  return isC0ControlPercentEncode(c) || extraQueryPercentEncodeSet.has(c);
}

// https://url.spec.whatwg.org/#special-query-percent-encode-set
function isSpecialQueryPercentEncode(c) {
  return isQueryPercentEncode(c) || c === p("'");
}

// https://url.spec.whatwg.org/#path-percent-encode-set
const extraPathPercentEncodeSet = new Set([p("?"), p("`"), p("{"), p("}")]);
function isPathPercentEncode(c) {
  return isQueryPercentEncode(c) || extraPathPercentEncodeSet.has(c);
}

// https://url.spec.whatwg.org/#userinfo-percent-encode-set
const extraUserinfoPercentEncodeSet =
  new Set([p("/"), p(":"), p(";"), p("="), p("@"), p("["), p("\\"), p("]"), p("^"), p("|")]);
function isUserinfoPercentEncode(c) {
  return isPathPercentEncode(c) || extraUserinfoPercentEncodeSet.has(c);
}

// https://url.spec.whatwg.org/#component-percent-encode-set
const extraComponentPercentEncodeSet = new Set([p("$"), p("%"), p("&"), p("+"), p(",")]);
function isComponentPercentEncode(c) {
  return isUserinfoPercentEncode(c) || extraComponentPercentEncodeSet.has(c);
}

// https://url.spec.whatwg.org/#application-x-www-form-urlencoded-percent-encode-set
const extraURLEncodedPercentEncodeSet = new Set([p("!"), p("'"), p("("), p(")"), p("~")]);
function isURLEncodedPercentEncode(c) {
  return isComponentPercentEncode(c) || extraURLEncodedPercentEncodeSet.has(c);
}

// https://url.spec.whatwg.org/#code-point-percent-encode-after-encoding
// https://url.spec.whatwg.org/#utf-8-percent-encode
// Assuming encoding is always utf-8 allows us to trim one of the logic branches. TODO: support encoding.
// The "-Internal" variant here has code points as JS strings. The external version used by other files has code points
// as JS numbers, like the rest of the codebase.
function utf8PercentEncodeCodePointInternal(codePoint, percentEncodePredicate) {
  const bytes = utf8Encode(codePoint);
  let output = "";
  for (const byte of bytes) {
    // Our percentEncodePredicate operates on bytes, not code points, so this is slightly different from the spec.
    if (!percentEncodePredicate(byte)) {
      output += String.fromCharCode(byte);
    } else {
      output += percentEncode(byte);
    }
  }

  return output;
}

function utf8PercentEncodeCodePoint(codePoint, percentEncodePredicate) {
  return utf8PercentEncodeCodePointInternal(String.fromCodePoint(codePoint), percentEncodePredicate);
}

// https://url.spec.whatwg.org/#string-percent-encode-after-encoding
// https://url.spec.whatwg.org/#string-utf-8-percent-encode
function utf8PercentEncodeString(input, percentEncodePredicate, spaceAsPlus = false) {
  let output = "";
  for (const codePoint of input) {
    if (spaceAsPlus && codePoint === " ") {
      output += "+";
    } else {
      output += utf8PercentEncodeCodePointInternal(codePoint, percentEncodePredicate);
    }
  }
  return output;
}

module.exports = {
  isC0ControlPercentEncode,
  isFragmentPercentEncode,
  isQueryPercentEncode,
  isSpecialQueryPercentEncode,
  isPathPercentEncode,
  isUserinfoPercentEncode,
  isURLEncodedPercentEncode,
  percentDecodeString,
  percentDecodeBytes,
  utf8PercentEncodeString,
  utf8PercentEncodeCodePoint
};

},{"./encoding":65,"./infra":66}],68:[function(require,module,exports){
"use strict";
const tr46 = require("tr46");

const infra = require("./infra");
const { utf8DecodeWithoutBOM } = require("./encoding");
const { percentDecodeString, utf8PercentEncodeCodePoint, utf8PercentEncodeString, isC0ControlPercentEncode,
  isFragmentPercentEncode, isQueryPercentEncode, isSpecialQueryPercentEncode, isPathPercentEncode,
  isUserinfoPercentEncode } = require("./percent-encoding");

function p(char) {
  return char.codePointAt(0);
}

const specialSchemes = {
  ftp: 21,
  file: null,
  http: 80,
  https: 443,
  ws: 80,
  wss: 443
};

const failure = Symbol("failure");

function countSymbols(str) {
  return [...str].length;
}

function at(input, idx) {
  const c = input[idx];
  return isNaN(c) ? undefined : String.fromCodePoint(c);
}

function isSingleDot(buffer) {
  return buffer === "." || buffer.toLowerCase() === "%2e";
}

function isDoubleDot(buffer) {
  buffer = buffer.toLowerCase();
  return buffer === ".." || buffer === "%2e." || buffer === ".%2e" || buffer === "%2e%2e";
}

function isWindowsDriveLetterCodePoints(cp1, cp2) {
  return infra.isASCIIAlpha(cp1) && (cp2 === p(":") || cp2 === p("|"));
}

function isWindowsDriveLetterString(string) {
  return string.length === 2 && infra.isASCIIAlpha(string.codePointAt(0)) && (string[1] === ":" || string[1] === "|");
}

function isNormalizedWindowsDriveLetterString(string) {
  return string.length === 2 && infra.isASCIIAlpha(string.codePointAt(0)) && string[1] === ":";
}

function containsForbiddenHostCodePoint(string) {
  return string.search(/\u0000|\u0009|\u000A|\u000D|\u0020|#|\/|:|<|>|\?|@|\[|\\|\]|\^|\|/u) !== -1;
}

function containsForbiddenDomainCodePoint(string) {
  return containsForbiddenHostCodePoint(string) || string.search(/[\u0000-\u001F]|%|\u007F/u) !== -1;
}

function isSpecialScheme(scheme) {
  return specialSchemes[scheme] !== undefined;
}

function isSpecial(url) {
  return isSpecialScheme(url.scheme);
}

function isNotSpecial(url) {
  return !isSpecialScheme(url.scheme);
}

function defaultPort(scheme) {
  return specialSchemes[scheme];
}

function parseIPv4Number(input) {
  if (input === "") {
    return failure;
  }

  let R = 10;

  if (input.length >= 2 && input.charAt(0) === "0" && input.charAt(1).toLowerCase() === "x") {
    input = input.substring(2);
    R = 16;
  } else if (input.length >= 2 && input.charAt(0) === "0") {
    input = input.substring(1);
    R = 8;
  }

  if (input === "") {
    return 0;
  }

  let regex = /[^0-7]/u;
  if (R === 10) {
    regex = /[^0-9]/u;
  }
  if (R === 16) {
    regex = /[^0-9A-Fa-f]/u;
  }

  if (regex.test(input)) {
    return failure;
  }

  return parseInt(input, R);
}

function parseIPv4(input) {
  const parts = input.split(".");
  if (parts[parts.length - 1] === "") {
    if (parts.length > 1) {
      parts.pop();
    }
  }

  if (parts.length > 4) {
    return failure;
  }

  const numbers = [];
  for (const part of parts) {
    const n = parseIPv4Number(part);
    if (n === failure) {
      return failure;
    }

    numbers.push(n);
  }

  for (let i = 0; i < numbers.length - 1; ++i) {
    if (numbers[i] > 255) {
      return failure;
    }
  }
  if (numbers[numbers.length - 1] >= 256 ** (5 - numbers.length)) {
    return failure;
  }

  let ipv4 = numbers.pop();
  let counter = 0;

  for (const n of numbers) {
    ipv4 += n * 256 ** (3 - counter);
    ++counter;
  }

  return ipv4;
}

function serializeIPv4(address) {
  let output = "";
  let n = address;

  for (let i = 1; i <= 4; ++i) {
    output = String(n % 256) + output;
    if (i !== 4) {
      output = `.${output}`;
    }
    n = Math.floor(n / 256);
  }

  return output;
}

function parseIPv6(input) {
  const address = [0, 0, 0, 0, 0, 0, 0, 0];
  let pieceIndex = 0;
  let compress = null;
  let pointer = 0;

  input = Array.from(input, c => c.codePointAt(0));

  if (input[pointer] === p(":")) {
    if (input[pointer + 1] !== p(":")) {
      return failure;
    }

    pointer += 2;
    ++pieceIndex;
    compress = pieceIndex;
  }

  while (pointer < input.length) {
    if (pieceIndex === 8) {
      return failure;
    }

    if (input[pointer] === p(":")) {
      if (compress !== null) {
        return failure;
      }
      ++pointer;
      ++pieceIndex;
      compress = pieceIndex;
      continue;
    }

    let value = 0;
    let length = 0;

    while (length < 4 && infra.isASCIIHex(input[pointer])) {
      value = value * 0x10 + parseInt(at(input, pointer), 16);
      ++pointer;
      ++length;
    }

    if (input[pointer] === p(".")) {
      if (length === 0) {
        return failure;
      }

      pointer -= length;

      if (pieceIndex > 6) {
        return failure;
      }

      let numbersSeen = 0;

      while (input[pointer] !== undefined) {
        let ipv4Piece = null;

        if (numbersSeen > 0) {
          if (input[pointer] === p(".") && numbersSeen < 4) {
            ++pointer;
          } else {
            return failure;
          }
        }

        if (!infra.isASCIIDigit(input[pointer])) {
          return failure;
        }

        while (infra.isASCIIDigit(input[pointer])) {
          const number = parseInt(at(input, pointer));
          if (ipv4Piece === null) {
            ipv4Piece = number;
          } else if (ipv4Piece === 0) {
            return failure;
          } else {
            ipv4Piece = ipv4Piece * 10 + number;
          }
          if (ipv4Piece > 255) {
            return failure;
          }
          ++pointer;
        }

        address[pieceIndex] = address[pieceIndex] * 0x100 + ipv4Piece;

        ++numbersSeen;

        if (numbersSeen === 2 || numbersSeen === 4) {
          ++pieceIndex;
        }
      }

      if (numbersSeen !== 4) {
        return failure;
      }

      break;
    } else if (input[pointer] === p(":")) {
      ++pointer;
      if (input[pointer] === undefined) {
        return failure;
      }
    } else if (input[pointer] !== undefined) {
      return failure;
    }

    address[pieceIndex] = value;
    ++pieceIndex;
  }

  if (compress !== null) {
    let swaps = pieceIndex - compress;
    pieceIndex = 7;
    while (pieceIndex !== 0 && swaps > 0) {
      const temp = address[compress + swaps - 1];
      address[compress + swaps - 1] = address[pieceIndex];
      address[pieceIndex] = temp;
      --pieceIndex;
      --swaps;
    }
  } else if (compress === null && pieceIndex !== 8) {
    return failure;
  }

  return address;
}

function serializeIPv6(address) {
  let output = "";
  const compress = findLongestZeroSequence(address);
  let ignore0 = false;

  for (let pieceIndex = 0; pieceIndex <= 7; ++pieceIndex) {
    if (ignore0 && address[pieceIndex] === 0) {
      continue;
    } else if (ignore0) {
      ignore0 = false;
    }

    if (compress === pieceIndex) {
      const separator = pieceIndex === 0 ? "::" : ":";
      output += separator;
      ignore0 = true;
      continue;
    }

    output += address[pieceIndex].toString(16);

    if (pieceIndex !== 7) {
      output += ":";
    }
  }

  return output;
}

function parseHost(input, isNotSpecialArg = false) {
  if (input[0] === "[") {
    if (input[input.length - 1] !== "]") {
      return failure;
    }

    return parseIPv6(input.substring(1, input.length - 1));
  }

  if (isNotSpecialArg) {
    return parseOpaqueHost(input);
  }

  const domain = utf8DecodeWithoutBOM(percentDecodeString(input));
  const asciiDomain = domainToASCII(domain);
  if (asciiDomain === failure) {
    return failure;
  }

  if (containsForbiddenDomainCodePoint(asciiDomain)) {
    return failure;
  }

  if (endsInANumber(asciiDomain)) {
    return parseIPv4(asciiDomain);
  }

  return asciiDomain;
}

function endsInANumber(input) {
  const parts = input.split(".");
  if (parts[parts.length - 1] === "") {
    if (parts.length === 1) {
      return false;
    }
    parts.pop();
  }

  const last = parts[parts.length - 1];
  if (parseIPv4Number(last) !== failure) {
    return true;
  }

  if (/^[0-9]+$/u.test(last)) {
    return true;
  }

  return false;
}

function parseOpaqueHost(input) {
  if (containsForbiddenHostCodePoint(input)) {
    return failure;
  }

  return utf8PercentEncodeString(input, isC0ControlPercentEncode);
}

function findLongestZeroSequence(arr) {
  let maxIdx = null;
  let maxLen = 1; // only find elements > 1
  let currStart = null;
  let currLen = 0;

  for (let i = 0; i < arr.length; ++i) {
    if (arr[i] !== 0) {
      if (currLen > maxLen) {
        maxIdx = currStart;
        maxLen = currLen;
      }

      currStart = null;
      currLen = 0;
    } else {
      if (currStart === null) {
        currStart = i;
      }
      ++currLen;
    }
  }

  // if trailing zeros
  if (currLen > maxLen) {
    return currStart;
  }

  return maxIdx;
}

function serializeHost(host) {
  if (typeof host === "number") {
    return serializeIPv4(host);
  }

  // IPv6 serializer
  if (host instanceof Array) {
    return `[${serializeIPv6(host)}]`;
  }

  return host;
}

function domainToASCII(domain, beStrict = false) {
  const result = tr46.toASCII(domain, {
    checkBidi: true,
    checkHyphens: false,
    checkJoiners: true,
    useSTD3ASCIIRules: beStrict,
    verifyDNSLength: beStrict
  });
  if (result === null || result === "") {
    return failure;
  }
  return result;
}

function trimControlChars(url) {
  return url.replace(/^[\u0000-\u001F\u0020]+|[\u0000-\u001F\u0020]+$/ug, "");
}

function trimTabAndNewline(url) {
  return url.replace(/\u0009|\u000A|\u000D/ug, "");
}

function shortenPath(url) {
  const { path } = url;
  if (path.length === 0) {
    return;
  }
  if (url.scheme === "file" && path.length === 1 && isNormalizedWindowsDriveLetter(path[0])) {
    return;
  }

  path.pop();
}

function includesCredentials(url) {
  return url.username !== "" || url.password !== "";
}

function cannotHaveAUsernamePasswordPort(url) {
  return url.host === null || url.host === "" || url.scheme === "file";
}

function hasAnOpaquePath(url) {
  return typeof url.path === "string";
}

function isNormalizedWindowsDriveLetter(string) {
  return /^[A-Za-z]:$/u.test(string);
}

function URLStateMachine(input, base, encodingOverride, url, stateOverride) {
  this.pointer = 0;
  this.input = input;
  this.base = base || null;
  this.encodingOverride = encodingOverride || "utf-8";
  this.stateOverride = stateOverride;
  this.url = url;
  this.failure = false;
  this.parseError = false;

  if (!this.url) {
    this.url = {
      scheme: "",
      username: "",
      password: "",
      host: null,
      port: null,
      path: [],
      query: null,
      fragment: null
    };

    const res = trimControlChars(this.input);
    if (res !== this.input) {
      this.parseError = true;
    }
    this.input = res;
  }

  const res = trimTabAndNewline(this.input);
  if (res !== this.input) {
    this.parseError = true;
  }
  this.input = res;

  this.state = stateOverride || "scheme start";

  this.buffer = "";
  this.atFlag = false;
  this.arrFlag = false;
  this.passwordTokenSeenFlag = false;

  this.input = Array.from(this.input, c => c.codePointAt(0));

  for (; this.pointer <= this.input.length; ++this.pointer) {
    const c = this.input[this.pointer];
    const cStr = isNaN(c) ? undefined : String.fromCodePoint(c);

    // exec state machine
    const ret = this[`parse ${this.state}`](c, cStr);
    if (!ret) {
      break; // terminate algorithm
    } else if (ret === failure) {
      this.failure = true;
      break;
    }
  }
}

URLStateMachine.prototype["parse scheme start"] = function parseSchemeStart(c, cStr) {
  if (infra.isASCIIAlpha(c)) {
    this.buffer += cStr.toLowerCase();
    this.state = "scheme";
  } else if (!this.stateOverride) {
    this.state = "no scheme";
    --this.pointer;
  } else {
    this.parseError = true;
    return failure;
  }

  return true;
};

URLStateMachine.prototype["parse scheme"] = function parseScheme(c, cStr) {
  if (infra.isASCIIAlphanumeric(c) || c === p("+") || c === p("-") || c === p(".")) {
    this.buffer += cStr.toLowerCase();
  } else if (c === p(":")) {
    if (this.stateOverride) {
      if (isSpecial(this.url) && !isSpecialScheme(this.buffer)) {
        return false;
      }

      if (!isSpecial(this.url) && isSpecialScheme(this.buffer)) {
        return false;
      }

      if ((includesCredentials(this.url) || this.url.port !== null) && this.buffer === "file") {
        return false;
      }

      if (this.url.scheme === "file" && this.url.host === "") {
        return false;
      }
    }
    this.url.scheme = this.buffer;
    if (this.stateOverride) {
      if (this.url.port === defaultPort(this.url.scheme)) {
        this.url.port = null;
      }
      return false;
    }
    this.buffer = "";
    if (this.url.scheme === "file") {
      if (this.input[this.pointer + 1] !== p("/") || this.input[this.pointer + 2] !== p("/")) {
        this.parseError = true;
      }
      this.state = "file";
    } else if (isSpecial(this.url) && this.base !== null && this.base.scheme === this.url.scheme) {
      this.state = "special relative or authority";
    } else if (isSpecial(this.url)) {
      this.state = "special authority slashes";
    } else if (this.input[this.pointer + 1] === p("/")) {
      this.state = "path or authority";
      ++this.pointer;
    } else {
      this.url.path = "";
      this.state = "opaque path";
    }
  } else if (!this.stateOverride) {
    this.buffer = "";
    this.state = "no scheme";
    this.pointer = -1;
  } else {
    this.parseError = true;
    return failure;
  }

  return true;
};

URLStateMachine.prototype["parse no scheme"] = function parseNoScheme(c) {
  if (this.base === null || (hasAnOpaquePath(this.base) && c !== p("#"))) {
    return failure;
  } else if (hasAnOpaquePath(this.base) && c === p("#")) {
    this.url.scheme = this.base.scheme;
    this.url.path = this.base.path;
    this.url.query = this.base.query;
    this.url.fragment = "";
    this.state = "fragment";
  } else if (this.base.scheme === "file") {
    this.state = "file";
    --this.pointer;
  } else {
    this.state = "relative";
    --this.pointer;
  }

  return true;
};

URLStateMachine.prototype["parse special relative or authority"] = function parseSpecialRelativeOrAuthority(c) {
  if (c === p("/") && this.input[this.pointer + 1] === p("/")) {
    this.state = "special authority ignore slashes";
    ++this.pointer;
  } else {
    this.parseError = true;
    this.state = "relative";
    --this.pointer;
  }

  return true;
};

URLStateMachine.prototype["parse path or authority"] = function parsePathOrAuthority(c) {
  if (c === p("/")) {
    this.state = "authority";
  } else {
    this.state = "path";
    --this.pointer;
  }

  return true;
};

URLStateMachine.prototype["parse relative"] = function parseRelative(c) {
  this.url.scheme = this.base.scheme;
  if (c === p("/")) {
    this.state = "relative slash";
  } else if (isSpecial(this.url) && c === p("\\")) {
    this.parseError = true;
    this.state = "relative slash";
  } else {
    this.url.username = this.base.username;
    this.url.password = this.base.password;
    this.url.host = this.base.host;
    this.url.port = this.base.port;
    this.url.path = this.base.path.slice();
    this.url.query = this.base.query;
    if (c === p("?")) {
      this.url.query = "";
      this.state = "query";
    } else if (c === p("#")) {
      this.url.fragment = "";
      this.state = "fragment";
    } else if (!isNaN(c)) {
      this.url.query = null;
      this.url.path.pop();
      this.state = "path";
      --this.pointer;
    }
  }

  return true;
};

URLStateMachine.prototype["parse relative slash"] = function parseRelativeSlash(c) {
  if (isSpecial(this.url) && (c === p("/") || c === p("\\"))) {
    if (c === p("\\")) {
      this.parseError = true;
    }
    this.state = "special authority ignore slashes";
  } else if (c === p("/")) {
    this.state = "authority";
  } else {
    this.url.username = this.base.username;
    this.url.password = this.base.password;
    this.url.host = this.base.host;
    this.url.port = this.base.port;
    this.state = "path";
    --this.pointer;
  }

  return true;
};

URLStateMachine.prototype["parse special authority slashes"] = function parseSpecialAuthoritySlashes(c) {
  if (c === p("/") && this.input[this.pointer + 1] === p("/")) {
    this.state = "special authority ignore slashes";
    ++this.pointer;
  } else {
    this.parseError = true;
    this.state = "special authority ignore slashes";
    --this.pointer;
  }

  return true;
};

URLStateMachine.prototype["parse special authority ignore slashes"] = function parseSpecialAuthorityIgnoreSlashes(c) {
  if (c !== p("/") && c !== p("\\")) {
    this.state = "authority";
    --this.pointer;
  } else {
    this.parseError = true;
  }

  return true;
};

URLStateMachine.prototype["parse authority"] = function parseAuthority(c, cStr) {
  if (c === p("@")) {
    this.parseError = true;
    if (this.atFlag) {
      this.buffer = `%40${this.buffer}`;
    }
    this.atFlag = true;

    // careful, this is based on buffer and has its own pointer (this.pointer != pointer) and inner chars
    const len = countSymbols(this.buffer);
    for (let pointer = 0; pointer < len; ++pointer) {
      const codePoint = this.buffer.codePointAt(pointer);

      if (codePoint === p(":") && !this.passwordTokenSeenFlag) {
        this.passwordTokenSeenFlag = true;
        continue;
      }
      const encodedCodePoints = utf8PercentEncodeCodePoint(codePoint, isUserinfoPercentEncode);
      if (this.passwordTokenSeenFlag) {
        this.url.password += encodedCodePoints;
      } else {
        this.url.username += encodedCodePoints;
      }
    }
    this.buffer = "";
  } else if (isNaN(c) || c === p("/") || c === p("?") || c === p("#") ||
             (isSpecial(this.url) && c === p("\\"))) {
    if (this.atFlag && this.buffer === "") {
      this.parseError = true;
      return failure;
    }
    this.pointer -= countSymbols(this.buffer) + 1;
    this.buffer = "";
    this.state = "host";
  } else {
    this.buffer += cStr;
  }

  return true;
};

URLStateMachine.prototype["parse hostname"] =
URLStateMachine.prototype["parse host"] = function parseHostName(c, cStr) {
  if (this.stateOverride && this.url.scheme === "file") {
    --this.pointer;
    this.state = "file host";
  } else if (c === p(":") && !this.arrFlag) {
    if (this.buffer === "") {
      this.parseError = true;
      return failure;
    }

    if (this.stateOverride === "hostname") {
      return false;
    }

    const host = parseHost(this.buffer, isNotSpecial(this.url));
    if (host === failure) {
      return failure;
    }

    this.url.host = host;
    this.buffer = "";
    this.state = "port";
  } else if (isNaN(c) || c === p("/") || c === p("?") || c === p("#") ||
             (isSpecial(this.url) && c === p("\\"))) {
    --this.pointer;
    if (isSpecial(this.url) && this.buffer === "") {
      this.parseError = true;
      return failure;
    } else if (this.stateOverride && this.buffer === "" &&
               (includesCredentials(this.url) || this.url.port !== null)) {
      this.parseError = true;
      return false;
    }

    const host = parseHost(this.buffer, isNotSpecial(this.url));
    if (host === failure) {
      return failure;
    }

    this.url.host = host;
    this.buffer = "";
    this.state = "path start";
    if (this.stateOverride) {
      return false;
    }
  } else {
    if (c === p("[")) {
      this.arrFlag = true;
    } else if (c === p("]")) {
      this.arrFlag = false;
    }
    this.buffer += cStr;
  }

  return true;
};

URLStateMachine.prototype["parse port"] = function parsePort(c, cStr) {
  if (infra.isASCIIDigit(c)) {
    this.buffer += cStr;
  } else if (isNaN(c) || c === p("/") || c === p("?") || c === p("#") ||
             (isSpecial(this.url) && c === p("\\")) ||
             this.stateOverride) {
    if (this.buffer !== "") {
      const port = parseInt(this.buffer);
      if (port > 2 ** 16 - 1) {
        this.parseError = true;
        return failure;
      }
      this.url.port = port === defaultPort(this.url.scheme) ? null : port;
      this.buffer = "";
    }
    if (this.stateOverride) {
      return false;
    }
    this.state = "path start";
    --this.pointer;
  } else {
    this.parseError = true;
    return failure;
  }

  return true;
};

const fileOtherwiseCodePoints = new Set([p("/"), p("\\"), p("?"), p("#")]);

function startsWithWindowsDriveLetter(input, pointer) {
  const length = input.length - pointer;
  return length >= 2 &&
    isWindowsDriveLetterCodePoints(input[pointer], input[pointer + 1]) &&
    (length === 2 || fileOtherwiseCodePoints.has(input[pointer + 2]));
}

URLStateMachine.prototype["parse file"] = function parseFile(c) {
  this.url.scheme = "file";
  this.url.host = "";

  if (c === p("/") || c === p("\\")) {
    if (c === p("\\")) {
      this.parseError = true;
    }
    this.state = "file slash";
  } else if (this.base !== null && this.base.scheme === "file") {
    this.url.host = this.base.host;
    this.url.path = this.base.path.slice();
    this.url.query = this.base.query;
    if (c === p("?")) {
      this.url.query = "";
      this.state = "query";
    } else if (c === p("#")) {
      this.url.fragment = "";
      this.state = "fragment";
    } else if (!isNaN(c)) {
      this.url.query = null;
      if (!startsWithWindowsDriveLetter(this.input, this.pointer)) {
        shortenPath(this.url);
      } else {
        this.parseError = true;
        this.url.path = [];
      }

      this.state = "path";
      --this.pointer;
    }
  } else {
    this.state = "path";
    --this.pointer;
  }

  return true;
};

URLStateMachine.prototype["parse file slash"] = function parseFileSlash(c) {
  if (c === p("/") || c === p("\\")) {
    if (c === p("\\")) {
      this.parseError = true;
    }
    this.state = "file host";
  } else {
    if (this.base !== null && this.base.scheme === "file") {
      if (!startsWithWindowsDriveLetter(this.input, this.pointer) &&
          isNormalizedWindowsDriveLetterString(this.base.path[0])) {
        this.url.path.push(this.base.path[0]);
      }
      this.url.host = this.base.host;
    }
    this.state = "path";
    --this.pointer;
  }

  return true;
};

URLStateMachine.prototype["parse file host"] = function parseFileHost(c, cStr) {
  if (isNaN(c) || c === p("/") || c === p("\\") || c === p("?") || c === p("#")) {
    --this.pointer;
    if (!this.stateOverride && isWindowsDriveLetterString(this.buffer)) {
      this.parseError = true;
      this.state = "path";
    } else if (this.buffer === "") {
      this.url.host = "";
      if (this.stateOverride) {
        return false;
      }
      this.state = "path start";
    } else {
      let host = parseHost(this.buffer, isNotSpecial(this.url));
      if (host === failure) {
        return failure;
      }
      if (host === "localhost") {
        host = "";
      }
      this.url.host = host;

      if (this.stateOverride) {
        return false;
      }

      this.buffer = "";
      this.state = "path start";
    }
  } else {
    this.buffer += cStr;
  }

  return true;
};

URLStateMachine.prototype["parse path start"] = function parsePathStart(c) {
  if (isSpecial(this.url)) {
    if (c === p("\\")) {
      this.parseError = true;
    }
    this.state = "path";

    if (c !== p("/") && c !== p("\\")) {
      --this.pointer;
    }
  } else if (!this.stateOverride && c === p("?")) {
    this.url.query = "";
    this.state = "query";
  } else if (!this.stateOverride && c === p("#")) {
    this.url.fragment = "";
    this.state = "fragment";
  } else if (c !== undefined) {
    this.state = "path";
    if (c !== p("/")) {
      --this.pointer;
    }
  } else if (this.stateOverride && this.url.host === null) {
    this.url.path.push("");
  }

  return true;
};

URLStateMachine.prototype["parse path"] = function parsePath(c) {
  if (isNaN(c) || c === p("/") || (isSpecial(this.url) && c === p("\\")) ||
      (!this.stateOverride && (c === p("?") || c === p("#")))) {
    if (isSpecial(this.url) && c === p("\\")) {
      this.parseError = true;
    }

    if (isDoubleDot(this.buffer)) {
      shortenPath(this.url);
      if (c !== p("/") && !(isSpecial(this.url) && c === p("\\"))) {
        this.url.path.push("");
      }
    } else if (isSingleDot(this.buffer) && c !== p("/") &&
               !(isSpecial(this.url) && c === p("\\"))) {
      this.url.path.push("");
    } else if (!isSingleDot(this.buffer)) {
      if (this.url.scheme === "file" && this.url.path.length === 0 && isWindowsDriveLetterString(this.buffer)) {
        this.buffer = `${this.buffer[0]}:`;
      }
      this.url.path.push(this.buffer);
    }
    this.buffer = "";
    if (c === p("?")) {
      this.url.query = "";
      this.state = "query";
    }
    if (c === p("#")) {
      this.url.fragment = "";
      this.state = "fragment";
    }
  } else {
    // TODO: If c is not a URL code point and not "%", parse error.

    if (c === p("%") &&
      (!infra.isASCIIHex(this.input[this.pointer + 1]) ||
        !infra.isASCIIHex(this.input[this.pointer + 2]))) {
      this.parseError = true;
    }

    this.buffer += utf8PercentEncodeCodePoint(c, isPathPercentEncode);
  }

  return true;
};

URLStateMachine.prototype["parse opaque path"] = function parseOpaquePath(c) {
  if (c === p("?")) {
    this.url.query = "";
    this.state = "query";
  } else if (c === p("#")) {
    this.url.fragment = "";
    this.state = "fragment";
  } else {
    // TODO: Add: not a URL code point
    if (!isNaN(c) && c !== p("%")) {
      this.parseError = true;
    }

    if (c === p("%") &&
        (!infra.isASCIIHex(this.input[this.pointer + 1]) ||
         !infra.isASCIIHex(this.input[this.pointer + 2]))) {
      this.parseError = true;
    }

    if (!isNaN(c)) {
      this.url.path += utf8PercentEncodeCodePoint(c, isC0ControlPercentEncode);
    }
  }

  return true;
};

URLStateMachine.prototype["parse query"] = function parseQuery(c, cStr) {
  if (!isSpecial(this.url) || this.url.scheme === "ws" || this.url.scheme === "wss") {
    this.encodingOverride = "utf-8";
  }

  if ((!this.stateOverride && c === p("#")) || isNaN(c)) {
    const queryPercentEncodePredicate = isSpecial(this.url) ? isSpecialQueryPercentEncode : isQueryPercentEncode;
    this.url.query += utf8PercentEncodeString(this.buffer, queryPercentEncodePredicate);

    this.buffer = "";

    if (c === p("#")) {
      this.url.fragment = "";
      this.state = "fragment";
    }
  } else if (!isNaN(c)) {
    // TODO: If c is not a URL code point and not "%", parse error.

    if (c === p("%") &&
      (!infra.isASCIIHex(this.input[this.pointer + 1]) ||
        !infra.isASCIIHex(this.input[this.pointer + 2]))) {
      this.parseError = true;
    }

    this.buffer += cStr;
  }

  return true;
};

URLStateMachine.prototype["parse fragment"] = function parseFragment(c) {
  if (!isNaN(c)) {
    // TODO: If c is not a URL code point and not "%", parse error.
    if (c === p("%") &&
      (!infra.isASCIIHex(this.input[this.pointer + 1]) ||
        !infra.isASCIIHex(this.input[this.pointer + 2]))) {
      this.parseError = true;
    }

    this.url.fragment += utf8PercentEncodeCodePoint(c, isFragmentPercentEncode);
  }

  return true;
};

function serializeURL(url, excludeFragment) {
  let output = `${url.scheme}:`;
  if (url.host !== null) {
    output += "//";

    if (url.username !== "" || url.password !== "") {
      output += url.username;
      if (url.password !== "") {
        output += `:${url.password}`;
      }
      output += "@";
    }

    output += serializeHost(url.host);

    if (url.port !== null) {
      output += `:${url.port}`;
    }
  }

  if (url.host === null && !hasAnOpaquePath(url) && url.path.length > 1 && url.path[0] === "") {
    output += "/.";
  }
  output += serializePath(url);

  if (url.query !== null) {
    output += `?${url.query}`;
  }

  if (!excludeFragment && url.fragment !== null) {
    output += `#${url.fragment}`;
  }

  return output;
}

function serializeOrigin(tuple) {
  let result = `${tuple.scheme}://`;
  result += serializeHost(tuple.host);

  if (tuple.port !== null) {
    result += `:${tuple.port}`;
  }

  return result;
}

function serializePath(url) {
  if (hasAnOpaquePath(url)) {
    return url.path;
  }

  let output = "";
  for (const segment of url.path) {
    output += `/${segment}`;
  }
  return output;
}

module.exports.serializeURL = serializeURL;

module.exports.serializePath = serializePath;

module.exports.serializeURLOrigin = function (url) {
  // https://url.spec.whatwg.org/#concept-url-origin
  switch (url.scheme) {
    case "blob": {
      const pathURL = module.exports.parseURL(serializePath(url));
      if (pathURL === null) {
        return "null";
      }
      if (pathURL.scheme !== "http" && pathURL.scheme !== "https") {
        return "null";
      }
      return module.exports.serializeURLOrigin(pathURL);
    }
    case "ftp":
    case "http":
    case "https":
    case "ws":
    case "wss":
      return serializeOrigin({
        scheme: url.scheme,
        host: url.host,
        port: url.port
      });
    case "file":
      // The spec says:
      // > Unfortunate as it is, this is left as an exercise to the reader. When in doubt, return a new opaque origin.
      // Browsers tested so far:
      // - Chrome says "file://", but treats file: URLs as cross-origin for most (all?) purposes; see e.g.
      //   https://bugs.chromium.org/p/chromium/issues/detail?id=37586
      // - Firefox says "null", but treats file: URLs as same-origin sometimes based on directory stuff; see
      //   https://developer.mozilla.org/en-US/docs/Archive/Misc_top_level/Same-origin_policy_for_file:_URIs
      return "null";
    default:
      // serializing an opaque origin returns "null"
      return "null";
  }
};

module.exports.basicURLParse = function (input, options) {
  if (options === undefined) {
    options = {};
  }

  const usm = new URLStateMachine(input, options.baseURL, options.encodingOverride, options.url, options.stateOverride);
  if (usm.failure) {
    return null;
  }

  return usm.url;
};

module.exports.setTheUsername = function (url, username) {
  url.username = utf8PercentEncodeString(username, isUserinfoPercentEncode);
};

module.exports.setThePassword = function (url, password) {
  url.password = utf8PercentEncodeString(password, isUserinfoPercentEncode);
};

module.exports.serializeHost = serializeHost;

module.exports.cannotHaveAUsernamePasswordPort = cannotHaveAUsernamePasswordPort;

module.exports.hasAnOpaquePath = hasAnOpaquePath;

module.exports.serializeInteger = function (integer) {
  return String(integer);
};

module.exports.parseURL = function (input, options) {
  if (options === undefined) {
    options = {};
  }

  // We don't handle blobs, so this just delegates:
  return module.exports.basicURLParse(input, { baseURL: options.baseURL, encodingOverride: options.encodingOverride });
};

},{"./encoding":65,"./infra":66,"./percent-encoding":67,"tr46":51}],69:[function(require,module,exports){
"use strict";
const { utf8Encode, utf8DecodeWithoutBOM } = require("./encoding");
const { percentDecodeBytes, utf8PercentEncodeString, isURLEncodedPercentEncode } = require("./percent-encoding");

function p(char) {
  return char.codePointAt(0);
}

// https://url.spec.whatwg.org/#concept-urlencoded-parser
function parseUrlencoded(input) {
  const sequences = strictlySplitByteSequence(input, p("&"));
  const output = [];
  for (const bytes of sequences) {
    if (bytes.length === 0) {
      continue;
    }

    let name, value;
    const indexOfEqual = bytes.indexOf(p("="));

    if (indexOfEqual >= 0) {
      name = bytes.slice(0, indexOfEqual);
      value = bytes.slice(indexOfEqual + 1);
    } else {
      name = bytes;
      value = new Uint8Array(0);
    }

    name = replaceByteInByteSequence(name, 0x2B, 0x20);
    value = replaceByteInByteSequence(value, 0x2B, 0x20);

    const nameString = utf8DecodeWithoutBOM(percentDecodeBytes(name));
    const valueString = utf8DecodeWithoutBOM(percentDecodeBytes(value));

    output.push([nameString, valueString]);
  }
  return output;
}

// https://url.spec.whatwg.org/#concept-urlencoded-string-parser
function parseUrlencodedString(input) {
  return parseUrlencoded(utf8Encode(input));
}

// https://url.spec.whatwg.org/#concept-urlencoded-serializer
function serializeUrlencoded(tuples, encodingOverride = undefined) {
  let encoding = "utf-8";
  if (encodingOverride !== undefined) {
    // TODO "get the output encoding", i.e. handle encoding labels vs. names.
    encoding = encodingOverride;
  }

  let output = "";
  for (const [i, tuple] of tuples.entries()) {
    // TODO: handle encoding override

    const name = utf8PercentEncodeString(tuple[0], isURLEncodedPercentEncode, true);

    let value = tuple[1];
    if (tuple.length > 2 && tuple[2] !== undefined) {
      if (tuple[2] === "hidden" && name === "_charset_") {
        value = encoding;
      } else if (tuple[2] === "file") {
        // value is a File object
        value = value.name;
      }
    }

    value = utf8PercentEncodeString(value, isURLEncodedPercentEncode, true);

    if (i !== 0) {
      output += "&";
    }
    output += `${name}=${value}`;
  }
  return output;
}

function strictlySplitByteSequence(buf, cp) {
  const list = [];
  let last = 0;
  let i = buf.indexOf(cp);
  while (i >= 0) {
    list.push(buf.slice(last, i));
    last = i + 1;
    i = buf.indexOf(cp, last);
  }
  if (last !== buf.length) {
    list.push(buf.slice(last));
  }
  return list;
}

function replaceByteInByteSequence(buf, from, to) {
  let i = buf.indexOf(from);
  while (i >= 0) {
    buf[i] = to;
    i = buf.indexOf(from, i + 1);
  }
  return buf;
}

module.exports = {
  parseUrlencodedString,
  serializeUrlencoded
};

},{"./encoding":65,"./percent-encoding":67}],70:[function(require,module,exports){
"use strict";

// Returns "Type(value) is Object" in ES terminology.
function isObject(value) {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

const hasOwn = Function.prototype.call.bind(Object.prototype.hasOwnProperty);

// Like `Object.assign`, but using `[[GetOwnProperty]]` and `[[DefineOwnProperty]]`
// instead of `[[Get]]` and `[[Set]]` and only allowing objects
function define(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(source, key);
    if (descriptor && !Reflect.defineProperty(target, key, descriptor)) {
      throw new TypeError(`Cannot redefine property: ${String(key)}`);
    }
  }
}

function newObjectInRealm(globalObject, object) {
  const ctorRegistry = initCtorRegistry(globalObject);
  return Object.defineProperties(
    Object.create(ctorRegistry["%Object.prototype%"]),
    Object.getOwnPropertyDescriptors(object)
  );
}

const wrapperSymbol = Symbol("wrapper");
const implSymbol = Symbol("impl");
const sameObjectCaches = Symbol("SameObject caches");
const ctorRegistrySymbol = Symbol.for("[webidl2js] constructor registry");

const AsyncIteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf(async function* () {}).prototype);

function initCtorRegistry(globalObject) {
  if (hasOwn(globalObject, ctorRegistrySymbol)) {
    return globalObject[ctorRegistrySymbol];
  }

  const ctorRegistry = Object.create(null);

  // In addition to registering all the WebIDL2JS-generated types in the constructor registry,
  // we also register a few intrinsics that we make use of in generated code, since they are not
  // easy to grab from the globalObject variable.
  ctorRegistry["%Object.prototype%"] = globalObject.Object.prototype;
  ctorRegistry["%IteratorPrototype%"] = Object.getPrototypeOf(
    Object.getPrototypeOf(new globalObject.Array()[Symbol.iterator]())
  );

  try {
    ctorRegistry["%AsyncIteratorPrototype%"] = Object.getPrototypeOf(
      Object.getPrototypeOf(
        globalObject.eval("(async function* () {})").prototype
      )
    );
  } catch {
    ctorRegistry["%AsyncIteratorPrototype%"] = AsyncIteratorPrototype;
  }

  globalObject[ctorRegistrySymbol] = ctorRegistry;
  return ctorRegistry;
}

function getSameObject(wrapper, prop, creator) {
  if (!wrapper[sameObjectCaches]) {
    wrapper[sameObjectCaches] = Object.create(null);
  }

  if (prop in wrapper[sameObjectCaches]) {
    return wrapper[sameObjectCaches][prop];
  }

  wrapper[sameObjectCaches][prop] = creator();
  return wrapper[sameObjectCaches][prop];
}

function wrapperForImpl(impl) {
  return impl ? impl[wrapperSymbol] : null;
}

function implForWrapper(wrapper) {
  return wrapper ? wrapper[implSymbol] : null;
}

function tryWrapperForImpl(impl) {
  const wrapper = wrapperForImpl(impl);
  return wrapper ? wrapper : impl;
}

function tryImplForWrapper(wrapper) {
  const impl = implForWrapper(wrapper);
  return impl ? impl : wrapper;
}

const iterInternalSymbol = Symbol("internal");

function isArrayIndexPropName(P) {
  if (typeof P !== "string") {
    return false;
  }
  const i = P >>> 0;
  if (i === 2 ** 32 - 1) {
    return false;
  }
  const s = `${i}`;
  if (P !== s) {
    return false;
  }
  return true;
}

const byteLengthGetter =
    Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength").get;
function isArrayBuffer(value) {
  try {
    byteLengthGetter.call(value);
    return true;
  } catch (e) {
    return false;
  }
}

function iteratorResult([key, value], kind) {
  let result;
  switch (kind) {
    case "key":
      result = key;
      break;
    case "value":
      result = value;
      break;
    case "key+value":
      result = [key, value];
      break;
  }
  return { value: result, done: false };
}

const supportsPropertyIndex = Symbol("supports property index");
const supportedPropertyIndices = Symbol("supported property indices");
const supportsPropertyName = Symbol("supports property name");
const supportedPropertyNames = Symbol("supported property names");
const indexedGet = Symbol("indexed property get");
const indexedSetNew = Symbol("indexed property set new");
const indexedSetExisting = Symbol("indexed property set existing");
const namedGet = Symbol("named property get");
const namedSetNew = Symbol("named property set new");
const namedSetExisting = Symbol("named property set existing");
const namedDelete = Symbol("named property delete");

const asyncIteratorNext = Symbol("async iterator get the next iteration result");
const asyncIteratorReturn = Symbol("async iterator return steps");
const asyncIteratorInit = Symbol("async iterator initialization steps");
const asyncIteratorEOI = Symbol("async iterator end of iteration");

module.exports = exports = {
  isObject,
  hasOwn,
  define,
  newObjectInRealm,
  wrapperSymbol,
  implSymbol,
  getSameObject,
  ctorRegistrySymbol,
  initCtorRegistry,
  wrapperForImpl,
  implForWrapper,
  tryWrapperForImpl,
  tryImplForWrapper,
  iterInternalSymbol,
  isArrayBuffer,
  isArrayIndexPropName,
  supportsPropertyIndex,
  supportedPropertyIndices,
  supportsPropertyName,
  supportedPropertyNames,
  indexedGet,
  indexedSetNew,
  indexedSetExisting,
  namedGet,
  namedSetNew,
  namedSetExisting,
  namedDelete,
  asyncIteratorNext,
  asyncIteratorReturn,
  asyncIteratorInit,
  asyncIteratorEOI,
  iteratorResult
};

},{}],71:[function(require,module,exports){
"use strict";

const URL = require("./lib/URL");
const URLSearchParams = require("./lib/URLSearchParams");

exports.URL = URL;
exports.URLSearchParams = URLSearchParams;

},{"./lib/URL":62,"./lib/URLSearchParams":64}],72:[function(require,module,exports){
'use strict';

const WebSocket = require('./lib/websocket');

WebSocket.createWebSocketStream = require('./lib/stream');
WebSocket.Server = require('./lib/websocket-server');
WebSocket.Receiver = require('./lib/receiver');
WebSocket.Sender = require('./lib/sender');

module.exports = WebSocket;

},{"./lib/receiver":79,"./lib/sender":80,"./lib/stream":81,"./lib/websocket":84,"./lib/websocket-server":83}],73:[function(require,module,exports){
'use strict';

const { EMPTY_BUFFER } = require('./constants');

/**
 * Merges an array of buffers into a new buffer.
 *
 * @param {Buffer[]} list The array of buffers to concat
 * @param {Number} totalLength The total length of buffers in the list
 * @return {Buffer} The resulting buffer
 * @public
 */
function concat(list, totalLength) {
  if (list.length === 0) return EMPTY_BUFFER;
  if (list.length === 1) return list[0];

  const target = Buffer.allocUnsafe(totalLength);
  let offset = 0;

  for (let i = 0; i < list.length; i++) {
    const buf = list[i];
    target.set(buf, offset);
    offset += buf.length;
  }

  if (offset < totalLength) return target.slice(0, offset);

  return target;
}

/**
 * Masks a buffer using the given mask.
 *
 * @param {Buffer} source The buffer to mask
 * @param {Buffer} mask The mask to use
 * @param {Buffer} output The buffer where to store the result
 * @param {Number} offset The offset at which to start writing
 * @param {Number} length The number of bytes to mask.
 * @public
 */
function _mask(source, mask, output, offset, length) {
  for (let i = 0; i < length; i++) {
    output[offset + i] = source[i] ^ mask[i & 3];
  }
}

/**
 * Unmasks a buffer using the given mask.
 *
 * @param {Buffer} buffer The buffer to unmask
 * @param {Buffer} mask The mask to use
 * @public
 */
function _unmask(buffer, mask) {
  // Required until https://github.com/nodejs/node/issues/9006 is resolved.
  const length = buffer.length;
  for (let i = 0; i < length; i++) {
    buffer[i] ^= mask[i & 3];
  }
}

/**
 * Converts a buffer to an `ArrayBuffer`.
 *
 * @param {Buffer} buf The buffer to convert
 * @return {ArrayBuffer} Converted buffer
 * @public
 */
function toArrayBuffer(buf) {
  if (buf.byteLength === buf.buffer.byteLength) {
    return buf.buffer;
  }

  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

/**
 * Converts `data` to a `Buffer`.
 *
 * @param {*} data The data to convert
 * @return {Buffer} The buffer
 * @throws {TypeError}
 * @public
 */
function toBuffer(data) {
  toBuffer.readOnly = true;

  if (Buffer.isBuffer(data)) return data;

  let buf;

  if (data instanceof ArrayBuffer) {
    buf = Buffer.from(data);
  } else if (ArrayBuffer.isView(data)) {
    buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  } else {
    buf = Buffer.from(data);
    toBuffer.readOnly = false;
  }

  return buf;
}

try {
  const bufferUtil = require('bufferutil');
  const bu = bufferUtil.BufferUtil || bufferUtil;

  module.exports = {
    concat,
    mask(source, mask, output, offset, length) {
      if (length < 48) _mask(source, mask, output, offset, length);
      else bu.mask(source, mask, output, offset, length);
    },
    toArrayBuffer,
    toBuffer,
    unmask(buffer, mask) {
      if (buffer.length < 32) _unmask(buffer, mask);
      else bu.unmask(buffer, mask);
    }
  };
} catch (e) /* istanbul ignore next */ {
  module.exports = {
    concat,
    mask: _mask,
    toArrayBuffer,
    toBuffer,
    unmask: _unmask
  };
}

},{"./constants":74,"bufferutil":5}],74:[function(require,module,exports){
'use strict';

module.exports = {
  BINARY_TYPES: ['nodebuffer', 'arraybuffer', 'fragments'],
  GUID: '258EAFA5-E914-47DA-95CA-C5AB0DC85B11',
  kStatusCode: Symbol('status-code'),
  kWebSocket: Symbol('websocket'),
  EMPTY_BUFFER: Buffer.alloc(0),
  NOOP: () => {}
};

},{}],75:[function(require,module,exports){
'use strict';

/**
 * Class representing an event.
 *
 * @private
 */
class Event {
  /**
   * Create a new `Event`.
   *
   * @param {String} type The name of the event
   * @param {Object} target A reference to the target to which the event was
   *     dispatched
   */
  constructor(type, target) {
    this.target = target;
    this.type = type;
  }
}

/**
 * Class representing a message event.
 *
 * @extends Event
 * @private
 */
class MessageEvent extends Event {
  /**
   * Create a new `MessageEvent`.
   *
   * @param {(String|Buffer|ArrayBuffer|Buffer[])} data The received data
   * @param {WebSocket} target A reference to the target to which the event was
   *     dispatched
   */
  constructor(data, target) {
    super('message', target);

    this.data = data;
  }
}

/**
 * Class representing a close event.
 *
 * @extends Event
 * @private
 */
class CloseEvent extends Event {
  /**
   * Create a new `CloseEvent`.
   *
   * @param {Number} code The status code explaining why the connection is being
   *     closed
   * @param {String} reason A human-readable string explaining why the
   *     connection is closing
   * @param {WebSocket} target A reference to the target to which the event was
   *     dispatched
   */
  constructor(code, reason, target) {
    super('close', target);

    this.wasClean = target._closeFrameReceived && target._closeFrameSent;
    this.reason = reason;
    this.code = code;
  }
}

/**
 * Class representing an open event.
 *
 * @extends Event
 * @private
 */
class OpenEvent extends Event {
  /**
   * Create a new `OpenEvent`.
   *
   * @param {WebSocket} target A reference to the target to which the event was
   *     dispatched
   */
  constructor(target) {
    super('open', target);
  }
}

/**
 * Class representing an error event.
 *
 * @extends Event
 * @private
 */
class ErrorEvent extends Event {
  /**
   * Create a new `ErrorEvent`.
   *
   * @param {Object} error The error that generated this event
   * @param {WebSocket} target A reference to the target to which the event was
   *     dispatched
   */
  constructor(error, target) {
    super('error', target);

    this.message = error.message;
    this.error = error;
  }
}

/**
 * This provides methods for emulating the `EventTarget` interface. It's not
 * meant to be used directly.
 *
 * @mixin
 */
const EventTarget = {
  /**
   * Register an event listener.
   *
   * @param {String} type A string representing the event type to listen for
   * @param {Function} listener The listener to add
   * @param {Object} [options] An options object specifies characteristics about
   *     the event listener
   * @param {Boolean} [options.once=false] A `Boolean`` indicating that the
   *     listener should be invoked at most once after being added. If `true`,
   *     the listener would be automatically removed when invoked.
   * @public
   */
  addEventListener(type, listener, options) {
    if (typeof listener !== 'function') return;

    function onMessage(data) {
      listener.call(this, new MessageEvent(data, this));
    }

    function onClose(code, message) {
      listener.call(this, new CloseEvent(code, message, this));
    }

    function onError(error) {
      listener.call(this, new ErrorEvent(error, this));
    }

    function onOpen() {
      listener.call(this, new OpenEvent(this));
    }

    const method = options && options.once ? 'once' : 'on';

    if (type === 'message') {
      onMessage._listener = listener;
      this[method](type, onMessage);
    } else if (type === 'close') {
      onClose._listener = listener;
      this[method](type, onClose);
    } else if (type === 'error') {
      onError._listener = listener;
      this[method](type, onError);
    } else if (type === 'open') {
      onOpen._listener = listener;
      this[method](type, onOpen);
    } else {
      this[method](type, listener);
    }
  },

  /**
   * Remove an event listener.
   *
   * @param {String} type A string representing the event type to remove
   * @param {Function} listener The listener to remove
   * @public
   */
  removeEventListener(type, listener) {
    const listeners = this.listeners(type);

    for (let i = 0; i < listeners.length; i++) {
      if (listeners[i] === listener || listeners[i]._listener === listener) {
        this.removeListener(type, listeners[i]);
      }
    }
  }
};

module.exports = EventTarget;

},{}],76:[function(require,module,exports){
'use strict';

//
// Allowed token characters:
//
// '!', '#', '$', '%', '&', ''', '*', '+', '-',
// '.', 0-9, A-Z, '^', '_', '`', a-z, '|', '~'
//
// tokenChars[32] === 0 // ' '
// tokenChars[33] === 1 // '!'
// tokenChars[34] === 0 // '"'
// ...
//
// prettier-ignore
const tokenChars = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0 - 15
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 16 - 31
  0, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, // 32 - 47
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, // 48 - 63
  0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 64 - 79
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, // 80 - 95
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 96 - 111
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0 // 112 - 127
];

/**
 * Adds an offer to the map of extension offers or a parameter to the map of
 * parameters.
 *
 * @param {Object} dest The map of extension offers or parameters
 * @param {String} name The extension or parameter name
 * @param {(Object|Boolean|String)} elem The extension parameters or the
 *     parameter value
 * @private
 */
function push(dest, name, elem) {
  if (dest[name] === undefined) dest[name] = [elem];
  else dest[name].push(elem);
}

/**
 * Parses the `Sec-WebSocket-Extensions` header into an object.
 *
 * @param {String} header The field value of the header
 * @return {Object} The parsed object
 * @public
 */
function parse(header) {
  const offers = Object.create(null);

  if (header === undefined || header === '') return offers;

  let params = Object.create(null);
  let mustUnescape = false;
  let isEscaping = false;
  let inQuotes = false;
  let extensionName;
  let paramName;
  let start = -1;
  let end = -1;
  let i = 0;

  for (; i < header.length; i++) {
    const code = header.charCodeAt(i);

    if (extensionName === undefined) {
      if (end === -1 && tokenChars[code] === 1) {
        if (start === -1) start = i;
      } else if (code === 0x20 /* ' ' */ || code === 0x09 /* '\t' */) {
        if (end === -1 && start !== -1) end = i;
      } else if (code === 0x3b /* ';' */ || code === 0x2c /* ',' */) {
        if (start === -1) {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }

        if (end === -1) end = i;
        const name = header.slice(start, end);
        if (code === 0x2c) {
          push(offers, name, params);
          params = Object.create(null);
        } else {
          extensionName = name;
        }

        start = end = -1;
      } else {
        throw new SyntaxError(`Unexpected character at index ${i}`);
      }
    } else if (paramName === undefined) {
      if (end === -1 && tokenChars[code] === 1) {
        if (start === -1) start = i;
      } else if (code === 0x20 || code === 0x09) {
        if (end === -1 && start !== -1) end = i;
      } else if (code === 0x3b || code === 0x2c) {
        if (start === -1) {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }

        if (end === -1) end = i;
        push(params, header.slice(start, end), true);
        if (code === 0x2c) {
          push(offers, extensionName, params);
          params = Object.create(null);
          extensionName = undefined;
        }

        start = end = -1;
      } else if (code === 0x3d /* '=' */ && start !== -1 && end === -1) {
        paramName = header.slice(start, i);
        start = end = -1;
      } else {
        throw new SyntaxError(`Unexpected character at index ${i}`);
      }
    } else {
      //
      // The value of a quoted-string after unescaping must conform to the
      // token ABNF, so only token characters are valid.
      // Ref: https://tools.ietf.org/html/rfc6455#section-9.1
      //
      if (isEscaping) {
        if (tokenChars[code] !== 1) {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
        if (start === -1) start = i;
        else if (!mustUnescape) mustUnescape = true;
        isEscaping = false;
      } else if (inQuotes) {
        if (tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (code === 0x22 /* '"' */ && start !== -1) {
          inQuotes = false;
          end = i;
        } else if (code === 0x5c /* '\' */) {
          isEscaping = true;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      } else if (code === 0x22 && header.charCodeAt(i - 1) === 0x3d) {
        inQuotes = true;
      } else if (end === -1 && tokenChars[code] === 1) {
        if (start === -1) start = i;
      } else if (start !== -1 && (code === 0x20 || code === 0x09)) {
        if (end === -1) end = i;
      } else if (code === 0x3b || code === 0x2c) {
        if (start === -1) {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }

        if (end === -1) end = i;
        let value = header.slice(start, end);
        if (mustUnescape) {
          value = value.replace(/\\/g, '');
          mustUnescape = false;
        }
        push(params, paramName, value);
        if (code === 0x2c) {
          push(offers, extensionName, params);
          params = Object.create(null);
          extensionName = undefined;
        }

        paramName = undefined;
        start = end = -1;
      } else {
        throw new SyntaxError(`Unexpected character at index ${i}`);
      }
    }
  }

  if (start === -1 || inQuotes) {
    throw new SyntaxError('Unexpected end of input');
  }

  if (end === -1) end = i;
  const token = header.slice(start, end);
  if (extensionName === undefined) {
    push(offers, token, params);
  } else {
    if (paramName === undefined) {
      push(params, token, true);
    } else if (mustUnescape) {
      push(params, paramName, token.replace(/\\/g, ''));
    } else {
      push(params, paramName, token);
    }
    push(offers, extensionName, params);
  }

  return offers;
}

/**
 * Builds the `Sec-WebSocket-Extensions` header field value.
 *
 * @param {Object} extensions The map of extensions and parameters to format
 * @return {String} A string representing the given object
 * @public
 */
function format(extensions) {
  return Object.keys(extensions)
    .map((extension) => {
      let configurations = extensions[extension];
      if (!Array.isArray(configurations)) configurations = [configurations];
      return configurations
        .map((params) => {
          return [extension]
            .concat(
              Object.keys(params).map((k) => {
                let values = params[k];
                if (!Array.isArray(values)) values = [values];
                return values
                  .map((v) => (v === true ? k : `${k}=${v}`))
                  .join('; ');
              })
            )
            .join('; ');
        })
        .join(', ');
    })
    .join(', ');
}

module.exports = { format, parse };

},{}],77:[function(require,module,exports){
'use strict';

const kDone = Symbol('kDone');
const kRun = Symbol('kRun');

/**
 * A very simple job queue with adjustable concurrency. Adapted from
 * https://github.com/STRML/async-limiter
 */
class Limiter {
  /**
   * Creates a new `Limiter`.
   *
   * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
   *     to run concurrently
   */
  constructor(concurrency) {
    this[kDone] = () => {
      this.pending--;
      this[kRun]();
    };
    this.concurrency = concurrency || Infinity;
    this.jobs = [];
    this.pending = 0;
  }

  /**
   * Adds a job to the queue.
   *
   * @param {Function} job The job to run
   * @public
   */
  add(job) {
    this.jobs.push(job);
    this[kRun]();
  }

  /**
   * Removes a job from the queue and runs it if possible.
   *
   * @private
   */
  [kRun]() {
    if (this.pending === this.concurrency) return;

    if (this.jobs.length) {
      const job = this.jobs.shift();

      this.pending++;
      job(this[kDone]);
    }
  }
}

module.exports = Limiter;

},{}],78:[function(require,module,exports){
'use strict';

const zlib = require('zlib');

const bufferUtil = require('./buffer-util');
const Limiter = require('./limiter');
const { kStatusCode, NOOP } = require('./constants');

const TRAILER = Buffer.from([0x00, 0x00, 0xff, 0xff]);
const kPerMessageDeflate = Symbol('permessage-deflate');
const kTotalLength = Symbol('total-length');
const kCallback = Symbol('callback');
const kBuffers = Symbol('buffers');
const kError = Symbol('error');

//
// We limit zlib concurrency, which prevents severe memory fragmentation
// as documented in https://github.com/nodejs/node/issues/8871#issuecomment-250915913
// and https://github.com/websockets/ws/issues/1202
//
// Intentionally global; it's the global thread pool that's an issue.
//
let zlibLimiter;

/**
 * permessage-deflate implementation.
 */
class PerMessageDeflate {
  /**
   * Creates a PerMessageDeflate instance.
   *
   * @param {Object} [options] Configuration options
   * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
   *     disabling of server context takeover
   * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
   *     acknowledge disabling of client context takeover
   * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
   *     use of a custom server window size
   * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
   *     for, or request, a custom client window size
   * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
   *     deflate
   * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
   *     inflate
   * @param {Number} [options.threshold=1024] Size (in bytes) below which
   *     messages should not be compressed
   * @param {Number} [options.concurrencyLimit=10] The number of concurrent
   *     calls to zlib
   * @param {Boolean} [isServer=false] Create the instance in either server or
   *     client mode
   * @param {Number} [maxPayload=0] The maximum allowed message length
   */
  constructor(options, isServer, maxPayload) {
    this._maxPayload = maxPayload | 0;
    this._options = options || {};
    this._threshold =
      this._options.threshold !== undefined ? this._options.threshold : 1024;
    this._isServer = !!isServer;
    this._deflate = null;
    this._inflate = null;

    this.params = null;

    if (!zlibLimiter) {
      const concurrency =
        this._options.concurrencyLimit !== undefined
          ? this._options.concurrencyLimit
          : 10;
      zlibLimiter = new Limiter(concurrency);
    }
  }

  /**
   * @type {String}
   */
  static get extensionName() {
    return 'permessage-deflate';
  }

  /**
   * Create an extension negotiation offer.
   *
   * @return {Object} Extension parameters
   * @public
   */
  offer() {
    const params = {};

    if (this._options.serverNoContextTakeover) {
      params.server_no_context_takeover = true;
    }
    if (this._options.clientNoContextTakeover) {
      params.client_no_context_takeover = true;
    }
    if (this._options.serverMaxWindowBits) {
      params.server_max_window_bits = this._options.serverMaxWindowBits;
    }
    if (this._options.clientMaxWindowBits) {
      params.client_max_window_bits = this._options.clientMaxWindowBits;
    } else if (this._options.clientMaxWindowBits == null) {
      params.client_max_window_bits = true;
    }

    return params;
  }

  /**
   * Accept an extension negotiation offer/response.
   *
   * @param {Array} configurations The extension negotiation offers/reponse
   * @return {Object} Accepted configuration
   * @public
   */
  accept(configurations) {
    configurations = this.normalizeParams(configurations);

    this.params = this._isServer
      ? this.acceptAsServer(configurations)
      : this.acceptAsClient(configurations);

    return this.params;
  }

  /**
   * Releases all resources used by the extension.
   *
   * @public
   */
  cleanup() {
    if (this._inflate) {
      this._inflate.close();
      this._inflate = null;
    }

    if (this._deflate) {
      const callback = this._deflate[kCallback];

      this._deflate.close();
      this._deflate = null;

      if (callback) {
        callback(
          new Error(
            'The deflate stream was closed while data was being processed'
          )
        );
      }
    }
  }

  /**
   *  Accept an extension negotiation offer.
   *
   * @param {Array} offers The extension negotiation offers
   * @return {Object} Accepted configuration
   * @private
   */
  acceptAsServer(offers) {
    const opts = this._options;
    const accepted = offers.find((params) => {
      if (
        (opts.serverNoContextTakeover === false &&
          params.server_no_context_takeover) ||
        (params.server_max_window_bits &&
          (opts.serverMaxWindowBits === false ||
            (typeof opts.serverMaxWindowBits === 'number' &&
              opts.serverMaxWindowBits > params.server_max_window_bits))) ||
        (typeof opts.clientMaxWindowBits === 'number' &&
          !params.client_max_window_bits)
      ) {
        return false;
      }

      return true;
    });

    if (!accepted) {
      throw new Error('None of the extension offers can be accepted');
    }

    if (opts.serverNoContextTakeover) {
      accepted.server_no_context_takeover = true;
    }
    if (opts.clientNoContextTakeover) {
      accepted.client_no_context_takeover = true;
    }
    if (typeof opts.serverMaxWindowBits === 'number') {
      accepted.server_max_window_bits = opts.serverMaxWindowBits;
    }
    if (typeof opts.clientMaxWindowBits === 'number') {
      accepted.client_max_window_bits = opts.clientMaxWindowBits;
    } else if (
      accepted.client_max_window_bits === true ||
      opts.clientMaxWindowBits === false
    ) {
      delete accepted.client_max_window_bits;
    }

    return accepted;
  }

  /**
   * Accept the extension negotiation response.
   *
   * @param {Array} response The extension negotiation response
   * @return {Object} Accepted configuration
   * @private
   */
  acceptAsClient(response) {
    const params = response[0];

    if (
      this._options.clientNoContextTakeover === false &&
      params.client_no_context_takeover
    ) {
      throw new Error('Unexpected parameter "client_no_context_takeover"');
    }

    if (!params.client_max_window_bits) {
      if (typeof this._options.clientMaxWindowBits === 'number') {
        params.client_max_window_bits = this._options.clientMaxWindowBits;
      }
    } else if (
      this._options.clientMaxWindowBits === false ||
      (typeof this._options.clientMaxWindowBits === 'number' &&
        params.client_max_window_bits > this._options.clientMaxWindowBits)
    ) {
      throw new Error(
        'Unexpected or invalid parameter "client_max_window_bits"'
      );
    }

    return params;
  }

  /**
   * Normalize parameters.
   *
   * @param {Array} configurations The extension negotiation offers/reponse
   * @return {Array} The offers/response with normalized parameters
   * @private
   */
  normalizeParams(configurations) {
    configurations.forEach((params) => {
      Object.keys(params).forEach((key) => {
        let value = params[key];

        if (value.length > 1) {
          throw new Error(`Parameter "${key}" must have only a single value`);
        }

        value = value[0];

        if (key === 'client_max_window_bits') {
          if (value !== true) {
            const num = +value;
            if (!Number.isInteger(num) || num < 8 || num > 15) {
              throw new TypeError(
                `Invalid value for parameter "${key}": ${value}`
              );
            }
            value = num;
          } else if (!this._isServer) {
            throw new TypeError(
              `Invalid value for parameter "${key}": ${value}`
            );
          }
        } else if (key === 'server_max_window_bits') {
          const num = +value;
          if (!Number.isInteger(num) || num < 8 || num > 15) {
            throw new TypeError(
              `Invalid value for parameter "${key}": ${value}`
            );
          }
          value = num;
        } else if (
          key === 'client_no_context_takeover' ||
          key === 'server_no_context_takeover'
        ) {
          if (value !== true) {
            throw new TypeError(
              `Invalid value for parameter "${key}": ${value}`
            );
          }
        } else {
          throw new Error(`Unknown parameter "${key}"`);
        }

        params[key] = value;
      });
    });

    return configurations;
  }

  /**
   * Decompress data. Concurrency limited.
   *
   * @param {Buffer} data Compressed data
   * @param {Boolean} fin Specifies whether or not this is the last fragment
   * @param {Function} callback Callback
   * @public
   */
  decompress(data, fin, callback) {
    zlibLimiter.add((done) => {
      this._decompress(data, fin, (err, result) => {
        done();
        callback(err, result);
      });
    });
  }

  /**
   * Compress data. Concurrency limited.
   *
   * @param {Buffer} data Data to compress
   * @param {Boolean} fin Specifies whether or not this is the last fragment
   * @param {Function} callback Callback
   * @public
   */
  compress(data, fin, callback) {
    zlibLimiter.add((done) => {
      this._compress(data, fin, (err, result) => {
        done();
        callback(err, result);
      });
    });
  }

  /**
   * Decompress data.
   *
   * @param {Buffer} data Compressed data
   * @param {Boolean} fin Specifies whether or not this is the last fragment
   * @param {Function} callback Callback
   * @private
   */
  _decompress(data, fin, callback) {
    const endpoint = this._isServer ? 'client' : 'server';

    if (!this._inflate) {
      const key = `${endpoint}_max_window_bits`;
      const windowBits =
        typeof this.params[key] !== 'number'
          ? zlib.Z_DEFAULT_WINDOWBITS
          : this.params[key];

      this._inflate = zlib.createInflateRaw({
        ...this._options.zlibInflateOptions,
        windowBits
      });
      this._inflate[kPerMessageDeflate] = this;
      this._inflate[kTotalLength] = 0;
      this._inflate[kBuffers] = [];
      this._inflate.on('error', inflateOnError);
      this._inflate.on('data', inflateOnData);
    }

    this._inflate[kCallback] = callback;

    this._inflate.write(data);
    if (fin) this._inflate.write(TRAILER);

    this._inflate.flush(() => {
      const err = this._inflate[kError];

      if (err) {
        this._inflate.close();
        this._inflate = null;
        callback(err);
        return;
      }

      const data = bufferUtil.concat(
        this._inflate[kBuffers],
        this._inflate[kTotalLength]
      );

      if (this._inflate._readableState.endEmitted) {
        this._inflate.close();
        this._inflate = null;
      } else {
        this._inflate[kTotalLength] = 0;
        this._inflate[kBuffers] = [];

        if (fin && this.params[`${endpoint}_no_context_takeover`]) {
          this._inflate.reset();
        }
      }

      callback(null, data);
    });
  }

  /**
   * Compress data.
   *
   * @param {Buffer} data Data to compress
   * @param {Boolean} fin Specifies whether or not this is the last fragment
   * @param {Function} callback Callback
   * @private
   */
  _compress(data, fin, callback) {
    const endpoint = this._isServer ? 'server' : 'client';

    if (!this._deflate) {
      const key = `${endpoint}_max_window_bits`;
      const windowBits =
        typeof this.params[key] !== 'number'
          ? zlib.Z_DEFAULT_WINDOWBITS
          : this.params[key];

      this._deflate = zlib.createDeflateRaw({
        ...this._options.zlibDeflateOptions,
        windowBits
      });

      this._deflate[kTotalLength] = 0;
      this._deflate[kBuffers] = [];

      //
      // An `'error'` event is emitted, only on Node.js < 10.0.0, if the
      // `zlib.DeflateRaw` instance is closed while data is being processed.
      // This can happen if `PerMessageDeflate#cleanup()` is called at the wrong
      // time due to an abnormal WebSocket closure.
      //
      this._deflate.on('error', NOOP);
      this._deflate.on('data', deflateOnData);
    }

    this._deflate[kCallback] = callback;

    this._deflate.write(data);
    this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
      if (!this._deflate) {
        //
        // The deflate stream was closed while data was being processed.
        //
        return;
      }

      let data = bufferUtil.concat(
        this._deflate[kBuffers],
        this._deflate[kTotalLength]
      );

      if (fin) data = data.slice(0, data.length - 4);

      //
      // Ensure that the callback will not be called again in
      // `PerMessageDeflate#cleanup()`.
      //
      this._deflate[kCallback] = null;

      this._deflate[kTotalLength] = 0;
      this._deflate[kBuffers] = [];

      if (fin && this.params[`${endpoint}_no_context_takeover`]) {
        this._deflate.reset();
      }

      callback(null, data);
    });
  }
}

module.exports = PerMessageDeflate;

/**
 * The listener of the `zlib.DeflateRaw` stream `'data'` event.
 *
 * @param {Buffer} chunk A chunk of data
 * @private
 */
function deflateOnData(chunk) {
  this[kBuffers].push(chunk);
  this[kTotalLength] += chunk.length;
}

/**
 * The listener of the `zlib.InflateRaw` stream `'data'` event.
 *
 * @param {Buffer} chunk A chunk of data
 * @private
 */
function inflateOnData(chunk) {
  this[kTotalLength] += chunk.length;

  if (
    this[kPerMessageDeflate]._maxPayload < 1 ||
    this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload
  ) {
    this[kBuffers].push(chunk);
    return;
  }

  this[kError] = new RangeError('Max payload size exceeded');
  this[kError].code = 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH';
  this[kError][kStatusCode] = 1009;
  this.removeListener('data', inflateOnData);
  this.reset();
}

/**
 * The listener of the `zlib.InflateRaw` stream `'error'` event.
 *
 * @param {Error} err The emitted error
 * @private
 */
function inflateOnError(err) {
  //
  // There is no need to call `Zlib#close()` as the handle is automatically
  // closed when an error is emitted.
  //
  this[kPerMessageDeflate]._inflate = null;
  err[kStatusCode] = 1007;
  this[kCallback](err);
}

},{"./buffer-util":73,"./constants":74,"./limiter":77,"zlib":undefined}],79:[function(require,module,exports){
'use strict';

const { Writable } = require('stream');

const PerMessageDeflate = require('./permessage-deflate');
const {
  BINARY_TYPES,
  EMPTY_BUFFER,
  kStatusCode,
  kWebSocket
} = require('./constants');
const { concat, toArrayBuffer, unmask } = require('./buffer-util');
const { isValidStatusCode, isValidUTF8 } = require('./validation');

const GET_INFO = 0;
const GET_PAYLOAD_LENGTH_16 = 1;
const GET_PAYLOAD_LENGTH_64 = 2;
const GET_MASK = 3;
const GET_DATA = 4;
const INFLATING = 5;

/**
 * HyBi Receiver implementation.
 *
 * @extends Writable
 */
class Receiver extends Writable {
  /**
   * Creates a Receiver instance.
   *
   * @param {String} [binaryType=nodebuffer] The type for binary data
   * @param {Object} [extensions] An object containing the negotiated extensions
   * @param {Boolean} [isServer=false] Specifies whether to operate in client or
   *     server mode
   * @param {Number} [maxPayload=0] The maximum allowed message length
   */
  constructor(binaryType, extensions, isServer, maxPayload) {
    super();

    this._binaryType = binaryType || BINARY_TYPES[0];
    this[kWebSocket] = undefined;
    this._extensions = extensions || {};
    this._isServer = !!isServer;
    this._maxPayload = maxPayload | 0;

    this._bufferedBytes = 0;
    this._buffers = [];

    this._compressed = false;
    this._payloadLength = 0;
    this._mask = undefined;
    this._fragmented = 0;
    this._masked = false;
    this._fin = false;
    this._opcode = 0;

    this._totalPayloadLength = 0;
    this._messageLength = 0;
    this._fragments = [];

    this._state = GET_INFO;
    this._loop = false;
  }

  /**
   * Implements `Writable.prototype._write()`.
   *
   * @param {Buffer} chunk The chunk of data to write
   * @param {String} encoding The character encoding of `chunk`
   * @param {Function} cb Callback
   * @private
   */
  _write(chunk, encoding, cb) {
    if (this._opcode === 0x08 && this._state == GET_INFO) return cb();

    this._bufferedBytes += chunk.length;
    this._buffers.push(chunk);
    this.startLoop(cb);
  }

  /**
   * Consumes `n` bytes from the buffered data.
   *
   * @param {Number} n The number of bytes to consume
   * @return {Buffer} The consumed bytes
   * @private
   */
  consume(n) {
    this._bufferedBytes -= n;

    if (n === this._buffers[0].length) return this._buffers.shift();

    if (n < this._buffers[0].length) {
      const buf = this._buffers[0];
      this._buffers[0] = buf.slice(n);
      return buf.slice(0, n);
    }

    const dst = Buffer.allocUnsafe(n);

    do {
      const buf = this._buffers[0];
      const offset = dst.length - n;

      if (n >= buf.length) {
        dst.set(this._buffers.shift(), offset);
      } else {
        dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
        this._buffers[0] = buf.slice(n);
      }

      n -= buf.length;
    } while (n > 0);

    return dst;
  }

  /**
   * Starts the parsing loop.
   *
   * @param {Function} cb Callback
   * @private
   */
  startLoop(cb) {
    let err;
    this._loop = true;

    do {
      switch (this._state) {
        case GET_INFO:
          err = this.getInfo();
          break;
        case GET_PAYLOAD_LENGTH_16:
          err = this.getPayloadLength16();
          break;
        case GET_PAYLOAD_LENGTH_64:
          err = this.getPayloadLength64();
          break;
        case GET_MASK:
          this.getMask();
          break;
        case GET_DATA:
          err = this.getData(cb);
          break;
        default:
          // `INFLATING`
          this._loop = false;
          return;
      }
    } while (this._loop);

    cb(err);
  }

  /**
   * Reads the first two bytes of a frame.
   *
   * @return {(RangeError|undefined)} A possible error
   * @private
   */
  getInfo() {
    if (this._bufferedBytes < 2) {
      this._loop = false;
      return;
    }

    const buf = this.consume(2);

    if ((buf[0] & 0x30) !== 0x00) {
      this._loop = false;
      return error(
        RangeError,
        'RSV2 and RSV3 must be clear',
        true,
        1002,
        'WS_ERR_UNEXPECTED_RSV_2_3'
      );
    }

    const compressed = (buf[0] & 0x40) === 0x40;

    if (compressed && !this._extensions[PerMessageDeflate.extensionName]) {
      this._loop = false;
      return error(
        RangeError,
        'RSV1 must be clear',
        true,
        1002,
        'WS_ERR_UNEXPECTED_RSV_1'
      );
    }

    this._fin = (buf[0] & 0x80) === 0x80;
    this._opcode = buf[0] & 0x0f;
    this._payloadLength = buf[1] & 0x7f;

    if (this._opcode === 0x00) {
      if (compressed) {
        this._loop = false;
        return error(
          RangeError,
          'RSV1 must be clear',
          true,
          1002,
          'WS_ERR_UNEXPECTED_RSV_1'
        );
      }

      if (!this._fragmented) {
        this._loop = false;
        return error(
          RangeError,
          'invalid opcode 0',
          true,
          1002,
          'WS_ERR_INVALID_OPCODE'
        );
      }

      this._opcode = this._fragmented;
    } else if (this._opcode === 0x01 || this._opcode === 0x02) {
      if (this._fragmented) {
        this._loop = false;
        return error(
          RangeError,
          `invalid opcode ${this._opcode}`,
          true,
          1002,
          'WS_ERR_INVALID_OPCODE'
        );
      }

      this._compressed = compressed;
    } else if (this._opcode > 0x07 && this._opcode < 0x0b) {
      if (!this._fin) {
        this._loop = false;
        return error(
          RangeError,
          'FIN must be set',
          true,
          1002,
          'WS_ERR_EXPECTED_FIN'
        );
      }

      if (compressed) {
        this._loop = false;
        return error(
          RangeError,
          'RSV1 must be clear',
          true,
          1002,
          'WS_ERR_UNEXPECTED_RSV_1'
        );
      }

      if (this._payloadLength > 0x7d) {
        this._loop = false;
        return error(
          RangeError,
          `invalid payload length ${this._payloadLength}`,
          true,
          1002,
          'WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH'
        );
      }
    } else {
      this._loop = false;
      return error(
        RangeError,
        `invalid opcode ${this._opcode}`,
        true,
        1002,
        'WS_ERR_INVALID_OPCODE'
      );
    }

    if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
    this._masked = (buf[1] & 0x80) === 0x80;

    if (this._isServer) {
      if (!this._masked) {
        this._loop = false;
        return error(
          RangeError,
          'MASK must be set',
          true,
          1002,
          'WS_ERR_EXPECTED_MASK'
        );
      }
    } else if (this._masked) {
      this._loop = false;
      return error(
        RangeError,
        'MASK must be clear',
        true,
        1002,
        'WS_ERR_UNEXPECTED_MASK'
      );
    }

    if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
    else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
    else return this.haveLength();
  }

  /**
   * Gets extended payload length (7+16).
   *
   * @return {(RangeError|undefined)} A possible error
   * @private
   */
  getPayloadLength16() {
    if (this._bufferedBytes < 2) {
      this._loop = false;
      return;
    }

    this._payloadLength = this.consume(2).readUInt16BE(0);
    return this.haveLength();
  }

  /**
   * Gets extended payload length (7+64).
   *
   * @return {(RangeError|undefined)} A possible error
   * @private
   */
  getPayloadLength64() {
    if (this._bufferedBytes < 8) {
      this._loop = false;
      return;
    }

    const buf = this.consume(8);
    const num = buf.readUInt32BE(0);

    //
    // The maximum safe integer in JavaScript is 2^53 - 1. An error is returned
    // if payload length is greater than this number.
    //
    if (num > Math.pow(2, 53 - 32) - 1) {
      this._loop = false;
      return error(
        RangeError,
        'Unsupported WebSocket frame: payload length > 2^53 - 1',
        false,
        1009,
        'WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH'
      );
    }

    this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
    return this.haveLength();
  }

  /**
   * Payload length has been read.
   *
   * @return {(RangeError|undefined)} A possible error
   * @private
   */
  haveLength() {
    if (this._payloadLength && this._opcode < 0x08) {
      this._totalPayloadLength += this._payloadLength;
      if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
        this._loop = false;
        return error(
          RangeError,
          'Max payload size exceeded',
          false,
          1009,
          'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH'
        );
      }
    }

    if (this._masked) this._state = GET_MASK;
    else this._state = GET_DATA;
  }

  /**
   * Reads mask bytes.
   *
   * @private
   */
  getMask() {
    if (this._bufferedBytes < 4) {
      this._loop = false;
      return;
    }

    this._mask = this.consume(4);
    this._state = GET_DATA;
  }

  /**
   * Reads data bytes.
   *
   * @param {Function} cb Callback
   * @return {(Error|RangeError|undefined)} A possible error
   * @private
   */
  getData(cb) {
    let data = EMPTY_BUFFER;

    if (this._payloadLength) {
      if (this._bufferedBytes < this._payloadLength) {
        this._loop = false;
        return;
      }

      data = this.consume(this._payloadLength);
      if (this._masked) unmask(data, this._mask);
    }

    if (this._opcode > 0x07) return this.controlMessage(data);

    if (this._compressed) {
      this._state = INFLATING;
      this.decompress(data, cb);
      return;
    }

    if (data.length) {
      //
      // This message is not compressed so its lenght is the sum of the payload
      // length of all fragments.
      //
      this._messageLength = this._totalPayloadLength;
      this._fragments.push(data);
    }

    return this.dataMessage();
  }

  /**
   * Decompresses data.
   *
   * @param {Buffer} data Compressed data
   * @param {Function} cb Callback
   * @private
   */
  decompress(data, cb) {
    const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];

    perMessageDeflate.decompress(data, this._fin, (err, buf) => {
      if (err) return cb(err);

      if (buf.length) {
        this._messageLength += buf.length;
        if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
          return cb(
            error(
              RangeError,
              'Max payload size exceeded',
              false,
              1009,
              'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH'
            )
          );
        }

        this._fragments.push(buf);
      }

      const er = this.dataMessage();
      if (er) return cb(er);

      this.startLoop(cb);
    });
  }

  /**
   * Handles a data message.
   *
   * @return {(Error|undefined)} A possible error
   * @private
   */
  dataMessage() {
    if (this._fin) {
      const messageLength = this._messageLength;
      const fragments = this._fragments;

      this._totalPayloadLength = 0;
      this._messageLength = 0;
      this._fragmented = 0;
      this._fragments = [];

      if (this._opcode === 2) {
        let data;

        if (this._binaryType === 'nodebuffer') {
          data = concat(fragments, messageLength);
        } else if (this._binaryType === 'arraybuffer') {
          data = toArrayBuffer(concat(fragments, messageLength));
        } else {
          data = fragments;
        }

        this.emit('message', data);
      } else {
        const buf = concat(fragments, messageLength);

        if (!isValidUTF8(buf)) {
          this._loop = false;
          return error(
            Error,
            'invalid UTF-8 sequence',
            true,
            1007,
            'WS_ERR_INVALID_UTF8'
          );
        }

        this.emit('message', buf.toString());
      }
    }

    this._state = GET_INFO;
  }

  /**
   * Handles a control message.
   *
   * @param {Buffer} data Data to handle
   * @return {(Error|RangeError|undefined)} A possible error
   * @private
   */
  controlMessage(data) {
    if (this._opcode === 0x08) {
      this._loop = false;

      if (data.length === 0) {
        this.emit('conclude', 1005, '');
        this.end();
      } else if (data.length === 1) {
        return error(
          RangeError,
          'invalid payload length 1',
          true,
          1002,
          'WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH'
        );
      } else {
        const code = data.readUInt16BE(0);

        if (!isValidStatusCode(code)) {
          return error(
            RangeError,
            `invalid status code ${code}`,
            true,
            1002,
            'WS_ERR_INVALID_CLOSE_CODE'
          );
        }

        const buf = data.slice(2);

        if (!isValidUTF8(buf)) {
          return error(
            Error,
            'invalid UTF-8 sequence',
            true,
            1007,
            'WS_ERR_INVALID_UTF8'
          );
        }

        this.emit('conclude', code, buf.toString());
        this.end();
      }
    } else if (this._opcode === 0x09) {
      this.emit('ping', data);
    } else {
      this.emit('pong', data);
    }

    this._state = GET_INFO;
  }
}

module.exports = Receiver;

/**
 * Builds an error object.
 *
 * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
 * @param {String} message The error message
 * @param {Boolean} prefix Specifies whether or not to add a default prefix to
 *     `message`
 * @param {Number} statusCode The status code
 * @param {String} errorCode The exposed error code
 * @return {(Error|RangeError)} The error
 * @private
 */
function error(ErrorCtor, message, prefix, statusCode, errorCode) {
  const err = new ErrorCtor(
    prefix ? `Invalid WebSocket frame: ${message}` : message
  );

  Error.captureStackTrace(err, error);
  err.code = errorCode;
  err[kStatusCode] = statusCode;
  return err;
}

},{"./buffer-util":73,"./constants":74,"./permessage-deflate":78,"./validation":82,"stream":undefined}],80:[function(require,module,exports){
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^net|tls$" }] */

'use strict';

const net = require('net');
const tls = require('tls');
const { randomFillSync } = require('crypto');

const PerMessageDeflate = require('./permessage-deflate');
const { EMPTY_BUFFER } = require('./constants');
const { isValidStatusCode } = require('./validation');
const { mask: applyMask, toBuffer } = require('./buffer-util');

const mask = Buffer.alloc(4);

/**
 * HyBi Sender implementation.
 */
class Sender {
  /**
   * Creates a Sender instance.
   *
   * @param {(net.Socket|tls.Socket)} socket The connection socket
   * @param {Object} [extensions] An object containing the negotiated extensions
   */
  constructor(socket, extensions) {
    this._extensions = extensions || {};
    this._socket = socket;

    this._firstFragment = true;
    this._compress = false;

    this._bufferedBytes = 0;
    this._deflating = false;
    this._queue = [];
  }

  /**
   * Frames a piece of data according to the HyBi WebSocket protocol.
   *
   * @param {Buffer} data The data to frame
   * @param {Object} options Options object
   * @param {Number} options.opcode The opcode
   * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
   *     modified
   * @param {Boolean} [options.fin=false] Specifies whether or not to set the
   *     FIN bit
   * @param {Boolean} [options.mask=false] Specifies whether or not to mask
   *     `data`
   * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
   *     RSV1 bit
   * @return {Buffer[]} The framed data as a list of `Buffer` instances
   * @public
   */
  static frame(data, options) {
    const merge = options.mask && options.readOnly;
    let offset = options.mask ? 6 : 2;
    let payloadLength = data.length;

    if (data.length >= 65536) {
      offset += 8;
      payloadLength = 127;
    } else if (data.length > 125) {
      offset += 2;
      payloadLength = 126;
    }

    const target = Buffer.allocUnsafe(merge ? data.length + offset : offset);

    target[0] = options.fin ? options.opcode | 0x80 : options.opcode;
    if (options.rsv1) target[0] |= 0x40;

    target[1] = payloadLength;

    if (payloadLength === 126) {
      target.writeUInt16BE(data.length, 2);
    } else if (payloadLength === 127) {
      target.writeUInt32BE(0, 2);
      target.writeUInt32BE(data.length, 6);
    }

    if (!options.mask) return [target, data];

    randomFillSync(mask, 0, 4);

    target[1] |= 0x80;
    target[offset - 4] = mask[0];
    target[offset - 3] = mask[1];
    target[offset - 2] = mask[2];
    target[offset - 1] = mask[3];

    if (merge) {
      applyMask(data, mask, target, offset, data.length);
      return [target];
    }

    applyMask(data, mask, data, 0, data.length);
    return [target, data];
  }

  /**
   * Sends a close message to the other peer.
   *
   * @param {Number} [code] The status code component of the body
   * @param {String} [data] The message component of the body
   * @param {Boolean} [mask=false] Specifies whether or not to mask the message
   * @param {Function} [cb] Callback
   * @public
   */
  close(code, data, mask, cb) {
    let buf;

    if (code === undefined) {
      buf = EMPTY_BUFFER;
    } else if (typeof code !== 'number' || !isValidStatusCode(code)) {
      throw new TypeError('First argument must be a valid error code number');
    } else if (data === undefined || data === '') {
      buf = Buffer.allocUnsafe(2);
      buf.writeUInt16BE(code, 0);
    } else {
      const length = Buffer.byteLength(data);

      if (length > 123) {
        throw new RangeError('The message must not be greater than 123 bytes');
      }

      buf = Buffer.allocUnsafe(2 + length);
      buf.writeUInt16BE(code, 0);
      buf.write(data, 2);
    }

    if (this._deflating) {
      this.enqueue([this.doClose, buf, mask, cb]);
    } else {
      this.doClose(buf, mask, cb);
    }
  }

  /**
   * Frames and sends a close message.
   *
   * @param {Buffer} data The message to send
   * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
   * @param {Function} [cb] Callback
   * @private
   */
  doClose(data, mask, cb) {
    this.sendFrame(
      Sender.frame(data, {
        fin: true,
        rsv1: false,
        opcode: 0x08,
        mask,
        readOnly: false
      }),
      cb
    );
  }

  /**
   * Sends a ping message to the other peer.
   *
   * @param {*} data The message to send
   * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
   * @param {Function} [cb] Callback
   * @public
   */
  ping(data, mask, cb) {
    const buf = toBuffer(data);

    if (buf.length > 125) {
      throw new RangeError('The data size must not be greater than 125 bytes');
    }

    if (this._deflating) {
      this.enqueue([this.doPing, buf, mask, toBuffer.readOnly, cb]);
    } else {
      this.doPing(buf, mask, toBuffer.readOnly, cb);
    }
  }

  /**
   * Frames and sends a ping message.
   *
   * @param {Buffer} data The message to send
   * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
   * @param {Boolean} [readOnly=false] Specifies whether `data` can be modified
   * @param {Function} [cb] Callback
   * @private
   */
  doPing(data, mask, readOnly, cb) {
    this.sendFrame(
      Sender.frame(data, {
        fin: true,
        rsv1: false,
        opcode: 0x09,
        mask,
        readOnly
      }),
      cb
    );
  }

  /**
   * Sends a pong message to the other peer.
   *
   * @param {*} data The message to send
   * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
   * @param {Function} [cb] Callback
   * @public
   */
  pong(data, mask, cb) {
    const buf = toBuffer(data);

    if (buf.length > 125) {
      throw new RangeError('The data size must not be greater than 125 bytes');
    }

    if (this._deflating) {
      this.enqueue([this.doPong, buf, mask, toBuffer.readOnly, cb]);
    } else {
      this.doPong(buf, mask, toBuffer.readOnly, cb);
    }
  }

  /**
   * Frames and sends a pong message.
   *
   * @param {Buffer} data The message to send
   * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
   * @param {Boolean} [readOnly=false] Specifies whether `data` can be modified
   * @param {Function} [cb] Callback
   * @private
   */
  doPong(data, mask, readOnly, cb) {
    this.sendFrame(
      Sender.frame(data, {
        fin: true,
        rsv1: false,
        opcode: 0x0a,
        mask,
        readOnly
      }),
      cb
    );
  }

  /**
   * Sends a data message to the other peer.
   *
   * @param {*} data The message to send
   * @param {Object} options Options object
   * @param {Boolean} [options.compress=false] Specifies whether or not to
   *     compress `data`
   * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
   *     or text
   * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
   *     last one
   * @param {Boolean} [options.mask=false] Specifies whether or not to mask
   *     `data`
   * @param {Function} [cb] Callback
   * @public
   */
  send(data, options, cb) {
    const buf = toBuffer(data);
    const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
    let opcode = options.binary ? 2 : 1;
    let rsv1 = options.compress;

    if (this._firstFragment) {
      this._firstFragment = false;
      if (rsv1 && perMessageDeflate) {
        rsv1 = buf.length >= perMessageDeflate._threshold;
      }
      this._compress = rsv1;
    } else {
      rsv1 = false;
      opcode = 0;
    }

    if (options.fin) this._firstFragment = true;

    if (perMessageDeflate) {
      const opts = {
        fin: options.fin,
        rsv1,
        opcode,
        mask: options.mask,
        readOnly: toBuffer.readOnly
      };

      if (this._deflating) {
        this.enqueue([this.dispatch, buf, this._compress, opts, cb]);
      } else {
        this.dispatch(buf, this._compress, opts, cb);
      }
    } else {
      this.sendFrame(
        Sender.frame(buf, {
          fin: options.fin,
          rsv1: false,
          opcode,
          mask: options.mask,
          readOnly: toBuffer.readOnly
        }),
        cb
      );
    }
  }

  /**
   * Dispatches a data message.
   *
   * @param {Buffer} data The message to send
   * @param {Boolean} [compress=false] Specifies whether or not to compress
   *     `data`
   * @param {Object} options Options object
   * @param {Number} options.opcode The opcode
   * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
   *     modified
   * @param {Boolean} [options.fin=false] Specifies whether or not to set the
   *     FIN bit
   * @param {Boolean} [options.mask=false] Specifies whether or not to mask
   *     `data`
   * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
   *     RSV1 bit
   * @param {Function} [cb] Callback
   * @private
   */
  dispatch(data, compress, options, cb) {
    if (!compress) {
      this.sendFrame(Sender.frame(data, options), cb);
      return;
    }

    const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];

    this._bufferedBytes += data.length;
    this._deflating = true;
    perMessageDeflate.compress(data, options.fin, (_, buf) => {
      if (this._socket.destroyed) {
        const err = new Error(
          'The socket was closed while data was being compressed'
        );

        if (typeof cb === 'function') cb(err);

        for (let i = 0; i < this._queue.length; i++) {
          const callback = this._queue[i][4];

          if (typeof callback === 'function') callback(err);
        }

        return;
      }

      this._bufferedBytes -= data.length;
      this._deflating = false;
      options.readOnly = false;
      this.sendFrame(Sender.frame(buf, options), cb);
      this.dequeue();
    });
  }

  /**
   * Executes queued send operations.
   *
   * @private
   */
  dequeue() {
    while (!this._deflating && this._queue.length) {
      const params = this._queue.shift();

      this._bufferedBytes -= params[1].length;
      Reflect.apply(params[0], this, params.slice(1));
    }
  }

  /**
   * Enqueues a send operation.
   *
   * @param {Array} params Send operation parameters.
   * @private
   */
  enqueue(params) {
    this._bufferedBytes += params[1].length;
    this._queue.push(params);
  }

  /**
   * Sends a frame.
   *
   * @param {Buffer[]} list The frame to send
   * @param {Function} [cb] Callback
   * @private
   */
  sendFrame(list, cb) {
    if (list.length === 2) {
      this._socket.cork();
      this._socket.write(list[0]);
      this._socket.write(list[1], cb);
      this._socket.uncork();
    } else {
      this._socket.write(list[0], cb);
    }
  }
}

module.exports = Sender;

},{"./buffer-util":73,"./constants":74,"./permessage-deflate":78,"./validation":82,"crypto":undefined,"net":undefined,"tls":undefined}],81:[function(require,module,exports){
'use strict';

const { Duplex } = require('stream');

/**
 * Emits the `'close'` event on a stream.
 *
 * @param {Duplex} stream The stream.
 * @private
 */
function emitClose(stream) {
  stream.emit('close');
}

/**
 * The listener of the `'end'` event.
 *
 * @private
 */
function duplexOnEnd() {
  if (!this.destroyed && this._writableState.finished) {
    this.destroy();
  }
}

/**
 * The listener of the `'error'` event.
 *
 * @param {Error} err The error
 * @private
 */
function duplexOnError(err) {
  this.removeListener('error', duplexOnError);
  this.destroy();
  if (this.listenerCount('error') === 0) {
    // Do not suppress the throwing behavior.
    this.emit('error', err);
  }
}

/**
 * Wraps a `WebSocket` in a duplex stream.
 *
 * @param {WebSocket} ws The `WebSocket` to wrap
 * @param {Object} [options] The options for the `Duplex` constructor
 * @return {Duplex} The duplex stream
 * @public
 */
function createWebSocketStream(ws, options) {
  let resumeOnReceiverDrain = true;
  let terminateOnDestroy = true;

  function receiverOnDrain() {
    if (resumeOnReceiverDrain) ws._socket.resume();
  }

  if (ws.readyState === ws.CONNECTING) {
    ws.once('open', function open() {
      ws._receiver.removeAllListeners('drain');
      ws._receiver.on('drain', receiverOnDrain);
    });
  } else {
    ws._receiver.removeAllListeners('drain');
    ws._receiver.on('drain', receiverOnDrain);
  }

  const duplex = new Duplex({
    ...options,
    autoDestroy: false,
    emitClose: false,
    objectMode: false,
    writableObjectMode: false
  });

  ws.on('message', function message(msg) {
    if (!duplex.push(msg)) {
      resumeOnReceiverDrain = false;
      ws._socket.pause();
    }
  });

  ws.once('error', function error(err) {
    if (duplex.destroyed) return;

    // Prevent `ws.terminate()` from being called by `duplex._destroy()`.
    //
    // - If the `'error'` event is emitted before the `'open'` event, then
    //   `ws.terminate()` is a noop as no socket is assigned.
    // - Otherwise, the error is re-emitted by the listener of the `'error'`
    //   event of the `Receiver` object. The listener already closes the
    //   connection by calling `ws.close()`. This allows a close frame to be
    //   sent to the other peer. If `ws.terminate()` is called right after this,
    //   then the close frame might not be sent.
    terminateOnDestroy = false;
    duplex.destroy(err);
  });

  ws.once('close', function close() {
    if (duplex.destroyed) return;

    duplex.push(null);
  });

  duplex._destroy = function (err, callback) {
    if (ws.readyState === ws.CLOSED) {
      callback(err);
      process.nextTick(emitClose, duplex);
      return;
    }

    let called = false;

    ws.once('error', function error(err) {
      called = true;
      callback(err);
    });

    ws.once('close', function close() {
      if (!called) callback(err);
      process.nextTick(emitClose, duplex);
    });

    if (terminateOnDestroy) ws.terminate();
  };

  duplex._final = function (callback) {
    if (ws.readyState === ws.CONNECTING) {
      ws.once('open', function open() {
        duplex._final(callback);
      });
      return;
    }

    // If the value of the `_socket` property is `null` it means that `ws` is a
    // client websocket and the handshake failed. In fact, when this happens, a
    // socket is never assigned to the websocket. Wait for the `'error'` event
    // that will be emitted by the websocket.
    if (ws._socket === null) return;

    if (ws._socket._writableState.finished) {
      callback();
      if (duplex._readableState.endEmitted) duplex.destroy();
    } else {
      ws._socket.once('finish', function finish() {
        // `duplex` is not destroyed here because the `'end'` event will be
        // emitted on `duplex` after this `'finish'` event. The EOF signaling
        // `null` chunk is, in fact, pushed when the websocket emits `'close'`.
        callback();
      });
      ws.close();
    }
  };

  duplex._read = function () {
    if (
      (ws.readyState === ws.OPEN || ws.readyState === ws.CLOSING) &&
      !resumeOnReceiverDrain
    ) {
      resumeOnReceiverDrain = true;
      if (!ws._receiver._writableState.needDrain) ws._socket.resume();
    }
  };

  duplex._write = function (chunk, encoding, callback) {
    if (ws.readyState === ws.CONNECTING) {
      ws.once('open', function open() {
        duplex._write(chunk, encoding, callback);
      });
      return;
    }

    ws.send(chunk, callback);
  };

  duplex.on('end', duplexOnEnd);
  duplex.on('error', duplexOnError);
  return duplex;
}

module.exports = createWebSocketStream;

},{"stream":undefined}],82:[function(require,module,exports){
'use strict';

/**
 * Checks if a status code is allowed in a close frame.
 *
 * @param {Number} code The status code
 * @return {Boolean} `true` if the status code is valid, else `false`
 * @public
 */
function isValidStatusCode(code) {
  return (
    (code >= 1000 &&
      code <= 1014 &&
      code !== 1004 &&
      code !== 1005 &&
      code !== 1006) ||
    (code >= 3000 && code <= 4999)
  );
}

/**
 * Checks if a given buffer contains only correct UTF-8.
 * Ported from https://www.cl.cam.ac.uk/%7Emgk25/ucs/utf8_check.c by
 * Markus Kuhn.
 *
 * @param {Buffer} buf The buffer to check
 * @return {Boolean} `true` if `buf` contains only correct UTF-8, else `false`
 * @public
 */
function _isValidUTF8(buf) {
  const len = buf.length;
  let i = 0;

  while (i < len) {
    if ((buf[i] & 0x80) === 0) {
      // 0xxxxxxx
      i++;
    } else if ((buf[i] & 0xe0) === 0xc0) {
      // 110xxxxx 10xxxxxx
      if (
        i + 1 === len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i] & 0xfe) === 0xc0 // Overlong
      ) {
        return false;
      }

      i += 2;
    } else if ((buf[i] & 0xf0) === 0xe0) {
      // 1110xxxx 10xxxxxx 10xxxxxx
      if (
        i + 2 >= len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i + 2] & 0xc0) !== 0x80 ||
        (buf[i] === 0xe0 && (buf[i + 1] & 0xe0) === 0x80) || // Overlong
        (buf[i] === 0xed && (buf[i + 1] & 0xe0) === 0xa0) // Surrogate (U+D800 - U+DFFF)
      ) {
        return false;
      }

      i += 3;
    } else if ((buf[i] & 0xf8) === 0xf0) {
      // 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
      if (
        i + 3 >= len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i + 2] & 0xc0) !== 0x80 ||
        (buf[i + 3] & 0xc0) !== 0x80 ||
        (buf[i] === 0xf0 && (buf[i + 1] & 0xf0) === 0x80) || // Overlong
        (buf[i] === 0xf4 && buf[i + 1] > 0x8f) ||
        buf[i] > 0xf4 // > U+10FFFF
      ) {
        return false;
      }

      i += 4;
    } else {
      return false;
    }
  }

  return true;
}

try {
  let isValidUTF8 = require('utf-8-validate');

  /* istanbul ignore if */
  if (typeof isValidUTF8 === 'object') {
    isValidUTF8 = isValidUTF8.Validation.isValidUTF8; // utf-8-validate@<3.0.0
  }

  module.exports = {
    isValidStatusCode,
    isValidUTF8(buf) {
      return buf.length < 150 ? _isValidUTF8(buf) : isValidUTF8(buf);
    }
  };
} catch (e) /* istanbul ignore next */ {
  module.exports = {
    isValidStatusCode,
    isValidUTF8: _isValidUTF8
  };
}

},{"utf-8-validate":57}],83:[function(require,module,exports){
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^net|tls|https$" }] */

'use strict';

const EventEmitter = require('events');
const http = require('http');
const https = require('https');
const net = require('net');
const tls = require('tls');
const { createHash } = require('crypto');

const PerMessageDeflate = require('./permessage-deflate');
const WebSocket = require('./websocket');
const { format, parse } = require('./extension');
const { GUID, kWebSocket } = require('./constants');

const keyRegex = /^[+/0-9A-Za-z]{22}==$/;

const RUNNING = 0;
const CLOSING = 1;
const CLOSED = 2;

/**
 * Class representing a WebSocket server.
 *
 * @extends EventEmitter
 */
class WebSocketServer extends EventEmitter {
  /**
   * Create a `WebSocketServer` instance.
   *
   * @param {Object} options Configuration options
   * @param {Number} [options.backlog=511] The maximum length of the queue of
   *     pending connections
   * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
   *     track clients
   * @param {Function} [options.handleProtocols] A hook to handle protocols
   * @param {String} [options.host] The hostname where to bind the server
   * @param {Number} [options.maxPayload=104857600] The maximum allowed message
   *     size
   * @param {Boolean} [options.noServer=false] Enable no server mode
   * @param {String} [options.path] Accept only connections matching this path
   * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
   *     permessage-deflate
   * @param {Number} [options.port] The port where to bind the server
   * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
   *     server to use
   * @param {Function} [options.verifyClient] A hook to reject connections
   * @param {Function} [callback] A listener for the `listening` event
   */
  constructor(options, callback) {
    super();

    options = {
      maxPayload: 100 * 1024 * 1024,
      perMessageDeflate: false,
      handleProtocols: null,
      clientTracking: true,
      verifyClient: null,
      noServer: false,
      backlog: null, // use default (511 as implemented in net.js)
      server: null,
      host: null,
      path: null,
      port: null,
      ...options
    };

    if (
      (options.port == null && !options.server && !options.noServer) ||
      (options.port != null && (options.server || options.noServer)) ||
      (options.server && options.noServer)
    ) {
      throw new TypeError(
        'One and only one of the "port", "server", or "noServer" options ' +
          'must be specified'
      );
    }

    if (options.port != null) {
      this._server = http.createServer((req, res) => {
        const body = http.STATUS_CODES[426];

        res.writeHead(426, {
          'Content-Length': body.length,
          'Content-Type': 'text/plain'
        });
        res.end(body);
      });
      this._server.listen(
        options.port,
        options.host,
        options.backlog,
        callback
      );
    } else if (options.server) {
      this._server = options.server;
    }

    if (this._server) {
      const emitConnection = this.emit.bind(this, 'connection');

      this._removeListeners = addListeners(this._server, {
        listening: this.emit.bind(this, 'listening'),
        error: this.emit.bind(this, 'error'),
        upgrade: (req, socket, head) => {
          this.handleUpgrade(req, socket, head, emitConnection);
        }
      });
    }

    if (options.perMessageDeflate === true) options.perMessageDeflate = {};
    if (options.clientTracking) this.clients = new Set();
    this.options = options;
    this._state = RUNNING;
  }

  /**
   * Returns the bound address, the address family name, and port of the server
   * as reported by the operating system if listening on an IP socket.
   * If the server is listening on a pipe or UNIX domain socket, the name is
   * returned as a string.
   *
   * @return {(Object|String|null)} The address of the server
   * @public
   */
  address() {
    if (this.options.noServer) {
      throw new Error('The server is operating in "noServer" mode');
    }

    if (!this._server) return null;
    return this._server.address();
  }

  /**
   * Close the server.
   *
   * @param {Function} [cb] Callback
   * @public
   */
  close(cb) {
    if (cb) this.once('close', cb);

    if (this._state === CLOSED) {
      process.nextTick(emitClose, this);
      return;
    }

    if (this._state === CLOSING) return;
    this._state = CLOSING;

    //
    // Terminate all associated clients.
    //
    if (this.clients) {
      for (const client of this.clients) client.terminate();
    }

    const server = this._server;

    if (server) {
      this._removeListeners();
      this._removeListeners = this._server = null;

      //
      // Close the http server if it was internally created.
      //
      if (this.options.port != null) {
        server.close(emitClose.bind(undefined, this));
        return;
      }
    }

    process.nextTick(emitClose, this);
  }

  /**
   * See if a given request should be handled by this server instance.
   *
   * @param {http.IncomingMessage} req Request object to inspect
   * @return {Boolean} `true` if the request is valid, else `false`
   * @public
   */
  shouldHandle(req) {
    if (this.options.path) {
      const index = req.url.indexOf('?');
      const pathname = index !== -1 ? req.url.slice(0, index) : req.url;

      if (pathname !== this.options.path) return false;
    }

    return true;
  }

  /**
   * Handle a HTTP Upgrade request.
   *
   * @param {http.IncomingMessage} req The request object
   * @param {(net.Socket|tls.Socket)} socket The network socket between the
   *     server and client
   * @param {Buffer} head The first packet of the upgraded stream
   * @param {Function} cb Callback
   * @public
   */
  handleUpgrade(req, socket, head, cb) {
    socket.on('error', socketOnError);

    const key =
      req.headers['sec-websocket-key'] !== undefined
        ? req.headers['sec-websocket-key'].trim()
        : false;
    const upgrade = req.headers.upgrade;
    const version = +req.headers['sec-websocket-version'];
    const extensions = {};

    if (
      req.method !== 'GET' ||
      upgrade === undefined ||
      upgrade.toLowerCase() !== 'websocket' ||
      !key ||
      !keyRegex.test(key) ||
      (version !== 8 && version !== 13) ||
      !this.shouldHandle(req)
    ) {
      return abortHandshake(socket, 400);
    }

    if (this.options.perMessageDeflate) {
      const perMessageDeflate = new PerMessageDeflate(
        this.options.perMessageDeflate,
        true,
        this.options.maxPayload
      );

      try {
        const offers = parse(req.headers['sec-websocket-extensions']);

        if (offers[PerMessageDeflate.extensionName]) {
          perMessageDeflate.accept(offers[PerMessageDeflate.extensionName]);
          extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
        }
      } catch (err) {
        return abortHandshake(socket, 400);
      }
    }

    //
    // Optionally call external client verification handler.
    //
    if (this.options.verifyClient) {
      const info = {
        origin:
          req.headers[`${version === 8 ? 'sec-websocket-origin' : 'origin'}`],
        secure: !!(req.socket.authorized || req.socket.encrypted),
        req
      };

      if (this.options.verifyClient.length === 2) {
        this.options.verifyClient(info, (verified, code, message, headers) => {
          if (!verified) {
            return abortHandshake(socket, code || 401, message, headers);
          }

          this.completeUpgrade(key, extensions, req, socket, head, cb);
        });
        return;
      }

      if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
    }

    this.completeUpgrade(key, extensions, req, socket, head, cb);
  }

  /**
   * Upgrade the connection to WebSocket.
   *
   * @param {String} key The value of the `Sec-WebSocket-Key` header
   * @param {Object} extensions The accepted extensions
   * @param {http.IncomingMessage} req The request object
   * @param {(net.Socket|tls.Socket)} socket The network socket between the
   *     server and client
   * @param {Buffer} head The first packet of the upgraded stream
   * @param {Function} cb Callback
   * @throws {Error} If called more than once with the same socket
   * @private
   */
  completeUpgrade(key, extensions, req, socket, head, cb) {
    //
    // Destroy the socket if the client has already sent a FIN packet.
    //
    if (!socket.readable || !socket.writable) return socket.destroy();

    if (socket[kWebSocket]) {
      throw new Error(
        'server.handleUpgrade() was called more than once with the same ' +
          'socket, possibly due to a misconfiguration'
      );
    }

    if (this._state > RUNNING) return abortHandshake(socket, 503);

    const digest = createHash('sha1')
      .update(key + GUID)
      .digest('base64');

    const headers = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${digest}`
    ];

    const ws = new WebSocket(null);
    let protocol = req.headers['sec-websocket-protocol'];

    if (protocol) {
      protocol = protocol.split(',').map(trim);

      //
      // Optionally call external protocol selection handler.
      //
      if (this.options.handleProtocols) {
        protocol = this.options.handleProtocols(protocol, req);
      } else {
        protocol = protocol[0];
      }

      if (protocol) {
        headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
        ws._protocol = protocol;
      }
    }

    if (extensions[PerMessageDeflate.extensionName]) {
      const params = extensions[PerMessageDeflate.extensionName].params;
      const value = format({
        [PerMessageDeflate.extensionName]: [params]
      });
      headers.push(`Sec-WebSocket-Extensions: ${value}`);
      ws._extensions = extensions;
    }

    //
    // Allow external modification/inspection of handshake headers.
    //
    this.emit('headers', headers, req);

    socket.write(headers.concat('\r\n').join('\r\n'));
    socket.removeListener('error', socketOnError);

    ws.setSocket(socket, head, this.options.maxPayload);

    if (this.clients) {
      this.clients.add(ws);
      ws.on('close', () => this.clients.delete(ws));
    }

    cb(ws, req);
  }
}

module.exports = WebSocketServer;

/**
 * Add event listeners on an `EventEmitter` using a map of <event, listener>
 * pairs.
 *
 * @param {EventEmitter} server The event emitter
 * @param {Object.<String, Function>} map The listeners to add
 * @return {Function} A function that will remove the added listeners when
 *     called
 * @private
 */
function addListeners(server, map) {
  for (const event of Object.keys(map)) server.on(event, map[event]);

  return function removeListeners() {
    for (const event of Object.keys(map)) {
      server.removeListener(event, map[event]);
    }
  };
}

/**
 * Emit a `'close'` event on an `EventEmitter`.
 *
 * @param {EventEmitter} server The event emitter
 * @private
 */
function emitClose(server) {
  server._state = CLOSED;
  server.emit('close');
}

/**
 * Handle premature socket errors.
 *
 * @private
 */
function socketOnError() {
  this.destroy();
}

/**
 * Close the connection when preconditions are not fulfilled.
 *
 * @param {(net.Socket|tls.Socket)} socket The socket of the upgrade request
 * @param {Number} code The HTTP response status code
 * @param {String} [message] The HTTP response body
 * @param {Object} [headers] Additional HTTP response headers
 * @private
 */
function abortHandshake(socket, code, message, headers) {
  if (socket.writable) {
    message = message || http.STATUS_CODES[code];
    headers = {
      Connection: 'close',
      'Content-Type': 'text/html',
      'Content-Length': Buffer.byteLength(message),
      ...headers
    };

    socket.write(
      `HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r\n` +
        Object.keys(headers)
          .map((h) => `${h}: ${headers[h]}`)
          .join('\r\n') +
        '\r\n\r\n' +
        message
    );
  }

  socket.removeListener('error', socketOnError);
  socket.destroy();
}

/**
 * Remove whitespace characters from both ends of a string.
 *
 * @param {String} str The string
 * @return {String} A new string representing `str` stripped of whitespace
 *     characters from both its beginning and end
 * @private
 */
function trim(str) {
  return str.trim();
}

},{"./constants":74,"./extension":76,"./permessage-deflate":78,"./websocket":84,"crypto":undefined,"events":undefined,"http":undefined,"https":undefined,"net":undefined,"tls":undefined}],84:[function(require,module,exports){
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^Readable$" }] */

'use strict';

const EventEmitter = require('events');
const https = require('https');
const http = require('http');
const net = require('net');
const tls = require('tls');
const { randomBytes, createHash } = require('crypto');
const { Readable } = require('stream');
const { URL } = require('url');

const PerMessageDeflate = require('./permessage-deflate');
const Receiver = require('./receiver');
const Sender = require('./sender');
const {
  BINARY_TYPES,
  EMPTY_BUFFER,
  GUID,
  kStatusCode,
  kWebSocket,
  NOOP
} = require('./constants');
const { addEventListener, removeEventListener } = require('./event-target');
const { format, parse } = require('./extension');
const { toBuffer } = require('./buffer-util');

const readyStates = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
const protocolVersions = [8, 13];
const closeTimeout = 30 * 1000;

/**
 * Class representing a WebSocket.
 *
 * @extends EventEmitter
 */
class WebSocket extends EventEmitter {
  /**
   * Create a new `WebSocket`.
   *
   * @param {(String|URL)} address The URL to which to connect
   * @param {(String|String[])} [protocols] The subprotocols
   * @param {Object} [options] Connection options
   */
  constructor(address, protocols, options) {
    super();

    this._binaryType = BINARY_TYPES[0];
    this._closeCode = 1006;
    this._closeFrameReceived = false;
    this._closeFrameSent = false;
    this._closeMessage = '';
    this._closeTimer = null;
    this._extensions = {};
    this._protocol = '';
    this._readyState = WebSocket.CONNECTING;
    this._receiver = null;
    this._sender = null;
    this._socket = null;

    if (address !== null) {
      this._bufferedAmount = 0;
      this._isServer = false;
      this._redirects = 0;

      if (Array.isArray(protocols)) {
        protocols = protocols.join(', ');
      } else if (typeof protocols === 'object' && protocols !== null) {
        options = protocols;
        protocols = undefined;
      }

      initAsClient(this, address, protocols, options);
    } else {
      this._isServer = true;
    }
  }

  /**
   * This deviates from the WHATWG interface since ws doesn't support the
   * required default "blob" type (instead we define a custom "nodebuffer"
   * type).
   *
   * @type {String}
   */
  get binaryType() {
    return this._binaryType;
  }

  set binaryType(type) {
    if (!BINARY_TYPES.includes(type)) return;

    this._binaryType = type;

    //
    // Allow to change `binaryType` on the fly.
    //
    if (this._receiver) this._receiver._binaryType = type;
  }

  /**
   * @type {Number}
   */
  get bufferedAmount() {
    if (!this._socket) return this._bufferedAmount;

    return this._socket._writableState.length + this._sender._bufferedBytes;
  }

  /**
   * @type {String}
   */
  get extensions() {
    return Object.keys(this._extensions).join();
  }

  /**
   * @type {Function}
   */
  /* istanbul ignore next */
  get onclose() {
    return undefined;
  }

  /* istanbul ignore next */
  set onclose(listener) {}

  /**
   * @type {Function}
   */
  /* istanbul ignore next */
  get onerror() {
    return undefined;
  }

  /* istanbul ignore next */
  set onerror(listener) {}

  /**
   * @type {Function}
   */
  /* istanbul ignore next */
  get onopen() {
    return undefined;
  }

  /* istanbul ignore next */
  set onopen(listener) {}

  /**
   * @type {Function}
   */
  /* istanbul ignore next */
  get onmessage() {
    return undefined;
  }

  /* istanbul ignore next */
  set onmessage(listener) {}

  /**
   * @type {String}
   */
  get protocol() {
    return this._protocol;
  }

  /**
   * @type {Number}
   */
  get readyState() {
    return this._readyState;
  }

  /**
   * @type {String}
   */
  get url() {
    return this._url;
  }

  /**
   * Set up the socket and the internal resources.
   *
   * @param {(net.Socket|tls.Socket)} socket The network socket between the
   *     server and client
   * @param {Buffer} head The first packet of the upgraded stream
   * @param {Number} [maxPayload=0] The maximum allowed message size
   * @private
   */
  setSocket(socket, head, maxPayload) {
    const receiver = new Receiver(
      this.binaryType,
      this._extensions,
      this._isServer,
      maxPayload
    );

    this._sender = new Sender(socket, this._extensions);
    this._receiver = receiver;
    this._socket = socket;

    receiver[kWebSocket] = this;
    socket[kWebSocket] = this;

    receiver.on('conclude', receiverOnConclude);
    receiver.on('drain', receiverOnDrain);
    receiver.on('error', receiverOnError);
    receiver.on('message', receiverOnMessage);
    receiver.on('ping', receiverOnPing);
    receiver.on('pong', receiverOnPong);

    socket.setTimeout(0);
    socket.setNoDelay();

    if (head.length > 0) socket.unshift(head);

    socket.on('close', socketOnClose);
    socket.on('data', socketOnData);
    socket.on('end', socketOnEnd);
    socket.on('error', socketOnError);

    this._readyState = WebSocket.OPEN;
    this.emit('open');
  }

  /**
   * Emit the `'close'` event.
   *
   * @private
   */
  emitClose() {
    if (!this._socket) {
      this._readyState = WebSocket.CLOSED;
      this.emit('close', this._closeCode, this._closeMessage);
      return;
    }

    if (this._extensions[PerMessageDeflate.extensionName]) {
      this._extensions[PerMessageDeflate.extensionName].cleanup();
    }

    this._receiver.removeAllListeners();
    this._readyState = WebSocket.CLOSED;
    this.emit('close', this._closeCode, this._closeMessage);
  }

  /**
   * Start a closing handshake.
   *
   *          +----------+   +-----------+   +----------+
   *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
   *    |     +----------+   +-----------+   +----------+     |
   *          +----------+   +-----------+         |
   * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
   *          +----------+   +-----------+   |
   *    |           |                        |   +---+        |
   *                +------------------------+-->|fin| - - - -
   *    |         +---+                      |   +---+
   *     - - - - -|fin|<---------------------+
   *              +---+
   *
   * @param {Number} [code] Status code explaining why the connection is closing
   * @param {String} [data] A string explaining why the connection is closing
   * @public
   */
  close(code, data) {
    if (this.readyState === WebSocket.CLOSED) return;
    if (this.readyState === WebSocket.CONNECTING) {
      const msg = 'WebSocket was closed before the connection was established';
      return abortHandshake(this, this._req, msg);
    }

    if (this.readyState === WebSocket.CLOSING) {
      if (
        this._closeFrameSent &&
        (this._closeFrameReceived || this._receiver._writableState.errorEmitted)
      ) {
        this._socket.end();
      }

      return;
    }

    this._readyState = WebSocket.CLOSING;
    this._sender.close(code, data, !this._isServer, (err) => {
      //
      // This error is handled by the `'error'` listener on the socket. We only
      // want to know if the close frame has been sent here.
      //
      if (err) return;

      this._closeFrameSent = true;

      if (
        this._closeFrameReceived ||
        this._receiver._writableState.errorEmitted
      ) {
        this._socket.end();
      }
    });

    //
    // Specify a timeout for the closing handshake to complete.
    //
    this._closeTimer = setTimeout(
      this._socket.destroy.bind(this._socket),
      closeTimeout
    );
  }

  /**
   * Send a ping.
   *
   * @param {*} [data] The data to send
   * @param {Boolean} [mask] Indicates whether or not to mask `data`
   * @param {Function} [cb] Callback which is executed when the ping is sent
   * @public
   */
  ping(data, mask, cb) {
    if (this.readyState === WebSocket.CONNECTING) {
      throw new Error('WebSocket is not open: readyState 0 (CONNECTING)');
    }

    if (typeof data === 'function') {
      cb = data;
      data = mask = undefined;
    } else if (typeof mask === 'function') {
      cb = mask;
      mask = undefined;
    }

    if (typeof data === 'number') data = data.toString();

    if (this.readyState !== WebSocket.OPEN) {
      sendAfterClose(this, data, cb);
      return;
    }

    if (mask === undefined) mask = !this._isServer;
    this._sender.ping(data || EMPTY_BUFFER, mask, cb);
  }

  /**
   * Send a pong.
   *
   * @param {*} [data] The data to send
   * @param {Boolean} [mask] Indicates whether or not to mask `data`
   * @param {Function} [cb] Callback which is executed when the pong is sent
   * @public
   */
  pong(data, mask, cb) {
    if (this.readyState === WebSocket.CONNECTING) {
      throw new Error('WebSocket is not open: readyState 0 (CONNECTING)');
    }

    if (typeof data === 'function') {
      cb = data;
      data = mask = undefined;
    } else if (typeof mask === 'function') {
      cb = mask;
      mask = undefined;
    }

    if (typeof data === 'number') data = data.toString();

    if (this.readyState !== WebSocket.OPEN) {
      sendAfterClose(this, data, cb);
      return;
    }

    if (mask === undefined) mask = !this._isServer;
    this._sender.pong(data || EMPTY_BUFFER, mask, cb);
  }

  /**
   * Send a data message.
   *
   * @param {*} data The message to send
   * @param {Object} [options] Options object
   * @param {Boolean} [options.compress] Specifies whether or not to compress
   *     `data`
   * @param {Boolean} [options.binary] Specifies whether `data` is binary or
   *     text
   * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
   *     last one
   * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
   * @param {Function} [cb] Callback which is executed when data is written out
   * @public
   */
  send(data, options, cb) {
    if (this.readyState === WebSocket.CONNECTING) {
      throw new Error('WebSocket is not open: readyState 0 (CONNECTING)');
    }

    if (typeof options === 'function') {
      cb = options;
      options = {};
    }

    if (typeof data === 'number') data = data.toString();

    if (this.readyState !== WebSocket.OPEN) {
      sendAfterClose(this, data, cb);
      return;
    }

    const opts = {
      binary: typeof data !== 'string',
      mask: !this._isServer,
      compress: true,
      fin: true,
      ...options
    };

    if (!this._extensions[PerMessageDeflate.extensionName]) {
      opts.compress = false;
    }

    this._sender.send(data || EMPTY_BUFFER, opts, cb);
  }

  /**
   * Forcibly close the connection.
   *
   * @public
   */
  terminate() {
    if (this.readyState === WebSocket.CLOSED) return;
    if (this.readyState === WebSocket.CONNECTING) {
      const msg = 'WebSocket was closed before the connection was established';
      return abortHandshake(this, this._req, msg);
    }

    if (this._socket) {
      this._readyState = WebSocket.CLOSING;
      this._socket.destroy();
    }
  }
}

/**
 * @constant {Number} CONNECTING
 * @memberof WebSocket
 */
Object.defineProperty(WebSocket, 'CONNECTING', {
  enumerable: true,
  value: readyStates.indexOf('CONNECTING')
});

/**
 * @constant {Number} CONNECTING
 * @memberof WebSocket.prototype
 */
Object.defineProperty(WebSocket.prototype, 'CONNECTING', {
  enumerable: true,
  value: readyStates.indexOf('CONNECTING')
});

/**
 * @constant {Number} OPEN
 * @memberof WebSocket
 */
Object.defineProperty(WebSocket, 'OPEN', {
  enumerable: true,
  value: readyStates.indexOf('OPEN')
});

/**
 * @constant {Number} OPEN
 * @memberof WebSocket.prototype
 */
Object.defineProperty(WebSocket.prototype, 'OPEN', {
  enumerable: true,
  value: readyStates.indexOf('OPEN')
});

/**
 * @constant {Number} CLOSING
 * @memberof WebSocket
 */
Object.defineProperty(WebSocket, 'CLOSING', {
  enumerable: true,
  value: readyStates.indexOf('CLOSING')
});

/**
 * @constant {Number} CLOSING
 * @memberof WebSocket.prototype
 */
Object.defineProperty(WebSocket.prototype, 'CLOSING', {
  enumerable: true,
  value: readyStates.indexOf('CLOSING')
});

/**
 * @constant {Number} CLOSED
 * @memberof WebSocket
 */
Object.defineProperty(WebSocket, 'CLOSED', {
  enumerable: true,
  value: readyStates.indexOf('CLOSED')
});

/**
 * @constant {Number} CLOSED
 * @memberof WebSocket.prototype
 */
Object.defineProperty(WebSocket.prototype, 'CLOSED', {
  enumerable: true,
  value: readyStates.indexOf('CLOSED')
});

[
  'binaryType',
  'bufferedAmount',
  'extensions',
  'protocol',
  'readyState',
  'url'
].forEach((property) => {
  Object.defineProperty(WebSocket.prototype, property, { enumerable: true });
});

//
// Add the `onopen`, `onerror`, `onclose`, and `onmessage` attributes.
// See https://html.spec.whatwg.org/multipage/comms.html#the-websocket-interface
//
['open', 'error', 'close', 'message'].forEach((method) => {
  Object.defineProperty(WebSocket.prototype, `on${method}`, {
    enumerable: true,
    get() {
      const listeners = this.listeners(method);
      for (let i = 0; i < listeners.length; i++) {
        if (listeners[i]._listener) return listeners[i]._listener;
      }

      return undefined;
    },
    set(listener) {
      const listeners = this.listeners(method);
      for (let i = 0; i < listeners.length; i++) {
        //
        // Remove only the listeners added via `addEventListener`.
        //
        if (listeners[i]._listener) this.removeListener(method, listeners[i]);
      }
      this.addEventListener(method, listener);
    }
  });
});

WebSocket.prototype.addEventListener = addEventListener;
WebSocket.prototype.removeEventListener = removeEventListener;

module.exports = WebSocket;

/**
 * Initialize a WebSocket client.
 *
 * @param {WebSocket} websocket The client to initialize
 * @param {(String|URL)} address The URL to which to connect
 * @param {String} [protocols] The subprotocols
 * @param {Object} [options] Connection options
 * @param {(Boolean|Object)} [options.perMessageDeflate=true] Enable/disable
 *     permessage-deflate
 * @param {Number} [options.handshakeTimeout] Timeout in milliseconds for the
 *     handshake request
 * @param {Number} [options.protocolVersion=13] Value of the
 *     `Sec-WebSocket-Version` header
 * @param {String} [options.origin] Value of the `Origin` or
 *     `Sec-WebSocket-Origin` header
 * @param {Number} [options.maxPayload=104857600] The maximum allowed message
 *     size
 * @param {Boolean} [options.followRedirects=false] Whether or not to follow
 *     redirects
 * @param {Number} [options.maxRedirects=10] The maximum number of redirects
 *     allowed
 * @private
 */
function initAsClient(websocket, address, protocols, options) {
  const opts = {
    protocolVersion: protocolVersions[1],
    maxPayload: 100 * 1024 * 1024,
    perMessageDeflate: true,
    followRedirects: false,
    maxRedirects: 10,
    ...options,
    createConnection: undefined,
    socketPath: undefined,
    hostname: undefined,
    protocol: undefined,
    timeout: undefined,
    method: undefined,
    host: undefined,
    path: undefined,
    port: undefined
  };

  if (!protocolVersions.includes(opts.protocolVersion)) {
    throw new RangeError(
      `Unsupported protocol version: ${opts.protocolVersion} ` +
        `(supported versions: ${protocolVersions.join(', ')})`
    );
  }

  let parsedUrl;

  if (address instanceof URL) {
    parsedUrl = address;
    websocket._url = address.href;
  } else {
    parsedUrl = new URL(address);
    websocket._url = address;
  }

  const isUnixSocket = parsedUrl.protocol === 'ws+unix:';

  if (!parsedUrl.host && (!isUnixSocket || !parsedUrl.pathname)) {
    const err = new Error(`Invalid URL: ${websocket.url}`);

    if (websocket._redirects === 0) {
      throw err;
    } else {
      emitErrorAndClose(websocket, err);
      return;
    }
  }

  const isSecure =
    parsedUrl.protocol === 'wss:' || parsedUrl.protocol === 'https:';
  const defaultPort = isSecure ? 443 : 80;
  const key = randomBytes(16).toString('base64');
  const get = isSecure ? https.get : http.get;
  let perMessageDeflate;

  opts.createConnection = isSecure ? tlsConnect : netConnect;
  opts.defaultPort = opts.defaultPort || defaultPort;
  opts.port = parsedUrl.port || defaultPort;
  opts.host = parsedUrl.hostname.startsWith('[')
    ? parsedUrl.hostname.slice(1, -1)
    : parsedUrl.hostname;
  opts.headers = {
    'Sec-WebSocket-Version': opts.protocolVersion,
    'Sec-WebSocket-Key': key,
    Connection: 'Upgrade',
    Upgrade: 'websocket',
    ...opts.headers
  };
  opts.path = parsedUrl.pathname + parsedUrl.search;
  opts.timeout = opts.handshakeTimeout;

  if (opts.perMessageDeflate) {
    perMessageDeflate = new PerMessageDeflate(
      opts.perMessageDeflate !== true ? opts.perMessageDeflate : {},
      false,
      opts.maxPayload
    );
    opts.headers['Sec-WebSocket-Extensions'] = format({
      [PerMessageDeflate.extensionName]: perMessageDeflate.offer()
    });
  }
  if (protocols) {
    opts.headers['Sec-WebSocket-Protocol'] = protocols;
  }
  if (opts.origin) {
    if (opts.protocolVersion < 13) {
      opts.headers['Sec-WebSocket-Origin'] = opts.origin;
    } else {
      opts.headers.Origin = opts.origin;
    }
  }
  if (parsedUrl.username || parsedUrl.password) {
    opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
  }

  if (isUnixSocket) {
    const parts = opts.path.split(':');

    opts.socketPath = parts[0];
    opts.path = parts[1];
  }

  if (opts.followRedirects) {
    if (websocket._redirects === 0) {
      websocket._originalUnixSocket = isUnixSocket;
      websocket._originalSecure = isSecure;
      websocket._originalHostOrSocketPath = isUnixSocket
        ? opts.socketPath
        : parsedUrl.host;

      const headers = options && options.headers;

      //
      // Shallow copy the user provided options so that headers can be changed
      // without mutating the original object.
      //
      options = { ...options, headers: {} };

      if (headers) {
        for (const [key, value] of Object.entries(headers)) {
          options.headers[key.toLowerCase()] = value;
        }
      }
    } else {
      const isSameHost = isUnixSocket
        ? websocket._originalUnixSocket
          ? opts.socketPath === websocket._originalHostOrSocketPath
          : false
        : websocket._originalUnixSocket
        ? false
        : parsedUrl.host === websocket._originalHostOrSocketPath;

      if (!isSameHost || (websocket._originalSecure && !isSecure)) {
        //
        // Match curl 7.77.0 behavior and drop the following headers. These
        // headers are also dropped when following a redirect to a subdomain.
        //
        delete opts.headers.authorization;
        delete opts.headers.cookie;

        if (!isSameHost) delete opts.headers.host;

        opts.auth = undefined;
      }
    }

    //
    // Match curl 7.77.0 behavior and make the first `Authorization` header win.
    // If the `Authorization` header is set, then there is nothing to do as it
    // will take precedence.
    //
    if (opts.auth && !options.headers.authorization) {
      options.headers.authorization =
        'Basic ' + Buffer.from(opts.auth).toString('base64');
    }
  }

  let req = (websocket._req = get(opts));

  if (opts.timeout) {
    req.on('timeout', () => {
      abortHandshake(websocket, req, 'Opening handshake has timed out');
    });
  }

  req.on('error', (err) => {
    if (req === null || req.aborted) return;

    req = websocket._req = null;
    emitErrorAndClose(websocket, err);
  });

  req.on('response', (res) => {
    const location = res.headers.location;
    const statusCode = res.statusCode;

    if (
      location &&
      opts.followRedirects &&
      statusCode >= 300 &&
      statusCode < 400
    ) {
      if (++websocket._redirects > opts.maxRedirects) {
        abortHandshake(websocket, req, 'Maximum redirects exceeded');
        return;
      }

      req.abort();

      let addr;

      try {
        addr = new URL(location, address);
      } catch (err) {
        emitErrorAndClose(websocket, err);
        return;
      }

      initAsClient(websocket, addr, protocols, options);
    } else if (!websocket.emit('unexpected-response', req, res)) {
      abortHandshake(
        websocket,
        req,
        `Unexpected server response: ${res.statusCode}`
      );
    }
  });

  req.on('upgrade', (res, socket, head) => {
    websocket.emit('upgrade', res);

    //
    // The user may have closed the connection from a listener of the `upgrade`
    // event.
    //
    if (websocket.readyState !== WebSocket.CONNECTING) return;

    req = websocket._req = null;

    const upgrade = res.headers.upgrade;

    if (upgrade === undefined || upgrade.toLowerCase() !== 'websocket') {
      abortHandshake(websocket, socket, 'Invalid Upgrade header');
      return;
    }

    const digest = createHash('sha1')
      .update(key + GUID)
      .digest('base64');

    if (res.headers['sec-websocket-accept'] !== digest) {
      abortHandshake(websocket, socket, 'Invalid Sec-WebSocket-Accept header');
      return;
    }

    const serverProt = res.headers['sec-websocket-protocol'];
    const protList = (protocols || '').split(/, */);
    let protError;

    if (!protocols && serverProt) {
      protError = 'Server sent a subprotocol but none was requested';
    } else if (protocols && !serverProt) {
      protError = 'Server sent no subprotocol';
    } else if (serverProt && !protList.includes(serverProt)) {
      protError = 'Server sent an invalid subprotocol';
    }

    if (protError) {
      abortHandshake(websocket, socket, protError);
      return;
    }

    if (serverProt) websocket._protocol = serverProt;

    const secWebSocketExtensions = res.headers['sec-websocket-extensions'];

    if (secWebSocketExtensions !== undefined) {
      if (!perMessageDeflate) {
        const message =
          'Server sent a Sec-WebSocket-Extensions header but no extension ' +
          'was requested';
        abortHandshake(websocket, socket, message);
        return;
      }

      let extensions;

      try {
        extensions = parse(secWebSocketExtensions);
      } catch (err) {
        const message = 'Invalid Sec-WebSocket-Extensions header';
        abortHandshake(websocket, socket, message);
        return;
      }

      const extensionNames = Object.keys(extensions);

      if (extensionNames.length) {
        if (
          extensionNames.length !== 1 ||
          extensionNames[0] !== PerMessageDeflate.extensionName
        ) {
          const message =
            'Server indicated an extension that was not requested';
          abortHandshake(websocket, socket, message);
          return;
        }

        try {
          perMessageDeflate.accept(extensions[PerMessageDeflate.extensionName]);
        } catch (err) {
          const message = 'Invalid Sec-WebSocket-Extensions header';
          abortHandshake(websocket, socket, message);
          return;
        }

        websocket._extensions[PerMessageDeflate.extensionName] =
          perMessageDeflate;
      }
    }

    websocket.setSocket(socket, head, opts.maxPayload);
  });
}

/**
 * Emit the `'error'` and `'close'` event.
 *
 * @param {WebSocket} websocket The WebSocket instance
 * @param {Error} The error to emit
 * @private
 */
function emitErrorAndClose(websocket, err) {
  websocket._readyState = WebSocket.CLOSING;
  websocket.emit('error', err);
  websocket.emitClose();
}

/**
 * Create a `net.Socket` and initiate a connection.
 *
 * @param {Object} options Connection options
 * @return {net.Socket} The newly created socket used to start the connection
 * @private
 */
function netConnect(options) {
  options.path = options.socketPath;
  return net.connect(options);
}

/**
 * Create a `tls.TLSSocket` and initiate a connection.
 *
 * @param {Object} options Connection options
 * @return {tls.TLSSocket} The newly created socket used to start the connection
 * @private
 */
function tlsConnect(options) {
  options.path = undefined;

  if (!options.servername && options.servername !== '') {
    options.servername = net.isIP(options.host) ? '' : options.host;
  }

  return tls.connect(options);
}

/**
 * Abort the handshake and emit an error.
 *
 * @param {WebSocket} websocket The WebSocket instance
 * @param {(http.ClientRequest|net.Socket|tls.Socket)} stream The request to
 *     abort or the socket to destroy
 * @param {String} message The error message
 * @private
 */
function abortHandshake(websocket, stream, message) {
  websocket._readyState = WebSocket.CLOSING;

  const err = new Error(message);
  Error.captureStackTrace(err, abortHandshake);

  if (stream.setHeader) {
    stream.abort();

    if (stream.socket && !stream.socket.destroyed) {
      //
      // On Node.js >= 14.3.0 `request.abort()` does not destroy the socket if
      // called after the request completed. See
      // https://github.com/websockets/ws/issues/1869.
      //
      stream.socket.destroy();
    }

    stream.once('abort', websocket.emitClose.bind(websocket));
    websocket.emit('error', err);
  } else {
    stream.destroy(err);
    stream.once('error', websocket.emit.bind(websocket, 'error'));
    stream.once('close', websocket.emitClose.bind(websocket));
  }
}

/**
 * Handle cases where the `ping()`, `pong()`, or `send()` methods are called
 * when the `readyState` attribute is `CLOSING` or `CLOSED`.
 *
 * @param {WebSocket} websocket The WebSocket instance
 * @param {*} [data] The data to send
 * @param {Function} [cb] Callback
 * @private
 */
function sendAfterClose(websocket, data, cb) {
  if (data) {
    const length = toBuffer(data).length;

    //
    // The `_bufferedAmount` property is used only when the peer is a client and
    // the opening handshake fails. Under these circumstances, in fact, the
    // `setSocket()` method is not called, so the `_socket` and `_sender`
    // properties are set to `null`.
    //
    if (websocket._socket) websocket._sender._bufferedBytes += length;
    else websocket._bufferedAmount += length;
  }

  if (cb) {
    const err = new Error(
      `WebSocket is not open: readyState ${websocket.readyState} ` +
        `(${readyStates[websocket.readyState]})`
    );
    cb(err);
  }
}

/**
 * The listener of the `Receiver` `'conclude'` event.
 *
 * @param {Number} code The status code
 * @param {String} reason The reason for closing
 * @private
 */
function receiverOnConclude(code, reason) {
  const websocket = this[kWebSocket];

  websocket._closeFrameReceived = true;
  websocket._closeMessage = reason;
  websocket._closeCode = code;

  if (websocket._socket[kWebSocket] === undefined) return;

  websocket._socket.removeListener('data', socketOnData);
  process.nextTick(resume, websocket._socket);

  if (code === 1005) websocket.close();
  else websocket.close(code, reason);
}

/**
 * The listener of the `Receiver` `'drain'` event.
 *
 * @private
 */
function receiverOnDrain() {
  this[kWebSocket]._socket.resume();
}

/**
 * The listener of the `Receiver` `'error'` event.
 *
 * @param {(RangeError|Error)} err The emitted error
 * @private
 */
function receiverOnError(err) {
  const websocket = this[kWebSocket];

  if (websocket._socket[kWebSocket] !== undefined) {
    websocket._socket.removeListener('data', socketOnData);

    //
    // On Node.js < 14.0.0 the `'error'` event is emitted synchronously. See
    // https://github.com/websockets/ws/issues/1940.
    //
    process.nextTick(resume, websocket._socket);

    websocket.close(err[kStatusCode]);
  }

  websocket.emit('error', err);
}

/**
 * The listener of the `Receiver` `'finish'` event.
 *
 * @private
 */
function receiverOnFinish() {
  this[kWebSocket].emitClose();
}

/**
 * The listener of the `Receiver` `'message'` event.
 *
 * @param {(String|Buffer|ArrayBuffer|Buffer[])} data The message
 * @private
 */
function receiverOnMessage(data) {
  this[kWebSocket].emit('message', data);
}

/**
 * The listener of the `Receiver` `'ping'` event.
 *
 * @param {Buffer} data The data included in the ping frame
 * @private
 */
function receiverOnPing(data) {
  const websocket = this[kWebSocket];

  websocket.pong(data, !websocket._isServer, NOOP);
  websocket.emit('ping', data);
}

/**
 * The listener of the `Receiver` `'pong'` event.
 *
 * @param {Buffer} data The data included in the pong frame
 * @private
 */
function receiverOnPong(data) {
  this[kWebSocket].emit('pong', data);
}

/**
 * Resume a readable stream
 *
 * @param {Readable} stream The readable stream
 * @private
 */
function resume(stream) {
  stream.resume();
}

/**
 * The listener of the `net.Socket` `'close'` event.
 *
 * @private
 */
function socketOnClose() {
  const websocket = this[kWebSocket];

  this.removeListener('close', socketOnClose);
  this.removeListener('data', socketOnData);
  this.removeListener('end', socketOnEnd);

  websocket._readyState = WebSocket.CLOSING;

  let chunk;

  //
  // The close frame might not have been received or the `'end'` event emitted,
  // for example, if the socket was destroyed due to an error. Ensure that the
  // `receiver` stream is closed after writing any remaining buffered data to
  // it. If the readable side of the socket is in flowing mode then there is no
  // buffered data as everything has been already written and `readable.read()`
  // will return `null`. If instead, the socket is paused, any possible buffered
  // data will be read as a single chunk.
  //
  if (
    !this._readableState.endEmitted &&
    !websocket._closeFrameReceived &&
    !websocket._receiver._writableState.errorEmitted &&
    (chunk = websocket._socket.read()) !== null
  ) {
    websocket._receiver.write(chunk);
  }

  websocket._receiver.end();

  this[kWebSocket] = undefined;

  clearTimeout(websocket._closeTimer);

  if (
    websocket._receiver._writableState.finished ||
    websocket._receiver._writableState.errorEmitted
  ) {
    websocket.emitClose();
  } else {
    websocket._receiver.on('error', receiverOnFinish);
    websocket._receiver.on('finish', receiverOnFinish);
  }
}

/**
 * The listener of the `net.Socket` `'data'` event.
 *
 * @param {Buffer} chunk A chunk of data
 * @private
 */
function socketOnData(chunk) {
  if (!this[kWebSocket]._receiver.write(chunk)) {
    this.pause();
  }
}

/**
 * The listener of the `net.Socket` `'end'` event.
 *
 * @private
 */
function socketOnEnd() {
  const websocket = this[kWebSocket];

  websocket._readyState = WebSocket.CLOSING;
  websocket._receiver.end();
  this.end();
}

/**
 * The listener of the `net.Socket` `'error'` event.
 *
 * @private
 */
function socketOnError() {
  const websocket = this[kWebSocket];

  this.removeListener('error', socketOnError);
  this.on('error', NOOP);

  if (websocket) {
    websocket._readyState = WebSocket.CLOSING;
    this.destroy();
  }
}

},{"./buffer-util":73,"./constants":74,"./event-target":75,"./extension":76,"./permessage-deflate":78,"./receiver":79,"./sender":80,"crypto":undefined,"events":undefined,"http":undefined,"https":undefined,"net":undefined,"stream":undefined,"tls":undefined,"url":undefined}]},{},[1])(1)
});
