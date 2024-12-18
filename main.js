const API_URL = 'https://script.google.com/macros/s/AKfycbwUMhXBImWs4m9tgn4WR_maBTgYxrbJMZspvrtGITaRLurtJcAV2LSMoFJNlK-hjJQBWg/exec';

function fetchStudentDetails() {
    let input = document.getElementById('searchInput').value;
    if (input.length < 5 && !input.startsWith("TC")) {
        input = "TC" + input;
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
                <h5>Name: ${detail.name}</h5>
                <p><strong>Reg No:</strong> ${detail.regRefNo}</p>
                <p><strong>Role:</strong> ${detail.role}</p>
                <p><strong>Payment Mode:</strong> ${detail.paymentMode}</p>
                <p><strong>Center:</strong> ${detail.center}</p>
                <p><strong>Service:</strong> ${detail.service}</p>
                <p><strong>Department:</strong> ${detail.department}</p>
                <p>Checked In: <span id="checkedIn${detail.regRefNo}">${detail.checkedIn}</span></p>
                <button class="btn btn-primary" onclick="checkIn('${detail.regRefNo}')">Check In</button>
              </div>
            </div>`;
        });
    } else {
        content = '<p class="text-danger mt-3">Record not found</p>';
    }
    document.getElementById('details').innerHTML = content;
}

function checkIn(regRefNo) {
    document.getElementById('backdrop').style.display = 'flex';

    fetch(`${API_URL}?action=checkInStudent&regRefNo=${regRefNo}`)
        .then(response => response.json())
        .then(result => {
            document.getElementById('backdrop').style.display = 'none';

            const messageElement = document.getElementById('checkInModalMessage');
            const modal = new bootstrap.Modal(document.getElementById('checkInModal'));

            if (result.status.toLowerCase() === 'success') {
                document.getElementById(`checkedIn${regRefNo}`).innerText = 'YES';
                messageElement.innerText = 'Check-in successful!';
                messageElement.className = 'text-success';
            } else {
                messageElement.innerText = 'Check-in failed. Please try again.';
                messageElement.className = 'text-danger';
            }

            modal.show();
        })
        .catch(() => {
            document.getElementById('backdrop').style.display = 'none';
            const messageElement = document.getElementById('checkInModalMessage');
            messageElement.innerText = 'Error during check-in. Please try again.';
            messageElement.className = 'text-danger';
            const modal = new bootstrap.Modal(document.getElementById('checkInModal'));
            modal.show();
        });
}
