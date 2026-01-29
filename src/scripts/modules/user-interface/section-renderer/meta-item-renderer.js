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
      const renderedItem = this._renderItem(sectionId, item, currentRole);

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

  _renderItem(sectionId, item, role) {
    const templateId = this._getTemplateId(sectionId, item);
    const fragment = this.templateBuilder.cloneMetaItemTemplate(templateId);

    if (!fragment) {
      return null;
    }

    switch (sectionId) {
      case 'about':
        return this._populateTagItem(fragment, item);
      case 'skills':
        return this._populateSkillItem(fragment, item);
      case 'soft-skills':
        return this._populateSoftSkillItem(fragment, item);
      case 'experience':
        return this._populateExperienceItem(fragment, item);
      case 'projects':
        return this._populateProjectItem(fragment, item);
      case 'contact':
        return this._populateContactItem(fragment, item, role);
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

    const nameElement = element.querySelector('.skill-item__name');
    const yearsElement = element.querySelector('.skill-item__years');
    const iconElement = element.querySelector('.skill-item__icon');

    if (nameElement) nameElement.textContent = item.name;
    if (yearsElement) yearsElement.textContent = item.years + " Years";
    if (iconElement) iconElement.textContent = item.icon;

    return element;
  }

  _populateSoftSkillItem(fragment, item) {
    const element = fragment.querySelector('.soft-skills-item');
    if (!element) return null;

    const iconElement = element.querySelector('.soft-skills-item__icon');
    const titleElement = element.querySelector('.soft-skills-item__title');
    const listElement = element.querySelector('.soft-skills-item__list');

    if (iconElement) iconElement.textContent = item.icon;
    if (titleElement) titleElement.textContent = item.title;

    if (listElement && item.items) {
      item.items.forEach(listItem => {
        const li = document.createElement('li');
        li.textContent = listItem;
        listElement.appendChild(li);
      });
    }

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

    if (techTags && item.technologies) {
      const techStackElements = this._generateTagsList(item.technologies);

      techTags.appendChild(techStackElements);
    }

    element.addEventListener('click', () => {
      const isOpen = element.classList.contains('experience-card--open');

      document.querySelectorAll('.experience-card--open').forEach(card => {
        card.classList.remove('experience-card--open');
      });

      if (!isOpen) {
        element.classList.add('experience-card--open');
      }
    });

    return element;
  }

  _populateProjectItem(fragment, item) {
    const element = fragment.querySelector('.projects-item');
    if (!element) return null;

    const titleElement = element.querySelector('.projects-item__title');
    const dateElement = element.querySelector('.projects-item__date span');
    const linkElement = element.querySelector('.projects-item__link');
    const descriptionElement = element.querySelector('.projects-item__description');
    const projectTechTags = element.querySelector('#projects-tech-tags');

    if (titleElement) titleElement.textContent = item.title;
    if (dateElement) dateElement.textContent = item.date;
    if (descriptionElement) descriptionElement.textContent = item.description;

    if (item.link) {
      if (linkElement) linkElement.href = item.link;
    } else {
      if (linkElement) linkElement.style = 'display:none';
    }

    if (projectTechTags && item.stack) {
      const projectTagsElements = this._generateTagsList(item.stack);

      projectTechTags.appendChild(projectTagsElements);
    }

    return element;
  }

  _populateContactItem(fragment, item, role) {
    const element = fragment.querySelector('.contact-card');
    if (!element) return null;

    const titleElement = element.querySelector('.contact-card__title');
    const subtitleElement = element.querySelector('.contact-card__subtitle');
    const iconElement = element.querySelector('.contact-card__icon use');
    const linkElement = element;

    if (titleElement) titleElement.textContent = item.title;
    if (subtitleElement) subtitleElement.textContent = item.subtitle;
    if (iconElement) iconElement.setAttribute('href', `#icon-${item.icon}`);

    if (linkElement) {
      if (item.type === 'email-contact-link') {
        const email = this.profileData?.email || '';
        const roleData = item.roleItems?.[role] || {};
        const subject = encodeURIComponent(roleData.subject || '');
        const body = encodeURIComponent(roleData.body || '');

        linkElement.href = `mailto:${email}?subject=${subject}&body=${body}`;
        linkElement.removeAttribute('target');
        linkElement.removeAttribute('rel');
      } else if (item.type === 'contact-link') {
        linkElement.href = item.href || '#';
        linkElement.setAttribute('target', '_blank');
        linkElement.setAttribute('rel', 'noopener noreferrer');
      }
    }

    return element;
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
