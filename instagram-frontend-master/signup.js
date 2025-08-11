const passwordToggle = document.querySelector(".toggle-password");
const passwordInput = document.querySelector(".password");
const signUpForm = document.getElementById("SignUp-form");
const initialFields = document.getElementById("initial-fields");
const secondaryFields = document.getElementById("secondary-fields");
const submitButton = document.querySelector(".submit");
const error = document.querySelector(".error-message");

base_url = 'http://localhost:8080';
let isOtpSent = false;

passwordToggle.addEventListener("click", () => {
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    passwordToggle.textContent = "🙈";
  } else {
    passwordInput.type = "password";
    passwordToggle.textContent = "👀";
  }
});

signUpForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  error.style.display = "none";
  error.textContent = "";

  if (!isOtpSent) {
    await handleRequestOtp();
  } else {
    await handleCreateUser();
  }
});

function isValidUsername(username) {
  return /^[a-zA-Z0-9_]+$/.test(username);
}

async function handleRequestOtp() {
  const username = document.querySelector(".username").value.trim();
  const email = document.querySelector(".email").value.trim();

  if (!username || !email) {
    showError("Please fill in all required fields.");
    return;
  }

  if (!isValidUsername(username)) {
    showError("Username can only contain letters, numbers, and underscores.");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Requesting OTP";

  try {
      secondaryFields.style.display = "block";
      document.querySelector(".username-wrapper").style.display = "none";
      document.querySelector(".email-wrapper").style.display = "none";
      submitButton.textContent = "Submit";
    const response = await axios.post(`${base_url}/public/check-user`, { username, email });
    if (response.status === 200) {
      isOtpSent = true;
    }
  } catch (err) {
    showError(err.response?.data || "An error occurred.");
  } finally {
    submitButton.disabled = false;
  }
}

async function handleCreateUser() {
  const username = document.querySelector(".username").value.trim();
  const email = document.querySelector(".email").value.trim();
  const otp = document.querySelector(".otp").value.trim();
  const realName = document.querySelector(".realName").value.trim();
  const password = document.querySelector(".password").value.trim();

  if (!otp || !realName || !password) {
    showError("Please fill in all required fields.");
    return;
  }

  if (!isValidUsername(username)) {
    showError("Username can only contain letters, numbers, and underscores.");
    return;
  }

  try {
    const createUserResponse = await axios.post(`https://instagram-zaj5.onrender.com/public/create-user/otp=${otp}`, {
      username,
      email,
      realName,
      password,
    });

    if (createUserResponse.status === 200) {
      // Automatically log in the user after successful signup
      const loginCredentials = {
        login: username,
        password: password,
      };

      axios.defaults.withCredentials = true;
      const loginResponse = await axios.post('http://localhost:8080/auth/login', loginCredentials, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (loginResponse.status === 200) {
        localStorage.setItem('user', JSON.stringify(loginResponse.data));
        window.location.href = "/index.html";
      }
    }
  } catch (err) {
    showError(err.response?.data || "An error occurred.");
  }
}

function showError(msg) {
  error.textContent = msg;
  error.style.display = "block";
}
