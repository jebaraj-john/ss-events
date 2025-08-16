const API_URL = "https://script.google.com/macros/s/AKfycbxmH-igJu1GWaT_y0SdimTKypuZtyQTHJ9f7aoYnqnM3wRreyUAzU4yS8Rg-3FV6sZ8/exec";

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

function displayStudentDetails(details) {
    let content = '';
    if (details.length > 0) {
        details.forEach(detail => {
            paymentStatus = detail.paymentStatus == "PAID" ? "PAID" : "NOT PAID";
            content += `<div class="card mt-3">
              <div class="card-body">
                <h5>Name: ${detail.name}</h5>
                <p><strong>Reg No:</strong> ${detail.regRefNo}</p>
                <p><strong>Gender:</strong> ${detail.gender}</p>
                <p><strong>Payment Mode:</strong> ${detail.paymentMode}</p>
                <p><strong>Department:</strong> ${detail.department}</p>
                <p><strong>MobileNumber:</strong> ${detail.mobileNumber}</p>
                <p><strong>BookRequired:</strong> ${detail.bookRequired}</p>
                <p>
                    Payment Received:
                    <span class="${paymentStatus.toLowerCase().replace(" ", "-")}" id="paid${detail.regRefNo}">
                        ${paymentStatus}
                    </span>
                </p>
                <p>Token Issued: <span id="token_issued${detail.regRefNo}">${detail.tokenStatus}</span></p>
                <button class="btn btn-primary" onclick="checkIn('${detail.regRefNo}', 'paid')">Payment Received</button>
                <button class="btn btn-primary" onclick="checkIn('${detail.regRefNo}', 'token_issued')">Issue Token</button>
              </div>
            </div>`;
        });
    } else {
        content = '<p class="text-danger mt-3">Record not found</p>';
    }
    document.getElementById('details').innerHTML = content;
}

function checkIn(regRefNo, status) {
    document.getElementById('backdrop').style.display = 'flex';
    let statusTextMap = {
        'paid': 'Payment Received',
        'token_issued': 'Token Issued',
    }
    const amount = document.querySelector("#payment");
    const accessTokenField = document.querySelector("#accessToken");
    fetch(`${API_URL}?action=checkInStudent&regRefNo=${regRefNo}&status=${status}&authToken=${accessTokenField.value}`)
        .then(response => response.json())
        .then(result => {
            document.getElementById('backdrop').style.display = 'none';

            const messageElement = document.getElementById('checkInModalMessage');
            const modal = new bootstrap.Modal(document.getElementById('checkInModal'));

            if (result.status.toLowerCase() === 'success') {
                document.getElementById(`${status}${regRefNo}`).innerText = 'YES';
                messageElement.innerText = `${statusTextMap[status]} successful!`;
                messageElement.className = 'text-success';
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