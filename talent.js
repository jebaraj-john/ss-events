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

function toggleKeyboardType() {
    const input = document.getElementById('searchInput');
    input.type = input.type === 'tel' ? 'text' : 'tel';
    if (input.type === 'tel') {
        input.type = 'tel';
        document.querySelector('.toggle-btn .bi').classList.remove('bi-alphabet-uppercase');
        document.querySelector('.toggle-btn .bi').classList.add('bi-123');
        input.focus()
        return;
    }

    input.type = 'text';
    document.querySelector('.toggle-btn .bi').classList.remove('bi-123');
    document.querySelector('.toggle-btn .bi').classList.add('bi-alphabet-uppercase');
    input.focus()
    return;
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

// window.addEventListener("load", (event) => {
//     console.log("page is fully loaded");
//     login();
// });