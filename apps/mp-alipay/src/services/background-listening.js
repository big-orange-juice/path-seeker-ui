const storage = require('./storage');
const config = require('../config');
let foreground = true;
const enabled = () => !!(config.background && config.backgroundAudio && storage.read('screen-off-listening', true));
function setEnabled(value) { storage.write('screen-off-listening', !!value); }
function setForeground(value) { foreground = !!value; }
const allowed = () => foreground || enabled();
module.exports = { enabled, setEnabled, setForeground, allowed };
