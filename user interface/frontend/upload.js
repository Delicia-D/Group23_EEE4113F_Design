document.getElementById("uploadForm").addEventListener("submit", function (e) {
    e.preventDefault();
  
    const form = e.target;
    const formData = new FormData(form);
    const uploadButton = document.getElementById("uploadButton");
    const uploadText = document.getElementById("uploadText");
    const uploadSpinner = document.getElementById("uploadSpinner");
    const uploadMessage = document.getElementById("uploadMessage");
    
    // Show loading state
    uploadText.classList.add("hidden");
    uploadSpinner.classList.remove("hidden");
    uploadButton.disabled = true;
    uploadMessage.innerText = "";
    uploadMessage.className = "";
    
    fetch("https://penguin-monitoring-backend.onrender.com/upload", {
      method: "POST",
      body: formData
    })
    .then(res => {
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    })
    .then(data => {
      uploadMessage.innerText = "Upload successful!";
      uploadMessage.className = "success";
      form.reset();
    })
    .catch(err => {
      console.error(err);
      uploadMessage.innerText = "Upload failed. Please try again.";
      uploadMessage.className = "error";
    })
    .finally(() => {
      // Reset button state
      uploadText.classList.remove("hidden");
      uploadSpinner.classList.add("hidden");
      uploadButton.disabled = false;
    });
});

function applySavedTheme() {
    const savedTheme = localStorage.getItem('themePreference');
    const lightMode = document.getElementById('upload-light-stylesheet');
    const darkMode = document.getElementById('upload-dark-stylesheet');

    if (savedTheme === 'light') {
      document.body.classList.add('light-mode');
      lightMode.disabled = false;
      darkMode.disabled = true;
    } else {
      document.body.classList.remove('light-mode');
      lightMode.disabled = true;
      darkMode.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', applySavedTheme);