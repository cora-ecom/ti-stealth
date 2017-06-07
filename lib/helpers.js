var _ = require('underscore'),
  fs = require('fs-extended'),
  logger = require('./logger'),
  constants = require('./constants');

exports.init = init;
exports.files = files;
exports.enable = enable;
exports.restore = restore;

function files(opts) {

  switch (opts.type) {

    case 'file':
      return [opts.input];

    case 'dir':
      return fs.listFilesSync(opts.input, {
        recursive: true,
        prependDir: true,
        filter: function(filePath) {
          return filePath.match(/\.js$/);
        }
      });
  }

  throw "Unknown 'input' type '" + opts.type + "'.";
}

function init(input, opts) {

  // 1st argument is options, with input specified as property
  if (_.isObject(input)) {
    opts = input;
  }

  // 1st argument is input, 2nd argument is options
  else {
    opts = (!opts || !_.isObject(opts)) ? {} : opts;
    opts.input = input;
  }

  // no input
  if (!opts.input) {

    // no CWD when executed as CommonJS module
    if (!process) {
      throw "Missing 'input' option telling me what to process.";
    }

    logger.debug('Assuming you want me to process the current working directory.');

    opts.input = process.cwd();
    opts.type = 'dir';
  }

  // input given
  else {

    // input is code
    if (opts.input.match(/[\n\r]/) || !fs.existsSync(opts.input)) {
      opts.type = 'code';
    }

    // input is dir or file
    else {
      var stat = fs.statSync(opts.input);

      opts.type = stat.isDirectory() ? 'dir' : 'file';
    }

    logger.debug("Assuming your 'input' is " + opts.type + ".");
  }

  if (opts.l) {
    opts.levels = opts.l;
    delete opts.l;
  }

  if (opts.n) {
    opts.notLevels = opts.n;
    delete opts.n;
  }

  if (opts['not-levels']) {
    opts.notLevels = opts['not-levels'];
    delete opts['not-levels'];
  }

  if (opts.levels && _.isString(opts.levels)) {
    opts.levels = opts.levels.split(',');
  }

  if (!opts.levels || !_.isArray(opts.levels)) {
    opts.levels = constants.LEVELS;
  }

  if (opts.notLevels && _.isString(opts.notLevels)) {
    opts.notLevels = opts.notLevels.split(',');
  }

  if (opts.notLevels) {
    opts.levels = _.difference(opts.levels, opts.notLevels);

    delete opts.notLevels;
  }

  return opts;
}

function stripComments(stringIN) {
    var SLASH = '/';
    var BACK_SLASH = '\\';
    var STAR = '*';
    var DOUBLE_QUOTE = '"';
    var SINGLE_QUOTE = "'";
    var NEW_LINE = '\n';
    var CARRIAGE_RETURN = '\r';

    var string = stringIN;
    var length = string.length;
    var position = 0;
    var output = [];

    function getCurrentCharacter() {
        return string.charAt(position);
    }

    function getPreviousCharacter() {
        return string.charAt(position - 1);
    }

    function getNextCharacter() {
        return string.charAt(position + 1);
    }

    function add() {
        output.push(getCurrentCharacter());
    }

    function next() {
        position++;
    }

    function atEnd() {
        return position >= length;
    }

    function isEscaping() {
        if (getPreviousCharacter() == BACK_SLASH) {
            var caret = position - 1;
            var escaped = true;
            while (caret-- > 0) {
                if (string.charAt(caret) != BACK_SLASH) {
                    return escaped;
                }
                escaped = !escaped;
            }
            return escaped;
        }
        return false;
    }

    function processSingleQuotedString() {
        if (getCurrentCharacter() == SINGLE_QUOTE) {
            add();
            next();
            while (!atEnd()) {
                if (getCurrentCharacter() == SINGLE_QUOTE && !isEscaping()) {
                    return;
                }
                add();
                next();
            }
        }
    }

    function processDoubleQuotedString() {
        if (getCurrentCharacter() == DOUBLE_QUOTE) {
            add();
            next();
            while (!atEnd()) {
                if (getCurrentCharacter() == DOUBLE_QUOTE && !isEscaping()) {
                    return;
                }
                add();
                next();
            }
        }
    }

    function processSingleLineComment() {
        if (getCurrentCharacter() == SLASH) {
            if (getNextCharacter() == SLASH) {
                next();
                while (!atEnd()) {
                    next();
                    if (getCurrentCharacter() == NEW_LINE || getCurrentCharacter() == CARRIAGE_RETURN) {
                        return;
                    }
                }
            }
        }
    }

    function processMultiLineComment() {
        if (getCurrentCharacter() == SLASH) {
            if (getNextCharacter() == STAR) {
                next();
                next();
                while (!atEnd()) {
                    next();
                    if (getCurrentCharacter() == STAR) {
                        if (getNextCharacter() == SLASH) {
                            next();
                            next();
                            return;
                        }
                    }
                }
            }
        }
    }

    function processRegularExpression() {
        if (getCurrentCharacter() == SLASH) {
            add();
            next();
            while (!atEnd()) {
                if (getCurrentCharacter() == SLASH && !isEscaping()) {
                    return;
                }
                add();
                next();
            }
        }
    }

    while (!atEnd()) {
        processDoubleQuotedString();
        processSingleQuotedString();
        processSingleLineComment();
        processMultiLineComment();
        processRegularExpression();
        if (!atEnd()) {
            add();
            next();
        }
    }
    return output.join('');

};


function enable(code, opts) {
    var temp = stripComments(code);
    return temp.replace(new RegExp('[^*]' + _regexp(opts), 'g'), '(function(){/*$1*/})');
}

function restore(code, opts) {
  return code.replace(new RegExp('\\(function\\(\\)\{\\/\\*' + _regexp(opts) + '\\*\\/\\}\\)', 'g'), '$1');
}

function _regexp(opts) {
  return '((?:console|Ti(?:tanium)?.API).(?:' + opts.levels.join('|') + '))';
}
