import { initRouter } from './router.js';
import { login } from './auth.js';

// Setup global error handling for unhandled rejections if needed
window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled Promise Rejection:', event.reason);
});

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });
  }
}

// Sidebar Mobile Toggle
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const btnOpen = document.getElementById('btn-open-sidebar');
  const btnClose = document.getElementById('btn-close-sidebar');

  if (btnOpen && btnClose && sidebar) {
    btnOpen.addEventListener('click', () => {
      sidebar.classList.add('sidebar-open');
    });
    btnClose.addEventListener('click', () => {
      sidebar.classList.remove('sidebar-open');
    });
  }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSidebar();

  // Setup password toggle handler dynamically
  document.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('#btn-toggle-login-pwd');
    if (toggleBtn) {
      const pwdInput = document.getElementById('login-password');
      if (pwdInput) {
        if (pwdInput.type === 'password') {
          pwdInput.type = 'text';
          toggleBtn.textContent = 'Hide';
        } else {
          pwdInput.type = 'password';
          toggleBtn.textContent = 'Show';
        }
      }
    }
  });

  // Future updates modal
  const futureUpdatesBtn = document.getElementById('btn-future-updates');
  if (futureUpdatesBtn) {
    futureUpdatesBtn.addEventListener('click', () => {
      const modal = document.getElementById('modal-future-updates');
      if (modal) {
        modal.showModal();
        // also close sidebar if on mobile
        document.getElementById('sidebar')?.classList.remove('sidebar-open');
      }
    });
  }

  // Setup login handler
  document.addEventListener('submit', async (e) => {
    if (e.target && e.target.id === 'login-form') {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const pwd = document.getElementById('login-password').value;
      const errEl = document.getElementById('login-error');
      const submitBtn = e.target.querySelector('button[type="submit"]');

      errEl.classList.add('hidden');
      
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing you in...';
        submitBtn.style.opacity = '0.7';
        submitBtn.style.pointerEvents = 'none';
      }

      const success = await login(email, pwd);
      
      if (success) {
        window.location.hash = '#/dashboard';
      } else {
        errEl.classList.remove('hidden');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign In';
          submitBtn.style.opacity = '1';
          submitBtn.style.pointerEvents = 'auto';
        }
      }
    }
  });

  // Start the router
  initRouter();
});
