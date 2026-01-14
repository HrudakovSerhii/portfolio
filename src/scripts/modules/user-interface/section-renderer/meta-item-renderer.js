import { Carousel } from "../carousel/index.js";

const LINK_TYPES = ['link', 'email-link'];

class MetaItemRenderer {
  constructor(templateBuilder, profileData) {
    this.templateBuilder = templateBuilder;
    this.profileData = profileData;
  }

  renderInCarousel(container, sectionId, items) {
    const elements = [];

    items.forEach(item => {
      const renderedItem = this._renderItem(sectionId, item);

      if (renderedItem) {
        elements.push(renderedItem);
      }
    });

    if (elements.length > 0) {
      const carousel = new Carousel(container, elements, {
        loop: true,
        navigation: true
      });

      carousel.render();
    }
  }

  render(sectionId, mainItems, currentRole) {
    if (!mainItems || mainItems.length === 0) {
      return null;
    }

    const itemsToRender = this._filterItemsByRole(mainItems, currentRole, sectionId);
    const fragment = document.createDocumentFragment();

    itemsToRender.forEach(item => {
      const renderedItem = this._renderItem(sectionId, item);

      if (renderedItem) {
        fragment.appendChild(renderedItem);
      }
    });

    return fragment.hasChildNodes() ? fragment : null;
  }

  _filterItemsByRole(items, role, sectionId) {
    if (sectionId !== 'contact') {
      return items;
    }

    return items.filter(item => {
      if (item.role) {
        return item.role === role;
      }
      return true;
    });
  }

  _renderItem(sectionId, item) {
    const templateId = this._getTemplateId(sectionId, item);
    const fragment = this.templateBuilder.cloneMetaItemTemplate(templateId);

    if (!fragment) {
      return null;
    }

    switch (sectionId) {
      case 'hero':
        return this._populateLinkItem(fragment, item);
      case 'about':
        return this._populateTagItem(fragment, item);
      case 'skills':
        return this._populateSkillItem(fragment, item);
      case 'experience':
        return this._populateExperienceItem(fragment, item);
      case 'projects':
        return this._populateProjectItem(fragment, item);
      default:
        return fragment.firstElementChild;
    }
  }

  _getTemplateId(sectionId, item) {
    if (LINK_TYPES.includes(item.type)) {
      return 'link-meta-item-template';
    }

    return `${sectionId}-meta-item-template`;
  }

  _populateTagItem(fragment, item) {
    const element = fragment.querySelector('.meta-tag');
    if (element) {
      element.textContent = item.text;
    }
    return element;
  }

  _populateLinkItem(fragment, item) {
    const element = fragment.querySelector('.meta-link');
    if (!element) return null;

    const titleElement = element.querySelector('.meta-link__title');
    if (titleElement) {
      titleElement.textContent = item.title;
    }

    if (item.type === 'email-link') {
      const email = this.profileData?.email || '';
      const subject = encodeURIComponent(item.props?.subject || '');
      const body = encodeURIComponent(item.props?.body || '');
      element.href = `mailto:${email}?subject=${subject}&body=${body}`;
      element.removeAttribute('target');
      element.removeAttribute('rel');
    } else if (item.type === 'link') {
      element.href = item.props?.url || '#';
      if (item.props?.type === 'download') {
        element.setAttribute('download', '');
        element.removeAttribute('target');
        element.removeAttribute('rel');
      }
    }

    return element;
  }

  _populateSkillItem(fragment, item) {
    const element = fragment.querySelector('.skill-item');
    if (!element) return null;

    const nameElement = element.querySelector('.skills-item__name');
    const yearsElement = element.querySelector('.skills-item__years');
    const iconElement = element.querySelector('.skills-item__icon');

    if (nameElement) nameElement.textContent = item.name;
    if (yearsElement) yearsElement.textContent = item.years + " Years";
    if (iconElement) iconElement.textContent = item.icon;

    return element;
  }

  _populateExperienceItem(fragment, item) {
    const element = fragment.querySelector('.experience-card');
    if (!element) return null;

    const roleElement = element.querySelector('.experience-card__role');
    const companyElement = element.querySelector('.experience-card__company');
    const periodElement = element.querySelector('.experience-card__period');
    const descriptionElement = element.querySelector('.experience-card__description');
    const techTags = element.querySelector('#experience-tech-tags');
    const starsElement = element.querySelector('.experience-card__stars');
    const logoWrapper = element.querySelector('.experience-card__logo-wrapper');

    if (roleElement) roleElement.textContent = item.role;
    if (companyElement) companyElement.textContent = item.company;
    if (periodElement) periodElement.textContent = item.period;
    if (descriptionElement) descriptionElement.textContent = item.description;

    if (logoWrapper && item.logoUrl) {
      const logoImg = document.createElement('img');
      logoImg.src = item.logoUrl;
      logoImg.alt = `${item.company} logo`;
      logoImg.className = 'experience-card__logo';
      logoImg.loading = 'lazy';
      logoWrapper.appendChild(logoImg);
    }

    if (starsElement && item.impactScore) {
      starsElement.innerHTML = this._renderStars(item.impactScore);
    }

    if (techTags && item.technologies) {
      const techStackElements = this._generateTagsList(item.technologies);

      techTags.appendChild(techStackElements);
    }

    return element;
  }

  _populateProjectItem(fragment, item) {
    const element = fragment.querySelector('.projects-item');
    if (!element) return null;

    const titleElement = element.querySelector('.projects-item__title');
    const dateElement = element.querySelector('.projects-item__date span');
    const descriptionElement = element.querySelector('.projects-item__description');
    const projectTechTags = element.querySelector('#projects-tech-tags');

    if (titleElement) titleElement.textContent = item.title;
    if (dateElement) dateElement.textContent = item.date;
    if (descriptionElement) descriptionElement.textContent = item.description;

    if (projectTechTags && item.stack) {
      const projectTagsElements = this._generateTagsList(item.stack);

      projectTechTags.appendChild(projectTagsElements);
    }

    return element;
  }

  _renderStars(score, maxStars = 10) {
    const filledStars = Math.min(score, maxStars);
    let starsHtml = '';

    for (let i = 0; i < maxStars; i++) {
      const isActive = i < filledStars;
      starsHtml += `<span class="experience-card__star${isActive ? '' : ' experience-card__star--inactive'}">★</span>`;
    }

    return starsHtml;
  }

  _generateTagsList(items) {
    const fragment = document.createDocumentFragment();

    items.forEach(item => {
      const techTag = document.createElement('span');
      techTag.className = 'meta-tag';
      techTag.textContent = item;

      fragment.appendChild(techTag);
    });

    return fragment.hasChildNodes() ? fragment : null;
  }
}

export default MetaItemRenderer;
