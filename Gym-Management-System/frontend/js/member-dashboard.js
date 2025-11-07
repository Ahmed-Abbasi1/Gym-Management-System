// Member Dashboard JavaScript

let memberData = null;
let currentMemberId = null; // Store globally

// Calculate duration
function calculateDuration(checkIn, checkOut) {
    if (!checkOut) return '-';
    
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffMs = end - start;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

// Load member profile
async function loadMemberProfile() {
    try {
        const userInfo = await apiCall('/auth/me');
        console.log('User Info from /auth/me:', userInfo);
        console.log('Member ID:', userInfo.member_id);
        
        // Store member ID globally
        currentMemberId = userInfo.member_id;
        
        if (!userInfo.member_id) {
            document.getElementById('profileInfo').innerHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-exclamation-triangle"></i> No member profile found. Please contact admin.
                    <br><small>Debug: ${JSON.stringify(userInfo)}</small>
                </div>
            `;
            return;
        }
        
        const details = userInfo.member_details;
        
        document.getElementById('profileInfo').innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <p><strong><i class="bi bi-envelope"></i> Email:</strong> ${userInfo.email}</p>
                    <p><strong><i class="bi bi-telephone"></i> Phone:</strong> ${details.phone}</p>
                    <p><strong><i class="bi bi-calendar"></i> Member Since:</strong> ${formatDate(details.join_date)}</p>
                </div>
                <div class="col-md-6">
                    <p><strong><i class="bi bi-person"></i> Age:</strong> ${details.age} years</p>
                    <p><strong><i class="bi bi-gender-ambiguous"></i> Gender:</strong> ${details.gender}</p>
                    <p><strong><i class="bi bi-circle-fill"></i> Status:</strong> 
                        <span class="badge status-${details.status}">${details.status.toUpperCase()}</span>
                    </p>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading profile:', error);
        document.getElementById('profileInfo').innerHTML = `
            <div class="alert alert-danger">Error loading profile information</div>
        `;
    }
}

// Load subscription info
async function loadSubscriptionInfo() {
    try {
        if (!currentMemberId) {
            document.getElementById('subscriptionInfo').innerHTML = `
                <div class="alert alert-warning">Loading member information...</div>
            `;
            return;
        }
        
        const subscriptions = await apiCall(`/members/${currentMemberId}/subscriptions`);
        
        if (subscriptions.length === 0) {
            document.getElementById('subscriptionInfo').innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> No active subscription. Please contact admin to subscribe.
                </div>
            `;
            return;
        }
        
        const latestSub = subscriptions[0];
        const plan = await apiCall(`/subscriptions/plans/${latestSub.plan_id}`);
        
        const daysLeft = Math.ceil((new Date(latestSub.end_date) - new Date()) / (1000 * 60 * 60 * 24));
        
        document.getElementById('subscriptionInfo').innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6>Plan: <strong>${plan.plan_name}</strong></h6>
                    <p class="mb-1">Duration: ${plan.duration_months} month(s)</p>
                    <p class="mb-1">Price: Rs. ${latestSub.payment_amount}</p>
                    <p>Payment Mode: ${latestSub.payment_mode}</p>
                </div>
                <div class="col-md-6">
                    <p class="mb-1">Start Date: ${formatDate(latestSub.start_date)}</p>
                    <p class="mb-1">End Date: ${formatDate(latestSub.end_date)}</p>
                    <p class="mb-1">Status: <span class="badge status-${latestSub.status}">${latestSub.status.toUpperCase()}</span></p>
                    ${latestSub.status === 'active' ? `
                        <p class="mb-0">
                            ${daysLeft > 0 ? 
                                `<span class="badge ${daysLeft <= 7 ? 'bg-danger' : 'bg-success'}">${daysLeft} days remaining</span>` : 
                                '<span class="badge bg-danger">Expired</span>'
                            }
                        </p>
                    ` : ''}
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading subscription:', error);
        document.getElementById('subscriptionInfo').innerHTML = `
            <div class="alert alert-danger">Error loading subscription information</div>
        `;
    }
}

// Load attendance history
async function loadAttendanceHistory() {
    try {
        if (!currentMemberId) {
            document.getElementById('attendanceTableBody').innerHTML = `
                <tr><td colspan="5" class="text-center">Loading...</td></tr>
            `;
            return;
        }
        
        const attendance = await apiCall(`/members/${currentMemberId}/attendance-history`);
        
        if (attendance.length === 0) {
            document.getElementById('attendanceTableBody').innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">
                        <div class="empty-state">
                            <i class="bi bi-calendar-x"></i>
                            <p>No attendance records yet</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        const recentAttendance = attendance.slice(0, 10);
        
        document.getElementById('attendanceTableBody').innerHTML = recentAttendance.map(record => {
            const isActive = !record.check_out_time;
            const duration = calculateDuration(record.check_in_time, record.check_out_time);
            
            return `
                <tr>
                    <td>${record.date}</td>
                    <td>${formatDateTime(record.check_in_time)}</td>
                    <td>${record.check_out_time ? formatDateTime(record.check_out_time) : '-'}</td>
                    <td>${duration}</td>
                    <td>
                        ${isActive ? 
                            '<span class="badge bg-warning">In Progress</span>' : 
                            '<span class="badge bg-success">Completed</span>'
                        }
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading attendance:', error);
        document.getElementById('attendanceTableBody').innerHTML = `
            <tr><td colspan="5" class="text-center text-danger">Error loading attendance history</td></tr>
        `;
    }
}

// Load workout plans
async function loadWorkoutPlans() {
    try {
        if (!currentMemberId) {
            document.getElementById('workoutPlansContainer').innerHTML = `
                <div class="alert alert-warning">Loading...</div>
            `;
            return;
        }
        
        const plans = await apiCall(`/attendance/workout-plans?member_id=${currentMemberId}`);
        
        if (plans.length === 0) {
            document.getElementById('workoutPlansContainer').innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> No workout plans assigned yet. Contact your trainer.
                </div>
            `;
            return;
        }
        
        document.getElementById('workoutPlansContainer').innerHTML = plans.map(plan => `
            <div class="card mb-3">
                <div class="card-header bg-light">
                    <h6 class="mb-0">${plan.plan_name}</h6>
                    <small class="text-muted">Created: ${formatDate(plan.created_date)}</small>
                    ${plan.trainer_name ? `<small class="text-muted"> | Trainer: ${plan.trainer_name}</small>` : ''}
                </div>
                <div class="card-body">
                    <pre style="white-space: pre-wrap; font-family: inherit;">${plan.exercises}</pre>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading workout plans:', error);
        document.getElementById('workoutPlansContainer').innerHTML = `
            <div class="alert alert-danger">Error loading workout plans</div>
        `;
    }
}

// Initialize member dashboard - LOAD PROFILE FIRST, THEN OTHERS
document.addEventListener('DOMContentLoaded', async function() {
    if (window.location.pathname.includes('member-dashboard.html')) {
        // Load profile first to get member_id
        await loadMemberProfile();
        
        // Then load everything else
        loadSubscriptionInfo();
        loadAttendanceHistory();
        loadWorkoutPlans();
    }
});