// Members JavaScript
let allMembers = [];
let currentSearchTerm = '';
let currentStatusFilter = '';
let currentGenderFilter = '';

// Load all members
async function loadMembers() {
    try {
        const params = new URLSearchParams();
        if (currentStatusFilter) params.append('status', currentStatusFilter);
        if (currentGenderFilter) params.append('gender', currentGenderFilter);
        if (currentSearchTerm) params.append('search', currentSearchTerm);

        const queryString = params.toString();
        const endpoint = queryString ? `/members/?${queryString}` : '/members/';
        
        allMembers = await apiCall(endpoint);
        displayMembers(allMembers);
    } catch (error) {
        showAlert('Error loading members: ' + error.message, 'danger');
        document.getElementById('membersTableBody').innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-danger">
                    <i class="bi bi-exclamation-triangle"></i> Error loading members
                </td>
            </tr>
        `;
    }
}

// Display members in table
function displayMembers(members) {
    const tbody = document.getElementById('membersTableBody');
    
    if (members.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center">
                    <div class="empty-state">
                        <i class="bi bi-people"></i>
                        <p>No members found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = members.map(member => `
        <tr class="fade-in">
            <td><strong>${member.name}</strong></td>
            <td>${member.email}</td>
            <td>${member.phone}</td>
            <td>${member.age}</td>
            <td>${member.gender}</td>
            <td>${formatDate(member.join_date)}</td>
            <td>
                <span class="badge status-${member.status}">
                    ${member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                </span>
            </td>
            <td class="action-buttons">
                <button class="btn btn-sm btn-info" onclick="viewMember('${member._id}')" title="View Details">
                    <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-sm btn-warning" onclick="editMember('${member._id}')" title="Edit">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteMember('${member._id}', '${member.name}')" title="Delete">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Add new member with auto-generated login
async function addMember() {
    const form = document.getElementById('addMemberForm');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const formData = new FormData(form);
    const defaultPassword = 'Gym@123';
    
    const memberData = {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        age: parseInt(formData.get('age')),
        gender: formData.get('gender'),
        address: formData.get('address'),
        emergency_contact: formData.get('emergency_contact'),
        status: formData.get('status') || 'active'
    };

    try {
        // Create member
        const member = await apiCall('/members/', 'POST', memberData);
        
        // Create login credentials
        try {
            await apiCall('/auth/register', 'POST', {
                email: memberData.email,
                password: defaultPassword,
                name: memberData.name,
                role: 'member'
            });
            
            // Show credentials in a styled alert
            const credentialsAlert = `
                <div class="alert alert-success alert-dismissible fade show" role="alert" style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 9999; min-width: 400px;">
                    <h5 class="alert-heading"><i class="bi bi-check-circle"></i> Member Added Successfully!</h5>
                    <hr>
                    <p><strong>Login Credentials:</strong></p>
                    <p class="mb-1"><strong>Email:</strong> ${memberData.email}</p>
                    <p class="mb-3"><strong>Password:</strong> ${defaultPassword}</p>
                    <small>Please share these credentials with the member.</small>
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', credentialsAlert);
            
            setTimeout(() => {
                document.querySelector('.alert-success').remove();
            }, 10000);
            
        } catch (authError) {
            if (authError.message.includes('already registered')) {
                showAlert('Member added. Login already exists for this email.', 'info');
            } else {
                showAlert('Member added but login creation failed.', 'warning');
            }
        }
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('addMemberModal'));
        modal.hide();
        form.reset();
        loadMembers();
        
    } catch (error) {
        showAlert('Error adding member: ' + error.message, 'danger');
    }
}

// View member details
async function viewMember(memberId) {
    try {
        const member = await apiCall(`/members/${memberId}`);
        
        // Get member's subscriptions
        const subscriptions = await apiCall(`/members/${memberId}/subscriptions`);
        
        // Get member's attendance
        const attendance = await apiCall(`/members/${memberId}/attendance-history`);
        
        // Check if member has active subscription
        const hasActiveSubscription = subscriptions.some(sub => sub.status === 'active');
        
        const detailsContent = `
            <div class="row">
                <div class="col-md-6">
                    <h6 class="text-muted">Personal Information</h6>
                    <table class="table table-sm">
                        <tr>
                            <th>Name:</th>
                            <td>${member.name}</td>
                        </tr>
                        <tr>
                            <th>Email:</th>
                            <td>${member.email}</td>
                        </tr>
                        <tr>
                            <th>Phone:</th>
                            <td>${member.phone}</td>
                        </tr>
                        <tr>
                            <th>Age:</th>
                            <td>${member.age}</td>
                        </tr>
                        <tr>
                            <th>Gender:</th>
                            <td>${member.gender}</td>
                        </tr>
                        <tr>
                            <th>Emergency Contact:</th>
                            <td>${member.emergency_contact}</td>
                        </tr>
                        <tr>
                            <th>Address:</th>
                            <td>${member.address}</td>
                        </tr>
                        <tr>
                            <th>Join Date:</th>
                            <td>${formatDate(member.join_date)}</td>
                        </tr>
                        <tr>
                            <th>Status:</th>
                            <td>
                                <span class="badge status-${member.status}">
                                    ${member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                                </span>
                            </td>
                        </tr>
                    </table>
                    
                    ${!hasActiveSubscription ? `
                        <div class="alert alert-warning">
                            <i class="bi bi-exclamation-triangle"></i> No active subscription
                        </div>
                        <button class="btn btn-success w-100" onclick="openSubscribeModal('${member._id}', '${member.name}')">
                            <i class="bi bi-credit-card"></i> Subscribe to Plan
                        </button>
                    ` : ''}
                </div>
                <div class="col-md-6">
                    <h6 class="text-muted">Subscription History</h6>
                    ${subscriptions.length > 0 ? `
                        <div class="list-group mb-3">
                            ${subscriptions.slice(0, 3).map(sub => `
                                <div class="list-group-item">
                                    <div class="d-flex justify-content-between">
                                        <strong>Rs. ${sub.payment_amount}</strong>
                                        <span class="badge status-${sub.status}">${sub.status}</span>
                                    </div>
                                    <small class="text-muted">
                                        ${formatDate(sub.start_date)} - ${formatDate(sub.end_date)}
                                    </small>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="text-muted">No subscriptions yet</p>'}
                    
                    ${hasActiveSubscription ? `
                        <button class="btn btn-primary w-100 mb-3" onclick="openSubscribeModal('${member._id}', '${member.name}')">
                            <i class="bi bi-plus-circle"></i> Add Another Subscription
                        </button>
                    ` : ''}
                    
                    <h6 class="text-muted mt-4">Recent Attendance</h6>
                    ${attendance.length > 0 ? `
                        <div class="list-group">
                            ${attendance.slice(0, 5).map(att => `
                                <div class="list-group-item">
                                    <div class="d-flex justify-content-between">
                                        <strong>${att.date}</strong>
                                        ${att.check_out_time ? 
                                            '<span class="badge bg-success">Completed</span>' : 
                                            '<span class="badge bg-warning">In Progress</span>'
                                        }
                                    </div>
                                    <small class="text-muted">
                                        In: ${formatDateTime(att.check_in_time)}
                                        ${att.check_out_time ? `<br>Out: ${formatDateTime(att.check_out_time)}` : ''}
                                    </small>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="text-muted">No attendance records yet</p>'}
                </div>
            </div>
        `;
        
        document.getElementById('memberDetailsContent').innerHTML = detailsContent;
        const modal = new bootstrap.Modal(document.getElementById('viewMemberModal'));
        modal.show();
    } catch (error) {
        showAlert('Error loading member details: ' + error.message, 'danger');
    }
}

// Edit member
async function editMember(memberId) {
    try {
        const member = await apiCall(`/members/${memberId}`);
        
        // Populate form
        document.getElementById('editMemberId').value = member._id;
        document.getElementById('editName').value = member.name;
        document.getElementById('editEmail').value = member.email;
        document.getElementById('editPhone').value = member.phone;
        document.getElementById('editEmergencyContact').value = member.emergency_contact;
        document.getElementById('editAge').value = member.age;
        document.getElementById('editGender').value = member.gender;
        document.getElementById('editAddress').value = member.address;
        document.getElementById('editStatus').value = member.status;
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('editMemberModal'));
        modal.show();
    } catch (error) {
        showAlert('Error loading member data: ' + error.message, 'danger');
    }
}

// Update member
async function updateMember() {
    const memberId = document.getElementById('editMemberId').value;
    
    const updateData = {
        name: document.getElementById('editName').value,
        email: document.getElementById('editEmail').value,
        phone: document.getElementById('editPhone').value,
        emergency_contact: document.getElementById('editEmergencyContact').value,
        age: parseInt(document.getElementById('editAge').value),
        gender: document.getElementById('editGender').value,
        address: document.getElementById('editAddress').value,
        status: document.getElementById('editStatus').value
    };

    try {
        await apiCall(`/members/${memberId}`, 'PUT', updateData);
        showAlert('Member updated successfully!', 'success');
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editMemberModal'));
        modal.hide();
        
        // Reload members
        loadMembers();
    } catch (error) {
        showAlert('Error updating member: ' + error.message, 'danger');
    }
}

// Delete member
async function deleteMember(memberId, memberName) {
    if (!confirm(`Are you sure you want to delete ${memberName}?\n\nThis will also delete all their subscriptions and attendance records.`)) {
        return;
    }

    try {
        // First, check and expire all active subscriptions
        const subscriptions = await apiCall(`/subscriptions/member-subscriptions?member_id=${memberId}&status=active`);
        
        if (subscriptions.length > 0) {
            // Expire all active subscriptions
            for (const sub of subscriptions) {
                await apiCall(`/subscriptions/member-subscriptions/${sub._id}/expire`, 'PUT');
            }
            showAlert('Active subscriptions expired. Now deleting member...', 'info');
        }
        
        // Now delete the member
        await apiCall(`/members/${memberId}`, 'DELETE');
        showAlert('Member deleted successfully!', 'success');
        loadMembers();
    } catch (error) {
        showAlert('Error deleting member: ' + error.message, 'danger');
    }
}

// Search members
function searchMembers() {
    currentSearchTerm = document.getElementById('searchInput').value;
    loadMembers();
}

// Reset filters
function resetFilters() {
    currentSearchTerm = '';
    currentStatusFilter = '';
    currentGenderFilter = '';
    
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('genderFilter').value = '';
    
    loadMembers();
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('members.html')) {
        loadMembers();
        
        // Search input with debounce
        let searchTimeout;
        document.getElementById('searchInput').addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(searchMembers, 500);
        });
        
        // Status filter
        document.getElementById('statusFilter').addEventListener('change', function() {
            currentStatusFilter = this.value;
            loadMembers();
        });
        
        // Gender filter
        document.getElementById('genderFilter').addEventListener('change', function() {
            currentGenderFilter = this.value;
            loadMembers();
        });
    }
});
// Open subscribe modal from member details
async function openSubscribeModal(memberId, memberName) {
    try {
        // Close the view member modal
        const viewModal = bootstrap.Modal.getInstance(document.getElementById('viewMemberModal'));
        if (viewModal) {
            viewModal.hide();
        }
        
        // Load plans
        const plans = await apiCall('/subscriptions/plans');
        
        if (plans.length === 0) {
            showAlert('No subscription plans available. Please create plans first.', 'warning');
            return;
        }
        
        // Create and show subscribe modal
        const modalHtml = `
            <div class="modal fade" id="quickSubscribeModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Subscribe ${memberName} to Plan</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="quickSubscribeForm">
                                <input type="hidden" id="quickMemberId" value="${memberId}">
                                <div class="mb-3">
                                    <label class="form-label">Select Plan *</label>
                                    <select class="form-select" id="quickPlanSelect" required onchange="updateQuickPlanDetails()">
                                        <option value="">Select a plan...</option>
                                        ${plans.map(plan => `
                                            <option value="${plan._id}" data-duration="${plan.duration_months}" data-price="${plan.price}">
                                                ${plan.plan_name} - Rs. ${plan.price} (${plan.duration_months} months)
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="mb-3" id="quickPlanDetailsDiv" style="display: none;">
                                    <div class="alert alert-info">
                                        <strong>Plan Details:</strong>
                                        <div id="quickPlanDetails"></div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Start Date *</label>
                                    <input type="datetime-local" class="form-control" id="quickStartDate" required onchange="calculateQuickEndDate()">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">End Date *</label>
                                    <input type="datetime-local" class="form-control" id="quickEndDate" required readonly>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Payment Amount (Rs.) *</label>
                                    <input type="number" class="form-control" id="quickPaymentAmount" required readonly>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Payment Mode *</label>
                                    <select class="form-select" id="quickPaymentMode" required>
                                        <option value="Cash">Cash</option>
                                        <option value="Card">Card</option>
                                        <option value="UPI">UPI</option>
                                        <option value="Net Banking">Net Banking</option>
                                    </select>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-success" onclick="submitQuickSubscription()">Create Subscription</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('quickSubscribeModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Set default start date
        const now = new Date();
        const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        document.getElementById('quickStartDate').value = localDateTime;
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('quickSubscribeModal'));
        modal.show();
        
        // Clean up modal after it's hidden
        document.getElementById('quickSubscribeModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
        
    } catch (error) {
        showAlert('Error opening subscription form: ' + error.message, 'danger');
    }
}

// Update plan details in quick subscribe modal
function updateQuickPlanDetails() {
    const select = document.getElementById('quickPlanSelect');
    const selectedOption = select.options[select.selectedIndex];
    
    if (!selectedOption.value) {
        document.getElementById('quickPlanDetailsDiv').style.display = 'none';
        return;
    }
    
    const duration = selectedOption.dataset.duration;
    const price = selectedOption.dataset.price;
    
    document.getElementById('quickPlanDetails').innerHTML = `
        <p class="mb-1">Duration: <strong>${duration} month(s)</strong></p>
        <p class="mb-0">Price: <strong>Rs. ${price}</strong></p>
    `;
    document.getElementById('quickPlanDetailsDiv').style.display = 'block';
    document.getElementById('quickPaymentAmount').value = price;
    
    calculateQuickEndDate();
}

// Calculate end date for quick subscribe
function calculateQuickEndDate() {
    const startDate = document.getElementById('quickStartDate').value;
    const planSelect = document.getElementById('quickPlanSelect');
    const selectedOption = planSelect.options[planSelect.selectedIndex];
    
    if (!startDate || !selectedOption.value) {
        return;
    }
    
    const duration = parseInt(selectedOption.dataset.duration);
    const start = new Date(startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + duration);
    
    const endDateString = end.toISOString().slice(0, 16);
    document.getElementById('quickEndDate').value = endDateString;
}

// Submit quick subscription
async function submitQuickSubscription() {
    const form = document.getElementById('quickSubscribeForm');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const subscriptionData = {
        member_id: document.getElementById('quickMemberId').value,
        plan_id: document.getElementById('quickPlanSelect').value,
        start_date: new Date(document.getElementById('quickStartDate').value).toISOString(),
        end_date: new Date(document.getElementById('quickEndDate').value).toISOString(),
        payment_amount: parseFloat(document.getElementById('quickPaymentAmount').value),
        payment_mode: document.getElementById('quickPaymentMode').value,
        status: 'active'
    };
    
    try {
        await apiCall('/subscriptions/member-subscriptions', 'POST', subscriptionData);
        showAlert('Subscription created successfully!', 'success');
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('quickSubscribeModal'));
        modal.hide();
        
        // Reload members to update status
        loadMembers();
        
    } catch (error) {
        showAlert('Error creating subscription: ' + error.message, 'danger');
    }
}