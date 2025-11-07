// Subscriptions JavaScript
let allPlans = [];
let allSubscriptions = [];
let allMembers = [];

// Load all subscription plans
async function loadPlans() {
    try {
        allPlans = await apiCall('/subscriptions/plans');
        displayPlans(allPlans);
    } catch (error) {
        showAlert('Error loading plans: ' + error.message, 'danger');
    }
}

// Display plans as cards
function displayPlans(plans) {
    const container = document.getElementById('plansContainer');
    
    if (plans.length === 0) {
        container.innerHTML = `
            <div class="col-12">
                <div class="empty-state">
                    <i class="bi bi-card-list"></i>
                    <p>No subscription plans found</p>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = plans.map(plan => `
        <div class="col-md-4 mb-4 fade-in">
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title">${plan.plan_name}</h5>
                    <h3 class="text-primary">Rs. ${plan.price}</h3>
                    <p class="text-muted">Duration: ${plan.duration_months} month(s)</p>
                    <p class="card-text">${plan.features || 'No additional features'}</p>
                </div>
                <div class="card-footer bg-transparent">
                    <button class="btn btn-sm btn-warning" onclick="editPlan('${plan._id}')">
                        <i class="bi bi-pencil"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deletePlan('${plan._id}', '${plan.plan_name}')">
                        <i class="bi bi-trash"></i> Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Add new plan
async function addPlan() {
    const form = document.getElementById('addPlanForm');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const formData = new FormData(form);
    const planData = {
        plan_name: formData.get('plan_name'),
        duration_months: parseInt(formData.get('duration_months')),
        price: parseFloat(formData.get('price')),
        features: formData.get('features') || ''
    };

    try {
        await apiCall('/subscriptions/plans', 'POST', planData);
        showAlert('Plan added successfully!', 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('addPlanModal'));
        modal.hide();
        form.reset();
        
        loadPlans();
        loadPlansForDropdown();
    } catch (error) {
        showAlert('Error adding plan: ' + error.message, 'danger');
    }
}

// Edit plan (simplified - you can expand this)
async function editPlan(planId) {
    showAlert('Edit functionality - create edit modal similar to members', 'info');
}

// Delete plan
async function deletePlan(planId, planName) {
    if (!confirm(`Are you sure you want to delete "${planName}"?`)) {
        return;
    }

    try {
        await apiCall(`/subscriptions/plans/${planId}`, 'DELETE');
        showAlert('Plan deleted successfully!', 'success');
        loadPlans();
    } catch (error) {
        showAlert('Error deleting plan: ' + error.message, 'danger');
    }
}

// Load member subscriptions
async function loadSubscriptions(status = '') {
    try {
        const params = status ? `?status=${status}` : '';
        allSubscriptions = await apiCall(`/subscriptions/member-subscriptions${params}`);
        
        // Get member and plan details for each subscription
        const subscriptionsWithDetails = await Promise.all(
            allSubscriptions.map(async (sub) => {
                try {
                    const member = await apiCall(`/members/${sub.member_id}`);
                    const plan = await apiCall(`/subscriptions/plans/${sub.plan_id}`);
                    return { ...sub, member, plan };
                } catch (error) {
                    return { ...sub, member: null, plan: null };
                }
            })
        );
        
        displaySubscriptions(subscriptionsWithDetails);
    } catch (error) {
        showAlert('Error loading subscriptions: ' + error.message, 'danger');
    }
}

// Display subscriptions in table
function displaySubscriptions(subscriptions) {
    const tbody = document.getElementById('subscriptionsTableBody');
    
    if (subscriptions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center">
                    <div class="empty-state">
                        <i class="bi bi-credit-card"></i>
                        <p>No subscriptions found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = subscriptions.map(sub => `
        <tr class="fade-in">
            <td><strong>${sub.member ? sub.member.name : 'Unknown'}</strong></td>
            <td>${sub.plan ? sub.plan.plan_name : 'Unknown'}</td>
            <td>${formatDate(sub.start_date)}</td>
            <td>${formatDate(sub.end_date)}</td>
            <td>Rs. ${sub.payment_amount}</td>
            <td><span class="badge bg-secondary">${sub.payment_mode}</span></td>
            <td>
                <span class="badge status-${sub.status}">
                    ${sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                </span>
            </td>
            <td class="action-buttons">
                ${sub.status === 'active' ? `
                    <button class="btn btn-sm btn-warning" onclick="expireSubscription('${sub._id}')" title="Expire">
                        <i class="bi bi-x-circle"></i>
                    </button>
                ` : ''}
                ${sub.status === 'expired' ? `
                    <button class="btn btn-sm btn-success" onclick="renewSubscription('${sub._id}')" title="Renew">
                        <i class="bi bi-arrow-clockwise"></i>
                    </button>
                ` : ''}
                <button class="btn btn-sm btn-danger" onclick="deleteSubscription('${sub._id}')" title="Delete">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Load members for dropdown
async function loadMembersForDropdown() {
    try {
        allMembers = await apiCall('/members/?status=active');
        const select = document.getElementById('memberSelect');
        
        if (allMembers.length === 0) {
            select.innerHTML = '<option value="">No active members found</option>';
            return;
        }
        
        select.innerHTML = '<option value="">Select a member...</option>' +
            allMembers.map(member => 
                `<option value="${member._id}">${member.name} - ${member.email}</option>`
            ).join('');
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

// Load plans for dropdown
async function loadPlansForDropdown() {
    try {
        allPlans = await apiCall('/subscriptions/plans');
        const select = document.getElementById('planSelect');
        
        if (allPlans.length === 0) {
            select.innerHTML = '<option value="">No plans found</option>';
            return;
        }
        
        select.innerHTML = '<option value="">Select a plan...</option>' +
            allPlans.map(plan => 
                `<option value="${plan._id}" data-duration="${plan.duration_months}" data-price="${plan.price}">
                    ${plan.plan_name} - Rs. ${plan.price} (${plan.duration_months} months)
                </option>`
            ).join('');
    } catch (error) {
        console.error('Error loading plans:', error);
    }
}

// Update plan details when plan is selected
function updatePlanDetails() {
    const select = document.getElementById('planSelect');
    const selectedOption = select.options[select.selectedIndex];
    
    if (!selectedOption.value) {
        document.getElementById('planDetailsDiv').style.display = 'none';
        return;
    }
    
    const duration = selectedOption.dataset.duration;
    const price = selectedOption.dataset.price;
    
    document.getElementById('planDetails').innerHTML = `
        <p class="mb-1">Duration: <strong>${duration} month(s)</strong></p>
        <p class="mb-0">Price: <strong>Rs. ${price}</strong></p>
    `;
    document.getElementById('planDetailsDiv').style.display = 'block';
    document.getElementById('paymentAmount').value = price;
    
    // Calculate end date if start date is set
    calculateEndDate();
}

// Calculate end date based on start date and plan duration
function calculateEndDate() {
    const startDate = document.getElementById('startDate').value;
    const planSelect = document.getElementById('planSelect');
    const selectedOption = planSelect.options[planSelect.selectedIndex];
    
    if (!startDate || !selectedOption.value) {
        return;
    }
    
    const duration = parseInt(selectedOption.dataset.duration);
    const start = new Date(startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + duration);
    
    // Format to datetime-local input format
    const endDateString = end.toISOString().slice(0, 16);
    document.getElementById('endDate').value = endDateString;
}

// Add new subscription
async function addSubscription() {
    const form = document.getElementById('addSubscriptionForm');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const formData = new FormData(form);
    const subscriptionData = {
        member_id: formData.get('member_id'),
        plan_id: formData.get('plan_id'),
        start_date: new Date(formData.get('start_date')).toISOString(),
        end_date: new Date(formData.get('end_date')).toISOString(),
        payment_amount: parseFloat(formData.get('payment_amount')),
        payment_mode: formData.get('payment_mode'),
        status: 'active'
    };

    try {
        await apiCall('/subscriptions/member-subscriptions', 'POST', subscriptionData);
        showAlert('Subscription created successfully!', 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('addSubscriptionModal'));
        modal.hide();
        form.reset();
        document.getElementById('planDetailsDiv').style.display = 'none';
        
        loadSubscriptions();
    } catch (error) {
        showAlert('Error creating subscription: ' + error.message, 'danger');
    }
}

// Expire subscription
async function expireSubscription(subId) {
    if (!confirm('Are you sure you want to expire this subscription?')) {
        return;
    }

    try {
        await apiCall(`/subscriptions/member-subscriptions/${subId}/expire`, 'PUT');
        showAlert('Subscription expired successfully!', 'success');
        loadSubscriptions();
    } catch (error) {
        showAlert('Error expiring subscription: ' + error.message, 'danger');
    }
}

// Renew subscription
async function renewSubscription(subId) {
    if (!confirm('Are you sure you want to renew this subscription?')) {
        return;
    }

    try {
        await apiCall(`/subscriptions/member-subscriptions/${subId}/renew`, 'PUT');
        showAlert('Subscription renewed successfully!', 'success');
        loadSubscriptions();
    } catch (error) {
        showAlert('Error renewing subscription: ' + error.message, 'danger');
    }
}

// Delete subscription
async function deleteSubscription(subId) {
    if (!confirm('Are you sure you want to delete this subscription?')) {
        return;
    }

    try {
        await apiCall(`/subscriptions/member-subscriptions/${subId}`, 'DELETE');
        showAlert('Subscription deleted successfully!', 'success');
        loadSubscriptions();
    } catch (error) {
        showAlert('Error deleting subscription: ' + error.message, 'danger');
    }
}

// Load expiring subscriptions
async function loadExpiringSubscriptions(days = 7) {
    try {
        const expiring = await apiCall(`/subscriptions/expiring-soon?days=${days}`);
        displayExpiringSubscriptions(expiring);
    } catch (error) {
        showAlert('Error loading expiring subscriptions: ' + error.message, 'danger');
    }
}

// Display expiring subscriptions
function displayExpiringSubscriptions(data) {
    const container = document.getElementById('expiringContainer');
    
    if (data.length === 0) {
        container.innerHTML = `
            <div class="col-12">
                <div class="alert alert-success">
                    <i class="bi bi-check-circle"></i> No subscriptions expiring soon!
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = data.map(item => `
        <div class="col-md-6 mb-3 fade-in">
            <div class="card border-warning">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h5 class="card-title">${item.member_name}</h5>
                            <p class="card-text mb-1">
                                <i class="bi bi-envelope"></i> ${item.member_email}<br>
                                <i class="bi bi-telephone"></i> ${item.member_phone}
                            </p>
                            <p class="mb-0">
                                <strong>Plan:</strong> ${item.plan_name}<br>
                                <strong>Expires:</strong> ${formatDate(item.end_date)}
                            </p>
                        </div>
                        <div class="text-end">
                            <span class="badge bg-warning text-dark fs-5">
                                ${item.days_remaining} days
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('subscriptions.html')) {
        loadPlans();
        loadSubscriptions();
        loadMembersForDropdown();
        loadPlansForDropdown();
        loadExpiringSubscriptions(7);
        
        // Subscription status filter
        document.getElementById('subscriptionStatusFilter').addEventListener('change', function() {
            loadSubscriptions(this.value);
        });
        
        // Expiring days filter
        document.getElementById('expiringDaysFilter').addEventListener('change', function() {
            loadExpiringSubscriptions(this.value);
        });
        
        // Set default start date to now
        const now = new Date();
        const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        document.getElementById('startDate').value = localDateTime;
    }
});