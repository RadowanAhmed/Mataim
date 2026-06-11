const { withBuildGradle } = require('expo/config-plugins');

module.exports = function withStripeAndroid(config) {
    return withBuildGradle(config, (config) => {
        if (config.modResults.language === 'groovy') {
            const dependenciesBlock = `
dependencies {
    implementation 'com.stripe:stripe-android:20.47.0'
}
      `;
            if (!config.modResults.contents.includes('com.stripe:stripe-android')) {
                config.modResults.contents = config.modResults.contents.replace(
                    /dependencies\s*{/,
                    `dependencies {\n    ${dependenciesBlock}`
                );
            }
        }
        return config;
    });
};