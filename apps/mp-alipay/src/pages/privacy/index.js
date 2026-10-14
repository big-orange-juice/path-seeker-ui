Page({ data: {}, locationHelp() { if (my.openSetting) my.openSetting({}); }, microphoneHelp() { if (my.showAuthGuide) my.showAuthGuide({ authType: 'MICROPHONE' }); } });
