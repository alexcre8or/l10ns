
if(typeof define !== 'function') {
  var define = require('amdefine')(module);
}
if(inServer) {
  var file = require('../../../libraries/file');
}

define(function(require) {
  var Backbone = require('backbone')
    , Model = inServer ? require('../../libraries/Model'): require('Model')
    , Collection = inServer ? require('../../libraries/Collection'): require('Collection')
    , _ = require('underscore')
    , ValueGroup = require('./ValueGroup')
    , Else = ValueGroup.prototype.Else
    , Input = ValueGroup.prototype.Input
    , Condition = ValueGroup.prototype.Condition
    , FirstOperand = Condition.prototype.FirstOperand
    , LastOperand = Condition.prototype.LastOperand;

  if(inClient) {
    var request = require('request')
  }
  else {
    Backbone = require('backbone-relational');
  }

  var ValueGroups = Collection.extend({
    model: ValueGroup,
    comparator: 'index'
  });

  var Constructor = Model.extend({

    /**
     * Relations
     *
     * @type {Object}
     */

    relations: [
      {
        type: 'HasMany',
        key: 'valueGroups',
        relatedModel: ValueGroup,
        collectionType: ValueGroups,
        reverseRelation: {
          key: 'localization',
          includeInJSON: false
        }
      }
    ],

    /**
     * Parse values(conditions and inputs)
     *
     * @param {Array.<value>} values
     * @return {void}
     * @api private
     */

    _parseValues: function(values, variables) {
      var valueGroup, index = 0;

      if(values.length <= 1) {
        return new ValueGroup({
          localization: this,
          index: index,
          input: new Input({
            value: values.length ? values[0][0] : '',
            row: 0
          })
        });
      }
      for(var i = 0; i < values.length; i++) {
        if(values[i].length > 2) {
          var y = 0, row = 0;

          if(values.length === 2) {
            valueGroup = new ValueGroup({
              localization: this,
              index: index
            });
          }
          else {
            valueGroup = new ValueGroup({
              localization: this,
              index: index,
              movable: true
            });
          }

          index++;

          while(typeof values[i][y] !== 'undefined') {
            new Condition({
              statement: values[i][y],
              firstOperand: new FirstOperand({
                value: values[i][y + 1],
                variables: variables,
                order: 'first'
              }),
              operator: values[i][y + 2],
              lastOperand: new LastOperand({
                value: values[i][y + 3],
                variables: variables,
                order: 'last'
              }),
              operators: cf.OPERATORS,
              additionalCompairOperators: cf.ADDITIONAL_COMPAIR_OPERATORS,
              variables: variables,
              row: row,
              valueGroup: valueGroup
            });

            row++;

            // Continue condition statement
            if(values[i][y + 4] === '&&'
            || values[i][y + 4] === '||') {
              y += 4;
              continue;
            }

            // Initialize input
            new Input({
              value: values[i][y + 4],
              row: row,
              valueGroup: valueGroup
            });

            y += 5;
          }
        }
        else {
          valueGroup = new ValueGroup({
            localization: this,
            index: index
          });

          row = 0;

          new Else({
            row: row,
            valueGroup: valueGroup
          });

          new Input({
            value: values[i][1],
            row: row + 1,
            valueGroup: valueGroup
          });
        }
      }
    },

    /**
     * Parse raw data
     *
     * @param {JSON} json
     * @return {void}
     * @api private
     */

    _parse: function(json) {
      this._parseValues(json.values, json.variables);

      delete json.valueGroups;

      this.set(json);

      return this;
    },

    /**
     * Default values
     *
     * @type {Object}
     */

    defaults: {
      key: null,
      values: [],
      variables: [],
      text: '',
      timestamp: null,
      new: false,

      i18n_variables: 'VARIABLES',
      i18n_values: 'VALUES',
      i18n_none: 'None',
      i18n_save: 'Save',
      i18n_addCondition: 'Add condition'
    },

    /**
     * Sync
     *
     * @delegate
     */

    sync: function(method, model, options, requestData) {
      if(method === 'read') {
        if(inServer) {
          this._handleReadRequestFromServer(model, options, requestData);
        }
        else {
          this._handleReadRequestFromClient(model, options, requestData);
        }
      }
      else if(method === 'update') {
        if(inClient) {
          this._handleUpdateRequestFromClient(model, options, requestData);
        }
      }
    },

    /**
     * Handle update request from client
     *
     * @param {Model} model
     * @param {Object} options
     * @param {Request} requestData
     * @return {void}
     * @api private
     */

    _handleUpdateRequestFromClient: function(model, options, requestData) {
      var id = window.location.pathname.split('/')[3]
        , json = this.toL10nsJSON();

      request
        .put('/api/' + app.locale + '/l/' + id)
        .send(json)
        .end(function(error, response) {
          if(!error) {
            app.models.localizations.get(json.id).set(json);
            if(typeof options.success === 'function') {
              options.success();
            }
          }
          else {
            options.error(error);
          }
        });
    },

    /**
     * Handle read request from client
     *
     * @param {Model} model
     * @param {Object} options
     * @param {Request} requestData
     * @return {void}
     * @api private
     */

    _handleReadRequestFromClient: function(model, options, requestData) {
      var id = window.location.pathname.split('/')[3];

      var $json = $('.js-json-localization');
      if($json.length) {
        this._parse(JSON.parse($json.html()));
        $json.remove();
        options.success();
        return;
      }
      var localization = app.models.localizations.get(id);
      if(localization) {
        localization = localization.toJSON();
        this._parse(localization);
        app.document.set('title', localization.key);
        app.document.set('description', 'Edit: ' + localization.key);
        options.success();
        return;
      }
      request
        .get('/api/' + app.locale + '/l/' + id)
        .end(function(err, res) {
          var localization = res.body;
          _this._parse(localization);
          app.document.set('title', localization.key);
          app.document.set('description', 'Edit: ' + localization.key);
          options.success();
        });
    },

    /**
     * Handle read request from server
     *
     * @param {Model} model
     * @param {Object} options
     * @param {Request} requestData
     * @return {void}
     * @api private
     */

    _handleReadRequestFromServer: function(model, options, requestData) {
      var _this = this;

      file.readLocalizations()
        .then(function(localizations) {
          localizations = file.localizationMapToArray(localizations)[requestData.param('locale')];
          var localization = _.findWhere(localizations, { id: requestData.param('id') });
          if(localization) {
            _this._parse(localization);
            _this.setPageTitle(localization.key);
            _this.setPageDescription('Edit: ' + localization.key);
            options.success();
          }
          else {
            options.error(new TypeError('localization with id:' + requestData.param('id') + ' not found'));
          }
        })
        .fail(function(error) {
          options.error(error);
        });
    },

    /**
     * On history push to `/`. We want to change the `revealed` property
     * to true.
     *
     * @delegate
     */

    onHistoryChange: function(path) {
      if(/^[a-z]{2}\-[A-Z]{2}\/t\//.test(path)) {
        this.setMeta('revealed', true);
        this.setPageTitle('Localization')
        this.setPageDescription('Edit localization');
      }
      else {
        this.setMeta('revealed', false);
      }
    },

    /**
     * We will ovverride the default implementation of `toJSON` method
     * because the relations is not mapped according to the server
     * implementation. Relations `Conditions`, `Inputs`, `Else` need to
     * under the property `values`
     *
     * @override
     */

    toL10nsJSON: function() {
      var json = Model.prototype.toJSON.call(this)
        , values = []
        , text = [];

      this.get('valueGroups').sort().forEach(function(valueGroup) {
        var group = valueGroup.toL10nsJSON();
        values[valueGroup.get('index')] = group;
        text.push(_.last(group));
      });

      json.values = values;
      json.text = text.join('; ');

      json = this._removeJSONLocalizedStrings(json);

      return json;
    },

    /**
     * Remove JSON localizaed strings
     *
     * @param {JSON} json
     * @return {JSON}
     * @api private
     */

    _removeJSONLocalizedStrings: function(json) {
      delete json.i18n_addCondition;
      delete json.i18n_none;
      delete json.i18n_save;
      delete json.i18n_value;
      delete json.i18n_variables;
      delete json.valueGroups;

      return json;
    }
  });

  return Constructor;
});