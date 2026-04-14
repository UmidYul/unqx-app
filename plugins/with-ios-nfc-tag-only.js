const { withEntitlementsPlist } = require('@expo/config-plugins');

module.exports = function withIosNfcTagOnly(config) {
  return withEntitlementsPlist(config, (config) => {
    config.modResults['com.apple.developer.nfc.readersession.formats'] = ['TAG'];
    return config;
  });
};
