// Navigation functionality

export function initializeNavigation() {
    console.log('Navigation module initialized');
    
    // Mobile navigation toggle functionality will be added here
    // when navigation component is implemented
}

export function toggleMobileMenu() {
    // Mobile menu toggle logic
    const mobileMenu = document.querySelector('.navigation__mobile-menu');
    const hamburger = document.querySelector('.navigation__hamburger');
    
    if (mobileMenu && hamburger) {
        mobileMenu.classList.toggle('navigation__mobile-menu--active');
        hamburger.classList.toggle('navigation__hamburger--active');
    }
}