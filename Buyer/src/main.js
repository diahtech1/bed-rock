import { account } from './appwrite.js';
import { openFutureUpdatesModal } from './components/Modals.js';

const navigateTo = (url) => {
    history.pushState(null, null, url);
    router();
};

const router = async () => {
    const routes = [
        { path: "/", view: () => import('./views/Home.js').then(m => m.default) },
        { path: "/bookings", view: () => import('./views/Bookings.js').then(m => m.default) },
        { path: "/catalogue", view: () => import('./views/Catalogue.js').then(m => m.default) },
        { path: "/profile", view: () => import('./views/Profile.js').then(m => m.default) },
        { path: "/login", view: () => import('./views/Auth.js').then(m => m.LoginView) },
        { path: "/signup", view: () => import('./views/Auth.js').then(m => m.SignupView) },
        { path: "/building/:id", view: () => import('./views/Building.js').then(m => m.default) },
        { path: "/saveditems", view: () => import('./views/SavedItems.js').then(m => m.default) }
    ];

    const potentialMatches = routes.map(route => {
        return {
            route: route,
            isMatch: location.pathname === route.path || (route.path.includes(':') && location.pathname.startsWith(route.path.split('/:')[0]))
        };
    });

    let match = potentialMatches.find(potentialMatch => potentialMatch.isMatch);

    if (!match) {
        match = {
            route: routes[0],
            isMatch: true
        };
    }

    const appContent = document.getElementById("app-content");
    appContent.innerHTML = "<div style='text-align:center; padding: 2rem;'>Loading...</div>";
    
    let isLogged = false;
    try {
        await account.get();
        isLogged = true;
    } catch(e) {}

    const breadcrumbsEl = document.getElementById("breadcrumbs");
    if (breadcrumbsEl) {
        let breadcrumbHtml = `<a href="${isLogged ? '/bookings' : '/'}" data-link style="color:var(--text-secondary); text-decoration:none;">${isLogged ? 'My Bookings' : 'Home'}</a>`;
        if (match.route.path === '/catalogue') {
            breadcrumbHtml += ` <span style="opacity:0.5; margin:0 0.25rem;">/</span> <span style="color:var(--text-primary);">Catalogue</span>`;
        } else if (match.route.path === '/bookings') {
            breadcrumbHtml = `<span style="color:var(--text-primary);">My Bookings</span>`;
        } else if (match.route.path === '/profile') {
            breadcrumbHtml += ` <span style="opacity:0.5; margin:0 0.25rem;">/</span> <span style="color:var(--text-primary);">Profile</span>`;
        } else if (match.route.path === '/login') {
            breadcrumbHtml += ` <span style="opacity:0.5; margin:0 0.25rem;">/</span> <span style="color:var(--text-primary);">Login</span>`;
        } else if (match.route.path === '/signup') {
            breadcrumbHtml += ` <span style="opacity:0.5; margin:0 0.25rem;">/</span> <span style="color:var(--text-primary);">Sign up</span>`;
        } else if (match.route.path === '/saveditems') {
            breadcrumbHtml += ` <span style="opacity:0.5; margin:0 0.25rem;">/</span> <span style="color:var(--text-primary);">Saved Items</span>`;
        } else if (match.route.path.startsWith('/building/')) {
            breadcrumbHtml += ` <span style="opacity:0.5; margin:0 0.25rem;">/</span> <a href="/catalogue" data-link style="color:var(--text-secondary); text-decoration:none;">Catalogue</a> <span style="opacity:0.5; margin:0 0.25rem;">/</span> <span id="dynamic-breadcrumb" style="color:var(--text-primary);">Building Details</span>`;
        } else if (match.route.path === '/') {
            breadcrumbHtml = ''; // Hidden on home
        }
        breadcrumbsEl.innerHTML = breadcrumbHtml;
    }

    try {
        const ViewClass = await match.route.view();
        let params = {};
        if (match.route.path.includes(':')) {
            params.id = location.pathname.split('/').pop();
        }
        
        const viewInstance = new ViewClass(params);
        appContent.innerHTML = await viewInstance.render();
        if (typeof viewInstance.mounted === 'function') {
            await viewInstance.mounted();
        }
    } catch (e) {
        console.error("Error loading view", e);
        appContent.innerHTML = "<div style='color:red;'>Error loading page.</div>";
    }

    await updateNavbar();
};

export const updateNavbar = async () => {
    const authLinks = document.getElementById('auth-links');
    try {
        const user = await account.get();
        // Set user theme
        if (user.prefs && user.prefs.theme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
        } else {
            document.body.removeAttribute('data-theme');
        }
        
        const brandLink = document.querySelector('.nav-brand a');
        if (brandLink) brandLink.href = '/bookings';
        
        // User logged in
        authLinks.innerHTML = `
            <a href="/bookings" class="btn" style="background: var(--success); display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem;" data-link>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> My Bookings
            </a>
            <a href="/saveditems" class="btn" style="background: transparent; border: 1px solid var(--accent); color: var(--accent); display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem;" data-link>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg> Saved Items
            </a>
            <a href="/catalogue" class="btn" style="background: var(--accent); display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem;" data-link>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg> Catalogues
            </a>
            <button id="future-updates-btn" class="btn" style="background: transparent; border: 1px solid var(--accent); color: var(--accent); display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem;">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg> Future Updates
            </button>
            <a href="/profile" class="btn" style="background: transparent; border: 1px solid var(--accent); color: var(--accent); display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem;" data-link>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg> My Profile
            </a>
            <button id="logout-btn" class="btn" style="background: transparent; border: 1px solid var(--danger); color: var(--danger); display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem;">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg> Logout
            </button>
        `;
        document.getElementById('logout-btn').addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await account.deleteSession('current');
                document.body.removeAttribute('data-theme'); // revert to light on logout
                navigateTo('/');
            } catch (err) {
                console.error('Logout failed', err);
            }
        });
        document.getElementById('future-updates-btn').addEventListener('click', (e) => {
            e.preventDefault();
            openFutureUpdatesModal();
        });
    } catch (err) {
        // User not logged in, ensure light theme
        document.body.removeAttribute('data-theme');
        
        const brandLink = document.querySelector('.nav-brand a');
        if (brandLink) brandLink.href = '/';
        
        authLinks.innerHTML = `
            <a href="/catalogue" class="btn" style="background: var(--accent); display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem;" data-link>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg> Catalogues
            </a>
            <button id="future-updates-btn" class="btn" style="background: transparent; border: 1px solid var(--accent); color: var(--accent); display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem;">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg> Future Updates
            </button>
            <a href="/login" class="btn" style="background: transparent; border: 1px solid var(--accent); color: var(--accent); display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem;" data-link>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path></svg> Login
            </a>
            <a href="/signup" class="btn" style="background: var(--success); display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem;" data-link>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg> Sign up
            </a>
        `;
        document.getElementById('future-updates-btn').addEventListener('click', (e) => {
            e.preventDefault();
            openFutureUpdatesModal();
        });
    }
}

window.addEventListener("popstate", router);

document.addEventListener("DOMContentLoaded", () => {
    document.body.addEventListener("click", e => {
        if (e.target.matches("[data-link]")) {
            e.preventDefault();
            navigateTo(e.target.href);
        }
    });
    router();
});

export { navigateTo };
