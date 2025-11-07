// Attendance JavaScript
let allMembers = [];
let currentAttendance = [];

// Load active members for check-in
async function loadMembersForCheckIn() {
    try {
        allMembers = await apiCall('/members/?status=active');
        
        const checkInSelect = document.getElementById('checkInMemberSelect');
        const workoutSelect = document.getElementById('workoutMemberSelect');
        
        if (allMembers.length === 0) {
            const noMembersOption = '<option value="">No active members found</option>';
            if (checkInSelect) checkInSelect.innerHTML = noMembersOption;
            if (workoutSelect) workoutSelect.innerHTML = noMembersOption;
            return;
        }
        
        const memberOptions = '<option value="">Select a member...</option>' +
            allMembers.map(member => 
                `<option value="${member._id}">${member.name} - ${member.email}</option>`
            ).join('');
        
        if (checkInSelect) checkInSelect.innerHTML = memberOptions;
        if (workoutSelect) workoutSelect.innerHTML = memberOptions;
        
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

// Check-in member
async function checkIn() {
    const memberId = document.getElementById('checkInMemberSelect').value;
    
    if (!memberId) {
        showAlert('Please select a member', 'warning');
        return;
    }
    
    try {
        const response = await apiCall('/attendance/check-in', 'POST', { member_id: memberId });
        
        const member = allMembers.find(m => m._id === memberId);
        showAlert(`${member.name} checked in successfully!`, 'success');
        
        // Show check-in details
        document.getElementById('checkInStatus').innerHTML = `
            <div class="alert alert-success">
                <strong>Check-In Successful!</strong><br>
                Member: ${member.name}<br>
                Time: ${formatDateTime(response.check_in_time)}
            </div>
        `;
        
        // Reset form
        document.getElementById('checkInMemberSelect').value = '';
        
        // Reload data
        loadCurrentlyInGym();
        loadTodayStats();
        
    } catch (error) {
        showAlert('Error: ' + error.message, 'danger');
        document.getElementById('checkInStatus').innerHTML = `
            <div class="alert alert-danger">
                <strong>Check-In Failed!</strong><br>
                ${error.message}
            </div>
        `;
    }
}

// Load currently in gym members
async function loadCurrentlyInGym() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const attendance = await apiCall(`/attendance/?date=${today}`);
        
        // Filter only checked-in (not checked-out)
        const currentlyIn = attendance.filter(record => !record.check_out_time);
        
        const container = document.getElementById('currentlyInGymList');
        
        if (currentlyIn.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted">
                    <i class="bi bi-inbox" style="font-size: 3rem;"></i>
                    <p>No members currently in gym</p>
                </div>
            `;
            return;
        }
        
        // Get member details for each attendance record
        const membersInGym = await Promise.all(
            currentlyIn.map(async (record) => {
                try {
                    const member = await apiCall(`/members/${record.member_id}`);
                    return { ...record, member };
                } catch (error) {
                    return { ...record, member: null };
                }
            })
        );
        
        container.innerHTML = membersInGym.map(record => `
            <div class="card mb-2">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${record.member ? record.member.name : 'Unknown'}</strong><br>
                            <small class="text-muted">
                                <i class="bi bi-clock"></i> ${formatDateTime(record.check_in_time)}
                            </small>
                        </div>
                        <button class="btn btn-sm btn-warning" onclick="checkOut('${record._id}', '${record.member ? record.member.name : 'Member'}')">
                            <i class="bi bi-box-arrow-right"></i> Check Out
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading currently in gym:', error);
    }
}

// Check-out member
async function checkOut(attendanceId, memberName) {
    if (!confirm(`Check out ${memberName}?`)) {
        return;
    }
    
    try {
        await apiCall(`/attendance/check-out/${attendanceId}`, 'PUT');
        showAlert(`${memberName} checked out successfully!`, 'success');
        
        loadCurrentlyInGym();
        loadTodayStats();
        loadAttendanceRecords();
        
    } catch (error) {
        showAlert('Error checking out: ' + error.message, 'danger');
    }
}

// Load today's statistics
async function loadTodayStats() {
    try {
        const stats = await apiCall('/attendance/stats/today');
        
        document.getElementById('todayTotalCheckIns').textContent = stats.total_check_ins;
        document.getElementById('todayCurrentlyIn').textContent = stats.currently_in_gym;
        document.getElementById('todayCompletedSessions').textContent = stats.completed_sessions;
        
    } catch (error) {
        console.error('Error loading today stats:', error);
    }
}

// Load attendance records
async function loadAttendanceRecords(date = '', startDate = '', endDate = '') {
    try {
        let endpoint = '/attendance/';
        const params = new URLSearchParams();
        
        if (date) {
            params.append('date', date);
        } else if (startDate && endDate) {
            params.append('start_date', startDate);
            params.append('end_date', endDate);
        } else if (startDate) {
            params.append('start_date', startDate);
        } else if (endDate) {
            params.append('end_date', endDate);
        }
        
        const queryString = params.toString();
        if (queryString) {
            endpoint += '?' + queryString;
        }
        
        const attendance = await apiCall(endpoint);
        
        // Get member details for each record
        const recordsWithMembers = await Promise.all(
            attendance.map(async (record) => {
                try {
                    const member = await apiCall(`/members/${record.member_id}`);
                    return { ...record, member };
                } catch (error) {
                    return { ...record, member: null };
                }
            })
        );
        
        displayAttendanceRecords(recordsWithMembers);
        
    } catch (error) {
        showAlert('Error loading attendance records: ' + error.message, 'danger');
    }
}

// Display attendance records
function displayAttendanceRecords(records) {
    const tbody = document.getElementById('attendanceRecordsBody');
    
    if (records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="empty-state">
                        <i class="bi bi-calendar-x"></i>
                        <p>No attendance records found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = records.map(record => {
        const duration = calculateDuration(record.check_in_time, record.check_out_time);
        const isActive = !record.check_out_time;
        
        return `
            <tr class="fade-in">
                <td><strong>${record.member ? record.member.name : 'Unknown'}</strong></td>
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
                <td class="action-buttons">
                    ${isActive ? `
                        <button class="btn btn-sm btn-warning" onclick="checkOut('${record._id}', '${record.member ? record.member.name : 'Member'}')">
                            <i class="bi bi-box-arrow-right"></i> Check Out
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-danger" onclick="deleteAttendance('${record._id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Calculate duration between check-in and check-out
function calculateDuration(checkIn, checkOut) {
    if (!checkOut) {
        return '-';
    }
    
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

// Delete attendance record
async function deleteAttendance(attendanceId) {
    if (!confirm('Are you sure you want to delete this attendance record?')) {
        return;
    }
    
    try {
        await apiCall(`/attendance/${attendanceId}`, 'DELETE');
        showAlert('Attendance record deleted successfully!', 'success');
        loadAttendanceRecords();
    } catch (error) {
        showAlert('Error deleting attendance: ' + error.message, 'danger');
    }
}

// Load workout plans
async function loadWorkoutPlans() {
    try {
        const plans = await apiCall('/attendance/workout-plans');
        
        if (!plans || plans.length === 0) {
            displayWorkoutPlans([]);
            return;
        }
        
        // Get member details for each plan
        const plansWithMembers = await Promise.all(
            plans.map(async (plan) => {
                try {
                    const member = await apiCall(`/members/${plan.member_id}`);
                    return { ...plan, member };
                } catch (error) {
                    console.error(`Error loading member for plan ${plan._id}:`, error);
                    return { ...plan, member: { name: 'Unknown Member' } };
                }
            })
        );
        
        displayWorkoutPlans(plansWithMembers);
        
    } catch (error) {
        console.error('Error loading workout plans:', error);
        // Display empty state instead of showing error
        displayWorkoutPlans([]);
    }
}

// Display workout plans
function displayWorkoutPlans(plans) {
    const container = document.getElementById('workoutPlansContainer');
    
    if (!container) {
        console.error('Workout plans container not found');
        return;
    }
    
    if (plans.length === 0) {
        container.innerHTML = `
            <div class="col-12">
                <div class="empty-state">
                    <i class="bi bi-clipboard-x"></i>
                    <p>No workout plans found</p>
                    <button class="btn btn-primary mt-2" data-bs-toggle="modal" data-bs-target="#addWorkoutModal">
                        <i class="bi bi-plus-circle"></i> Create Your First Workout Plan
                    </button>
                </div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = plans.map(plan => `
        <div class="col-md-6 mb-4 fade-in">
            <div class="card h-100">
                <div class="card-header bg-primary text-white">
                    <h5 class="mb-0">${plan.plan_name}</h5>
                </div>
                <div class="card-body">
                    <p class="mb-2">
                        <strong><i class="bi bi-person"></i> Member:</strong> 
                        ${plan.member && plan.member.name ? plan.member.name : 'Unknown'}
                    </p>
                    ${plan.trainer_name ? `
                        <p class="mb-2">
                            <strong><i class="bi bi-person-badge"></i> Trainer:</strong> 
                            ${plan.trainer_name}
                        </p>
                    ` : ''}
                    <p class="mb-2">
                        <strong><i class="bi bi-calendar-event"></i> Created:</strong> 
                        ${formatDate(plan.created_date)}
                    </p>
                    <hr>
                    <strong>Exercises:</strong>
                    <pre class="mt-2" style="white-space: pre-wrap; font-size: 0.9rem; max-height: 300px; overflow-y: auto;">${plan.exercises}</pre>
                </div>
                <div class="card-footer bg-transparent">
                    <button class="btn btn-sm btn-warning" onclick="editWorkoutPlan('${plan._id}')">
                        <i class="bi bi-pencil"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteWorkoutPlan('${plan._id}')">
                        <i class="bi bi-trash"></i> Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Add workout plan
async function addWorkoutPlan() {
    const form = document.getElementById('addWorkoutForm');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const formData = new FormData(form);
    const planData = {
        member_id: formData.get('member_id'),
        plan_name: formData.get('plan_name'),
        exercises: formData.get('exercises'),
        trainer_name: formData.get('trainer_name') || null
    };
    
    try {
        await apiCall('/attendance/workout-plans', 'POST', planData);
        showAlert('Workout plan created successfully!', 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('addWorkoutModal'));
        modal.hide();
        form.reset();
        
        loadWorkoutPlans();
        
    } catch (error) {
        showAlert('Error creating workout plan: ' + error.message, 'danger');
    }
}

// Delete workout plan
async function deleteWorkoutPlan(planId) {
    if (!confirm('Are you sure you want to delete this workout plan?')) {
        return;
    }
    
    try {
        await apiCall(`/attendance/workout-plans/${planId}`, 'DELETE');
        showAlert('Workout plan deleted successfully!', 'success');
        loadWorkoutPlans();
    } catch (error) {
        showAlert('Error deleting workout plan: ' + error.message, 'danger');
    }
}


// Edit workout plan (placeholder)
function editWorkoutPlan(planId) {
    showAlert('Edit workout plan feature - to be implemented', 'info');
    // You can implement full edit functionality later if needed
}

// Workout Templates
const workoutTemplates = {
    beginner: {
        name: "Beginner Full Body Workout",
        exercises: `DAY 1, 3, 5 - Full Body Workout

WARM-UP (10 minutes):
- 5 minutes light cardio (treadmill/cycling)
- Dynamic stretching

EXERCISES:
1. Squats: 3 sets x 12 reps
   - Rest: 60 seconds between sets
   
2. Push-ups (or Knee Push-ups): 3 sets x 10 reps
   - Rest: 60 seconds
   
3. Dumbbell Rows: 3 sets x 12 reps each arm
   - Rest: 60 seconds
   
4. Lunges: 3 sets x 10 reps each leg
   - Rest: 60 seconds
   
5. Plank Hold: 3 sets x 30 seconds
   - Rest: 45 seconds
   
6. Dumbbell Shoulder Press: 3 sets x 10 reps
   - Rest: 60 seconds

COOL DOWN (5-10 minutes):
- Light cardio
- Static stretching

NOTES:
- Rest 1-2 days between workouts
- Focus on proper form
- Gradually increase weights as you get stronger`
    },
    
    intermediate: {
        name: "Intermediate Upper/Lower Split",
        exercises: `DAY 1 - UPPER BODY

WARM-UP: 10 minutes

1. Bench Press: 4 sets x 10 reps
2. Lat Pulldowns: 4 sets x 10 reps
3. Overhead Press: 3 sets x 10 reps
4. Barbell Rows: 4 sets x 10 reps
5. Dumbbell Bicep Curls: 3 sets x 12 reps
6. Tricep Dips: 3 sets x 12 reps
7. Face Pulls: 3 sets x 15 reps

---

DAY 2 - LOWER BODY

WARM-UP: 10 minutes

1. Squats: 4 sets x 10 reps
2. Romanian Deadlifts: 4 sets x 10 reps
3. Leg Press: 3 sets x 12 reps
4. Leg Curls: 3 sets x 12 reps
5. Calf Raises: 4 sets x 15 reps
6. Ab Wheel Rollouts: 3 sets x 10 reps

REPEAT: Upper/Lower 4 days per week`
    },
    
    advanced: {
        name: "Advanced Push/Pull/Legs Split",
        exercises: `DAY 1 - PUSH (Chest, Shoulders, Triceps)

1. Barbell Bench Press: 4 sets x 8 reps
2. Incline Dumbbell Press: 4 sets x 10 reps
3. Overhead Press: 4 sets x 8 reps
4. Lateral Raises: 4 sets x 12 reps
5. Tricep Pushdowns: 4 sets x 12 reps
6. Overhead Tricep Extension: 3 sets x 12 reps

---

DAY 2 - PULL (Back, Biceps)

1. Deadlifts: 4 sets x 6 reps
2. Pull-ups: 4 sets x 8-10 reps
3. Barbell Rows: 4 sets x 8 reps
4. Face Pulls: 4 sets x 15 reps
5. Barbell Curls: 4 sets x 10 reps
6. Hammer Curls: 3 sets x 12 reps

---

DAY 3 - LEGS (Quads, Hamstrings, Calves)

1. Squats: 5 sets x 8 reps
2. Romanian Deadlifts: 4 sets x 10 reps
3. Leg Press: 4 sets x 12 reps
4. Leg Extensions: 3 sets x 15 reps
5. Leg Curls: 3 sets x 15 reps
6. Calf Raises: 5 sets x 15 reps
7. Ab Work: 4 sets

CYCLE: Push/Pull/Legs/Rest/Repeat`
    },
    
    cardio: {
        name: "Cardio & Conditioning Program",
        exercises: `WEEK SCHEDULE:

MONDAY - HIIT Training (30 mins)
- 5 min warm-up
- 20 mins: 30 sec sprint, 90 sec walk (repeat)
- 5 min cool down

TUESDAY - Steady State Cardio
- 45 minutes moderate pace
- Treadmill, bike, or elliptical
- Heart rate: 60-70% max

WEDNESDAY - Circuit Training
- Jump Rope: 3 mins
- Burpees: 20 reps
- Mountain Climbers: 30 reps
- Box Jumps: 15 reps
- Rest 2 mins, repeat 4 times

THURSDAY - Active Recovery
- 30 mins light yoga or walking
- Stretching focus

FRIDAY - HIIT Training (30 mins)
- Similar to Monday

SATURDAY - Long Cardio Session
- 60 minutes low-intensity
- Outdoor activity preferred

SUNDAY - Rest

NOTES:
- Stay hydrated
- Monitor heart rate
- Listen to your body`
    },
    
    strength: {
        name: "Strength Training Program",
        exercises: `FOCUS: Building Maximum Strength

DAY 1 - SQUAT FOCUS
1. Back Squats: 5 sets x 5 reps (heavy)
2. Front Squats: 3 sets x 8 reps
3. Romanian Deadlifts: 3 sets x 8 reps
4. Leg Press: 3 sets x 10 reps
5. Core Work: 3 sets

DAY 2 - BENCH FOCUS
1. Barbell Bench Press: 5 sets x 5 reps (heavy)
2. Incline Bench Press: 3 sets x 8 reps
3. Dumbbell Rows: 4 sets x 8 reps
4. Overhead Press: 3 sets x 8 reps
5. Tricep Work: 3 sets x 10 reps

DAY 3 - DEADLIFT FOCUS
1. Conventional Deadlifts: 5 sets x 5 reps (heavy)
2. Deficit Deadlifts: 3 sets x 6 reps
3. Pull-ups: 4 sets x max reps
4. Barbell Rows: 3 sets x 8 reps
5. Bicep Work: 3 sets x 10 reps

NOTES:
- 3-5 minutes rest between heavy sets
- Progressive overload each week
- Deload every 4th week
- Proper form is critical`
    },
    
    weight_loss: {
        name: "Weight Loss & Fat Burning Program",
        exercises: `DAILY STRUCTURE:

MORNING (Before Breakfast):
- 20-30 mins fasted cardio
- Low intensity walking/cycling

WORKOUT SESSION (1 hour):

WARM-UP: 10 minutes cardio

CIRCUIT 1 (Repeat 3 times):
1. Squats: 15 reps
2. Push-ups: 12 reps
3. Jumping Jacks: 30 seconds
4. Plank: 30 seconds
Rest: 60 seconds

CIRCUIT 2 (Repeat 3 times):
1. Lunges: 12 reps each leg
2. Dumbbell Rows: 12 reps
3. Burpees: 10 reps
4. Mountain Climbers: 30 seconds
Rest: 60 seconds

CIRCUIT 3 (Repeat 3 times):
1. Step-ups: 12 reps each leg
2. Shoulder Press: 12 reps
3. High Knees: 30 seconds
4. Russian Twists: 20 reps
Rest: 60 seconds

COOL DOWN: 
- 10 mins walking
- Stretching

FREQUENCY: 5-6 days per week

NUTRITION TIPS:
- Caloric deficit of 300-500 calories
- High protein intake
- Drink 3-4 liters water daily
- Avoid processed foods`
    }
};

// Load workout template
function loadWorkoutTemplate() {
    const select = document.getElementById('workoutTemplateSelect');
    const template = workoutTemplates[select.value];
    
    if (template) {
        document.getElementById('workoutPlanName').value = template.name;
        document.getElementById('workoutExercises').value = template.exercises;
    } else {
        document.getElementById('workoutPlanName').value = '';
        document.getElementById('workoutExercises').value = '';
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('attendance.html')) {
        loadMembersForCheckIn();
        loadCurrentlyInGym();
        loadTodayStats();
        loadAttendanceRecords();
        loadWorkoutPlans(); // Make sure this is here!
        
        // Auto-refresh currently in gym every 30 seconds
        setInterval(() => {
            loadCurrentlyInGym();
            loadTodayStats();
        }, 30000);
        
        // Tab change event - reload workout plans when workout tab is clicked
        document.getElementById('workout-tab').addEventListener('click', function() {
            loadWorkoutPlans();
        });
        
        // Date filters
        document.getElementById('dateFilter').addEventListener('change', function() {
            const date = this.value;
            if (date) {
                document.getElementById('startDateFilter').value = '';
                document.getElementById('endDateFilter').value = '';
                loadAttendanceRecords(date);
            } else {
                loadAttendanceRecords();
            }
        });
        
        document.getElementById('startDateFilter').addEventListener('change', function() {
            document.getElementById('dateFilter').value = '';
            const startDate = this.value;
            const endDate = document.getElementById('endDateFilter').value;
            loadAttendanceRecords('', startDate, endDate);
        });
        
        document.getElementById('endDateFilter').addEventListener('change', function() {
            document.getElementById('dateFilter').value = '';
            const startDate = document.getElementById('startDateFilter').value;
            const endDate = this.value;
            loadAttendanceRecords('', startDate, endDate);
        });
    }
});