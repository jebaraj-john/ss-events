const API_URL = 'https://script.google.com/macros/s/AKfycbygLkC7s4OIDYWxK6NbmSHzrV50LtxGSnYrlOZ8hPiyhGVkP0-1kECQ8zOjFJm89P-BFQ/exec';

function fetchStudentDetails() {
    let input = document.getElementById('searchInput').value;
    if (input.length < 5 && !input.startsWith("TC")) {
        input = "TC" + input
    }

    document.getElementById('backdrop').style.display = 'flex';

    fetch(`${API_URL}?action=getStudentDetails&input=${input}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('backdrop').style.display = 'none';
            displayStudentDetails(data.data);
        })
        .catch(() => {
            document.getElementById('backdrop').style.display = 'none';
            const messageElement = document.getElementById('checkInModalMessage');
            messageElement.innerText = 'Error retrieving data';
            messageElement.className = 'text-danger';
            const modal = new bootstrap.Modal(document.getElementById('checkInModal'));
            modal.show();
        });
}

function displayStudentDetails(details) {
    let content = '';
    if (details.length > 0) {
        details.forEach(detail => {
            content += `<div class="card mt-3">
              <div class="card-body">
                <h5>Student Name: ${detail.studentName}</h5>
                <p><strong>Reg No:</strong> ${detail.regRefNo}</p>
                <p>Teacher: ${detail.teacherName}</p>
                <p>Department: ${detail.department}</p>
                <p>Service: ${detail.service}</p>
                <p>Event: ${detail.eventParticipating}</p>
                <p>Checked In: <span id="checkedIn${detail.regRefNo}">${detail.checkedIn}</span></p>
                <button class="btn btn-primary" onclick="checkIn('${detail.regRefNo}')">Check In</button>
              </div>
            </div>`;
        });
    } else {
        content = '<p class="text-danger mt-3">Student not found</p>';
    }
    document.getElementById('details').innerHTML = content;
}

function checkIn(regRefNo) {

    document.getElementById('backdrop').style.display = 'flex';

    fetch(`${API_URL}?action=checkInStudent&regRefNo=${regRefNo}`)
        .then(response => response.json())
        .then(result => {
            // Hide backdrop
            document.getElementById('backdrop').style.display = 'none';

            // Set message and modal appearance based on result
            const messageElement = document.getElementById('checkInModalMessage');
            const modal = new bootstrap.Modal(document.getElementById('checkInModal'));

            if (result.status.toLowerCase() === 'success') {
                // Update UI for checked-in status and display success message
                document.getElementById(`checkedIn${regRefNo}`).innerText = 'YES';
                messageElement.innerText = 'Check-in successful!';
                messageElement.className = 'text-success'; // Optionally style success message in green
            } else {
                // Display failure message
                messageElement.innerText = 'Check-in failed. Please try again.';
                messageElement.className = 'text-danger'; // Optionally style failure message in red
            }

            // Show the modal with the appropriate message
            modal.show();
        })
        .catch(() => {
            // Hide backdrop and show error message in modal
            document.getElementById('backdrop').style.display = 'none';
            const messageElement = document.getElementById('checkInModalMessage');
            messageElement.innerText = 'Error during check-in. Please try again.';
            messageElement.className = 'text-danger';
            const modal = new bootstrap.Modal(document.getElementById('checkInModal'));
            modal.show();
        });
}
