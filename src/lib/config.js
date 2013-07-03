var grunt       = require('grunt'),
    engine      = require('./engine'),
    path        = require('path'),
    OPERATORS   = require('./operators');

grunt.util = grunt.util || grunt.utils;
grunt.file.expand = grunt.file.expandFiles || grunt.file.expand;

var config = {};

/**
  Get all locales
  return Array of all locales
 */
config.getAllLocales = function(hashed){

  hashed = !!hashed;

  var locales = grunt.file.readJSON(opt.config + '/locales.json');
  if(hashed) {
    return Object.keys(locales);
  } else {
    var res = [];
    for(var key in locales) {
      res.push({key : key, text : locales[key]});
    }
    res = res.sort(function(a, b) {
      if(a.text > b.text) {
        return 1;
      } else if(a.text < b.text) {
        return -1;
      } else {
        return 0;
      }
    });
    return res;
  }
};

config.hasLocale = function(loc) {
  var locales = this.getAllLocales(true);
  return locales.indexOf(loc) !== -1;
};

/**
  Check for error duplicate
  @param Object res result that has already the key
  @param String key
  @param Array vars Translation vars
  @throws Duplicate Translation Keys Error
 */
config.hasErrorDuplicate = function(res, key, vars){

  // Check for error duplicate
  var errorDuplicate = false;
  if(vars.length !== res[key].vars.length) {
    errorDuplicate = true;
  } else {
    for(var i in vars) {
      if(res[key].vars[i] !== vars[i]) {
        errorDuplicate = true;
        break;
      }
    }
  }
  if(errorDuplicate) {
    throw {
      name: 'Duplicate Translation Keys',
      message: 'You have used gt(\'' + key + '\') and input two different vars: \n' + 'Variables: ' + res[key].vars.join(',') + '\n' + 'Is not equal: ' + vars.join(',')
    };
  }
};

/**
  Get all locales
  @return Object of all locales
 */
config.getAllTranslations = function() {
  var files = grunt.file.expand({filter: 'isFile'}, opt.config + '/locales/*.json');
  var locales = {};
  files.forEach(function(locale){
    locales[path.basename(locale, '.json')] = grunt.file.readJSON(locale);
  });
  return locales;
};

/**
  Returns translation key from a translation function string
  @param String fn string of the function
  @return String Translation key
 */
config.getTranslationKey = function(fn) {
  var type;
  fn.replace(/gt\(\s*(['|"])/ , function(m, quote) {
    if(/'/.test(quote)) {
      type = 'single';
    } else {
      type = 'double';
    }
  });
  var str;
  if(type === 'single') {
    fn = fn.replace(/\\'/, 'SINGLE_QUOTE');
    str = fn.split("'")[1];
    return str.replace('SINGLE_QUOTE', '\'');
  } else {
    fn = fn.replace(/\\"/, 'DOUBLE_QUOTE');
    str = fn.split(/"/)[1];
    return str.replace('DOUBLE_QUOTE', "\"");
  }
};

/**
  Returns all the vars in a translation function
  @param String fn Function string
  @return Array of all vars
 */
config.getVars = function(fn) {

  var json = fn.match(/\{(\s*\w*\s*\:(.*))*\s*\}/g);
  if(json === null) {
    return [];
  }
  json = json[0].match(/\s*(\w+)\s*\:/g)
  for(var i = 0; i < json.length; i++) {
    json[i] = json[i].replace(/\s+|:/g, '');
  }
  return json;
};

/**
  Checks if an operand has the right syntax
  @param String text
  @return Boolean
 */
config.isTranslationText = function(text, key) {
  if(typeof text === 'undefined') {
    throw {
      name: 'Undefined translation',
      message: 'You have an undefined translation in:\n' + key
    };
  }
};

/**
  Checks if operands and operators has the correct syntax
  @param String operand1
  @param String operator
  @param String operand2
  @return Boolean true
  @throw Syntax Wrong in Translation JSON
 */
config.isConditions = function(operand1, operator, operand2) {

  // Check operands
  if(!this.isOperand(operand1) || !this.isOperand(operand2)) {
    throw {
      name: 'Syntax Wrong in Translation JSON',
      message: 'One of the operands have wrong syntax: ' + operand1 + ' or ' + operand2
    };
  }

  // Validate operator
  if(OPERATORS.indexOf(operator) === -1) {
    throw {
      name: 'Syntax Wrong in Translation JSON',
      message: '"' + operator + '" should be one of ' + OPERATORS.join(',')
    };
  }
  return true;
};

config.normalizeTranslations = function(translations) {

  var keys = [];
  for(var key in translations) {
    if(translations.hasOwnProperty(key)) {
      var translation, type;
      if(typeof translations[key].translations === 'string') {
        type = 'simple';
        var val = translations[key].translations.substr(1, translations[key].translations.length - 2);
        translation = {
          text  : val,
          value : val
        };
      } else {
        if(translations[key].translations.length === 0) {
          type = 'simple';
          translation = {
            text  : 'NO TRANSLATION',
            value : ''
          };
        } else {
          type = 'logical';
          translation = {
            text  : 'if...',
            value : translations[key].translations
          };
        }
      }

      keys.push({
        id    : translations[key].id,
        key   : key,
        vars  : translations[key].vars,
        type  : type,
        value : translation
      });
    }
  }

  return keys;
};
/**
  Get latest translation
  @param {Object} opt
  @param {Number} amount
  @param {Boolean} withValues
  @return {Array}
 */
config.getLatestTranslations = function(from, amount, loc) {
  if(typeof loc === 'undefined' || loc === '') {
    loc = loc || opt.defaultLanguage;
  } else if(!config.hasLocale(loc)) {
    grunt.log.error('Locale: ' + loc + ' is not defined in locales.json');
    return false;
  }
  amount = amount || 10;
  var translations = grunt.file.readJSON(opt.config + '/locales/' + loc + '.json');

  var keys = config.normalizeTranslations(translations);

  keys.sort(function(a, b) {
    return translations[b.key].timestamp - translations[a.key].timestamp;
  });

  return keys.splice(from, amount);
};

/**
  Get latest search translation
  @param {Number} amount
  @return {Array}
 */
config.getLatestSearchTranslations = function(amount) {
  amount = amount || 10;
  if(grunt.file.exists(opt.latestSearch)) {
    return grunt.file.readJSON(opt.latestSearch).slice(0, amount);
  } else {
    return [];
  }
};



/**
  Checks if an operand has the right syntax
  @param String operand
  @return Boolean
 */
config.isOperand = function(operand) {
  if(/^"?\$?\w+"?$/.test(operand)) {
    return true;
  }
  return false;
};

module.exports = config;
