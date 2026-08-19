class IframeManager {
  constructor(paneContentEl, url, label) {
    this.container = paneContentEl;
    this.url = url;
    this.label = label;
    this.popup = null;
    this.render();
  }

  render() {
    this.container.innerHTML = '';

    const iframe = document.createElement('iframe');
    iframe.src = this.url;
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
    iframe.setAttribute('loading', 'lazy');

    let loaded = false;

    iframe.addEventListener('load', () => {
      loaded = true;
      try {
        const doc = iframe.contentDocument;
        if (!doc || !doc.body || doc.body.innerHTML === '') {
          this.showFallback();
        }
      } catch {
        // Cross-origin — iframe loaded but we can't inspect it, which is fine
      }
    });

    iframe.addEventListener('error', () => {
      if (!loaded) this.showFallback();
    });

    setTimeout(() => {
      if (!loaded) this.showFallback();
    }, 8000);

    this.container.appendChild(iframe);
  }

  showFallback() {
    this.container.innerHTML = '';

    const fallback = document.createElement('div');
    fallback.className = 'iframe-fallback';
    fallback.innerHTML = `
      <div class="iframe-fallback-icon">🔗</div>
      <div class="iframe-fallback-text">
        <strong>${this.label}</strong> cannot be embedded directly.<br>
        Open it in a separate window to view alongside this dashboard.
      </div>
      <button class="btn btn-open" onclick="window.iframeManager_openPopup('${this.url}', '${this.label}')">
        Open in New Window
      </button>
    `;

    this.container.appendChild(fallback);
  }

  openPopup() {
    if (this.popup && !this.popup.closed) {
      this.popup.focus();
      return;
    }
    const w = Math.round(screen.width * 0.5);
    const h = Math.round(screen.height * 0.7);
    const left = Math.round((screen.width - w) / 2);
    const top = Math.round((screen.height - h) / 2);
    this.popup = window.open(
      this.url,
      this.label.replace(/\s/g, '_'),
      `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  }
}

window._iframeManagers = {};

window.iframeManager_openPopup = function (url, label) {
  const key = `${label}_${url}`;
  if (window._iframeManagers[key]) {
    window._iframeManagers[key].openPopup();
  } else {
    const mgr = new IframeManager(document.createElement('div'), url, label);
    window._iframeManagers[key] = mgr;
    mgr.openPopup();
  }
};
