const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
base_url = 'http://localhost:8080';
document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  
  const username = document.querySelector('.username').value.trim();
  const email = document.querySelector('.email').value.trim();
  const password = document.querySelector('.password').value.trim();
  const submitButton = document.querySelector('.submit-btn');
  const error = document.getElementById('errorMessage');

  // Validate inputs
  if ((!username && !email) || !password) {
      error.textContent = 'Please fill in required fields';
      error.style.display = 'block';
      return;
  }

  // Disable submit button during request
  submitButton.disabled = true;
  submitButton.textContent = "Logging in...";

  const credentials = {
      login: username || email,
      password: password
  };

  try {
      console.log("Sending login request with credentials:", {
          login: credentials.login,
          password: "********"
      });

      // Configure axios defaults
      axios.defaults.withCredentials = true;
      
      const response = await axios.post(`${base_url}/auth/login`, credentials, {
          headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
          }
      });

      console.log("Login response:", response.status);

      error.textContent = "Login successful!";
      error.style.color = "green";
      error.style.display = "block";
      
      // Store any necessary data from response
      localStorage.setItem('user', JSON.stringify(response.data));
      
      // Wait for 1 second before redirecting
      setTimeout(() => {
          window.location.href = '/index.html';
      }, 1000);
  } catch (err) {
      console.error("Login error:", err);
      error.textContent = err.response?.data?.message || "Network error occurred";
      error.style.color = "red";
      error.style.display = "block";
  } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Submit";
  }
});

// Add password toggle functionality
document.querySelector('.toggle-password').addEventListener('click', function() {
    const passwordInput = document.querySelector('.password');
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    this.textContent = type === 'password' ? '👀' : '🙈';
});
