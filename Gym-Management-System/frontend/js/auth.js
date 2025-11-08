// Check if user is logged in
function isAuthenticated() {
    return localStorage.getItem('access_token') !== null;
}

// Get user role
function getUserRole() {
    return localStorage.getItem('user_role');
}

// Get user info
function getUserInfo() {
    return {
        token: localStorage.getItem('access_token'),
        role: localStorage.getItem('user_role'),
        userId: localStorage.getItem('user_id'),
        name: localStorage.getItem('user_name')
    };
}

// Check if user is admin
function isAdmin() {
    return getUserRole() === 'admin';
}

// Logout function
function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    
    // Check if we're in a subdirectory
    if (window.location.pathname.includes('/pages/')) {
        window.location.href = '../login.html';
    } else {
        window.location.href = 'login.html';
    }
}

// Protect admin pages
function requireAdmin() {
    if (!isAuthenticated()) {
        if (window.location.pathname.includes('/pages/')) {
            window.location.href = '../login.html';
        } else {
            window.location.href = 'login.html';
        }
        return false;
    }
    
    function isAuthenticated() {
    if (AUTH_DISABLED) return true;
    return localStorage.getItem('access_token') !== null;
}

// Protect member pages
function requireAuth() {
    if (!isAuthenticated()) {
        if (window.location.pathname.includes('/pages/')) {
            window.location.href = '../login.html';
        } else {
            window.location.href = 'login.html';
        }
        return false;
    }
    return true;
}

// Get authorization header
function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}
