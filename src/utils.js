(function () {
    'use strict';

    var _ = require('lodash');

    var Utils = {

        // Transform a speed by our delta time.
        delta:
            function (speed, dt) {
                return speed * (dt / 1000);
            },

        // Proxy a property, simillar to the proxy in ES6.
        // Allows us to propagate changes to the target property.
        proxy:
            function (originalObj, originalProp, targetObj, targetProp) {
                Object.defineProperty(
                    originalObj,
                    originalProp,
                    {
                        get: function () {
                            return targetObj[targetProp];
                        },
                        set: function (newValue) {
                            targetObj[targetProp] = newValue;
                        }
                    }
                );
            },

        // A read-only version of proxy, see above.
        readOnlyProxy:
            function (originalObj, originalProp, targetObj, targetProp) {
                Object.defineProperty(
                    originalObj,
                    originalProp,
                    {
                        get: function () {
                            return targetObj[targetProp];
                        },
                        set: function (newValue) {
                            console.error(targetProp + ' is read-only.');
                            throw new Error('ReadOnly');
                        }
                    }
                );
            },

        // Watches a property, executing a callback when the property changes.
        look:
            function (obj, prop, callback, callbackParams) {
                var value = obj[prop];

                Object.defineProperty(
                    obj,
                    prop,
                    {
                        get: function () {
                            return value;
                        },
                        set: function (newValue) {
                            value = newValue;
                            callback(newValue, callbackParams);
                        }
                    }
                );
            }

    };

    module.exports = Utils;
} ());
