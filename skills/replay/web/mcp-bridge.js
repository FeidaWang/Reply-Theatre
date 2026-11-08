(() => {
  'use strict';

  let nextId = 0;
  let ready;
  let latestResult;
  let demo = false;
  let onResult;
  const pending = new Map();

  function send(message) {
    window.parent.postMessage({jsonrpc: '2.0', ...message}, '*');
  }

  function request(method, params, timeout) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('Codex panel timed out'));
      }, timeout);
      pending.set(id, {resolve, reject, timer});
      send({id, method, params});
    });
  }

  function theme(context) {
    if (context?.theme === 'light' || context?.theme === 'dark') {
      document.documentElement.dataset.hostTheme = context.theme;
    }
  }

  window.addEventListener('message', event => {
    const message = event.data;
    if (event.source !== window.parent || message?.jsonrpc !== '2.0') return;
    if (message.method === 'ui/notifications/tool-input') {
      demo = message.params?.arguments?.demo === true;
      return;
    }
    if (message.method === 'ui/notifications/tool-result') {
      latestResult = message.params;
      if (typeof latestResult?._meta?.demo === 'boolean') demo = latestResult._meta.demo;
      onResult?.(latestResult);
      return;
    }
    if (message.method === 'ui/notifications/host-context-changed') {
      theme(message.params);
      return;
    }
    const reply = pending.get(message.id);
    if (!reply) return;
    pending.delete(message.id);
    clearTimeout(reply.timer);
    if (message.error) reply.reject(new Error('Codex panel unavailable'));
    else reply.resolve(message.result);
  });

  function connect() {
    if (!ready) {
      ready = request('ui/initialize', {
        protocolVersion: '2026-01-26',
        appInfo: {name: 'Replay Theater', version: '0.5.0'},
        appCapabilities: {},
      }, 8000).then(result => {
        theme(result?.hostContext);
        send({method: 'ui/notifications/initialized'});
      }).catch(error => {
        ready = undefined;
        throw error;
      });
    }
    return ready;
  }

  window.REPLAY_MCP = {
    start(callback) {
      onResult = callback;
      if (latestResult) onResult(latestResult);
      connect().catch(error => {
        if (!latestResult) onResult({isError: true, content: [{text: error.message}]});
      });
    },
    async read() {
      await connect();
      return request('tools/call', {
        name: 'open_replay',
        arguments: demo ? {demo: true} : {},
      }, 30000);
    },
  };
})();
