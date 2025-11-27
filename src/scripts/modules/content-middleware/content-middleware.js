class ContentMiddleware {
  constructor(dataSourceUrl = '/data/portfolio-default-content.json') {
    this.dataSourceUrl = dataSourceUrl;
    this.contentData = null;
    this.loadPromise = null;
    this._initializeData();
  }

  _initializeData() {
    this.loadPromise = this._fetchData()
      .then(data => this._parseData(data))
      .then(parsedData => {
        this.contentData = parsedData;
        this.loadPromise = null;
      })
      .catch(error => {
        this.loadPromise = null;
        throw error;
      });
  }

  async _fetchData() {
    const fetchFn = this._getFetch();
    const response = await fetchFn(this.dataSourceUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to load content: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }

  _parseData(data) {
    return data;
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
      throw new Error('Content data not loaded');
    }
  }

  get data() {
    return this.contentData;
  }

  async fetchSectionContent(sectionId, role, customQuery = '') {
    await this._ensureDataLoaded();
    
    const section = this._getSection(sectionId);
    const roleContent = this._getRoleContent(section, role);
    
    return this._buildSectionContent(sectionId, section, roleContent, customQuery);
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

  _buildSectionContent(sectionId, section, roleContent, customQuery) {
    return {
      sectionId,
      title: section.metadata.title,
      text: roleContent.text,
      image: {
        imageUrl: roleContent.imageUrl,
        lowResImageUrl: roleContent.lowResImageUrl,
        imageAlt: roleContent.imageAlt,
        aspectRatio: roleContent.aspectRatio,
      },
      customQuery: customQuery || null
    };
  }

  async getActionPromptPlaceholder(sectionId) {
    await this._ensureDataLoaded();
    
    const section = this._getSection(sectionId);
    return this._extractPlaceholder(section);
  }

  _extractPlaceholder(section) {
    const mainItems = section.metadata?.main_items;
    
    if (mainItems && mainItems.length > 0) {
      return mainItems.join(', ');
    }
    
    return `Ask about ${section.metadata.title}...`;
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
      order: section.metadata.order
    };
  }

  async getUserProfile() {
    await this._ensureDataLoaded();
    
    if (!this.contentData.profile) {
      throw new Error('Profile data not found');
    }
    
    return this.contentData.profile;
  }

  async getMainItems(sectionId) {
    await this._ensureDataLoaded();
    
    const section = this._getSection(sectionId);
    return section.metadata.main_items || [];
  }

  async getAllSections() {
    await this._ensureDataLoaded();
    
    if (!this.contentData.sections) {
      throw new Error('Sections data not found');
    }
    
    const sections = this._mapSections(this.contentData.sections);
    return this._sortSections(sections);
  }

  _mapSections(sectionsData) {
    return Object.keys(sectionsData).map(sectionId => ({
      id: sectionId,
      title: sectionsData[sectionId].metadata.title,
      icon: sectionsData[sectionId].metadata.icon,
      order: sectionsData[sectionId].metadata.order
    }));
  }

  _sortSections(sections) {
    return sections.sort((a, b) => a.order - b.order);
  }
}

export default ContentMiddleware;
