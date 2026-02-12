class TypingIndicator {
  constructor(element) {
    this.element = element;
  }

  show() {
    if (this.element) {
      this.element.style.display = 'flex';
    }
  }

  hide() {
    if (this.element) {
      this.element.style.display = 'none';
    }
  }
}

export default TypingIndicator;