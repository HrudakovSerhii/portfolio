class ContentMiddleware {
  constructor(baseDataUrl) {
    // baseDataUrl should be the full path to content-structure.json
    // e.g., '/data/content-structure.json'
    this.dataUrl = baseDataUrl;
    this.contentData = null;
    this.loadPromise = null;
  }

  async initialize() {
    await this._loadContent();
  }

  async _loadContent() {
    try {
      const fetchFn = this._getFetch();
      const response = await fetchFn(this.dataUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      this.contentData = await response.json();
    } catch (error) {
      throw new Error(`Failed to load content: ${error.message}`);
    }
  }

  _getFetch() {
    if (typeof universalFetch !== 'undefined') {
      return universalFetch;
    }
    if (typeof fetch !== 'undefined') {
      return fetch;
    }
    throw new Error('No fetch implementation available');
  }

  async _ensureDataLoaded() {
    if (this.loadPromise) {
      await this.loadPromise;
    }
    if (!this.contentData) {
      throw new Error('Content data not loaded. Call initialize() first.');
    }
  }

  get data() {
    return this.contentData;
  }

  async fetchSectionContent(sectionId, role, customQuery = '') {
    await this._ensureDataLoaded();

    const section = this._getSection(sectionId);
    const roleContent = this._getRoleContent(section, role);

    return this._buildSectionContent({
      sectionId,
      role,
      section,
      roleContent,
      customQuery
    });
  }

  _getSection(sectionId) {
    const section = this.contentData.sections?.[sectionId];
    if (!section) {
      throw new Error(`Section "${sectionId}" not found`);
    }
    return section;
  }

  _getRoleContent(section, role) {
    const roleContent = section.content?.[role];
    if (!roleContent) {
      throw new Error(`Content for role "${role}" not found`);
    }
    return roleContent;
  }

  _buildSectionContent({ sectionId, role, section, roleContent, customQuery }) {
    const contentData = roleContent.content || {};
    const headerData = roleContent.header || {};
    const imageName = contentData.image?.name || `${sectionId}.${role}`;

    return {
      sectionId,
      header: {
        text: headerData.text || section.metadata.title,
        subText: headerData.subText || ''
      },
      content: {
        text: contentData.text || '',
        subText: contentData.subText || '',
        image: contentData.image ? {
          imageUrl: `/assets/images/${imageName}.full.webp`,
          lowResImageUrl: `/assets/images/${imageName}.low.webp`,
          imageAlt: contentData.image.imageAlt || section.metadata.title,
          aspectRatio: contentData.image.aspectRatio || 'aspect-portrait',
        } : null
      },
      customQuery: customQuery || null
    };
  }

  async getSectionMetadata(sectionId) {
    await this._ensureDataLoaded();

    const section = this._getSection(sectionId);
    return this._buildMetadata(sectionId, section);
  }

  _buildMetadata(sectionId, section) {
    return {
      id: sectionId,
      title: section.metadata.title,
      icon: section.metadata.icon,
      order: section.metadata.order,
      mainItems: section.metadata.main_items,
    };
  }

  async getUserProfile() {
    await this._ensureDataLoaded();

    if (!this.contentData.profile) {
      throw new Error('Profile data not found');
    }

    return this.contentData.profile;
  }

  async getAllSections() {
    await this._ensureDataLoaded();

    if (!this.contentData.sections) {
      throw new Error('Sections data not found');
    }

    return this._mapSections(this.contentData.sections);
  }

  _mapSections(sectionsData) {
    return Object.keys(sectionsData).map(sectionId => ({
      id: sectionId,
      title: sectionsData[sectionId].metadata.title,
      icon: sectionsData[sectionId].metadata.icon,
      order: sectionsData[sectionId].metadata.order
    }));
  }
}

export default ContentMiddleware;
