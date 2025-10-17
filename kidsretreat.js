// Fetch and display payment summary
function checkedInSummary() {
    document.getElementById('backdrop').style.display = 'flex';
    const accessTokenField = document.querySelector("#accessToken");
    if (accessTokenField.value == "") {
        document.getElementById('backdrop').style.display = 'none';
        return;
    }

    fetch(`${API_URL}?action=checkedInSummary&authToken=${accessTokenField.value}`)
        .then(response => response.json())
        .then(result => {
            document.getElementById('backdrop').style.display = 'none';
            if (result.status && result.status.toLowerCase() === 'success') {
                // Update the summary cards with the data
                document.getElementById('totalUPI').innerText = `\u20B9${result.data.totalUPI || 0}`;
                document.getElementById('totalCash').innerText = `\u20B9${result.data.totalCash || 0}`;
                document.getElementById('totalAmount').innerText = `\u20B9${result.data.totalAmount || 0}`;
            } else {
                const messageElement = document.getElementById('checkInModalMessage');
                messageElement.innerText = result.message || 'Failed to load summary data.';
                messageElement.className = 'text-danger';
                const modal = new bootstrap.Modal(document.getElementById('checkInModal'));
                modal.show();
            }
        })
        .catch((error) => {
            console.log(error);
            document.getElementById('backdrop').style.display = 'none';
            const messageElement = document.getElementById('checkInModalMessage');
            messageElement.innerText = 'Error retrieving summary data';
            messageElement.className = 'text-danger';
            const modal = new bootstrap.Modal(document.getElementById('checkInModal'));
            modal.show();
        });
}

// List all students for the Report tab
function listStudents() {
    document.getElementById('backdrop').style.display = 'flex';
    const accessTokenField = document.querySelector("#accessToken");
    fetch(`${API_URL}?action=listStudentDetails&authToken=${accessTokenField.value}`)
        .then(response => response.json())
        .then(result => {
            document.getElementById('backdrop').style.display = 'none';
            if (result.status && result.status.toLowerCase() === 'success') {
                listStudentDetails(result.data);
            } else {
                document.getElementById('reportTable').innerHTML = `<p class='text-danger'>${result.message || 'Failed to load data.'}</p>`;
            }
        })
        .catch(() => {
            document.getElementById('backdrop').style.display = 'none';
            document.getElementById('reportTable').innerHTML = `<p class='text-danger'>Error retrieving data</p>`;
        });
}

// Render student list as a table in the Report tab
function listStudentDetails(details) {
    if (!details || details.length === 0) {
        document.getElementById('reportTable').innerHTML = '<p class="text-danger">No records found.</p>';
        return;
    }

    // Destroy existing DataTable if it exists
    if ($.fn.DataTable.isDataTable('#studentTable')) {
        $('#studentTable').DataTable().destroy();
    }

    let table = `<div class="table-responsive"><table id="studentTable" class="table table-bordered table-striped">
        <thead class="table-light">
            <tr>
                <th>#</th>
                <th>Name</th>
                <th>Reg No</th>
                <th>Role</th>
                <th>Amount to be Paid</th>
                <th>Center</th>
                <th>Service</th>
                <th>Department</th>
                <th>Mobile Number</th>
                <th>Bus Required</th>
                <th>Food Preference</th>
                <th>Payment Status</th>
                <th>Payment Received By</th>
            </tr>
        </thead>
        <tbody>`;
    details.forEach((detail, idx) => {
        table += `<tr>
            <td>${idx + 1}</td>
            <td>${detail.name || ''}</td>
            <td>${detail.regRefNo || ''}</td>
            <td>${detail.role || ''}</td>
            <td>${detail.paymentMode || ''}</td>
            <td>${detail.center || ''}</td>
            <td>${detail.service || ''}</td>
            <td>${detail.department || ''}</td>
            <td>${detail.mobileNumber || ''}</td>
            <td>${detail.busRequired || ''}</td>
            <td>${detail.foodPreference || ''}</td>
            <td>${detail.paymentStatus || ''}</td>
            <td>${detail.tokenStatus || ''}</td>
        </tr>`;
    });
    table += '</tbody></table></div>';
    document.getElementById('reportTable').innerHTML = table;

    // Initialize DataTable with search, pagination and CSV export
    $('#studentTable').DataTable({
        dom: 'Bfrtip',
        buttons: [
            {
                extend: 'csv',
                text: 'Download CSV',
                className: 'btn btn-primary',
                filename: 'KidsRetreat2025_Students_' + new Date().toISOString().split('T')[0],
                exportOptions: {
                    columns: [1,2,3,4,5,6,7,8,9,10] // Skip the # column
                }
            }
        ],
        pageLength: 100,
        order: [[2, 'asc']], // Sort by Name column by default
        search: {
            return: true
        },
        language: {
            search: "Search all columns:"
        }
    });
}
const API_URL = "https://script.google.com/macros/s/AKfycbzXCQcCXIxhDG3vOhAiUGC-ltfJ8sfwo-_QSXuLuA9yQkp6H3JA1Kc4aL1sTPlE_wEk4A/exec";

function toggleKeyboardType() {
    const input = document.getElementById('searchInput');
    input.type = input.type === 'tel' ? 'text' : 'tel';
    input.focus()
}

function setInputType(type) {
    const input = document.getElementById("searchInput");
    input.type = type; // Change input type
    if (type == "tel") {
        input.placeholder = "Enter Leader/Parent Mobile No or Reg Ref No"
    }
    else {
        input.placeholder = "Enter Student/Leader Name"
    }
}

function fetchStudentDetails() {
    let input = document.getElementById('searchInput').value;




    document.getElementById('backdrop').style.display = 'flex';
    const accessTokenField = document.querySelector("#accessToken");
    // displayStudentDetails([ { name: 'Ashnika Angel K',
    //     regRefNo: 'VBSNC0005',
    //     gender: 'Female',
    //     paymentMode: 'Cash (Kindly make the Registration Fee Rs 50 at the Sunday School Registration Counter at the respective Centers)',
    //     department: 'Inter (VIII & IX)',
    //     mobileNumber: 7200007648,
    //     bookRequired: 'English' } ]);
    fetch(`${API_URL}?action=getStudentDetails&input=${input}&authToken=${accessTokenField.value}`)
        .then(response => response.json())
        .then(result => {
            document.getElementById('backdrop').style.display = 'none';
            if (result.status.toLowerCase() === 'success') {
                displayStudentDetails(result.data);
            } else {
                const messageElement = document.getElementById('checkInModalMessage');
                messageElement.innerText = result.message;
                messageElement.className = 'text-danger';
                const modal = new bootstrap.Modal(document.getElementById('checkInModal'));
                modal.show();
            }

        })
        .catch((error) => {
            console.log(error)
            document.getElementById('backdrop').style.display = 'none';
            const messageElement = document.getElementById('checkInModalMessage');
            messageElement.innerText = 'Error retrieving data';
            messageElement.className = 'text-danger';
            const modal = new bootstrap.Modal(document.getElementById('checkInModal'));
            modal.show();
        });

}

// store payment status per regRefNo
let paymentStatusMap = {};

function displayStudentDetails(details) {
    let content = '';
    if (details.length > 0) {
        details.forEach(detail => {
            // use detail.paymentStatus if available, else ""
            const paymentStatus = detail.paymentStatus || "";

            // initialize map
            paymentStatusMap[detail.rowNo] = paymentStatus;

            content += `<div class="card mt-3">
              <div class="card-body">
                <h5>Name: ${detail.name}</h5>
                <p><strong>Reg No:</strong> ${detail.regRefNo}</p>
                <p><strong>Role:</strong> ${detail.role}</p>
                <p><strong>Payment Mode:</strong> ${detail.paymentMode}</p>
                <p><strong>Center:</strong> ${detail.center}</p>
                <p><strong>Department:</strong> ${detail.department}</p>
                <p><strong>MobileNumber:</strong> ${detail.mobileNumber}</p>
                <p><strong>Bus Required:</strong> ${detail.busRequired}</p>
                <p class="${detail.foodPreference.toString().toLowerCase()}">
                    <strong>Food Preference:</strong> ${detail.foodPreference}
                </p>

                <p>
                    Payment Mode:
                    <input type="radio"
                           name="paymentMode${detail.rowNo}"
                           onchange="updatePaymentStatus('${detail.rowNo}', this.value)"
                           value="UPI"
                           ${paymentStatus === "UPI" ? "checked" : ""}>
                    <label for="paymentMode${detail.rowNo}UPI">UPI</label>

                    <input type="radio"
                           name="paymentMode${detail.rowNo}"
                           onchange="updatePaymentStatus('${detail.rowNo}', this.value)"
                           value="CASH"
                           ${paymentStatus === "CASH" ? "checked" : ""}>
                    <label for="paymentMode${detail.rowNo}CASH">CASH</label>
                </p>

                <p>
                    Payment Received:
                    <span class="${paymentStatus.toLowerCase()}" id="paid${detail.rowNo}">
                        ${paymentStatus || "Not Paid"}
                    </span>
                </p>
                <p>
                    Payment Received By:
                    <span id="payment_received_by${detail.rowNo}">${detail.paymentReceivedBy}</span>
                </p>
                <p>
                    Token Issued By:
                    <span id="token_issued${detail.rowNo}">${detail.tokenIssuedBy}</span>
                </p>

                <button class="btn btn-primary"
                        onclick="checkIn('${detail.rowNo}', 'paid')"> Payment Received
                </button>
                <button class="btn btn-primary issue-token-btn"
                        onclick="checkIn('${detail.rowNo}', 'token_issued')"
                        ${paymentStatus === "" ? "disabled" : ""}>Issue Token</button>
              </div>
            </div>`;
        });
    } else {
        content = '<p class="text-danger mt-3">Record not found</p>';
    }
    document.getElementById('details').innerHTML = content;
}

// global function
function updatePaymentStatus(regRefNo, value) {
    const normalized = value.toUpperCase() === "UPI" ? "UPI" : "CASH";
    paymentStatusMap[regRefNo] = normalized;

    console.log(`Payment status for ${regRefNo} updated to: ${normalized}`);

    // update display span
    document.getElementById(`paid${regRefNo}`).innerText = normalized;
}

// checkIn with validation
function checkIn(regRefNo, status) {
    const paymentMode = paymentStatusMap[regRefNo] || "";
    let issueTokenBtn = document.getElementById(`${status}${regRefNo}`).parentElement.parentElement.querySelector('.issue-token-btn');


    if (!paymentMode) {
        alert("Please select a payment mode before continuing.");
        return;
    }

    document.getElementById('backdrop').style.display = 'flex';
    let statusTextMap = {
        'paid': 'Payment Received',
        'token_issued': 'Token Issued',
    };
    const accessTokenField = document.querySelector("#accessToken");

    fetch(`${API_URL}?action=checkInStudent&regRefNo=${regRefNo}&status=${status}&paymentMode=${paymentMode}&authToken=${accessTokenField.value}`)
        .then(response => response.json())
        .then(result => {
            document.getElementById('backdrop').style.display = 'none';

            const messageElement = document.getElementById('checkInModalMessage');
            const modal = new bootstrap.Modal(document.getElementById('checkInModal'));

            if (result.status.toLowerCase() === 'success') {
                document.getElementById(`${status}${regRefNo}`).innerText = 'YES';
                messageElement.innerText = `${statusTextMap[status]} successful!`;
                messageElement.className = 'text-success';
                if (status === 'paid') {
                    issueTokenBtn.disabled = paymentMode === "";
                }
            } else {
                messageElement.innerText = `${statusTextMap[status]} failed. Please try again.`;
                messageElement.className = 'text-danger';
            }

            modal.show();
        })
        .catch(() => {
            document.getElementById('backdrop').style.display = 'none';
            const messageElement = document.getElementById('checkInModalMessage');
            messageElement.innerText = `Error during ${statusTextMap[status]}. Please try again.`;
            messageElement.className = 'text-danger';
            const modal = new bootstrap.Modal(document.getElementById('checkInModal'));
            modal.show();
        });
}


function login() {
    console.log(auth0)
    auth0.createAuth0Client({
        domain: "dev-sazlz3uf0genwd7a.us.auth0.com",
        clientId: "APU6p14IiXfP3Q83B1c8VvPy4cZ2YAH9",
        authorizationParams: {
            redirect_uri: window.location.origin + "/ss-events/index.html"
        }
    }).then(async (auth0Client) => {

        console.log(auth0Client)


        // const loginButton = document.querySelector("#loginBtn");

        // loginButton.addEventListener("click", (e) => {
        //     e.preventDefault();
        //     auth0Client.loginWithRedirect();
        // });


        if (location.search.includes("state=") &&
            (location.search.includes("code=") ||
                location.search.includes("error="))) {
            await auth0Client.handleRedirectCallback();
            window.history.replaceState({}, document.title, "/ss-events");
        }

        // Assumes a button with id "logout" in the DOM
        const logoutButton = document.getElementById("logout");

        logoutButton.addEventListener("click", (e) => {
            e.preventDefault();
            //auth0Client.logout();
            auth0Client.logout({
                async onRedirect(url) {
                    window.location.replace(url);
                }
            });
            //auth0Client.loginWithRedirect();
        });

        const isAuthenticated = await auth0Client.isAuthenticated();


        // Assumes an element with id "profile" in the DOM
        const profileElement = document.getElementById("profile");

        if (isAuthenticated) {
            const userProfile = await auth0Client.getUser();
            logoutButton.style.display = "block";
            profileElement.style.display = "block";
            profileElement.innerHTML = `
            <p style="margin: 0 3px 0px 0px;">${userProfile.name}</p>
            <img alt="User Icon" class="rounded-circle me-2"
            style="width: 40px; height: 40px;" src="${userProfile.picture}" />
        `;
        } else {
            auth0Client.logout();
            profileElement.style.display = "none";
            logoutButton.style.display = "none";
            auth0Client.loginWithRedirect();
        }
        const accessTokenField = document.querySelector("#accessToken");
        const accessToken = await auth0Client.getTokenSilently();
        accessTokenField.value = accessToken;

        console.log(accessToken)
    })
        .catch((error) => {
            console.log(error)
        });
}

window.addEventListener("load", (event) => {
    console.log("page is fully loaded");
    login();
});