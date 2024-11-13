// Main App Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadWelcomeScreen();
});

// Function to navigate between views
function navigateTo(viewFunction) {
    document.getElementById('app-content').innerHTML = '';
    viewFunction();
}
