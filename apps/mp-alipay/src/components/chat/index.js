const createChat = require('../../core/chat');
const definition = createChat();
const { data, onLoad, onShow, onHide, onUnload, ...methods } = definition;
Component({
  props: { onClose: null, onInterrupt: null, onSettled: null },
  data: Object.assign({}, data, { embedded: true }),
  didMount() { onLoad.call(this); onShow.call(this); },
  didUnmount() { onUnload.call(this); },
  pageEvents: { onHide() { onHide.call(this); }, onShow() { if (!this._visible) onShow.call(this); } },
  methods: Object.assign({ onLoad, onShow, onHide, onUnload }, methods)
});
