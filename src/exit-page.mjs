const EXIT_FALLBACK_DELAY_MS = 200;

export function exitCurrentPage(browserWindow = window) {
  const browserFallback = () => {
    try {
      browserWindow.close();
    } catch {
      // Some embedded browsers expose window.close but reject the call.
    }

    browserWindow.setTimeout(() => {
      if (browserWindow.closed) return;
      if (browserWindow.history.length > 1) {
        browserWindow.history.back();
        return;
      }
      browserWindow.location.replace('about:blank');
    }, EXIT_FALLBACK_DELAY_MS);
  };

  const douyinMiniProgram = browserWindow.tt?.miniProgram;
  if (typeof douyinMiniProgram?.navigateBack === 'function') {
    try {
      douyinMiniProgram.navigateBack({
        delta: 1,
        fail: browserFallback,
      });
      return;
    } catch {
      browserFallback();
      return;
    }
  }

  const weixinBridge = browserWindow.WeixinJSBridge;
  if (typeof weixinBridge?.call === 'function') {
    try {
      weixinBridge.call('closeWindow');
      browserWindow.setTimeout(() => {
        if (!browserWindow.closed) browserFallback();
      }, EXIT_FALLBACK_DELAY_MS);
      return;
    } catch {
      browserFallback();
      return;
    }
  }

  browserFallback();
}
