module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            // Transform private class fields and methods for Hermes/React Native compatibility
            // Fixes: SyntaxError: private properties are not supported
            // Used by react-native-reanimated, iceberg-js, and other modern packages
            ['@babel/plugin-proposal-class-properties', { loose: true }],
            ['@babel/plugin-proposal-private-methods', { loose: true }],
            ['@babel/plugin-proposal-private-property-in-object', { loose: true }],
        ],
    };
};
