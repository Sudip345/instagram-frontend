const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const base_url = 'http://localhost:8080';//'https://instagram-wnh3.onrender.com';
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

  let response;
  try {
    

      // Configure axios defaults
      axios.defaults.withCredentials = true;
      
       response = await axios.post(`${base_url}/auth/login`, credentials, {
          headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
          }
      });

      //.log("Login response:", response.status);

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
      //.error("Login error:", err);
      if (err.response && err.response.status === 401) {
          error.textContent = "Invalid credentials. Please try again.";
      } else {
          error.textContent = "Network error or server not responding";
      }
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
