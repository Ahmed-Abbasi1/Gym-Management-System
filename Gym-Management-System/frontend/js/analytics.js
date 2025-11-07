// Analytics JavaScript
let revenueChart = null;
let memberGrowthChart = null;
let memberStatusChart = null;
let revenueByPlanChart = null;

// Initialize year select
function initializeYearSelect() {
    const currentYear = new Date().getFullYear();
    const yearSelect = document.getElementById('revenueYearSelect');
    
    for (let year = currentYear; year >= currentYear - 5; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) option.selected = true;
        yearSelect.appendChild(option);
    }
    
    // Set current month
    const currentMonth = new Date().getMonth() + 1;
    document.getElementById('revenueMonthSelect').value = currentMonth;
}

// Load monthly revenue report
async function loadMonthlyRevenue() {
    const year = document.getElementById('revenueYearSelect').value;
    const month = document.getElementById('revenueMonthSelect').value;
    
    try {
        const data = await apiCall(`/analytics/revenue/monthly?year=${year}&month=${month}`);
        
        const statsHtml = `
            <div class="row text-center">
                <div class="col-md-3">
                    <h4 class="text-success">${formatCurrency(data.total_revenue)}</h4>
                    <p class="text-muted">Total Revenue</p>
                </div>
                <div class="col-md-3">
                    <h4 class="text-primary">${data.total_subscriptions}</h4>
                    <p class="text-muted">Subscriptions</p>
                </div>
                <div class="col-md-3">
                    <h4 class="text-info">${formatCurrency(data.average_per_subscription)}</h4>
                    <p class="text-muted">Average per Sub</p>
                </div>
                <div class="col-md-3">
                    <div class="card">
                        <div class="card-body">
                            <strong>Payment Breakdown:</strong>
                            ${Object.entries(data.payment_breakdown).map(([mode, amount]) => `
                                <div class="d-flex justify-content-between">
                                    <span>${mode}:</span>
                                    <strong>${formatCurrency(amount)}</strong>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('monthlyRevenueStats').innerHTML = statsHtml;
        
    } catch (error) {
        showAlert('Error loading monthly revenue: ' + error.message, 'danger');
    }
}

// Load yearly revenue chart
async function loadYearlyRevenueChart() {
    const year = document.getElementById('revenueYearSelect').value;
    
    try {
        const data = await apiCall(`/analytics/revenue/yearly?year=${year}`);
        
        const ctx = document.getElementById('revenueChart').getContext('2d');
        
        if (revenueChart) {
            revenueChart.destroy();
        }
        
        revenueChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.monthly_breakdown.map(m => m.month_name),
                datasets: [{
                    label: `Revenue ${year}`,
                    data: data.monthly_breakdown.map(m => m.revenue),
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: true,
                        text: `Monthly Revenue for ${year}`
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'Rs. ' + value;
                            }
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        showAlert('Error loading yearly revenue: ' + error.message, 'danger');
    }
}

// Load member growth chart
async function loadMemberGrowthChart() {
    const year = new Date().getFullYear();
    
    try {
        const data = await apiCall(`/analytics/members/growth?year=${year}`);
        
        const ctx = document.getElementById('memberGrowthChart').getContext('2d');
        
        if (memberGrowthChart) {
            memberGrowthChart.destroy();
        }
        
        memberGrowthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.monthly_breakdown.map(m => m.month_name),
                datasets: [{
                    label: 'New Members',
                    data: data.monthly_breakdown.map(m => m.new_members),
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: true,
                        text: `Member Growth ${year}`
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        showAlert('Error loading member growth: ' + error.message, 'danger');
    }
}

// Load member status distribution chart
async function loadMemberStatusChart() {
    try {
        const data = await apiCall('/analytics/dashboard');
        
        const ctx = document.getElementById('memberStatusChart').getContext('2d');
        
        if (memberStatusChart) {
            memberStatusChart.destroy();
        }
        
        memberStatusChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Active', 'Inactive', 'Expired'],
                datasets: [{
                    data: [
                        data.members.active,
                        data.members.inactive,
                        data.members.expired
                    ],
                    backgroundColor: [
                        'rgba(40, 167, 69, 0.8)',
                        'rgba(108, 117, 125, 0.8)',
                        'rgba(255, 193, 7, 0.8)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    },
                    title: {
                        display: true,
                        text: 'Member Status Distribution'
                    }
                }
            }
        });
        
    } catch (error) {
        showAlert('Error loading member status: ' + error.message, 'danger');
    }
}

// Load plan popularity table
async function loadPlanPopularity() {
    try {
        const plans = await apiCall('/analytics/plans/popularity');
        
        const tbody = document.getElementById('planPopularityTable');
        
        if (plans.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">No data available</td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = plans.map((plan, index) => `
            <tr>
                <td>
                    ${index === 0 ? '<i class="bi bi-trophy-fill text-warning"></i> ' : ''}
                    <strong>${plan.plan_name}</strong>
                </td>
                <td>${plan.duration_months} month(s)</td>
                <td>${formatCurrency(plan.price)}</td>
                <td><span class="badge bg-primary">${plan.total_subscriptions}</span></td>
                <td><span class="badge bg-success">${plan.active_subscriptions}</span></td>
                <td><strong class="text-success">${formatCurrency(plan.price * plan.total_subscriptions)}</strong></td>
            </tr>
        `).join('');
        
    } catch (error) {
        showAlert('Error loading plan popularity: ' + error.message, 'danger');
    }
}

// Load revenue by plan chart
async function loadRevenueByPlanChart() {
    try {
        const data = await apiCall('/analytics/revenue/by-plan');
        
        const ctx = document.getElementById('revenueByPlanChart').getContext('2d');
        
        if (revenueByPlanChart) {
            revenueByPlanChart.destroy();
        }
        
        revenueByPlanChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(p => p.plan_name),
                datasets: [{
                    label: 'Total Revenue',
                    data: data.map(p => p.total_revenue),
                    backgroundColor: 'rgba(255, 159, 64, 0.6)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Revenue by Subscription Plan'
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'Rs. ' + value;
                            }
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        showAlert('Error loading revenue by plan: ' + error.message, 'danger');
    }
}

// Load attendance summary
async function loadAttendanceSummary() {
    const startDate = document.getElementById('attendanceStartDate').value;
    const endDate = document.getElementById('attendanceEndDate').value;
    
    let endpoint = '/analytics/attendance/summary';
    const params = new URLSearchParams();
    
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const queryString = params.toString();
    if (queryString) {
        endpoint += '?' + queryString;
    }
    
    try {
        const data = await apiCall(endpoint);
        
        const statsHtml = `
            <div class="row text-center">
                <div class="col-md-4">
                    <h3 class="text-primary">${data.total_attendance}</h3>
                    <p class="text-muted">Total Attendance</p>
                </div>
                <div class="col-md-4">
                    <h3 class="text-success">${data.unique_members}</h3>
                    <p class="text-muted">Unique Members</p>
                </div>
                <div class="col-md-4">
                    <h3 class="text-info">${data.average_daily_attendance.toFixed(1)}</h3>
                    <p class="text-muted">Average Daily Attendance</p>
                </div>
            </div>
            ${Object.keys(data.daily_breakdown).length > 0 ? `
                <hr>
                <h6>Daily Breakdown:</h6>
                <div class="row">
                    ${Object.entries(data.daily_breakdown).map(([date, count]) => `
                        <div class="col-md-3 mb-2">
                            <div class="card">
                                <div class="card-body p-2 text-center">
                                    <small class="text-muted">${date}</small><br>
                                    <strong>${count}</strong> visits
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
        
        document.getElementById('attendanceSummaryStats').innerHTML = statsHtml;
        
    } catch (error) {
        showAlert('Error loading attendance summary: ' + error.message, 'danger');
    }
}

// Load expiring subscriptions
async function loadExpiringSubscriptions() {
    const days = document.getElementById('expiringDaysSelect').value;
    
    try {
        const data = await apiCall(`/analytics/members/expiring-soon?days=${days}`);
        
        const container = document.getElementById('expiringMembersList');
        
        if (data.members.length === 0) {
            container.innerHTML = `
                <div class="alert alert-success">
                    <i class="bi bi-check-circle"></i> No subscriptions expiring in the next ${days} days!
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="alert alert-warning">
                <strong><i class="bi bi-exclamation-triangle"></i> ${data.total_expiring} subscription(s) expiring soon</strong>
            </div>
            <div class="table-responsive">
                <table class="table table-sm table-hover">
                    <thead>
                        <tr>
                            <th>Member Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Plan</th>
                            <th>Expiry Date</th>
                            <th>Days Left</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.members.map(member => `
                            <tr>
                                <td><strong>${member.member_name}</strong></td>
                                <td>${member.member_email}</td>
                                <td>${member.member_phone}</td>
                                <td>${member.plan_name}</td>
                                <td>${formatDate(member.end_date)}</td>
                                <td>
                                    <span class="badge ${member.days_remaining <= 3 ? 'bg-danger' : 'bg-warning'}">
                                        ${member.days_remaining} days
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
    } catch (error) {
        showAlert('Error loading expiring subscriptions: ' + error.message, 'danger');
    }
}

// Initialize default date range for attendance (last 30 days)
function initializeAttendanceDates() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    document.getElementById('attendanceEndDate').value = endDate.toISOString().split('T')[0];
    document.getElementById('attendanceStartDate').value = startDate.toISOString().split('T')[0];
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('analytics.html')) {
        // Initialize
        initializeYearSelect();
        initializeAttendanceDates();
        
        // Load all data
        loadMonthlyRevenue();
        loadYearlyRevenueChart();
        loadMemberGrowthChart();
        loadMemberStatusChart();
        loadPlanPopularity();
        loadRevenueByPlanChart();
        loadAttendanceSummary();
        loadExpiringSubscriptions();
        
        // Event listeners for year change
        document.getElementById('revenueYearSelect').addEventListener('change', function() {
            loadYearlyRevenueChart();
            loadMemberGrowthChart();
        });
        
        // Event listener for expiring days change
        document.getElementById('expiringDaysSelect').addEventListener('change', function() {
            loadExpiringSubscriptions();
        });
    }
});