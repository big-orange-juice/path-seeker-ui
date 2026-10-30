const speech = require('../../services/speech');
Page({ data: {}, locationHelp() { if (my.openSetting) my.openSetting({}); }, microphoneHelp() { speech.microphoneHelp(); } });
