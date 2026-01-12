const LINK_TYPES = ['link', 'email-link'];

class MetaItemRenderer {
  constructor(templateBuilder, profileData) {
    this.templateBuilder = templateBuilder;
    this.profileData = profileData;
  }

  render(sectionId, mainItems, currentRole) {
    if (!mainItems || mainItems.length === 0) {
      return null;
    }

    const container = document.createElement('div');
    container.className = 'meta-items-list';

    const itemsToRender = this._filterItemsByRole(mainItems, currentRole, sectionId);

    itemsToRender.forEach(item => {
      const renderedItem = this._renderItem(sectionId, item);
      if (renderedItem) {
        container.appendChild(renderedItem);
      }
    });

    return container;
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
      case 'contact':
        return this._populateLinkItem(fragment, item);
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
    if (yearsElement) yearsElement.textContent = item.years;
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
    const techListElement = element.querySelector('.experience-card__tech-list');
    const starsElement = element.querySelector('.experience-card__stars');

    if (roleElement) roleElement.textContent = item.role;
    if (companyElement) companyElement.textContent = item.company;
    if (periodElement) periodElement.textContent = item.period;
    if (descriptionElement) descriptionElement.textContent = item.description;

    if (starsElement && item.impactScore) {
      starsElement.innerHTML = this._renderStars(item.impactScore);
    }

    if (techListElement && item.technologies) {
      item.technologies.forEach(tech => {
        const techTag = document.createElement('span');
        techTag.className = 'experience-card__tech-tag';
        techTag.textContent = tech;
        techListElement.appendChild(techTag);
      });
    }

    return element;
  }

  _populateProjectItem(fragment, item) {
    const element = fragment.querySelector('.projects-item');
    if (!element) return null;

    const titleElement = element.querySelector('.projects-item__title');
    const dateElement = element.querySelector('.projects-item__date span');
    const descriptionElement = element.querySelector('.projects-item__description');
    const stackSection = element.querySelector('.projects-item__stack-section');

    if (titleElement) titleElement.textContent = item.title;
    if (dateElement) dateElement.textContent = item.date;
    if (descriptionElement) descriptionElement.textContent = item.description;

    if (stackSection && item.stack) {
      item.stack.forEach(tech => {
        const techTag = document.createElement('span');
        techTag.className = 'projects-item__stack-tag';
        techTag.textContent = tech;
        stackSection.appendChild(techTag);
      });
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
}

export default MetaItemRenderer;
