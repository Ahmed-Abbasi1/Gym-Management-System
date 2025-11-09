// Auto-detect environment based on hostname
let API_BASE_URL;
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    API_BASE_URL = 'http://127.0.0.1:8000';
} else if (window.location.hostname === '98.93.16.22') {
    // Check if we're on Part II (port 8081) or Part I
    API_BASE_URL = window.location.port === '8081' 
        ? 'http://98.93.16.22:4000'  // Part II
        : 'http://98.93.16.22:3000'; // Part I
} else if (window.location.hostname === '54.234.22.61') {
    API_BASE_URL = 'http://54.234.22.61:3000';  // Part I
} else {
    // Default fallback
    API_BASE_URL = `http://${window.location.hostname}:3000`;
}

// Global variables
let dashboardData = null;

// Utility Functions
function showLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.style.display = 'block';
    }
}

function hideLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.style.display = 'none';
    }
}

function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function formatCurrency(amount) {
    return `Rs. ${parseFloat(amount).toFixed(2)}`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// API Call Function WITH AUTHENTICATION
async function apiCall(endpoint, method = 'GET', data = null) {
    const token = localStorage.getItem('access_token');
    
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        }
    };

    // Add authorization header if token exists
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        
        // Handle unauthorized
        if (response.status === 401) {
            console.error('Unauthorized - clearing tokens');
            localStorage.clear();
            if (window.location.pathname.includes('/pages/')) {
                window.location.href = '../login.html';
            } else {
                window.location.href = 'login.html';
            }
            return;
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Something went wrong');
        }

        // Handle 204 No Content
        if (response.status === 204) {
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Dashboard Functions
async function loadDashboardData() {
    try {
        console.log('Loading dashboard data...');
        showLoading();
        
        // Fetch dashboard stats
        const stats = await apiCall('/analytics/dashboard');
        console.log('Dashboard data:', stats);
        dashboardData = stats;
        
        // Update member stats
        document.getElementById('totalMembers').textContent = stats.members.total;
        document.getElementById('activeMembers').textContent = stats.members.active;
        document.getElementById('expiredMembers').textContent = stats.members.expired;
        
        // Update revenue stats
        document.getElementById('totalRevenue').textContent = formatCurrency(stats.revenue.total);
        document.getElementById('monthlyRevenue').textContent = formatCurrency(stats.revenue.monthly);
        document.getElementById('yearlyRevenue').textContent = formatCurrency(stats.revenue.yearly);
        
        // Update attendance stats
        document.getElementById('currentlyInGym').textContent = stats.attendance.currently_in_gym;
        document.getElementById('todayCheckIns').textContent = stats.attendance.today;
        document.getElementById('todayInGym').textContent = stats.attendance.currently_in_gym;
        document.getElementById('todayCompleted').textContent = stats.attendance.today - stats.attendance.currently_in_gym;
        
        hideLoading();
        console.log('Dashboard loaded successfully');
    } catch (error) {
        hideLoading();
        console.error('Dashboard Error:', error);
        showAlert('Error loading dashboard data: ' + error.message, 'danger');
    }
}

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Page loaded:', window.location.pathname);
    
    // Check if we're on the ADMIN dashboard page only
    if (window.location.pathname.includes('dashboard.html') && !window.location.pathname.includes('member-dashboard.html')) {
        console.log('Initializing admin dashboard...');
        loadDashboardData();
        
        // Refresh data every 30 seconds
        setInterval(loadDashboardData, 30000);
    }
});

// Export functions for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        apiCall,
        showAlert,
        showLoading,
        hideLoading,
        formatCurrency,
        formatDate,
        formatDateTime,
        API_BASE_URL
    };
}
