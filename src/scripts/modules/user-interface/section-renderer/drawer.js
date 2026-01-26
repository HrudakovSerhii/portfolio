class Drawer {
  constructor(templateBuilder) {
    this.templateBuilder = templateBuilder;
  }

  create(title) {
    const fragment = this.templateBuilder.cloneMetaItemTemplate('drawer-template');

    if (!fragment) {
      console.warn('Drawer template not found');
      return null;
    }

    const drawer = fragment.querySelector('.drawer');
    if (!drawer) {

      return null;
    }

    const toggleButton = drawer.querySelector('.drawer__toggle');
    if (!toggleButton) {
      return;
    }

    const toggleButtonContent = drawer.querySelector('.drawer__toggle-content');

    toggleButtonContent.textContent = title;
    toggleButton.addEventListener('click', () => {
      this._toggle(drawer);
    });

    return drawer;
  }

  _toggle(drawer) {
    const isCollapsed = drawer.dataset.collapsed === 'true';
    const toggleButton = drawer.querySelector('.drawer__toggle');
    const content = drawer.querySelector('.drawer__content');

    if (isCollapsed) {
      this._expand(drawer, toggleButton, content);
    } else {
      this._collapse(drawer, toggleButton, content);
    }
  }

  _expand(drawer, toggleButton, content) {
    drawer.dataset.collapsed = 'false';
    toggleButton.setAttribute('aria-expanded', 'true');

    content.style.height = content.scrollHeight + 'px';
    content.style.opacity = 1;

    const onTransitionEnd = () => {
      content.style.height = 'auto';
      content.removeEventListener('transitionend', onTransitionEnd);
    };

    content.addEventListener('transitionend', onTransitionEnd);
  }

  _collapse(drawer, toggleButton, content) {
    content.style.height = content.scrollHeight + 'px';

    requestAnimationFrame(() => {
      drawer.dataset.collapsed = 'true';
      toggleButton.setAttribute('aria-expanded', 'false');
      content.style.height = '0';
    });
  }

  wrapContent(contentElement, contentTitle) {
    const drawer = this.create(contentTitle);

    if (!drawer || !contentElement) {
      return contentElement;
    }

    const drawerContent = drawer.querySelector('.drawer__content');

    if (drawerContent) {
      drawerContent.appendChild(contentElement);
    }

    return drawer;
  }
}

export default Drawer;
